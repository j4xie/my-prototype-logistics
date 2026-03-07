# 意图识别系统部署后剩余优化点全面分析

**日期**: 2026-03-07
**模式**: Full | 语言: Chinese
**增强**: Codebase grounding: ON | Fact-check: OFF

---

## Executive Summary

- **建议**: 优先修复6个CAMERA_UNSUBSCRIBE黑洞和BERT v8补3个餐饮标签,这两项是当前准确率的实际瓶颈;MLRL闭环和餐饮向量化属中期投资
- **置信度**: 高 — 三组Agent一致确认collectSample零调用、SEMANTIC_GUARD 18个硬编码、E2E餐饮覆盖仅22条等核心事实
- **关键风险**: BERT分类器离线曾导致准确率98%骤降至92%,但目前无自动健康监控和回滚机制
- **时间线**: Phase 1 (1-2周)可达96%,97%需BERT v9重训练(额外2-3周)
- **工作量**: Phase 1为局部修改(3-5个文件),Phase 2涉及架构级改动

---

## Consensus & Disagreements

| 主题 | Researcher发现 | Analyst建议 | Critic挑战 | 最终裁定 |
|------|---------------|-------------|------------|---------|
| collectSample零调用 | 确认:定义存在但无调用点,闭环入口断开 | P0,MLRL闭环根本断点 | 降P1——规模不够大,手动调优ROI更高 | **P1**。当前259个意图,手动维护成本可控 |
| 餐饮向量化(330条未索引) | 确认:SemanticIntentMatcher仅索引工厂短语 | P0 | 降P1——精确匹配已覆盖高频场景 | **P1**。Phrase层隔离已完成,向量化是增强非阻断 |
| BERT v8缺3个餐饮标签 | 确认:DISH_UPDATE/TABLE_TURNOVER/WASTAGE_RECORD | P1 | 提升P0——直接影响分类准确率 | **P0**。缺失标签导致必然误分类 |
| CAMERA_UNSUBSCRIBE黑洞 | 确认:6个E2E失败全部来自此意图 | 未单独提及 | 未挑战 | **P0**。6/23失败=26%来自单一意图 |
| ActionType两套枚举 | 确认:dto 8值 vs KB 6值,互不冲突 | P2统一 | 降P3——伪问题 | **P3**。独立运作无冲突 |
| SEMANTIC_GUARD硬编码 | 确认:18个意图硬编码 | P2配置化 | 维持P2 | **P2**。可工作但调整需重新部署 |
| Phase 1预期准确率 | — | 95%→97% | 过于乐观,现实95%→96% | **96%**。BERT重训练周期不确定 |
| ActiveLearningScheduler禁用 | 确认:matchIfMissing=false | Phase 2启用 | MLRL整体降优先级 | **P2**。启用前需先修复collectSample |
| E2E餐饮覆盖不足 | 14-21条F002用例 | P1扩展 | 维持P1 | **P1**。22条占1254的1.8%,严重不足 |
| Energy Score降OOD FPR | 可降10x | Phase 3 | 未挑战 | **P3**。锦上添花 |

---

## Detailed Analysis

### 1. MLRL闭环断裂 — 6环节3断裂

**事实确认**:
- `collectSample()` 方法在 `ActiveLearningServiceImpl.java:71` 定义,全项目**零调用点**
- `ActiveLearningScheduler` 通过 `matchIfMissing=false` **默认禁用**,无生产配置
- `applySuggestion` 已实现 2/7 类型(NEW_KEYWORD/NEW_EXPRESSION),非完全TODO
- `effectivenessBefore` 硬编码 `BigDecimal.valueOf(0.5)`
- 聚类 `split("\\s+")` 对中文无效(中文不以空格分词)
- web-admin 无 suggestion 审批 UI

**综合评估**: MLRL是正确的长期方向,但当前259个意图、手动Wave迭代已证明有效(92%→99%),自动闭环ROI在当前阶段不高。**P1储备**,意图数超400或查询量超日均1万时再启用。

### 2. 餐饮隔离 — Phrase完成,Semantic和BERT有缺口

**事实确认**:
- Phrase层隔离完成: 工厂phraseToIntentMapping中**0条RESTAURANT残留**(计划文档91条已过时)
- SemanticIntentMatcher仅索引工厂短语,330条餐饮未向量化
- 全部27个Handler已实现(非stub), RestaurantIntentHandler 1700+行
- BERT v8缺3个标签: DISH_UPDATE/TABLE_TURNOVER/WASTAGE_RECORD
- Handler层有Factory.type==RESTAURANT断言保护
- E2E仅22条F002用例,占总量1.8%

**综合评估**: 餐饮功能可用但"二等公民"状态明显。BERT补标签(P0)→E2E扩展(P1)→向量化(P1)按此顺序推进。

### 3. OOD与安全网 — 可用但脆弱

**事实确认**:
- SEMANTIC_GUARD 18个意图, directExecuteThreshold=0.88
- OOD 4信号投票≥2=OOD (entropy>2.0, margin<0.15, maxLogit<3.0, 关键词交叉验证)
- classifier `/api/classifier/reload` 存在但**无回滚机制**
- BertPrimary **disabled** (enabled=false, threshold=0.40), 32意图待启用

**综合评估**: 最大风险是BERT分类器运维脆弱性——历史上torch缺失导致6%准确率骤降且无告警。

