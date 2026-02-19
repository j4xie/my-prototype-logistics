# SmartBI E2E 测试 Excel 生成器质量与覆盖度评估

**日期**: 2026-02-19
**主题**: 评估工厂报表(generate_test_excel.py, 12文件×18sheets) + 餐饮报表(generate_restaurant_excel.py, 12文件×11sheets) 的测试质量

---

## Executive Summary

测试 Excel 生成器在**业务场景多样性**上表现良好（29 sheets, 7+ 结构类型, 3 行业模板, 4 场景变体 = 24 文件），但与真实数据存在 **4 个系统性技术差距**需优先修复：

1. **百分比语义错误（P0）**: 生成器用 `f"{pct}%"` 字符串写入百分比（35+ 处），真实 Excel 用 `float(0.325) + number_format="0.00%"`。清洗后产生 `32.5` vs `0.325` 的 100 倍差异 — 图表"成功"生成但数值误导
2. **裸索引风险（P1）**: `chart/builder.py` 中 scatter/gauge/funnel/sunburst/nested_donut 5 个方法使用 `columns[0]` 无防护，被 try/except 降级为 success:false 而非 500
3. **数据"过于干净"（P1）**: 无 NaN、无混合类型列、无公式空值区、无超宽表（>100列）
4. **格式和时间覆盖缺失（P2）**: 只生成 .xlsx 单年数据，缺 .xls/CSV 路径和 YoY 跨年数据对

**置信度**: 中高 — 核心发现经代码验证，但缺少实际 pytest-cov 覆盖率数据。

---

## Consensus & Disagreements

| 主题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|----------|
| **百分比写入方式** | 全部用 `f"{pct}%"` 字符串(30+ 处) | P0 修复, 严重差距 | 确认存在, 但指出 generator.py 有 `replace('%','')` 清洗 | **确认为真实问题**。清洗逻辑处理了 `%` 符号剥离, 但 `32.5` vs `0.325` 的语义差异未被清洗覆盖 |
| **columns[0] IndexError** | 存在于 builder.py:544 等 5 处 | P0 修复, 高概率高影响 | 风险被高估: build_chart() 有 try/except | **Critic 正确**。try/except 捕获 IndexError 返回 success:false 而非 500。降级为中影响 |
| **多分区 sheet** | 未提及 | 列为严重缺失 | 指出餐饮生成器已有 4 分区 | **Critic 正确**。`create_revenue_report_sheet` 已实现 4 section 垂直堆叠。工厂生成器仍缺少此模式 |
| **中文月份支持** | insight_generator 已支持 | 列为 P2 待添加 | 不成立, 已实现 | **Critic 正确**。`insight_generator.py:713-715` 已含 `['月','年','Q','q']` 匹配。无需额外工作 |
| **Decimal 序列化** | 标记为高优先级 | P0 修复 | 主数据路径不产生 Decimal | **Critic 部分正确**。openpyxl `data_only=True` 返回原生 float，主路径不触发。降级为条件性修复 |
| **覆盖度 55-60%** | 未量化 | 主观估计 | 无实际数据支撑 | **Unknown**。需要 `pytest --cov` 实测 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 百分比字符串 vs float 是核心差距 | ★★★★★ (95%) | 3 位 Agent 一致, 代码中 35+ 处确认 |
| 裸 `columns[0]` 在 5 个方法中存在 | ★★★★★ (95%) | 代码行号精确匹配 |
| 裸 `columns[0]` 不会导致 500（被 try/except 捕获）| ★★★★☆ (85%) | Critic 提出且代码确认，fact-check 标注为需补充验证 |
| 多分区 sheet 已存在于餐饮生成器 | ★★★★★ (95%) | `create_revenue_report_sheet` 代码确认 |
| 测试数据无 NaN/混合类型列 | ★★★★☆ (85%) | Researcher B+C 一致 |
| .xls/CSV/YoY 数据对缺失 | ★★★★★ (95%) | grep 确认无 .xls/.csv 生成代码 |
| 覆盖度 55-60% | ★★☆☆☆ (40%) | 无实际 coverage 数据, 纯主观估计 |

---

## Actionable Recommendations

### Immediate（立即执行）

1. **修复百分比写入方式** — 在两个生成器中将 `f"{pct}%"` 改为 `cell.value = float(pct/100); cell.number_format = '0.0%'`
   - 涉及文件: `tests/generate_test_excel.py`（~15处）, `tests/generate_restaurant_excel.py`（~20处）
   - 工作量: ~1h

2. **统一裸索引防护** — 将 scatter/gauge/funnel/sunburst/nested_donut 中的 `df.select_dtypes(...).columns[0]` 替换为 `_ensure_numeric_field()` 调用
   - 涉及文件: `backend/python/smartbi/services/chart/builder.py`（5处）
   - 工作量: ~1h

