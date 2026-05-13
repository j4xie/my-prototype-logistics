<script setup lang="ts">
/**
 * SmartBIUploader — Upload dropzone with drag-and-drop, file selection, and SSE progress display.
 * Extracted from SmartBIAnalysis.vue (AUDIT-026) to reduce god-component size.
 *
 * This is a presentational component: the parent owns the upload logic and passes state via props.
 * The component emits events for user actions (file change, upload click).
 *
 * Supports BOTH single-file (default) and multi-file modes via `maxCount`/`accept` props.
 * Multi-file mode added 2026-05-13 for QHJ revenue report (Phase I). Pattern mirrors
 * AttachmentUploader.vue's `maxCount` + `isMultiple` computed approach.
 */
import { computed, ref } from 'vue';
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
  /**
   * Max number of files. 1 = single (default; legacy single-file behavior);
   * >1 = multi w/ cap; 0 = unlimited (per Element Plus el-upload :limit semantics).
   * When >1 or 0, the component emits `filesChange` with the full array instead of `fileChange`.
   */
  maxCount?: number;
  /** Comma-separated accept list. Default: '.xlsx,.xls,.csv'. */
  accept?: string;
  /** Upload progress percentage 0-100 (optional in multi-file mode) */
  uploadProgress?: number;
  /** Upload status for the progress bar */
  uploadStatus?: 'success' | 'exception' | 'warning';
  /** Current progress message text (optional in multi-file mode) */
  progressText?: string;
  /** Per-sheet progress items (SSE single-file mode; empty array hides the panel) */
  sheetProgressList?: SheetProgress[];
  /** Total sheet count for progress display */
  totalSheetCount?: number;
  /** Completed sheet count for progress display */
  completedSheetCount?: number;
  /** Dictionary hit count */
  dictionaryHits?: number;
  /** LLM analyzed field count */
  llmAnalyzedFields?: number;
}>();

// Defaults for optional props (Vue 3 props don't directly support defaults
// with TypeScript-style defineProps; use computed/withDefaults-equivalent inline).
const maxCountResolved = computed(() => props.maxCount ?? 1);
const acceptResolved = computed(() => props.accept ?? '.xlsx,.xls,.csv');
const uploadProgressResolved = computed(() => props.uploadProgress ?? 0);
const uploadStatusResolved = computed(() => props.uploadStatus);
const progressTextResolved = computed(() => props.progressText ?? '');
const sheetProgressListResolved = computed(() => props.sheetProgressList ?? []);
const totalSheetCountResolved = computed(() => props.totalSheetCount ?? 0);
const completedSheetCountResolved = computed(() => props.completedSheetCount ?? 0);
const dictionaryHitsResolved = computed(() => props.dictionaryHits ?? 0);
const llmAnalyzedFieldsResolved = computed(() => props.llmAnalyzedFields ?? 0);

/** Multi-file mode iff maxCount != 1 (i.e., explicitly multi or unlimited). */
const isMultiple = computed(() => maxCountResolved.value !== 1);

const emit = defineEmits<{
  /** Single-file mode (maxCount === 1) — fires once per change with that file. */
  (e: 'fileChange', file: UploadFile): void;
  /** Multi-file mode (maxCount !== 1) — fires after each change w/ the full current list. */
  (e: 'filesChange', files: UploadUserFile[]): void;
  /** Multi-file mode — fires when user removes a file from the list. */
  (e: 'fileRemove', file: UploadFile, files: UploadUserFile[]): void;
  (e: 'upload'): void;
}>();

const uploadRef = ref<UploadInstance>();
const fileList = ref<UploadUserFile[]>([]);

function handleFileChange(file: UploadFile) {
  if (isMultiple.value) {
    // el-upload fires on-change ONCE PER FILE when user picks N files at once,
    // so we append. Dedup by uid in case of double-fire.
    if (!fileList.value.some((f) => f.uid === file.uid)) {
      fileList.value = [...fileList.value, file];
    }
    emit('filesChange', fileList.value);
  } else {
    // Legacy single-file: replace fileList + emit single-file signature unchanged.
    fileList.value = [file];
    emit('fileChange', file);
  }
}

function handleRemove(file: UploadFile, _files: UploadFile[]) {
  // Sync removal from el-upload UI back to our managed fileList.
  fileList.value = fileList.value.filter((f) => f.uid !== file.uid);
  emit('fileRemove', file, fileList.value);
  if (isMultiple.value) {
    emit('filesChange', fileList.value);
  }
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
        :multiple="isMultiple"
        :limit="maxCountResolved"
        :accept="acceptResolved"
        :on-change="handleFileChange"
        :on-remove="handleRemove"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          <template v-if="isMultiple">
            拖拽多个文件到此处或 <em>点击上传</em>
          </template>
          <template v-else>
            拖拽 Excel 或 CSV 文件到此处或 <em>点击上传</em>
          </template>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            <template v-if="isMultiple">
              支持 {{ acceptResolved }}<template v-if="maxCountResolved > 1">，最多 {{ maxCountResolved }} 个文件</template>
            </template>
            <template v-else>
              支持 .xlsx、.xls、.csv 格式，文件大小不超过 50MB
            </template>
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

  <!-- Upload progress (SSE streaming; sheetProgressList drives detail panel) -->
  <div v-if="uploading" class="progress-section">
    <el-progress :percentage="uploadProgressResolved" :status="uploadStatusResolved" :stroke-width="20" striped striped-flow />
    <p class="progress-text">{{ progressTextResolved }}</p>

    <!-- Detailed progress panel — only shown when SSE sheet progress is provided -->
    <div v-if="sheetProgressListResolved.length > 0" class="sheet-progress-panel">
      <div class="progress-header">
        <span>Sheet 处理进度 ({{ completedSheetCountResolved }}/{{ totalSheetCountResolved }})</span>
        <el-tag v-if="dictionaryHitsResolved > 0" type="success" size="small">
          字典命中: {{ dictionaryHitsResolved }}
        </el-tag>
        <el-tag v-if="llmAnalyzedFieldsResolved > 0" type="warning" size="small">
          LLM分析: {{ llmAnalyzedFieldsResolved }}
        </el-tag>
      </div>

      <div class="sheet-progress-list">
        <div
          v-for="sheet in sheetProgressListResolved"
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
