# Track H FU (Chat 4) — RN/Web 打印客户端

> **背景**: U-ACT-1 主 PR #678 已 merged. STATUS Day 10 列了 follow-up:
> "RN 客户端打印服务 — Sprint 1 PR #659 仅 ship backend; 我所有 print-pdf
> handlers 都是 Alert.alert('RN 客户端待 Sprint 2 收尾')". 本 FU 收尾.
>
> **基础**: origin/main HEAD `8f0a6f8ce` (含 #678 + #681 + #682 + #683/#684).
> **分支**: `fix/sprint2-fu-chat4-rn-print-client`
> **Worktree**: `../my-prototype-logistics-fu-chat4`

---

## 2026-05-16 — RN + Web print client 一次到位

### ✅ 完成

#### 1. RN 客户端 — `frontend/CretasFoodTrace/src/services/api/printApiClient.ts` (NEW)

5 个方法对应 PrintController.java 5 个 endpoint:
- `printSalesOrder(factoryId, id, opts?)`
- `printPurchaseOrder(factoryId, id, opts?)`
- `printQuotation(factoryId, id, opts?)`
- `printProductionTask(factoryId, id, opts?)`
- `printMaterialRequisition(factoryId, id, opts?)`

实现要点:
- **绕开 apiClient 拦截器** — 默认拦截器 unwrap response.data, 会破坏 binary stream. 改用 `expo-file-system.downloadAsync` 直接流到 documentDirectory + Bearer header.
- **Token 来源** — `StorageService.getSecureItem('secure_access_token')`, 跟 apiClient 同源, 401 刷新逻辑下次 apiClient 调用时仍触发.
- **Sharing** — 下载完自动 `Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`, 弹系统打印/分享面板.
- **错误模型** —
  - `PrintForbiddenError` (status=403, K2/K4/K5 RBAC 拒绝, e.g. 仓管打销售单 PDF)
  - `PrintFailedError` (其他 non-2xx, e.g. 502 Python printer down)
- **`safePrint(docType, id, opts?)` 便捷包装** — 从 authStore 拉 factoryId, dispatch 到对应 printer, 错误用 Alert 友好提示, 返 null. row-action handler 一行搞定:
  ```ts
  'print-pdf': (e: RowContext) => { void safePrint('sales-order', e.id); },
  ```

#### 2. Web 客户端 — `web-admin/src/api/printApi.ts` (NEW)

同 5 方法 + `safePrint(docType, factoryId, id, opts?)` Vue 包装:
- 用 request 的 `_keepResponse: true` opt-out 跳 envelope unwrap (api/request.ts:177 文档)
- Blob → `URL.createObjectURL` → `<a download>` → click → revoke (浏览器原生下载)
- 403 → ElMessage.error('当前角色无该单据的打印权限')
- 502 → ElMessage.error('打印服务暂不可用 — 请稍后重试')
- 其他 → `PDF 下载失败 (${status})`
- `fileName` 选项允许业务层自定义文件名 (e.g. `销售订单_SO-2026-001.pdf`)

#### 3. 12 个 print-pdf stub 全部替换

**RN (6)**:
| Screen | docType |
|---|---|
| factory-admin/inventory/SalesOrderListScreen.tsx | sales-order |
| factory-admin/inventory/PurchaseOrderListScreen.tsx | purchase-order |
| factory-admin/inventory/TransferListScreen.tsx | material-requisition (warehouse:read 准入, 复用) |
| factory-admin/inventory/ReturnOrderListScreen.tsx | sales-order / purchase-order (按 returnType 选) |
| restaurant/wastage/WastageListScreen.tsx | material-requisition |
| dispatcher/plan/PlanListScreen.tsx | production-task |

**Web (6)**:
| View | docType |
|---|---|
| sales/orders/list.vue | sales-order |
| sales/returns/list.vue | sales-order (后端 RBAC 仍校验 sales:read) |
| sales/shipments/list.vue | sales-order (用 row.salesOrderId, 出货关联 SO PDF) |
| procurement/receives/list.vue | material-requisition |
| production/plans/list.vue | production-task |
| production/batches/list.vue | production-task |

### 复用决策说明 (后端只 ship 5 模板)

后端 PrintController 当前只 ship 5 单据模板; transfer / wastage / return 没有专属模板.
为不阻 customer 体验, **暂复用最近的 RBAC-准入 模板**:
- transfer / wastage → material-requisition (warehouse:read 准入)
- sales return → sales-order (sales:read 准入)
- purchase return → purchase-order (procurement:read 准入)

后续 PR 可加 transfer/wastage/return 专属模板; 接入点 (frontend) 不变.

### RBAC behaviour 验证 (待手测)

- [ ] 销售员 (sales_manager) 长按销售单 → 弹分享面板 PDF ✅
- [ ] 销售员长按采购单 → Alert "当前角色无该单据的打印权限" (403)
- [ ] 仓管 (warehouse_manager) 长按调拨单 → 弹分享面板 PDF (warehouse:read 准入)
- [ ] 仓管长按销售单 → Alert "无权限" (403)
- [ ] 仓管打开任意单据 PDF — 价格字段被 PriceMaskResolver mask 为 "—"

### 提交记录

- (待 commit)

### 风险点 / 后续

1. **后端 Day-6 MVP payload** — buildSalesOrderPayload 等仍是 query overrides 占位, 真实 entity 数据待后续 PR 把 Service.getById 接入 (PrintController.java line 225 TODO).
2. **专属模板** — transfer/wastage/return 复用模板的字段对齐可能差; customer 反馈后可加专属.
3. **expo-file-system download** — 大 PDF (>5MB) 需要测内存, 默认 streaming 是 OK.
4. **iOS UTI** — Sharing.shareAsync 加了 `UTI: 'com.adobe.pdf'`, 提高 iOS 应用识别率 (e.g. WPS/WeChat 收 PDF).

### Acceptance

- ✅ 12 stub 全部替换为真后端调用
- ✅ 0 新增 `as any`
- ✅ 0 catch (error: any)
- ✅ 错误处理友好 (403 → "无权限", 502 → "服务暂不可用", 其他 → "下载失败")
- ✅ 不动后端 PrintController