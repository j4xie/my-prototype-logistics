<template>
  <div>
    <!-- P2-6 fix: 加载历史数据 + 延迟提示 (Python 冷启时 history 调用可能 >10s) -->
    <div v-if="historyLoading" style="text-align: center; padding: 60px 0;">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p style="color: var(--color-text-secondary, #909399); margin-top: 12px;">正在加载历史数据...</p>
      <p v-if="historyLoadingLong" style="color: #E6A23C; margin-top: 8px; font-size: 13px;">
        首次访问 Python 需要 5-15 秒冷启动,请稍候...
      </p>
      <el-skeleton :rows="4" animated style="margin-top: 24px; max-width: 600px; margin-left: auto; margin-right: auto;" />
    </div>

    <!-- 管理员：显示上传区域 -->
    <template v-else-if="canUpload">
      <el-upload
        class="upload-dragger"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-change="onFileChange"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽 Excel 或 CSV 文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx、.xls、.csv 格式，文件大小不超过 50MB
          </div>
        </template>
      </el-upload>

      <el-button
        v-if="fileList.length > 0"
        type="primary"
        size="large"
        :loading="uploading"
        @click="$emit('upload')"
        style="margin-top: 20px; width: 100%"
      >
        <el-icon><Upload /></el-icon>
        开始分析
      </el-button>
    </template>

    <!-- 只读用户：提示 -->
    <SmartBIEmptyState v-else type="read-only" :show-action="false" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Loading, UploadFilled, Upload } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile } from 'element-plus';

const SmartBIEmptyState = defineAsyncComponent(() => import('@/components/smartbi/SmartBIEmptyState.vue'));

defineProps<{
  historyLoading: boolean;
  historyLoadingLong: boolean;
  canUpload: boolean;
  fileList: UploadUserFile[];
  uploading: boolean;
  onFileChange: (file: UploadFile) => void;
}>();

defineEmits<{
  (e: 'upload'): void;
}>();
</script>
