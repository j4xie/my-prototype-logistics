<!-- spec 数据织网/04-C-字段血统与继承.md §6.1 — confidence + source presentation badge -->
<script setup lang="ts">
import { computed } from 'vue';

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

/** spec §6.3 NC-4: source_type → friendly Chinese label, raw fallback so we never silently lose info */
function sourceLabel(source: string): string {
  switch (source) {
    case 'manual':
      return '客户手动确认';
    case 'bill_flow':
      return '账单流水';
    case 'product_summary':
      return '商品汇总';
    case 'review':
      return '评论数据';
    case 'inferred':
      return 'AI 推断';
    case 'industry_default':
      return '行业默认值';
    case 'system':
      return '系统生成';
    default:
      return source;
  }
}
</script>

<template>
  <div class="trust-indicator">
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
