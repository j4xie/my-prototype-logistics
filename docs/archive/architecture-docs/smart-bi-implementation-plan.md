# SmartBI 智能分析系统 - FanSoft 风格增强计划

> **版本**: v2.0
> **更新日期**: 2026-01-23
> **关联文档**: [smart-bi-ai-analysis-spec.md](./smart-bi-ai-analysis-spec.md)

---

## 📊 FanSoft 风格增强 - TODO 清单

### Phase 0: LLM 智能字段映射与图表角色分配 ✅ 已完成

#### 核心功能：LLM 输出图表轴角色

LLM 分析 Excel 字段后，自动分配图表角色：

```json
{
  "月份": { "chartAxis": "X_AXIS", "priority": 1 },    // X 轴 - 类别轴
  "品类": { "chartAxis": "SERIES", "priority": 1 },   // 系列 - 图例分组
  "渠道": { "chartAxis": "SERIES", "priority": 2 },   // 系列备选
  "收入": { "chartAxis": "Y_AXIS" }                   // Y 轴 - 数值轴
}
```

#### 生成的图表效果

```
┌────────────────────────────────────────────────────────────┐
│  销售分析                     [按品类 ▼] [按渠道]          │
│                                                            │
│     酱料   调味品                                          │
│  ██████   ████     ← 系列分组（可切换为按渠道）            │
│  ██████   █████                                            │
│  ██████   ████                                             │
│  ───────────────                                           │
│   1月     2月      3月   ← X 轴（月份）                    │
└────────────────────────────────────────────────────────────┘
```

#### 实现文件清单

| 任务 | 文件 | 状态 |
|------|------|------|
| 数据库迁移 - 字段角色 | `V2026_01_24_01__smart_bi_dictionary_role.sql` | ✅ |
| Entity 扩展 | `SmartBiDictionary.java` (+fieldRole, chartAxis, axisPriority, aggregationType) | ✅ |
| LLM 服务接口 | `LLMFieldMappingService.java` | ✅ |
| LLM 服务实现 | `LLMFieldMappingServiceImpl.java` (938 行) | ✅ |
| 字段映射 DTO | `FieldMappingWithChartRole.java` (266 行) - 含 FieldRole, ChartAxisRole 枚举 | ✅ |
| 动态图表配置 DTO | `DynamicChartConfig.java` (379 行) - 含 AlternativeDimension | ✅ |
| **图表配置构建器** | `DynamicChartConfigBuilder.java` (816 行) - 根据轴角色生成 ECharts 配置 | ✅ |
| Excel 解析器集成 | `ExcelDynamicParserServiceImpl.java` - 集成 LLM 字段映射 | ✅ |
| 上传流程集成 | `SmartBIUploadFlowServiceImpl.java` - 动态聚合 + 用户确认学习 | ✅ |

#### 关键枚举定义

```java
public enum FieldRole {
    DIMENSION,  // 分类字段 - 可用于 X 轴或系列
    METRIC,     // 度量字段 - 用于 Y 轴数值
    TIME,       // 时间字段 - 优先用于 X 轴
    IDENTIFIER  // 标识字段 - 不用于图表
}

public enum ChartAxisRole {
    X_AXIS,     // 作为 X 轴类别（如：月份、品类）
    SERIES,     // 作为图例/系列分组（如：渠道、产品线）
    Y_AXIS,     // 作为 Y 轴数值（如：收入、成本）
    NONE        // 不参与图表展示
}
```

#### 预期效果

- **新字段自动分配**：上传 Excel 后，LLM 自动将字段分配到正确的 X轴/系列/Y轴
- **维度切换**：用户可在前端切换不同维度视角（如"按品类"↔"按渠道"）
- **零代码修改**：无需修改任何聚合或图表代码

---

### Phase 1: 基础组件 ✅ 已完成

| 任务 | 文件 | 状态 |
|------|------|------|
| 瀑布图组件 | `WaterfallChart.vue` (347 行) | ✅ |
| 期间选择器 | `PeriodSelector.vue` (827 行) | ✅ |
| 组合图增强 | `CombinedChart.vue` (markAreas, markPoints, grouped mode) | ✅ |
| SQL 模板 | `V2026_01_24_02__budget_yoy_templates.sql` (210 行) | ✅ |
| 组件导出更新 | `index.ts` | ✅ |

---

### Phase 2: 复杂分析图表 ✅ 已完成

