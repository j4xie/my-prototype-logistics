<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

interface HeatmapCell {
  day: string;
  hour: number;
  value: number;
  intensityClass?: string;
}

const cells = computed<HeatmapCell[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.cells ?? d.heatmap ?? d.matrix ?? []) as HeatmapCell[];
});

const peakHour = computed(() => {
  const d = props.section.data as Record<string, unknown>;
  return d.peakHour ?? d.peak_hour ?? null;
});

// Compute max value for color scale
const maxValue = computed(() => {
  let max = 0;
  for (const c of cells.value) {
    if (c.value > max) max = c.value;
  }
  return max || 1;
});

function intensityFor(cell: HeatmapCell): string {
  if (cell.intensityClass) return cell.intensityClass;
  const ratio = cell.value / maxValue.value;
  if (ratio >= 0.75) return 'peak';
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.25) return 'medium';
  return 'low';
}

const daysZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const daysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = Array.from({ length: 24 }, (_, i) => i);

function findCell(dayIdx: number, hour: number): HeatmapCell | undefined {
  const dayZh = daysZh[dayIdx];
  const dayEn = daysEn[dayIdx];
  return cells.value.find(
    (c) => (c.day === dayZh || c.day === dayEn) && c.hour === hour,
  );
}
</script>

<template>
  <div class="heatmap-card">
    <div class="card-label">▸ 营业时段热力图</div>
    <div v-if="cells.length === 0" class="empty-hint">暂无时段数据</div>
    <div v-else class="heatmap-grid">
      <div class="hour-header">
        <span class="day-spacer"></span>
        <span v-for="h in hours" :key="h" class="hour-label">{{ h }}</span>
      </div>
      <div v-for="(day, idx) in daysZh" :key="day" class="heatmap-row">
        <span class="day-label">{{ day }}</span>
        <span
          v-for="h in hours"
          :key="h"
          class="cell"
          :class="`intensity-${findCell(idx, h) ? intensityFor(findCell(idx, h)!) : 'low'}`"
          :title="`${day} ${h}:00 ¥${findCell(idx, h)?.value ?? 0}`"
        ></span>
      </div>
    </div>
    <div v-if="peakHour !== null" class="heatmap-note">
      峰值时段: {{ peakHour }}:00
    </div>
  </div>
</template>

<style scoped>
.heatmap-card {
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
.heatmap-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-x: auto;
}
.hour-header {
  display: grid;
  grid-template-columns: 30px repeat(24, 1fr);
  font-size: 8px;
  color: #a8a29e;
  font-family: monospace;
  min-width: 320px;
}
.day-spacer {
  display: block;
}
.hour-label {
  text-align: center;
}
.heatmap-row {
  display: grid;
  grid-template-columns: 30px repeat(24, 1fr);
  gap: 2px;
  align-items: center;
  min-width: 320px;
}
.day-label {
  font-size: 9px;
  color: #6b6b6b;
  font-family: monospace;
}
.cell {
  height: 14px;
  border-radius: 1px;
  cursor: pointer;
}
.cell.intensity-low {
  background: #f2ece0;
}
.cell.intensity-medium {
  background: #e6d9b8;
}
.cell.intensity-high {
  background: #c9a66b;
}
.cell.intensity-peak {
  background: #8b6b3a;
}
.heatmap-note {
  margin-top: 10px;
  font-size: 10px;
  color: #6b6b6b;
  font-family: 'Noto Serif SC', serif;
}
</style>
