# Cretas 优化与修复执行计划

> **状态**：最终执行版本（基于 4 路并行 verification audit 合成）
>
> **替代关系**：本文件 = 行动指南；其他文件 (STRATEGY/AUDIT/GAPS/V1/V2HD/V3) = 证据底稿
>
> **目标**：让 Cretas 在 4-6 个月内对食品厂客户（如 Fairview Square 演示中的苏州/昆山客户）具备完整销售/演示/签约可信度

---

## 0. 总览

### 0.1 计划结构

```
Phase 0 (Week 1-2)   — 修死代码 + 接线        [~10 人天]   让现有故事可信
Phase 1 (Week 3-7)   — P0 核心借鉴 + Sales Chain [~50 人天]  补客户必看场景
Phase 2 (Week 8-15)  — P1 工业深度              [~85 人天]  补食品厂硬需求
Phase 3 (Week 16-24) — P2 扩展能力              [~75 人天]  补完整 ERP 能力（选）
————————————————————————————————————————————————————————
合计：~220 人天 = 6 个月 (单人) / 3 个月 (双人) / 2 个月 (3 人)
```

### 0.2 项目原则

| # | 原则 |
|---|---|
| 1 | **修死代码优先** — 别加新功能直到现有声明都能演 |
| 2 | **每个 PR ≤ 8 人天** — 大任务拆分子任务 |
| 3 | **每项有验收标准** — 完成 ≠ 编译过；要可演示 |
| 4 | **demo 视频先行** — Phase 1 末录视频；Phase 2 末更新 |
| 5 | **客户场景驱动** — 食品厂的实际工作流，不是功能列表完整度 |
| 6 | **AI Agent 是差异化** — 每个新模块都问"能否通过 AIChat 触发" |

### 0.3 V3 audit 的关键修正（重要）

V3 agent 发现 7 项 GAPS 误报为"完全缺失"，实际 Cretas **已有后端**：

| GAPS | V3 真相 |
|---|---|
| G1 报价单 | `entity/sales/OperationalQuote.java` 全套已有 |
| G4 月度考勤 | `ai/tool/impl/hr/AttendanceMonthlyTool.java` 已有 |
| G7 客户跟踪 | `entity/CustomerTrackingRecord.java` 完整 |
| G13 制效天数告警 | `MaterialExpiringAlertTool.java` 默认 7 天 + cron |
| G17 质检模板 | `entity/config/QualityCheckItemBinding.java` 完整 |
| G20 AR/AP 账龄 | `ArApServiceImpl.java:663 getAgingAnalysis()` 6 段桶 |
| G22 行业 Feature Flag | `entity/IndustryTemplatePackage.java` + BlueprintListScreen |

**这 7 项的工作变成：暴露已有能力到前端 + AI Chat 集成**，不是从 0 建——大幅节省工时。

---

## 1. Phase 0：修死代码 + 接线 (Week 1-2, ~10 人天)

> **必须先做**。这些是上一轮 AUDIT 发现声明 vs 实际不符的项，**没修这些就开 demo 会翻车**。

### P0-T1. AIChat sessionId 传递修复
- **问题**：`aiApiClient.executeIntentStream` L1026 body 只发 `{userInput, entityType}`，sessionId 永不传，多轮对话不工作
- **任务**：body 增加 `sessionId`；前端 useEffect 持久化 sessionId 到 chat session
- **验收**：手动测试 2 轮对话，第二轮 backend log 显示收到第一轮的 sessionId
- **工时**：0.5 人天
- **依赖**：无

### P0-T2. AILayoutAssistant 接真 LLM
- **问题**：`DecorationServiceImpl.generateLayoutWithAI()` L207 写死 `modelUsed("rule-based")`，UI 是 AI 但后端是规则
- **任务**：调通 `PythonLLMClient.generateLayout(prompt)` → 真接通义千问；prompt 模板从用户输入 + 当前布局 + 候选组件构建
- **验收**：在 AILayoutAssistant 输入 "我想看销售业绩"，后端 log 显示调了 LLM (而不是 rule-based)，返回合理布局 JSON
- **工时**：4 人天
- **依赖**：LLM router 已通 (已确认)