| 任务 | 文件 | 状态 |
|------|------|------|
| AI 洞察面板 | `AIInsightPanel.vue` (531 行) | ✅ |
| 预算达成图表 | `BudgetAchievementChart.vue` (704 行) | ✅ |
| 同比环比图表 | `YoYMoMComparisonChart.vue` (738 行) | ✅ |
| 品类结构对比图表 | `CategoryStructureComparisonChart.vue` | ✅ |
| 后端服务方法 | `FinanceAnalysisServiceImpl.java` (getBudgetAchievementChart, getYoYMoMComparisonChart, getCategoryStructureComparisonChart) | ✅ |
| API 端点 | `SmartBIController.java` (3 个新端点) | ✅ |
| 组件导出更新 | `index.ts` (CategoryStructureComparisonChart) | ✅ |

**新增 API 端点:**
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement`
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom`
- `GET /api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison`

---

### Phase 3: 高级图表组件 ✅ 已完成

| 任务 | 文件 | 状态 | 描述 |
|------|------|------|------|
| 嵌套环形图 | `NestedDonutChart.vue` | ✅ | 多层环形图，外环当年/内环去年，点击下钻 |
| TrendChart 增强 | `TrendChart.vue` 修改 | ✅ | 预测线、目标线、异常点标记、底部数据表格 |
| KPICard 增强 | `KPICard.vue` 修改 | ✅ | sparkline/progressBar/waterWave 模式、子指标 |
| 雷达图组件 | `RadarChart.vue` | ✅ | 多系列对比，财务健康分析 |

---

### Phase 4: 仪表盘构建器 ✅ 已完成

| 任务 | 文件 | 状态 | 描述 |
|------|------|------|------|
| 仪表盘布局器 | `DashboardBuilder.vue` | ✅ | 拖拽式 12 列网格布局，卡片调整大小 |
| 高级财务分析页 | `AdvancedFinanceAnalysis.vue` | ✅ | 整合所有财务图表，响应式布局 |
| 图表联动服务 | `ChartLinkageService.ts` (876行) | ✅ | filter/highlight/drill-down 联动 |
| 仪表盘模板 | `dashboard-templates.json` | ✅ | 4 套预设模板 (经营/财务/销售/生产) |

---

### Phase 5: 移动端适配 ✅ 已完成

| 任务 | 文件 | 状态 | 描述 |
|------|------|------|------|
| 移动端期间选择器 | `MobilePeriodSelector.tsx` | ✅ | 底部弹出式，快捷选项，同比开关 |
| 移动端瀑布图 | `MobileWaterfallChart.tsx` | ✅ | SVG 绘制，横向滚动，连接线 |
| 移动端预算达成 | `MobileBudgetChart.tsx` | ✅ | KPI 卡片 + 分组柱状图 + 状态点 |
| 移动端同比环比 | `MobileYoYComparisonChart.tsx` | ✅ | YoY/MoM 切换，增长率徽章 |
| 移动端 AI 洞察 | `MobileAIInsightPanel.tsx` | ✅ | 折叠面板，正面/负面/建议分区 |

---

## 📁 文件结构概览

### 后端 - Phase 0-2 新增文件

```
backend-java/src/main/java/com/cretas/aims/
├── dto/smartbi/
│   ├── DynamicChartConfig.java          ✅ NEW
│   ├── FieldMappingWithChartRole.java   ✅ NEW
│   └── AlternativeDimension.java        ✅ NEW
├── service/smartbi/
│   ├── LLMFieldMappingService.java      ✅ NEW
│   ├── DynamicChartConfigBuilderService.java  ✅ NEW
│   └── impl/
│       ├── LLMFieldMappingServiceImpl.java    ✅ NEW
│       ├── DynamicChartConfigBuilder.java     ✅ NEW
│       └── FinanceAnalysisServiceImpl.java    ✅ MODIFIED
├── controller/
│   └── SmartBIController.java           ✅ MODIFIED (3 new endpoints)
└── entity/smartbi/
    └── SmartBiDictionary.java           ✅ MODIFIED

backend-java/src/main/resources/db/migration/
├── V2026_01_24_01__smart_bi_dictionary_role.sql   ✅ NEW
└── V2026_01_24_02__budget_yoy_templates.sql       ✅ NEW
```

### 前端 Web - Phase 1-4 新增组件