### 4. 硬编码治理债务

SEMANTIC_GUARD 18个意图、effectivenessBefore 0.5、阈值0.88均硬编码。快速迭代阶段合理,稳定化后应迁移到DB配置。P2。

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| collectSample零调用,MLRL闭环断开 | ★★★★★ | 3组Agent一致,代码grep验证 |
| BERT v8缺3个餐饮标签 | ★★★★☆ | 代码验证,未逐一验证v8标签文件 |
| CAMERA_UNSUBSCRIBE是最大单点失败源 | ★★★★★ | 6/23失败来自单一意图 |
| 餐饮330条Phrase未向量化 | ★★★★☆ | 代码验证,精确匹配已覆盖高频 |
| Phase 1可达96%(非97%) | ★★★★☆ | Critic合理挑战Analyst乐观预期 |
| classifier reload无回滚 | ★★★★★ | 代码验证,grep rollback零匹配 |
| ActionType两套无冲突 | ★★★★★ | dto 8值 vs KB 6值独立运作 |

---

## Actionable Recommendations

### Immediate — 立即执行 (本周)

| # | 项目 | 文件 | 工作量 | 预期收益 |
|---|------|------|--------|---------|
| 1 | **修复CAMERA_UNSUBSCRIBE黑洞** | `SemanticRouterServiceImpl.java` 或 `CameraIntentHandler.java` | 0.5天 | 6/23失败修复, +0.5% |
| 2 | **添加BERT分类器健康监控** | 新增cron或在`/health`端点检测`/api/classifier/health` | 0.5天 | 防止98%→92%再次发生 |

### Short-term — 短期执行 (1-2周)

| # | 项目 | 文件 | 工作量 | 预期收益 |
|---|------|------|--------|---------|
| 3 | **BERT v9训练补3个餐饮标签** | `scripts/finetune/`, BERT模型 | 2-3天 | 消除3个意图BERT盲区 |
| 4 | **E2E餐饮用例扩展至≥60条** | `tests/intent-routing-e2e-150.py` | 1天 | 隔离回归保护 |
| 5 | **classifier reload添加回滚** | `classifier/api/routes.py` | 0.5天 | 消除生产模型替换风险 |

### Conditional — 条件执行

| # | 触发条件 | 项目 | 工作量 |
|---|---------|------|--------|
| 6 | 意图数>400或DAU>1万 | 启用MLRL闭环(collectSample+Scheduler+聚类修复) | 2-3周 |
| 7 | 餐饮泛化误匹配>5% | 餐饮Phrase向量化(330条) | 0.5天 |
| 8 | SEMANTIC_GUARD频繁调整 | 迁移至DB表,支持热更新 | 2天 |
| 9 | OOD误报率仍高 | Energy Score替代MaxLogit | 1周 |
| 10 | 意图稳定后 | BertPrimary逐步启用(32意图) | 持续 |

---

## Open Questions

1. **CAMERA_UNSUBSCRIBE的6个失败是路由错误还是Handler执行错误?** — 需区分是被误路由到此意图(OOD)还是正确路由但Handler异常
2. **生产环境实际餐饮查询量和误分类率未知** — 所有分析基于E2E数据,生产中的分布可能不同
3. **v8 label_mapping.json的259个标签明细** — 建议在训练v9前逐一核对
4. **BertPrimary 32个候选意图的混淆矩阵** — 需per-intent精度报告决定启用顺序
5. **聚类算法替换为embedding+HDBSCAN后的样本量需求** — gRPC Embedding服务(9090)已就绪,但minClusterSize=5可能导致稀疏

---

## 风险矩阵

| 失败模式 | 概率 | 影响 | 缓解措施 |
|---------|------|------|----------|
| BERT分类器离线(torch/transformers缺失) | 中(20%) | 极高(6%骤降) | #2健康监控+告警 |
| classifier reload损坏模型 | 低(10%) | 高(分类器不可用) | #5回滚机制 |
| BERT v9重训练灾难性遗忘 | 中(30%) | 高(正确意图回归) | replay_ratio=5.0, 本地验证再部署 |
| SEMANTIC_GUARD膨胀(18→25+) | 高(60%) | 中(正确匹配被降级) | #8配置化+监控降级率 |
| 餐饮用户激增暴露隔离缺陷 | 低(15%) | 高(体验差异) | #4 E2E扩展+#7向量化 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (MLRL闭环, 餐饮隔离, OOD+E2E)
- Total sources found: 24 (全部codebase-grounded)
- Key disagreements: 4 resolved (collectSample优先级, 餐饮向量化优先级, Phase 1预期, ActionType统一), 1 unresolved (CAMERA_UNSUBSCRIBE失败根因)
- Phases completed: Research (parallel) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (all claims codebase-grounded)

### Healer Notes
- [Fixed] Analyst将collectSample和Scheduler拆为两个P0 — 合并为P1,采纳Critic观点
- [Fixed] Analyst Phase 1预期97% — 修正为96%,采纳Critic现实评估
- [Fixed] ActionType统一从P2 → P3,采纳Critic"伪问题"判断
- [Added] CAMERA_UNSUBSCRIBE黑洞作为独立P0项(Analyst遗漏,Researcher发现)
- [Added] BERT健康监控作为Immediate项(基于历史教训)
- [Passed] 所有代码引用验证通过(Critic V1-V10全部confirmed)
