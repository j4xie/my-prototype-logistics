# Cretas 现状审计报告 (AUDIT) — 修正 REVIEW 的错误估计

> **本报告地位**：AUDIT > REVIEW > REPORT。前两份是基于"主观印象 + subagent 表面扫描"，本份是基于**file:line 级代码核实** + 3 个并行 Explore 子代理交叉验证。
>
> **诚实声明**：REVIEW 中关于 "Cretas 已有 X% 零件" 的 3 处声明在审计后被证伪/降级。详见 §B。

---

## A. 审计方法

3 个并行 Explore 子代理独立审计，每条声明必须有 file:line + 代码片段证据。审计范围：

- **A 路**：AIChat 生态（10 个声明）
- **B 路**：销售→生产→采购全链路（7 核心 Tool + Skill 编排 + 前端渲染 + QR）
- **C 路**：ISAPI 视觉报工 / Alert 推送 / Voucher 缺口

---

## B. ⚠️ 三个被证伪的关键声明 (REVIEW 错误)

### B-1. ❌ "Slot-filling NEED_CLARIFICATION 多轮对话已落地"

| | |
|---|---|
| REVIEW 原话 | "✅ 真能落地 · 🟢 高可信度 · NEED_CLARIFICATION 路径在 AIChatScreen 已有" |
| **审计真相** | **后端 `IntentExecutorServiceImpl` 中 grep `NEED_CLARIFICATION` / `NEED_MORE_INFO` / `clarificationQuestions` 全部 0 匹配** |
| 实际情况 | AIChatScreen.tsx:67 `suggestedActions` 类型定义存在，前端会处理服务器返回的 clarificationQuestions——但**服务器从未返回这些字段**。整个澄清/缺参追问链是死代码 |
| **影响** | 原 REVIEW "方案 4 多轮 slot-filling" 是 ❌ 不实，**不是 3-5 天调一下就能用**。需要：(1) 后端在 IntentExecutor 增 NEED_CLARIFICATION 分支 (2) Tool 缺参检测改抛 ClarificationException 而非 IllegalArg (3) 联调多轮上下文。**真实工时 8-12 人天** |

### B-2. ⚠️ "摄像头视觉自动报工已有 90% 零件"

| | |
|---|---|
| REVIEW 原话 | "🟡 中 · 摄像头识别 + 工人识别 + 自动报工已有 90%" |
| **审计真相** | **ISAPI 区域检测真实**（`IsapiLineDetectionConfigTool.java:88-140` 真调海康 HTTP），但**人脸识别 / 工人身份识别 / 摄像头事件→报工的事件桥都不存在**：`grep '人脸\|face.*recognition\|worker.*recognize'` 在 entity/、service/、ai/tool/ 全部 0 匹配 |
| 实际情况 | `ProcessingWorkerCheckoutTool.java:88-100` 只支持**手工** checkout (workerId 必填)。摄像头事件 listener (`AlertNotificationListener.java`) 只触发 `EquipmentAlert` / `ProductionAlert`，**不写报工** |
| **影响** | 完成度从"90%"降到"~30%"。要"演示给客户摄像头看到工人=自动报工"需要：人脸模型 + worker_id↔embedding 表 + 事件→报工 Listener + 端到端测试。**真实工时 10-15 人天 + 准确率 PoC 风险** |

### B-3. ⚠️ "TemplateCommandSheet 支持多种模板"

| | |
|---|---|
| REVIEW 原话 | "✅ 已落地，扩展模板类型即可" |
| **审计真相** | `TemplateCommandSheet.tsx:37-41` TEMPLATE_CONFIG 实际只有 **3 种**：report / inbound / inventory |
| 影响 | 扩展到"领料/出库/质检"等场景都要新写模板组件，**不是 0 工时复用**——每种约 0.5 人天 |

---

## C. ✅ 被证实的强项 (REVIEW 偏低估)

| 声明 | 审计结论 | 备注 |
|---|---|---|
| "16 个内置 Skill" | ✅ 实际 **18 个** | 比声明还多 2 个 |
| "8 个 AIChat 场景" | ✅ 精确 | PRODUCTION_PLAN/WORK_REPORT/QUALITY_CHECK/SHIPMENT/MATERIAL/PURCHASE/EQUIPMENT/ATTENDANCE |
| "VoiceMicButton 真接 STT" | ✅ 真实 | `expo-av` + `speechRecognitionService`，非 UI 桩 |
| "smartDefaults 真在用" | ✅ 真实 | AsyncStorage 读上次 product/qty/material，AIChatScreen.tsx:237-244 真调 |
| "RichContentRenderer 富渲染" | ✅ 实际 **5 种**（LIST/DETAIL/STATS/CONFIRM/PAGINATION） | + 3 个真实渲染分支 |
| "SSE 流式 + 多 callback" | ✅ 实际 **11 个** callbacks | 比声明多（声明 8 个） |
| "ToolRegistry 自动 @Component 注册" | ✅ Spring ApplicationContext 全扫 | 非手动 list |
| "Label 实体支持 QR" | ✅ 真实 | `Label.java:42-75` 含 labelType=QR_CODE / qrContent / productionBatchId 字段 |
| "ISAPI 真实接海康" | ✅ 真实 | `IsapiClient.java:250-282` 真发 PUT 请求带 XML |
| "AR/AP 流水实体" | ✅ 真实 | ArApTransaction / InvoiceRecord / PaymentRecord 完整 |

