# SmartBI Forecast 架构边界审计 — Agent Team 报告

**日期**: 2026-04-17
**Topic**: Python 端 /api/forecast/predict 保持纯数学计算 (Java 传 List<Double>) vs Python 端自己查数据库
**Mode**: Full | Language: Chinese | Grounding: ENABLED
**Phases**: Research (×3 parallel) → Analysis → Critique → **Integration (Critic 翻盘)**

---

## Executive Summary

- **推荐方案**: **方案 E (Critic 翻盘推荐)** — Java Controller 侧用 `findDailySalesTrend` SQL GROUP BY 直接组装 `data: List[Double]` 后传给 Python `/api/forecast/predict`, Python 继续保持纯计算
- **信心度**: **High (Critic code-verified 翻盘)** — 历史规则 `feedback_agent_team_critic_flip.md` 适用: Critic 提供了具体文件行号引用, Analyst 的"34 restaurant tool 主导模式"论据经验证是 reference class 错配
- **核心风险**: 如果采纳 Analyst 的方案 B, 将引入 IDOR 跨租户风险 (Python 侧无 SecurityUtil 等价物) 和 schema 双向耦合 (6 个月后 Java 改表 → Python 炸, P4×I4=16)
- **时间影响**: 方案 E hotfix **3-5 行 Java 改动, 0 Python 改动** vs 方案 B 实际 7+ 文件、2 语言、跨服务依赖
- **后续决策**: Stage 2 (10 🔴 + 10 ⛔ metric 支持) 延后, 看真实需求再决, 不要现在做架构押注

---

## Consensus & Disagreements

| Topic | Researcher | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|--------------|
| Python `/api/forecast/predict` 当前形态 | A: 已是纯计算 (data List[float]) | 同意 | 同意 | **共识**: 现状已符合业界模式 |
| SmartBiSalesDataRepository 成熟度 | B: 3 ✅ 覆盖, 0 日聚合 finance | 可复用 | **findDailySalesTrend SQL GROUP BY 已存在 :100** | **共识 + Critic 关键补充**: 根本不需要 JVM groupingBy, SQL 层聚合现成 |
| 业界模式 (TFX/KServe/BentoML/Feast) | A: 全纯计算 | 承认但主张例外 | 引用作为支持 A/E 论据 | **共识**: 业界 = 纯计算, 但 Analyst 主张局部例外 |
| "34 个 restaurant tool 主导模式" | C 提出 | High 置信度采纳 | **Low — reference class 错配**: 32 Java 自查, 34 Python 查的是 `smart_bi_dynamic_data` (Excel 上传) 不是 Java 业务表 | **Critic 翻盘**: Analyst 先例错用 |
| RestaurantForecastHandler 是否 "方案 B 证据" | Analyst 引用为 B 的先例 | 是 | **No — 实际是方案 A 变种**, 吃 `history_values` 传入, 不查 DB | **Critic 翻盘** |
| DynamicDataRepository factory_id 保护 | B: WHERE 强制 | Medium risk | True, 但 **Python 侧无 SecurityUtil 等价物**, IDOR 风险 | **Critic 关键补充** |
| `_legacyForecastWithAlgorithm` | 未提及 | 未提及 | **@SuppressWarnings("unused") = 死代码** | **Critic 独家发现**: "A 是 anti-pattern" 的证据实为死代码 |
| 推荐方案 | A 倾向纯计算, C 倾向方案 B | **方案 B** | **方案 E** | **Critic 翻盘 → 方案 E** |
| 方案 B 成本 | C: "1 文件 1 语言" | High 置信采纳 | **Very Low — 实际 7+ 文件, 2 语言, 跨服务依赖** | **Critic 翻盘** |
| 方案 B 风险 | C: 低 | Low-Med | **Medium-High — IDOR + schema 双向耦合** | **Critic 上调** |

---

## Actionable Recommendations

1. **Immediate — Stage 1 hotfix**: 实施方案 E — 在 Java Controller 调用 Python `/api/forecast/predict` 前, 用已有 `SmartBiSalesDataRepository.findDailySalesTrend` SQL GROUP BY 查询结果组装 `List<Double>`, 作为 `data` 字段传入。**3-5 行 Java 改动, 0 Python 改动**。走 test-first 工作流(按 memory `feedback_test_before_prod_smartbi.md`: 先 `--env test`, smoke test 验证, 再 `--env prod`)

2. **Immediate — 死代码清理**: 删除 `_legacyForecastWithAlgorithm` (标 `@SuppressWarnings("unused")` 证实死码)

