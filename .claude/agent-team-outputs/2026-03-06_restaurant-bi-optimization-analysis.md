# 餐饮 BI 模块全面优化机会分析

**日期**: 2026-03-06
**模式**: Full (3 Researcher + Browser Explorer + Analyst + Critic + Integrator)
**研究员**: 后端智能化代码审查 / 前端 UI/UX 代码审查 / 竞品 BI 对比 / 浏览器实操验证

---

## 执行摘要

Critic 验证推翻了 Analyst 报告中 3 项关键结论（B1/B5/A3），经代码复核确认 Critic 正确。实际有效优化项从 16 降至 11 项。最高优先级是浏览器实测确认的两个 P0 缺陷 — SalesAnalysis 数据源下拉未去重 + 菜品表格 655 行无分页。最大后端差距是子行业检测阈值=1 无置信度 + store_count 未驱动自适应策略。SmartBI 是附加模块非核心产品，与 Toast/美团等专业商业产品对标需务实定位。

**总评: B+** — 工程基础扎实（dispose/导出/时序基础设施已有），但餐饮专属智能化不足。

---

## 共识与分歧解决

| 议题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|---------|
| B1: ECharts 未 dispose | 4个文件无 onBeforeUnmount | P0 Sprint 1 | **全部文件已有 dispose** | **B1 无效** — Critic 正确 |
| B5: 无导出功能 | export 搜索=0 | Sprint 2 (3天) | SmartBI 已有 Excel/PDF/PNG/SVG | **范围缩小** — 仅 Finance/Production 缺少 |
| A3: 无时间维度分析 | 无趋势/同环比 | Next Quarter (20天) | yoy.py + forecast_service.py 已有 | **范围修正** — 通用时序成熟，缺餐饮专属季节性 |
| B6: 响应式缺失 | 3/4页面无 @media | Sprint 1 | 未挑战 | **B6 无效** — 代码验证全部页面有 @media |
| A1: 子行业阈值=1 | 缺乏置信度 | Sprint 2 | 风险过度，有两阶段算法 | **部分有效** — 两阶段有保护但 >=1 仍偏低 |
| B2: 数据加载重复 | 150行重复 | Sprint 1 | 未挑战 | **确认有效** — 且 Sales 缺去重导致 P0 bug |
| 数据源下拉重复 | Browser 发现 | 未纳入 | P0 实测缺陷 | **确认 P0** — 根因: SalesAnalysis.vue 缺 deduplicateUploads |
| 竞品对标定位 | 7 竞品 1:1 对比 | 逐项对标 | 附加模块 vs 专业产品不公平 | **采纳 Critic** — 应聚焦可复用基础设施 |

---

## 修正后的优先级矩阵

### A) 后端智能化

| 优先级 | 项目 | 文件 | 工作量 | 置信度 |
|--------|------|------|--------|--------|
| **P1** | A5: fillna(0) 增加数据质量告警 | `restaurant_analyzer.py:131` | 0.5天 | 95% |
| **P1** | A2: store_count 驱动自适应分析策略 | `food_context_bridge.py` + `insight_generator.py` | 1天 | 90% |
| **P2** | A1: 子行业检测阈值 >=2 + 置信度评分 | `food_industry_detector.py:277` | 1天 | 85% |
| **P3** | A4: 异常检测自适应基线 | `insight_generator.py:1267` + `restaurant_analyzer.py:295` | 4天 | 75% |
| **长期** | 餐饮专属季节性分析 (复用 yoy.py/forecast_service.py) | `restaurant_analyzer.py` 新增方法 | 5-8天 | 80% |
| **长期** | 客群分层/复购 (依赖会员ID字段可用性) | 新增模块 | 5天 | 60% |

### B) 前端 UI/UX

| 优先级 | 项目 | 文件 | 工作量 | 置信度 |
|--------|------|------|--------|--------|
| **P0** | 数据源下拉去重 | `SalesAnalysis.vue:225` 添加 deduplicateUploads() | 15分钟 | 99% |
| **P0** | 菜品表格 655 行无分页 | 添加 el-pagination 或虚拟滚动 | 2小时 | 95% |
| **P1** | B2: loadDataSources 提取为 composable | 新建 `useDataSources.ts` | 0.5天 | 95% |
| **P1** | B3: catch 块添加 ElMessage.error | 多处 catch 块 | 0.5天 | 90% |
| **P2** | Finance/Production 补充导出 (复用现有代码) | `FinanceAnalysis.vue` + `ProductionAnalysis.vue` | 0.5天 | 95% |
| **P2** | "需人工"检查项添加操作入口 | dianping-gap 相关组件 | 1天 | 80% |
| **P3** | 移动端门店对比柱状图标签重叠 | ECharts axisLabel 配置 | 0.5天 | 85% |
| **低** | document.getElementById → ref (动态场景部分合理) | 仅静态 DOM 引用 | 低优先级 | 70% |

---

## 竞品对标差距 (务实定位)

