<script setup lang="ts">
/**
 * SmallMultiplesChart - Zebra BI 风格的小倍数图表
 * 将一个维度拆分为多个小图，支持同步 Y 轴、同步 Tooltip、点击联动
 */
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
} from 'vue';
import echarts from '@/utils/echarts';
import { CHART_COLORS } from '@/constants/chart-colors';
import { useAppStore } from '@/store/modules/app';

// ==================== Types ====================

export interface SmallMultiplesConfig {
  splitBy: string;
  chartType?: 'bar' | 'line' | 'area' | 'pie';
  columns?: number;
  rows?: number;
  sharedAxes?: boolean;
  showTitle?: boolean;
  sortBy?: 'value' | 'name' | 'growth';
  sortDirection?: 'asc' | 'desc';
  maxCells?: number;
  highlightCell?: string;
}

interface Props {
  title?: string;
  data: Record<string, unknown>[];
  config: SmallMultiplesConfig;
  xField: string;
  yField: string;
  height?: string;
  loading?: boolean;
  unit?: string;
}

// ==================== Props & Emits ====================

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  height: '600px',
  loading: false,
  unit: '',
});

const emit = defineEmits<{
  cellClick: [dimensionValue: string, dataPoint: unknown];
  cellHover: [dimensionValue: string];
}>();

// ==================== State ====================

const appStore = useAppStore();
const theme = computed(() => appStore.theme === 'dark' ? 'cretas-dark' : 'cretas');

const containerRef = ref<HTMLDivElement | null>(null);
const cellRefs = ref<Record<string, HTMLDivElement>>({});
const chartInstances = new Map<string, echarts.ECharts>();
const hoveredCell = ref<string | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// ==================== Data Processing ====================

/** Group raw data by splitBy dimension, compute per-group xField→yField arrays */
const groupedData = computed(() => {
  const groups = new Map<string, { x: unknown[]; y: number[]; total: number }>();

  for (const row of props.data) {
    const dim = String(row[props.config.splitBy] ?? '(空)');
    if (!groups.has(dim)) groups.set(dim, { x: [], y: [], total: 0 });
    const g = groups.get(dim)!;
    g.x.push(row[props.xField]);
    const val = Number(row[props.yField]) || 0;
    g.y.push(val);
    g.total += val;
  }

  return groups;
});

/** Sorted dimension keys */
const sortedKeys = computed(() => {
  const keys = Array.from(groupedData.value.keys());
  const dir = props.config.sortDirection ?? 'desc';
  const by = props.config.sortBy ?? 'value';

  keys.sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    if (by === 'value') {
      va = groupedData.value.get(a)!.total;
      vb = groupedData.value.get(b)!.total;
    } else if (by === 'name') {
      va = a;
      vb = b;
    } else if (by === 'growth') {
      // growth = last value - first value, fallback to total
      const ga = groupedData.value.get(a)!.y;
      const gb = groupedData.value.get(b)!.y;
      va = ga.length >= 2 ? ga[ga.length - 1] - ga[0] : groupedData.value.get(a)!.total;
      vb = gb.length >= 2 ? gb[gb.length - 1] - gb[0] : groupedData.value.get(b)!.total;
    }

    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  return keys;
});

const maxCells = computed(() => props.config.maxCells ?? 12);

/** Cells to render (including overflow placeholder) */
const visibleKeys = computed(() => sortedKeys.value.slice(0, maxCells.value));
const overflowKeys = computed(() => sortedKeys.value.slice(maxCells.value));
const hasOverflow = computed(() => overflowKeys.value.length > 0);

/** Shared Y-axis bounds across all cells */
const globalYBounds = computed(() => {
  if (!props.config.sharedAxes && props.config.sharedAxes !== undefined) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const [, g] of groupedData.value) {
    for (const v of g.y) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  // pad 10%
  const range = max - min || 1;
  return { min: min - range * 0.05, max: max + range * 0.1 };
});

/** Compute grid columns count */
const gridColumns = computed(() => {
  if (props.config.columns) return props.config.columns;
  const count = visibleKeys.value.length + (hasOverflow.value ? 1 : 0);
  if (count <= 2) return 2;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 4;
});

