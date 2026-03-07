# 意图识别系统架构级优化分析

**日期**: 2026-03-06
**当前状态**: 95% (1185/1251) 路由准确率
**目标**: >=98%
**模式**: Full | 3 Researchers + Analyst + Critic + Integrator

---

## Executive Summary

当前 95% (1185/1251) 准确率的剩余 66 个失败中，核心架构问题是 **7 层串行管道中 BERT 和语义路由器独立竞争而非协作**。但 Critic 代码验证发现分析师的两个关键"缺陷"（365覆盖冲突、330餐饮短语未向量化）实际已修复。**真实提升空间可能小于预期（95->96-97% 更现实，非 98%）**。推荐渐进式路线：先做低成本 OOD 校准，再根据真实失败数据决定是否重构。

---

## 确认的架构问题（代码验证通过）

| 问题 | 代码位置 | 置信度 |
|------|---------|--------|
| 每意图仅 1 个向量表示（description+keywords 拼接） | `SemanticRouterServiceImpl.java:433-441` | 5/5 |
| BERT>=0.85 直接返回，低置信度存 ThreadLocal 但语义路由器不消费 | `AIIntentServiceImpl.java:900,973` | 5/5 |
| 两套独立向量缓存互不通信（SemanticRouter vs SemanticMatcher） | 两文件各有 ConcurrentHashMap | 5/5 |
| softmax 未经任何校准（无 Temperature/Platt Scaling） | `intent_classifier.py:123-129` | 5/5 |
| OOD GENERAL 域跳过关键词验证，退化为 3 选 2 | `AIIntentServiceImpl.java:5202` | 5/5 |
| `DOMAIN_TOOL_PREFIXES` 无 RESTAURANT 前缀 | `LlmIntentFallbackClientImpl.java:200-214` | 5/5 |
| GUARD/EXCLUDE 硬编码 25 个意图，无法热更新 | `SemanticRouterServiceImpl.java:83-119` | 5/5 |

## 被证伪的"问题"（不要投入时间修复）

| 声明 | 实际情况 |
|------|---------|
| "365 个 LinkedHashMap 覆盖冲突，6 个工厂被 RESTAURANT 覆盖" | 工厂/餐饮是两个独立 Map，已清理 |
| "330 条餐饮短语未向量化" | Wave-10 已修复，`putAll(restaurantMappings)` |

---

## 优化方案对比矩阵

| 优化方向 | 预期收益 | 工期 | 置信度 | 前提条件 |
|---------|---------|------|--------|---------|
| A: 多向量表示 + GUARD配置化 | +1.0-1.5% | 3-5天 | 低-中 | >30%失败来自语义黑洞 |
| B: BERT-语义分数融合 | +0.2-0.5% | 2-3天 | 低 | 需大量校准数据 |
| C: OOD校准 + Energy Score | +0.3-0.5% | 0.5天 | 中 | 方向正确但NLU迁移待验证 |
| D: 餐饮隔离补全 | +0.2-0.3% | 2-3周 | 低 | 前提已部分失效 |

---

## 可操作建议

### 立即执行（本周内）

1. **获取真实失败数据** — `python tests/intent-routing-e2e-150.py --prod`，按 MatchMethod 分类 66 个失败
2. **DOMAIN_TOOL_PREFIXES 补 RESTAURANT** — `LlmIntentFallbackClientImpl.java:200` 加 `RESTAURANT -> restaurant_/menu_/dish_`
3. **OOD GENERAL 域补偿** — `AIIntentServiceImpl.java:5202` 为 GENERAL 域提供兜底关键词集合

### 短期执行（1-2 周）

4. **Temperature Scaling 校准 BERT** — `intent_classifier.py:123` 加单参数 T（初始 1.5），预期 +0.3%
5. **BERT 低置信度信号传递** — 语义路由器在 BERT 有候选（0.5-0.85）时缩小搜索范围，预期 +0.2-0.5%

### 条件执行（需真实数据）

