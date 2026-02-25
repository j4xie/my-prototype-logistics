# RN App 与 Showcase 展示内容一致性分析报告

**日期**: 2026-02-22
**研究主题**: 分析白垩纪食品溯源系统的 React Native App 功能与 Showcase 展示网页内容的一致性

---

## Executive Summary

- **建议**: Showcase 整体方向正确，但需更新数值统计并统一两个展示页之间的术语口径。前后端销售状态枚举不一致是独立的代码质量问题，不应与 Showcase 修正混为一谈。
- **置信度**: 高 -- 三组研究员均已通过代码验证，核心数据分歧仅涉及计数口径和术语定义
- **关键风险**: AI 意图实际 170 个标签，两个 Showcase 均写 140/140+，低估 18%
- **时间影响**: 数值修正为小幅 HTML 编辑（1-2 小时），前后端枚举统一需协调开发（1-2 天）

---

## Consensus & Disagreements

| 议题 | Researcher 发现 | Analyst 判断 | Critic 挑战 | 最终裁定 |
|------|----------------|-------------|------------|---------|
| 销售状态枚举 | 后端: PROCESSING/COMPLETED; 前端: DELIVERING/DELIVERED; Showcase: DELIVERED | P0 错误，Showcase 应修正 | Showcase 与前端一致，真正问题是前后端枚举不同步 | **Critic 正确** -- 应先统一前后端枚举，再更新 Showcase |
| 模块数量 (26 vs 16+) | 26 个 screen 目录 | 两个 Showcase 自相矛盾 | ~8 个为基础设施目录，实际业务模块约 18 个 | 两者用了不同定义（目录数 vs 业务模块数），并非矛盾 |
| AI 意图数量 | E2E 验证 754/754 匹配 140 组 | 两页后缀不一致(140+ vs 140) | 实际 label_mapping 有 170 个标签 | **全部低估**: 建议统一为 "170 AI 意图标签" 或保留 "140+ 意图组" |
| API 端点数 | 后端 ~1442 | client-request 写 1300+ 偏低 | 确认 1442 | **三方共识**: 应更新为 1400+ |
| 覆盖率 40-50% | 376 screen 文件 vs 11 核心页面 | 系统性低估 | 方法论质疑 | Showcase 选展核心流程是合理营销策略，但关键数值偏差仍需修正 |
| 测试账号展示 | 系统有 7 个角色账号 | 仅展示 3 个 | 未挑战 | 确认缺少 hr_admin1/dispatcher1/quality_insp1/platform_admin |

---

## Detailed Analysis

### 1. 销售状态枚举不一致

**后端** `SalesOrderStatus.java`: DRAFT/CONFIRMED/PROCESSING/PARTIAL_DELIVERED/COMPLETED/CANCELLED
**前端** `salesApiClient.ts:17`: DRAFT/CONFIRMED/DELIVERING/DELIVERED/CANCELLED
**Showcase**: DELIVERING/DELIVERED

Showcase 如实反映了用户在 App 中看到的状态。真正问题是前后端枚举不同步，需先统一再更新 Showcase。

### 2. 数值统计偏差

| 指标 | 实际值 | factorybi 声称 | client-request 声称 | 偏差 |
|------|--------|---------------|-------------------|------|
| API 端点 | ~1442 | - | 1300+ | 低估 11% |
| AI 意图标签 | 170 | 140+ | 140 | 低估 18% + 后缀不一致 |
| Screen 文件 | 376 | 11 核心页面 | - | 不同口径 |
| 管理/功能模块 | 18-26 (看口径) | 26 | 16+ | 不同口径 |
| Controller | 113 | - | - | 未展示 |

### 3. 测试账号覆盖

展示 3 个: factory_admin1, workshop_sup1, warehouse_mgr1
缺失 4 个: hr_admin1, dispatcher1, quality_insp1, platform_admin

### 4. 功能模块覆盖

| 模块 | Screen 数 | Showcase 展示深度 |
|------|----------|----------------|
| HR | 22 | 仅"员工管理"一节 |
| Warehouse | 35 | 进销存闭环中部分提及 |
| Dispatcher | 29 | client-request 一词提及 |
| Quality Inspector | 8 | 闭环中简要提及 |
| SmartBI | 17 | 有展示但简略 |
| Traceability | 3 | 标题提及未展开 |
| Lowcode | 存在 | 完全未提及 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| API 端点应从 1300+ 更新为 1400+ | ★★★★★ | 三方共识，代码验证 |
| AI 意图标签实际为 170 | ★★★★★ | 代码验证 label_mapping.json |
| 前后端销售枚举不同步 | ★★★★★ | 代码验证两端文件 |
| Showcase DELIVERED 非展示错误 | ★★★★☆ | 前端代码确实使用 DELIVERING/DELIVERED |
| 两个 Showcase 数值差异源于口径不同 | ★★★★☆ | 标签分析("管理模块" vs "功能模块") |
| 测试账号展示不完整 | ★★★★☆ | 7 角色 vs 2-3 展示 |

---

## Actionable Recommendations

### Immediate (立即执行)
1. 将 client-request-example 的 API 端点从 `data-target="1300"` 更新为 `data-target="1400"`
2. 统一两个 Showcase 的 AI 意图表述: 均改为 `data-target="170"` + "AI 意图标签"，或均用 `data-target="140" data-suffix="+"` + "AI 意图组"

### Short-term (本周内)
3. 统一前后端销售订单状态枚举 — 涉及: `salesApiClient.ts`, `SalesOrderListScreen.tsx`, `SalesOrderDetailScreen.tsx`, `SalesOrderStatus.java`
4. 更新 factorybi-example 进销存闭环中的状态标签（与枚举统一后保持一致）
5. 考虑在 factorybi-example 补充 Dispatcher 和 HR 角色截图（各 1-2 张）

### Conditional (条件触发)
6. 如需对外正式发布，补全测试账号列表（7 个角色）
7. 如 "26 管理模块" 引起质疑，可调整为 "18+ 业务模块"
8. 如规划自动化更新，可建立 CI 脚本从代码库提取数值注入 HTML 模板

---

## Open Questions

1. **前后端枚举统一方向**: 以后端 PROCESSING/COMPLETED 为准，还是以前端 DELIVERING/DELIVERED 为准？
2. **Showcase 部署状态**: 三个 HTML 文件是否已上线？如仅本地文件，修正紧迫性较低
3. **"140 意图组" vs "170 意图标签"**: 确认 group-to-label 映射关系，决定对外宣传数字
4. **截图时效性**: 未验证截图是否与当前代码版本对应

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (RN App / Showcase / Code Verification)
- Total sources found: 12+
- Key disagreements: 3 resolved (销售状态优先级、模块计数口径、覆盖率方法论), 1 unresolved (枚举统一方向)
- Phases completed: Research → Analysis → Critique → Integration
- Fact-check: disabled (codebase grounding covers verification)
- Healer: All checks passed ✅
- Competitor profiles: N/A
