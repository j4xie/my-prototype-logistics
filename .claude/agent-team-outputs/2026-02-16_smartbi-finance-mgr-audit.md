# SmartBI 财务经理视角全面审计报告

**日期**: 2026-02-16
**审计角色**: finance_mgr1 (财务主管, factoryId: F001)
**目标环境**: http://47.100.235.168:8088/ (生产环境)
**方法**: agent-browser 截图审计 + agent-team 多角色研究 + 代码静态分析

---

## 执行摘要

对 SmartBI 财务经理视角进行了 4 阶段全面审计，覆盖 6 个页面、15+ 关键文件、20+ 截图。发现 **3 个 P0 阻塞性问题**、**5 个 P1 高影响问题**、**7 个 P2 中等问题**。核心发现：

1. **安全漏洞**: 路由级权限未强制执行，finance_mgr1 可直接访问 /production/batches
2. **后端故障**: 应付分析和预算分析返回 502 Bad Gateway
3. **数据质量**: AI 使用假设数据而非真实上传数据，KPI 趋势被静默过滤
4. **UX 缺陷**: 只读用户看到"上传"按钮，空状态消息误导

---

## 第一部分: 截图审计发现

### 1.1 页面审计汇总

| 页面 | URL | 状态 | 数据覆盖 | 关键问题 |
|------|-----|------|---------|---------|
| 登录/首页 | /dashboard | PASS | 有数据 | KPI数据为圆整数(疑似mock) |
| 经营驾驶舱 | /smart-bi/dashboard | PARTIAL | 1/4 KPI有值 | AI洞察重复、空状态误导 |
| 财务分析 | /smart-bi/finance | PARTIAL | 利润/应收有数据 | 应付/预算502错误 |
| 销售分析 | /smart-bi/sales | FAIL | 全空 | 502错误、空状态误导 |
| AI问答 | /smart-bi/query | PASS | AI可响应 | 使用假设数据而非真实数据 |
| 查询模板管理 | /smart-bi/query-templates | PASS | 空(无模板) | 功能正常 |
| 智能数据分析 | /smart-bi/analysis | FAIL | 无历史数据 | 只读用户看到上传按钮 |

### 1.2 截图详细发现

#### P0-1: 路由权限旁路 (安全漏洞)
- **现象**: finance_mgr1 直接访问 `/production/batches`，页面正常渲染（生产批次列表表格完全可见）
- **根因**: permission.ts L88 `finance_manager: { production: 'r' }` 赋予了生产模块读权限
- **影响**: 财务角色可访问侧边栏不可见的所有 `production: 'r'` 路由
- **截图**: `08-permission-production.png`

#### P0-2: 应付/预算分析 502 后端错误
- **现象**: 切换到"应付分析"和"预算分析"时，顶部显示红色 toast "Request failed with status code 502"
- **控制台**: 多次 `502 Bad Gateway` 错误（FinanceAnalysis-BVITOwaf.js、SalesAnalysis-a-0Rrvsc.js）
- **影响**: 5种分析类型中2种完全不可用
- **截图**: `03e-finance-payable.png`, `03f-finance-budget.png`

#### P0-3: 只读用户看到上传控件
- **现象**: 智能数据分析页面对 `analytics: 'r'` 用户显示"等待上传"+"选择文件"按钮
- **根因**: SmartBIEmptyState.vue `type="no-upload"` 默认 `showAction=true`，即使传给只读用户
- **代码位置**: SmartBIAnalysis.vue L113, SmartBIEmptyState.vue L169-173
- **截图**: `07-analysis-top.png`

#### P1-1: AI 洞察重复显示
- **现象**: 经营驾驶舱 AI 智能洞察区域，同一条洞察出现2次（"目标完成率0.0%"、"销售额环比下降57.7%"各出现2遍）
- **影响**: 信息冗余，降低可信度
- **截图**: `02d-dashboard-insights.png`