6. **多 utterance 向量表示** — 每意图 5-10 个示例替代单 keyword 拼接（如 >30% 失败来自黑洞）
7. **Energy Score 替代 MaxLogit** — 5 行代码改动（如 OOD 假阴性率 >10%）
8. **管道简化** — 7 层串行 -> 3 层协作（如业务确认 98% ROI）

---

## 预期收益（修正后）

| 组合 | 预期准确率 | 置信度 | 工期 |
|------|-----------|--------|------|
| 当前 baseline | 95% (1185/1251) | - | - |
| +立即项(2,3) | 95.2-95.5% | 4/5 | 1-2 天 |
| +短期项(4,5) | 95.5-96.5% | 3/5 | 1-2 周 |
| +条件项(6,7) | 96.5-97.5% | 2/5 | 追加 1 周 |
| +管道简化(8) | 97-98% | 2/5 | 追加 4-6 周 |

---

## 关键研究发现（详细）

### Researcher A: 语义路由 + BERT融合 + Embedding

1. 语义路由器每意图仅1个向量（description+keywords拼接），25个GUARD/EXCLUDE硬编码
2. BERT和语义路由器串行竞争：BERT>=0.85直接返回，低置信度结果存ThreadLocal但语义路由器不使用
3. gte-base-zh(768维)ONNX gRPC，每意图仅1个向量表示
4. SemanticIntentMatcher和SemanticRouterService两套独立缓存互不通信
5. 余弦相似度丢弃向量模信息（arXiv 2504.16318）
6. vLLM Signal-Decision多信号融合架构（vLLM Blog）
7. Aurelio多utterance表示 + threshold optimization（Aurelio docs）
8. GTE支持hard negative fine-tune（arXiv 2308.03281）

### Researcher B: 短语匹配 + LLM偏差

1. phraseToIntentMapping存在同Map内覆盖冲突（LinkedHashMap last-write-wins）
2. 91条RESTAURANT残留工厂Map（已有本地修复）
3. 354个短语<=3字符，短输入误匹配风险
4. SemanticIntentMatcher已在Wave-10加载餐饮短语（已修复）
5. DOMAIN_TOOL_PREFIXES无RESTAURANT前缀（确认）
6. v32.1业态过滤双层，BERT v8缺3个餐饮标签
7. GUARD黑洞列表硬编码无法热更新
8. 工具集>50个时LLM选择准确率下降

### Researcher C: OOD + 鲁棒性

1. OOD 4信号投票>=2，GENERAL域退化为3选2
2. <=2字符才跳过分类器，3-5字短输入风险
3. softmax未校准，OOD指标基于未校准logits
4. XSS已处理，SQL/prompt注入无拦截
5. GUARD膨胀25个硬编码(20+5)
6. Energy Score理论FPR@95%从51%->3.3%（NeurIPS 2020，视觉模型数据）
7. Mahalanobis距离优于MSP（AAAI 2021）
8. Temperature Scaling单参数校准过度自信softmax

---

## Critic Code Verification

| # | 声明 | 判定 |
|---|------|------|
| 1 | BERT>=0.85直接返回，ThreadLocal存储 | CONFIRMED |
| 2 | 25个GUARD/EXCLUDE硬编码（非23） | CORRECTED (20+5=25) |
| 3 | 每意图仅1向量 | CONFIRMED |
| 4 | 365覆盖冲突6个被RESTAURANT覆盖 | DISPROVED (独立Map) |
| 5 | 330餐饮短语未向量化 | DISPROVED (Wave-10已修复) |
| 6 | 两套独立向量缓存互不通信 | CONFIRMED |
| 7 | OOD 4信号投票>=2 | CONFIRMED |
| 8 | softmax未校准 | CONFIRMED |

---

## Process Note

- Mode: Full
- Researchers deployed: 3
- Total sources found: 42+
- Code verification: 8 claims checked, 2 disproved
- Key disagreements: 2 resolved, 2 unresolved (多向量提升幅度, 98%可达性)
- Phases: Research -> Analysis -> Critique -> Integration -> Heal
