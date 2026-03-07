# SmartBI 图表分析与行业标杆对比评估

**日期**: 2026-03-05
**模式**: Full | Language: Chinese | Grounding: ENABLED | Browser: ENABLED | Competitor: ON

---

## 执行摘要

SmartBI 图表系统综合得分 **6.1-6.3/10 (B+级)**，在开源 BI 产品中具有竞争力（超越 Metabase 5.6，接近 Grafana 6.4），但落后于商业标杆 Power BI (8.5) 和 FineBI (7.4)。**AI 洞察 + 行业基准对标**是独特差异化优势，Power BI/Superset/FineBI 均无内置 LLM 驱动分析。最大短板集中在无障碍合规 (3.0/10) 和双色板不一致。基础修复约 2-3 人日，完整优化需 8-12 人日。

---

## 十维评分矩阵

| 维度 (权重) | SmartBI | Metabase | Superset | Grafana | Power BI | FineBI |
|---|---|---|---|---|---|---|
| **配色质量** (8%) | **5.0** | 5.0 | 6.5 | 5.5 | 9.0 | 7.0 |
| **字体排版** (8%) | **6.5** | 6.0 | 6.0 | 5.5 | 8.0 | 7.5 |
| **间距布局** (10%) | **6.5** | 6.5 | 7.5 | 8.0 | 8.5 | 7.5 |
| **图表类型** (12%) | **6.5** | 4.5 | 8.0 | 5.5 | 8.5 | 9.0 |
| **响应式** (10%) | **5.5** | 6.0 | 6.5 | 7.5 | 8.0 | 7.0 |
| **动画效果** (5%) | **6.0** | 4.0 | 5.5 | 4.0 | 7.0 | 6.5 |
| **可读性** (15%) | **7.0** | 6.0 | 7.0 | 6.5 | 8.5 | 7.5 |
| **交互体验** (15%) | **7.0** | 6.5 | 7.5 | 6.0 | 9.0 | 8.0 |
| **数据密度** (12%) | **7.0** | 5.5 | 7.0 | 7.5 | 8.5 | 7.5 |
| **无障碍** (5%) | **3.0** | 3.0 | 4.0 | 5.5 | 9.0 | 4.5 |
| **加权总分** | **6.1-6.3** | **5.6** | **6.9** | **6.4** | **8.5** | **7.4** |
| **等级** | **B+** | **B** | **A-** | **B+** | **S** | **A** |

---

## 共识与分歧映射

| 主题 | 全员共识/分歧 | 最终裁定 |
|------|-------------|---------|
| 图表类型数量 | **分歧→修正**: 分析师误标25种, 批评者纠正为24种 | **24种** (枚举确认), 部分可能仅枚举无完整实现 |
| 色板冲突 | **共识**: Python `config["color"]` 硬覆盖前端 theme | **确认严重**: Atlassian 主题被绕过, 是隐蔽技术债 |
| 动画评分 | **分歧**: 分析师7.5 vs 批评者6.0 | **采纳6.0**: 双builder并存, 新builder完全无动画配置 |
| 无障碍评分 | **分歧**: 分析师1.5 vs 批评者3.0 | **采纳3.0**: 已有基础ARIA语义层(Dashboard 6处aria-label) |
| 优化工作量 | **分歧**: 分析师3-5人日 vs 批评者8-12人日 | **采纳8-12人日**: 含双builder统一+暗色主题+无障碍 |
| tooltip毛玻璃 | **自相矛盾→澄清**: 分析师声称存在又说未找到 | **确认存在**: `echarts-theme.ts:59` 有 `backdrop-filter: blur(8px)` |
| AI洞察差异化 | **全员共识** | **核心卖点**: LLM推荐+行业基准对标, 商业/开源产品均无内置 |

---

## SmartBI 各维度详细评估

### 1. 配色质量 — 5.0/10

**现状**:
- 前端 `echarts-theme.ts` 注册 Atlassian 风格 10 色 (`#1B65A8` 起)
- Python `chart_builder.py` 使用 ECharts 默认色 (`#5470c6` 起) + 5 组渐变色 + 语义色
- Python `config["color"]` **硬覆盖**前端主题 → 前端色板形同虚设
- 无色盲安全模式、无 decal 纹理、无暗色主题

**标杆**: Power BI 32 色体系 + Accessible 主题 + JSON 主题文件 (9.0/10)

**差距**: 缺统一色板管理系统、缺无障碍色板、缺暗色模式