**纠偏**：Cretas 的 AI Chat 基础设施比我之前评的还**强**——多 2 个 Skill、多 3 个 callback、5 种富渲染。**核心能力已经齐**，问题在编排和案例。

---

## D. ❌ 被证实的真实缺口 (REVIEW 这些没错)

| 缺口 | 审计证据 |
|---|---|
| **会计 Voucher 凭证** | `find **/Voucher*.java` 0 结果；ArApTransaction 仅 4 种 type (AR/AP × INVOICE/PAYMENT)，**无 journal_entry / ledger_account / debit_credit 字段** |
| **试算平衡 / 期末结账** | `grep AccountingPeriod\|trial_balance\|closing_entry` 全部 0 匹配 |
| **真实推送通道** | `grep FCM\|JPush\|WebSocket\|SSE`：Alert 推送只有 SSE 注释（LLM 调用用，非告警），**前端是轮询 `dashboardAPI.getAlertsDashboard('week')`** 而非推送 |
| **chain-card 富渲染类型** | RichContentRenderer 当前 5 种里**无** chain-card / pipeline / multi-step-summary 类型 |
| **跨域 Skill 编排** | 18 个 Skill 里**没有** sales→production→purchase 跨域；最接近的 order-fulfillment 只含 shipment_create，不涉及生产/采购 |

---

## E. ⚠️ 隐藏的 stub / 半成品 (审计才发现的)

| 项 | 证据 |
|---|---|
| **BomExpansionTool productName 查找抛异常** | `BomExpansionTool.java:85` "暂不支持名称查找"——必须传 productTypeId，AI 自然语言"800 箱牛肉"无法直接喂，**需要先加 productName→productTypeId 解析 service** |
| **ProcessingBatchCreateTool 不关联 salesOrderId** | `ProcessingBatchCreateTool.java:112-171` doExecute 无 salesOrderId 参数，**不能从销售单生成生产任务**——这是"销售→生产"链最大断点 |
| **ProcessingBatchCreateTool 不自动生成 Label** | Label 实体支持 QR，但 ProcessingBatchCreateTool 不创建 Label。**"扫码报工"的核心连接没接上** |
| **缺料分析逻辑分散** | 找到 `SupplyChainOrchestrator` 事件驱动架构 + `BomExpansionService.checkMaterialAvailability()` + `InventoryMatchingService` + `ProcurementSuggestionService` — **4 处各做一部分，没有统一入口**。AI Skill 编排时要重新整合 |

---

## F. 修正后的真实工时表

### F-1. 方案 1: 销售→生产→采购全链路 Skill

| 子任务 | REVIEW 估计 | 审计真实工时 |
|---|---|---|
| 修复 BomExpansionTool productName 查找 | 0 (没意识到) | 0.5 人天 |
| 加 productName→productTypeId 解析 | 0 (没意识到) | 0.5 人天 |
| 统一缺料分析入口 (整合 4 处) | 0 (没意识到) | 1-2 人天 |
| 让 ProcessingBatchCreateTool 接 salesOrderId | 0 (没意识到) | 0.5 人天 |
| ProcessingBatchCreateTool 自动生成 Label/QR | 1 人周 | 0.5 人天 |
| 创建 SalesToProductionPurchaseSkill | 1 人周 | 1 人天 |
| 加 chain-card 类型到 RichContentRenderer | 0 (没意识到) | 0.5 人天 |
| E2E 联调 + 修边界情况 | 0 (没意识到) | 2 人天 |
| **合计** | **2 人周** (REVIEW) | **6-7 人天**（审计） |

**结论**：审计后真实工时 **比 REVIEW 估的 2 周更短**（6-7 天而非 10-15 天）——但 REVIEW 漏报了 4 个子任务，刚好抵消乐观偏差。**6-7 天是可信的最低工时**。

### F-2. 方案 2: 视觉自动报工

| | REVIEW | 审计真实 |
|---|---|---|
| 完成度 | "90%" | **~30%** |
| 工时 | "PoC 30 天" (含运行) | 开发本身 **10-15 人天**（人脸模型 + worker_id 表 + 事件桥 + 测试）+ 真实工厂运行 PoC 30 天 |
| 关键风险 | 没说 | 准确率（遮挡/光照/多人同框）+ ISAPI 摄像头型号兼容性 |
| **建议** | "P1 短期" | **降级到 P2 中期** — 不是 demo 就绪能力 |

### F-3. 方案 3: Alert 推送

| | REVIEW | 审计真实 |
|---|---|---|
| "调密度" | "3-5 天" | **3 天可调阈值** ✅ 准确 |
| 真实推送通道 | 没提 | **目前是轮询**，要真推送需 +1 周（WebSocket 或 SSE 通道） |
| 客户感知 | "用户不需要学操作" | 现状客户仍要主动打开页面下拉刷新 |