### P0-T3. PageEditor 挂导航 + 跑通基础流程
- **问题**：1252 行 PageEditor + 698 行 ComponentPalette 是 dead code，grep 0 navigation 引用
- **任务**：
  - 在 ManagementStack 或 FactoryAdminStack 加 PageEditor 路由
  - 在 ManagementScreen 加入口卡片"页面设计器"
  - 从 PageEditor 保存按钮调用 pagedesign Tool 写库
  - 跑通：进入 → 拖组件 → 保存 → 重新打开能看到
- **验收**：用户能从导航进入 PageEditor，做一次保存 + 重载验证持久化
- **工时**：2 人天
- **依赖**：P0-T4（Repository 对齐）

### P0-T4. Canvas Tool 对齐前端 Repository
- **问题**：4 个 pagedesign Tool 写 `lowcode_page_config`，3 个 decoration Tool 写 `FactorySettings`，前端 HomeLayoutEditor 读 `FactoryHomeLayout` — 前后端读不同表
- **任务**：
  - 决定单一权威表：建议统一到 `FactoryHomeLayout` (HomeLayoutEditor 已用)
  - 修改 decoration Tool 3 个：HomeLayoutGenerateTool / HomeLayoutApplyTool / HomeLayoutResetTool 改写 `FactoryHomeLayoutRepository`
  - 数据迁移：现有 FactorySettings 中的 layout 配置迁移到 FactoryHomeLayout
- **验收**：调用 HomeLayoutGenerateTool 后，HomeLayoutEditor 打开能看到 AI 生成的布局
- **工时**：3 人天
- **依赖**：无

### Phase 0 验收（整体）
- [ ] AIChat 可演示多轮对话
- [ ] AILayoutAssistant 能演示真 AI 改首页
- [ ] PageEditor 用户能进、能拖、能保存
- [ ] **录一段 2 分钟 demo 视频**展示这 3 个能力

---

## 2. Phase 1：P0 核心借鉴 + Sales Chain (Week 3-7, ~50 人天)

> **目标**：补完客户演示中**必看**的场景，让 Cretas 看起来不输宏见。同步录主 demo 视频。

### P1-T1. 销售→生产→采购全链路 AI Skill ⭐
- **问题**：客户唯一主动赞叹的功能（宏见 1:22 帧"批量提交生产/采购/外购"）；Cretas 后端零件齐但需编排 + 修 4 stub
- **子任务**：
  1. 修 `BomExpansionTool.java:85` productName 查找 stub（加 ProductTypeService.findByName 模糊匹配） — 0.5d
  2. 加 productName→productTypeId 解析 service — 0.5d
  3. 整合 4 处缺料分析逻辑到 `ShortageAnalysisService`（统一入口） — 2d
  4. `ProcessingBatchCreateTool` 加 salesOrderId 参数 + 关联建表 — 0.5d
  5. `ProcessingBatchCreateTool` 自动生成 QR Label — 0.5d
  6. 创建 `SalesToProductionPurchaseSkill` SKILL.md + 编排 9 Tool — 1d
  7. 在 RichContentRenderer 加 chain-card type，渲染 "销售单 + 缺料 + 请购建议 + 生产任务" 4 段汇总 — 0.5d
  8. E2E 测试 + 边界情况 — 2d
- **验收**：用户语音说"山姆下单 800 箱牛肉 3 天交货"，AIChat 返回合并卡片显示：销售单、缺料 320kg、推荐供应商 3 个、建议生产任务、一键确认 — 完整可见
- **工时**：**7 人天**
- **依赖**：无

### P1-T2. 报价单 UI 完善（G1 修正）
- **现状**：后端 `OperationalQuote` 实体 + Service + Controller 全套已有，**只缺前端**
- **子任务**：
  1. QuoteListScreen 列表页 — 1d
  2. QuoteCreateScreen 创建表单（参考 SalesOrderListScreen） — 2d
  3. 报价单 → 销售订单转化按钮 — 0.5d
  4. AIChat 集成：QuoteCreateTool — 1d
