# SmartBI 智能分析系统 - 完整实施计划

> **版本**: v1.1
> **更新日期**: 2026-01-18
> **关联文档**: [smart-bi-ai-analysis-spec.md](./smart-bi-ai-analysis-spec.md)

---

## 一、实施概览

### 1.1 项目范围

| 层级 | 技术栈 | 主要工作 |
|------|--------|---------|
| **后端** | Java + Spring Boot | API、服务、数据库 |
| **移动端** | React Native + Expo | 导航、图表、交互 |
| **Web端** | Vue 3 + Element Plus + ECharts | 导航、图表、页面 |

### 1.2 权限与导航对照

| 角色 | 移动端入口 | Web端入口 | 可用功能 |
|------|-----------|----------|---------|
| **factory_super_admin** | AI分析Tab | 数据分析菜单 | 全部功能 |
| **dispatcher** | 智能分析Tab | 数据分析菜单 | 全部功能 |
| **sales_manager** | 销售分析Tab | 销售管理→分析 | 销售分析 |
| **finance_manager** | 财务分析Tab | 财务管理→分析 | 财务分析 |

---

## 二、后端实施计划（Phase 1-4）

### Phase 1: 基础设施层（可并行3个任务）

#### 任务 1A: Excel动态解析模块
**文件位置**: `backend-java/src/main/java/com/cretas/aims/service/smartbi/`

| 文件 | 职责 |
|------|------|
| `DynamicExcelParser.java` | 不依赖固定Class的动态解析 |
| `FieldMappingEngine.java` | 同义词映射 + AI语义识别 |
| `DataFeatureAnalyzer.java` | 自动识别数据类型和特征 |

**配置文件**: `resources/config/smartbi/field_synonyms.json`

#### 任务 1B: 智能BI核心服务
| 文件 | 职责 |
|------|------|
| `SmartBIService.java` | 核心服务接口 |
| `SmartBIServiceImpl.java` | 核心服务实现 |
| `MetricCalculator.java` | 指标计算引擎 |
| `ChartRecommender.java` | 图表智能推荐 |

#### 任务 1C: 数据库设计
**文件**: `resources/db/migration/V2026_01_19_01__smart_bi_tables.sql`

```sql
-- 数据集表
CREATE TABLE smart_bi_datasets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    row_count INT,
    date_range_start DATE,
    date_range_end DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_factory_id (factory_id)
);

-- 字段映射表
CREATE TABLE smart_bi_field_mappings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dataset_id BIGINT NOT NULL,
    original_name VARCHAR(100) NOT NULL,
    mapped_name VARCHAR(100) NOT NULL,
    confidence DECIMAL(5,2),
    mapping_source VARCHAR(20), -- 'synonym' | 'ai' | 'manual'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES smart_bi_datasets(id)
);

-- 分析缓存表
CREATE TABLE smart_bi_analysis_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    result_json LONGTEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cache_key (factory_id, cache_key)
);

-- 查询日志表
CREATE TABLE smart_bi_query_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    factory_id VARCHAR(50) NOT NULL,
    user_id BIGINT NOT NULL,
    user_input TEXT NOT NULL,
    detected_intent VARCHAR(50),
    extracted_params JSON,
    response_text TEXT,
    quota_used INT DEFAULT 0,
    response_time_ms INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factory_user (factory_id, user_id)
);
```

### Phase 2: 分析模块层（可并行4个任务）

| 任务 | 服务类 | DTO | 职责 |
|------|--------|-----|------|
| 2A | `SalesAnalysisService` | `SalesMetricsDTO` | 人员/产品/客户分析 |
| 2B | `DepartmentAnalysisService` | `DepartmentMetricsDTO` | 效率矩阵/标杆对比 |
| 2C | `RegionAnalysisService` | `RegionMetricsDTO` | 大区/省份/城市分析 |
| 2D | `FinanceAnalysisService` | `FinanceMetricsDTO` | 成本/利润/应收/预算 |

### Phase 3: AI智能层（可并行3个任务）

| 任务 | 服务类 | 职责 |
|------|--------|------|
| 3A | `SmartBIPromptService` | Prompt模板管理 |
| 3B | `SmartBIIntentService` | 意图识别 + 参数提取 |
| 3C | `RecommendationService` | 产品推荐/预警分级/激励方案 |

