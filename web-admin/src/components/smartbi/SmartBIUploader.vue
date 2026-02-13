<script setup lang="ts">
/**
 * SmartBIUploader — Upload dropzone with drag-and-drop, file selection, and SSE progress display.
 * Extracted from SmartBIAnalysis.vue (AUDIT-026) to reduce god-component size.
 *
 * This is a presentational component: the parent owns the upload logic and passes state via props.
 * The component emits events for user actions (file change, upload click).
 */
import { ref, watch } from 'vue';
import { UploadFilled, Upload, Loading, CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile, UploadInstance } from 'element-plus';

interface SheetProgress {
  sheetIndex: number;
  sheetName: string;
  stage: string;
  message: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
}

const props = defineProps<{
  /** Whether the user has upload permission */
  canUpload: boolean;
  /** Whether history data is currently loading */
  historyLoading: boolean;
  /** Whether an upload is in progress */
  uploading: boolean;
  /** Upload progress percentage 0-100 */
  uploadProgress: number;
  /** Upload status for the progress bar */
  uploadStatus?: 'success' | 'exception' | 'warning';
  /** Current progress message text */
  progressText: string;
  /** Per-sheet progress items */
  sheetProgressList: SheetProgress[];
  /** Total sheet count for progress display */
  totalSheetCount: number;
  /** Completed sheet count for progress display */
  completedSheetCount: number;
  /** Dictionary hit count */
  dictionaryHits: number;
  /** LLM analyzed field count */
  llmAnalyzedFields: number;
}>();

const emit = defineEmits<{
  (e: 'fileChange', file: UploadFile): void;
  (e: 'upload'): void;
}>();

const uploadRef = ref<UploadInstance>();
const fileList = ref<UploadUserFile[]>([]);

function handleFileChange(file: UploadFile) {
  fileList.value = [file];
  emit('fileChange', file);
}

function handleUploadClick() {
  emit('upload');
}

/** Allow parent to reset file list (e.g., after successful upload or error) */
function resetFileList() {
  fileList.value = [];
  uploadRef.value?.clearFiles();
}

defineExpose({ resetFileList });
</script>

<template>
  <!-- Upload / empty data area -->
  <div v-if="!uploading" class="upload-section">
    <!-- Loading history -->
    <div v-if="historyLoading" style="text-align: center; padding: 60px 0;">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p style="color: #86909c; margin-top: 12px;">正在加载历史数据...</p>
    </div>
    <!-- Admin: show upload area -->
    <template v-else-if="canUpload">
      <el-upload
        ref="uploadRef"
        class="upload-dragger"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽 Excel 文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx、.xls 格式，文件大小不超过 50MB
          </div>
        </template>
      </el-upload>

      <el-button
        v-if="fileList.length > 0"
        type="primary"
        size="large"
        :loading="uploading"
        @click="handleUploadClick"
        style="margin-top: 20px; width: 100%"
      >
        <el-icon><Upload /></el-icon>
        开始分析
      </el-button>
    </template>
    <!-- Read-only user: prompt -->
    <el-empty v-else description="暂无分析数据，请联系管理员上传 Excel 文件" />
  </div>

  <!-- Upload progress (SSE streaming) -->
  <div v-if="uploading" class="progress-section">
    <el-progress :percentage="uploadProgress" :status="uploadStatus" :stroke-width="20" striped striped-flow />
    <p class="progress-text">{{ progressText }}</p>

    <!-- Detailed progress panel -->
    <div v-if="sheetProgressList.length > 0" class="sheet-progress-panel">
      <div class="progress-header">
        <span>Sheet 处理进度 ({{ completedSheetCount }}/{{ totalSheetCount }})</span>
        <el-tag v-if="dictionaryHits > 0" type="success" size="small">
          字典命中: {{ dictionaryHits }}
        </el-tag>
        <el-tag v-if="llmAnalyzedFields > 0" type="warning" size="small">
          LLM分析: {{ llmAnalyzedFields }}
        </el-tag>
      </div>

      <div class="sheet-progress-list">
        <div
          v-for="sheet in sheetProgressList"
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

<style lang="scss" scoped>
.upload-section {
  padding: 40px 20px;
  text-align: center;
}

.upload-dragger {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.progress-section {
  padding: 40px 20px;

  .progress-text {
    text-align: center;
    margin-top: 12px;
    color: #606266;
    font-size: 14px;
  }
}

.sheet-progress-panel {
  margin-top: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;

  .progress-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-weight: 600;
    font-size: 14px;
    color: #303133;
  }
}

.sheet-progress-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-progress-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #e4e7ed;
  font-size: 13px;

  &.is-complete {
    border-color: #b7eb8f;
    background: #f6ffed;
  }

  &.is-failed {
    border-color: #ffa39e;
    background: #fff2f0;
  }

  .sheet-name {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    min-width: 120px;
  }

  .sheet-stage {
    color: #86909c;
    min-width: 100px;
  }

  .sheet-message {
    color: #606266;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-icon {
    &.success { color: #52c41a; }
    &.error { color: #ff4d4f; }
    &.loading { color: #1890ff; }
  }
}
</style>