/** Format number compactly */
function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toFixed(0);
}

// ==================== Ranking bar data ====================

const rankingData = computed(() => {
  const all = sortedKeys.value;
  const maxTotal = Math.max(...all.map(k => groupedData.value.get(k)!.total), 1);
  return all.map(k => ({
    key: k,
    total: groupedData.value.get(k)!.total,
    pct: (groupedData.value.get(k)!.total / maxTotal) * 100,
  }));
});

// ==================== ECharts option builder ====================

function buildOption(key: string): Record<string, unknown> {
  const g = groupedData.value.get(key)!;
  const chartType = props.config.chartType ?? 'bar';
  const bounds = (props.config.sharedAxes !== false) ? globalYBounds.value : null;
  const color = CHART_COLORS[sortedKeys.value.indexOf(key) % CHART_COLORS.length];

  const baseAxis = {
    type: 'category',
    data: g.x,
    axisLabel: { fontSize: 9, color: '#888', interval: 'auto', rotate: g.x.length > 5 ? 30 : 0 },
    axisLine: { lineStyle: { color: '#e0e0e0' } },
    axisTick: { show: false },
  };

  const valueAxis: Record<string, unknown> = {
    type: 'value',
    axisLabel: { fontSize: 9, color: '#888', formatter: (v: number) => fmtNum(v) },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
    axisLine: { show: false },
    axisTick: { show: false },
  };
  if (bounds) {
    valueAxis.min = bounds.min;
    valueAxis.max = bounds.max;
  }

  const seriesData = g.y;

  let series: Record<string, unknown>[];
  if (chartType === 'pie') {
    series = [{
      type: 'pie',
      radius: ['35%', '65%'],
      data: g.x.map((x, i) => ({ name: x, value: g.y[i] })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
    }];
  } else {
    series = [{
      type: chartType === 'area' ? 'line' : chartType,
      data: seriesData,
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      areaStyle: chartType === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + 'AA' }, { offset: 1, color: color + '11' }] } } : undefined,
      smooth: chartType === 'line' || chartType === 'area',
      barMaxWidth: 20,
      emphasis: { itemStyle: { opacity: 1 } },
    }];
  }

  const opt: Record<string, unknown> = {
    animation: true,
    animationDuration: 400,
    grid: { top: 8, right: 8, bottom: chartType === 'pie' ? 8 : 28, left: 36, containLabel: false },
    tooltip: {
      trigger: 'axis',
      confine: true,
      textStyle: { fontSize: 11 },
      formatter: (params: unknown[]) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return `${p.name}: ${fmtNum(p.value)}${props.unit}`;
      },
    },
    series,
  };

  if (chartType !== 'pie') {
    opt.xAxis = baseAxis;
    opt.yAxis = valueAxis;
  }

  return opt;
}

// ==================== Chart lifecycle ====================

function setCellRef(key: string, el: HTMLDivElement | null) {
  if (el) cellRefs.value[key] = el;
}

async function initAllCharts() {
  await nextTick();
  for (const key of visibleKeys.value) {
    const el = cellRefs.value[key];
    if (!el) continue;
    let inst = chartInstances.get(key);
    if (inst) { inst.dispose(); }
    inst = echarts.init(el, theme.value, { renderer: 'canvas' });
    inst.setOption(buildOption(key), { notMerge: true });
    inst.on('click', (params: unknown) => {
      emit('cellClick', key, params);
    });
    inst.getZr().on('mousemove', () => handleCellHover(key));
    chartInstances.set(key, inst);
  }
}

function updateAllCharts() {
  for (const [key, inst] of chartInstances) {
    if (!visibleKeys.value.includes(key)) { inst.dispose(); chartInstances.delete(key); continue; }
    inst.setOption(buildOption(key), { notMerge: true });
  }
}

function handleCellHover(key: string) {
  if (hoveredCell.value === key) return;
  hoveredCell.value = key;
  emit('cellHover', key);
}