**Prompt模板文件**: `resources/prompts/smartbi/*.md`

### Phase 4: API展示层（可并行3个任务）

| 任务 | 文件 | 端点 |
|------|------|------|
| 4A | `SmartBIController.java` | 统一API入口 |
| 4B | `ChartConfigDTO.java` | 图表配置结构 |
| 4C | 问答API | `/query`, `/drill-down` |

---

## 三、移动端实施计划（Phase 5-6）

### Phase 5: 导航与权限配置

#### 任务 5A: 权限扩展

**文件**: `frontend/CretasFoodTrace/src/utils/permissionHelper.ts`

```typescript
// 新增 SmartBI 权限检查函数
export function canAccessSmartBI(user: User): boolean {
  return hasModulePermission(user, 'analytics', 'read') ||
         hasModulePermission(user, 'sales', 'read') ||
         hasModulePermission(user, 'finance', 'read');
}

export function canUploadExcel(user: User): boolean {
  return hasModulePermission(user, 'analytics', 'write');
}

export function canAccessSalesAnalysis(user: User): boolean {
  return hasModulePermission(user, 'sales', 'read');
}

export function canAccessFinanceAnalysis(user: User): boolean {
  return hasModulePermission(user, 'finance', 'read');
}

export function canAccessExecutiveDashboard(user: User): boolean {
  return hasModulePermission(user, 'analytics', 'read');
}
```

#### 任务 5B: 导航器修改

**1. FactoryAdminNavigator 扩展**

文件: `frontend/CretasFoodTrace/src/navigation/FactoryAdminTabNavigator.tsx`

```typescript
// AI分析Tab 中新增 SmartBI 入口
const AIAnalysisStack = () => (
  <Stack.Navigator>
    {/* 现有页面 */}
    <Stack.Screen name="CostAnalysis" component={CostAnalysisScreen} />
    <Stack.Screen name="QualityAnalysis" component={QualityAnalysisScreen} />

    {/* SmartBI 新增页面 */}
    <Stack.Screen name="ExecutiveDashboard" component={ExecutiveDashboardScreen} />
    <Stack.Screen name="SalesAnalysis" component={SalesAnalysisScreen} />
    <Stack.Screen name="FinanceAnalysis" component={FinanceAnalysisScreen} />
    <Stack.Screen name="ExcelUpload" component={ExcelUploadScreen} />
    <Stack.Screen name="NaturalLanguageQuery" component={NLQueryScreen} />
  </Stack.Navigator>
);
```

**2. DispatcherNavigator 扩展**

文件: `frontend/CretasFoodTrace/src/navigation/DispatcherNavigator.tsx`

```typescript
// 新增智能分析Tab
<Tab.Screen
  name="SmartBITab"
  component={SmartBIStackNavigator}
  options={{
    tabBarLabel: '智能分析',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="analytics" size={size} color={color} />
    ),
  }}
/>
```

**3. MainNavigator 条件Tab**

文件: `frontend/CretasFoodTrace/src/navigation/MainNavigator.tsx`

```typescript
const { user } = useAuthStore();
const canSales = canAccessSalesAnalysis(user);
const canFinance = canAccessFinanceAnalysis(user);

{/* 销售经理专属 */}
{canSales && !canFinance && (
  <Tab.Screen
    name="SalesAnalysisTab"
    component={SalesAnalysisStackNavigator}
    options={{ tabBarLabel: '销售分析' }}
  />
)}

{/* 财务经理专属 */}
{canFinance && !canSales && (
  <Tab.Screen
    name="FinanceAnalysisTab"
    component={FinanceAnalysisStackNavigator}
    options={{ tabBarLabel: '财务分析' }}
  />
)}
```

### Phase 6: 移动端图表与页面

#### 任务 6A: 图表组件（移动端适配）

**文件目录**: `frontend/CretasFoodTrace/src/components/smartbi/`

