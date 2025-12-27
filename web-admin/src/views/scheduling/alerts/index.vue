<script setup lang="ts">
/**
 * 告警管理页面
 * 查看、确认、解决调度告警
 */
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import {
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  SchedulingAlert
} from '@/api/scheduling';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Check, CircleCheck, Warning, InfoFilled } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<SchedulingAlert[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchForm = ref({
  severity: '',
  alertType: ''
});

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await getAlerts(factoryId.value, {
      page: pagination.value.page - 1,
      size: pagination.value.size,
      severity: searchForm.value.severity || undefined,
      alertType: searchForm.value.alertType || undefined
    });

    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { severity: '', alertType: '' };
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

function handleSizeChange(size: number) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadData();
}

async function handleAcknowledge(alert: SchedulingAlert) {
  try {
    loading.value = true;
    const response = await acknowledgeAlert(factoryId.value!, alert.id);
    if (response.success) {
      ElMessage.success('已确认');
      loadData();
    }
  } catch (error) {
    console.error('确认失败:', error);
    ElMessage.error('确认失败');
  } finally {
    loading.value = false;
  }
}

async function handleResolve(alert: SchedulingAlert) {
  try {
    const { value: notes } = await ElMessageBox.prompt(
      '请输入解决方案说明',
      '解决告警',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /.+/,
        inputErrorMessage: '请输入解决方案'
      }
    );

    loading.value = true;
    const response = await resolveAlert(factoryId.value!, alert.id, notes);
    if (response.success) {
      ElMessage.success('已解决');
      loadData();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('解决失败:', error);
      ElMessage.error('解决失败');
    }
  } finally {
    loading.value = false;
  }
}

function getSeverityType(severity: string) {
  const map: Record<string, string> = {
    info: 'info',
    warning: 'warning',
    critical: 'danger'
  };
  return map[severity] || 'info';
}

function getSeverityText(severity: string) {
  const map: Record<string, string> = {
    info: '提示',
    warning: '警告',
    critical: '严重'
  };
  return map[severity] || severity;
}

function getAlertTypeText(type: string) {
  const map: Record<string, string> = {
    low_probability: '低完成概率',
    resource_conflict: '资源冲突',
    deadline_risk: '截止风险',
    efficiency_drop: '效率下降'
  };
  return map[type] || type;
}

function getSeverityIcon(severity: string) {
  if (severity === 'critical') return Warning;
  if (severity === 'warning') return Warning;
  return InfoFilled;
}
</script>

<template>
  <div class="alerts-page">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">告警管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
        </div>
      </template>

      <!-- 搜索区域 -->
      <div class="search-bar">
        <el-select v-model="searchForm.severity" placeholder="严重程度" clearable style="width: 120px">
          <el-option label="提示" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="严重" value="critical" />
        </el-select>
        <el-select v-model="searchForm.alertType" placeholder="告警类型" clearable style="width: 150px">
          <el-option label="低完成概率" value="low_probability" />
          <el-option label="资源冲突" value="resource_conflict" />
          <el-option label="截止风险" value="deadline_risk" />
          <el-option label="效率下降" value="efficiency_drop" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 告警列表 -->
      <div class="alerts-list">
        <div
          v-for="alert in tableData"
          :key="alert.id"
          class="alert-card"
          :class="{ resolved: alert.isResolved, [alert.severity]: true }"
        >
          <div class="alert-header">
            <div class="alert-icon">
              <el-icon :class="alert.severity"><component :is="getSeverityIcon(alert.severity)" /></el-icon>
            </div>
            <div class="alert-tags">
              <el-tag :type="getSeverityType(alert.severity)" size="small">
                {{ getSeverityText(alert.severity) }}
              </el-tag>
              <el-tag type="info" size="small">
                {{ getAlertTypeText(alert.alertType) }}
              </el-tag>
              <el-tag v-if="alert.isResolved" type="success" size="small">
                已解决
              </el-tag>
            </div>
            <div class="alert-time">
              {{ new Date(alert.createdAt).toLocaleString('zh-CN') }}
            </div>
          </div>

          <div class="alert-body">
            <div class="alert-message">{{ alert.message }}</div>
            <div class="alert-suggestion" v-if="alert.suggestedAction">
              <strong>建议操作：</strong>{{ alert.suggestedAction }}
            </div>
            <div class="alert-resolution" v-if="alert.resolutionNotes">
              <strong>解决方案：</strong>{{ alert.resolutionNotes }}
            </div>
          </div>

          <div class="alert-footer" v-if="!alert.isResolved && canWrite">
            <el-button
              v-if="!alert.acknowledgedAt"
              type="primary"
              size="small"
              :icon="Check"
              @click="handleAcknowledge(alert)"
            >
              确认告警
            </el-button>
            <el-button
              type="success"
              size="small"
              :icon="CircleCheck"
              @click="handleResolve(alert)"
            >
              解决告警
            </el-button>
          </div>

          <div class="alert-meta" v-if="alert.acknowledgedAt || alert.resolvedAt">
            <span v-if="alert.acknowledgedAt">
              确认于 {{ new Date(alert.acknowledgedAt).toLocaleString('zh-CN') }}
            </span>
            <span v-if="alert.resolvedAt">
              解决于 {{ new Date(alert.resolvedAt).toLocaleString('zh-CN') }}
            </span>
          </div>
        </div>

        <el-empty v-if="tableData.length === 0" description="暂无告警" />
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.alerts-page {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.alerts-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alert-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  border-left-width: 4px;
  transition: all 0.2s;

  &.info {
    border-left-color: #409EFF;
  }

  &.warning {
    border-left-color: #E6A23C;
    background: rgba(230, 162, 60, 0.05);
  }

  &.critical {
    border-left-color: #F56C6C;
    background: rgba(245, 108, 108, 0.05);
  }

  &.resolved {
    opacity: 0.7;
    background: #f5f7fa;
  }

  .alert-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .alert-icon {
      font-size: 24px;

      &.info { color: #409EFF; }
      &.warning { color: #E6A23C; }
      &.critical { color: #F56C6C; }
    }

    .alert-tags {
      display: flex;
      gap: 8px;
      flex: 1;
    }

    .alert-time {
      font-size: 12px;
      color: #909399;
    }
  }

  .alert-body {
    .alert-message {
      font-size: 14px;
      color: #303133;
      margin-bottom: 8px;
    }

    .alert-suggestion {
      font-size: 13px;
      color: #E6A23C;
      margin-bottom: 8px;
    }

    .alert-resolution {
      font-size: 13px;
      color: #67C23A;
    }
  }

  .alert-footer {
    display: flex;
    gap: 12px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
  }

  .alert-meta {
    margin-top: 12px;
    font-size: 12px;
    color: #909399;
    display: flex;
    gap: 16px;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  margin-top: 16px;
}
</style>
