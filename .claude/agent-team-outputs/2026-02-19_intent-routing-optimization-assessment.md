# 意图路由系统优化空间评估

**日期**: 2026-02-19
**Agent Team**: Full Mode (3 Researchers → Analyst → Critic → Integrator)
**当前基线**: E2E 136/142 (96%), F1 97.42%, P95 ~60ms

---

## Executive Summary

意图路由系统当前96%准确率通过9处冲突检测点与5轮补丁堆叠(v11.5-v21.0)而成，存在重构风险。Critic代码验证确认冲突检测实际9处而非Analyst假设的3处，导致O2(冲突前移)复杂度被严重低估。

**建议优先完成Phase -1(基线数据收集，1-2天)与Phase 0(短语扩展+默认值修复，1天代码+2天测试)达成98%，然后评估冲突前移的真实成本(预期3-4周而非1-2周)与收益。**

---

## Consensus & Disagreements

| Topic | Analyst | Critic | Final Verdict |
|-------|---------|--------|--------------|
| 冲突检测点数量 | 假设3处 | ✅验证9处 | **9处确认**(L646/750/823/832/1009/1060/1173/1807/1965) |
| Phase 0工时 | 1天达98% | 不现实,需2-3天回归 | **分阶段**: 1天快速修复 + 2-3天回归测试 |
| O2冲突前移 | 1-2周低风险 | 3-4周高风险 | **3-4周**, 涉及5轮迭代累积补丁 |
| O3阈值降低 | +6%直通率 | 多个0.85用途不同,可能适得其反 | **需数据支持**, 不应盲目降低 |
| O6默认值修复 | 无风险 | 中风险(9种考勤细分) | **高价值低风险**, 立即修复 |
| 模型替换(O11) | ROI极低 | 同意,但建议DAPT替代 | **不推荐全量替换**, 可探索DAPT |

---

## 12项优化方向 Comparison Matrix

| 优化方向 | 预期收益 | 实施工时 | 风险 | 确定性 | ROI |
|----------|----------|----------|------|--------|-----|
| **O1: 短语层扩展(+57-72条)** | E2E +2% | 4-6小时 | 低 | ★★★★★ | **极高** |
| **O6: ATTENDANCE默认→HISTORY** | 修复Case5 | 2-4小时 | 低 | ★★★★☆ | **极高** |
| **O7: 修饰词补全(多少→STATS等)** | 修复Case1,4类 | 2-4小时 | 低 | ★★★★★ | **高** |
| **O2: 冲突检测前移** | 延迟-300ms P99 | 3-4周 | 高 | ★★★☆☆ | 中 |
| **O3: L1阈值校准(0.85→0.80)** | L1直通率+6% | 2-3天 | 中 | ★★★☆☆ | 中 |
| **O4: 温度缩放+动态阈值** | 置信度校准 | 1-2周 | 中 | ★★★★☆ | 中高 |
| **O5: EDA数据增强+加权采样** | F1 +1.3% | 1-2周 | 低 | ★★★★☆ | 中 |
| **O8: 预处理步骤并行化** | 吞吐+15-20% | 2-3周 | 中 | ★★★★ | 中 |
| **O10: 食品子类拆分(1→6-8类)** | 消歧调用-50% | 3-4周 | 中高 | ★★★★☆ | 中 |
| **O9: L2语义路由简化** | 消除3%无效延迟 | 2-4周 | 高 | ★★★ | 中低 |
| **O12: 多意图组合支持** | 解决跨域聚合 | 6-8周 | 高 | ★★★ | 低 |
| **O11: 模型替换** | <0.5% F1 | 2-4周 | 中 | ★★★★☆ | **极低** |

---

## Prioritized Roadmap

### Phase -1: 基线数据收集 (1-2天)
- 部署意图路由日志收集: 每次冲突检测的输入/决策/LLM调用频次/延迟
- 收集48小时基线数据(~1000+查询), 供后续数据驱动决策
- 统计9处冲突检测点的触发频次分布