#### P1-2: KPI 趋势箭头缺失
- **现象**: 经营驾驶舱 4 个 KPI 卡片均无趋势箭头、环比/同比变化率
- **对比**: Power BI/FineBI 标准 KPI 卡片包含 Value+Target+Trend 三要素
- **截图**: `02b-dashboard-top.png`

#### P1-3: 数值格式不一致
- **现象**: 区域销售分布 — 华东显示"1.9万"，华北显示"8,170"（同一图表混用两种格式）
- **截图**: `02b-dashboard-top.png`

#### P1-4: 空状态消息对只读用户误导
- **现象**: 多个页面(驾驶舱、销售分析)显示"请先上传Excel文件"，但 finance_mgr1 无上传权限
- **应该**: 显示"请联系管理员上传数据"或类似引导
- **截图**: `02c-dashboard-mid.png`, `04-sales-top.png`

#### P1-5: 预警跨Tab泄露
- **现象**: 应收分析标签页的预警提醒显示"毛利率偏低: 13.22%"，与应收账款无关
- **根因**: 预警组件未根据当前分析类型过滤
- **截图**: `03d-finance-receivable.png`

#### P2-1: AI 问答使用假设数据
- **现象**: 点击"毛利率分析"模板，AI 返回详细的分析报告，但数据全部是"假设示例数据"（冷冻预制菜12,500万、休闲烘焙9,800万等）
- **根因**: AI 未连接到实际上传的 Excel 数据源
- **截图**: `05b-aiquery-response.png`

#### P2-2: 财务分析图表全空
- **现象**: 利润分析的图表区域 Y 轴显示0-1（小数），无实际数据条/线
- **截图**: `03b-finance-top.png`

#### P2-3: KPI 缺失货币单位
- **现象**: 利润分析 KPI 显示"9,859.17"和"6,901.42"，无单位标识（元？万元？）
- **截图**: `03b-finance-top.png`

#### P2-4: 首页 KPI 数据疑似 Mock
- **现象**: 首页(/dashboard) KPI 显示精确的圆整数（125.0万、87.5万、37.5万、30.0%）
- **影响**: 难以判断是真实数据还是模拟数据

---

## 第二部分: 行业标杆对标

### 2.1 BI 工具功能对比矩阵

| 维度 | Tableau | Power BI | FineBI | 我们的SmartBI | 差距 |
|------|---------|---------|--------|-------------|------|
| KPI卡片设计 | ★★★★★ BAN+条件格式 | ★★★★★ Value+Target+Trend | ★★★★ 40+图表 | ★★☆ 仅数值+单位 | 缺趋势箭头/miniChart/基准对比 |
| 迷你图/Sparkline | ★★★★★ 原生 | ★★★★★ Power KPI Matrix | ★★★★ 支持 | ★★☆ 仅部分实现 | KPICard.vue有sparklineData但未广泛使用 |
| 钻取下钻 | ★★★★★ 多层交互 | ★★★★ Drillthrough | ★★★★ 支持 | ★★★☆ 单层下钻 | 缺多层级、缺面包屑返回 |
| 权限管理 | ★★★★ 工作簿级 | ★★★★★ RLS+CLS | ★★★☆ 应用级 | ★★☆ 仅前端检查 | 缺后端API层权限、缺行级安全 |
| 空状态设计 | ★★☆ 社区关注少 | ★★☆ 无明确指南 | ★★☆ 不明确 | ★☆ 消息误导 | 需区分角色的空状态引导 |
| 数据刷新 | ★★★★ 计划刷新 | ★★★★★ DirectQuery | ★★★★ 定时刷新 | ★★☆ 手动上传 | 缺自动刷新机制 |
| 移动端适配 | ★★★★ Responsive | ★★★★★ Mobile View | ★★★★ 响应式 | ★★☆ 仅Web | 无移动端优化 |
| 财务报表模板 | ★★★★ 可手工 | ★★★★★ CFO模板库 | ★★★★★ 行业模板 | ★☆ 无模板 | 缺预置财务报表模板 |