```
web-admin/src/components/smartbi/
├── WaterfallChart.vue              ✅ NEW (Phase 1)
├── PeriodSelector.vue              ✅ NEW (Phase 1)
├── CombinedChart.vue               ✅ MODIFIED (Phase 1)
├── AIInsightPanel.vue              ✅ NEW (Phase 2)
├── BudgetAchievementChart.vue      ✅ NEW (Phase 2)
├── YoYMoMComparisonChart.vue       ✅ NEW (Phase 2)
├── CategoryStructureComparisonChart.vue  ✅ NEW (Phase 2)
├── NestedDonutChart.vue            ✅ NEW (Phase 3)
├── RadarChart.vue                  ✅ NEW (Phase 3)
├── TrendChart.vue                  ✅ MODIFIED (Phase 3) - 预测线、异常点
├── KPICard.vue                     ✅ MODIFIED (Phase 3) - sparkline、进度条
├── DashboardBuilder.vue            ✅ NEW (Phase 4)
└── index.ts                        ✅ MODIFIED

web-admin/src/views/analytics/smart-bi/
└── AdvancedFinanceAnalysis.vue     ✅ NEW (Phase 4)

web-admin/src/services/smartbi/
└── ChartLinkageService.ts          ✅ NEW (Phase 4) - 876 行

web-admin/src/config/smartbi/
└── dashboard-templates.json        ✅ NEW (Phase 4) - 4 套模板
```

### 前端 App - Phase 5 新增组件

```
frontend/CretasFoodTrace/src/components/smartbi/
├── MobilePeriodSelector.tsx        ✅ NEW (Phase 5)
├── MobileWaterfallChart.tsx        ✅ NEW (Phase 5)
├── MobileBudgetChart.tsx           ✅ NEW (Phase 5)
├── MobileYoYComparisonChart.tsx    ✅ NEW (Phase 5)
├── MobileAIInsightPanel.tsx        ✅ NEW (Phase 5)
└── index.ts                        ✅ MODIFIED
```

---

## 🎯 组件功能说明

### Phase 1 组件

#### WaterfallChart.vue
- 瀑布图/桥图，展示增减变化
- 支持 increase/decrease/total 三种类型
- 自定义颜色配置

#### PeriodSelector.vue
- 灵活的期间选择器
- 支持：单月、季度、年、月份范围、季度范围、自定义
- 快捷选项：本月、上月、本季、上季
- 同比对比开关

### Phase 2 组件

#### AIInsightPanel.vue
- AI 洞察面板，正面/负面/建议分区
- 可展开/折叠
- 支持详情查看

#### BudgetAchievementChart.vue
- 预算达成分析
- KPI 卡片 + 季度时间轴 + 月度指标
- 分组柱状图 + 达成率折线

#### YoYMoMComparisonChart.vue
- 同比环比对比分析
- 视图模式切换：柱状图/折线图
- 双 Y 轴：金额 + 增长率

#### CategoryStructureComparisonChart.vue
- 品类结构年度对比
- 视图模式切换：柱状图/双饼图
- 汇总 KPI 卡片
- 详细数据表格

---

## 🔌 API 端点汇总

### 新增端点 (Phase 2)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/analysis/finance/budget-achievement` | GET | 预算达成分析 |
| `/analysis/finance/yoy-mom` | GET | 同比环比分析 |
| `/analysis/finance/category-comparison` | GET | 品类结构对比 |

### 参数说明

**预算达成分析**
```
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/budget-achievement
?year=2026
&metric=revenue  // revenue/cost/profit/expense
```

**同比环比分析**
```
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/yoy-mom
?periodType=MONTH          // MONTH/QUARTER/MONTH_RANGE/QUARTER_RANGE
&startPeriod=2026-01       // 格式：2026-01 或 2026-Q1
&endPeriod=2026-06         // 范围类型时必填
&metric=revenue            // revenue/cost/profit/gross_margin
```

**品类结构对比**
```
GET /api/mobile/{factoryId}/smart-bi/analysis/finance/category-comparison
?year=2026
&compareYear=2025
```

---

## 📈 进度统计

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| Phase 0: LLM 字段映射 | ✅ 完成 | 100% |
| Phase 1: 基础组件 | ✅ 完成 | 100% |
| Phase 2: 复杂图表 | ✅ 完成 | 100% |
| Phase 3: 高级图表 | ✅ 完成 | 100% |
| Phase 4: 仪表盘构建 | ✅ 完成 | 100% |
| Phase 5: 移动端适配 | ✅ 完成 | 100% |

**总体进度: Phase 0-5 全部完成 (100%)**

---

## 🔄 并行工作建议

### Subagent 并行（单 Chat 内）
✅ **适合**：
- Phase 3 的图表组件可并行开发
- Phase 5 的移动端组件可并行开发

### 多 Chat 窗口并行
✅ **适合**：
- Web 端 (Phase 3-4) 与移动端 (Phase 5) 可分开进行
- 后端服务扩展与前端组件开发可并行

⚠️ **注意冲突**：
- `index.ts` 导出文件需同步更新
- 共享类型定义需保持一致

---

*文档更新于: 2026-01-23 - Phase 0-5 全部完成*