function handleContainerLeave() {
  hoveredCell.value = null;
}

function handleResize() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    for (const inst of chartInstances.values()) inst.resize();
  });
}

function syncTooltip(sourceKey: string, params: { dataIndex: number }) {
  for (const [key, inst] of chartInstances) {
    if (key === sourceKey) continue;
    inst.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: params.dataIndex });
  }
}

// ==================== Watch ====================

watch(
  () => [props.data, props.config, props.xField, props.yField],
  () => {
    if (chartInstances.size > 0) {
      updateAllCharts();
    }
  },
  { deep: true }
);

watch(theme, () => {
  for (const [key, inst] of chartInstances) {
    inst.dispose();
    const el = cellRefs.value[key];
    if (el) {
      const newInst = echarts.init(el, theme.value, { renderer: 'canvas' });
      newInst.setOption(buildOption(key), { notMerge: true });
      chartInstances.set(key, newInst);
    }
  }
});

watch(visibleKeys, async () => {
  await nextTick();
  // Dispose charts for removed keys
  for (const [key, inst] of chartInstances) {
    if (!visibleKeys.value.includes(key)) { inst.dispose(); chartInstances.delete(key); }
  }
  // Init new keys
  for (const key of visibleKeys.value) {
    if (!chartInstances.has(key)) {
      const el = cellRefs.value[key];
      if (el) {
        const inst = echarts.init(el, theme.value, { renderer: 'canvas' });
        inst.setOption(buildOption(key), { notMerge: true });
        inst.on('click', (params: unknown) => emit('cellClick', key, params));
        chartInstances.set(key, inst);
      }
    }
  }
});

// ==================== Lifecycle ====================

onMounted(async () => {
  await initAllCharts();
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (rafId) cancelAnimationFrame(rafId);
  for (const inst of chartInstances.values()) inst.dispose();
  chartInstances.clear();
});

// expose syncTooltip for external coordination
defineExpose({ syncTooltip });
</script>

<template>
  <div class="sm-chart" :style="{ height }" ref="containerRef" @mouseleave="handleContainerLeave">
    <!-- Header -->
    <div v-if="title" class="sm-chart__header">
      <span class="sm-chart__title">{{ title }}</span>
      <span v-if="unit" class="sm-chart__unit">单位: {{ unit }}</span>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="sm-chart__loading">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!data || data.length === 0" class="sm-chart__empty">
      <el-empty description="暂无数据" :image-size="60" />
    </div>

    <!-- Grid -->
    <div
      v-else
      class="sm-chart__grid"
      :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }"
    >
      <!-- Individual cells -->
      <div
        v-for="key in visibleKeys"
        :key="key"
        class="sm-chart__cell"
        :class="{
          'sm-chart__cell--hovered': hoveredCell === key,
          'sm-chart__cell--dimmed': hoveredCell !== null && hoveredCell !== key,
          'sm-chart__cell--highlighted': config.highlightCell === key,
        }"
        @mouseenter="handleCellHover(key)"
        @click="emit('cellClick', key, groupedData.get(key))"
      >
        <!-- Cell header -->
        <div v-if="config.showTitle !== false" class="sm-chart__cell-title">
          <span class="sm-chart__cell-name">{{ key }}</span>
          <span class="sm-chart__cell-total">{{ fmtNum(groupedData.get(key)!.total) }}{{ unit }}</span>
        </div>
        <!-- Mini chart canvas -->
        <div
          :ref="(el) => setCellRef(key, el as HTMLDivElement)"
          class="sm-chart__canvas"
        />
      </div>

      <!-- Overflow cell -->
      <div v-if="hasOverflow" class="sm-chart__cell sm-chart__cell--overflow">
        <div class="sm-chart__overflow-content">
          <div class="sm-chart__overflow-count">其他 ({{ overflowKeys.length }} 个)</div>
          <div class="sm-chart__overflow-total">
            {{ fmtNum(overflowKeys.reduce((s, k) => s + groupedData.get(k)!.total, 0)) }}{{ unit }}
          </div>
          <div class="sm-chart__overflow-list">
            <div v-for="k in overflowKeys.slice(0, 5)" :key="k" class="sm-chart__overflow-item">
              <span class="sm-chart__overflow-name">{{ k }}</span>
              <span class="sm-chart__overflow-val">{{ fmtNum(groupedData.get(k)!.total) }}</span>
            </div>
            <div v-if="overflowKeys.length > 5" class="sm-chart__overflow-more">
              +{{ overflowKeys.length - 5 }} 更多...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ranking comparison strip -->
    <div v-if="data && data.length > 0 && !loading" class="sm-chart__ranking">
      <div class="sm-chart__ranking-title">维度对比排名</div>
      <div class="sm-chart__ranking-bars">
        <div
          v-for="item in rankingData.slice(0, maxCells)"
          :key="item.key"
          class="sm-chart__ranking-row"
          :class="{ 'sm-chart__ranking-row--active': hoveredCell === item.key }"
          @mouseenter="handleCellHover(item.key)"
        >
          <span class="sm-chart__ranking-label">{{ item.key }}</span>
          <div class="sm-chart__ranking-bar-wrap">
            <div
              class="sm-chart__ranking-bar-fill"
              :style="{
                width: item.pct + '%',
                backgroundColor: CHART_COLORS[sortedKeys.indexOf(item.key) % CHART_COLORS.length],
              }"
            />
          </div>
          <span class="sm-chart__ranking-value">{{ fmtNum(item.total) }}{{ unit }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sm-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  font-family: inherit;
}