### Phase 0: 快速修复 (1天代码 + 2-3天回归) → E2E 96%→98%
- **O6**: 修改IntentCompositionConfig.java L70 `ATTENDANCE_QUERY→ATTENDANCE_HISTORY`
- **O7**: TwoStageIntentClassifier补全"多少→STATS"、"次数→STATS"、"排名→RANKING"修饰词
- **O1**: IntentKnowledgeBase新增57-72条短语(修饰词组合+复合排序+跨域聚合)
- 验证: 跑完整E2E 150条测试集, 确认>=148 PASS

### Phase 1: 工程优化 (2-4周) → P95 60ms→40ms
- **O2**: 基于Phase -1数据制定冲突前移方案(预期3-4周,高风险)
- **O3**: 在E2E测试集上跑阈值sweep确定最优值(需Phase -1的LLM纠正率数据)
- 数据收集: L2各决策类型(DIRECT/RERANK/FULL_LLM)准确率分布

### Phase 2: 模型精细化 (4-6周) → F1 97.42%→~98.7%
- **O4**: 温度缩放校准(基于Phase -1历史数据)
- **O5**: EDA同义词替换+回译数据增强, 重训练分类器

### Phase 3: 架构演进 (8周+, 按需)
- **O10**: 食品子类拆分(依赖O5增强数据)
- **O8**: 预处理步骤并行化(依赖耗时数据)
- **O12**: 多意图组合(仅在跨域查询占比>5%时启动)
- **O11**: 不推荐实施

---

## Key Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| O6修改默认值影响"今天考勤"类查询 | 40% | 高 | 验证9种考勤细分的modifier覆盖完备性 |
| O1新增短语与现有2954条冲突 | 30% | 中 | 逐条在E2E测试集上回归验证 |
| O2冲突前移破坏现有补丁平衡 | 35% | 高 | 充分回归测试,灰度发布 |
| O3降低阈值损失LLM纠错能力 | 25% | 高 | 先收集0.80-0.85区间LLM纠正率数据 |
| Phase 0 "1天"无法兑现 | 60% | 低 | 分为代码(1天)+测试(2-3天)两阶段 |

---

## 6个失败Case修复方案

| Case | 输入 | 当前→ | 应→ | 修复方案 |
|------|------|-------|-----|---------|
| B5 | "今天出勤率多少" | ATTENDANCE_HISTORY | ATTENDANCE_STATS | O7: 新增"多少"→STATS修饰词 |
| B8 | "原材料进出库明细" | SHIPMENT_QUERY | MATERIAL_BATCH_QUERY | O1: 新增短语"进出库明细"→MATERIAL |
| B8 | "上月各客户下单金额排名" | UNMATCHED | SALES_RANKING | O1: 新增短语"客户订单排名"系列 |
| B8 | "设备故障次数统计" | EQUIPMENT_ALERT_LIST | EQUIPMENT_STATS | O1: 新增短语"设备故障统计" + O7: "次数"→STATS |
| D2 | "查看考勤" | ATTENDANCE_TODAY | ATTENDANCE_HISTORY | O6: 默认值TODAY→HISTORY |
| D6 | "销售情况和客户反馈" | REPORT_DASHBOARD_OVERVIEW | SALES_STATS | O1: 新增跨域短语(或接受当前行为) |

---

## Data Gaps (Open Questions)

1. **L1阈值-准确率曲线**: 0.75/0.78/0.80/0.82/0.85各阈值下的误判率?
2. **L2 Reranking准确率**: DIRECT_EXECUTE vs NEED_RERANKING vs NEED_FULL_LLM三类的各自准确率?
3. **LLM消歧调用频次**: 日均总量, API成本占比?
4. **长尾类分布**: 157个intent中<5样本的类有多少?
5. **生产查询分布**: 实际用户查询的域分布是否与测试集一致?
6. **预处理各步骤耗时**: 6步预处理哪些是瓶颈?

---

## Process Note
- Mode: Full
- Researchers deployed: 3
- Total codebase files examined: ~15 (IntentKnowledgeBase, AIIntentServiceImpl, TwoStageIntentClassifier, IntentCompositionConfig, etc.)
- Key disagreements: 3 resolved (冲突点数量, Phase 0工时, O2工时), 2 unresolved (LLM纠正率, L2 ROI)
- Phases completed: Research (parallel) → Analysis → Critique → Integration
