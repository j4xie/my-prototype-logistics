# Phase B/C 长期投资价值分析：完整报告

> 生成时间: 2026-02-25 | Agent Team: Full Mode | 4 阶段完整流水线

---

## Executive Summary

- **结论**: Phase B (k-NN 投票+锚点补充) 和 Phase C (embedding fine-tuning) 在当前 265 意图规模下**不值得投入**。Embedding 已禁用，系统以 PHRASE+CLASSIFIER+LLM 三层运行，基线 1176/1181 (99.6%)。
- **置信度**: High (★★★★☆) — 三组研究员+分析师共识强，Critic 对归因细节的修正被采纳但不改变大方向。
- **首要动作**: 修复 Layer 0 误判 (1-2天)，将 Phase A 后的 1158/1181 (98%) 提升至 99%+。
- **关键风险**: 长期依赖 LLM fallback 的可用性和成本；ONNX 分类器 265 类硬限制是中期瓶颈。
- **投入产出**: Phase B 5-7天换取 SEMANTIC 层改善 (当前已禁用)，Phase C 2-4周+GPU 费用，两者 ROI 极低。

---

## Consensus & Disagreements

| 议题 | 研究员 | 分析师 | 审查员 | 最终裁定 |
|------|--------|--------|--------|----------|
| Phase B 当前不推荐 | ★★★★★ 一致认为 ROI 低 | ★★★★★ 不推荐 | ★★★★☆ 提出"重启 embedding 时预投入可降低风险" | **不推荐**。Critic 的边缘情况成立但前提条件 (需重启 embedding) 本身就不确定 |
| Phase C 当前不推荐 | ★★★★★ ROI 极低 | ★★★★★ 不推荐 | ★★★★★ 完全同意 | **全员共识**：2-4周+GPU 在 265 意图规模下无法证明投入合理 |
| 修复 Layer 0 是最优动作 | ★★★★★ 1-2天即可提升 | ★★★★★ ROI 最高 | ★★★★☆ 归因需更细致，Layer 0 只处理两种类型 | **共识成立但需修正**：18 个退化并非全部由 Layer 0 导致，可能涉及 topN=3 和其他因素 |
| "方案 E 已达 100%"稳定性 | 1176/1181 单次结果 | 视为稳定基线 | ⚠️ LLM 有 2-3% 随机波动 | **Critic 质疑有效**：实际基线应视为 97-100% 区间 |
| LLM-native 是长期方向 | 研究员 B 引用工业趋势 | 中性 | ★★★☆☆ 不确定适用本项目 | **证据不充分**：趋势存在但特殊性使通用结论不可直接套用 |

---

## Detailed Analysis

### 1. 当前架构状态：Embedding 禁用下的"意外最优"

| 指标 | Embedding ON (Phase A 前) | Embedding OFF 基线 | Phase A 后 (Embedding OFF) |
|------|--------------------------|---------------------|---------------------------|
| recognize | 964/1181 (82%) | 1176/1181 (100%) | 1158/1181 (98%) |
| execute | 93/94 (99%) | 93/94 (99%) | 93/94 (99%) |
| acceptable | - | - | 1174/1181 (99%) |

**关键洞察**:
- Embedding OFF (99.6%) > Phase A with Embedding OFF (98%) — Phase A 的 Layer 0 + topN=3 改动反而引入 18 个退化
- PHRASE+CLASSIFIER+LLM 三层已是最优配置
- LLM fallback 成本低 (~0.008 元/请求, 500-1500ms)

### 2. Phase B (k-NN + 锚点) ROI 分析

| 维度 | 评估 |
|------|------|
| 投入 | 5-7 天工程时间 |
| 前提条件 | 需重启 embedding 服务 (gRPC 9090) |
| 预期收益 | 改善 SEMANTIC 层质量 — 一个当前已禁用的层 |
| ROI | ★★☆☆☆ — 对已禁用模块的优化 |

**结论**: Phase B 是对一个**已禁用模块**的优化。除非有明确业务需求要求重启 embedding，否则 5-7 天投入不成立。

### 3. Phase C (Embedding Fine-tuning) ROI 分析

| 维度 | 评估 |
|------|------|
| 投入 | 2-4 周 + GPU 费用 (2000-5000元) + 标注数据 |
| 预期收益 | 根本性改善向量质量 |
| ROI | ★☆☆☆☆ — 在任何可预见场景下都不推荐 |

**结论**: 即使意图扩展到 500+，增强 ONNX 分类器或走 LLM-native 路由也比 fine-tuning 更务实。

### 4. 替代方案对比

