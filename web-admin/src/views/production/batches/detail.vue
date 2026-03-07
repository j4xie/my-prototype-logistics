<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Refresh } from '@element-plus/icons-vue';
import { formatDateTime } from '@/utils/dateFormat';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);
const batchId = computed(() => route.params.id as string);

const loading = ref(false);
const batch = ref<any>(null);
const timeline = ref<any[]>([]);

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value || !batchId.value) return;

  loading.value = true;
  try {
    const [batchRes, timelineRes] = await Promise.allSettled([
      get(`/${factoryId.value}/processing/batches/${batchId.value}`),
      get(`/${factoryId.value}/processing/batches/${batchId.value}/timeline`)
    ]);

    if (batchRes.status === 'fulfilled' && batchRes.value.success) {
      batch.value = batchRes.value.data;
    } else {
      ElMessage.error('加载批次详情失败');
    }

    if (timelineRes.status === 'fulfilled' && timelineRes.value.success) {
      timeline.value = timelineRes.value.data || [];
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/production/batches');
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PLANNED: 'info',
    PENDING: 'info',
    IN_PROGRESS: 'warning',
    PAUSED: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PLANNED: '待生产',
    PENDING: '待生产',
    IN_PROGRESS: '生产中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  return map[status?.toUpperCase()] || status;
}

function getQualityStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING_INSPECTION: '待检验',
    INSPECTING: '检验中',
    PASSED: '已通过',
    FAILED: '不合格',
    PARTIAL_PASS: '部分合格',
    REWORK_REQUIRED: '需返工'
  };
  return map[status?.toUpperCase()] || status || '-';
}

function getQualityStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING_INSPECTION: 'info',
    INSPECTING: 'warning',
    PASSED: 'success',
    FAILED: 'danger',
    PARTIAL_PASS: 'warning',
    REWORK_REQUIRED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function formatNum(val: any, suffix = '') {
  if (val === null || val === undefined) return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : n.toLocaleString('zh-CN') + suffix;
}