| 组件 | 用途 | 尺寸适配策略 |
|------|------|-------------|
| `MobileLineChart.tsx` | 趋势图 | 宽度100%，高度200-250 |
| `MobileBarChart.tsx` | 柱状图 | 宽度100%，高度220 |
| `MobilePieChart.tsx` | 饼图 | 宽度100%，高度200 |
| `MobileKPICard.tsx` | KPI卡片 | 响应式grid |
| `MobileRankingList.tsx` | 排行榜 | FlatList滚动 |
| `MobileHeatmap.tsx` | 热力图 | 横向滚动 |

**移动端图表尺寸规范**:

```typescript
// constants/chartSizes.ts
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CHART_SIZES = {
  // 全宽图表
  fullWidth: {
    width: SCREEN_WIDTH - 32,  // 左右各16px边距
    height: 220,
  },

  // 半宽图表（并排2个）
  halfWidth: {
    width: (SCREEN_WIDTH - 48) / 2,  // 左右边距+中间间隔
    height: 180,
  },

  // KPI卡片（4个一行）
  kpiCard: {
    width: (SCREEN_WIDTH - 56) / 2,  // 2列布局
    height: 100,
  },

  // 饼图（正方形）
  pie: {
    width: SCREEN_WIDTH - 64,
    height: SCREEN_WIDTH - 64,
  },
};

// 响应式断点
export const BREAKPOINTS = {
  small: 320,   // iPhone SE
  medium: 375,  // iPhone 12/13
  large: 414,   // iPhone Plus/Max
  tablet: 768,  // iPad
};
```

**图表库选择**: `react-native-chart-kit` 或 `victory-native`

```typescript
// 示例: MobileLineChart.tsx
import { LineChart } from 'react-native-chart-kit';
import { CHART_SIZES } from '@/constants/chartSizes';

interface MobileLineChartProps {
  data: ChartData;
  title: string;
  showLegend?: boolean;
}

export const MobileLineChart: React.FC<MobileLineChartProps> = ({
  data,
  title,
  showLegend = true,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={data}
        width={CHART_SIZES.fullWidth.width}
        height={CHART_SIZES.fullWidth.height}
        chartConfig={{
          backgroundColor: '#fff',
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          labelColor: () => '#64748b',
          propsForLabels: {
            fontSize: 10,  // 移动端字体更小
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};
```

#### 任务 6B: SmartBI 页面

| 页面 | 文件 | 功能 |
|------|------|------|
| 经营驾驶舱 | `ExecutiveDashboardScreen.tsx` | KPI卡片 + 排行榜 + AI洞察 |
| 销售分析 | `SalesAnalysisScreen.tsx` | 销售指标 + 图表 + 下钻 |
| 财务分析 | `FinanceAnalysisScreen.tsx` | 财务指标 + 图表 |
| Excel上传 | `ExcelUploadScreen.tsx` | 文件选择 + 字段映射 |
| 自然语言问答 | `NLQueryScreen.tsx` | 输入框 + 对话列表 |

#### 任务 6C: API 服务

**文件**: `frontend/CretasFoodTrace/src/services/api/smartbi.ts`

```typescript
import { apiClient } from './client';

export const smartBIApi = {
  // Excel上传
  uploadExcel: (file: FormData) =>
    apiClient.post('/smart-bi/upload', file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // 分析接口
  getSalesAnalysis: (params: AnalysisParams) =>
    apiClient.get('/smart-bi/analysis/sales', { params }),

  getDepartmentAnalysis: (params: AnalysisParams) =>
    apiClient.get('/smart-bi/analysis/department', { params }),

  getRegionAnalysis: (params: AnalysisParams) =>
    apiClient.get('/smart-bi/analysis/region', { params }),

  getFinanceAnalysis: (params: AnalysisParams) =>
    apiClient.get('/smart-bi/analysis/finance', { params }),

  // 老板看板
  getExecutiveDashboard: (period: string) =>
    apiClient.get('/smart-bi/dashboard/executive', { params: { period } }),

  // 自然语言问答
  query: (request: QueryRequest) =>
    apiClient.post('/smart-bi/query', request),

  // 数据下钻
  drillDown: (request: DrillDownRequest) =>
    apiClient.post('/smart-bi/drill-down', request),
};
```

---

## 四、Web端实施计划（Phase 7-8）

### Phase 7: 导航与权限配置

#### 任务 7A: 权限矩阵扩展

**文件**: `web-admin/src/store/modules/permission.ts`

