<script setup lang="ts">
import type { SectionPayload } from '@/types/restaurant-chat';

defineProps<{ section: SectionPayload }>();
</script>

<template>
  <details class="raw-json-card">
    <summary class="card-summary">
      <span class="card-label">▸ {{ section.sectionName }}</span>
      <span class="meta">[点击展开原始 JSON]</span>
    </summary>
    <pre class="json-body">{{ JSON.stringify(section.data, null, 2) }}</pre>
    <div v-if="section.warnings && section.warnings.length > 0" class="warnings">
      <div v-for="(w, idx) in section.warnings" :key="idx" class="warning-item">&#9888; {{ w }}</div>
    </div>
  </details>
</template>

<style scoped>
.raw-json-card {
  margin-top: 12px;
  background: #fefcf6;
  border: 1px solid #d4cdb8;
  padding: 10px 14px;
  border-radius: 4px;
}
.card-summary {
  cursor: pointer;
  display: flex;
  gap: 10px;
  align-items: center;
  user-select: none;
  list-style: none;
}
.card-summary::-webkit-details-marker {
  display: none;
}
.card-label {
  font-family: monospace;
  font-size: 10px;
  color: #a68449;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.meta {
  font-size: 10px;
  color: #a8a29e;
  font-style: italic;
}
.json-body {
  margin-top: 10px;
  padding: 10px;
  background: #f2ece0;
  border-radius: 4px;
  font-family: monospace;
  font-size: 10px;
  color: #3d3d3d;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.warnings {
  margin-top: 8px;
}
.warning-item {
  font-size: 10px;
  color: #92400e;
  margin-top: 4px;
  font-family: 'Noto Serif SC', serif;
}
</style>