function formatCost(val: any) {
  if (val === null || val === undefined) return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(val: any) {
  if (val === null || val === undefined) return '-';
  const n = Number(val);
  return isNaN(n) ? '-' : n.toFixed(1) + '%';
}

function formatDuration(minutes: number | null) {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}小时${m > 0 ? m + '分钟' : ''}` : `${m}分钟`;
}

function getTimelineIcon(type: string) {
  const map: Record<string, string> = {
    CREATED: 'primary',
    STARTED: 'primary',
    PAUSED: 'warning',
    RESUMED: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[type?.toUpperCase()] || 'primary';
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <!-- Empty state -->
    <el-card v-if="!loading && !batch" shadow="never">
      <el-empty description="批次数据不存在">
        <el-button @click="goBack">返回列表</el-button>
      </el-empty>
    </el-card>

    <template v-if="batch">
      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
          <h2 class="batch-title">{{ batch.batchNumber }}</h2>
          <el-tag :type="getStatusType(batch.status)" size="large">
            {{ getStatusText(batch.status) }}
          </el-tag>
        </div>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">计划数量</div>
          <div class="kpi-value">{{ formatNum(batch.plannedQuantity) }}</div>
          <div class="kpi-unit">{{ batch.unit || '' }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">实际产量</div>
          <div class="kpi-value" :class="{ 'text-success': batch.actualQuantity > 0 }">
            {{ formatNum(batch.actualQuantity) }}
          </div>
          <div class="kpi-unit">{{ batch.unit || '' }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">良品率</div>
          <div class="kpi-value" :class="{
            'text-success': batch.yieldRate >= 95,
            'text-warning': batch.yieldRate >= 80 && batch.yieldRate < 95,
            'text-danger': batch.yieldRate > 0 && batch.yieldRate < 80
          }">
            {{ formatPercent(batch.yieldRate) }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">完成效率</div>
          <div class="kpi-value">{{ formatPercent(batch.efficiency) }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">单位成本</div>
          <div class="kpi-value">{{ formatCost(batch.unitCost) }}</div>
        </div>
      </div>

      <!-- Detail Sections -->
      <div class="detail-grid">
        <!-- Basic Info -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span class="section-title">基本信息</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="批次号">{{ batch.batchNumber }}</el-descriptions-item>
            <el-descriptions-item label="产品类型">{{ batch.productName || batch.productType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="生产状态">
              <el-tag :type="getStatusType(batch.status)" size="small">
                {{ getStatusText(batch.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="质量状态">
              <el-tag v-if="batch.qualityStatus" :type="getQualityStatusType(batch.qualityStatus)" size="small">
                {{ getQualityStatusText(batch.qualityStatus) }}
              </el-tag>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="负责人">{{ batch.supervisorName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="工人数">{{ batch.workerCount || '-' }} 人</el-descriptions-item>
            <el-descriptions-item label="生产线">{{ batch.equipmentName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="工作时长">{{ formatDuration(batch.workDurationMinutes) }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ formatDateTime(batch.startTime) }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ formatDateTime(batch.endTime) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDateTime(batch.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDateTime(batch.updatedAt) }}</el-descriptions-item>
            <el-descriptions-item v-if="batch.notes" label="备注" :span="2">{{ batch.notes }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Quantity & Quality -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span class="section-title">产量与质量</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="计划数量">{{ formatNum(batch.plannedQuantity) }} {{ batch.unit }}</el-descriptions-item>
            <el-descriptions-item label="实际产量">{{ formatNum(batch.actualQuantity) }} {{ batch.unit }}</el-descriptions-item>
            <el-descriptions-item label="良品数量">{{ formatNum(batch.goodQuantity) }} {{ batch.unit }}</el-descriptions-item>
            <el-descriptions-item label="不良品数量">
              <span :class="{ 'text-danger': batch.defectQuantity > 0 }">
                {{ formatNum(batch.defectQuantity) }} {{ batch.unit }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="良品率">
              <span :class="{
                'text-success': batch.yieldRate >= 95,
                'text-warning': batch.yieldRate >= 80 && batch.yieldRate < 95,
                'text-danger': batch.yieldRate > 0 && batch.yieldRate < 80
              }">
                {{ formatPercent(batch.yieldRate) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="完成效率">{{ formatPercent(batch.efficiency) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Cost Breakdown -->
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span class="section-title">成本明细</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="原料成本">{{ formatCost(batch.materialCost) }}</el-descriptions-item>
            <el-descriptions-item label="人工成本">{{ formatCost(batch.laborCost) }}</el-descriptions-item>
            <el-descriptions-item label="设备成本">{{ formatCost(batch.equipmentCost) }}</el-descriptions-item>
            <el-descriptions-item label="其他成本">{{ formatCost(batch.otherCost) }}</el-descriptions-item>
            <el-descriptions-item label="总成本">
              <span class="cost-total">{{ formatCost(batch.totalCost) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="单位成本">{{ formatCost(batch.unitCost) }}/{{ batch.unit }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- Timeline -->
        <el-card v-if="timeline.length > 0" shadow="never" class="detail-card">
          <template #header>
            <span class="section-title">生产时间线</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in timeline"
              :key="index"
              :type="getTimelineIcon(item.type || item.action)"
              :timestamp="formatDateTime(item.timestamp || item.createdAt)"
              placement="top"
            >
              <div class="timeline-content">
                <strong>{{ item.title || item.action || '-' }}</strong>
                <p v-if="item.description || item.notes">{{ item.description || item.notes }}</p>
                <p v-if="item.operatorName" class="timeline-operator">操作人: {{ item.operatorName }}</p>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 16px 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .batch-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-color-primary, #303133);
  }
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.kpi-card {
  background: #fff;
  border: 1px solid var(--border-color-lighter, #ebeef5);
  border-radius: 8px;
  padding: 16px 20px;
  text-align: center;

  .kpi-label {
    font-size: 13px;
    color: var(--text-color-secondary, #909399);
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color-primary, #303133);
    line-height: 1.2;
  }

  .kpi-unit {
    font-size: 12px;
    color: var(--text-color-secondary, #909399);
    margin-top: 4px;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-card {
  :deep(.el-card__header) {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color-primary, #303133);
}

.cost-total {
  font-weight: 700;
  color: var(--el-color-primary);
  font-size: 15px;
}

.text-success { color: #67C23A; }
.text-warning { color: #E6A23C; }
.text-danger { color: #F56C6C; }

.timeline-content {
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-color-secondary, #909399);
  }

  .timeline-operator {
    font-size: 12px;
    color: var(--text-color-placeholder, #C0C4CC);
  }
}

@media (max-width: 1200px) {
  .kpi-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
