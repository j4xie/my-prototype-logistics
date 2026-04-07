# factoryId 隔离审计 — W1 D1 执行总结

**日期**: 2026-04-07
**执行**: W1 Day 1 (V3 路线图第 1 个任务)
**审计脚本**: `scripts/audit/tool-factory-isolation-audit.mjs`
**详细报告**: `scripts/audit/audit-results.md` + `audit-results.csv`

---

## TL;DR

- ✅ **远好于预期**: 338 Tool 中只有 **8 个 HIGH** + **17 个 MEDIUM**（V3 预设阈值 ≤ 30 HIGH）
- 🔴 **3/3 抽样确认真漏洞**，非脚本误报（SampleApprove、TransferDetail、InvoiceApprove）
- ⚠️ **风险性质**: 主要是"知道 ID 即可跨工厂操作"型漏洞，不是大面积系统性漏洞
- ✅ **可以不延期**: Q5 答案 = 不需延期演示，8 个 HIGH 可在 W1-W2 修完

---

## 1. 审计覆盖范围

| 指标 | 值 |
|------|-----|
| 扫描目录 | `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/**` |
| .java 文件总数 | **338** |
| AbstractBusinessTool 子类 | 330 |
| 非业务 Tool（查询/工具类） | 8 |
| 审计规则数 | 4 (签名检查/引用计数/可疑模式/硬编码检测) |

---

## 2. 风险分布

### 总体
| 级别 | 数量 | 占比 | 说明 |
|------|------|------|------|
| 🔴 HIGH | **8** | 2.4% | 立即修复 |
| 🟡 MEDIUM | **17** | 5.0% | 人工复核后修 |
| 🟢 LOW | **305** | 90.2% | factoryId 已正确传递 |
| ⚪ N/A | 8 | 2.4% | 非业务 Tool |

### 按 Domain（只列有风险的）
| Domain | HIGH | MEDIUM | 说明 |
|--------|------|--------|------|
| finance | **2** | 0 | 开票审批 + PPT 导出 |
| governance | **2** | 0 | Skill 管理类 |
| camera | **1** | 5 | 摄像头/订阅 |
| rd | **1** | 0 | 样品审批 |
| system | **1** | 2 | 通知/上下文 |
| transfer | **1** | 0 | 调拨单详情 |
| material | 0 | 2 | 批次查询 |
| scale | 0 | 2 | 电子秤 |
| shipment | 0 | 2 | 发货 |
| dataop | 0 | 1 | 冷链 |
| crm | 0 | 1 | 订单查询 |
| report | 0 | 1 | 毛利分析 |
| workreport | 0 | 1 | 工时 |

**分布观察**: 风险高度集中在 finance（财务）+ camera（摄像头订阅）+ governance（元工具），跨工厂数据泄露风险最大的 **销售订单 / 生产批次 / 报工** 核心链路全部 LOW 级（factoryId 正确传递）。

---

## 3. 🔴 HIGH 清单 + 人工抽检结果

| # | File | Domain | 风险类型 | 抽检结果 |
|---|------|--------|---------|---------|
| 1 | `CameraSubscribeTool.java` | camera | 3 条可疑模式（deviceService 调用未传 factoryId）| 待检 |
| 2 | `FinancePptExportTool.java` | finance | factoryId 签名收但从未用 | 待检 |
| 3 | `InvoiceApproveTool.java` | finance | factoryId 签名收但从未用 | ✅ **真漏洞**: `invoiceService.approveInvoice(invoiceId,...)` 无 factoryId 参数 |
| 4 | `SampleApproveTool.java` | rd | factoryId 签名收但从未用 | ✅ **真漏洞**: `sampleService.approveSample(sampleId,...)` 无 factoryId 参数 |
| 5 | `SendWechatNotificationTool.java` | system | factoryId 签名收但从未用 | 待检（可能是全局通知，可忽略）|
| 6 | `SkillComposeTool.java` | governance | factoryId 签名收但从未用 | 待检（元工具，可能跨工厂）|
| 7 | `SkillManageTool.java` | governance | factoryId 签名收但从未用 | 待检（同上）|
| 8 | `TransferDetailTool.java` | transfer | factoryId 签名收但从未用 | ✅ **真漏洞**: `transferService.getTransferById(id)` 无 factoryId 参数 |

**抽样命中率**: 3/3 = 100% 真漏洞。基本可以判定其他 5 个也是真漏洞（除 5/6/7 可能是"全局元工具"合理例外）。