### 2. 字体排版 — 6.5/10

**现状**:
- Noto Sans SC + 系统字体回退链 (CJK 友好)
- 5 级层级: 标题 16px/600、副标题 13px、轴 12px、tooltip 13px、数据标签 11px
- KPI 数值 `font-variant-numeric: tabular-nums` (专业等宽数字)

**标杆**: Power BI Segoe UI 严格排版规范 (8.0/10)

**差距**: 缺 8pt 网格对齐、缺大屏/小屏字号自动梯度缩放

### 3. 间距布局 — 6.5/10

**现状**:
- ECharts grid: `left:3%, right:4%, bottom:3%, top:15%, containLabel:true`
- 卡片 padding 20px, gap 20px, border-radius 12px
- CSS containment (`contain: layout style paint`) + `content-visibility: auto` — **超越多数竞品的性能优化**
- 但图表高度固定 320/400px，不根据数据量动态调整

**标杆**: Grafana 24 列网格 + auto-grid v12 (8.0/10)

### 4. 图表类型 — 6.5/10

**现状**: 24 种 ChartType 枚举 — line/bar/pie/area/scatter/heatmap/waterfall/radar/funnel/gauge/treemap/sankey/combination/sunburst/pareto/bullet/dual_axis/matrix_heatmap/bar_horizontal/slope/donut/nested_donut/boxplot/parallel

**亮点**: LLM 自动推荐图表类型 + 行业基准对标 (独有)

**风险**: 部分类型可能仅有枚举无完整实现路径; 新旧 builder 并存增加不确定性

**标杆**: FineBI 50+ 种 (9.0/10), Power BI 40+ 内置 + 300+ AppSource (8.5/10)

### 5. 响应式 — 5.5/10

**现状**:
- SmartBIAnalysis: 3 档断点 (<=900px 单列, 默认双列, >=1400px 三列)
- resize 用 `requestAnimationFrame` 节流
- **缺 ResizeObserver**: 容器尺寸变化(如侧栏折叠)不触发重绘
- 浏览器实测 1280/768/375px 三档均无溢出

**标杆**: Power BI 自适应布局引擎 (8.0/10)

### 6. 动画效果 — 6.0/10

**现状**:
- 旧 `chart_builder.py` 有 6 种 easing 映射: bar elasticOut+80ms stagger, line cubicOut, pie expansion, scatter elasticOut+5ms stagger, waterfall cubicOut+60ms stagger, area cubicOut
- 前端 `ANIM_REGISTRY` 安全解析 `__ANIM__` 标记 (无 eval)
- **新 `chart/builder.py` 完全无动画配置** — 双 builder 并存是架构风险

**标杆**: Power BI Fluent Motion 体系 (7.0/10)

### 7. 可读性 — 7.0/10

**现状**:
- 饼图 Top-N 聚合 (>6 项→Top5+"其他")
- IQR 异常检测自动叠加 markPoint/markLine
- 数值单位自适应 (≥1亿→亿, ≥1万→万)
- X 轴 >4 字符 rotate 30° + 超 15 条 dataZoom slider
- markLine 均值参考线 + markPoint 最高/最低标记

**标杆**: Power BI 智能标签+缩放 (8.5/10)

### 8. 交互体验 — 7.0/10

**现状**:
- tooltip: 毛玻璃 blur(8px) + confine 防溢出 + box-shadow
- toolbox: saveAsImage (2x像素比) / dataZoom / restore
- legend: 超 5 项自动 scroll 模式
- dataZoom: 超 15 条自动 slider
- AI 对话式查询 (SSE 流式) + 跨 sheet 分析
- **缺**: 多图联动高亮 (connect)、框选 (brush)

**标杆**: Power BI 交叉高亮/筛选/钻取 (9.0/10)

### 9. 数据密度 — 7.0/10

**现状**:
- KPI 4 列含 sparkline 趋势线 + 同比箭头
- 图表 + AI 分析 + 行业基准面板组合 — 单屏信息丰富
- 财务负值自动红色预警 + 建议
- **缺**: sparkline 嵌入表格、层级钻取

**标杆**: Power BI 矩阵 + sparkline (8.5/10)

### 10. 无障碍 — 3.0/10

**现状**:
- Dashboard.vue 有 6 处 aria-label/aria-live/aria-busy 基础语义
- SmartBIAnalysis.vue 有 `aria-hidden="true"` 装饰标记
- **缺**: WCAG 对比度检查、decal 纹理、键盘导航、屏幕阅读器、暗色主题