### 2.2 食品制造业财务经理 Top 20 KPI

| # | KPI | 目标范围 | 当前覆盖 |
|---|-----|---------|---------|
| 1 | 毛利率 | 25-35% | ✅ (利润分析) |
| 2 | 净利率 | 3-8% | ✅ (利润分析) |
| 3 | 存货周转率 | 15-20次/年 | ❌ 缺失 |
| 4 | 应收账款周转天数 | 45-50天 | △ (应收分析有总额,缺周转率) |
| 5 | 现金转换周期 | 20-40天 | ❌ 缺失 |
| 6 | 销售费用率 | 8-12% | ❌ 缺失 |
| 7 | 管理费用率 | 5-8% | ❌ 缺失 |
| 8 | 资产负债率 | 40-60% | ❌ 缺失 |
| 9 | 流动比率 | 1.5-2.0 | ❌ 缺失 |
| 10 | 原材料成本占比 | 65-85% | ❌ 缺失 |
| 11 | 直接人工成本占比 | 8-12% | ❌ 缺失 |
| 12 | 预算达成率 | 90-110% | △ (预算分析502) |
| 13 | 应付账款周转天数 | 30-45天 | △ (应付分析502) |
| 14 | ROE | 15-25% | ❌ 缺失 |
| 15 | 营收环比增长 | 行业相关 | ❌ (KPI卡片无趋势) |

**覆盖率**: 仅 2/15 核心 KPI 有效展示（13%），远低于行业标杆的 80%+

### 2.3 财务经理"晨间检视"工作流差距

| 步骤 | 标杆工具(Power BI) | 我们的SmartBI | 差距评分(1-5) |
|------|-------------------|-------------|------------|
| 1. 打开看板 | <2s加载，自动刷新 | 3-5s加载，手动刷新 | 3/5 |
| 2. 扫描KPI | 5-7个核心KPI一屏可见 | 4个KPI,3个无数据 | 1/5 |
| 3. 发现异常 | 条件格式红绿灯自动标记 | 无条件格式,无异常标记 | 1/5 |
| 4. 下钻原因 | 点击KPI→层级钻取 | 需切换页面 | 2/5 |
| 5. 根因分析 | AI辅助归因分析 | AI使用假数据 | 1/5 |
| 6. 采取行动 | 导出/分享/通知 | 仅截图分享 | 2/5 |

**总评**: 晨间检视工作流 **10/30 分** (33%)，主要瓶颈在数据覆盖和异常检测

---

## 第三部分: 代码问题详细分析

### 3.1 前端代码问题 (5个)

#### Issue #1: ECharts 内存泄漏 + 事件处理器僵尸化 [HIGH]
- **文件**: SmartBIAnalysis.vue L2643-2729, L2513-2540
- **问题**: Tab切换时调用 `inst.clear()` 但不调用 `inst.off()`，事件处理器仍活跃
- **影响**: 内存泄漏、点击旧图表触发错误的Sheet数据下钻

#### Issue #2: 前端权限检查无后端验证 [HIGH]
- **文件**: SmartBIAnalysis.vue L1066, permission.ts L186-195
- **问题**: `canUpload` 仅前端检查，可通过DevTools/API绕过
- **额外问题**: `canWriteSmartBI()` 仅检查 analytics 模块，finance_manager 有 `finance: 'rw'` 但无法上传

#### Issue #3: KPI 变化率 >=80% 被静默过滤 [MEDIUM]
- **文件**: KPICard.vue L195-216
- **问题**: `Math.abs(props.changeRate) >= 80` 返回 null，用户看不到趋势
- **违反**: "禁止假数据"原则 — 真实数据被静默吞掉

#### Issue #4: Dashboard KPI 零值降级 [MEDIUM]
- **文件**: Dashboard.vue L89-148
- **问题**: `changeRate ?? 0` 将 null（无数据）转为 0（零增长），用户无法区分
- **额外**: L624 `toLocaleString()` 在 Hermes 引擎不兼容