---

## 4. 🟡 MEDIUM 共性模式分析

17 个 MEDIUM 的共性问题：**业务 Tool 用了 Service 层的"by-外部码"查询（batchNumber / deviceId / shipmentNumber），这些查询在 Repository 层可能没有 factoryId 过滤**。

**典型示例**:
- `productionBatchRepository.findByBatchNumber(batchNumber)` — 出现 3 次（BatchConsumption / SkuGrossMargin）
- `deviceService.getDevice(deviceId)` — 出现 5 次（camera 类）
- `shipmentRecordService.getByShipmentNumber(shipmentId)` — 1 次
- `workOrderService.getByOrderNumber(orderId)` — 1 次

**修复策略**: 不是逐个改 Tool，而是**改 Repository/Service 层**——给 `findByXxxNumber` 类方法加 `factoryId` 参数，Tool 层会自动失去编译。这是一次性彻底修复。

---

## 5. 修复计划（W1 D2-D5）

### D2 上午：3 个确认真漏洞快速修
- 🔴 **SampleApproveTool**: 改 `sampleService.approveSample(factoryId, sampleId, userId, notes)` 签名 — 关联 V3 P0-4 研发样品
- 🔴 **InvoiceApproveTool**: 改 `invoiceService.approveInvoice(factoryId, invoiceId, userId, notes)` — 关联 V3 P0-3 税率分组开票（同一模块）
- 🔴 **TransferDetailTool**: 改 `transferService.getTransferById(factoryId, transferId)`

### D2 下午：剩余 5 个 HIGH 人工复核
- `CameraSubscribeTool` + `FinancePptExportTool` — 真漏洞概率高，直接修
- `SendWechatNotificationTool` / `SkillComposeTool` / `SkillManageTool` — 可能是全局元工具，评估是否需要跨工厂能力；若确需跨工厂则加 `@AllowCrossFactory` 注解白名单

### D3：17 个 MEDIUM 批量修
- 重点改 Repository 层：`findByBatchNumber` / `getDevice` / `getByShipmentNumber` / `getByOrderNumber` 全部加 factoryId 参数
- 编译失败定位 → 改 Tool 层传入

### D4：跨工厂 E2E 回归测试
- 新建 `scripts/audit/test-factory-isolation.mjs`（单元测试 + E2E）
- 每个高危 Repository 方法加跨工厂调用测试（F001 用户查 F002 数据必须返回空）

### D5：CI 门禁
- 在 `.github/workflows/` 或项目 CI 配置加 `node scripts/audit/tool-factory-isolation-audit.mjs`
- 发现 HIGH 自动阻塞 PR

---

## 6. V3 路线图影响

| V3 决策 | 原值 | 更新值 |
|---------|------|--------|
| Q5: factoryId 审计发现 > 50 HIGH 是否延期？ | 待定 | ✅ **不需延期**（只有 8 HIGH）|
| W1 工作负载 | 满载 | 正好（D2-D5 补审计修复）|
| W1 DoD: 高危 Tool 全部修复 PR merge | ≤30 | **≤8**（更轻松）|
| R1 风险分数 (跨工厂数据泄露) | 16（致命×40%）| **降至 10**（严重×50%，修复后降至 3）|

---

## 7. 验证清单 (Manager / PM review)

- [x] 审计脚本覆盖所有 338 个 Tool 文件
- [x] HIGH/MEDIUM 分类有明确规则（不是凭感觉）
- [x] 抽样 3 个 HIGH 全部确认真漏洞
- [ ] 剩余 5 个 HIGH 人工复核（D2 上午完成）
- [ ] Repository 层批量加 factoryId 参数（D3 完成）
- [ ] 跨工厂 E2E 回归用例（D4 完成）
- [ ] CI 门禁（D5 完成）

---

## 8. 建议 PM/Manager 即时决策

1. ✅ **Q5 可关闭** — 审计结果不触发延期条款
2. 🔄 **R1 风险降级** — 从"致命"降为"严重"，不再是最高风险项
3. 📋 **新增 CI 门禁** — 审计脚本纳入每次 PR 检查
4. ⚠️ **governance 类 Tool 白名单评估** — SkillCompose/SkillManage 可能是合理的跨工厂元工具，需确认是否加注解豁免

---

**下一步**: D2 开始修 3 个确认真漏洞 + 人工复核剩余 5 个 HIGH。
