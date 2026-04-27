<!-- spec 数据织网/04-C-字段血统与继承.md §6.1 — confidence + source presentation badge -->
<script setup lang="ts">
import { computed } from 'vue';
import { sourceLabel } from '@/utils/provenance-labels';

const props = defineProps<{
  confidence: number; // 0-1
  source: string; // source_type string from backend
  cellAuditUrl?: string; // optional URL to lineage detail page
}>();

defineEmits<{
  audit: [];
}>();

/** spec §6.1: strict > thresholds — 0.85 / 0.7 */
const tagType = computed<'success' | 'warning' | 'info'>(() => {
  if (props.confidence > 0.85) return 'success';
  if (props.confidence > 0.7) return 'warning';
  return 'info';
});

const confidenceLabel = computed<string>(() => {
  if (props.confidence > 0.85) return '高置信';
  if (props.confidence > 0.7) return '中置信';
  return '低置信';
});

// P2-8 (a11y): aria-label on root container — tag color alone is not
// distinguishable for color-blind users.
const ariaLabel = computed<string>(
  () => `数据置信度 ${confidenceLabel.value} 来源 ${sourceLabel(props.source)}`,
);
</script>

<template>
  <div class="trust-indicator" role="group" :aria-label="ariaLabel">
    <el-tag :type="tagType" size="small">{{ confidenceLabel }}</el-tag>
    <span class="source-badge">[{{ sourceLabel(source) }}]</span>
    <el-button v-if="cellAuditUrl" link size="small" @click="$emit('audit')">
      查看来源
    </el-button>
  </div>
</template>

<style scoped>
.trust-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
}

.source-badge {
  color: var(--el-text-color-secondary);
}
</style>
