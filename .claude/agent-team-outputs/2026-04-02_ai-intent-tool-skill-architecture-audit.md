# AI意图识别系统 Tool+Skill 架构完整性审查

**日期**: 2026-04-02
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**Grounding**: ENABLED (代码实证验证)

## Executive Summary

Tool+Skill 架构骨架完整可靠：338个Tool文件(310真实)、16个Skill(含DAG)、三级加载机制均为真实实现。核心风险是代码重构引入的回归——2026-03-29 的 God Object 拆分将意图管线从7层退化为3层(Phrase/Regex/Keyword)，丢失了 Semantic/Classifier/Fusion/LLM。但生产仍运行旧版完整管线，风险仅在下次部署时触发。

## Final Risk Assessment

| # | 风险 | 优先级 | 置信度 | 行动 |
|---|------|--------|--------|------|
| 1 | Layer 4-7 丢失 | P1 部署阻断 | 95% | 下次部署前从Git历史恢复完整方法体 |
| 2 | HR 9个Stub Tool返回假数据 | P1 | 95% | 改为抛异常(禁止降级原则) |
| 3 | 7个新intent缺Flyway迁移 | P2 | 85% | 补迁移文件(已手动INSERT) |
| 4 | DAG条件表达式无类型安全 | P2 | 75% | 仅2个DAG Skill,风险可控 |
| 5 | Keyword阈值不一致 | P3 | 70% | Keyword层实际0匹配 |
| 6 | CLAUDE.md Skill数量过期 | P3 | 99% | 文档同步13→16 |

## Architecture Verification

| 组件 | 声称 | 实际 | 动态性 |
|------|------|------|--------|
| Tool数量 | 310 | 338文件(310真实+28stub) | @Component自动注册 + registerExternal()运行时 |
| Skill数量 | 13 | 16内置 | Code+Classpath+DB三级加载 |
| 意图匹配 | 7层管线 | Layer1-3真实,4-7为stub | IntentKnowledgeBase.java添加短语即可 |
| 参数学习 | 自动学习 | 4种模式真实(KEYWORD_AFTER/IS/REGEX/POSITION) | 从LLM结果自动学习 |
| DAG执行 | 条件分支 | Kahn拓扑排序+布尔表达式求值 | SKILL.md/DB可定义 |

## Consensus vs Disagreement

| 结论 | Analyst | Critic | 最终 |
|------|---------|--------|------|
| Layer 4-7 优先级 | P0 | P1(生产跑旧版) | **P1** |
| 7新intent DB配置 | P0 | P2(已手动INSERT) | **P2** |
| MySQL语法风险 | P1 | N/A(已迁PG) | **N/A** |
| HR stub严重度 | LOW | P1(假数据违反原则) | **P1** |

## Process Note
- Researchers: 3 parallel (sonnet)
- Analyst: 1 (opus)
- Critic: 1 (opus)  
- Integrator: 1 (opus)
- Total findings: 34 (★★★★★ codebase evidence)
- Disagreements: 2 resolved
- Healer: all checks passed ✅