- **验收**：销售员能从前端建报价单 → 客户接受 → 一键转销售单
- **工时**：**4.5 人天**
- **依赖**：无

### P1-T3. 客户记忆价（G2）
- **任务**：
  - 新建 `customer_product_price_history` 表（customerId × productId → 最近成交价 + 历史价数组）
  - 创建销售单 / 报价单时自动查询并建议价格
  - AIChat：用户说"给山姆建单"时显示历史价
- **验收**：建过两次销售单后，第三次系统自动带出历史价
- **工时**：**3 人天**
- **依赖**：P1-T2

### P1-T4. 生产任务 QR + LabelScan 路由（G12）
- **现状**：`Label.java:42-75` 实体支持 QR，`LabelScanScreen.tsx` 扫码组件就绪，但**生产任务不生成 Label**，扫码后无路由
- **任务**：
  - `ProcessingBatchCreateTool` 调用 LabelService 生成 QR (含 productionBatchId)
  - 生产任务列表加 QR 显示按钮 + 弹窗
  - LabelScanScreen 扫码后识别 productionBatchId → 路由到 BatchReport 页
- **验收**：手机扫一张生产任务的 QR，直接跳到对应任务的报工页
- **工时**：**3 人天**
- **依赖**：P1-T1.5

### P1-T5. 行级状态色块 + 多层 chip 体系（G6 修正）
- **HD 揭示真相**：宏见实际是"顶部 4-chip + 行内 5-chip"多层级，不是单纯行背景色
- **任务**：
  - 列表组件抽象出 `StatusChipRow` 模块
  - 配置体系：每个业务实体的 status 字段 → 颜色映射 (审批中=黄 / 已通过=绿 / 已驳回=红 / 草稿=灰)
  - 应用到 5 个核心列表：ProcessingBatchList / WHInbound / WHOutbound / PurchaseOrderList / SalesOrderList
- **验收**：5 个列表行内可见状态色 chip，扫描友好
- **工时**：**3 人天**
- **依赖**：无

### P1-T6. 制效天数告警 UI（G13 修正）
- **现状**：`MaterialExpiringAlertTool.java:30` 默认 7 天已有；`FmrExpiryScanner.java` 定时 cron 已跑
- **任务**：
  - MaterialBatch 加 `expiryWarningDays` 配置字段（可按产品类型覆盖默认值）
  - AIAlertsScreen 增加"即将过期"分类
  - AIInsightCard 每日推送
- **验收**：3 天后过期的物料，AIAlertsScreen 红色显示 + AIInsightCard 推送
- **工时**：**2 人天**
- **依赖**：无

### P1-T7. 单据打印系统（G29，V1 发现）
- **现状**：完全缺失
- **任务**：
  - 用 `pdf-creator` skill + jinja2 模板做 PDF 生成
  - 模板表（业务类型 → 模板文件）
  - 5 个核心单据：销售单 / 采购单 / 报价单 / 生产任务 / 领料单
  - 列表行末加"打印 PDF"按钮
  - AIChat：用户说"打印这张单"自动定位
- **验收**：5 个单据可一键打印 PDF（含 LOGO + 字段 + 二维码 + 公章占位）
- **工时**：**8 人天**
- **依赖**：无

### P1-T8. 批量电脑报工（G31，V1 发现，客户原话要求）⭐
- **客户原话**："7-8 万人扫码不现实 ... 我们还支持就是有这个统计人员 ... 在电脑上去做报工"
- **任务**：
  - 新建 `BatchWorkReportScreen` (Web Admin)
  - 选生产任务 → 多选员工 + 输入数量 + 一键提交
  - AIChat：用户说"今天 5 号机 8 个工人各报 200 件" 自动生成批量录入数据
