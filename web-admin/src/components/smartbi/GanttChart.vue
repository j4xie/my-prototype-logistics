<script setup lang="ts">
/**
 * SmartBI GanttChart - Power BI-level Gantt Chart for Timeline Visualization
 * Features: Custom series with renderItem, progress fill, today line, milestones,
 *           dataZoom, zoom level controls, group by category, KPI row
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface GanttTask {
  id: string;
  name: string;
  category?: string;
  start: string;
  end: string;
  progress?: number;
  status?: 'completed' | 'in-progress' | 'delayed' | 'planned';
  color?: string;
  milestone?: boolean;
  dependencies?: string[];
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

interface Props {
  title?: string;
  tasks: GanttTask[];
  height?: string;
  loading?: boolean;
  showToday?: boolean;
  showProgress?: boolean;
  showMilestones?: boolean;
  showDependencies?: boolean;
  zoomLevel?: ZoomLevel;
  groupByCategory?: boolean;
  echartsOption?: Record<string, unknown>;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '500px',
  loading: false,
  showToday: true,
  showProgress: true,
  showMilestones: true,
  showDependencies: false,
  zoomLevel: 'month',
  groupByCategory: true,
});

const emit = defineEmits<{
  (e: 'taskClick', task: GanttTask): void;
  (e: 'taskHover', task: GanttTask): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

const currentZoom = ref<ZoomLevel>(props.zoomLevel);

// Status colors
const STATUS_COLORS: Record<string, string> = {
  completed: '#36B37E',
  'in-progress': '#1B65A8',
  delayed: '#FF5630',
  planned: '#97a8be',
};

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  'in-progress': '进行中',
  delayed: '已延期',
  planned: '计划中',
};

function parseDate(s: string): Date {
  return new Date(s);
}

function formatAxisDate(ts: number, zoom: ZoomLevel): string {
  const d = new Date(ts);
  if (zoom === 'day') return `${d.getMonth() + 1}/${d.getDate()}`;
  if (zoom === 'week') return `W${Math.ceil(d.getDate() / 7)}`;
  if (zoom === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${d.getFullYear()}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}

function dateDiffDays(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
}

// KPI summary
const kpiSummary = computed(() => {
  if (!props.tasks.length) return { total: 0, completedPct: 0, delayedCount: 0, avgProgress: 0 };
  const total = props.tasks.length;
  const completed = props.tasks.filter((t) => t.status === 'completed').length;
  const delayed = props.tasks.filter((t) => t.status === 'delayed').length;
  const avgProgress = Math.round(props.tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / total);
  return {
    total,
    completedPct: Math.round((completed / total) * 100),
    delayedCount: delayed,
    avgProgress,
  };
});

// Sorted tasks (group by category if needed)
const sortedTasks = computed<GanttTask[]>(() => {
  if (!props.groupByCategory) return [...props.tasks];
  const categories = new Map<string, GanttTask[]>();
  props.tasks.forEach((t) => {
    const cat = t.category || '未分类';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(t);
  });
  const result: GanttTask[] = [];
  categories.forEach((tasks) => result.push(...tasks));
  return result;
});

// Y-axis labels (task names)
const yAxisLabels = computed(() => sortedTasks.value.map((t) => t.name));

// Compute time range for x-axis
const timeRange = computed(() => {
  if (!props.tasks.length) {
    const now = new Date();
    return { min: now.getTime() - 86400000 * 30, max: now.getTime() + 86400000 * 30 };
  }
  let min = Infinity;
  let max = -Infinity;
  props.tasks.forEach((t) => {
    const s = parseDate(t.start).getTime();
    const e = parseDate(t.end).getTime();
    if (s < min) min = s;
    if (e > max) max = e;
  });
  const padding = (max - min) * 0.05;
  return { min: min - padding, max: max + padding };
});

// Category boundary indices for visual separators
const categoryBoundaries = computed(() => {
  if (!props.groupByCategory) return [];
  const boundaries: number[] = [];
  let prevCat = sortedTasks.value[0]?.category;
  sortedTasks.value.forEach((t, i) => {
    if (i > 0 && t.category !== prevCat) {
      boundaries.push(i);
      prevCat = t.category;
    }
  });
  return boundaries;
});

// Category group names and positions
const categoryGroups = computed(() => {
  if (!props.groupByCategory) return [];
  const groups: Array<{ name: string; startIdx: number; endIdx: number }> = [];
  let currentCat = sortedTasks.value[0]?.category || '';
  let startIdx = 0;
  sortedTasks.value.forEach((t, i) => {
    const cat = t.category || '未分类';
    if (cat !== currentCat && i > 0) {
      groups.push({ name: currentCat, startIdx, endIdx: i - 1 });
      currentCat = cat;
      startIdx = i;
    }
  });
  if (sortedTasks.value.length > 0) {
    groups.push({ name: currentCat, startIdx, endIdx: sortedTasks.value.length - 1 });
  }
  return groups;
});

const chartOptions = computed<EChartsOption>(() => {
  if (props.echartsOption && Object.keys(props.echartsOption).length > 0) {
    return props.echartsOption as EChartsOption;
  }

  const tasks = sortedTasks.value;
  const taskCount = tasks.length;
  if (!taskCount) {
    return { series: [] } as EChartsOption;
  }

  const todayTs = Date.now();

  // Build chart data: [taskIndex, startTs, endTs, progress, statusColor, taskName, taskId]
  const seriesData = tasks.map((t, i) => {
    const color = t.color || STATUS_COLORS[t.status || 'planned'] || STATUS_COLORS.planned;
    return {
      value: [i, parseDate(t.start).getTime(), parseDate(t.end).getTime(), t.progress ?? 0, color, t.id],
      name: t.name,
    };
  });

  // Mark lines for category boundaries
  const separatorMarkLines = categoryBoundaries.value.map((idx) => ({
    yAxis: idx - 0.5,
  }));

  // Milestone data
  const milestoneData = tasks
    .filter((t) => t.milestone)
    .map((t) => ({
      value: [tasks.indexOf(t), parseDate(t.start).getTime()],
      symbol: 'diamond',
      symbolSize: 14,
      itemStyle: { color: '#FFAB00', borderColor: '#fff', borderWidth: 2 },
      label: {
        show: true,
        formatter: () => '◆',
        position: 'top',
        fontSize: 14,
        color: '#FFAB00',
      },
    }));

  const options: EChartsOption = {
    backgroundColor: 'transparent',
    grid: {
      top: 10,
      left: 0,
      right: 20,
      bottom: 80,
      containLabel: true,
    },
    tooltip: {
      confine: true,
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: '#303133', fontSize: 13 },
      formatter: (params: Record<string, unknown>) => {
        const p = params as { value?: unknown[]; name?: string; seriesType?: string };
        if (p.seriesType !== 'custom') return '';
        const [idx, startTs, endTs, progress] = (p.value as number[]) || [];
        const task = tasks[idx];
        if (!task) return '';
        const days = Math.round(((endTs as number) - (startTs as number)) / 86400000);
        const statusColor = task.color || STATUS_COLORS[task.status || 'planned'];
        const statusLabel = STATUS_LABELS[task.status || 'planned'] || '未知';
        return `
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;border-left:3px solid ${statusColor};padding-left:8px;">${task.name}</div>
          <div style="line-height:1.8;font-size:12px;">
            <span style="color:#909399;">开始：</span><b>${task.start}</b><br/>
            <span style="color:#909399;">结束：</span><b>${task.end}</b><br/>
            <span style="color:#909399;">工期：</span><b>${days} 天</b><br/>
            <span style="color:#909399;">进度：</span><b>${progress ?? 0}%</b><br/>
            <span style="color:#909399;">状态：</span><span style="background:${statusColor};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;">${statusLabel}</span>
          </div>`;
      },
    },
    xAxis: {
      type: 'time',
      min: timeRange.value.min,
      max: timeRange.value.max,
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisTick: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: {
        color: '#909399',
        fontSize: 11,
        formatter: (value: number) => formatAxisDate(value, currentZoom.value),
      },
      splitLine: { show: true, lineStyle: { color: '#f0f0f0', type: 'solid' } },
    },
    yAxis: {
      type: 'category',
      data: yAxisLabels.value,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#606266',
        fontSize: 11,
        width: 100,
        overflow: 'truncate',
      },
      splitLine: { show: true, lineStyle: { color: '#f5f7fa', type: 'solid' } },
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        bottom: 40,
        height: 20,
        startValue: timeRange.value.min,
        endValue: timeRange.value.max,
        borderColor: '#ebeef5',
        fillerColor: 'rgba(27,101,168,0.12)',
        handleStyle: { color: '#1B65A8' },
        textStyle: { color: '#909399', fontSize: 10 },
      },
      {
        type: 'inside',
        xAxisIndex: 0,
        zoomOnMouseWheel: true,
      },
      ...(taskCount > 10
        ? [
            {
              type: 'slider' as const,
              yAxisIndex: 0,
              right: 0,
              width: 16,
              borderColor: '#ebeef5',
              fillerColor: 'rgba(27,101,168,0.12)',
              handleStyle: { color: '#1B65A8' },
              startValue: 0,
              endValue: Math.min(9, taskCount - 1),
            },
          ]
        : []),
    ],
    series: [
      // Custom bars series
      {
        type: 'custom',
        renderItem: (params, api) => {
          const taskIdx = api.value(0) as number;
          const startTs = api.value(1) as number;
          const endTs = api.value(2) as number;
          const progress = api.value(3) as number;
          const task = tasks[taskIdx];
          if (!task) return { type: 'group', children: [] };

          const statusColor = task.color || STATUS_COLORS[task.status || 'planned'] || STATUS_COLORS.planned;

          const startCoord = api.coord([startTs, taskIdx]);
          const endCoord = api.coord([endTs, taskIdx]);
          const barHeight = Math.max(8, (api.size([0, 1]) as number[])[1] * 0.55);
          const barWidth = Math.max(2, endCoord[0] - startCoord[0]);
          const progressWidth = barWidth * Math.min(1, progress / 100);
          const barY = startCoord[1] - barHeight / 2;

          const children: echarts.CustomSeriesRenderItemReturn[] = [
            // Background bar (full duration, light)
            {
              type: 'rect',
              shape: {
                x: startCoord[0],
                y: barY,
                width: barWidth,
                height: barHeight,
                r: 3,
              },
              style: {
                fill: statusColor,
                opacity: 0.2,
                stroke: statusColor,
                lineWidth: 0.5,
              },
            } as echarts.CustomSeriesRenderItemReturn,
          ];

          // Progress fill bar (if showProgress)
          if (props.showProgress && progress > 0) {
            children.push({
              type: 'rect',
              shape: {
                x: startCoord[0],
                y: barY,
                width: progressWidth,
                height: barHeight,
                r: progress >= 100 ? 3 : [3, 0, 0, 3],
              },
              style: { fill: statusColor, opacity: 0.85 },
            } as echarts.CustomSeriesRenderItemReturn);
          }

          // Task name label inside bar (if wide enough)
          if (barWidth > 50) {
            children.push({
              type: 'text',
              style: {
                text: task.name.length > 12 ? task.name.slice(0, 12) + '…' : task.name,
                x: startCoord[0] + 6,
                y: startCoord[1],
                textVerticalAlign: 'middle',
                fontSize: 10,
                fill: '#fff',
                fontWeight: 500,
              },
              z2: 10,
            } as echarts.CustomSeriesRenderItemReturn);
          }

          // Progress text on right
          if (barWidth > 40 && progress !== undefined) {
            children.push({
              type: 'text',
              style: {
                text: `${progress}%`,
                x: endCoord[0] + 4,
                y: startCoord[1],
                textVerticalAlign: 'middle',
                fontSize: 10,
                fill: '#909399',
              },
              z2: 10,
            } as echarts.CustomSeriesRenderItemReturn);
          }

          return { type: 'group', children } as echarts.CustomSeriesRenderItemReturn;
        },
        encode: { x: [1, 2], y: 0 },
        data: seriesData,
        z: 2,
      },
      // Today marker line
      ...(props.showToday
        ? [
            {
              type: 'line' as const,
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { type: 'dashed', color: '#FF5630', width: 2 },
                label: {
                  formatter: '今日',
                  position: 'insideStartTop',
                  color: '#FF5630',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: '#fff0ed',
                  padding: [2, 5],
                  borderRadius: 3,
                },
                data: [{ xAxis: todayTs }],
              },
              data: [],
            },
          ]
        : []),
      // Category separator lines
      ...(props.groupByCategory && categoryBoundaries.value.length > 0
        ? [
            {
              type: 'line' as const,
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { type: 'solid', color: '#c0c4cc', width: 1 },
                label: { show: false },
                data: separatorMarkLines.map((m) => ({ yAxis: m.yAxis })),
              },
              data: [],
            },
          ]
        : []),
      // Milestone scatter
      ...(props.showMilestones && milestoneData.length > 0
        ? [
            {
              type: 'scatter' as const,
              data: milestoneData,
              z: 5,
              symbolSize: 14,
            },
          ]
        : []),
    ],
  };

  return options;
});

function setZoom(zoom: ZoomLevel) {
  currentZoom.value = zoom;
}

function initChart() {
  if (!chartRef.value) return;
  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  chartInstance.value.on('click', (params: Record<string, unknown>) => {
    const p = params as { value?: unknown[]; seriesType?: string };
    if (p.seriesType === 'custom' && Array.isArray(p.value)) {
      const taskIdx = p.value[0] as number;
      const task = sortedTasks.value[taskIdx];
      if (task) emit('taskClick', task);
    }
  });

  chartInstance.value.on('mouseover', (params: Record<string, unknown>) => {
    const p = params as { value?: unknown[]; seriesType?: string };
    if (p.seriesType === 'custom' && Array.isArray(p.value)) {
      const taskIdx = p.value[0] as number;
      const task = sortedTasks.value[taskIdx];
      if (task) emit('taskHover', task);
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

watch(() => props.tasks, updateChart, { deep: true });
watch(currentZoom, updateChart);
watch(chartOptions, updateChart, { deep: true });

defineExpose({
  chartInstance,
  resize: handleResize,
  getInstance: () => chartInstance.value,
});
</script>

<template>
  <div v-loading="loading" class="gantt-chart">
    <div class="gantt-header">
      <h3 v-if="title">{{ title }}</h3>
      <!-- Zoom level buttons -->
      <div class="zoom-controls">
        <button
          v-for="z in ['day', 'week', 'month', 'quarter'] as const"
          :key="z"
          class="zoom-btn"
          :class="{ active: currentZoom === z }"
          @click="setZoom(z)"
        >
          {{ { day: '日', week: '周', month: '月', quarter: '季' }[z] }}
        </button>
      </div>
    </div>

    <!-- KPI Summary Row -->
    <div v-if="tasks.length > 0" class="kpi-row">
      <div class="kpi-item">
        <span class="kpi-label">任务总数</span>
        <span class="kpi-value">{{ kpiSummary.total }}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">完成率</span>
        <span class="kpi-value kpi-value--green">{{ kpiSummary.completedPct }}%</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">延期任务</span>
        <span class="kpi-value" :class="{ 'kpi-value--red': kpiSummary.delayedCount > 0 }">
          {{ kpiSummary.delayedCount }}
        </span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">平均进度</span>
        <span class="kpi-value kpi-value--blue">{{ kpiSummary.avgProgress }}%</span>
      </div>
    </div>

    <!-- Status legend -->
    <div v-if="tasks.length > 0" class="status-legend">
      <span v-for="(color, key) in { completed: '#36B37E', 'in-progress': '#1B65A8', delayed: '#FF5630', planned: '#97a8be' }" :key="key" class="legend-item">
        <i :style="{ background: color }"></i>
        {{ { completed: '已完成', 'in-progress': '进行中', delayed: '已延期', planned: '计划中' }[key as string] }}
      </span>
    </div>

    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height }">
      <div
        ref="chartRef"
        role="img"
        :aria-label="title || '甘特图'"
        style="width: 100%; height: 100%"
      ></div>
      <div v-if="!loading && tasks.length === 0" class="chart-empty">
        <el-empty description="暂无任务数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.gantt-chart {
  width: 100%;

  .gantt-header {
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

    .zoom-controls {
      display: flex;
      gap: 2px;
      background: #f5f7fa;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      padding: 3px;
    }

    .zoom-btn {
      padding: 4px 12px;
      font-size: 12px;
      color: #606266;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: #1B65A8;
        background: #e6f0ff;
      }

      &.active {
        color: #fff;
        background: #1B65A8;
        font-weight: 600;
      }
    }
  }

  .kpi-row {
    display: flex;
    gap: 0;
    margin-bottom: 10px;
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
    }

    .kpi-value {
      font-size: 14px;
      font-weight: 700;
      color: #303133;

      &--green { color: #36B37E; }
      &--blue { color: #1B65A8; }
      &--red { color: #FF5630; }
    }
  }

  .status-legend {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    padding: 0 4px;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: #606266;

      i {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
        flex-shrink: 0;
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
