# SmartBI 图表分析 vs 行业标杆对比评估

**日期**: 2026-03-05
**模式**: Full | 语言: Chinese
**增强**: Competitor profiles: ON | Fact-check: OFF | Browser research: ON | Codebase grounding: ON

---

## Executive Summary

SmartBI 图表系统达到 **22/25 种图表可用**，AI 智能推荐和 IQR 异常检测标注是独特竞争优势（竞品不具备），但距行业标杆仍有差距（联动/主题/移动端）。P0 修复约 1-2 天，P1 改进约 1 周。

**关键发现**:
- 22 种图表对垂直食品 BI 场景已够用（Metabase 仅 17 种）
- 3 种枚举类型（sankey/slope/matrix_heatmap）在推荐器中存在但无 builder 实现 → 推荐后渲染失败
- null 值显示 bug 直接影响数据可信度
- 14 个图表组件使用 window.resize 而非 ResizeObserver

---

## Comparison Matrix

| 维度 | SmartBI 当前实现 | Metabase | Superset | QuickBI | 权重 |
|------|-----------------|----------|----------|---------|------|
| **图表类型** | 22种可用/25声明, 3缺失 | 17种 | 40+种 | 30+种 | 中 |
| **AI推荐** | LLM驱动(独特优势) | 规则映射 | 规则+plugin | 模板+规则 | 高 |
| **Drill-down** | 完整(面包屑+多层) | 完整 | 完整 | 完整 | 高 |
| **联动/Brush** | 未实现 | 交叉过滤 | 原生联动 | 联动+过滤 | 低(对垂直BI) |
| **动画** | 6种preset(300-500ms) | 基础过渡 | CSS过渡 | 自研 | 低 |
| **色彩系统** | 10色palette前后端统一 | 多套主题 | Token-based | 6套内置 | 中 |
| **暗色模式** | 未实现 | 支持 | Token切换 | 支持 | 低 |
| **大数据** | 10K采样+dataZoom | 虚拟化 | WebWorker | 分布式 | 低(Excel场景) |
| **响应式** | 页面级ResizeObserver, 组件级window.resize | 自适应 | 响应式 | 响应式 | 中 |
| **无障碍** | 部分aria-label, 无decal | 基础 | 基础 | 无 | 低 |
| **异常标注** | IQR检测+markLine(独特) | 无 | 告警线 | 参考线 | 高 |
| **Tooltip** | 专用组件有千分位, 通用渲染器缺 | 自动格式化 | 自动格式化 | 自动格式化 | 低 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 22 种图表可用，3 种未实现 | 5/5 | Critic 代码验证 |
| AI 推荐引擎是独特竞争优势 | 4/5 | 3 agent 共识 + 竞品确认 |
| 推荐器可能推荐未实现类型 | 5/5 | 代码验证 |
| null 值显示 bug 存在 | 5/5 | 浏览器实测 |
| 联动/brush 非当前优先级 | 4/5 | 产品定位分析 |
| v1/v2 builder 分裂是技术债 | 3/5 | 未深入验证 |
| 移动端适配不足 | 5/5 | 全员共识 |

---

## Actionable Recommendations

### Immediate (P0 — 1-2 天)

1. **禁止推荐未实现图表类型**
   - 文件: `recommender.py` / `chart_recommender.py`
   - 操作: 从推荐候选中移除 sankey/slope/matrix_heatmap，或添加降级逻辑

2. **修复 null 值显示 bug**
   - 文件: `DynamicChartRenderer.vue` 数据预处理
   - 操作: 空值过滤/替换为 0 或 "N/A"

### Short-term (P1 — 1 周)

3. **图表组件迁移到 ResizeObserver**
   - 影响: 14 个图表组件从 `window.addEventListener('resize')` → `ResizeObserver`
   - 收益: sidebar 折叠/面板调整时图表自适应

4. **评估 v1/v2 builder 统一方案**
   - `chart_builder.py` (活跃, 21种) vs `chart/builder.py` (休眠, 未使用)
   - 确认是否删除 v2 或合并功能

5. **DynamicChartRenderer tooltip 千分位**
   - 文件: `DynamicChartRenderer.vue` 的 `formatAxisValue()`
   - 操作: 添加 `Intl.NumberFormat('zh-CN')` 或 `toLocaleString()`

### Conditional (P2-P3)

6. 暗色主题 → 若有用户需求反馈
7. 联动/Brush → 若产品转向多 Excel Dashboard 模式
8. large/progressive 渲染 → 若数据集规模超 5 万行成为常态

---

## Key Disagreements Resolved

| 主题 | 分析师 | 评审员 | 最终裁定 |
|------|--------|--------|---------|
| 图表计数 | 19种实现/22声明 | 22种可用/25声明 | 采信 Critic: 22/25 |
| Tooltip 千分位 | P1 | P2(仅1处缺失) | 采信 Critic: P2 |
| 联动/Brush | P0 | P3(产品定位不同) | 采信 Critic: P3 |
| ResizeObserver | 已覆盖 | 仅页面级(组件级未覆盖) | 采信 Critic: P1 |

---

## Open Questions

1. v1/v2 builder 分裂的实际影响 — 需代码审计
2. sankey/treemap 被推荐的实际频率 — 需生产日志
3. 移动端使用率 — 如极低则可降优先级
4. "30-40 种图表"是否适用垂直食品 BI — 可能 15-20 种足够

---

## Process Note
- Mode: Full
- Researchers deployed: 4 (Browser Explorer + Code + Benchmark + Design)
- Browser explorer: ON (5 pages visited)
- Total sources found: 35+
- Key disagreements: 4 resolved, 1 unresolved (v1/v2 builder)
- Phases completed: Research + Browser -> Analysis -> Critique -> Integration -> Heal
- Fact-check: disabled (codebase-grounded topic)
- Healer: All checks passed
- Competitor profiles: 4 competitors analyzed (Metabase, Superset, FineBI, QuickBI)
