# v35.0 OOD检测系统全面评估

**日期**: 2026-02-27
**模式**: Full (3 Researchers → Analyst → Critic → Integrator)
**研究角度**: 代码实现审计 / 生产环境稳定性 / 业界方案对比

---

## Executive Summary

- **总体评估**: v35.0 OOD检测系统架构合理(4信号投票+多层防护), 但存在3个可立即修复的配置/运维问题和1个根本性盲区(短文本高置信度误分类)
- **置信度**: 中高 — 代码审计与生产数据交叉验证充分, 但缺乏系统性OOD评估数据集
- **最高风险**: 短文本(<5字)可被softmax高置信度错误分类, 此时全部4个OOD信号均失效, 这是投票机制的结构性盲区
- **时间线**: P0修复(systemd配置+devtools)可在1天内完成; Energy Score替换需1-2天; 短文本防护需专项设计
- **成本**: P0零成本配置修改; P1约5行代码改动; 短文本防护为中等架构级工作

---

## Consensus & Disagreements

| 主题 | 研究员 | 分析师 | 批评者 | 最终裁定 |
|------|--------|--------|--------|----------|
| **阈值不一致(entropy 2.0 vs 2.5)** | R-A: 代码默认与配置不同 | 列为P0 Bug | C1: 这是Spring @Value标准行为, 非Bug | **批评者正确** — @Value fallback默认值是正常设计模式, 降为低优先级文档事项 |
| **GENERAL域投票退化** | R-A: 4项变3项(跳过关键词) | 列为P0漏检风险 | C2: 仍需>=2触发, "3选1"说法数学错误 | **批评者正确** — 3选2的退化程度有限, 降为中等优先级 |
| **Energy Score优势(+14% AUROC)** | R-C: CIFAR数据集上显著优于MaxLogit | 推荐P1替换 | C3: CIFAR→179类中文BERT迁移性存疑 | **批评者部分正确** — 理论优势成立但+14%不可直接引用, 需本项目验证 |
| **Python宕机影响** | R-A/R-B: 整个BERT分类层失效 | 列为低概率高影响 | 概率被低估 | **共识** — 确实导致BERT+OOD全失效, systemd将停机控制在秒级 |
| **logback双profile激活** | R-B: systemd同时激活pg-prod+dev | 列为P0 | 未异议 | **全员共识** — 必须立即修复 |
| **短文本高置信度误分类** | R-A: 单字符无专项拦截 | 未充分讨论 | 提出为最高风险盲区 | **批评者发现关键遗漏** — 结构性盲区, 所有基于softmax的OOD信号同时失效 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| logback双profile是生产Bug, 需立即修复 | ★★★★★ | 3个agent全部一致, 代码路径明确 |
| devtools scope需改为provided | ★★★★★ | 3个agent一致, Maven标准实践 |
| 短文本高置信度误分类是结构性盲区 | ★★★★☆ | 批评者独立发现, 理论论证充分, 缺乏生产数据 |
| Energy Score优于MaxLogit | ★★★☆☆ | 理论优势成立但跨域迁移性未验证 |
| 阈值不一致是Bug | ★★☆☆☆ | 批评者纠正: 是Spring标准行为 |
| GENERAL域退化为严重风险 | ★★☆☆☆ | 数学纠正(3选2非3选1), 缺乏统计数据 |
| 生产OOD检测量(19次)合理 | ★★★★☆ | 生产日志验证 |

---

## Actionable Recommendations

### 1. Immediate (立即执行, 1天内)

- **[零代码] systemd移除dev profile**: `ExecStart`中`pg-prod,dev`改为`pg-prod`。执行`systemctl daemon-reload && systemctl restart cretas-backend`
- **[pom.xml] devtools scope改provided**: 防止DevTools打入fat JAR, 根除RestartClassLoader风险
- **[Python 2行] 截断日志预警**: >128 tokens截断时记录WARN日志

### 2. Short-term (本周内)

- **[Python 5行] Energy Score替换MaxLogit**: `max(logits)` → `T * log(sum(exp(logits/T)))`, T=1.0, 配合A/B测试
- **[Java ~10行] 短文本防护层**: 输入<=2字符时跳过分类器, 直接返回澄清提示
- **[脚本3行] deploy竞态修复**: 先stop → 替换JAR → 再start

### 3. Conditional (条件触发)

