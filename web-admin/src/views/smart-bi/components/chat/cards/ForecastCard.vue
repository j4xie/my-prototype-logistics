<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

const history = computed<number[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.history ?? []) as number[];
});
const predictions = computed<number[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.predictions ?? []) as number[];
});
const lowerBound = computed<number[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.lowerBound ?? d.lower_bound ?? []) as number[];
});
const upperBound = computed<number[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.upperBound ?? d.upper_bound ?? []) as number[];
});
const interpretation = computed<string>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.interpretationZh ?? d.interpretation_zh ?? '') as string;
});

// SVG dimensions
const W = 320;
const H = 140;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 24;
const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

const allValues = computed(() => [
  ...history.value,
  ...predictions.value,
  ...upperBound.value,
  ...lowerBound.value,
]);

const minY = computed(() => Math.min(...allValues.value, 0));
const maxY = computed(() => Math.max(...allValues.value, 1));

const totalPoints = computed(() => history.value.length + predictions.value.length);

function xFor(index: number): number {
  const total = totalPoints.value;
  if (total <= 1) return PAD_L + innerW / 2;
  return PAD_L + (index / (total - 1)) * innerW;
}

function yFor(value: number): number {
  const denom = maxY.value - minY.value || 1;
  return PAD_T + innerH - ((value - minY.value) / denom) * innerH;
}

const historyPath = computed(() => {
  const n = history.value.length;
  if (n === 0) return '';
  return history.value
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(' ');
});

const predictionPath = computed(() => {
  const n = predictions.value.length;
  if (n === 0) return '';
  const histLen = history.value.length;
  // Connect from last history point
  const lastHist = history.value[histLen - 1] ?? predictions.value[0];
  let path = `M${xFor(histLen - 1).toFixed(1)},${yFor(lastHist).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    path += ` L${xFor(histLen + i).toFixed(1)},${yFor(predictions.value[i]).toFixed(1)}`;
  }
  return path;
});

const confidencePath = computed(() => {
  if (upperBound.value.length === 0 || lowerBound.value.length === 0) return '';
  const histLen = history.value.length;
  let path = '';
  for (let i = 0; i < upperBound.value.length; i++) {
    const x = xFor(histLen + i).toFixed(1);
    const y = yFor(upperBound.value[i]).toFixed(1);
    path += `${i === 0 ? 'M' : 'L'}${x},${y} `;
  }
  for (let i = lowerBound.value.length - 1; i >= 0; i--) {
    const x = xFor(histLen + i).toFixed(1);
    const y = yFor(lowerBound.value[i]).toFixed(1);
    path += `L${x},${y} `;
  }
  return path + 'Z';
});

// Y-axis label formatting
function fmtYLabel(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(Math.round(v));
}

const yAxisLabels = computed(() => {
  const min = minY.value;
  const max = maxY.value;
  const mid = (min + max) / 2;
  return [
    { value: max, y: yFor(max) },
    { value: mid, y: yFor(mid) },
    { value: min, y: yFor(min) },
  ];
});
</script>

<template>
  <div class="forecast-card">
    <div class="card-label">▸ 营收预测</div>
    <svg v-if="history.length > 0" :viewBox="`0 0 ${W} ${H}`" class="forecast-svg">
      <!-- Confidence band -->
      <path v-if="confidencePath" :d="confidencePath" fill="#c9a66b" fill-opacity="0.2" />
      <!-- History line (solid) -->
      <path :d="historyPath" fill="none" stroke="#2d4a3e" stroke-width="2" stroke-linejoin="round" />
      <!-- Prediction line (dashed) -->
      <path
        :d="predictionPath"
        fill="none"
        stroke="#a68449"
        stroke-width="2"
        stroke-dasharray="4 4"
        stroke-linejoin="round"
      />
      <!-- Axis baseline -->
      <line :x1="PAD_L" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" stroke="#d4cdb8" stroke-width="0.5" />
      <!-- Y-axis labels -->
      <text
        v-for="label in yAxisLabels"
        :key="label.value"
        :x="PAD_L - 4"
        :y="label.y + 3"
        text-anchor="end"
        font-family="monospace"
        font-size="8"
        fill="#a8a29e"
      >{{ fmtYLabel(label.value) }}</text>
    </svg>
    <div v-else class="empty-hint">暂无预测数据</div>
    <div class="legend">
      <span class="legend-item hist">— 历史</span>
      <span class="legend-item pred">--- 预测</span>
      <span v-if="confidencePath" class="legend-item band">░ 置信区间</span>
    </div>
    <div v-if="interpretation" class="interpretation">{{ interpretation }}</div>
  </div>
</template>

<style scoped>
.forecast-card {
  margin-top: 12px;
  background: #fefcf6;
  border: 1px solid #d4cdb8;
  padding: 14px 18px;
  border-radius: 4px;
}
.card-label {
  font-family: monospace;
  font-size: 10px;
  color: #a68449;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
  text-transform: uppercase;
}
.forecast-svg {
  width: 100%;
  height: auto;
  display: block;
}
.legend {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-family: monospace;
  font-size: 9px;
}
.legend-item.hist { color: #2d4a3e; }
.legend-item.pred { color: #a68449; }
.legend-item.band { color: #c9a66b; }
.interpretation {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f2ece0;
  border-left: 3px solid #c9a66b;
  font-size: 11px;
  color: #3d3d3d;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.6;
}
.empty-hint {
  color: #a8a29e;
  font-size: 11px;
  font-style: italic;
}
</style>
