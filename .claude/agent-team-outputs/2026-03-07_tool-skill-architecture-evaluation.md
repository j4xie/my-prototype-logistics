# Tool-Skill 架构评估报告

**日期**: 2026-03-07
**研究主题**: 评估当前 Tool-Skill 架构设计是否合理

---

## Executive Summary

- **建议**: 删除 Skill 路由/注册/匹配层（~2040行死代码），但**提取 SkillExecutorImpl 的多Tool编排能力**到独立 `ToolChainExecutor`；继续用 Strangler Fig 模式完成 Handler→Tool 迁移
- **置信度**: 高 — 三组研究 + 代码验证均确认 Skill 层零调用、Tool 覆盖率仅55%
- **核心风险**: SkillExecutorImpl 包含项目唯一的 sequential/parallel/chain 多Tool编排实现（711行），直接删除会丧失编排能力
- **工作量**: 删Skill层约1周，完成Tool迁移约3-4周

---

## Consensus & Disagreements

| 主题 | 最终裁定 | 置信度 |
|------|---------|--------|
| Skill层是否死代码 | **确认死代码** — SkillRouterService 零外部调用者 | ★★★★★ |
| 应如何处理Skill层 | **提取编排后删除** — 保留 sequential/parallel/chain context 编排能力，删除路由/注册/匹配 | ★★★★☆ |
| 0%覆盖Handler数量 | **至少9个**（非最初报告的4个）：Restaurant, Camera, WorkReport, Decoration, PageDesign, Meta, FoodKnowledge, ScaleTroubleshoot, ScaleProtocol | ★★★★★ |
| DataOp是否适合Tool化 | **部分可行** — `dataop/`已有5个成功转换，元操作模式仅适用于参数高度动态的子集 | ★★★☆☆ |
| Strangler Fig迁移模式 | **合适但需明确时间线** — 5个Handler已100%覆盖证明模式可行，但有停滞风险 | ★★★★☆ |

---

## Detailed Analysis

### 1. Tool 覆盖率现状

25个Handler共约257个case，Tool覆盖率约55%（141/257）。

- **已100%覆盖（5个）**: MaterialIntentHandler(24), ShipmentIntentHandler(13), AlertIntentHandler(9), CRMIntentHandler(24), ProductionPlanHandler
- **0%覆盖（至少9个）**: RestaurantIntentHandler(26), CameraIntentHandler(11), WorkReportHandler(8), DecorationIntentHandler(6), PageDesignHandler, MetaHandler, FoodKnowledgeHandler, ScaleTroubleshootHandler, ScaleProtocolHandler
- **最大迁移工作量**: ReportIntentHandler（44 case, 20%覆盖率）
- **特殊处理**: DataOperationIntentHandler（2992行, 11 case, 元操作模式）

Tool总数约160个，在业界推荐范围（50-200）内。31个孤儿Tool（有实现无Handler引用），4组重复Tool实现。

### 2. Skill 层架构评估

Skill 层由6个核心文件组成（~2040行），加上 DTO 和 Repository 约2400-2500行。实际请求路径为 IntentExecutor → Handler/ToolRouter，完全绕过 Skill 层。

**关键发现**:
- SkillRouterService 在 `skill/` 目录外无任何调用者（Grep 验证）
- SkillRegistry 预注册6个默认Skill，引用的12个Tool名中仅2个存在于 ToolRegistry
- SkillExecutorImpl 无条件调用 LLM（`callLlm()` 第114行），即使单Tool场景也+300-2000ms
- SkillExecutorImpl 的线程池（`Executors.newFixedThreadPool(4)` 第69行）永不关闭

**但 SkillExecutorImpl 包含唯一的多Tool编排实现**:
- Sequential execution with chain context（第591行 `chainContext.put()`）
- Parallel execution with timeout control（第626行）
- Tool execution plan parsing
- 这些能力在 IntentExecutor 和 ToolRouter 中完全不存在

### 3. 路由架构

IntentExecutorServiceImpl 4分支路由（784-813行）：
1. 4a: Tool直接绑定（INTENT_CODE_HANDLER_OVERRIDE map）
2. 4b: Handler category 匹配
3. 4c: ToolRouter 动态选择（向量检索 + LLM精选）
4. 4d: Handler fallback

