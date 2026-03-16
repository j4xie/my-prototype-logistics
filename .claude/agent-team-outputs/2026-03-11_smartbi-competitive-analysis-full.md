# SmartBI Financial Dashboard -- 竞品分析报告

**日期**: 2026-03-11
**范围**: SmartBI vs 7大BI平台 (FineBI, Metabase, Superset, Ant Design Charts, Grafana, Power BI, Tableau)

---

## 一、总览对比矩阵

| 维度 | SmartBI (我们) | FineBI | Metabase | Superset | Ant Design Charts | Grafana | Power BI | Tableau |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **图表库** | ECharts | 自研 | 自研(轻量) | ECharts | AntV G2 | 自研(uPlot) | 自研 | 自研 |
| **图表类型数** | **26** | 60+ | ~15 | 40+ | 50+ | ~20 | 40+(+市场) | 30+(+扩展) |
| **AI 自动分析** | 有 | 有 | 有(Metabot) | 社区插件 | 无 | ML插件 | Copilot | Agent+Pulse |
| **自然语言查询** | 无 | 有(98.7%) | 有(NL2SQL) | 社区方案 | 无 | 有(Assistant) | 有(Copilot) | 有(Agent) |
| **拖拽布局** | 无 | 有 | 有 | 有 | N/A(组件库) | 有 | 有 | 有 |
| **全局筛选** | 有(Slicer) | 有 | 有 | 有 | N/A | 有(变量) | 有(Slicer) | 有(Filter) |
| **导出** | PPT/PDF/Excel | PDF/Excel | PDF/CSV | PDF/CSV | N/A | PDF/PNG | PDF/PPT/Excel | PDF/PPT/Excel |
| **分享/嵌入** | 链接分享 | 部署后分享 | 嵌入SDK | 嵌入iframe | N/A | iframe/嵌入 | 嵌入/Teams | 嵌入/Server |
| **开源** | 否(内部) | 否(商业) | 是(AGPL) | 是(Apache) | 是(MIT) | 是(AGPL) | 否(商业) | 否(商业) |
| **价格** | 内部 | ~15万/年起 | 免费/Pro$85/人/月 | 免费 | 免费 | 免费/Cloud付费 | $10/人/月起 | $75/人/月起 |

---

## 二、逐竞品详细分析

### 1. 帆软 FineBI

| 对比维度 | FineBI | SmartBI (我们) | 差距 |
|----------|--------|--------------|------|
| **图表渲染引擎** | 自研引擎, 60+ 图表, 支持 3D 场景 | ECharts, 26 种图表 | 我们劣势: 图表数量少, 无 3D |
| **大数据性能** | Spider 引擎, 亿级数据秒级响应 | ECharts Canvas, 万级 OK | 我们劣势: 缺乏大数据加速引擎 |
| **仪表盘布局** | 网格+自由布局, 拖拽, 浮动组件 | 固定布局 | 我们劣势: 无拖拽 |
| **AI 分析** | 自然语言 98.7% 准确率, 10 轮对话, Text2DSL+NL2SQL 双引擎 | AI 文本洞察(每图表下方) | 我们劣势: 无自然语言查询 |
| **导出** | PDF, Excel | PPT, PDF, Excel | **我们优势**: PPT 导出 |
| **数据接入** | 30+ 数据源, 实时/抽取 | Excel 上传 | 我们劣势: 数据源单一 |
| **自动图表生成** | 需手动选择图表类型 | **全自动**: 上传 Excel 即自动推荐+生成 | **我们核心优势** |

### 2. Metabase (开源)

| 对比维度 | Metabase | SmartBI (我们) | 差距 |
|----------|----------|--------------|------|
| **图表渲染** | 自研轻量引擎, ~15 种图表 | ECharts, 26 种 | **我们优势**: 图表更丰富 |
| **AI 功能** | Metabot: NL2SQL, 图表解读, SQL修复 | AI 自动分析文本 | 各有侧重 |
| **仪表盘** | 拖拽网格, 自动筛选 | 固定布局 + Slicer | 我们劣势: 无拖拽 |
| **导出** | PDF, CSV | PPT, PDF, Excel | **我们优势** |
| **高级图表** | 缺 treemap, boxplot, parallel 等 | 有 sankey, treemap, bullet, parallel 等 | **我们优势** |

### 3. Apache Superset (开源)

| 对比维度 | Superset | SmartBI (我们) | 差距 |
|----------|----------|--------------|------|
| **图表渲染** | ECharts (同库), 40+ 图表 | ECharts, 26 种 | 同引擎, 我们图表种类少 |
| **AI 功能** | 社区方案, SIP 提案阶段 | 内置 AI 自动分析 | **我们优势**: AI 内置且已上线 |
| **导出** | PDF (丢失交互) | PPT, PDF, Excel | **我们优势** |
| **SSE 流式** | 无 | **有** (实时进度) | **我们优势** |
| **部署** | 重量级(Python + Redis + Celery) | 轻量(集成在现有后端) | **我们优势** |