| 方案 | 投入 | 预期收益 | ROI | 前提条件 |
|------|------|----------|-----|----------|
| 修复 Layer 0 误判 | 1-2天 | 98%→99%+ | ★★★★★ | 无 |
| 方案 A (只补锚点) | 1-2天 | SEMANTIC 改善 | ★★★☆☆ | 需重启 embedding |
| **Phase B** (k-NN+锚点) | 5-7天 | SEMANTIC 显著改善 | ★★☆☆☆ | 需重启 embedding |
| **Phase C** (fine-tuning) | 2-4周+GPU | 根本改善 | ★☆☆☆☆ | 需标注+GPU |
| 方案 D (增强 ONNX) | 1-2周 | CLASSIFIER 扩展 | ★★☆☆☆ | 需标注数据 |
| 方案 E (纯 LLM 路由) | 0天 | 当前已是此模式 | ★★★★★ | 已在运行 |

### 5. 规模增长转折点

| 意图规模 | 推荐动作 |
|----------|----------|
| <300 (当前 265) | 维持现状，修 Layer 0 |
| 300-500 | 增强 ONNX 分类器 (方案 D) |
| 500+ | 重评架构: Phase B+C 或 LLM-native 路由 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| Phase B 当前不推荐 | ★★★★☆ | 全员共识，Critic 提出边缘情况但不改变结论 |
| Phase C 当前不推荐 | ★★★★★ | 全员一致，无反对意见 |
| 修复 Layer 0 是最优行动 | ★★★★☆ | 全员推荐，Critic 对归因范围有修正 |
| PHRASE+CLASSIFIER+LLM 三层足够 | ★★★★☆ | 99.6% 基线支撑，但 LLM 波动未充分验证 |
| 300 意图是下一个架构转折点 | ★★★☆☆ | 分析师推导，无实测验证 |

---

## Actionable Recommendations

### 1. Immediate (立即执行, 1-2天)

**修复 Layer 0 误判**
- 审查 `IntentKnowledgeBase.detectQuestionType()` 中 CONVERSATIONAL/GENERAL_QUESTION 判定逻辑
- 排查导致业务查询被误拦截的关键词规则
- 文件: `IntentKnowledgeBase.java`, `AIIntentConfigController.java`
- 预期: 1158 → 1163-1168 (98.4-98.9%)

**建立 LLM fallback 监控**
- 记录每次 LLM fallback 的触发频率、延迟、成功率
- 作为长期依赖 LLM 的风险基线

### 2. Short-term (本周, 2-3天)

**逐条归因 23 个失败用例**
- 分类: Layer 0 误判 / CLASSIFIER 边界 / topN=3 影响 / 固有歧义
- 确认 Critic 对 Layer 0 归因修正的准确程度

**量化 LLM 随机波动**
- 多次运行 E2E 测试 (至少 5 次)
- 确认 1176/1181 是稳定值还是峰值

### 3. Conditional (触发条件)

| 触发条件 | 动作 |
|----------|------|
| 意图数接近 300 | 评估 ONNX 重训练 (方案 D, 1-2周) |
| LLM fallback 率 >15% | 重新评估 SEMANTIC 层重启 (Phase B) |
| LLM API 可用性 <99.5% | 重新评估 SEMANTIC 层重启 (Phase B) |
| 意图数超过 500 | 全面重评: Phase B+C 或 LLM-native |
| 6个月内意图 <300 且 LLM 稳定 | 正式移除 SEMANTIC 层代码 |

---

## Open Questions

1. **[Critical]** 23 个失败用例的逐条归因尚未完成。Layer 0 具体拦截了多少？
2. **[High]** LLM fallback 在多次测试中的波动区间？1176/1181 是稳定值还是上限？
3. **[High]** ONNX 分类器重训练的成本和流程？是否有现成训练流水线？
4. **[Medium]** embedding 服务重启成本？JAR 改名 .disabled 即可恢复？
5. **[Medium]** 业务侧预计 6-12 月意图增长到多少？
6. **[Low]** 日均请求量增大后 LLM fallback 成本是否可接受？

---

## Process Note

- **Mode**: Full
- **Researchers deployed**: 3（失败用例根因、规模增长风险、替代方案 ROI）
- **Total sources**: 6 个核心 Java 文件 + E2E 测试 + 前一份报告引用
- **Key disagreements**: 2 resolved (Layer 0 归因修正, Phase B 预投入价值), 2 unresolved (LLM-native 适用性, 300 转折点精确性)
- **Phases completed**: Research (parallel) → Analysis → Critique → Integration → Heal
- **Fact-check**: disabled（内部代码分析）
- **Healer**: All structural checks passed ✅
- **前一份报告**: `2026-02-25_semantic-layer-accuracy-drop.md` 根因分析和 Phase A 方案均已验证纳入
