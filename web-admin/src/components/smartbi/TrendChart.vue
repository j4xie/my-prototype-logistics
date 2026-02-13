<script setup lang="ts">
/**
 * SmartBI TrendChart - Trend Line/Area Chart Component
 * Features: Time granularity switch, multi-series comparison, target line,
 *           prediction line, anomaly detection, data table
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface TrendDataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

export interface TrendSeries {
  name: string;
  data: TrendDataPoint[];
  color?: string;
  type?: 'line' | 'area';
}

export interface PredictionDataPoint {
  date: string;
  value: number;
  confidence?: number;
}

interface TableRowData {
  period: string;
  value: number;
  change: number;
  changePercent: string;
  yoyPercent: string;
  isAnomaly: boolean;
}

interface Props {
  title?: string;
  series: TrendSeries[];
  height?: number;
  showTarget?: boolean;
  targetValue?: number;
  targetLabel?: string;
  showGranularity?: boolean;
  defaultGranularity?: 'day' | 'week' | 'month';
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisUnit?: string;
  smooth?: boolean;
  showDataZoom?: boolean;
  // New props for enhancements
  showPrediction?: boolean;
  predictionData?: PredictionDataPoint[];
  showAnomalies?: boolean;
  anomalyThreshold?: number;
  showDataTable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  showTarget: false,
  targetValue: 0,
  targetLabel: 'Target',
  showGranularity: true,
  defaultGranularity: 'day',
  xAxisLabel: '',
  yAxisLabel: '',
  yAxisUnit: '',
  smooth: true,
  showDataZoom: false,
  // New props defaults
  showPrediction: false,
  predictionData: () => [],
  showAnomalies: false,
  anomalyThreshold: 2,
  showDataTable: false
});

const emit = defineEmits<{
  (e: 'granularityChange', value: 'day' | 'week' | 'month'): void;
  (e: 'pointClick', data: { seriesName: string; dataPoint: TrendDataPoint }): void;
  (e: 'tableRowClick', data: TableRowData): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
const granularity = ref<'day' | 'week' | 'month'>(props.defaultGranularity);
const selectedRowIndex = ref<number | null>(null);

// Default color palette
const colorPalette = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
];

const predictionColor = '#9b59b6';

// Compute anomaly points based on threshold (using z-score method)
const anomalyPoints = computed(() => {
  if (!props.showAnomalies || !props.series.length) return [];

  const mainSeries = props.series[0];
  const values = mainSeries.data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

  if (stdDev === 0) return [];

  return mainSeries.data
    .map((d, index) => {
      const zScore = Math.abs((d.value - mean) / stdDev);
      return { ...d, index, zScore, isAnomaly: zScore > props.anomalyThreshold };
    })
    .filter(d => d.isAnomaly);
});

// Compute table data from first series
const tableData = computed<TableRowData[]>(() => {
  if (!props.series.length) return [];

  const mainSeries = props.series[0];
  const data = mainSeries.data;

  return data.map((point, index) => {
    const prevValue = index > 0 ? data[index - 1].value : point.value;
    const change = point.value - prevValue;
    const changePercent = prevValue !== 0
      ? ((change / prevValue) * 100).toFixed(1) + '%'
      : '0%';

    // YoY calculation (assuming 12 periods back for yearly comparison)
    const yoyIndex = index - 12;
    const yoyValue = yoyIndex >= 0 ? data[yoyIndex].value : null;
    const yoyPercent = yoyValue && yoyValue !== 0
      ? (((point.value - yoyValue) / yoyValue) * 100).toFixed(1) + '%'
      : 'N/A';

    const isAnomaly = anomalyPoints.value.some(a => a.index === index);

    return {
      period: point.date,
      value: point.value,
      change,
      changePercent,
      yoyPercent,
      isAnomaly
    };
  });
});

const chartOptions = computed<EChartsOption>(() => {
  // Extract all unique dates from series and prediction data
  const seriesDates = props.series.flatMap(s => s.data.map(d => d.date));
  const predictionDates = props.showPrediction && props.predictionData
    ? props.predictionData.map(d => d.date)
    : [];
  const allDates = [...new Set([...seriesDates, ...predictionDates])].sort();

  // Build anomaly markPoints for main series
  const anomalyMarkPoints = props.showAnomalies && anomalyPoints.value.length > 0
    ? anomalyPoints.value.map(a => ({
        name: 'Anomaly',
        coord: [a.date, a.value],
        value: a.value,
        symbol: 'pin',
        symbolSize: 40,
        itemStyle: {
          color: '#f56c6c'
        },
        label: {
          show: true,
          formatter: '!',
          color: '#fff',
          fontWeight: 'bold'
        }
      }))
    : [];

  // Build series data
  const seriesData = props.series.map((s, index) => {
    const seriesType = s.type || 'line';
    const dataMap = new Map(s.data.map(d => [d.date, d.value]));
    const values = allDates.map(date => dataMap.get(date) ?? null);

    // Build markLine for target (only on first series)
    const markLine = index === 0 && props.showTarget && props.targetValue
      ? {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: '#f56c6c',
            type: 'dashed' as const,
            width: 2
          },
          data: [
            {
              yAxis: props.targetValue,
              label: {
                show: true,
                formatter: props.targetLabel,
                position: 'end' as const,
                color: '#f56c6c',
                fontWeight: 'bold' as const
              }
            }
          ]
        }
      : undefined;

    // Add markPoint for anomalies on first series
    const markPoint = index === 0 && props.showAnomalies && anomalyMarkPoints.length > 0
      ? { data: anomalyMarkPoints }
      : undefined;

    const baseConfig: echarts.LineSeriesOption = {
      name: s.name,
      type: 'line',
      data: values,
      smooth: props.smooth,
      itemStyle: {
        color: s.color || colorPalette[index % colorPalette.length]
      },
      lineStyle: {
        width: 2
      },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: 2
        }
      },
      markLine,
      markPoint
    };

    if (seriesType === 'area') {
      return {
        ...baseConfig,
        areaStyle: {
          opacity: 0.3
        }
      };
    }

    return baseConfig;
  });

  // Add prediction line if enabled
  if (props.showPrediction && props.predictionData && props.predictionData.length > 0) {
    const predictionMap = new Map(props.predictionData.map(d => [d.date, d.value]));
    const predictionValues = allDates.map(date => predictionMap.get(date) ?? null);

    seriesData.push({
      name: 'Prediction',
      type: 'line',
      data: predictionValues,
      smooth: props.smooth,
      lineStyle: {
        type: 'dashed',
        width: 2,
        color: predictionColor
      },
      itemStyle: {
        color: predictionColor
      },
      symbol: 'diamond',
      symbolSize: 6,
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: 2
        }
      }
    } as echarts.LineSeriesOption);
  }

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.axisValue || '';
        const isAnomaly = anomalyPoints.value.some(a => a.date === date);
        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${date}${isAnomaly ? ' <span style="color:#f56c6c;">(Anomaly)</span>' : ''}</div>`;
        params.forEach((param) => {
          if (param.value !== null && param.value !== undefined) {
            html += `
              <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
                <span>${param.seriesName}: </span>
                <span style="font-weight: 600;">${param.value}${props.yAxisUnit}</span>
              </div>
            `;
          }
        });
        return html;
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#606266',
        fontSize: 12
      }
    },
    grid: {
      top: 20,
      right: 20,
      bottom: props.showDataZoom ? 80 : 50,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: allDates,
      name: props.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 30,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#dcdfe6'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#909399',
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: props.yAxisLabel ? `${props.yAxisLabel}${props.yAxisUnit ? ` (${props.yAxisUnit})` : ''}` : '',
      nameLocation: 'middle',
      nameGap: 45,
      nameTextStyle: {
        color: '#909399'
      },
      splitLine: {
        lineStyle: {
          color: '#ebeef5',
          type: 'dashed'
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#909399',
        fontSize: 11
      }
    },
    series: seriesData
  };

  // Add data zoom if enabled
  if (props.showDataZoom) {
    options.dataZoom = [
      {
        type: 'slider',
        show: true,
        xAxisIndex: 0,
        start: 0,
        end: 100,
        bottom: 30,
        height: 20,
        borderColor: '#dcdfe6',
        fillerColor: 'rgba(64, 158, 255, 0.2)',
        handleStyle: {
          color: '#409eff'
        }
      },
      {
        type: 'inside',
        xAxisIndex: 0
      }
    ];
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const series = props.series.find(s => s.name === params.seriesName);
      if (series) {
        emit('pointClick', {
          seriesName: params.seriesName as string,
          dataPoint: series.data[params.dataIndex]
        });
      }
    }
  });
}

function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

function handleResize() {
  chartInstance.value?.resize();
}

function onGranularityChange(value: 'day' | 'week' | 'month') {
  emit('granularityChange', value);
}

function onTableRowClick(row: TableRowData) {
  const index = tableData.value.findIndex(d => d.period === row.period);
  selectedRowIndex.value = index;

  // Highlight the corresponding point on the chart
  if (chartInstance.value && index >= 0) {
    chartInstance.value.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: index
    });
    chartInstance.value.dispatchAction({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex: index
    });
  }

  emit('tableRowClick', row);
}

function getTableRowClass({ row, rowIndex }: { row: TableRowData; rowIndex: number }) {
  const classes: string[] = [];
  if (rowIndex === selectedRowIndex.value) {
    classes.push('selected-row');
  }
  if (row.isAnomaly) {
    classes.push('anomaly-row');
  }
  return classes.join(' ');
}

function formatValue(value: number): string {
  return value.toLocaleString() + props.yAxisUnit;
}

function formatChange(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return prefix + value.toLocaleString() + props.yAxisUnit;
}

// Lifecycle
onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

// Watch for data changes
watch(() => props.series, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="trend-chart">
    <div v-if="title || showGranularity" class="chart-header">
      <h3 v-if="title">{{ title }}</h3>
      <div class="header-controls">
        <el-tag v-if="showAnomalies && anomalyPoints.length > 0" type="warning" size="small">
          {{ anomalyPoints.length }} Anomaly Detected
        </el-tag>
        <el-radio-group
          v-if="showGranularity"
          v-model="granularity"
          size="small"
          @change="onGranularityChange"
        >
          <el-radio-button label="day">Day</el-radio-button>
          <el-radio-button label="week">Week</el-radio-button>
          <el-radio-button label="month">Month</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>

    <!-- Data Table -->
    <div v-if="showDataTable && tableData.length > 0" class="data-table-container">
      <el-table
        :data="tableData"
        :row-class-name="getTableRowClass"
        size="small"
        max-height="250"
        stripe
        @row-click="onTableRowClick"
      >
        <el-table-column prop="period" label="Period" sortable width="120" />
        <el-table-column prop="value" label="Value" sortable align="right">
          <template #default="{ row }">
            {{ formatValue(row.value) }}
          </template>
        </el-table-column>
        <el-table-column prop="change" label="Change" sortable align="right">
          <template #default="{ row }">
            <span :class="{ 'positive': row.change > 0, 'negative': row.change < 0 }">
              {{ formatChange(row.change) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="changePercent" label="Change %" sortable align="right">
          <template #default="{ row }">
            <span :class="{ 'positive': row.change > 0, 'negative': row.change < 0 }">
              {{ row.changePercent }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="yoyPercent" label="YoY %" sortable align="right">
          <template #default="{ row }">
            <span v-if="row.yoyPercent !== 'N/A'"
                  :class="{ 'positive': parseFloat(row.yoyPercent) > 0, 'negative': parseFloat(row.yoyPercent) < 0 }">
              {{ row.yoyPercent }}
            </span>
            <span v-else class="na-value">{{ row.yoyPercent }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isAnomaly" type="danger" size="small">Anomaly</el-tag>
            <el-tag v-else type="success" size="small">Normal</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.trend-chart {
  width: 100%;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .data-table-container {
    margin-top: 20px;
    border-top: 1px solid #ebeef5;
    padding-top: 16px;

    :deep(.el-table) {
      .selected-row {
        background-color: rgba(64, 158, 255, 0.1) !important;

        td {
          background-color: rgba(64, 158, 255, 0.1) !important;
        }
      }

      .anomaly-row {
        td {
          color: #f56c6c;
        }
      }

      .el-table__row {
        cursor: pointer;

        &:hover > td {
          background-color: rgba(64, 158, 255, 0.05) !important;
        }
      }
    }

    .positive {
      color: #67c23a;
    }

    .negative {
      color: #f56c6c;
    }

    .na-value {
      color: #909399;
    }
  }
}
</style>
