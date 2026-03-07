# 意图识别系统完善度深度评估

**日期**: 2026-03-04
**模式**: Full (3 Researchers + Analyst + Critic + Integrator)
**研究主题**: 当前意图识别系统完善度评估 — 架构成熟度、MLRL自学习能力、餐饮/工厂业态分离

---

## 执行摘要

当前意图识别系统已达到 **98%+ E2E 准确率**（1215/1232），采用 4 层级联架构（短语→BERT→语义→LLM），**整体成熟度 80-82%**。核心瓶颈：(1) MLRL 闭环 6 项机制已编码但 `applySuggestion()` 存在 TODO、pipeline 无自动触发；(2) 餐饮/工厂在 Layer 1 有 88 条交叉污染，但 v32.1 三层后置过滤有效兜底；(3) 缺乏模型回归检测——这是一切自动化的前提。

---

## 三维度评估

| 维度 | 评分 | 置信度 | 关键发现 |
|------|------|--------|----------|
| **架构完善度** | 88/100 | HIGH (90%) | 4层管线成熟，98→99%仅需~10处修复 |
| **MLRL自学习** | 65/100 | MEDIUM (75%) | 6项机制完整编码，applySuggestion TODO是唯一断点，无自动触发 |
| **业态路由分离** | 78/100 | MEDIUM-HIGH (80%) | Layer 1有88条交叉污染（非最初估计的370条），v32.1三层过滤有效 |

---

## 共识与分歧映射

| 议题 | 研究发现 | 分析师判断 | 审查师修正 | 最终裁定 |
|------|---------|-----------|-----------|---------|
| 准确率架构完善度 | 4层管线成熟，98%可达 | 98→99%可通过~10处修复实现 | 同意，17个失败多为低频 | **共识**：架构成熟 |
| Factory Map RESTAURANT污染数量 | 存在交叉污染 | "~370条" | **实际仅88条**（代码验证） | **采纳审查师**：88条，MEDIUM优先级 |
| v32.1后置过滤有效性 | 承认存在 | 评为"补偿措施" | **被严重低估**——覆盖三层 | **采纳审查师**：域分离实际75-80% |
| MLRL成熟度 | 6项机制存在 | 60% | 70-75% | **最终裁定65-70%** |
| SemanticRouter缺businessDomain | 确认属实 | P0-2 | 降为P2 | **采纳审查师**：降为P2 |
| pipeline.sh加cron | 无自动触发 | P0-3 | 反对（无回归检测下危险） | **需先建回归检测** |

### 关键分歧裁定

1. **Factory Map RESTAURANT 污染**: Analyst称~370条 → Critic代码验证仅88条（夸大4.2倍）→ 优先级从HIGH降为MEDIUM
2. **域分离成熟度**: Analyst评50% → Critic评75-80% → 最终78%（v32.1三层过滤被低估）
3. **pipeline.sh加cron**: Analyst建议P0 → Critic反对 → 最终：先建回归检测再考虑

---

## 可执行建议

### 立即执行（1-2 周）

| 编号 | 行动 | 理由 | 风险 |
|------|------|------|------|
| **I-1** | 完成 `applySuggestion()` TODO | MLRL闭环最后断点 | LOW |
| **I-2** | 建立模型回归检测（复用 `intent-routing-e2e-150.py`） | **真正的P0**，一切自动化的前提 | LOW |
| **I-3** | Domain enum增加 `RESTAURANT` 枚举值 | 代码语义完整性 | LOW |

### 短期执行（2-4 周）

| 编号 | 行动 | 理由 | 依赖 |
|------|------|------|------|
| **S-1** | 清理 `phraseToIntentMapping` 中88条 RESTAURANT_* | 消除Layer 1交叉污染 | I-2 |
| **S-2** | 修复XSS→ERROR + 多轮否定（~7用例） | 98→99%最高ROI修复点 | 无 |
| **S-3** | Active Learning效果评估改为数据驱动 | 当前硬编码0.5 | I-1 |

### 有条件执行（需评估ROI）

| 编号 | 行动 | 前置条件 | 评估标准 |
|------|------|---------|---------|
| **C-1** | SemanticRouter增加businessDomain参数 | v32.1不足时 | 域错误率>1% |
| **C-2** | pipeline.sh加cron | I-2稳定 | 回归检测100%通过 |
| **C-3** | BERT域感知训练 | 99.5%需求明确 | 投入2-3人周 |
| **C-4** | 语义向量重建 | 99.5%+需求 | A/B对比效果 |

---

## 开放问题

1. BERT V7 F1_macro 76.1% — 是否因label粒度过细？是否应合并低频/高混淆labels？
2. OOD三阈值(entropy>2.0, margin<0.15, maxLogit<3.0)为静态值 — 是否有数据支撑？
3. v32.1前缀匹配(`startsWith("RESTAURANT_")`) — 若出现非前缀命名的跨业态意图将失效
4. incremental_finetune.py的replay_ratio=5.0, freeze_layers=8 — 是否经过生产验证？
5. Shadow模式zpd_boundary累积了多少样本？是否已用于任何一轮finetune？
6. 6个CAMERA_UNSUBSCRIBE失败 — 是否应改为确定性路由？

---

## 核心结论

> **系统工程成熟度高（80-82%），ML自动化尚未闭环。最大风险不是准确率本身，而是缺乏回归检测下的变更安全性。** 建议将回归检测(I-2)视为真正P0，在此基础上逐步推进MLRL闭环和域分离优化。

---

## 代码验证记录

| 验证项 | 分析师声明 | 实际代码 | 结果 |
|--------|-----------|---------|------|
| Factory Map RESTAURANT条目 | ~370条 | 88条 (`phraseToIntentMapping.put("...", "RESTAURANT_*")`) | ❌ 夸大4.2倍 |
| applySuggestion() TODO | 存在 | `ActiveLearningServiceImpl.java:515` — 只更新状态未执行 | ✅ 确认 |
| SemanticRouter无businessDomain | 属实 | `route(String factoryId, String userInput)` | ✅ 确认 |
| matchPhrase传businessDomain | 所有调用 | 7/8处传入，1处例外(<=2字输入) | ⚠️ 基本属实 |
| Domain enum无RESTAURANT | 属实 | 14个枚举值，无RESTAURANT | ✅ 确认 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (Architecture, MLRL, Domain Separation)
- Browser explorer: OFF
- Total sources found: 22 (all codebase evidence ★★★★★)
- Key disagreements: 3 resolved (Factory Map count, domain maturity, cron priority)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded topic)
- Healer: 5 checks passed, 0 auto-fixed ✅