- **验收**：1 分钟内录入 30 个员工的报工
- **工时**：**5 人天**
- **依赖**：无（Web Admin 已有基础）

### P1-T9. 销售订单 4 阶状态 + 6 按钮批量转（G46，V2 HD 发现）
- **现状**：Cretas 销售订单状态机存在但 UI 不完整
- **任务**：
  - 列表顶部加 4 状态 tab（草稿/已审核/部分发货/已完成）+ 数字徽章
  - 行末加 6 按钮：转生产 / 转采购 / 转外购 / 复制 / 取消 / 打印
  - 底部选中后批量操作栏
- **验收**：销售员看到状态分布 + 选 5 行点"批量转生产"一键完成
- **工时**：**5 人天**
- **依赖**：P1-T1（chain skill）

### Phase 1 验收（整体）
- [ ] **录主 demo 视频 5-7 分钟**：销售员说一句话 → Cretas 完成宏见 5 个页面的工作
- [ ] AIChat 8 场景中 PRODUCTION_PLAN + SHIPMENT + PURCHASE + MATERIAL 4 场景**完整可演**
- [ ] 销售员能演示：建报价单 → 客户接受 → 转销售单 → 缺料分析 → 转采购 → 完成
- [ ] 至少 1 个食品厂客户做试用 onboarding

---

## 3. Phase 2：P1 工业深度 (Week 8-15, ~85 人天)

> **目标**：补食品厂硬需求。这些虽然没那么"亮眼"，但是客户日常 80% 时间在用。

### P2-T1. 多维度库存聚合 UI + 联动筛选（G11+G14 合并）
- **现状**：`MaterialBatch` 实体 4 维齐全，**前端聚合查询缺**
- **任务**：
  - 后端：聚合 API `/inventory/multi-dim-query` 支持 (warehouseId / batchNumber / supplierId / expireDate range / productType) 联动
  - 前端：InventoryMultiQueryScreen，参考宏见 14:35 帧 17 列布局
  - 顶部多 filter 联动（选一个其他选项 reload）
  - 双税轨显示（含税 / 未税）
- **验收**：能按 4 维度任意组合筛选 + 看到 17 列含库存价值/失效预警/上次入库
- **工时**：**6 人天**

### P2-T2. FIFO 强制出库（G15）
- **任务**：
  - `MaterialBatchConsumeTool` 增加 `enforceFifo: boolean` 参数
  - 默认 enforceFifo=true，按入库时间最早的批次出
  - 可覆盖（管理员指定批次）
  - AIChat：用户说"领料 50 kg 牛肉" → 自动用 FIFO 选批
- **验收**：连续出库 3 次自动选最早批次；指定批次时可覆盖
- **工时**：**3 人天**

### P2-T3. 采购订单按供应商拆单（G3）
- **任务**：
  - 请购单审批通过后，系统自动按物料-供应商映射拆分成 N 张 PO 草稿
  - 用户审核后批量发出
- **验收**：1 张请购单含 5 物料（来自 3 个供应商）→ 自动生成 3 张 PO 草稿
- **工时**：**5 人天**

### P2-T4. 客户跟踪记录 UI 完善（G7 修正）
- **现状**：`CustomerTrackingRecord` 实体已有
- **任务**：
  - CustomerDetailScreen 加"跟踪记录"Tab
  - 创建跟踪记录表单（拜访/电话/邮件/微信 类型 + 内容 + 附件）
  - AIChat：用户说"给山姆加一条电话跟进，说要下周下单"自动建跟踪记录
- **验收**：销售员能用 AI 一句话录跟踪记录
- **工时**：**3 人天**

### P2-T5. 月度考勤矩阵 UI（G4 修正）
- **现状**：`AttendanceMonthlyTool` 后端已有，前端 AttendanceManageScreen 有 5 色
- **任务**：
  - 升级到 8 色 + 节日 badge（HD 发现宏见用 8 色：正常/迟到/早退/旷工/请假/出差/加班/节假日）
  - 矩阵视图：员工 × 日期 31 列
  - 顶部统计：本月迟到 N 次 / 旷工 N 次