3. **Short-term — 文档锚定**: 在 `.claude/rules/python-services-architecture.md` 补一段 "Python 服务边界规范":
   - (a) 纯计算服务 (forecast/classifier) 不查 Java 业务表, 由上游组装 payload 传入
   - (b) 查 Java 业务表的 Python tool 需实现 factory_id 强制 WHERE (SecurityUtil 等价物)
   - (c) `smart_bi_dynamic_data` 属 Python 原生所有权, 可直接查

4. **Short-term — reference class 教训归档**: 记录 Critic 独家发现到 memory `feedback_reference_class_mismatch.md` — 引用"某模式是主导"之前必须按被引用的具体行为维度区分

5. **Conditional**:
   - **If** 新 forecast 需求涉及具体 metric 且 payload > 100KB 或查询频次 > 10/s → 评估方案 A (Java 组装 data) vs 方案 B (Python 自查, 必须先补 factory_id 安全层)
   - **If** Python 侧新增任何查 Java 业务表的 tool → 强制先实现 SecurityUtil 等价物, 否则 PR 拒绝
   - **If** 用户提出跨 metric 组合 forecast → 重启 Stage 2 架构讨论

---

## Confidence Assessment

| Conclusion | Confidence | Evidence Basis |
|-----------|------------|----------------|
| 方案 E 是最佳 Stage 1 hotfix | ★★★★★ | Critic code-verified 翻盘 + 业界共识 + 最小改动 |
| `findDailySalesTrend` SQL GROUP BY 已存在可复用 | ★★★★★ | Critic 引用 Repository :100 行号 |
| `_legacyForecastWithAlgorithm` 死代码 | ★★★★★ | @SuppressWarnings("unused") 明确 |
| RestaurantForecastHandler 是方案 A 变种 | ★★★★☆ | Critic 读代码指出 history_values 参数传入 |
| "34 restaurant tool 主导模式"是 reference class 错配 | ★★★★☆ | Critic 区分 smart_bi_dynamic_data vs Java 业务表 |
| Python 侧 IDOR 风险真实存在 | ★★★★☆ | Critic 指出无 SecurityUtil 等价物 |
| 方案 B 成本 "1 文件 1 语言" 低估 | ★★★★☆ | Critic 分解 7+ 文件路径 |
| Stage 2 长期架构应选哪种 | ★★☆☆☆ | 无真实需求信号, 现在决策是过早优化 |
| 方案 B 的 "多租户风险低" Analyst 原评估 | ★☆☆☆☆ | Critic 上调至 Medium-High |

---

## Open Questions

1. **Stage 2 是否真有需求?** 10 🔴 + 10 ⛔ metric 的 forecast 有客户 demo 场景吗?没有就不做
2. **现有 forecast 是怎么坏的?** 方案 E 必须先修这个, 不然 hotfix 也无效 — 需拉生产日志确认具体错误
3. **findDailySalesTrend 是否覆盖所有已注册 forecast 的 metric?** 如果 Stage 1 hotfix 需要覆盖更多 metric, 要确认 SQL 支持
4. **SecurityUtil 等价物在 Python 应该怎么实现?** 若未来真走方案 B 或混合路线, 此为前置条件(不是 Stage 1 阻塞项)
5. **`data_sync.py` 写侧已跨边界合不合理?** 影响规则文档书写

---

## Methodology Note

- **Researchers deployed**: 3 (A 业界模式, B 现有代码, C 演进成本)
- **Sources consulted**: Java 代码 (SmartBiSalesDataRepository, RestaurantForecastHandler, MetricCalculatorService, _legacyForecastWithAlgorithm) + Python 代码 (forecast.py, rfm.py, financial_dashboard.py, data_sync.py, DynamicDataRepository) + 业界参考 (TFX/KServe/Seldon/BentoML/Feast)
- **Key disagreements resolved**: 5 — 全部按 Critic code-verified 翻盘
- **Unresolved**: Stage 2 长期架构最终选型(延后)
- **Fact-check**: 禁用(Full mode 但此 topic 基本全是代码验证, 无外部事实需验证)
- **Healer**: 所有检查通过 ✅

### 历史规则适用

`feedback_agent_team_critic_flip.md`: Critic 在 5 个点上都有**具体文件/方法/行号引用** (findDailySalesTrend :100, `_legacyForecastWithAlgorithm` 的 @SuppressWarnings, Python 侧缺 SecurityUtil 等), 而 Analyst 的论据是基于**错误 reference class 识别**. 按历史规则全部采纳 Critic 立场.

`feedback_test_before_prod_smartbi.md`: forecast 改动涉及 Python 契约, 必须走 test 先行, 用户确认再 prod.

"prototype-grade ≠ broken-grade" — 线上 forecast 已坏是客户可见失败, 应选 Critic 的 minimum viable hotfix (E).