#### Issue #5: SmartBIEmptyState 对只读用户显示上传控件 [MEDIUM]
- **文件**: SmartBIEmptyState.vue L169-173
- **问题**: `type="no-upload"` 默认显示"选择文件"按钮，即使传给只读用户

### 3.2 Python 后端代码问题

#### Issue #6: NaN→0 替换掩盖数据缺失 [LOW]
- **文件**: chart_builder.py `_sanitize_for_json()`, region_analysis.py 多处
- **问题**: `fillna(0)` 将缺失值替换为0，而非 null/None
- **影响**: 图表中0值可能是真实0或缺失值，无法区分

#### Issue #7: LLM 超时配置
- **文件**: insight_generator.py L1171
- **现状**: `timeout_secs = 60.0 + attempt * 15.0` (60s→75s→90s 递增重试)
- **评估**: 设计合理，但大数据集(264+行)可能仍超时

---

## 第四部分: 优化路线图

### P0: 本周必修 (阻塞性)

| # | 任务 | 文件 | 工作量 | 影响 |
|---|------|------|--------|------|
| P0.1 | 修复 502 后端错误 | Java 后端 (需排查) | 2-4h | 2/5 分析类型不可用 |
| P0.2 | 修复只读用户看到上传按钮 | SmartBIEmptyState.vue L169 | 0.5h | 权限混淆 |
| P0.3 | 修复 AI 洞察重复 | Dashboard.vue (数据去重) | 1h | 信息冗余 |

### P1: 两周内 (高影响中等工作量)

| # | 任务 | 文件 | 工作量 | 影响 |
|---|------|------|--------|------|
| P1.1 | ECharts Tab切换清理事件 | SmartBIAnalysis.vue L2646 | 1h | 内存泄漏+错误下钻 |
| P1.2 | 移除KPI >=80%静默过滤 | KPICard.vue L195 | 1h | 数据可见性 |
| P1.3 | 空状态消息区分角色 | SmartBIEmptyState.vue | 2h | UX 误导 |
| P1.4 | 数值格式统一(万元) | Dashboard.vue, smartbi.ts | 2h | 格式一致性 |
| P1.5 | Dashboard KPI null→0 修复 | Dashboard.vue L122 | 1h | 数据准确性 |
| P1.6 | 预警按分析类型过滤 | FinanceAnalysis.vue | 2h | 预警相关性 |

### P2: 一个月内 (较大特性)

| # | 任务 | 文件 | 工作量 | 影响 |
|---|------|------|--------|------|
| P2.1 | AI问答连接真实上传数据 | AIQuery.vue + Python API | 8h | AI 实用性 |
| P2.2 | KPI卡片增加趋势箭头+miniChart | Dashboard.vue, KPICard.vue | 4h | 晨间检视效率 |
| P2.3 | 新增5个食品行业核心KPI | 前后端 | 8h | KPI覆盖率 13%→50% |
| P2.4 | 财务分析图表数据修复 | FinanceAnalysis.vue + API | 4h | 图表可用性 |
| P2.5 | 后端API权限验证 | Java Controller | 4h | 安全加固 |
| P2.6 | canWriteSmartBI跨模块检查 | permission.ts L186 | 1h | 权限模型完善 |

### P3: 待验证 (需用户反馈)

| # | 任务 | 说明 | 工作量 |
|---|------|------|--------|
| P3.1 | SmartBIAnalysis.vue 拆分 | 5713行→多子组件 | 16h |
| P3.2 | 前端财务计算迁移后端 | JS浮点精度→Java BigDecimal | 8h |
| P3.3 | 行业基准细分 | 食品加工→冷链/常温/预制菜 | 4h |
| P3.4 | 自动数据刷新 | WebSocket/SSE实时更新 | 12h |
| P3.5 | 预置财务报表模板 | 利润表/现金流/资产负债表 | 8h |

---