### 4. Ant Design Charts / AntV G2

- **定位**: 组件库(非完整 BI 平台), 不构成直接竞争
- 图表种类 50+ (G2 底层极其丰富), 但无 AI、无数据流程
- G2 引擎的声明式 spec 语法值得参考

### 5. Grafana

- **定位**: 监控/可观测性, 非业务分析直接竞品
- ML 插件(异常检测, 预测)值得借鉴
- 我们在业务图表丰富度上优于 Grafana (~20 种面板)

### 6. Power BI (微软)

| 对比维度 | Power BI | SmartBI (我们) | 差距 |
|----------|----------|--------------|------|
| **AI Copilot** | 自然语言建图, 异常检测, 智能叙述 | AI 文本洞察 | 我们劣势: AI 功能差距大 |
| **仪表盘** | 拖拽, Slicer, 交叉筛选, 钻取 | Slicer 筛选 | 我们劣势 |
| **自动化程度** | 需手动建模 + 选图表 | **全自动**: 上传即出 | **我们核心优势** |
| **价格** | $10/人/月起 | 内部/免费 | **我们优势** |
| **垂直行业** | 通用 | 食品行业基准 | **我们优势** |

### 7. Tableau (Salesforce)

| 对比维度 | Tableau | SmartBI (我们) | 差距 |
|----------|---------|--------------|------|
| **AI 功能** | Agent(对话建图), Pulse(指标预警), 预测, 异常检测, 聚类 | AI 文本洞察 | 我们劣势 |
| **自动化程度** | 需手动拖拽探索 | **全自动** | **我们优势** |
| **价格** | $75/人/月起 | 内部/免费 | **我们优势** |

---

## 三、核心优劣势总结

### 核心优势 (护城河)

| # | 优势 | 说明 |
|---|------|------|
| 1 | **全自动分析流程** | Excel 上传 -> 自动解析 -> 自动生成 KPI + 图表 + AI 洞察, 零操作 |
| 2 | **AI 洞察内置** | 每张图表下方自动生成分析文本 |
| 3 | **PPT 导出** | FineBI/Metabase/Superset/Grafana 均不支持 |
| 4 | **食品行业基准** | 火锅/餐饮/食品加工垂直基准数据 |
| 5 | **SSE 流式体验** | 实时进度反馈 |
| 6 | **轻量部署** | 无需独立 BI 服务器 |

### 核心劣势 (改进方向)

| # | 劣势 | 竞品标杆 | 影响 |
|---|------|---------|------|
| 1 | 无拖拽仪表盘 | 所有竞品 | 高 |
| 2 | 无自然语言查询 | FineBI, Power BI, Tableau | 高 |
| 3 | 图表类型偏少(26) | FineBI(60+), Superset(40+) | 中 |
| 4 | 无图表联动/交叉筛选 | Power BI, Tableau, Superset | 中 |
| 5 | 数据源仅 Excel | 所有竞品 | 中 |
| 6 | 无异常检测/预测 | Power BI, Tableau, Grafana | 中 |

---

## 四、改进路线图

### P0 — 必做 (~4周)
1. **拖拽仪表盘布局** — vue-grid-layout, ~2周
2. **图表联动/交叉筛选** — ECharts connect() + Pinia, ~1周
3. **自然语言查询 MVP** — 通义千问 NL2SQL, ~3周

### P1 — 重要 (~4周)
4. **扩展图表类型至 35+** — ECharts 原生, ~1-2周
5. **异常检测 + 预测分析** — scipy + statsmodels, ~2周
6. **主题/配色系统** — ECharts registerTheme, ~1周
7. **数据库直连** — SQLAlchemy, ~3周

### P2 — 锦上添花 (按需)
8. 嵌入 SDK / iframe 分享 (~3天)
9. 仪表盘订阅/定时推送 (~1周)
10. 移动端适配 (~1-2周)
11. 图表注释/批注 (~1周)
12. 数据故事/演示模式 (~2周)

---

## Sources
- FineBI 官网, 帮助文档, 2026 AI 趋势
- Metabase 可视化文档, Metabot AI, 嵌入 SDK
- Apache Superset ECharts 集成, SIP-166 AI Assistant
- Ant Design Charts Gallery, AntV G2
- Grafana 面板文档, ML 插件, LLM 插件
- Power BI 2026年1-2月更新, Copilot 文档
- Tableau Agent, Pulse, Viz Extensions
