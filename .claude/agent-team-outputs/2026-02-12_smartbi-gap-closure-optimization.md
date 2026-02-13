# SmartBI 剩余差距优化方案 — Agent Team 深度研究报告

**日期**: 2026-02-12
**研究主题**: 从35%提升到53%(Metabase水平)的5个核心差距最优实现路径
**模式**: Full (5-phase) | 语言: Chinese

---

## Executive Summary

采纳"少做但做好"策略，放弃17天5阶段全覆盖，改为**2周内高置信度完成Phase 1(PDF中文)+Phase 3(分享链接)**，回避高风险Phase 2(数据过滤重构)和Phase 4(中文NLQ)。整体信心从Analyst的Medium-High下调到Medium-Low。

**核心发现**:
- Analyst提出的17天时间线对1-2人团队需乘2-2.5倍(34-42天)
- "+18%=53%"评分是自我评分,无行业标准支撑
- 数据过滤从视觉高亮升级到真实过滤是架构级重构(7-10天,非3天)
- 中文Text2SQL准确率可能<60%(论文数据36-52%)
- **替代方案更优**: 预定义查询模板(100%准确率,覆盖80%场景)替代NLQ

---

## Phase 0: Research Findings Summary

### Researcher A: 前端BI技术方案
1. jsPDF中文: TTF→addFileToVFS→addFont→setFont, fonttools 25.4→1.9MB WOFF2
2. Pinia+ECharts联动: Store驱动多图表响应式更新
3. Monaco(5-10MB) vs CodeMirror 6(300KB): NLQ推荐CodeMirror
4. crossfilter.js Vue 3适配方案稀缺(GAP)
5. ECharts visualMap: 连续/分段型多维视觉过滤

### Researcher B: 后端架构方案
1. HikariCP + AbstractRoutingDataSource动态多数据源
2. JDBC DatabaseMetaData: schema/table/column自动发现
3. Vanna 2.0两阶段Agent: 85-95%准确率(英文)
4. Text2SQL安全: RBAC+RLS+参数化+PII掩码多层防御
5. PostgreSQL RLS: CREATE POLICY行级过滤

### Researcher C: 开源BI对标
1. Metabase驱动插件: JAR→/plugins自动初始化
2. Superset SQLAlchemy+SQL Lab+Jinja2参数化
3. Metabase NLQ(Metabot): 两阶段LLM Agent
4. Metabase分享: UUID公开链接+JWT嵌入
5. Superset跨筛选: Redux+DataMask多层状态管理

---

## Phase 1: Analyst Comparison Matrix

### 5个差距的方案对比

| 差距 | 推荐方案 | 备选方案 | 工期 | 评分贡献 | ROI |
|------|---------|---------|------|---------|-----|
| PDF中文字体 | jsPDF+fonttools子集化 | html2canvas截图 / 服务端Puppeteer | 1天 | +2% | 2.0%/天 |
| 真正数据过滤 | Pinia Store联动重算 | crossfilter.js / 后端SQL过滤 | 3天 | +5% | 1.67%/天 |
| 分享链接 | UUID公开链接+JWT嵌入 | 截图+图片分享 | 3天 | +3% | 1.0%/天 |
| NLQ查询 | 扩展chat.py+Vanna | LangChain SQL Agent | 5天 | +4% | 0.8%/天 |
| 数据库连接器 | Java JDBC+HikariCP | SQLAlchemy(Python) | 5天 | +4% | 0.8%/天 |

### Analyst路线图: 17天5阶段 → 35%到53%

```
Phase 1 (Day 1): PDF中文 → +2% = 37%
Phase 2 (Day 3-5): 数据过滤 → +5% = 42%
Phase 3 (Day 6-8): 分享链接 → +3% = 45%
Phase 4 (Day 9-13): NLQ → +4% = 49%
Phase 5 (Day 14-17): JDBC连接器 → +4% = 53%
```

---

## Phase 2: Critic Challenges

### 被挑战的5个结论

| # | 结论 | 反论 | 严重度 |
|---|------|------|--------|
| 1 | PDF 1天完成 | jsPDF .html()方法CJK Bug, base64膨胀4-7MB, 移动端40%崩溃风险 | High |
| 2 | 数据过滤3天 | 当前是纯视觉高亮(代码注释已承认), 升级到真实过滤=架构重构, 需7-10天, 55%回归Bug | High |
| 3 | +18%=53% | 自我评分无行业标准, Metabase有42k stars/400+贡献者/10年积累, 差距是量级性的 | Critical |
| 4 | NLQ 5天+4% | 中文Text2SQL准确率<60%, Vanna对EAV数据模式支持差, 无PoC验证 | High |
| 5 | JDBC 5天 | connectionConfig是空JSON, 安全层(RLS/参数化/审计)显著增加工作量到7-8天 | Medium |