### F-4. 方案 4: Slot-filling

| | REVIEW | 审计真实 |
|---|---|---|
| 完成度 | "已有，扩展即可" | **❌ 后端逻辑根本没实现** |
| 工时 | "3 天补 slot 定义" | **8-12 人天** (后端分支 + Tool 异常类型重构 + 多轮上下文 + 联调) |
| **建议** | "立即做" | **降级到 P2** — 这是 1-2 周工程，不是收尾工作 |

### F-5. 方案 5: 智能默认值 + 模板

| | REVIEW | 审计真实 |
|---|---|---|
| smartDefaults 已有 | ✅ | ✅ 真实，准确 |
| TemplateCommandSheet 多种 | ⚠️ "扩展即可" | **仅 3 种**，每加一种 ~0.5 天 |
| **建议** | "立即做" | ✅ 保留 — 每种模板 0.5 天，扩 4 种 2 天 |

---

## G. 修正后的优先级 (替代 REVIEW §F)

### 🟢 立即做（1-2 周完成）— 都是审计已验证零件齐
1. **销售→生产→采购全链路 Skill** — **6-7 人天**（含修 4 个 stub）
2. **生产任务自动生成 QR + LabelScan 路由到 BatchReport** — **2 人天**
3. **录 demo 视频** — **0.5 人天**（用方案 1 输出录）
4. **扩 TemplateCommandSheet 增 4 种模板**（领料/出库/质检/排产）— **2 人天**

### 🟡 短期（1 月）— 需要新写代码
5. **统一缺料分析视图**（独立页面，复用方案 1 的 service）— **3 人天**
6. **领料单按 BOM 自动展开**（依赖方案 1 已修复的 BomExpansion）— **3 人天**
7. **Alert 推送密度调阈值** — **3 人天**

### 🟠 中期（2-3 月）— 真正的新工程
8. **Slot-filling 多轮对话**（**审计才发现是新工程，不是收尾**）— **8-12 人天**
9. **真实推送通道**（WebSocket 或 SSE）— **5-7 人天**
10. **报价单实体 + 模块** — **5-8 人天**

### 🔴 长期 / 高风险
11. **视觉自动报工**（先 PoC 1 条产线 30 天，再决定）— **10-15 人天开发 + 30 天试点**
12. **会计 Voucher 凭证体系**（仅当目标客户群明确要求税务凭证）— **15-20 人天**

### ❌ 反对 (不变)
- 可视化工作流拖拽编辑器 (PR-driven)
- 12 模块菜单倒车
- 工作手机微信集成 (合规风险)

---

## H. 销售层面的修正

REVIEW 说："4 个方案可立刻在 demo 视频里展示，1 个标 PoC 阶段"。

**审计后修正**：
- **可立刻展示**：方案 1 (修完 stub 后)、方案 3 调密度、方案 5 模板 = **3 个**
- **标 PoC**：方案 2 视觉报工 = 1 个
- **不能展示**：方案 4 slot-filling（后端没实现，演示会翻车）

**给销售的话术调整**：
- ❌ 不要说 "AI 会问你缺什么参数" — 实际不会问
- ❌ 不要说 "摄像头自动报工" — 还没准确率数据
- ✅ 可以说 "一句话完成销售下单 → 自动算缺料 → 自动生成采购建议" — 这个修完 stub 后能跑
- ✅ 可以说 "异常会提醒你"，但客户实际仍需要主动刷新

---

## I. 我作为 AI 助手的元层错误总结

REVIEW 报告的 3 大错误：

1. **过度信任 subagent 表面扫描**：第一个 Explore agent 看到 "ApprovalChainConfig + Drools 存在" 就报 "审批工作流 60%"，没核查实际接入了哪些场景。AUDIT 才发现只有 ProductionPlan 一个场景接入。
2. **把"实体存在"等同于"功能可用"**：Label 实体有 QR 字段 ≠ 生产任务能生成 QR。ArApTransaction 存在 ≠ 凭证体系完整。
3. **没识别 stub / 抛异常**：BomExpansionTool productName 查找直接抛 "暂不支持"——这种半成品在 PR-driven 评估中最容易被漏掉。

→ **教训**：声明"已有 X%"时，必须区分 (a) 实体/接口存在 (b) 主路径实现 (c) 边界情况处理 (d) 跨模块集成。这 4 层缺任何一层都不能算"可用"。

---

## J. 产出文件

- **AUDIT.md** ← 本报告，**最终参考**
- REVIEW.md ← 已被本报告修正，仅作历史
- REPORT.md ← 演示总结，可作素材
- storyboard_v2.md / keyframes_v2/ ← 137 帧视频证据
- 3 个并行 Explore 审计原始结论 ← 在 conversation history

下一步建议：
1. 团队拿 §G 的优先级排 sprint
2. 立即修 §E 表中的 4 个 stub（销售→生产链路是修这 4 个 stub 的连带产物）
3. demo 视频用方案 1 + 2 + 5 录，避开方案 4