**标杆**: Power BI WCAG 2.1 AA 完全合规 (9.0/10)

---

## SmartBI 独有优势 (竞品不具备)

| 能力 | SmartBI | Metabase | Superset | Grafana | Power BI | FineBI |
|------|---------|----------|----------|---------|----------|--------|
| LLM 图表类型推荐 | **有** | 无 | 无 | 无 | 无 | 部分(规则) |
| AI 行业基准对标 | **有**(食品/餐饮) | 无 | 无 | 无 | 无 | 无 |
| SSE 流式 AI 洞察 | **有** | 无 | 无 | 无 | 无 | 无 |
| 餐饮子行业检测 | **有**(火锅/快餐/鱼类) | 无 | 无 | 无 | 无 | 无 |
| 异常 IQR 自动叠加 | **有** | 无 | 无 | 无 | 无 | 无 |

---

## 已发现 Bug

| 优先级 | 问题 | 页面 | 影响 |
|--------|------|------|------|
| **P1** | 销售分析页数据源显示"null" + 8条API错误 | `/smart-bi/sales` | 功能不可用 |
| **P2** | 英文未汉化"No numeric measures detected" | `/smart-bi/dashboard` | 体验不一致 |

---

## 优先级行动计划

### Immediate (立即, 1-2天)

1. **修复销售页 bug**: 数据源显示"null"和8条API错误 — 影响演示
2. **汉化英文文案**: "No numeric measures detected" → "未检测到数值型字段"
3. **统一色板**: Python `chart_builder.py` 引用前端 Atlassian 色板常量, 移除 ECharts 默认色硬编码

### Short-term (本周, 3-5天)

4. **添加 ResizeObserver**: 替换 `window.addEventListener('resize')`, 确保容器 resize 触发 chart.resize() — 约0.5天
5. **确认双 builder 路径**: 梳理旧 `chart_builder.py` vs 新 `chart/builder.py` 调用链, 决定废弃或迁移动画 — 约1天
6. **验证图表类型实现**: 24种枚举中标记哪些有完整 build 方法, 哪些仅声明

### Conditional (按需, 5-8天)

7. **暗色主题**: CSS 变量 + Python dark 色板 — 仅明确需求时投入 (3-5天)
8. **WCAG AA 合规**: 对比度 >=4.5:1 + decal 纹理 + 键盘导航 — 仅政府/国企客户要求时 (5-8天)
9. **多图联动**: ECharts connect 实现交叉高亮 — 仅复杂仪表板场景需要 (2-3天)

---

## 置信度评估

| 结论 | 置信度 | 依据 |
|------|--------|------|
| 24种图表类型, 核心7种渲染正常 | ★★★★★ | 代码枚举 + 浏览器实测一致 |
| 双色板冲突确认存在 | ★★★★★ | 3方 Agent 一致确认 |
| AI洞察+行业基准是核心差异化 | ★★★★★ | 全员共识 + 浏览器实测 |
| 综合评分 6.1-6.3/10 (B+) | ★★★★☆ | 分析师/批评者微调分歧 |
| tooltip毛玻璃blur(8px)存在 | ★★★★★ | echarts-theme.ts:59 代码确认 |
| 完整优化需 8-12 人日 | ★★★☆☆ | 仅经验估算, 含暗色主题+无障碍 |

---

## 开放问题

1. 新旧 builder 的实际调用比例? 哪些场景走旧 chart_builder.py、哪些走新 chart/builder.py?
2. 24种图表中哪些从未被 LLM 推荐或用户触发过?
3. 销售分析页 8 条 API 错误的根因?
4. 是否有暗色主题的实际用户需求?
5. 后端 `spring.data.web.pageable.max-page-size` 是否已自定义?

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (代码实现 + 行业标杆 + 评分框架)
- Browser explorer: ON (7个页面, 11张截图)
- Total sources: 代码审查(echarts-theme.ts, chart_builder.py, SmartBIAnalysis.vue等 ~12文件) + 5款竞品 + 20+权威参考
- Key disagreements: 3 resolved (图表数25→24, 无障碍1.5→3.0, 工作量3-5→8-12天), 1 unresolved (新旧builder主路径)
- Phases: Research (parallel ×4) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded)
- Healer: 5 checks passed, 0 auto-fixed
- Competitor profiles: 5 (Metabase, Superset, Grafana, Power BI, FineBI)
