<script setup lang="ts">
/**
 * 图表类型测试页面
 * 用于验证所有支持的图表类型都能正确渲染
 */
import { ref } from 'vue';
import DynamicChartRenderer from '@/components/smartbi/DynamicChartRenderer.vue';
import type { LegacyChartConfig } from '@/types/smartbi';

// 测试数据 - 覆盖所有图表类型
const testCharts = ref<Record<string, LegacyChartConfig>>({
  // 1. BAR 柱状图
  barChart: {
    chartType: 'BAR',
    title: '月度销售额',
    xAxisField: 'month',
    yAxisField: 'value',
    data: [
      { month: '1月', value: 12000 },
      { month: '2月', value: 15000 },
      { month: '3月', value: 18000 },
      { month: '4月', value: 22000 },
      { month: '5月', value: 19000 },
      { month: '6月', value: 25000 },
    ],
  },

  // 2. LINE 折线图
  lineChart: {
    chartType: 'LINE',
    title: '趋势分析',
    xAxisField: 'date',
    yAxisField: 'amount',
    data: [
      { date: '周一', amount: 820 },
      { date: '周二', amount: 932 },
      { date: '周三', amount: 901 },
      { date: '周四', amount: 934 },
      { date: '周五', amount: 1290 },
      { date: '周六', amount: 1330 },
      { date: '周日', amount: 1320 },
    ],
  },

  // 3. PIE 饼图
  pieChart: {
    chartType: 'PIE',
    title: '销售构成',
    xAxisField: 'category',
    yAxisField: 'value',
    data: [
      { category: '华东区', value: 335 },
      { category: '华南区', value: 310 },
      { category: '华北区', value: 234 },
      { category: '西南区', value: 135 },
      { category: '西北区', value: 105 },
    ],
  },

  // 4. WATERFALL 瀑布图
  waterfallChart: {
    chartType: 'WATERFALL',
    title: '预算执行瀑布图',
    xAxisField: 'name',
    yAxisField: 'value',
    data: [
      { name: '年度预算', value: 1000000 },
      { name: '已执行', value: 650000 },
      { name: '剩余预算', value: 350000 },
    ],
  },

  // 5. LINE_BAR 复合图（预算达成）
  lineBarChart: {
    chartType: 'LINE_BAR',
    title: '预算达成分析',
    data: [
      { month: '1月', budget: 10000, actual: 9500, achievementRate: 95 },
      { month: '2月', budget: 12000, actual: 11000, achievementRate: 92 },
      { month: '3月', budget: 15000, actual: 16500, achievementRate: 110 },
      { month: '4月', budget: 13000, actual: 12000, achievementRate: 92 },
      { month: '5月', budget: 18000, actual: 19000, achievementRate: 106 },
      { month: '6月', budget: 20000, actual: 18500, achievementRate: 93 },
    ],
  },

  // 6. RADAR 雷达图
  radarChart: {
    chartType: 'RADAR',
    title: '能力评估雷达图',
    xAxisField: 'dimension',
    yAxisField: 'score',
    data: [
      { dimension: '销售能力', score: 85 },
      { dimension: '服务质量', score: 90 },
      { dimension: '技术水平', score: 78 },
      { dimension: '团队协作', score: 92 },
      { dimension: '创新能力', score: 70 },
      { dimension: '执行效率', score: 88 },
    ],
  },

  // 7. SCATTER 散点图
  scatterChart: {
    chartType: 'SCATTER',
    title: '销售-利润相关性',
    xAxisField: 'sales',
    yAxisField: 'profit',
    data: [
      { sales: 100, profit: 20 },
      { sales: 150, profit: 35 },
      { sales: 200, profit: 45 },
      { sales: 250, profit: 55 },
      { sales: 300, profit: 70 },
      { sales: 350, profit: 80 },
      { sales: 400, profit: 95 },
      { sales: 450, profit: 100 },
    ],
  },

  // 8. AREA 面积图
  areaChart: {
    chartType: 'AREA',
    title: '累计增长趋势',
    xAxisField: 'month',
    yAxisField: 'total',
    data: [
      { month: '1月', total: 5000 },
      { month: '2月', total: 12000 },
      { month: '3月', total: 22000 },
      { month: '4月', total: 35000 },
      { month: '5月', total: 50000 },
      { month: '6月', total: 68000 },
    ],
  },

  // 9. GAUGE 仪表盘
  gaugeChart: {
    chartType: 'GAUGE',
    title: 'KPI 完成率',
    xAxisField: 'name',
    yAxisField: 'value',
    data: [
      { name: '销售目标', value: 78 },
    ],
  },

  // 10. FUNNEL 漏斗图
  funnelChart: {
    chartType: 'FUNNEL',
    title: '销售漏斗',
    xAxisField: 'stage',
    yAxisField: 'count',
    data: [
      { stage: '访问', count: 1000 },
      { stage: '咨询', count: 600 },
      { stage: '意向', count: 300 },
      { stage: '成交', count: 100 },
      { stage: '复购', count: 30 },
    ],
  },

  // 11. STACKED_BAR 堆叠柱状图
  stackedBarChart: {
    chartType: 'STACKED_BAR',
    title: '分类销售堆叠图',
    xAxisField: 'month',
    data: [
      { month: '1月', 产品A: 120, 产品B: 80, 产品C: 50 },
      { month: '2月', 产品A: 150, 产品B: 100, 产品C: 70 },
      { month: '3月', 产品A: 180, 产品B: 120, 产品C: 90 },
      { month: '4月', 产品A: 200, 产品B: 150, 产品C: 100 },
    ],
  },

  // 12. DOUGHNUT 环形图
  doughnutChart: {
    chartType: 'DOUGHNUT',
    title: '费用构成',
    xAxisField: 'type',
    yAxisField: 'amount',
    data: [
      { type: '人工成本', amount: 45000 },
      { type: '材料成本', amount: 32000 },
      { type: '运营费用', amount: 18000 },
      { type: '营销费用', amount: 12000 },
      { type: '其他费用', amount: 8000 },
    ],
  },

  // 13. TREEMAP 树图
  treemapChart: {
    chartType: 'TREEMAP',
    title: '区域销售分布',
    xAxisField: 'region',
    yAxisField: 'sales',
    data: [
      { region: '华东', sales: 150000 },
      { region: '华南', sales: 120000 },
      { region: '华北', sales: 100000 },
      { region: '西南', sales: 80000 },
      { region: '西北', sales: 50000 },
      { region: '东北', sales: 40000 },
    ],
  },

  // 14. MAP 地图
  mapChart: {
    chartType: 'MAP',
    title: '全国销售热力图',
    xAxisField: 'province',
    yAxisField: 'value',
    data: [
      { province: '广东', value: 85000 },
      { province: '江苏', value: 72000 },
      { province: '浙江', value: 68000 },
      { province: '山东', value: 55000 },
      { province: '四川', value: 48000 },
      { province: '河南', value: 42000 },
      { province: '北京', value: 38000 },
      { province: '上海', value: 35000 },
      { province: '湖北', value: 32000 },
      { province: '福建', value: 28000 },
    ],
  },
});

const chartTypes = Object.keys(testCharts.value);
</script>

<template>
  <div class="chart-test-page">
    <h1>SmartBI 图表类型测试</h1>
    <p class="subtitle">验证所有 {{ chartTypes.length }} 种图表类型正确渲染</p>

    <el-row :gutter="20">
      <el-col
        v-for="(config, key) in testCharts"
        :key="key"
        :xs="24"
        :sm="12"
        :lg="8"
      >
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="chart-type">{{ config.chartType }}</span>
              <span class="chart-title">{{ config.title }}</span>
            </div>
          </template>
          <DynamicChartRenderer :config="config" :height="300" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.chart-test-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  h1 {
    text-align: center;
    color: #303133;
    margin-bottom: 8px;
  }

  .subtitle {
    text-align: center;
    color: var(--color-text-secondary);
    margin-bottom: 24px;
  }
}

.chart-card {
  margin-bottom: 20px;
  border-radius: var(--radius-md);

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;

    .chart-type {
      background: #409eff;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .chart-title {
      color: #303133;
      font-weight: 500;
    }
  }
}
</style>
