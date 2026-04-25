<template>
  <el-select
    v-if="batches.length > 1"
    :model-value="selectedIndex"
    @update:model-value="onChange"
    style="width: 300px; margin-right: 8px;"
    size="small"
  >
    <el-option
      v-for="(batch, idx) in batches"
      :key="idx"
      :label="formatBatchLabel(batch)"
      :value="idx"
    >
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>
          <el-tag v-if="isAutoSyncBatch(batch)" size="small" type="success" style="margin-right: 6px;">自动同步</el-tag>
          {{ safeBatchName(batch) }}
        </span>
        <span style="color: var(--color-text-secondary, #909399); font-size: 12px; margin-left: 12px;">
          {{ batch.uploadTime }} · {{ batch.sheetCount }} 表
        </span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import type { UploadHistoryItem } from '@/api/smartbi';

interface UploadBatch {
  fileName: string;
  uploadTime: string;
  sheetCount: number;
  totalRows: number;
  uploads: UploadHistoryItem[];
  uploadId?: number;
  id?: number;
}

defineProps<{
  batches: UploadBatch[];
  selectedIndex: number;
  formatBatchLabel: (batch: UploadBatch) => string;
  isAutoSyncBatch: (batch: UploadBatch) => boolean;
  safeBatchName: (batch: UploadBatch) => string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedIndex', value: number): void;
  (e: 'change', value: number): void;
}>();

const onChange = (v: number) => {
  emit('update:selectedIndex', v);
  // Important: emit 'change' separately so parent's selectBatch (which holds
  // Phase 6 dropdown async race guards in its enrichSheet + idleEnrichNext
  // callbacks) fires after v-model has settled.
  emit('change', v);
};
</script>