```typescript
// 在现有权限矩阵中，确保 analytics 模块已配置
const PERMISSION_MATRIX = {
  factory_super_admin: {
    // ... 现有配置
    analytics: 'rw',  // 确保有完整权限
  },
  dispatcher: {
    analytics: 'rw',
  },
  sales_manager: {
    sales: 'rw',
    analytics: 'r',  // 新增：只读数据分析
  },
  finance_manager: {
    finance: 'rw',
    analytics: 'r',  // 新增：只读数据分析
  },
  // ... 其他角色
};
```

#### 任务 7B: 菜单配置扩展

**文件**: `web-admin/src/components/layout/AppSidebar.vue`

```typescript
// 扩展 analytics 菜单
{
  path: '/analytics',
  title: '数据分析',
  icon: 'DataAnalysis',
  module: 'analytics',
  children: [
    { path: '/analytics/overview', title: '分析概览' },
    { path: '/analytics/trends', title: '趋势分析' },
    { path: '/analytics/ai-report', title: 'AI分析报告' },
    { path: '/analytics/kpi', title: 'KPI看板' },
    { path: '/analytics/production-report', title: '生产报表' },
    // SmartBI 新增
    { path: '/analytics/smart-bi/dashboard', title: '经营驾驶舱', icon: 'TrendCharts' },
    { path: '/analytics/smart-bi/sales', title: '智能销售分析', icon: 'Sell' },
    { path: '/analytics/smart-bi/finance', title: '智能财务分析', icon: 'Money' },
    { path: '/analytics/smart-bi/upload', title: 'Excel上传', icon: 'Upload' },
    { path: '/analytics/smart-bi/query', title: 'AI问答', icon: 'ChatDotRound' },
  ],
},

// 销售管理中也添加入口（销售经理可见）
{
  path: '/sales',
  title: '销售管理',
  icon: 'Goods',
  module: 'sales',
  children: [
    { path: '/sales/customers', title: '客户管理' },
    // SmartBI 入口
    { path: '/sales/smart-analysis', title: '智能销售分析', icon: 'TrendCharts' },
  ],
},

// 财务管理中也添加入口（财务经理可见）
{
  path: '/finance',
  title: '财务管理',
  icon: 'Money',
  module: 'finance',
  children: [
    { path: '/finance/cost-analysis', title: '成本分析' },
    { path: '/finance/reports', title: '财务报表' },
    // SmartBI 入口
    { path: '/finance/smart-analysis', title: '智能财务分析', icon: 'TrendCharts' },
  ],
},
```

#### 任务 7C: 路由配置

**文件**: `web-admin/src/router/index.ts`

```typescript
// SmartBI 路由
{
  path: '/analytics/smart-bi',
  component: () => import('@/views/analytics/smart-bi/Layout.vue'),
  children: [
    {
      path: 'dashboard',
      name: 'SmartBIDashboard',
      component: () => import('@/views/analytics/smart-bi/Dashboard.vue'),
      meta: { title: '经营驾驶舱', module: 'analytics' },
    },
    {
      path: 'sales',
      name: 'SmartBISales',
      component: () => import('@/views/analytics/smart-bi/SalesAnalysis.vue'),
      meta: { title: '智能销售分析', module: 'sales' },
    },
    {
      path: 'finance',
      name: 'SmartBIFinance',
      component: () => import('@/views/analytics/smart-bi/FinanceAnalysis.vue'),
      meta: { title: '智能财务分析', module: 'finance' },
    },
    {
      path: 'upload',
      name: 'SmartBIUpload',
      component: () => import('@/views/analytics/smart-bi/ExcelUpload.vue'),
      meta: { title: 'Excel上传', module: 'analytics', action: 'write' },
    },
    {
      path: 'query',
      name: 'SmartBIQuery',
      component: () => import('@/views/analytics/smart-bi/AIQuery.vue'),
      meta: { title: 'AI问答', module: 'analytics' },
    },
  ],
},

// 销售管理中的快捷入口（重定向）
{
  path: '/sales/smart-analysis',
  redirect: '/analytics/smart-bi/sales',
},

// 财务管理中的快捷入口（重定向）
{
  path: '/finance/smart-analysis',
  redirect: '/analytics/smart-bi/finance',
},
```

