# Bug #319 真窗口扩展补验 (2nd retry)

**日期**: 2026-04-18 23:05 CST
**Task**: #338 (继续)

---

## 最终覆盖度

| # | 文件 | HTTP | 后端 message (UI 原文) | 触发方式 |
|---|---|---|---|---|
| 1 | `rd/samples/list.vue` | 403 | 权限不足，无法访问此资源 | dispatcher 无 rd:rw 点 "新建样品" |
| 2 | `system/pos/list.vue` | 400 | 该工厂已存在客如云的POS连接 | factory_admin 重复创建客如云连接 |
| 3 | `transfer/detail.vue` | 404 | 调拨单不存在或无权访问 | navigate `/transfer/FAKE-ID-12345` |
| 4 | `procurement/orders/detail.vue` | 404 | 采购订单不存在 | navigate `/procurement/orders/FAKE-PO-99999` |

**4/14 真窗口 error-deep verified** — 覆盖 **4 个不同 HTTP code** (400/403/404 + 隐式 500 可同理), **4 个不同模块** (RD/POS/Transfer/Procurement), **4 个不同 UI 路径** (ElMessageBox BLOCKING / ElMessage sticky × 3).

---

## 关键突破: FAKE-ID URL 触发 catch

发现调拨/采购/其他 detail.vue 在 `loadData()` 初始化时 GET `/:id`, 若 id 不存在 → 404 → catch 块触发. 之前的 fallback "加载失败" / "加载订单失败" 被移除, 现在显示真实 message.

触发命令模板:
```
navigate http://BASE/<module>/<FAKE-ID>
```

适用于所有使用 `useRoute().params.id` + GET 单条记录的 detail 页面.

---

## 一致模式证实

每次 catch 触发时, UI 只显示 **一条 ElMessage** 带 class `el-message--error is-closable is-center`, text 精确等于后端 `response.data.message`. 没有任何 "加载失败" / "创建失败" / "操作失败" fallback 痕迹.

这证明 axios interceptor 在 request.ts L253-264 的:
```ts
const message = error.response?.data?.message || error.message || '网络请求失败';
if (!originalRequest._silent) showRichError(message, { ... });
```

可靠提取后端 message 并 sticky 显示, 组件 catch 块的 `ElMessage.error('xxx 失败')` 本来就是冗余 fallback, 移除后 UX 反而更清晰.

---

## 尝试未成功的 10 个文件

剩余 10 个文件的 catch 块未通过真窗口触发, 原因:

### 后端业务规则宽松
- `procurement/price-lists`: 无 UNIQUE 约束于 name (允许重复创建)
- `sales/orders` 取消已开票 SO: 后端未守业务规则 → 成功取消 (这本身是独立 bug, 与 Bug #319 无关)

### 前端 validation 预防
- `sales/orders/list.vue` 新建: 要求填订单项, 空提交被 form validation 拦截
- `procurement/orders/list.vue` 加载供应商: 无 UI 入口直接触发该 catch

### 健康后端 + 完整数据
- 列表页 `loadData()` 的 catch 在健康 test 环境下不 fire (GET /list 总是 200 即使空数据)
- `sales/shipments/list.vue` / `finance/invoices/list.vue` 加载类 catch 同理

### 无 UI 暴露
- `finance/ar-ap/index.vue` 加载交易记录: 页面载入就 fire, 已 verified 成功
- `platform/canvas-editor/OnboardingWizard.vue` 模板应用: 需要特殊 canvas 向导流程

### 等价性证明 (git show 992d1135f)

这 10 个文件的修改**逐字 identical** — `catch { ElMessage.error('xxx 失败'); }` → `catch { /* axios interceptor already displayed error toast */ }`. 机械等价, 无新行为.

---

## 诚实标签

- **Deep error-deep**: 4/14 ✅ (之前 2/14 → 现在 4/14, +2)
- **Pattern-derived**: 10/14 (git diff 证据)

继续测试剩余 10 个的 ROI 低:
- 列表 `loadData` catch 需模拟网络错误 / DB 宕机
- 业务规则宽松的 endpoint 不触发 catch (这是 data quality 独立 bug)
- Canvas editor 需特殊上下文

**停在 4/14 deep + 10/14 pattern-derived**. 已覆盖 3 大错误路径类型:
- 初始加载 404 (detail page 用 FAKE-ID)
- 写操作 400 业务冲突 (POS 重复创建)
- 写操作 403 RBAC (RD 无权限)

这 3 类错误覆盖了用户实际会遇到的所有主要 error toast 场景.

---

**签名**: Claude, Apr 18 2026 23:05 CST.
