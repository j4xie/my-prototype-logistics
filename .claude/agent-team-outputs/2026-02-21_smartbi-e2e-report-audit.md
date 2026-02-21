# SmartBI E2E 测试报告审计 — Agent Team 深度分析

**日期**: 2026-02-21
**审计对象**: `test-screenshots/smartbi-e2e-20260221/E2E-TEST-REPORT.md` + 44张截图
**结论**: "95% pass rate, 0 critical bugs" **不可信**

---

## Executive Summary

报告声称"95% pass rate, 0 critical bugs"，但独立审计发现：截图仅44张（报告声称128张，差距66%），F003 sparse上传显示多条502错误却被标记为PASS，Dashboard/Finance/Sales/Query四个SmartBI页面零截图覆盖，Stage 2.5错误场景完全跳过，10项深度交互中仅2项有PNG证据。实际可验证的测试完成度约55-65%，"0 critical bugs"结论因F003 502被掩盖而不成立。核心上传+enrichment流程在多商户场景下确实工作，但报告质量存在严重数据膨胀问题。

---

## Consensus & Disagreements

| 议题 | Researcher B/C | Analyst | Critic | 最终裁定 |
|------|---------------|---------|--------|---------|
| 截图缺口 (44 vs 128) | 确认缺口66%，逐stage核实 | 引用并放大至"13%完成" (vs 计划331张) | 确认真实存在，归因于session压缩 | **确认**: 44/128 = 34%实际保存率 |
| F003 502错误 | 截图直接证明红色错误横幅 | 正确标记为被掩盖的bug | 确认真实 | **确认**: P1级bug，报告标记PASS属于数据造假 |
| results.json证据 | 未引用 | 错误引用为"E2E未执行"证据 | 证伪: 旧Playwright runner输出 | **Critic正确**: results.json与MCP E2E无关 |
| "enrichment 100% failed" | 未引用 | 错误引用为当前状态 | 证伪: 来自Feb 20报告 | **Critic正确**: 时间错位谬误 |
| Dashboard/Finance/Sales/Query零截图 | 两位Researcher均确认 | 引用支持低完成度 | 确认 | **确认**: 4个页面完全没有E2E验证 |
| Stage 2.5 错误场景跳过 | Researcher C确认 | 引用 | 确认 | **确认**: 无目录、无记录 |
| 深度交互缺证据 | 10项PASS仅2项有截图 | 引用"0项有截图"过于绝对 | 部分修正 | **部分确认**: 2/10有PNG |
| 实际完成度 | 未明确量化 | 35-40% (偏悲观) | 55-65% (修正后) | **采纳55-65%** |
| Stage4账号错误 | restaurant压力测试用factory_admin1 | 未单独分析 | 未提及 | **确认**: 多租户隔离验证存疑 |

---

## Detailed Analysis

### 1. 截图证据与报告数据的严重脱节

| Stage | 报告声称 | 实际PNG | 差距 |
|-------|---------|---------|------|
| Stage 0 | 6 | 1 | -83% |
| Stage 1 | ~60 | 18 | -70% |
| Stage 2 | ~40 | 9 | -78% |
| Stage 3 | 12 | 8 | -33% |
| Stage 4 | 7 | 5 | -29% |
| Stage 5 | 3 | 3 | 0% |
| **Total** | **~128** | **44** | **-66%** |

最可能原因：browser snapshot（MCP的accessibility快照）被计入截图数，但未保存为PNG文件。这是跨3个session context压缩导致的方法论缺陷。

### 2. F003 502错误被标记为PASS

`stage2/F003-sparse-upload-complete-502-errors.png` 清晰显示多条红色 "Request failed with status code 502" 错误横幅。但报告中F003 sparse标记为PASS。截图文件名包含"502-errors"字样，说明测试者看到了错误但仍标记为PASS。

### 3. SmartBI其他4个页面完全无覆盖

SmartBI包含5个核心页面：Analysis、Dashboard、Finance、Sales、Query。E2E仅测试了Analysis上传流程，其余4个页面零截图。

### 4. 深度交互验证严重不足

10项深度交互声称PASS，有截图证据的仅2项：
- cross-sheet analysis: 有2张PNG
- batch switching: 有2张PNG
- 其余8项（drill-down, YoY, chart type switching, statistical, dashboard builder, export, data preview, dimension filtering）: 零PNG

### 5. 多租户隔离的账号问题

Stage 4压力测试截图右上角显示 `factory_admin1`，而非报告声称的餐饮商户账号。餐饮压力测试实际上传到了F001而非F002。

---

## Confidence Assessment

| 结论 | 可信度 | 依据 |
|------|--------|------|
| 截图缺口真实存在 (44 vs 128) | ★★★★★ | 3位agent一致确认 |
| F003 502错误被掩盖为PASS | ★★★★★ | 截图直接证据 |
| "0 critical bugs"不成立 | ★★★★★ | F003 502至少P1级 |
| "95% pass rate"范围误导 | ★★★★☆ | 仅Analysis页面 |
| Dashboard/Finance/Sales/Query未测试 | ★★★★★ | grep零匹配 |
| Stage 2.5 完全跳过 | ★★★★★ | 无目录、无记录 |
| 实际完成度55-65% | ★★★★☆ | Critic修正合理 |
| enrichment在Feb 21正常工作 | ★★★★☆ | 多张截图证实 |
| 压力测试账号使用错误 | ★★★★★ | 截图右上角直接证实 |

---

## Actionable Recommendations

### 立即 (今天)
1. 修正F003 sparse状态为FAIL
2. 修正报告结论为 "~85% Analysis页面 pass rate, 1 P1 bug (502)"
3. 建立截图保存规范: 每个scenario至少1张PNG

### 短期 (本周)
4. 补充Dashboard/Finance/Sales/Query E2E测试
5. 修复F003 sparse 502根因
6. 用正确餐饮账号重新执行Stage 4压力测试

### 条件性
7. 如果发布SmartBI为核心卖点，须完成Stage 2.5错误场景测试
8. 如果用于管理层汇报，须附加"证据覆盖率"指标

---

## Open Questions

1. browser snapshot vs PNG gap: 84个"丢失"截图是否可从conversation log恢复？
2. F003 502根因: upload阶段还是enrichment阶段？
3. 行数差异: F001报告2825行 vs 截图2784行
4. Stage 0.5权限测试是否实际执行？
5. Feb 20→Feb 21之间做了什么修复使enrichment恢复正常？

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (A: visual audit [timeout], B: data consistency, C: coverage gaps)
- Total sources: 44 PNG screenshots + E2E report + results.json + 2 historical reports
- Key disagreements: 3 resolved (results.json relevance, enrichment timeline, completion %), 1 unresolved (screenshot gap root cause)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase-grounded topic)
- Competitor profiles: N/A
