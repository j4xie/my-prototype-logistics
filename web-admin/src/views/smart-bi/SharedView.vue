<template>
  <div class="shared-view">
    <!-- Error state -->
    <div v-if="error" class="shared-error">
      <el-result icon="warning" :title="error" sub-title="该分享链接无效或已过期">
        <template #extra>
          <el-button type="primary" @click="goHome">返回首页</el-button>
        </template>
      </el-result>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="shared-loading">
      <el-skeleton :rows="8" animated />
    </div>

    <!-- Content -->
    <div v-else class="shared-content">
      <div class="shared-header">
        <h2>{{ shareData?.title || '数据分析报告' }}</h2>
        <span class="shared-badge">
          <el-tag type="info" size="small">只读分享</el-tag>
        </span>
      </div>

      <!-- Data summary -->
      <el-card v-if="sheetData.length" class="shared-data-section">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>{{ shareData?.fileName || '数据' }} — {{ shareData?.sheetName || '' }}</span>
            <el-tag>{{ sheetData.length }} 行数据</el-tag>
          </div>
        </template>
        <el-table :data="sheetData.slice(0, 100)" max-height="500" stripe border size="small" style="width:100%">
          <el-table-column v-for="col in dataColumns" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />
        </el-table>
        <div v-if="sheetData.length > 100" style="text-align:center;padding:12px;color:#909399;">
          显示前 100 行（共 {{ sheetData.length }} 行）
        </div>
      </el-card>

      <el-empty v-else-if="!loading" description="暂无数据" />

      <div class="shared-footer">
        <span>Powered by Cretas SmartBI</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref('');
const shareData = ref<{
  token: string;
  title: string;
  uploadId: number;
  factoryId: string;
  sheetIndex?: number;
  fileName?: string;
  sheetName?: string;
} | null>(null);

// Chart data loaded from the upload
const sheetData = ref<Record<string, unknown>[]>([]);

const dataColumns = computed(() => {
  if (!sheetData.value.length) return [];
  return Object.keys(sheetData.value[0]).filter(k => !k.startsWith('_'));
});

const goHome = () => {
  router.push('/');
};

onMounted(async () => {
  const token = route.params.token as string;
  if (!token) {
    error.value = '缺少分享令牌';
    loading.value = false;
    return;
  }

  try {
    // Validate share token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const res = await axios.get(`${baseUrl}/api/public/smart-bi/share/${token}`);

    if (!res.data?.success) {
      error.value = res.data?.message || '分享链接无效';
      loading.value = false;
      return;
    }

    shareData.value = res.data.data;

    // Load the sheet data using the upload API
    try {
      const dataRes = await axios.get(
        `${baseUrl}/api/mobile/${shareData.value!.factoryId}/smart-bi/pg/upload/${shareData.value!.uploadId}/table-data`,
        { params: { sheetIndex: shareData.value!.sheetIndex || 0, page: 0, size: 2000 } }
      );
      if (dataRes.data?.success) {
        sheetData.value = dataRes.data.data?.data || [];
      }
    } catch (e) {
      console.warn('Failed to load sheet data:', e);
    }

    loading.value = false;
  } catch (e: unknown) {
    const axiosErr = e as { response?: { data?: { message?: string } } };
    error.value = axiosErr.response?.data?.message || '加载失败';
    loading.value = false;
  }
});
</script>

<style scoped>
.shared-view {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 20px;
}
.shared-error {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}
.shared-loading {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}
.shared-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.shared-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}
.shared-content {
  max-width: 1400px;
  margin: 0 auto;
}
.shared-footer {
  text-align: center;
  padding: 24px;
  color: #909399;
  font-size: 13px;
}
.shared-data-section {
  margin-top: 16px;
}
</style>
