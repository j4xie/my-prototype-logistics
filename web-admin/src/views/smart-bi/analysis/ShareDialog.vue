<template>
  <DesktopModal
    v-model="visible"
    action="分享分析报告"
    :context-label="reportContextLabel"
    width="500px"
  >
    <div v-if="!shareLink" style="text-align: center; padding: 20px;">
      <p style="margin-bottom: 16px; color: var(--color-text-regular, #606266);">生成公开链接，无需登录即可查看分析报告</p>
      <el-form label-width="80px" style="max-width: 380px; margin: 0 auto;">
        <el-form-item label="标题">
          <el-input v-model="shareTitle" placeholder="分析报告标题" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-select v-model="shareTTL" style="width: 100%">
            <el-option :value="1" label="1 天" />
            <el-option :value="7" label="7 天" />
            <el-option :value="30" label="30 天" />
            <el-option :value="90" label="90 天" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="createShareLink" :loading="shareCreating">
        <el-icon><Link /></el-icon> 生成分享链接
      </el-button>
    </div>
    <div v-else style="text-align: center; padding: 20px;">
      <el-result icon="success" title="分享链接已生成" sub-title="复制链接发送给他人即可查看">
        <template #extra>
          <el-input v-model="shareFullUrl" readonly style="margin-bottom: 12px;">
            <template #append>
              <el-button @click="copyShareLink">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </template>
          </el-input>
          <div style="color: var(--color-text-secondary, #909399); font-size: 12px;">
            有效期 {{ shareTTL }} 天 · 到期自动失效
          </div>
        </template>
      </el-result>
    </div>
  </DesktopModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Link, CopyDocument } from '@element-plus/icons-vue';
import { post } from '@/api/request';
import { DesktopModal } from '@/components/dialog';

interface BatchInfo {
  uploadId?: number | string;
  id?: number | string;
  fileName?: string;
  batchName?: string;
}

const props = defineProps<{
  factoryId: string;
  /** Sheet index as string (parent uses ref<string> for el-tabs binding). */
  activeTab: string;
}>();

const visible = ref(false);
const shareLink = ref('');
const shareFullUrl = ref('');
const shareTitle = ref('');
const shareTTL = ref(7);
const shareCreating = ref(false);

const currentBatchRef = ref<BatchInfo | null>(null);

// 防呆 R2: title shows entity identity (file name + batch id).
const reportContextLabel = computed(() => {
  const b = currentBatchRef.value;
  if (!b) return '';
  const name = b.fileName || b.batchName || '';
  const id = b.uploadId || b.id || '';
  return name && id ? `${name} (#${id})` : name || (id ? `#${id}` : '');
});

const open = (batch: BatchInfo | null | undefined) => {
  shareLink.value = '';
  shareFullUrl.value = '';
  currentBatchRef.value = batch ?? null;
  shareTitle.value = batch?.fileName || batch?.batchName || '数据分析报告';
  shareTTL.value = 7;
  visible.value = true;
};

const createShareLink = async () => {
  const cur = currentBatchRef.value;
  if (!cur?.uploadId && !cur?.id) {
    ElMessage.warning('请先选择一个上传数据');
    return;
  }
  shareCreating.value = true;
  try {
    const fId = props.factoryId;
    const uploadId = cur.uploadId || cur.id;
    const resp = await post(`/${fId}/smart-bi/share`, {
      uploadId,
      title: shareTitle.value,
      ttlDays: shareTTL.value,
      sheetIndex: typeof props.activeTab === 'string' ? parseInt(props.activeTab, 10) || 0 : props.activeTab,
    });
    if (resp.success) {
      const token = resp.data.token;
      shareLink.value = token;
      shareFullUrl.value = `${window.location.origin}/smart-bi/share/${token}`;
    } else {
      ElMessage.error(resp.message || '创建分享链接失败');
    }
  } catch (e: unknown) {
    ElMessage.error('创建分享链接失败');
    console.error('Share link creation failed:', e);
  } finally {
    shareCreating.value = false;
  }
};

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(shareFullUrl.value);
    ElMessage.success('链接已复制到剪贴板');
  } catch {
    const input = document.createElement('input');
    input.value = shareFullUrl.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    ElMessage.success('链接已复制');
  }
};

defineExpose({ open });
</script>
