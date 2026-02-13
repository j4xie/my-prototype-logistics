# SmartBI优化方案研究报告

**日期**: 2026-02-12
**模式**: Full (5-agent pipeline)
**语言**: Chinese

---

## Executive Summary

采用"分阶段重构+MVP并行"策略，优先A(DataZoom优化) + C(近零值处理) + 组件重构，而非五个方向齐发。信心度：中-高度。关键风险：DataZoom与drill-down交互冲突、echarts.connect与已有dispatchAction重复实现、4925行God Object继续膨胀导致HMR失效。前置重构3-5天可节省后续20-30%工作量。

---

## 最终优先级排序

| 优先级 | 方向 | 工作量 | 信心度 | 备注 |
|--------|------|--------|--------|------|
| **P0** | 组件重构(SmartBIAnalysis拆分) | 3-5天 | ★★★★☆ | 前置阻断项，4925行God Object |
| **P0** | A: DataZoom + 标签自适应 | 2-3天 | ★★★★★ | 3个agent一致，技术成熟，低风险 |
| **P1** | E: 移动端BI (WebView MVP) | 1-2天 | ★★★★☆ | 先WebView验证，再评估echarts迁移 |
| **P2** | B: 图表联动(强化dispatchAction) | 2-3天 | ★★★★☆ | 不引入connect，强化已有方案 |
| **P2** | C: 近零值处理 | 1-2天 | ★★★☆☆ | 条件实施，需先统计真实频率 |
| **P3** | D: 查询构建器 | 5-8天 | ★★★★☆ | 先增强AIQuery，再考虑拖拽编辑器 |

---

## 共识与分歧

### 共识 (3/3 agent一致)
- DataZoom/标签优化是最高ROI的前端改进
- 查询构建器应分阶段(先AIQuery增强，再拖拽编辑器)
- 移动端需要两层递进(WebView MVP → 原生ECharts)

### 分歧 (已解决)
| 分歧 | 分析员 | 评论员 | 最终判决 |
|------|--------|--------|---------|
| echarts.connect vs dispatchAction | 组合使用 | connect有bug，是架构退步 | **强化dispatchAction** |
| 移动端优先级 | 后期(P3) | 应提前(P1-P2) | **P1 WebView MVP** |
| 近零值处理 | 与A同步 | 条件实施 | **条件实施(统计频率后决定)** |
| 前置组件重构 | 未提及 | 关键阻断项 | **P0前置** |

---

## 关键风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| DataZoom拦截drill-down点击 | 高 | 高 | 用params.name替代dataIndex；drill-down时DataZoom readonly |
| echarts.connect与dispatchAction冲突 | 高 | 中 | 不引入connect，强化已有方案 |
| SmartBIAnalysis.vue超5000行HMR失效 | 中 | 高 | P0组件拆分 |
| @wuba/react-native-echarts Hermes兼容性 | 中 | 高 | 先WebView MVP；Hermes spike测试 |
| 查询构建器SQL注入 | 高(若不防范) | 高 | 参数化查询+allowlist字段+schema权限 |

---

## 立即执行项 (本周)

1. **确认SmartBIAnalysis.vue行数**: `wc -l SmartBIAnalysis.vue`
2. **DataZoom+drill-down冲突测试**: 2-3小时
3. **近零值频率统计**: 11张表中有多少chart受影响
4. **echarts.connect bug验证**: 检查项目ECharts版本vs GitHub Issue #20081

---

## 技术方案详情

### A: DataZoom + 标签自适应
- 整合已有3个组件(TrendChart/CombinedChart/YoYMoM)的DataZoom到`enhanceChartOption()`
- X轴: `interval`自适应(containerWidth/avgCharWidth) + `rotate:45` + `formatter`截断
- DataZoom: `slider+inside`双模式, 初始显示25-30%, `sampling:'min-max'`
- ECharts 5.5+: `labelLayout.hideOverlap`, `moveOverlap:'shiftY'`

### B: 图表联动(修正方案)
- **不引入**echarts.connect
- 强化已有dispatchAction: hover→highlight + click→filter + DataZoom交互协议
- 添加throttle(100ms)限制tooltip更新频率

### C: 近零值处理(条件)
- 数据变换+formatter还原(推荐): 保持线性刻度清晰度
- 仅当max/min比>100且存在非零近零值时激活
- 不使用对数刻度(理解成本高，log(0)问题)

### D: 查询构建器(分阶段)
- Phase 1: AIQuery增强(3天) — 自然语言→SQL字段映射
- Phase 2: vue-query-builder拖拽编辑器(5-8天) — 条件执行

### E: 移动端BI(两层递进)
- Phase 1: WebView MVP(1-2天) — 复用Web端SmartBI页面
- Phase 2: react-native-echarts迁移(8-12天) — 条件执行，需Hermes验证

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (ECharts优化 / 查询构建器 / 移动端BI)
- Total sources found: 49+
- Key disagreements: 4 resolved, 2 pending verification
- Phases completed: Research → Analysis → Critique → Integration
