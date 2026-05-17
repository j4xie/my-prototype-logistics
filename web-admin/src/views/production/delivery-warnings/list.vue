<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import type { TableRow } from '@/types/api';

/**
 * 生产计划交货预警 dashboard — Sprint 4 Wave 2 M-DELIVERY-WARN-1.
 *
 * 调用 GET /api/mobile/{factoryId}/production-plans/delivery-warnings?windowDays=7
 * 返回 4 个预警等级 (OVERDUE / URGENT / WARN / NORMAL) 的 list, 按到期日期升序。
 */
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const windowDays = ref(7);

const overdueCount = computed(() => tableData.value.filter(r => r.warnLevel === 'OVERDUE').length);
const urgentCount = computed(() => tableData.value.filter(r => r.warnLevel === 'URGENT').length);
const warnCount = computed(() => tableData.value.filter(r => r.warnLevel === 'WARN').length);
const normalCount = computed(() => tableData.value.filter(r => r.warnLevel === 'NORMAL').length);

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/production-plans/delivery-warnings`, {
      params: { windowDays: windowDays.value }
    });
    if (response.success && response.data) {
      tableData.value = Array.isArray(response.data) ? response.data : [];
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载交货预警失败');
    }
  } catch (error) {
    console.error('加载交货预警失败:', error);
  } finally {
    loading.value = false;
  }
}

function getWarnTagType(level: string): string {
  switch (level) {
    case 'OVERDUE': return 'danger';
    case 'URGENT': return 'danger';
    case 'WARN': return 'warning';
    case 'NORMAL': return 'success';
    default: return 'info';
  }
}

function getWarnLabel(level: string): string {
  const map: Record<string, string> = {
    OVERDUE: '已超期',
    URGENT: '紧急 (<3d)',
    WARN: '预警 (3-7d)',
    NORMAL: '正常 (≥7d)'
  };
  return map[level] || level;
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PLANNED: '待执行',
    PENDING: '待执行',
    PREPARED: '草稿',
    IN_PROGRESS: '进行中',
    PAUSED: '暂停',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  return map[status] || status;
}

function formatDaysCell(days: number | null | undefined): string {
  if (days === null || days === undefined) return '-';
  if (days < 0) return `已超 ${Math.abs(days)} 天`;
  if (days === 0) return '今日到期';
  return `${days} 天后`;
}
</script>

<template>
  <div class="delivery-warnings-page">
    <div class="page-header">
      <h2>交货预警</h2>
      <div class="page-actions">
        <el-select v-model="windowDays" style="width: 160px" @change="loadData">
          <el-option :value="3" label="未来 3 天" />
          <el-option :value="7" label="未来 7 天" />
          <el-option :value="14" label="未来 14 天" />
          <el-option :value="30" label="未来 30 天" />
        </el-select>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="summary-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="card-danger">
          <div class="card-label">已超期</div>
          <div class="card-value">{{ overdueCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="card-urgent">
          <div class="card-label">紧急 (&lt;3d)</div>
          <div class="card-value">{{ urgentCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="card-warn">
          <div class="card-label">预警 (3-7d)</div>
          <div class="card-value">{{ warnCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="card-normal">
          <div class="card-label">正常 (≥7d)</div>
          <div class="card-value">{{ normalCount }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-table
      v-loading="loading"
      :data="tableData"
      stripe
      border
      empty-text="窗口内无交货预警"
      class="warn-table"
    >
      <el-table-column label="预警等级" width="120">
        <template #default="{ row }">
          <el-tag :type="getWarnTagType(row.warnLevel)" effect="dark">
            {{ getWarnLabel(row.warnLevel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="planNumber" label="计划编号" min-width="160" />
      <el-table-column label="产品类型" min-width="160">
        <template #default="{ row }">
          {{ row.productTypeName || row.productTypeId || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="sourceCustomerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column prop="plannedQuantity" label="计划数量" width="100" align="right" />
      <el-table-column prop="actualQuantity" label="实际数量" width="100" align="right" />
      <el-table-column prop="expectedCompletionDate" label="预期完工" width="120" />
      <el-table-column label="距交期" width="140" align="center">
        <template #default="{ row }">
          <span :class="row.warnLevel === 'OVERDUE' ? 'days-overdue' : ''">
            {{ formatDaysCell(row.daysUntilDeadline) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          {{ getStatusLabel(row.status) }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.delivery-warnings-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.page-actions {
  display: flex;
  gap: 8px;
}

.summary-cards {
  margin-bottom: 16px;
}

.summary-cards .card-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.summary-cards .card-value {
  font-size: 28px;
  font-weight: 600;
}

.summary-cards .card-danger .card-value { color: #f56c6c; }
.summary-cards .card-urgent .card-value { color: #e6a23c; }
.summary-cards .card-warn .card-value { color: #e6a23c; }
.summary-cards .card-normal .card-value { color: #67c23a; }

.days-overdue {
  color: #f56c6c;
  font-weight: 600;
}

.warn-table {
  margin-top: 8px;
}
</style>
