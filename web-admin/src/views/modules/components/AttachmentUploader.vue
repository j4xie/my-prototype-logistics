<script setup lang="ts">
/**
 * AttachmentUploader — 附件上传组件
 * 支持单文件 / 多文件上传，使用 el-upload
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadProps, UploadFile, UploadRawFile } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: string | string[]
  factoryId: string
  accept?: string
  maxSize?: number   // MB, default 10
  maxCount?: number  // default 1
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

// Derived
const isMultiple = computed(() => (props.maxCount ?? 1) > 1)
const uploadAction = computed(() => `/api/mobile/${props.factoryId}/upload`)
const uploadHeaders = computed(() => {
  const token = localStorage.getItem('cretas_access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
})

// Build el-upload file list from modelValue for display
const fileList = ref<UploadFile[]>(buildFileList())

function buildFileList(): UploadFile[] {
  const val = props.modelValue
  if (!val) return []
  const urls = Array.isArray(val) ? val : [val]
  return urls.filter(Boolean).map((url, i) => ({
    uid: i,
    name: extractFileName(url),
    url,
    status: 'success',
    size: 0,
  } as unknown as UploadFile))
}

function extractFileName(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop() || url)
  } catch {
    return url
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const beforeUpload: UploadProps['beforeUpload'] = (rawFile: UploadRawFile) => {
  const maxMB = props.maxSize ?? 10
  if (rawFile.size > maxMB * 1024 * 1024) {
    ElMessage.error(`文件大小不能超过 ${maxMB}MB`)
    return false
  }
  return true
}

const onSuccess: UploadProps['onSuccess'] = (response: unknown, uploadFile: UploadFile) => {
  // Backend returns { success, data: { url } } or { url }
  const res = response as Record<string, unknown>
  let url: string | undefined
  if (res.success && res.data) {
    url = (res.data as Record<string, unknown>).url as string
  } else if (res.url) {
    url = res.url as string
  }

  if (!url) {
    ElMessage.error('上传失败：服务器未返回文件地址')
    return
  }

  // Update the file entry with the real URL
  uploadFile.url = url

  if (isMultiple.value) {
    const urls = fileList.value
      .filter((f) => f.status === 'success' && f.url)
      .map((f) => f.url as string)
    emit('update:modelValue', urls)
  } else {
    emit('update:modelValue', url)
  }
}

const onRemove: UploadProps['onRemove'] = (_uploadFile: UploadFile, uploadFiles: UploadFile[]) => {
  if (isMultiple.value) {
    const urls = uploadFiles
      .filter((f) => f.status === 'success' && f.url)
      .map((f) => f.url as string)
    emit('update:modelValue', urls)
  } else {
    emit('update:modelValue', '')
  }
}

const onError: UploadProps['onError'] = () => {
  ElMessage.error('上传失败，请重试')
}
</script>

<template>
  <div class="attachment-uploader">
    <el-upload
      v-model:file-list="fileList"
      :action="uploadAction"
      :headers="uploadHeaders"
      :accept="accept"
      :multiple="isMultiple"
      :limit="maxCount ?? 1"
      :disabled="readonly"
      :before-upload="beforeUpload"
      :on-success="onSuccess"
      :on-remove="onRemove"
      :on-error="onError"
      list-type="text"
    >
      <el-button v-if="!readonly" size="small" :icon="Upload">点击上传</el-button>
      <template #tip>
        <div v-if="!readonly" class="el-upload__tip">
          <span v-if="accept">支持格式: {{ accept }}，</span>
          <span>最大 {{ maxSize ?? 10 }}MB</span>
          <span v-if="isMultiple">，最多 {{ maxCount }} 个文件</span>
        </div>
      </template>
    </el-upload>
  </div>
</template>

<style scoped>
.attachment-uploader {
  width: 100%;
}
</style>