| 能力维度 | 当前系统 | 竞品最高水平 | 差距 | 是否值得追赶 |
|----------|---------|-------------|------|-------------|
| 菜品四象限 | 有 (品均收入/销量) | Lightspeed Magic Menu (毛利/复购) | 中等 | 是 — 长期引入成本数据 |
| 门店对比 | 有 (营收单维度) | 客如云 (多维+异常拆解) | 大 | 是 — A2 store_count 自适应 |
| 平台准入评估 | 有 (9项检查) | **无直接竞品** | **领先** | 深化差异化优势 |
| 时间趋势 | 通用模块有 (yoy.py) | 哗啦啦 (每日微信推送) | 中等 | 是 — 餐饮专属季节性 |
| AI 对话 | SmartBI 模块有 (AIQuery SSE) | Toast IQ (自然语言+操作) | 中等 | 可复用 — 注入餐饮 prompt |
| 导出/分享 | SmartBI 主页有 | 所有竞品均支持 | 小 (2页面缺) | 是 — 0.5天复用 |
| 品类集中度 | 有 (Phase C HHI) | 哗啦啦 ABC 九宫格 | 小 | 已领先 |
| 客群/复购 | 无 | 二维火 RFM 模型 | 大 | 视数据可用性 |
| 食品溯源联动 | **独有** (批次/质检/供应链) | 无竞品有此能力 | **独有优势** | 深化 — 这是护城河 |

---

## 实施路线图

### Sprint 1 (本周, ~2天) — P0 修复 + 快速提升

| 任务 | 类型 | 工作量 |
|------|------|--------|
| SalesAnalysis 下拉去重 | 前端 | 15分钟 |
| 菜品表格分页/虚拟滚动 | 前端 | 2小时 |
| A5: fillna(0) 数据质量告警 | 后端 | 0.5天 |
| B2: loadDataSources 提取 composable | 前端 | 0.5天 |
| B3: catch 块用户错误反馈 | 前端 | 0.5天 |

### Sprint 2 (下周, ~3天) — 后端智能化

| 任务 | 类型 | 工作量 |
|------|------|--------|
| A2: store_count 自适应策略 | 后端 | 1天 |
| A1: 子行业检测置信度 >=2 | 后端 | 1天 |
| Finance/Production 导出补全 | 前端 | 0.5天 |
| "需人工"检查项操作入口 | 前端 | 0.5天 |

### 下季度 (~10天) — 餐饮专属能力

| 任务 | 依赖 | 工作量 |
|------|------|--------|
| 餐饮专属季节性分析 | 数据含日期字段 | 5天 |
| 门店多维对比 (客单价/品效) | A2 完成后 | 3天 |
| 异常检测自适应基线 | 历史数据积累 | 2天 |

### 长期 — 差异化竞争力

- AI 对话式餐饮分析 (复用 AIQuery SSE + 餐饮 prompt)
- 食品溯源联动分析 (从田间到餐桌的独有维度)
- 采购-销售关联 → 真实毛利四象限
- 每日经营简报推送

---

## 开放问题

1. **菜品表格 655 行**: 需定位具体是哪个组件/页面的数据预览 tab
2. **"需人工"检查项**: 预期交互是什么？确认/标记已验证？
3. **store_count 自适应**: 单店 vs 连锁的分析维度差异需产品确认
4. **历史数据积累**: smart_bi_analysis_cache 表数据量是否支持动态基线？
5. **竞品对标定位**: SmartBI 定位为附加模块还是独立产品？决定投入力度

---

## 置信度评级

| 评估项 | 置信度 | 依据 |
|--------|--------|------|
| P0 下拉重复根因 | 99% | 浏览器实测 + 代码定位 |
| B1/B5/B6 无效判定 | 99% | Critic 验证 + 代码二次确认 |
| A2 store_count 快速提升价值 | 90% | 代码确认 + 竞品佐证 |
| 餐饮专属季节性缺失 | 80% | grep restaurant+seasonal=0 |
| 竞品对标需定位调整 | 75% | Critic 逻辑合理但仅单方论证 |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (后端智能化 / 前端 UI/UX / 竞品 BI)
- Browser explorer: ON (4 pages visited — overview/menu/stores/dianping)
- Total sources found: 25+
- Key disagreements: 4 resolved (B1 dispose / B5 export / A3 time series / B6 responsive — 全部采纳 Critic 修正)
- Phases completed: Research (parallel) + Browser → Analysis → Critique → Integration → Heal
- Fact-check: disabled (internal analysis)
- Healer: All checks passed
- Competitor profiles: 7 competitors analyzed (Toast/美团/客如云/哗啦啦/二维火/Lightspeed/奥琦玮)

### Healer Notes: All checks passed
- Structural completeness: All sections present
- Cross-reference integrity: Critic corrections properly integrated, B1/B5/B6 removed
- Confidence consistency: Integrator aligned with Critic's revised levels
- Actionable recommendations: Each has concrete file paths and time estimates
- Browser evidence integration: P0 dropdown traced to SalesAnalysis.vue:225
