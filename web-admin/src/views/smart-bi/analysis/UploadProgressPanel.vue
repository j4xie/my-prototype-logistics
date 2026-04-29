<template>
  <div v-if="uploading" class="progress-section">
    <el-progress :percentage="progress" :status="status" :stroke-width="20" striped striped-flow></el-progress>
    <p class="progress-text">{{ progressText }}</p>

    <!-- 详细进度面板 -->
    <div v-if="sheets.length > 0" class="sheet-progress-panel">
      <div class="progress-header">
        <span><span class="section-badge section-badge--chart" aria-hidden="true"></span> Sheet 处理进度 ({{ completedCount }}/{{ totalCount }})</span>
        <el-tag v-if="dictionaryHits > 0" type="success" size="small">
          字典命中: {{ dictionaryHits }}
        </el-tag>
        <el-tag v-if="llmAnalyzedFields > 0" type="warning" size="small">
          LLM分析: {{ llmAnalyzedFields }}
        </el-tag>
      </div>

      <div class="sheet-progress-list">
        <div
          v-for="sheet in sheets"
          :key="sheet.sheetIndex"
          class="sheet-progress-item"
          :class="{ 'is-complete': sheet.status === 'complete', 'is-failed': sheet.status === 'failed' }"
        >
          <div class="sheet-name">
            <el-icon v-if="sheet.status === 'complete'" class="status-icon success"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="sheet.status === 'failed'" class="status-icon error"><CircleCloseFilled /></el-icon>
            <el-icon v-else class="status-icon loading"><Loading /></el-icon>
            {{ sheet.sheetName }}
          </div>
          <div class="sheet-stage">{{ sheet.stage }}</div>
          <div class="sheet-message">{{ sheet.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue';

interface SheetProgress {
  sheetIndex: number;
  sheetName: string;
  stage: string;
  message: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
}

defineProps<{
  uploading: boolean;
  progress: number;
  status: '' | 'success' | 'exception' | 'warning';
  progressText: string;
  sheets: SheetProgress[];
  completedCount: number;
  totalCount: number;
  dictionaryHits: number;
  llmAnalyzedFields: number;
}>();
</script>
