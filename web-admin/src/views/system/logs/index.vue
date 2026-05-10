<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });

onMounted(() => loadData());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/system-logs`, {
      params: { page: pagination.value.page, size: pagination.value.size }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch {
    ElMessage.error('加载日志失败');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header><span>操作日志</span></template>
      <el-table :data="tableData" v-loading="loading" empty-text="暂无日志" stripe border>
        <el-table-column prop="operationType" label="操作类型" width="120" />
        <el-table-column prop="operatorName" label="操作人" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>
      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>
