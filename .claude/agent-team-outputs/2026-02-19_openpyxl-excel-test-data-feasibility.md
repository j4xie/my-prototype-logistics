# openpyxl 生成复杂 Excel 测试数据可行性分析

**日期**: 2026-02-19
**主题**: Python openpyxl 生成复杂 Excel 测试数据的可行性 — SmartBI E2E 测试

---

## Executive Summary

**openpyxl 纯数据写入完全可行**，是生成 SmartBI E2E 测试 Excel 的最佳方案。

SmartBI 的 Excel 消费链路（Java EasyExcel + Python pandas/openpyxl）**只读取单元格缓存值**，完全不消费公式、格式和跨 sheet 引用。因此测试数据无需包含真实公式 — 直接写入计算后的数值即可。项目已有 `create_complex_test_excel.py`（400行、10 个 sheet 场景）作为成功先例，零额外依赖，可立即扩展。

**关键约束**：`merge_cells()` 是**强制要求** — `structure_detector.py` 依赖合并单元格信息判断表头行数和数据起始行。

---

## 方案对比

| 方案 | 推荐度 | 理由 |
|------|--------|------|
| **A: openpyxl 纯数据写入** | **首选** | 项目已有先例、零依赖、CI 友好、合并单元格支持完整 |
| B: xlsxwriter | 不选 | 无法读取/修改已有文件、需新增依赖 |
| C: 模板填充 | 备选 | 模板文件是二进制难 diff、双维护成本 |
| D: 手工维护 | 不选 | 不可编程、不可追踪、维护成本极高 |

---

## Consensus & Disagreements

| 主题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|----------|
| openpyxl 可行性 | 项目已有2个成功脚本 | 推荐为首选方案 | 验证通过，90%可行 | **可行** |
| merge_cells 必要性 | 支持但标注为可选 | 未特别强调 | **强制约束** | **强制** — structure_detector.py:306-309 确认 |
| 公式行为 (None vs 缓存值) | data_only=True 读缓存值为 None | 无影响 | 合计行 None 可能影响 detectNumericColumns | **低风险** — 写数值而非公式即可规避 |
| 随机种子 | 未提及 | 未提及 | 70%概率CI不可重现 | **需修复** — 源码确认缺失 seed |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| openpyxl 纯数据写入可满足 SmartBI E2E 测试 | ★★★★★ (90%) | 三方共识 + 现有脚本验证 + 源码确认 |
| merge_cells 为强制约束 | ★★★★★ (95%) | Critic 指出 + 源码确认 |
| 优于其他 3 个方案 | ★★★★☆ (93%) | 零迁移成本 + CI 友好 |
| 与真实 Excel 解析完全等价 | ★★★☆☆ (78%) | LLM 语义判断可能因 sheet 命名差异 |
| 图表覆盖率等价 | ★★★☆☆ (72%) | 随机种子不固定 + 列名不同 |

---

## Actionable Recommendations

### Immediate
1. 在 `create_complex_test_excel.py` 开头添加 `random.seed(42)` 确保 CI 可重现
2. 将公式行（如 `=SUM(F4:F53)`）替换为计算后数值，避免 data_only=True 返回 None

### Short-term
3. 扩展脚本新增对标 `Test.xlsx` 的 11-sheet 场景，sheet 命名使用中文业务语义（如"收入及净利简表"、"2025年江苏分部利润表"）
4. merge_cells() 列为必选项，不可省略

### Conditional
5. 若 LLM 分析因合成数据偏差导致 E2E 断言不稳定，将 AI 分析断言改为 "非空 + 包含关键词" 而非精确匹配

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 省略 merge_cells 导致结构检测走错分支 | 30% | **高** | 列为强制约束 |
| 随机数据导致 E2E 不可重现 | 70% | **中** | 固定 random.seed(42) |
| LLM 对测试 sheet 名语义判断不同 | 25% | **中** | 使用真实业务 sheet 名 |
| 公式行为 None vs 缓存值差异 | 15% | **低** | 写数值不写公式 |

---

## Open Questions

1. Test.xlsx 的 11 个 sheet 具体合并单元格布局是否需要文档化？
2. `read_only=True` vs `False` 对 merged_cells 行为差异需实测验证
3. 生成数据的图表覆盖率是否等价于真实 Test.xlsx（预估 72%，需 E2E 实测）

---

## Fact-Check Report

| # | 声明 | 状态 | 来源 | 更正说明 |
|---|------|------|------|----------|
| 1 | xlsxwriter 写入性能比 openpyxl 快 3 倍 | ❓ 无法核实 | 未找到官方 benchmark | 方向正确但具体数字无权威来源 |
| 2 | xlsxwriter 无法读取/修改已有 Excel | ✅ 已核实 | [官方 FAQ](https://xlsxwriter.readthedocs.io/faq.html) | — |
| 3 | openpyxl bug #1500 日期误识别 | ✅ 已核实 | [GitLab Issue](https://foss.heptapod.net/openpyxl/openpyxl/-/issues/1500) | — |
| 4 | xlsxtpl 最后更新 2021 年 | ⚠️ 不精确 | [PyPI](https://pypi.org/project/xlsxtpl/) | 应为 2022 年 2 月 |
| 5 | pandas ExcelWriter mode='a' 覆盖样式 | ⚠️ 不精确 | [pandas 文档](https://pandas.pydata.org/docs/reference/api/pandas.ExcelWriter.html) | 取决于 if_sheet_exists 参数 |
| 6 | openpyxl write-only 不支持合并单元格 | ✅ 已核实 | [openpyxl 文档](https://openpyxl.readthedocs.io/en/stable/optimized.html) | 官方 API 不支持，有变通方法 |
| 7 | openpyxl 生成文件公式缓存值为 None | ✅ 已核实 | [openpyxl 文档](https://openpyxl.readthedocs.io/en/latest/usage.html) | — |
| 8 | read_only=True 下 merged_cells 不可访问 | ✅ 已核实 | [GitLab Issue #540](https://foss.heptapod.net/openpyxl/openpyxl/-/issues/540) | 流式 XML 解析的架构限制 |

**Summary**: 8 claims checked — ✅ 5 verified, ⚠️ 2 imprecise, ❓ 1 unverifiable, ❌ 0 incorrect

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (openpyxl能力 / SmartBI消费路径 / 替代方案)
- Total sources found: 15+ (含 8 个代码库一手证据)
- Key disagreements: 2 resolved, 1 unresolved
- Phases completed: Research → Analysis → Critique → Integration → Fact-Check
- Fact-check: 8 claims verified, 0 incorrect, 2 imprecise
- Competitor profiles: N/A