### Phase 8: Web端图表与页面

#### 任务 8A: ECharts 图表组件封装

**文件目录**: `web-admin/src/components/smartbi/`

| 组件 | 用途 | 图表类型 |
|------|------|---------|
| `TrendChart.vue` | 趋势分析 | 折线图/面积图 |
| `RankingChart.vue` | 排行榜 | 横向柱状图 |
| `PieChart.vue` | 占比分析 | 饼图/环形图 |
| `GaugeChart.vue` | 完成率 | 仪表盘 |
| `HeatmapChart.vue` | 交叉分析 | 热力图 |
| `ScatterChart.vue` | 分布分析 | 散点图/气泡图 |
| `CombinedChart.vue` | 组合分析 | 柱状+折线 |
| `MapChart.vue` | 地域分析 | 中国地图 |

**ECharts 封装示例**:

```vue
<!-- components/smartbi/TrendChart.vue -->
<template>
  <div class="trend-chart">
    <div class="chart-header">
      <h3>{{ title }}</h3>
      <el-radio-group v-model="granularity" size="small">
        <el-radio-button label="day">日</el-radio-button>
        <el-radio-button label="week">周</el-radio-button>
        <el-radio-button label="month">月</el-radio-button>
      </el-radio-group>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{
  title: string;
  data: TrendData;
  height?: number;
  showTarget?: boolean;
}>();

const chartRef = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;
const granularity = ref('day');

onMounted(() => {
  chart = echarts.init(chartRef.value!);
  renderChart();

  // 响应式调整
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chart?.dispose();
});

const handleResize = () => {
  chart?.resize();
};

const renderChart = () => {
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: props.data.series.map(s => s.name) },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: props.data.xAxis },
    yAxis: { type: 'value' },
    series: props.data.series.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
    })),
  };
  chart?.setOption(option);
};

watch(() => props.data, renderChart, { deep: true });
</script>
```

#### 任务 8B: SmartBI 页面

**文件目录**: `web-admin/src/views/analytics/smart-bi/`

| 页面 | 功能 | 包含组件 |
|------|------|---------|
| `Layout.vue` | 布局容器 | 侧边筛选 + 主内容区 |
| `Dashboard.vue` | 经营驾驶舱 | KPI卡片 + 排行榜 + AI洞察 |
| `SalesAnalysis.vue` | 销售分析 | 多维度图表 + 下钻 |
| `FinanceAnalysis.vue` | 财务分析 | 利润/成本/应收图表 |
| `ExcelUpload.vue` | Excel上传 | 上传 + 字段映射预览 |
| `AIQuery.vue` | AI问答 | 对话界面 + 数据卡片 |

**经营驾驶舱布局**:

```vue
<!-- views/analytics/smart-bi/Dashboard.vue -->
<template>
  <div class="executive-dashboard">
    <!-- KPI 卡片区 -->
    <el-row :gutter="16" class="kpi-section">
      <el-col :span="6" v-for="kpi in kpiCards" :key="kpi.key">
        <KPICard
          :title="kpi.title"
          :value="kpi.value"
          :change="kpi.change"
          :status="kpi.status"
        />
      </el-col>
    </el-row>

    <!-- 排行榜区 -->
    <el-row :gutter="16" class="ranking-section">
      <el-col :span="12">
        <RankingChart title="部门业绩排行" :data="deptRanking" />
      </el-col>
      <el-col :span="12">
        <RankingChart title="区域业绩排行" :data="regionRanking" />
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-section">
      <el-col :span="14">
        <TrendChart title="销售额趋势" :data="salesTrend" :height="300" />
      </el-col>
      <el-col :span="10">
        <PieChart title="产品销售占比" :data="productPie" :height="300" />
      </el-col>
    </el-row>

    <!-- AI 洞察区 -->
    <div class="ai-insights-section">
      <h3><el-icon><MagicStick /></el-icon> AI 智能洞察</h3>
      <div class="insights-content">
        <div v-for="insight in aiInsights" :key="insight.id"
             :class="['insight-item', `level-${insight.level}`]">
          <el-tag :type="getTagType(insight.level)" size="small">
            {{ insight.level === 'red' ? '预警' : insight.level === 'yellow' ? '关注' : '亮点' }}
          </el-tag>
          <span>{{ insight.text }}</span>
        </div>
      </div>
    </div>

    <!-- 快捷问答区 -->
    <div class="quick-query-section">
      <h3>快速提问</h3>
      <div class="quick-buttons">
        <el-button v-for="q in quickQuestions" :key="q" @click="handleQuickQuery(q)">
          {{ q }}
        </el-button>
      </div>
      <el-input
        v-model="userQuery"
        placeholder="输入您的问题..."
        @keyup.enter="handleQuery"
      >
        <template #append>
          <el-button @click="handleQuery">
            <el-icon><Search /></el-icon>
          </el-button>
        </template>
      </el-input>
    </div>
  </div>
</template>
```

