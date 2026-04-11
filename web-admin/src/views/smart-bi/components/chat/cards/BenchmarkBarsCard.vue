<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

interface BarShape {
  actual: number;
  median: number;
  scaleMin: number;
  scaleMax: number;
  fillRatio: number;
  markerPosition: number;
}

interface Alert {
  metricKey: string;
  metricNameZh: string;
  actualValue: number;
  median: number;
  rangeLow: number;
  rangeHigh: number;
  severity: string;
  messageZh: string;
  barShape: BarShape;
}

const alerts = computed<Alert[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.alerts ?? []) as Alert[];
});

function severityClass(severity: string): string {
  if (severity === 'red' || severity === 'critical') return 'fill-red';
  if (severity === 'yellow' || severity === 'warning') return 'fill-yellow';
  return 'fill-green';
}

function fillPct(bar: BarShape): string {
  const ratio = Math.min(Math.max(bar.fillRatio ?? 0, 0), 1);
  return (ratio * 100).toFixed(1) + '%';
}

function markerPct(bar: BarShape): string {
  const pos = Math.min(Math.max(bar.markerPosition ?? 0, 0), 1);
  return (pos * 100).toFixed(1) + '%';
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}
</script>

<template>
  <div class="benchmark-bars-card">
    <div class="card-label">▸ 指标对标预警</div>
    <div v-if="alerts.length === 0" class="empty-hint">暂无预警数据</div>
    <div v-for="alert in alerts" :key="alert.metricKey" class="alert-row">
      <div class="alert-meta">
        <span class="metric-name">{{ alert.metricNameZh }}</span>
        <span class="actual-value" :class="severityClass(alert.severity)">
          {{ fmtPct(alert.actualValue) }}
        </span>
      </div>
      <div class="bar-container">
        <div class="bar-track">
          <div
            class="bar-fill"
            :class="severityClass(alert.severity)"
            :style="{ width: fillPct(alert.barShape) }"
          ></div>
          <div
            class="bar-marker"
            :style="{ left: markerPct(alert.barShape) }"
            title="行业中位数"
          ></div>
        </div>
        <div class="bar-labels">
          <span class="label-actual">实际 {{ fmtPct(alert.actualValue) }}</span>
          <span class="label-median">中位 {{ fmtPct(alert.median) }}</span>
        </div>
      </div>
      <div class="alert-message">{{ alert.messageZh }}</div>
    </div>
  </div>
</template>

<style scoped>
.benchmark-bars-card {
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
.empty-hint {
  color: #a8a29e;
  font-size: 11px;
  font-style: italic;
}
.alert-row {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px dotted #e8e1cc;
}
.alert-row:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.alert-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.metric-name {
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  font-weight: 700;
  color: #2d4a3e;
}
.actual-value {
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
}
.actual-value.fill-red { color: #b91c1c; }
.actual-value.fill-yellow { color: #d97706; }
.actual-value.fill-green { color: #166534; }
.bar-container {
  margin-bottom: 6px;
}
.bar-track {
  position: relative;
  height: 10px;
  background: #e8e1cc;
  border-radius: 5px;
  overflow: visible;
}
.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
}
.bar-fill.fill-red { background: #b91c1c; }
.bar-fill.fill-yellow { background: #d97706; }
.bar-fill.fill-green { background: #166534; }
.bar-marker {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 16px;
  background: #2d4a3e;
  border-radius: 1px;
  transform: translateX(-50%);
}
.bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-family: monospace;
  font-size: 9px;
  color: #a8a29e;
}
.alert-message {
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: #3d3d3d;
  line-height: 1.5;
  padding: 6px 8px;
  background: #f2ece0;
  border-left: 3px solid #c9a66b;
  border-radius: 2px;
  margin-top: 6px;
}
</style>
