<script setup lang="ts">
/**
 * DynamicChartsSection - 动态图表区域
 * 遍历 charts 对象，过滤无数据图表，自动布局
 */
import type { ChartConfig } from '@/types/smartbi';
import { chartHasData } from '@/types/smartbi';
import DynamicChartRenderer from './DynamicChartRenderer.vue';

interface Props {
  charts: Record<string, ChartConfig>;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});

/** 获取有数据的图表列表 */
function getValidCharts(charts: Record<string, ChartConfig>): Array<{ key: string; config: ChartConfig }> {
  return Object.entries(charts)
    .filter(([, config]) => chartHasData(config))
    .map(([key, config]) => ({ key, config }));
}

/** 获取图表标题 */
function getChartTitle(key: string, config: ChartConfig): string {
  if ('title' in config && config.title) return config.title;
  return key;
}

/** 根据图表类型决定列宽 */
function getColSpan(config: ChartConfig, totalCharts: number): { lg: number; md: number } {
  // 只有一个图表时占满
  if (totalCharts === 1) return { lg: 24, md: 24 };

  const chartType = ('chartType' in config ? config.chartType : '').toLowerCase();

  if (chartType === 'pie') {
    return { lg: 10, md: 12 };
  }
  return { lg: 14, md: 12 };
}
</script>

<template>
  <el-row :gutter="16" class="dynamic-charts-section" v-loading="loading">
    <el-col
      v-for="{ key, config } in getValidCharts(charts)"
      :key="key"
      :xs="24"
      :lg="getColSpan(config, getValidCharts(charts).length).lg"
      :md="getColSpan(config, getValidCharts(charts).length).md"
      class="chart-col"
    >
      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>{{ getChartTitle(key, config) }}</span>
          </div>
        </template>
        <DynamicChartRenderer :config="config" :height="320" />
      </el-card>
    </el-col>
    <el-col v-if="getValidCharts(charts).length === 0 && !loading" :span="24">
      <el-empty description="暂无图表数据" :image-size="80" />
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
.dynamic-charts-section {
  margin-bottom: 16px;

  .chart-col {
    margin-bottom: 16px;
  }
}

.chart-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #303133;
  }
}
</style>