#### 任务 8C: API 服务

**文件**: `web-admin/src/api/smartbi.ts`

```typescript
import request from './request';

export interface AnalysisParams {
  startDate: string;
  endDate: string;
  department?: string;
  region?: string;
  dimension?: string;
}

export const smartBIApi = {
  // Excel上传
  uploadExcel(file: File, dataType: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);
    return request.post('/smart-bi/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 分析接口
  getSalesAnalysis: (params: AnalysisParams) =>
    request.get('/smart-bi/analysis/sales', { params }),

  getDepartmentAnalysis: (params: AnalysisParams) =>
    request.get('/smart-bi/analysis/department', { params }),

  getRegionAnalysis: (params: AnalysisParams) =>
    request.get('/smart-bi/analysis/region', { params }),

  getFinanceAnalysis: (params: AnalysisParams) =>
    request.get('/smart-bi/analysis/finance', { params }),

  // 老板看板
  getExecutiveDashboard: (period: string) =>
    request.get('/smart-bi/dashboard/executive', { params: { period } }),

  // 自然语言问答
  query: (userInput: string, context?: QueryContext) =>
    request.post('/smart-bi/query', { user_input: userInput, context }),

  // 数据下钻
  drillDown: (dimension: string, filterValue: string, parentContext: any) =>
    request.post('/smart-bi/drill-down', { dimension, filter_value: filterValue, parent_context: parentContext }),

  // AI分析生成
  generateAIAnalysis: (analysisType: string, timeRange: DateRange, scope?: string) =>
    request.post('/smart-bi/ai-analysis', { analysis_type: analysisType, time_range: timeRange, scope }),
};
```

---

## 五、完整实施时间线

```
Week 1-2: Phase 1 (后端基础设施)
├── 1A: Excel解析 ────────┐
├── 1B: 核心服务 ─────────┼── 并行
└── 1C: 数据库设计 ───────┘

Week 3-4: Phase 2 (后端分析模块)
├── 2A: 销售分析 ─────────┐
├── 2B: 部门分析 ─────────┼── 并行
├── 2C: 区域分析 ─────────┤
└── 2D: 财务分析 ─────────┘

Week 5-6: Phase 3 (后端AI层)
├── 3A: Prompt服务 ───────┐
├── 3B: 意图识别 ─────────┼── 并行
└── 3C: 推荐算法 ─────────┘

Week 6-7: Phase 4 (后端API层)
├── 4A: Controller ───────┐
├── 4B: 图表配置 ─────────┼── 并行
└── 4C: 问答API ──────────┘

Week 7-8: Phase 5-6 (移动端)
├── 5A: 权限扩展 ─────────┐
├── 5B: 导航修改 ─────────┤
├── 6A: 图表组件 ─────────┼── 部分并行
├── 6B: 页面开发 ─────────┤
└── 6C: API服务 ──────────┘

Week 8-9: Phase 7-8 (Web端)
├── 7A: 权限矩阵 ─────────┐
├── 7B: 菜单配置 ─────────┤
├── 7C: 路由配置 ─────────┼── 部分并行
├── 8A: ECharts组件 ──────┤
├── 8B: 页面开发 ─────────┤
└── 8C: API服务 ──────────┘

Week 10: 集成测试 + 优化
```

---

## 六、文件清单汇总

### 后端新增文件