## 第五部分: "黄金路径"体验设计

### 财务经理晨间检视理想流程 (目标: 90秒内完成)

```
Step 1 (0-10s): 打开经营驾驶舱
  → 一屏可见: 毛利率(30.0% ↑2.1%), 净利率(8.2% ↓0.5%),
    营收(2.7万 ↑15%), 现金余额(150万 →)
  → 异常KPI自动红色标记

Step 2 (10-30s): 扫描异常
  → 净利率下降0.5% → 自动出现原因提示:"成本环比上升8%,主因原材料涨价"
  → 点击提示 → 下钻到成本分析详情

Step 3 (30-60s): 查看详情
  → 成本分析页: 直接材料↑12%, 直接人工→, 制造费用↓3%
  → AI洞察: "猪肉价格环比上涨15%,建议启动替代供应商议价"

Step 4 (60-90s): 采取行动
  → 点击"分享" → 生成报告链接发送给采购部
  → 设置预警: 原材料成本超预算10%时自动通知
```

---

## 附录

### A. 截图清单

| 编号 | 文件名 | 说明 |
|------|--------|------|
| 00 | 00-login-page.png | 登录页面(含快速登录按钮) |
| 01 | 01-after-login-landing.png | 登录后首页(财务管理仪表板) |
| 02a | 02-dashboard-full.png | 经营驾驶舱全页 |
| 02b | 02b-dashboard-top.png | 经营驾驶舱KPI区域(清晰) |
| 02c | 02c-dashboard-mid.png | 经营驾驶舱中段(空状态) |
| 02d | 02d-dashboard-insights.png | AI洞察+快捷问答(重复项) |
| 03a | 03-finance-full.png | 财务分析全页 |
| 03b | 03b-finance-top.png | 利润分析(KPI+空图表) |
| 03c | 03c-finance-cost.png | 成本分析(全零) |
| 03d | 03d-finance-receivable.png | 应收分析(有数据+错误预警) |
| 03e | 03e-finance-payable.png | 应付分析(502错误) |
| 03f | 03f-finance-budget.png | 预算分析(502错误) |
| 04a | 04-sales-top.png | 销售分析(全空) |
| 04b | 04b-sales-bottom.png | 销售分析底部(空状态) |
| 05a | 05-aiquery-full.png | AI问答(模板列表) |
| 05b | 05b-aiquery-response.png | AI回复(假设数据) |
| 06 | 06-query-templates.png | 查询模板管理(空) |
| 07 | 07-analysis-top.png | 智能数据分析(上传按钮bug) |
| 08 | 08-permission-production.png | 权限测试(生产页可访问) |

### B. 研究来源

- Gartner 2025 BI Magic Quadrant (Power BI + Tableau 领导者)
- 东吴证券食品饮料行业深度报告 (毛利率/净利率基准)
- FineBI 官方文档 (KPI 卡片设计、权限管理)
- 中国财务经理日常工作流程 (chinaacc.com)
- FSSC 22000 食品安全体系认证要求

### C. 控制台错误日志

```
[error] Failed to load resource: 502 (Bad Gateway) x 8
[error] 加载财务数据失败: ApiError: Request failed with status code 502
[warning] 加载数据源列表失败: ApiError: Request failed with status code 502
[warning] 加载销售员排行失败: ApiError: Request failed with status code 502
[warning] 加载趋势图失败: ApiError: Request failed with status code 502
[warning] 加载产品分布图失败: ApiError: Request failed with status code 502
```

---

---

## 第六部分: 已修复问题 (2026-02-16 session)

### Fix 1: AI 洞察去重 (Dashboard.vue)
- **问题**: 相同 message 的洞察出现2次
- **修复**: `aiInsights` computed 添加 `Set<string>` 去重

### Fix 2: KPI changeRate null→0 混淆 (Dashboard.vue)
- **问题**: 动态数据 KPI 的 changeRate 硬编码为 `0` (零增长), 无法区分"无数据"
- **修复**: 改为 `kpi.changeRate ?? null`, 保留 null 语义

