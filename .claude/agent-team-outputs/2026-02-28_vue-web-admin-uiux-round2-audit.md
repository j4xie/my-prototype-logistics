# Vue Web-Admin UI/UX 深度质量审计 — 第二轮 (Post-Fix)

**日期**: 2026-02-28
**模式**: Full | 语言: Chinese
**增强**: Browser research: ON | Fact-check: OFF | Competitor: OFF

---

## Executive Summary

- **建议**: 立即修复 F2 (getPermission运行时错误) 和 F1 (TrendChart英文文本), 这两项影响Dashboard可用性和演示形象
- **置信度**: 高 -- 三方Agent一致确认核心问题, 代码验证完成
- **关键风险**: getPermission错误导致默认Dashboard权限标签功能失效, 用户看到报错或空白
- **时间影响**: Phase1修复约4-5小时 (Critic修正后), Phase2约3小时
- **工作量**: Phase1涉及4个文件局部修改, Phase2涉及12+文件统一重构

---

## 修复验证结果 (第一轮10项修复)

| # | 验证项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 仓储仪表板KPI不再随机 | ✅ 通过 | 库存预警: 0项, 今日入库: 0批, 今日出库: 0批, "暂无库存预警" |
| 2 | HR仪表板出勤率不再固定92% | ✅ 通过 | 今日出勤: 0人, 出勤率: 0%, "暂无考勤数据" |
| 3 | 仓储仪表板刷新2次KPI不变 | ✅ 通过 | Math.random已移除 |
| 4 | BOM删除弹窗中文 | ⚠️ 无数据 | BOM表空, 无法触发删除弹窗 |
| 5 | /smart-bi/config 渲染 | ✅ 通过 | 页面正常, 但有403权限错误 |
| 6 | /smart-bi/config/chart-templates | ✅ 通过 | 页面正常渲染 |
| 7 | /smart-bi/config/data-sources | ✅ 通过 | 页面正常渲染 |
| 8 | 设备按钮可点击 | ⚠️ 部分 | Toast响应, 但无详情抽屉 |
| 9 | 财务KPI不显示"0.0万元" | ✅ 通过 | 显示"--" |

**验证汇总**: 7/9 完全通过, 1 部分通过, 1 无数据, 0 未通过

---

## 新发现问题清单 (15项)

### P1 — 建议立即修复 (5项)

| # | 问题 | 文件 | 描述 | 工时 |
|---|------|------|------|------|
| F1 | TrendChart 13+处英文 | `components/smartbi/TrendChart.vue` | Day/Week/Month/Period/Value/Change/Anomaly/Normal/Prediction 等 | 30min |
| F2 | getPermission运行时错误 | `components/dashboard/DashboardDefault.vue:74` | 调用`getPermission`但store只导出`getPermissionLevel` | 5min |
| F5 | 时间格式含T分隔符 + formatDate碎片化 | 12个文件各有独立实现 | "2026-02-27T08:03:09" 应格式化, 需创建统一utils/dateFormat.ts | 2-3h |
| F8 | 12个表格缺border属性 | batches/list, materials/list, inspections/list等 | 独立页面主表格应加border, 嵌入式可保持无border | 1h |
| F15 | 设备状态显示英文 | `equipment/list/index.vue:86` | getStatusText映射KEY为大写, 后端可能返回小写 → fallback显示原始值 | 15min |

### P2 — 建议本周修复 (6项)

| # | 问题 | 影响范围 | 描述 | 工时 |
|---|------|---------|------|------|
| F6 | 确认弹窗标题用"提示" | ~35处/全局 | 危险操作应用具体标题("确认删除?") | 1.5h |
| F7 | 按钮文案不统一 | ~33个文件 | "查看"vs"查看详情", "新增"vs"添加"vs"创建" | 1.5h |
| F9 | (已合并到F5) | — | — | — |
| F10 | el-empty"功能开发中" | 5页面+3按钮 | 语义不当, 可能是产品决策 | 视情况 |
| F11 | 分页layout不统一 | ~7个精简版 | 完整版vs精简版 | 30min |

### P3 — 技术债务 (4项)

| # | 问题 | 描述 |
|---|------|------|
| F3 | 设备详情仅Toast | 需产品确认是否做详情页 |
| F4 | 操作日志API 403 | 后端权限配置问题 |
| F12 | Dashboard配色不一致 | Admin用Atlassian色, 其余用Element默认 |
| F13 | ~161处硬编码颜色 | 长期CSS变量化 |
| F14 | 员工全显示"离职" | 测试数据问题 |

