<template>
  <div v-if="visible" class="mat-panel">
    <div class="mat-panel__header">
      <el-icon><DataAnalysis /></el-icon>
      <span class="mat-panel__title">预设分析 ({{ results.length }})</span>
      <el-tag v-if="loading" size="small" type="info">正在加载</el-tag>
      <el-tag v-else-if="cached" size="small" type="success">已缓存</el-tag>
      <el-tag v-else size="small" type="warning">未计算</el-tag>
      <div class="mat-panel__spacer"></div>
      <el-button
        v-if="!cached && !loading && uploadId"
        size="small"
        type="primary"
        :loading="triggering"
        @click="handleTrigger"
      >
        立即生成
      </el-button>
      <el-button
        v-if="cached && !loading"
        size="small"
        :loading="triggering"
        @click="handleTrigger"
      >
        重新计算
      </el-button>
    </div>

    <div v-if="loading" class="mat-panel__empty">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="!cached && !triggering" class="mat-panel__empty">
      <el-empty description="此数据源尚未预计算，点击「立即生成」触发" />
    </div>

    <div v-else class="mat-panel__grid">
      <MaterializedAnalysisCard
        v-for="r in results"
        :key="r.code"
        :result="r"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DataAnalysis } from '@element-plus/icons-vue';
import MaterializedAnalysisCard from './MaterializedAnalysisCard.vue';
import {
  fetchCachedAnalytics,
  triggerMaterialization,
  type MaterializedResult,
} from '@/api/smartbi/materialized';

const props = defineProps<{
  uploadId: number | string | null | undefined;
  visible?: boolean;
}>();

const visible = computed(() => props.visible !== false);

const loading = ref(false);
const triggering = ref(false);
const cached = ref(false);
const results = ref<MaterializedResult[]>([]);

async function load(uploadId: number | string) {
  loading.value = true;
  try {
    const resp = await fetchCachedAnalytics(uploadId);
    if (resp.success) {
      cached.value = resp.cached;
      results.value = resp.results || [];
    } else {
      cached.value = false;
      results.value = [];
    }
  } catch (err) {
    console.error('[mat-panel] load failed', err);
    cached.value = false;
    results.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleTrigger() {
  if (!props.uploadId) return;
  triggering.value = true;
  try {
    const r = await triggerMaterialization(props.uploadId);
    if (r.success) {
      ElMessage.success(
        `预计算完成: 应用 ${r.applied}/${r.total_templates} 模板, 用时 ${(r.wall_ms / 1000).toFixed(1)}s`
      );
      await load(props.uploadId);
    }
  } catch (err) {
    console.error('[mat-panel] trigger failed', err);
    ElMessage.error('预计算失败，请查看日志');
  } finally {
    triggering.value = false;
  }
}

watch(
  () => props.uploadId,
  (id) => {
    if (id) {
      load(id);
    } else {
      results.value = [];
      cached.value = false;
    }
  },
  { immediate: true }
);

// Expose for parent (e.g., AIQuery can trigger refresh)
defineExpose({ reload: () => props.uploadId && load(props.uploadId) });
</script>

<style scoped>
.mat-panel {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.mat-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.mat-panel__title {
  font-weight: 600;
  color: #303133;
}

.mat-panel__spacer {
  flex: 1;
}

.mat-panel__empty {
  padding: 20px;
  text-align: center;
}

.mat-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
</style>