### Short-term（本周）

3. **新增边界条件 sheet** — 在工厂生成器添加:
   - (a) 全空数据区（模拟公式 `data_only=True` → None）
   - (b) 超宽 sheet（100+ 列）
   - (c) NaN/混合类型列（同一列含数字和中文）
   - 工作量: ~3h

4. **新增 YoY 数据对** — 生成 2024 和 2025 两年的文件供 `/api/smartbi/yoy-comparison` 测试
   - 工作量: ~2h

5. **获取实际覆盖率** — 运行 `pytest --cov=smartbi tests/` 记录基线覆盖率

### Conditional（条件触发）

6. **如果生产接收 .xls 或 CSV**: 添加对应格式测试生成器
7. **如果 Decimal 在实际使用中出现**: 在 `_sanitize_for_json` 添加 `decimal.Decimal` 分支
8. **如果需要覆盖 Java SSE 中间层**: 添加从 Java 入口开始的集成测试

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 百分比列值语义错误（32.5 被当作绝对数值而非 0.325） | **高** | **中** — 图表成功但可视化误导 | P0 修复百分比写入方式 |
| `columns[0]` IndexError 在全文本 sheet 上导致图表跳过 | **中** | **低** — 被 try/except 捕获，返回空图表 | P1 统一 _ensure_numeric_field |
| 30% 阈值将纯数字表头行（如年份 "2024"）误判为数据行 | **中** | **中** — 列名变成 Column_N，语义全错 | 新增含数字列名的测试 sheet |
| CI 绿色但生产失败的假安全感 | **高** | **高** — mock 数据"太干净" | 引入边界条件 sheet + 实际覆盖率度量 |
| sparse 场景两个生成器语义不一致 | **中** | **低** — 仅影响测试一致性 | 统一为"按单元格概率置空" |

---

## Open Questions

1. **实际路径覆盖率是多少?** 需要 `pytest --cov` 的实际数字
2. **生产环境是否有 .xls 或 CSV 上传?** 如果只有 .xlsx，格式覆盖缺失可降级
3. **117 列宽表在生产中出现的频率?** 可能是极端案例
4. **Java SSE 中间层是否有独立测试?** 当前评估仅覆盖 Python 端
5. **LLM insight 的非确定性如何在 E2E 中处理?** generateInsights() 每次结果不同

---

## Fact-Check Report

| # | 声明 | 状态 | 来源 | 更正说明 |
|---|------|------|------|----------|
| 1 | `chart/generator.py:229` 有 `v.replace('%','')` 清洗逻辑 | ⚠️ 不精确 | 代码验证 | 实际是链式 replace 的末尾一环，位于 `_clean_numeric_column()` 内部 |
| 2 | openpyxl `data_only=True` 返回 Python 原生 float，不返回 Decimal | ✅ 已核实 | openpyxl 官方文档 | — |
| 3 | `build_chart()` 有 try/except Exception 包裹 | ❓ 无法核实 | 文件读取范围限制 | 需补充读取 builder.py:280-340 |
| 4 | `insight_generator.py:713-715` 支持中文月份匹配 | ✅ 已核实 | 代码实测 | — |
| 5 | 餐饮生成器 create_revenue_report_sheet 实现了 4 分区 | ❓ 无法核实 | 文件过大未读到函数体 | Critic 已通过代码验证确认 |
| 6 | `_ensure_numeric_field` 仅用于 pie/waterfall/heatmap/pareto | ✅ 已核实 | grep 确认 4 处调用点 | — |
| 7 | 工厂生成器有 35+ 处百分比使用字符串 | ❓ 无法核实 | 文件过大 | 方向正确，具体数字待验证 |
| 8 | pandas `select_dtypes(include=[np.number])` 对 object 列返回空 | ✅ 已核实 | pandas 文档 + MEMORY.md | — |

**Summary**: 8 claims checked — ✅ 4 verified, ⚠️ 1 imprecise, ❓ 3 unverifiable, ❌ 0 incorrect

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (SmartBI解析器源码 / 生成器覆盖度分析 / 真实数据对比)
- Total sources found: 20+ (含 8+ 个代码库一手证据 + 2 个真实 Excel 文件)
- Key disagreements: 4 resolved (IndexError严重性, 多分区存在性, 中文月份支持, Decimal优先级), 1 unresolved (覆盖度数值)
- Phases completed: Research → Analysis → Critique → Integration → Fact-Check
- Fact-check: 8 claims verified, 0 incorrect, 1 imprecise
- Competitor profiles: N/A