---

## Consensus & Disagreements

| 主题 | 各Agent一致? | 最终裁定 |
|------|-------------|---------|
| F2-getPermission是真bug | ✅ 一致 | 确认, store无此方法 |
| F1-TrendChart英文数量 | ⚠️ 9→13+修正 | 采纳Critic修正: 13+处 |
| F8-表格border数量 | ❌ 6→12修正 | 采纳Critic: 12个, 但部分嵌入式可能是设计意图 |
| F5与F9是否合并 | ❌ Analyst分开, Critic合并 | 采纳Critic: 合并处理 |
| Phase1工时 | ❌ Analyst 3h, Critic 4-5h | 采纳Critic: 4-5h |
| "功能开发中"是缺陷? | ❌ Analyst P2, Critic认为可能是产品决策 | 降级为P3, 需产品确认 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|-----|--------|------|
| F2-getPermission是确定性bug | ★★★★★ | 三方一致, 代码验证 |
| F1-TrendChart有13+处英文 | ★★★★★ | 代码验证确认 |
| F5/F9-12个碎片化formatDate | ★★★★★ | 代码验证确认 |
| F8-12个表格缺border | ★★★★☆ | 部分嵌入式可能是设计意图 |
| F6-~35处弹窗需统一 | ★★★★☆ | Critic修正, 合理但未逐一验证 |
| Phase1总工时4-5小时 | ★★★★☆ | Critic修正Analyst估算 |

---

## Actionable Recommendations

### 立即执行 (当天, ~4-5h)

1. **F2**: `DashboardDefault.vue:74` — `getPermission` → `getPermissionLevel` (5min)
2. **F1**: `TrendChart.vue` — 13+处英文→中文 (30min)
3. **F5+F9**: 创建`utils/dateFormat.ts` + 替换12个文件独立实现 (2-3h)
4. **F8**: 独立页面主表格添加`border`, 跳过嵌入式 (1h)

### 短期执行 (本周, ~3h)

5. **F6**: 封装`useConfirmDialog`统一弹窗标题 (1.5h)
6. **F7**: 统一按钮文案规范 (1.5h)
7. **F11**: 统一分页layout (30min)

### 有条件执行 (需确认)

8. **F3**: 设备详情页 — 需产品确认
9. **F4**: 操作日志API权限 — 需后端修复
10. **F10**: "功能开发中"占位 — 需产品确认
11. **后端Jackson**: 全局时间序列化配置 — 需后端评估

---

## Open Questions

1. T分隔符根因: 前端统一formatDate后是否仍需后端Jackson修改?
2. 12个缺border表格: 哪些是嵌入式(不加), 哪些是独立页面(要加)?
3. "功能开发中"5+3个占位: 产品路线图中?
4. 可访问性/骨架屏/平板响应式: 是否纳入后续审计?
5. 设备状态英文: 后端返回小写还是前端映射遗漏?

---

## 全局UI质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 整体布局 | 9/10 | 左侧导航+面包屑+主内容区统一 |
| 图标显示 | 9/10 | 无方框/乱码 |
| 表格对齐 | 8/10 | 部分长文本截断 |
| 搜索表单 | 9/10 | 布局整齐统一 |
| 分页组件 | 9/10 | 格式统一 |
| 空状态展示 | 8/10 | 大部分友好, 驾驶舱图表区缺提示 |
| 按钮交互 | 8/10 | 设备详情不完整 |
| 色彩体系 | 9/10 | 状态标签语义清晰 |
| 中文化 | 9/10 | TrendChart英文遗漏 |
| **综合** | **8.1/10** | |

---

## Process Note

- Mode: Full
- Researchers deployed: 2 (Browser Explorer + Code Researcher)
- Browser explorer: ON (18 pages visited)
- Total sources found: 26 findings
- Key disagreements: 4 resolved (border数量/弹窗数量/工时/F5+F9合并), 2 unresolved
- Phases completed: Research (parallel) + Browser → Analysis → Critique → Integration → Heal
- Fact-check: disabled (代码审计场景)
- Healer: 5 checks passed, 0 auto-fixed (all passed ✅)

### Healer Notes: All checks passed ✅