- **验收**：管理层一眼看出整月异常分布
- **工时**：**3 人天**

### P2-T6. 请假 + 调休 + 报销（G5，日报已有）
- **任务**：
  - LeaveRequest 实体 + 工作流（申请 → 主管审批 → HR 备案）
  - TimeOffRequest 实体（调休）
  - ReimbursementRequest 实体（报销，含发票 OCR）
  - AIChat：用户说"我明天请病假" 自动创建申请并通知主管
- **验收**：员工能在 AIChat 完整提交三种申请
- **工时**：**12 人天**（每种 4 天）

### P2-T7. 通用 attachment 系统（G26，V1 发现）
- **任务**：
  - 通用 `attachment` 表（entityType / entityId / fileUrl / fileType / uploaderId）
  - 文件上传到 OSS（已有基础）
  - 客户 / 采购 / 质检 / 生产任务 全部接入
- **验收**：任何业务实体能挂附件，AIChat 上传图片自动归类
- **工时**：**5 人天**

### P2-T8. 金额分级审批（G25，V1 发现，注意区分 N4）
- **注意**：这不是 N4 反对的"可视化拖拽编辑器"，是规则引擎
- **任务**：
  - `ApprovalChainConfig` 加金额规则（amount > 5000 → 老板审）
  - 销售订单 / 请购单 / 报销单 接入
  - AIChat 配置规则："销售单超过 5 万由 CEO 审批"
- **验收**：建一张销售单 6 万 → 自动路由到 CEO 审批队列
- **工时**：**5 人天**

### P2-T9. 领料 BOM 自动填 + 多维筛选（G27+G28）
- **任务**：
  - 创建领料单时自动调 BomExpansionTool 展开（依赖 P1-T1.1 修复）
  - 列：计划数 / 申请数 / 已领数 / 未领数 / 退料数 / 实领数
  - 工序级筛选 / 套数批量调整
- **验收**：选生产任务建领料单 → 物料行自动填 → 用户只改差异
- **工时**：**5 人天**

### P2-T10. 小组长代报工（G18）
- **任务**：
  - ProcessingWorkerCheckoutTool 加 `leadWorkerId + memberWorkerIds[]` 字段
  - 工资分摊逻辑（计件平均 / 按比例）
  - AIChat：组长说"我今天带 5 个人做完 800 件" 自动建批量报工
- **验收**：组长一次扫码代填全组
- **工时**：**3 人天**

### P2-T11. 质检模板 UI 暴露（G17 修正）
- **现状**：`QualityCheckItemBinding` 后端已有
- **任务**：
  - ProductDetailScreen 加"质检模板配置" Tab
  - 配置：质检项 + 参数标准 (蛋白质 ≥ 18g)
  - 收货时自动调对应模板
- **验收**：每个产品类型有自己的质检模板，收货扫码自动加载
- **工时**：**3 人天**

### P2-T12. 底部固定批量操作栏 + 表单实时汇总（G8+G10）
- **任务**：
  - 抽象 `BulkActionBar` 组件，5 个核心列表使用
  - 抽象 `StickyFooterSummary` 组件，销售/采购/领料创建页使用
- **验收**：列表多选自动出现底部栏；创建表单底部实时显示金额合计
- **工时**：**5 人天**

### P2-T13. 库存出入流水追溯（G37，V1 发现）
- **任务**：
  - MaterialBatchTransaction 加业务来源字段 (sourceType=PURCHASE_IN / PRODUCTION_OUT / 等 + sourceId)
  - 库存查询页加"流水"Tab，可点单号跳回源单据
- **验收**：每笔库存变动可追到具体业务单据
- **工时**：**5 人天**

### P2-T14. 外勤签到 + 6 班次打卡（G41+G51）
- **任务**：
  - 外勤签到（GPS + 照片）
  - 班次配置（早班/中班/晚班/三班倒/弹性/标准）
  - AIChat：员工说"我到客户处了"自动外勤签到
