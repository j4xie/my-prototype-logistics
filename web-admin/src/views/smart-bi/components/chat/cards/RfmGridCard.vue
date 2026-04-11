<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

interface Segment {
  key: string;
  nameZh: string;
  count: number;
  revenue: number;
  colorClass: string;
}

const SEGMENT_META: Array<{ key: string; nameZh: string; colorClass: string }> = [
  { key: 'Champions', nameZh: '冠军客户', colorClass: 'seg-champions' },
  { key: 'Loyal', nameZh: '忠实客户', colorClass: 'seg-loyal' },
  { key: 'Potential', nameZh: '潜力客户', colorClass: 'seg-potential' },
  { key: 'AtRisk', nameZh: '流失风险', colorClass: 'seg-at-risk' },
  { key: 'Hibernating', nameZh: '休眠客户', colorClass: 'seg-hibernating' },
  { key: 'Lost', nameZh: '已流失', colorClass: 'seg-lost' },
];

const segments = computed<Segment[]>(() => {
  const d = props.section.data as Record<string, Record<string, number>>;
  const counts = d.segmentCounts ?? d.segment_counts ?? {};
  const revenues = d.segmentRevenue ?? d.segment_revenue ?? {};
  return SEGMENT_META.map((m) => ({
    key: m.key,
    nameZh: m.nameZh,
    count: counts[m.key] ?? 0,
    revenue: revenues[m.key] ?? 0,
    colorClass: m.colorClass,
  }));
});

const totalRevenue = computed(() => segments.value.reduce((s, x) => s + x.revenue, 0));

const analyzedMembers = computed<number>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.analyzedMembers ?? d.analyzed_members ?? 0) as number;
});

function pct(revenue: number): string {
  if (totalRevenue.value === 0) return '0%';
  return ((revenue / totalRevenue.value) * 100).toFixed(1) + '%';
}
</script>

<template>
  <div class="rfm-card">
    <div class="card-label">▸ 会员 RFM 分层</div>
    <div v-if="analyzedMembers > 0" class="rfm-summary">
      共分析 {{ analyzedMembers }} 名会员
    </div>
    <div class="rfm-grid">
      <div
        v-for="seg in segments"
        :key="seg.key"
        class="rfm-cell"
        :class="seg.colorClass"
      >
        <div class="cell-name">{{ seg.nameZh }}</div>
        <div class="cell-count">{{ seg.count }} 人</div>
        <div class="cell-revenue">{{ pct(seg.revenue) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rfm-card {
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
.rfm-summary {
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: #6b6b6b;
  margin-bottom: 10px;
}
.rfm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.rfm-cell {
  padding: 10px;
  border: 1px solid #d4cdb8;
  border-radius: 4px;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
}
.cell-name {
  font-weight: 700;
  font-size: 12px;
  color: #2d4a3e;
  margin-bottom: 4px;
}
.cell-count {
  font-size: 14px;
  color: #3d3d3d;
}
.cell-revenue {
  font-size: 10px;
  color: #a68449;
  font-family: monospace;
  margin-top: 4px;
}
.seg-champions { background: linear-gradient(180deg, #fefcf6, #fff8dc); }
.seg-loyal { background: linear-gradient(180deg, #fefcf6, #e8f5e9); }
.seg-potential { background: linear-gradient(180deg, #fefcf6, #e3f2fd); }
.seg-at-risk { background: linear-gradient(180deg, #fefcf6, #fff3e0); }
.seg-hibernating { background: linear-gradient(180deg, #fefcf6, #f3e5f5); }
.seg-lost { background: linear-gradient(180deg, #fefcf6, #fce4ec); }
</style>