- 如Energy Score <3%改善 → 考虑embedding距离作为独立OOD信号
- 如短文本误分类频繁(>5次/天) → 设计embedding空间距离校准层
- 如需量化评估 → 构建50-100条中文域外样本评估集

---

## Key Findings Detail

### 代码实现审计 (Researcher A)

| # | 发现 | 严重度 | 来源 |
|---|------|--------|------|
| F1 | @Value注入阈值正确, 代码默认entropy=2.0 vs properties=2.5 — Spring标准行为, 非Bug | 低 | AIIntentServiceImpl.java:288 |
| F2 | GENERAL域跳过关键词验证, 3项中需>=2触发(非3选1) | 中 | AIIntentServiceImpl.java:4838-4846 |
| F3 | 空字符串Java层正确拦截 | — | ClassifierIntentMatcher.java:217 |
| F4 | >128 tokens静默截断, 无日志预警 | 中 | intent_classifier.py:112-115 |
| F5 | Python宕机=整个BERT分类层失效, 30秒恢复窗口 | 高 | ClassifierIntentMatcher健康检查 |
| F6 | REPORT域"数据"关键词过宽 | 低 | IntentKnowledgeBase.java:6074 |
| F7 | 批量接口无OOD指标 | 低 | classifier.py:139-156 |
| F8 | maxLogit=3.0无理论依据 | 低 | 经验调参 |
| F9 | 单字符/纯数字无专项拦截 | 中 | isLikelyOOD()设计 |
| F10 | OOD结果不污染训练数据 = 正确设计 | — | AIIntentServiceImpl.java:802 |

### 生产环境稳定性 (Researcher B)

| # | 发现 | 严重度 | 来源 |
|---|------|--------|------|
| F1 | logback根因: systemd激活pg-prod+dev, DevTools RestartClassLoader | **P0** | systemd service + logback-spring.xml |
| F2 | devtools scope=runtime打入fat JAR | **P1** | pom.xml |
| F3 | deploy先mv再restart有1-3秒竞态窗口 | P2 | deploy-backend.sh |
| F4 | 生产19次OOD命中, 数量适中 | OK | SSH实测 |

### 业界OOD检测对比 (Researcher C)

| 方案 | 延迟增量 | 复杂度 | 理论优势 | 适用性 |
|------|---------|--------|---------|--------|
| 当前v35.0 (4信号投票) | 0ms | 中 | 多维度投票 | **当前最优** |
| Energy Score | 0ms | 低(5行) | 温度缩放抑制过度自信 | **推荐替换MaxLogit** |
| Mahalanobis距离 | 1-5ms | 高 | 特征空间分布感知 | 类别稳定后可考虑 |
| KNN对比学习 | 10-50ms | 很高 | 专为intent设计 | 暂不推荐 |
| Rasa单阈值 | 0ms | 最低 | 简单 | 已超越 |

---

## Critic's Key Insight: Softmax过度自信盲区

分析师完全忽略的最高风险: **短文本(<5字)可被BERT以>0.9置信度错误分类到训练意图上**。此时:
- Entropy极低(概率集中在错误类)
- Margin极高(Top-1远超Top-2)
- MaxLogit极高(强神经元激活)
- 关键词可能恰好匹配

**全部4个OOD信号都不触发**, 投票机制完全失效。

例: "豆腐脑怎么做" → BERT可能以0.95置信度分类到FOOD_KNOWLEDGE_QUERY, entropy=0.3, margin=0.8, maxLogit=7.0, 所有指标看起来"正常"。

**这不是参数调优能解决的问题**, 需要引入与softmax概率无关的独立信号(输入长度检查、embedding距离)。

---

## Open Questions

1. 179个意图中有多少映射到GENERAL域? (决定3选2退化的实际影响面)
2. Energy Score在中文短文本BERT上的实际AUROC是多少? (只能通过A/B测试获得)
3. 生产环境中高置信度误分类的频率是多少? (需添加采样监控)
4. Python服务过去30天的实际宕机次数和恢复时间?
5. 阈值最近一次校准是什么时候? (179类增长过程中阈值可能漂移)

---

## Process Note

- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: 19 (codebase files + academic papers + production logs)
- Key disagreements: 3 resolved (阈值严重性、GENERAL域退化、Energy Score迁移性), 1 unresolved (短文本防护最优方案)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded topic)
- Healer: All checks passed ✅