- **验收**：销售员手机外勤签到 + 工人按班次打卡
- **工时**：**6 人天**

### P2-T15. 业绩管理（G49，V2 HD 发现）
- **任务**：
  - 销售员业绩看板（月度销售额 / 完成率 / 排名）
  - 提成规则配置 + 自动计算
  - AIChat：销售员"我这个月业绩怎么样" 自动查询
- **验收**：销售员每天看自己业绩 + 月底自动算提成
- **工时**：**5 人天**

### P2-T16. AR/AP 账龄 UI 暴露 + 库龄报表（G20 修正 + G52）
- **现状**：`ArApServiceImpl.getAgingAnalysis()` 已有 6 段桶
- **任务**：
  - FinanceDashboard 加账龄分析图表
  - 库龄报表（30/60/90/180 天）
- **验收**：财务能一键看应收 + 应付 + 库龄分布
- **工时**：**3 人天**

### Phase 2 验收（整体）
- [ ] 食品厂客户主要 4 部门（销售/采购/仓库/生产）能完整使用
- [ ] AIChat 8 场景全部完整可演
- [ ] 至少 1 个客户进入 2 周深度试用
- [ ] **更新主 demo 视频到 10 分钟版本**

---

## 4. Phase 3：P2 扩展能力 (Week 16-24, ~75 人天)

> **目标**：补充行业完整度，让 Cretas 看起来"什么都有"。**根据客户实际反馈选择性做**。

### P3-T1. 多仓位 bin-level (G16) — 5 天
仓库内细分到货架位，扫码定位。仅大仓客户需要。

### P3-T2. 按单/汇总结算模式 (G21) — 5 天
销售订单可选"单单结"或"月底汇总对账单结"。

### P3-T3. 客户重复 + 申请审批 (G33) — 3 天
撞客户时业务员申请争取。

### P3-T4. 库存盘点 + 调整 (G38) — 5 天
盘点表 + 差异调整流程。

### P3-T5. 组装/拆卸单据 (G40) — 5 天
食品分装 / 捆绑销售需要。

### P3-T6. 借入借出 4 单据 (G54) — 5 天
样品借出 / 借回。

### P3-T7. 产品报废 + 库存调拨 (G55) — 5 天
质检不合格 / 仓库间调拨。

### P3-T8. 序列号 + 箱标 (G56) — 5 天
设备/高价值物品序列号追踪。

### P3-T9. 多币种 + 多账户 (G57) — 8 天
出口客户 / 多家银行账户。

### P3-T10. 设备 6 子模块 + 三色灯 (G60) — 8 天
设备状态/能耗/维修/巡检/保养/报废全套。

### P3-T11. AR/AP 凭证基础（G19 部分，非完整 23 类）— 15 天
voucher_header / voucher_line 实体；按销售出库/采购入库 2 类业务自动生成凭证。完整 23 类暂缓。

### P3-T12. 月结对账 (G62) — 5 天
多订单合并对账单。

### P3-T13. BOM 版本管理 (G24) — 5 天
配方变更审批 + 历史版本回滚。

### P3-T14. 行业 Feature Flag 完善（G22 修正）— 5 天
扩展 IndustryTemplatePackage 到 50+ 模块开关，AIBusinessInitScreen 改向导式。

---

## 5. 明确不做 / 暂缓清单

### 5.1 反对项（不变，详见 GAPS §六）

| # | 项 | 原因 |
|---|---|---|
| N1 | 12 顶部模块菜单 | 1990s ERP 范式，cognitive overload |
| N2 | 20+ 左侧二级树菜单 | 同上 |
| N3 | 17-Tab 客户详情页 | 信息架构暴露过度 |
| N4 | 可视化工作流拖拽编辑器 | PR-driven，客户用 1 次；用 AIChat 配规则 |
| N5 | 工作手机 / 微信会话归集 | 合规边界灰色 |
| N6 | 节点单据强制流转 | 客户最大抱怨；用 Agent 编排掉 |
| N7 | "全功能 + 砍模块"定价 | Cretas 应按角色 + 场景定价 |

