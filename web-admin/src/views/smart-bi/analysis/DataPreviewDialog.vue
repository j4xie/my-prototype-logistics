<template>
  <el-dialog v-model="visible" :title="`数据预览 - ${sheetName}`" width="90%" top="5vh">
    <div v-loading="loading">
      <el-table v-if="data?.data" :data="data.data" border stripe max-height="500" size="small">
        <el-table-column v-for="header in data.headers" :key="header"
          :prop="header" :label="getColumnLabel(header)" min-width="120" show-overflow-tooltip />
      </el-table>
      <div v-if="data?.total" style="margin-top: 12px; display: flex; justify-content: center;">
        <el-pagination layout="prev, pager, next, total"
          :total="data.total" :page-size="50" :current-page="page"
          @current-change="handlePageChange" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getUploadTableData } from '@/api/smartbi';

interface PreviewData {
  headers: string[];
  data: Record<string, unknown>[];
  total: number;
  totalPages: number;
}

const props = defineProps<{
  getColumnLabel: (col: string) => string;
}>();

const visible = ref(false);
const loading = ref(false);
const data = ref<PreviewData | null>(null);
const page = ref(1);
const sheetName = ref('');
const uploadId = ref<number | null>(null);

const loadPage = async () => {
  if (!uploadId.value) return;
  loading.value = true;
  try {
    const res = await getUploadTableData(uploadId.value, page.value - 1, 50);
    if (res.success && res.data) {
      data.value = res.data;
    } else {
      ElMessage.error(res.message || '获取数据失败');
    }
  } catch (error) {
    console.error('[失败]', error);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (p: number) => {
  page.value = p;
  loadPage();
};

const open = async (sheet: { uploadId?: number | null; sheetName: string }) => {
  if (!sheet.uploadId) {
    ElMessage.warning('该 Sheet 没有持久化数据');
    return;
  }
  uploadId.value = sheet.uploadId;
  sheetName.value = sheet.sheetName;
  page.value = 1;
  data.value = null;
  visible.value = true;
  await loadPage();
};

defineExpose({ open });
</script>