### Fix 3: 只读用户空状态 (Dashboard.vue)
- **问题**: 财务经理看到 "请先上传Excel文件" + 上传按钮
- **修复**: 添加 `canUpload` 检查, 只读用户显示 `type="read-only"` + `showAction=false`

### Fix 4: 预警跨Tab泄露 (FinanceAnalysis.vue)
- **问题**: "毛利率偏低" 在应收/应付/预算 tab 也显示
- **修复**: 按 analysisType 关键词过滤 warnings (利润→毛利/净利关键词, 成本→成本/费用, etc.)

### Fix 5: 销售分析菜单权限不一致 (AppSidebar.vue)
- **问题**: 菜单项 `module: 'analytics'` vs 路由 `module: 'sales'` → 菜单可见但点击403
- **修复**: 菜单项 module 改为 `'sales'`, 与路由一致

### Fix 6: Java 构建 + JAR 更新
- 包含 finance data auto-extraction (7步实现)
- RecordType.REVENUE 枚举, Python extract endpoint, 上传流程挂钩

---

## 第七部分: 行业标杆深度对比 (信息密度)

### 7.1 每个分析Tab的KPI数量对比

| Tab | 行业标准 | 当前实现 | 差距 |
|-----|---------|---------|------|
| 利润分析 | 6 (Revenue, Gross/Net Margin, EBITDA, ROE, YoY) | 2 (毛利润, 净利润) | -4 |
| 成本分析 | 5 (总成本, 材料/人工/间接占比, 成本利润率) | 4 (总成本, 材料/人工/间接) | -1 |
| 应收分析 | 6 (总额, DSO, 回款率, 4段账龄, 逾期率) | 4 (总额, 3段账龄) | -2 |
| 应付分析 | 5 (总额, DPO, 3段账龄, 付款进度) | 4 | -1 |
| 预算分析 | 6 (总额, 执行率, 差异额/率, 预测, 剩余) | 4 | -2 |

### 7.2 每个Tab的图表数量对比

| Tab | 行业标准 | 当前实现 | 差距 |
|-----|---------|---------|------|
| 利润 | 4 (趋势线+瀑布+饼图+YoY对比) | 1 | -3 |
| 成本 | 4 (饼图+趋势+桑基/树图+Top10) | 1 | -3 |
| 应收 | 4 (堆叠柱+Top10表+DSO线+漏斗) | 1 | -3 |
| 应付 | 3 (账龄柱+付款日历+趋势线) | 1 | -2 |
| 预算 | 4 (瀑布+仪表盘×6+预测线+热力图) | 1 | -3 |

### 7.3 组件能力 vs 实际使用

| 功能 | KPICard组件支持? | 后端提供? | 实际使用? |
|------|-----------------|----------|----------|
| changeRate (环比) | ✅ prop存在 | ❌ 未返回 | ❌ |
| sparklineData (迷你图) | ✅ displayMode="sparkline" | ❌ 未返回 | ❌ |
| benchmarkLabel (行业基准) | ✅ prop存在 | ❌ 未返回 | ❌ |
| benchmarkGap (基准差距) | ✅ prop存在 | ❌ 未返回 | ❌ |
| subMetrics (子指标) | ✅ prop存在 | ❌ 未返回 | ❌ |

**结论**: 前端组件已具备行业标准能力, 瓶颈在后端数据未提供。

---

### Process Note
- Mode: Full (5+ agents)
- Researchers deployed: 3 (BI UX标杆, 食品制造业财务, 技术差距)
- Code analysis agents: 2 (Vue前端, Python后端)
- Industry benchmark agent: 1 (Power BI, FineBI, Tableau, 永洪BI 深度对比)
- Total sources found: 27+ web sources, 15+ code files
- Screenshots taken: 28
- Bugs fixed: 6
- Phases completed: Browser Audit → Research → Analysis → Code Detection → Fixes → Report