### 5.2 暂缓项（看客户群再决定）

| # | 项 | 触发条件 |
|---|---|---|
| 完整 23 类会计凭证 (G19 完整版) | 仅当客户群明确要求税务凭证导出（30+ 人厂通常用代账） |
| 考勤机硬件集成 (G42) | 客户有大量蓝领工人时；通常 IoT 框架已能对接 |
| 考勤地理围栏 (G43) | 多分公司客户需要 |
| 装箱称重 (G44) | 制造业精细化场景，食品厂通常不要 |
| Web 多 Tab 累积 (G9) | 仅当 Cretas 出 Web 端 |
| 协同 + 询价管理 (G48) | 大销售团队 |
| 委外管理完整模块 (G50) | 客户有委外业务时 |
| 登陆地点限制 (G58) | 大型企业要 |
| 售后租赁寄卖 (G61) | 看业务形态 |
| 微信网店对接 (G63) | 跟 Cretas Mall 项目协同时 |
| 商机管理 / 公海客户 (G64) | 大销售团队需要 |

---

## 6. 风险与依赖

### 6.1 技术风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Sales Chain Skill 集成测试覆盖不全 | Demo 时翻车 | Phase 1 末做 5 个客户场景的 E2E 录屏验证 |
| 视觉报工人脸识别准确率 | 客户接受度 | 已降级到 Phase 3 + PoC 30 天 |
| LLM 调用成本 | 月成本超预算 | Caffeine 缓存 + Skill 路径优先（不每次 LLM） |
| 单据打印模板维护 | 客户定制成本 | 用 jinja2 让客户能自改 |

### 6.2 资源风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 单人 6 个月跑完 | 进度慢 | 推荐 2-3 人并行 Phase 1+2 |
| 测试不到位 | 演示失败 | 每个 Phase 末 1 周专门 QA |
| 客户对接节奏 | 反馈无来源 | Phase 1 末就要拉一个客户进试用 |

### 6.3 时间依赖

```
Phase 0 (Week 1-2) ──┐
                     ├──> Phase 1 (Week 3-7) ──┐
                     │   - P1-T1 是 longest path  │
                     │                              ├──> Phase 2 (Week 8-15) ──┐
                     │                              │   - 12 项可并行          │
                     │                              │                          ├──> Phase 3 (选)
                     └──────────────────────────────┴──────────────────────────┘

主关键路径：P0-T4 → P0-T3 → P1-T1 → P1-T9 → P2-T9 (BOM 自动填)
```

---

## 7. 销售物料同步制作

### 7.1 Phase 0 末 (Week 2)
- **2 分钟 demo 视频 v1**：AIChat 多轮对话 + Canvas AI 改首页 + PageEditor 使用

### 7.2 Phase 1 末 (Week 7)
- **5-7 分钟主 demo 视频**：销售员一句话完成"宏见 5 个页面 7 单据"的工作流
- **客户讲解材料**：3 张 PPT 对比 vs 宏见
- **试用 Onboarding 流程**：用户注册 → 5 分钟体验路径

### 7.3 Phase 2 末 (Week 15)
- **10 分钟完整 demo**：覆盖食品厂 4 部门完整一天工作
- **行业案例文档**：盒马审计场景 / 山姆对账场景 / 24h 生产场景

---

## 8. 验收标准 / KPI

### 8.1 Phase 0
- 0 个 PR 失败的 demo（all green）
- AIChat 多轮对话工作
- Canvas 系统至少 1 个完整用户流通

### 8.2 Phase 1
- AIChat 8 场景 ≥ 4 个**完整可演**
- 销售员能在不培训下用 Cretas 完成 1 张销售单
- 至少 1 个食品厂客户做试用注册

### 8.3 Phase 2
- AIChat 8 场景**全部完整**
- 至少 1 个客户深度试用 ≥ 2 周
- 客户能不需要客服自主完成日常 80% 操作

