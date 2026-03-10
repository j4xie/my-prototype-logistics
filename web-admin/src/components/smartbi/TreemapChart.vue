<script setup lang="ts">
/**
 * SmartBI TreemapChart - Power BI-level Treemap for Hierarchical Data
 * Features: Breadcrumb navigation, color modes, upper labels, drill-down, KPI row
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface TreemapNode {
  name: string;
  value: number;
  children?: TreemapNode[];
  itemStyle?: { color?: string };
  percentage?: number;
  growth?: number;
}

interface Props {
  title?: string;
  data: TreemapNode[];
  height?: string;
  loading?: boolean;
  colorMode?: 'category' | 'value' | 'growth';
  showBreadcrumb?: boolean;
  showLabels?: boolean;
  roam?: boolean;
  leafDepth?: number;
  unit?: string;
  echartsOption?: Record<string, unknown>;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '500px',
  loading: false,
  colorMode: 'category',
  showBreadcrumb: true,
  showLabels: true,
  roam: false,
  leafDepth: 1,
  unit: '',
});

const emit = defineEmits<{
  (e: 'nodeClick', node: TreemapNode): void;
  (e: 'drillDown', path: string[]): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// Color palette for category mode
const PALETTE = ['#1B65A8', '#36B37E', '#FFAB00', '#FF5630', '#6B778C', '#00B8D9', '#6554C0', '#FF8B00', '#4C9AFF', '#57D9A3'];

function formatValue(v: number): string {
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿';
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  if (v >= 1000) return (v / 1000).toFixed(1) + '千';
  return v.toFixed(0);
}

// KPI summary
const kpiSummary = computed(() => {
  const totalValue = props.data.reduce((sum, n) => sum + n.value, 0);
  const sorted = [...props.data].sort((a, b) => b.value - a.value);
  const top3Sum = sorted.slice(0, 3).reduce((sum, n) => sum + n.value, 0);
  const largest = sorted[0];
  return {
    totalValue,
    categoryCount: props.data.length,
    largestName: largest?.name || '-',
    largestValue: largest?.value || 0,
    top3Concentration: totalValue > 0 ? (top3Sum / totalValue * 100).toFixed(1) : '0',
  };
});

// Assign colors to top-level nodes
const coloredData = computed<TreemapNode[]>(() => {
  if (props.colorMode !== 'category') return props.data;
  return props.data.map((node, i) => {
    const baseColor = node.itemStyle?.color || PALETTE[i % PALETTE.length];
    function assignColor(n: TreemapNode, color: string, alpha: number): TreemapNode {
      return {
        ...n,
        itemStyle: { ...n.itemStyle, color: alpha < 1 ? hexToRgba(color, alpha) : color },
        children: n.children?.map((c, ci) => assignColor(c, color, Math.max(0.4, alpha - 0.15 * ci))),
      };
    }
    return assignColor(node, baseColor, 1);
  });
});

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const chartOptions = computed<EChartsOption>(() => {
  if (props.echartsOption && Object.keys(props.echartsOption).length > 0) {
    return props.echartsOption as EChartsOption;
  }

  const totalValue = kpiSummary.value.totalValue;

  // Base series config
  const baseSeries: Record<string, unknown> = {
    type: 'treemap',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    right: 0,
    bottom: props.showBreadcrumb ? 40 : 0,
    leafDepth: props.leafDepth,
    roam: props.roam,
    data: coloredData.value,
    breadcrumb: {
      show: props.showBreadcrumb,
      bottom: 4,
      height: 28,
      itemStyle: {
        color: '#f5f7fa',
        borderColor: '#dcdfe6',
        borderWidth: 1,
        textStyle: { color: '#606266', fontSize: 12, fontWeight: 500 },
      },
      emphasis: {
        itemStyle: {
          color: '#e6f0ff',
          textStyle: { color: '#1B65A8', fontWeight: 600 },
        },
      },
    },
    label: props.showLabels
      ? {
          show: true,
          position: 'insideTopLeft',
          padding: [6, 8],
          formatter: (params: Record<string, unknown>) => {
            const name = params.name as string;
            const value = params.value as number;
            const pct = totalValue > 0 ? (value / totalValue * 100).toFixed(1) : '0';
            const nodeData = params.data as { growth?: number };
            const growthStr = nodeData?.growth !== undefined
              ? `\n{growth|${nodeData.growth >= 0 ? '▲' : '▼'} ${Math.abs(nodeData.growth).toFixed(1)}%}`
              : '';
            // Size-adaptive label: show different detail levels based on area
            const w = (params as { rect?: { width: number } }).rect?.width || 0;
            const h = (params as { rect?: { height: number } }).rect?.height || 0;
            if (w > 120 && h > 70) {
              return `{name|${name}}\n{val|${formatValue(value)}${props.unit}  {pct|${pct}%}}${growthStr}`;
            } else if (w > 60 && h > 40) {
              return `{name|${name}}\n{val|${formatValue(value)}${props.unit}}`;
            }
            return `{name|${name}}`;
          },
          rich: {
            name: { fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 18 },
            val: { fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 16 },
            pct: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
            growth: { fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 15 },
          },
        }
      : { show: false },
    upperLabel: {
      show: true,
      height: 26,
      padding: [0, 8],
      verticalAlign: 'middle',
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.18)',
      formatter: (params: Record<string, unknown>) => {
        const name = params.name as string;
        const value = params.value as number;
        return `${name}  ${formatValue(value)}${props.unit}`;
      },
    },
    itemStyle: {
      gapWidth: 2,
      borderWidth: 2,
      borderColor: '#fff',
    },
    levels: [
      {
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 3,
          gapWidth: 3,
        },
        upperLabel: { show: true },
      },
      {
        itemStyle: {
          borderColor: 'rgba(255,255,255,0.6)',
          borderWidth: 2,
          gapWidth: 2,
        },
        upperLabel: { show: false },
      },
      {
        itemStyle: {
          borderColor: 'rgba(255,255,255,0.4)',
          borderWidth: 1,
          gapWidth: 1,
        },
      },
    ],
    tooltip: {
      confine: true,
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: '#303133', fontSize: 13 },
      formatter: (params: Record<string, unknown>) => {
        const name = params.name as string;
        const value = params.value as number;
        const pct = totalValue > 0 ? (value / totalValue * 100).toFixed(1) : '0';
        const nodeData = params.data as { growth?: number; percentage?: number };
        const treePathInfo = (params as { treePathInfo?: Array<{ name: string; value: number }> }).treePathInfo || [];
        const path = treePathInfo.map((t) => t.name).join(' > ');
        const parentValue = treePathInfo.length > 1 ? treePathInfo[treePathInfo.length - 2]?.value : totalValue;
        const parentPct = parentValue > 0 ? (value / parentValue * 100).toFixed(1) : '0';
        let growthHtml = '';
        if (nodeData?.growth !== undefined) {
          const g = nodeData.growth;
          growthHtml = `<br/><span style="color:#909399;">同比增长：</span><b style="color:${g >= 0 ? '#36B37E' : '#FF5630'}">${g >= 0 ? '+' : ''}${g.toFixed(1)}%</b>`;
        }
        return `
          <div style="font-size:11px;color:#909399;margin-bottom:4px;">${path}</div>
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${name}</div>
          <div style="line-height:1.8;">
            <span style="color:#909399;">金额：</span><b>${formatValue(value)}${props.unit}</b><br/>
            <span style="color:#909399;">占父节点：</span><b style="color:#1B65A8;">${parentPct}%</b><br/>
            <span style="color:#909399;">占总量：</span><b style="color:#6B778C;">${pct}%</b>${growthHtml}
          </div>`;
      },
    },
    emphasis: {
      label: { fontWeight: 700, fontSize: 13 },
      upperLabel: { fontWeight: 700 },
      itemStyle: {
        shadowBlur: 12,
        shadowColor: 'rgba(0,0,0,0.25)',
      },
    },
    animation: true,
    animationEasing: 'quinticInOut',
    animationDuration: 600,
  };

  // Value-based color mode: add visualMap
  if (props.colorMode === 'value') {
    const allValues = props.data.map((n) => n.value);
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    return {
      visualMap: {
        show: false,
        min: minV,
        max: maxV,
        calculable: false,
        inRange: { color: ['#c6e2ff', '#1B65A8'] },
      },
      series: [{ ...baseSeries, colorMappingBy: 'value' }],
    } as EChartsOption;
  }

  // Growth-based color mode
  if (props.colorMode === 'growth') {
    const growthValues = props.data.map((n) => n.growth ?? 0);
    const maxAbsG = Math.max(...growthValues.map(Math.abs), 1);
    return {
      visualMap: {
        show: false,
        min: -maxAbsG,
        max: maxAbsG,
        calculable: false,
        inRange: { color: ['#FF5630', '#f5f7fa', '#36B37E'] },
      },
      series: [{ ...baseSeries, colorMappingBy: 'value', visualDimension: 0 }],
    } as EChartsOption;
  }

  return { series: [baseSeries] } as EChartsOption;
});

function initChart() {
  if (!chartRef.value) return;
  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  chartInstance.value.on('click', (params: Record<string, unknown>) => {
    const name = params.name as string;
    function findNode(nodes: TreemapNode[], n: string): TreemapNode | undefined {
      for (const node of nodes) {
        if (node.name === n) return node;
        if (node.children) {
          const found = findNode(node.children, n);
          if (found) return found;
        }
      }
      return undefined;
    }
    const node = findNode(props.data, name);
    if (node) emit('nodeClick', node);

    const treePathInfo = (params as { treePathInfo?: Array<{ name: string }> }).treePathInfo;
    if (treePathInfo) {
      emit('drillDown', treePathInfo.map((t) => t.name));
    }
  });
}

function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

function handleResize() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    chartInstance.value?.resize();
  });
}

onMounted(() => {
  initChart();
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.value);
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (rafId) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

watch(() => props.data, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

defineExpose({
  chartInstance,
  resize: handleResize,
  getInstance: () => chartInstance.value,
});
</script>

<template>
  <div v-loading="loading" class="treemap-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>

    <!-- KPI Summary Row -->
    <div v-if="data.length > 0" class="kpi-row">
      <div class="kpi-item">
        <span class="kpi-label">总计</span>
        <span class="kpi-value">{{ formatValue(kpiSummary.totalValue) }}{{ unit }}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">类别数</span>
        <span class="kpi-value">{{ kpiSummary.categoryCount }}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">最大类别</span>
        <span class="kpi-value kpi-value--name">{{ kpiSummary.largestName }}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">前3集中度</span>
        <span class="kpi-value kpi-value--pct">{{ kpiSummary.top3Concentration }}%</span>
      </div>
    </div>

    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height }">
      <div
        ref="chartRef"
        role="img"
        :aria-label="title || '矩形树图'"
        style="width: 100%; height: 100%"
      ></div>
      <div v-if="!loading && data.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.treemap-chart {
  width: 100%;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .kpi-row {
    display: flex;
    gap: 0;
    margin-bottom: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #ebeef5;

    .kpi-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 8px;
      border-right: 1px solid #ebeef5;

      &:last-child {
        border-right: none;
      }
    }

    .kpi-label {
      font-size: 11px;
      color: #909399;
      margin-bottom: 4px;
      white-space: nowrap;
    }

    .kpi-value {
      font-size: 14px;
      font-weight: 700;
      color: #303133;

      &--name {
        font-size: 12px;
        color: #1B65A8;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
      }

      &--pct {
        color: #36B37E;
      }
    }
  }

  .chart-wrapper {
    position: relative;
  }

  .chart-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}
</style>
