<template>
  <div class="failed-sheet-view">
    <el-result icon="error" title="Sheet 处理失败" :sub-title="message">
      <template #extra>
        <el-button
          v-if="canRetry"
          type="primary"
          :loading="retrying"
          @click="$emit('retry')"
        >
          {{ retrying ? '重试中...' : '重新处理' }}
        </el-button>
        <el-text v-else type="info" style="margin-top: 8px">
          该 Sheet 未生成上传记录，请重新上传整个文件
        </el-text>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  canRetry: boolean;
  retrying: boolean;
}>();

defineEmits<{
  (e: 'retry'): void;
}>();
</script>