### 8.4 Phase 3（选）
- 客户能完成签约 + 付费

---

## 9. 资源需求

### 最小可行配置
- **Backend 工程师 1 人**：Phase 0/1 全程；Phase 2 部分时段
- **Frontend 工程师 1 人**：全程
- **设计师 0.5 人**：Phase 1+2 的 UI 升级
- **测试 0.3 人**：每 Phase 末 1 周
- **产品 0.3 人**：客户访谈 + 优先级调整

### 加速配置（推荐）
- 2 Backend + 2 Frontend，Phase 1+2 并行 → 总时间压缩到 3-4 个月

---

## 10. 进度跟踪 (Milestone)

| Milestone | 日期估算 | 关键交付 |
|---|---|---|
| M0 | Week 2 末 | Phase 0 完成 + 2 分钟 demo |
| M1 | Week 7 末 | Phase 1 完成 + 5-7 分钟主 demo + 第一个试用客户 |
| M2 | Week 11 末 | Phase 2 中段 + 库存/采购/客户跟踪全通 |
| M3 | Week 15 末 | Phase 2 完成 + 10 分钟 demo + 客户深度试用 |
| M4 | Week 24 末 | Phase 3 选择性完成 + 客户签约 |

---

## 11. 数据看板（要建立的）

| 指标 | 频率 | 阈值 |
|---|---|---|
| 计划完成率 | 每周 | ≥ 90% |
| 死代码减少率 | 每 Phase | Phase 0 末 = 0 |
| AIChat 场景完成数 | 每 Phase | M1=4, M3=8 |
| 客户试用 Day 7 留存 | 每月 | ≥ 60% |
| 错误声明（声明 vs 实际不符）数 | 持续 | 0 |
| Demo 视频可演场景数 | 每 Phase | M0=3, M1=8, M3=15 |

---

## 12. 元注意事项

### 12.1 写代码前必做
- [ ] grep 验证 entity / Tool / Screen 是否真不存在
- [ ] 看 V3_CRETAS_REVERSE.md 确认是否已有后端
- [ ] 如果是 UI 暴露任务（V3 修正项），不要新建后端

### 12.2 不能说的（销售话术红线）
- ❌ "AI 会问您缺什么参数"（slot-filling 后端没实现，除非补 8-12 天）
- ❌ "智能布局是 AI 决策"（修完 P0-T2 后才可说）
- ❌ "多轮对话记住上下文"（修完 P0-T1 后才可说）
- ❌ "Redis 缓存 5 分钟"（实际 Caffeine JVM）

### 12.3 可以说的（修完 Phase 1 后）
- ✅ "您不需要学单据流程，说人话即可"
- ✅ "一句话完成销售→生产→采购"
- ✅ "食品溯源给盒马山姆审计直接出数据"
- ✅ "AI 主动告诉您缺货/异常"
- ✅ "您一句话能让首页改成您想要的样子"

---

## 13. 文档地图

| 文件 | 内容 |
|---|---|
| **EXECUTION_PLAN.md** ← 本文件 | 行动指南，团队按这个执行 |
| STRATEGY.md | 战略 + 决策框架（Why） |
| AUDIT.md | 上轮硬证据审计 |
| AUDIT_X_UI_UX.md | 视频 UI/UX 模式 |
| AUDIT_Y_CANVAS.md | Canvas 系统审计 |
| AUDIT_Z_AICHAT_E2E.md | AIChat 端到端 |
| GAPS.md | 第一版 23 缺口（已被 V1+V2HD+V3 修正） |
| V1_AUDIO_INVENTORY.md | 音频 exhaustive 18 漏项 |
| V2_HD_INVENTORY.md | 高清视频 20 新功能 + 15 细节深化 |
| V3_CRETAS_REVERSE.md | Cretas 已有 7 项 + 独家 10 项 |
| REVIEW.md / REPORT.md | 早期分析（被本计划吸收） |

**优先级阅读**：EXECUTION_PLAN → STRATEGY → 需要细节时查具体 AUDIT。
