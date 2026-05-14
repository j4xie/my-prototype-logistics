<template>
  <div class="attachment-upload">
    <el-upload
      ref="uploadRef"
      :show-file-list="false"
      :auto-upload="true"
      :before-upload="handleBefore"
      :http-request="customUpload"
      :disabled="uploading"
      :accept="accept"
    >
      <el-button
        :type="buttonType"
        :icon="Paperclip"
        :loading="uploading"
        :disabled="uploading"
      >
        {{ buttonLabel ?? '添加附件' }}
      </el-button>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Paperclip } from '@element-plus/icons-vue';
import {
  uploadAndRegister,
  type Attachment,
  type AttachmentEntityType,
  type AttachmentFileCategory,
} from '@/api/attachment';

interface Props {
  entityType: AttachmentEntityType;
  entityId: string;
  factoryId?: string;
  businessTag?: string;
  fileCategory?: AttachmentFileCategory;
  buttonType?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
  buttonLabel?: string;
  accept?: string;
  /** 上限 byte. 默认 50MB. */
  maxSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  buttonType: 'primary',
  accept: 'image/*,application/pdf,video/mp4',
  maxSize: 50 * 1024 * 1024,
});

const emit = defineEmits<{ uploaded: [att: Attachment] }>();

const uploading = ref(false);
const uploadRef = ref();

function handleBefore(file: File): boolean {
  if (file.size > props.maxSize) {
    ElMessage.error(`文件超出上限 ${formatSize(props.maxSize)}`);
    return false;
  }
  return true;
}

async function customUpload(opts: { file: File }): Promise<void> {
  uploading.value = true;
  try {
    const saved = await uploadAndRegister(
      opts.file,
      props.entityType,
      props.entityId,
      {
        businessTag: props.businessTag,
        fileCategory: props.fileCategory,
      },
      props.factoryId,
    );
    emit('uploaded', saved);
    ElMessage.success('上传成功');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '上传失败';
    ElMessage.error(msg);
  } finally {
    uploading.value = false;
  }
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<style scoped>
.attachment-upload {
  display: inline-block;
}
</style>
