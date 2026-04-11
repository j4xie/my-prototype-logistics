<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

interface RxAction {
  id: string;
  title: string;
  description: string;
  owner: string;
  timeframe: string;
  priority: 'P0' | 'P1' | 'P2';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

interface DiagnosisBlock {
  metricNameZh: string;
  rxActions: RxAction[];
}

const diagnosesWithRx = computed<DiagnosisBlock[]>(() => {
  const data = props.section.data as Record<string, unknown>;
  // Two possible shapes:
  //   batch mode: section.data is an array of diagnosis dicts
  //   standalone mode: section.data is { diagnoses: [...], criticalCount, totalCount }
  const list = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : ((data.diagnoses ?? []) as Record<string, unknown>[]);
  return list
    .filter((d) => Array.isArray(d.rxActions) && (d.rxActions as unknown[]).length > 0)
    .map((d) => ({
      metricNameZh: (d.metricNameZh ?? d.metric_name_zh ?? d.metric ?? 'diagnostic') as string,
      rxActions: d.rxActions as RxAction[],
    }));
});

function priorityClass(p: string): string {
  return `priority-${p.toLowerCase()}`;
}
function effortClass(e: string): string {
  return `effort-${e.toLowerCase()}`;
}
</script>

<template>
  <div class="rx-card">
    <div class="card-label">℞ 处方建议</div>
    <div v-if="diagnosesWithRx.length === 0" class="empty-hint">
      暂无结构化处方 (需要 P3.7 playbook 升级)
    </div>
    <div v-for="(diag, idx) in diagnosesWithRx" :key="idx" class="diagnosis-block">
      <div class="diagnosis-title">{{ diag.metricNameZh }}</div>
      <ol class="rx-list">
        <li v-for="action in diag.rxActions" :key="action.id" class="rx-item">
          <div class="rx-header">
            <span class="rx-title">{{ action.title }}</span>
            <span class="rx-badge" :class="priorityClass(action.priority)">{{ action.priority }}</span>
            <span class="rx-badge" :class="effortClass(action.effort)">{{ action.effort }}</span>
          </div>
          <div class="rx-description">{{ action.description }}</div>
          <div class="rx-meta">
            <span class="meta-item">负责: {{ action.owner }}</span>
            <span class="meta-item">期限: {{ action.timeframe }}</span>
          </div>
          <div class="rx-impact">预期影响: {{ action.expectedImpact }}</div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.rx-card {
  margin-top: 12px;
  background: #fefcf6;
  border: 1px solid #d4cdb8;
  padding: 14px 18px;
  border-radius: 4px;
}
.card-label {
  font-family: 'Playfair Display', serif;
  font-size: 12px;
  color: #a68449;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
  font-weight: 700;
}
.empty-hint {
  color: #a8a29e;
  font-size: 11px;
  font-style: italic;
}
.diagnosis-block {
  margin-bottom: 16px;
}
.diagnosis-title {
  font-family: 'Noto Serif SC', serif;
  font-weight: 700;
  color: #2d4a3e;
  margin-bottom: 8px;
  font-size: 13px;
}
.rx-list {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: rxcount;
}
.rx-item {
  counter-increment: rxcount;
  padding: 10px 12px 10px 40px;
  position: relative;
  background: #fdf9ed;
  border: 1px solid #e8e1cc;
  border-radius: 4px;
  margin-bottom: 8px;
}
.rx-item::before {
  content: counter(rxcount);
  position: absolute;
  left: 10px;
  top: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #c9a66b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-weight: 700;
  font-size: 11px;
}
.rx-header {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.rx-title {
  font-weight: 700;
  color: #2d4a3e;
  font-size: 12px;
  font-family: 'Noto Serif SC', serif;
  flex: 1;
}
.rx-badge {
  font-family: monospace;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}
.priority-p0 { background: #fee2e2; color: #8b1a1a; border: 1px solid #b91c1c; }
.priority-p1 { background: #fef3c7; color: #92400e; border: 1px solid #d97706; }
.priority-p2 { background: #e0f2fe; color: #075985; border: 1px solid #0284c7; }
.effort-low { background: #dcfce7; color: #166534; }
.effort-medium { background: #fef3c7; color: #92400e; }
.effort-high { background: #fee2e2; color: #8b1a1a; }
.rx-description {
  font-size: 11px;
  color: #3d3d3d;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.5;
  margin-bottom: 6px;
}
.rx-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #6b6b6b;
  margin-bottom: 4px;
}
.meta-item {
  font-family: 'Noto Serif SC', serif;
}
.rx-impact {
  font-size: 10px;
  color: #a68449;
  font-style: italic;
  font-family: 'Noto Serif SC', serif;
}
</style>
