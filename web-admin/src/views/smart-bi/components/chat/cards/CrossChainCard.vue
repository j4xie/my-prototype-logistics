<script setup lang="ts">
import { computed } from 'vue';
import type { SectionPayload } from '@/types/restaurant-chat';

const props = defineProps<{ section: SectionPayload }>();

interface ChainProfile {
  name?: string;
  brandName?: string;
  storeCount?: number;
  [key: string]: unknown;
}

const insights = computed<string[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.insights ?? d.insightList ?? []) as string[];
});

const recommendations = computed<string[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.recommendations ?? d.actionSuggestions ?? []) as string[];
});

const chainProfiles = computed<ChainProfile[]>(() => {
  const d = props.section.data as Record<string, unknown>;
  return (d.chainProfiles ?? d.profiles ?? []) as ChainProfile[];
});

const hasContent = computed(
  () => chainProfiles.value.length > 0 || insights.value.length > 0 || recommendations.value.length > 0,
);
</script>

<template>
  <div class="cross-chain-card">
    <div class="card-label">▸ 跨连锁对标</div>
    <div v-if="chainProfiles.length > 0" class="profiles">
      <div v-for="(chain, idx) in chainProfiles.slice(0, 5)" :key="idx" class="profile-row">
        <span class="rank">#{{ idx + 1 }}</span>
        <span class="brand">{{ chain.name ?? chain.brandName ?? '未知品牌' }}</span>
        <span v-if="chain.storeCount" class="meta">{{ chain.storeCount }} 店</span>
      </div>
    </div>
    <div v-if="insights.length > 0" class="insights">
      <div class="section-sub">洞察</div>
      <ul>
        <li v-for="(ins, idx) in insights" :key="idx">{{ ins }}</li>
      </ul>
    </div>
    <div v-if="recommendations.length > 0" class="recs">
      <div class="section-sub">建议</div>
      <ul>
        <li v-for="(rec, idx) in recommendations" :key="idx">{{ rec }}</li>
      </ul>
    </div>
    <div v-if="!hasContent" class="empty-hint">
      暂无跨连锁对标数据
    </div>
  </div>
</template>

<style scoped>
.cross-chain-card {
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
.profile-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dotted #e8e1cc;
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
}
.profile-row:last-child {
  border-bottom: none;
}
.rank {
  color: #a68449;
  font-family: monospace;
  font-weight: 700;
  min-width: 28px;
}
.brand {
  flex: 1;
  color: #2d4a3e;
  font-weight: 700;
}
.meta {
  color: #6b6b6b;
  font-size: 10px;
}
.section-sub {
  font-family: monospace;
  font-size: 9px;
  color: #a68449;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-top: 10px;
  margin-bottom: 4px;
}
.insights ul,
.recs ul {
  margin: 0;
  padding-left: 18px;
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