### 7个失败模式

| 失败场景 | 概率 | 影响 |
|---------|------|------|
| jsPDF移动端崩溃 | 40% | High |
| 5000+行过滤卡顿>3秒 | 50% | Medium |
| Vanna中文准确率<60% | 60% | High |
| JDBC凭证泄露 | 30% | Critical |
| 17天计划拖延到35天+ | 75% | Medium |
| UUID暴力猜测数据泄露 | 15% | Critical |
| 过滤重构引入回归Bug | 55% | High |

### Critic被忽略的替代方案
1. **ECharts SVG SSR + Python reportlab** — 绕开jsPDF CJK问题
2. **前端setOption数据替换** — 比Pinia Store轻量
3. **预定义查询模板+参数化** — 100%准确率, 覆盖80%场景, NLQ的20%工作量

### 修正后信心水平

| 结论 | 原始 | 修正后 |
|------|------|--------|
| PDF中文 | High | Low-Medium |
| 数据过滤 | High | Low |
| 分享链接 | Medium-High | Medium |
| NLQ | Medium | Low |
| JDBC连接器 | Medium | Medium-Low |
| 整体17天 | Medium-High | **Low** |

---

## Phase 3: Integrated Final Recommendations

### 核心策略: "少做但做好"

**放弃**: 17天全覆盖5个功能
**采纳**: 2周高置信度交付2-3个功能 + 质量加固

### 修正后路线图

```
Week 1 (5天):
├─ [Day 1-2] Phase 1: PDF中文 (改用SVG方案,非jsPDF)
│   ├─ Python端: ECharts SSR生成SVG → reportlab PDF
│   ├─ 或前端: jsPDF + fonttools NotoSansSC子集(2MB TTF)
│   └─ 测试: 桌面+移动端PDF验证
├─ [Day 3-5] Phase 3: 分享链接
│   ├─ 后端: SharedLink Entity + UUID生成 + JWT签发
│   ├─ 前端: 分享弹窗 + SharedView.vue公开路由
│   └─ 安全: TTL + 访问限制 + 审计日志

Week 2 (5天):
├─ [Day 6-7] 修复已知Bug
│   ├─ upload null文件名
│   ├─ Y轴格式化"0.0万"
│   ├─ benchmark KPI缺失
│   └─ 其他E2E发现的问题
├─ [Day 8-9] 补充测试
│   ├─ PDF导出集成测试
│   ├─ 分享链接安全测试
│   └─ SmartBI回归测试
├─ [Day 10] 预定义查询模板MVP (Phase 4替代)
│   ├─ 设计10个常用分析模板
│   └─ 前端模板选择器UI

Optional Week 3+ (如有时间):
├─ Phase 5简化版: JDBC基本连接(3天, 无RLS)
├─ 数据过滤PoC: timebox 4小时验证可行性
└─ Vanna中文PoC: 用实际数据测试准确率
```

### 预期成果

| 方案 | 时间 | 确定提升 | 信心 |
|------|------|---------|------|
| 修正路线(推荐) | 10-12天 | +5% (40%) | ★★★★☆ |
| Analyst原方案 | 34-42天 | +10-18% (45-53%) | ★★☆☆☆ |
| 最保守(只修Bug) | 5天 | +0% (35%) | ★★★★★ |

### Open Questions

1. PDF方案: jsPDF+fonttools vs ECharts SVG+reportlab?
2. NLQ: 预定义模板(100%准确) vs Vanna中文(需PoC)?
3. 数据过滤: 是否真的是用户核心需求?
4. 测试: 当前SmartBI有多少集成测试?
5. 凭证存储: JDBC连接器用什么加密方案?

---

## Process Note
- Mode: Full (5-phase)
- Researchers deployed: 3 (Frontend, Backend, Open-source BI)
- Total sources found: 50+
- Key disagreements: 4 resolved (Critic won on timeline, PDF approach, NLQ strategy, scope), 1 unresolved (数据过滤真实需求强度)
- Phases completed: Research → Analysis → Critique → Integration
