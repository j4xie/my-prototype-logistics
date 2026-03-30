# 工厂领料调拨流程实施计划 — 最终评审报告

## 执行摘要

Agent Team (3 研究员 + 分析师 + 批评者) 对实施计划进行了代码级验证。**总体置信度: 55%。** 计划方向正确（复用 Tool-Skill 引擎 + InternalTransfer），但存在 3 个 P0 阻塞项和计划文档与代码实际状态的显著偏差。一期需缩小范围，二期工期需上调。

---

## 一、3 个 P0 阻塞项（必须在编码前修复）

| # | 问题 | 代码证据 | 修复 |
|---|------|---------|------|
| **P0-1** | `TransferServiceImpl.deductSourceInventory()` 对 RAW_MATERIAL **只打 log 不执行扣减** | `TransferServiceImpl.java:247-251` | 参考同方法 FINISHED_GOODS 逻辑实现 FEFO 遍历扣减 |
| **P0-2** | `BomExpansionService` 无 AI Tool 包装 — 计划引用的 `bom_expansion_calculate` 不存在 | `ai/tool/impl/` 下 0 匹配 | 创建 BomExpansionTool extends AbstractBusinessTool |
| **P0-3** | 计划引用 5 个不存在的 Tool: `transfer_submit/ship/receive`, `bom_expansion_calculate`, `production_start` | 实际只有 `transfer_approve` (多action参数) | 纠正计划文档，保留多action模式 |

---

## 二、5 项核心决策评审结论

### 决策 1: 不引入 Flowable ✅ 正确但有条件

**结论: 一期正确，二期需重新评估。**
- SkillExecutorImpl 已有 DAG 拓扑排序 + 条件分支 + 并行执行 (L790-884)
- 但 DAG 引擎**完全不支持人工等待**（无挂起/恢复/超时）
- 一期的"审批"应退化为**前端按钮 + 后端状态机推进**，而非 DAG 编排
- 二期 DAG 人工等待扩展真实工作量 **8-12天**（非计划的3-5天），因需: 状态持久化表 + 恢复API + 超时扫描 + 并发安全

### 决策 2: 复用 InternalTransfer ⚠️ 务实但有语义风险

**结论: 一期可接受，标记为技术债务。**
- 优势: 0新表，11个API端点全套可用
- 风险: "厂内领料"塞进"跨组织调拨"语义扭曲，SHIPPED/RECEIVED 对走20米无意义
- **必须修复**: 增加 `production_plan_id` 字段 (P1-1)
- 现有 TransferStatsTool/TransferListTool 会混入领料数据，需加 transferType 过滤

### 决策 3: 三期演进 ⚠️ 方向正确，工期偏乐观

| 阶段 | 原计划置信度 | 修正置信度 | 调整原因 |
|------|------------|-----------|---------|
| 一期: 基础领料 | 高 | **70%** | +2-3天修P0 |
| 二期: 智能编排 | 中高 | **50%** | DAG等待扩展8-12天，非3-5天 |
| 三期: 可视化 | 中 | **40%** | 依赖二期完成度 |

**关键风险**: 一期 Orchestrator 若直接调 Service → 二期重构成本高。建议一期通过 ToolRegistry 调用 Tool。

### 决策 4: 双仓模型 ❌ 建议搁置

**关键发现: 双仓模型未在两次客户会议中被明确确认。** 是计划推导而非客户陈述。
- Factory 实体无 `warehouse_type` 字段
- 用两个 Factory 记录模拟两个仓库会导致: 物料主数据按 factoryId 隔离，两仓各维护一套数据
- SAP 对同 plant 两库位用 storage location，不创建两个 organization entity
- **建议: 下次客户会议确认后再实现。一期用单仓。**

### 决策 5: 三种调拨类型 ⚠️ 基本覆盖，缺包材

- 原料调入(HQ_TO_BRANCH) ✅ API完整，但库存扣减是P0
- 成品调出(BRANCH_TO_HQ + FINISHED_GOODS) ✅ 逻辑正常
- 退料(BRANCH_TO_HQ + RAW_MATERIAL) ✅ 基本可用
- **缺口**: TransferItemType 无 `PACKAGING_MATERIAL`，包材(盒/标签/封口膜)混入 RAW_MATERIAL

---

## 三、修正后的一期实施建议

### 缩小范围，聚焦可交付

砍掉: ~~Skill DAG 编排~~、~~双仓模型~~、~~自动触发~~
保留: 领料单 CRUD + BOM 展开 + 前端多角色入口

### 一期必做清单（按优先级）

| # | 任务 | 工作量 | 分类 |
|---|------|--------|------|
| 1 | 修复 RAW_MATERIAL 库存扣减 (P0-1) | 1-2天 | Bug修复 |
| 2 | 创建 BomExpansionTool (P0-2) | 1天 | 新Tool |
| 3 | 创建 ProductionWorkflowOrchestrator (核心) | 2-3天 | 新Service |
| 4 | ProductionPlanController 加 generate-transfer 端点 | 0.5天 | API |
| 5 | InternalTransfer 加 production_plan_id 字段 | 0.5天 | 实体修改 |
| 6 | TransferItemType 加 PACKAGING_MATERIAL | 0.5天 | 枚举扩展 |
| 7 | Web Admin 排产页加"生成调拨单"按钮 | 1天 | 前端 |
| 8 | warehouse_mgr 导航注册调拨页面 | 0.5天 | 前端 |
| 9 | workshop_sup 导航注册签收入口 | 0.5天 | 前端 |
| **总计** | | **~8天** | |

### 二期前置准备（一期中埋入）

- Orchestrator 一律通过 ToolRegistry 调用 Tool，不直接调 Service
- SkillDefinition.ExecutionNode 预留 `nodeType` 字段
- 每个硬编码步骤标注 `// FUTURE TOOL: xxx` 注释

---

## 四、待客户确认事项

1. **物流仓 vs 工厂仓**: 是两个独立库存主体，还是同一仓库的不同区域？
2. **包材管理**: 包装材料(盒/标签/封口膜)是否需要独立分类追踪？
3. **成品调回频率**: 每天固定时间调回，还是按批次完成触发？
4. **退料原因**: 是否需要区分(质量问题/生产剩余/过期)？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (架构评审 / 业务适配 / 演进风险)
- Total codebase files examined: ~30 (verified against actual source code)
- Key disagreements: 2 resolved (双仓搁置, 工期调整), 1 unresolved (是否二期引入Spring StateMachine)
- Phases completed: Research → Analysis → Critique → Integration
- Healer: structural checks passed, no auto-fixes needed