```
backend-java/src/main/java/com/cretas/aims/
├── controller/
│   └── SmartBIController.java
├── service/smartbi/
│   ├── SmartBIService.java
│   ├── SmartBIServiceImpl.java
│   ├── DynamicExcelParser.java
│   ├── FieldMappingEngine.java
│   ├── DataFeatureAnalyzer.java
│   ├── MetricCalculator.java
│   ├── ChartRecommender.java
│   ├── SalesAnalysisService.java
│   ├── DepartmentAnalysisService.java
│   ├── RegionAnalysisService.java
│   ├── FinanceAnalysisService.java
│   ├── SmartBIPromptService.java
│   ├── SmartBIIntentService.java
│   └── RecommendationService.java
├── dto/smartbi/
│   ├── ExcelParseResultDTO.java
│   ├── FieldMappingDTO.java
│   ├── SalesMetricsDTO.java
│   ├── DepartmentMetricsDTO.java
│   ├── RegionMetricsDTO.java
│   ├── FinanceMetricsDTO.java
│   ├── ChartConfigDTO.java
│   ├── DashboardConfigDTO.java
│   ├── IntentResultDTO.java
│   ├── QueryRequestDTO.java
│   └── QueryResponseDTO.java
├── entity/smartbi/
│   ├── SmartBIDataset.java
│   ├── SmartBIFieldMapping.java
│   └── SmartBIQueryLog.java
└── repository/smartbi/
    ├── SmartBIDatasetRepository.java
    ├── SmartBIFieldMappingRepository.java
    └── SmartBIQueryLogRepository.java

backend-java/src/main/resources/
├── db/migration/
│   └── V2026_01_19_01__smart_bi_tables.sql
├── config/smartbi/
│   ├── field_synonyms.json
│   ├── metric_definitions.json
│   ├── chart_templates.json
│   ├── intent_patterns.json
│   └── alert_thresholds.json
└── prompts/smartbi/
    ├── overview_analysis.md
    ├── sales_analysis.md
    ├── department_analysis.md
    ├── region_analysis.md
    ├── finance_analysis.md
    └── qa_general.md
```

### 移动端新增文件

```
frontend/CretasFoodTrace/src/
├── components/smartbi/
│   ├── MobileLineChart.tsx
│   ├── MobileBarChart.tsx
│   ├── MobilePieChart.tsx
│   ├── MobileKPICard.tsx
│   ├── MobileRankingList.tsx
│   └── MobileHeatmap.tsx
├── screens/smartbi/
│   ├── ExecutiveDashboardScreen.tsx
│   ├── SalesAnalysisScreen.tsx
│   ├── FinanceAnalysisScreen.tsx
│   ├── ExcelUploadScreen.tsx
│   └── NLQueryScreen.tsx
├── services/api/
│   └── smartbi.ts
├── constants/
│   └── chartSizes.ts
└── types/
    └── smartbi.ts
```

### Web端新增文件

```
web-admin/src/
├── components/smartbi/
│   ├── TrendChart.vue
│   ├── RankingChart.vue
│   ├── PieChart.vue
│   ├── GaugeChart.vue
│   ├── HeatmapChart.vue
│   ├── ScatterChart.vue
│   ├── CombinedChart.vue
│   ├── MapChart.vue
│   └── KPICard.vue
├── views/analytics/smart-bi/
│   ├── Layout.vue
│   ├── Dashboard.vue
│   ├── SalesAnalysis.vue
│   ├── FinanceAnalysis.vue
│   ├── ExcelUpload.vue
│   └── AIQuery.vue
├── api/
│   └── smartbi.ts
└── types/
    └── smartbi.ts
```

---

## 七、并行工作建议

### Subagent 并行（单Chat内）
✅ **适合**：
- Phase 1 的 1A/1B/1C 可完全并行
- Phase 2 的 2A/2B/2C/2D 可完全并行
- Phase 5-6 移动端与 Phase 7-8 Web端可并行

### 多Chat窗口并行
✅ **适合**：
- 后端开发（Phase 1-4）与前端开发（Phase 5-8）可分开进行
- 移动端（Phase 5-6）与 Web端（Phase 7-8）可分开进行

⚠️ **注意冲突**：
- 权限配置文件可能有冲突（permissionHelper.ts / permission.ts）
- API 类型定义应保持同步

---

*文档结束*