.sm-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.sm-chart__title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.sm-chart__unit {
  font-size: 12px;
  color: #909399;
}

.sm-chart__loading,
.sm-chart__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
}

.sm-chart__grid {
  display: grid;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.sm-chart__cell {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
}

.sm-chart__cell:hover {
  border-color: #1B65A8;
}

.sm-chart__cell--hovered {
  transform: scale(1.025);
  box-shadow: 0 4px 16px rgba(27, 101, 168, 0.18);
  border-color: #1B65A8;
  z-index: 2;
}

.sm-chart__cell--dimmed {
  opacity: 0.35;
}

.sm-chart__cell--highlighted {
  border-color: #36B37E;
  background: #f0fff8;
}

.sm-chart__cell--overflow {
  background: #f5f7fa;
  border-style: dashed;
  cursor: default;
}

.sm-chart__cell-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sm-chart__cell-name {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.sm-chart__cell-total {
  font-size: 11px;
  font-weight: 600;
  color: #1B65A8;
  background: #e8f0fa;
  padding: 1px 6px;
  border-radius: 10px;
}

.sm-chart__canvas {
  flex: 1;
  min-height: 80px;
}

.sm-chart__overflow-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px;
}

.sm-chart__overflow-count {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.sm-chart__overflow-total {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.sm-chart__overflow-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sm-chart__overflow-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #606266;
}

.sm-chart__overflow-more {
  font-size: 11px;
  color: #909399;
  font-style: italic;
}

/* Ranking strip */
.sm-chart__ranking {
  border-top: 1px solid #ebeef5;
  padding-top: 10px;
}

.sm-chart__ranking-title {
  font-size: 11px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 500;
}

.sm-chart__ranking-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sm-chart__ranking-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 2px 0;
  border-radius: 4px;
  transition: background 0.1s;
}

.sm-chart__ranking-row:hover,
.sm-chart__ranking-row--active {
  background: #f5f7fa;
}

.sm-chart__ranking-label {
  font-size: 11px;
  color: #606266;
  width: 72px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.sm-chart__ranking-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.sm-chart__ranking-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.sm-chart__ranking-value {
  font-size: 11px;
  color: #303133;
  font-weight: 600;
  width: 64px;
  flex-shrink: 0;
  text-align: right;
}

/* Responsive */
@media (max-width: 900px) {
  .sm-chart__grid {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

@media (max-width: 640px) {
  .sm-chart__grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 400px) {
  .sm-chart__grid {
    grid-template-columns: 1fr !important;
  }
}
</style>