**简化方向**: 4分支 → 2分支（Tool确定性匹配 → ToolRouter模糊匹配），符合业界"确定性优先、LLM fallback"共识。

---

## Comparison Matrix

| 维度 | 当前实现 | 方案B: 提取编排+删Skill+完成Tool迁移（推荐） | 方案C: 激活Skill层 |
|------|---------|---------------------------------------------|-------------------|
| 路由架构 | 4分支(IntentExecutorServiceImpl:784-813)，Skill绕过 | 2分支：Tool优先→ToolRouter回退 | 5分支，增加Skill入口 |
| Skill层 | 9文件~2470行死代码，零调用 | 提取编排到ToolChainExecutor，删其余 | 需接入Controller+修复依赖 |
| Tool覆盖率 | 55%(141/257) | 目标100%，渐进迁移 | 不影响 |
| LLM开销 | ToolRouter仅模糊场景调LLM | 保持确定性优先 | SkillExecutor每次+300-2000ms |
| 多Tool编排 | 仅SkillExecutor有（死代码） | ToolChainExecutor按需启用 | 有但性能差（每次调LLM） |
| 代码复杂度 | 中高 | 中低 | 高（四层并存） |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|-----|--------|------|
| Skill层是死代码应清理 | ★★★★★ | 三组研究一致，Grep验证零外部调用 |
| 编排能力应提取而非丢弃 | ★★★★☆ | Critic提出，代码验证确认711行编排实现 |
| Tool覆盖率55%需补全 | ★★★★★ | Handler/Tool目录对比验证 |
| 0%覆盖Handler至少9个 | ★★★★★ | 代码目录对比验证 |
| DataOp部分可Tool化 | ★★★☆☆ | Critic与Researcher观点冲突 |
| Strangler Fig合适 | ★★★★☆ | 业界共识 + 5个成功案例 |

---

## Actionable Recommendations

### Immediate（本周）
1. 从 SkillExecutorImpl 提取多Tool编排逻辑到独立 `ToolChainExecutor`（sequential/parallel/chain context/timeout）
2. 清理31个孤儿Tool和4组重复Tool（如 `equipment_alert_*` vs `alert_*`）

### Short-term（2-3周）
3. 删除 Skill 路由层：`service/skill/` 6文件 + `SmartBiSkillRepository` + DTO + 线程池配置
4. 简化 IntentExecutorServiceImpl 路由：4分支 → 2分支（Tool确定性 → ToolRouter模糊）
5. 补全0%覆盖Handler的Tool — 先做小case Handler（PageDesign, Meta, Decoration, ScaleProtocol, ScaleTroubleshoot），再做中等（WorkReport 8, Camera 11）

### Conditional
6. ReportHandler（44 case, 20%覆盖）按报表类型分批迁移
7. RestaurantHandler（26 case）需确认业务优先级后排期
8. 出现3+ Tool串联场景时启用 ToolChainExecutor

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 删Skill时遗漏SmartBiSkillRepository/线程池清理 | 低 | 中 | 测试环境先部署验证Spring启动 |
| ReportHandler迁移复杂度超预期 | 中 | 中 | 按报表类型分组，每组独立迁移+测试 |
| Strangler Fig迁移停滞 | 高 | 中 | 设定明确时间线和完成标准 |
| 删除编排能力后6个月需重建 | 中 | 高 | 提取到ToolChainExecutor而非直接删除 |
| 0%覆盖Handler被遗忘 | 高 | 低 | 建立迁移跟踪清单 |

---

## Open Questions

1. 160个Tool中有多少功能完整可用？（质量 vs 数量）
2. 当前是否存在需要 multi-Tool 编排的实际业务场景？
3. RestaurantHandler 26个case是否属于活跃业务？
4. DataOperationIntentHandler 具体哪些case已成功转Tool、哪些不适合？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (Handler-Tool映射、架构路径分析、业界最佳实践)
- Browser explorer: OFF
- Total sources: 24 (codebase evidence + industry references)
- Key disagreements: 3 resolved, 1 unresolved
- Phases: Research (parallel) → Analysis → Critique → Integration
- Fact-check: disabled (codebase-grounded topic)
- Healer: All checks passed
