<script setup lang="ts">
/**
 * 调度中心首页
 * 展示调度概览、今日排程、告警、统计数据
 */
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { getSchedulingDashboard, getUnresolvedAlerts, SchedulingDashboard, SchedulingAlert } from '@/api/scheduling';
import { ElMessage } from 'element-plus';
import {
  Calendar,
  User,
  Operation,
  Warning,
  Timer,
  TrendCharts,
  Plus,
  Refresh
} from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const dashboard = ref<SchedulingDashboard | null>(null);
const alerts = ref<SchedulingAlert[]>([]);
const refreshInterval = ref<number | null>(null);
const lastUpdated = ref<Date | null>(null);

onMounted(() => {
  loadData();
  // 每30秒自动刷新
  refreshInterval.value = window.setInterval(() => {
    loadData(true);
  }, 30000);
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});

async function loadData(silent = false) {
  if (!factoryId.value) return;

  if (!silent) {
    loading.value = true;
  }

  try {
    const [dashboardRes, alertsRes] = await Promise.all([
      getSchedulingDashboard(factoryId.value),
      getUnresolvedAlerts(factoryId.value)
    ]);

    if (dashboardRes.success && dashboardRes.data) {
      dashboard.value = dashboardRes.data;
    }
    if (alertsRes.success && alertsRes.data) {
      alerts.value = alertsRes.data;
    }
    lastUpdated.value = new Date();
  } catch (error) {
    console.error('加载数据失败:', error);
    if (!silent) {
      ElMessage.error('加载数据失败');
    }
  } finally {
    loading.value = false;
  }
}

function navigateTo(path: string) {
  router.push(path);
}

function getSeverityType(severity: string) {
  const map: Record<string, string> = {
    info: 'info',
    warning: 'warning',
    critical: 'danger'
  };
  return map[severity] || 'info';
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: '#909399',
    in_progress: '#E6A23C',
    completed: '#67C23A',
    delayed: '#F56C6C'
  };
  return map[status] || '#909399';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    delayed: '已延期'
  };
  return map[status] || status;
}

function formatTime(time: string) {
  if (!time) return '-';
  return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatProbability(prob: number) {
  if (prob === null || prob === undefined) return '-';
  return (prob * 100).toFixed(0) + '%';
}

function getProbabilityColor(prob: number) {
  if (prob >= 0.9) return '#67C23A';
  if (prob >= 0.7) return '#E6A23C';
  if (prob >= 0.5) return '#F56C6C';
  return '#909399';
}
</script>

<template>
  <div class="scheduling-dashboard" v-loading="loading">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <h1>调度中心</h1>
        <span v-if="lastUpdated" class="last-updated">
          上次更新: {{ lastUpdated.toLocaleTimeString('zh-CN') }}
        </span>
      </div>
      <div class="header-right">
        <el-button :icon="Refresh" @click="loadData(false)">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="navigateTo('/scheduling/plans/create')">
          创建调度计划
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
          <el-icon><Calendar /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboard?.planStats?.totalPlans || 0 }}</div>
          <div class="stat-label">今日计划</div>
        </div>
        <div class="stat-details">
          <span>草稿 {{ dashboard?.planStats?.draftPlans || 0 }}</span>
          <span>已确认 {{ dashboard?.planStats?.confirmedPlans || 0 }}</span>
          <span>进行中 {{ dashboard?.planStats?.inProgressPlans || 0 }}</span>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%)">
          <el-icon><User /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboard?.workerStats?.checkedIn || 0 }}/{{ dashboard?.workerStats?.totalAssigned || 0 }}</div>
          <div class="stat-label">到岗工人</div>
        </div>
        <div class="stat-details">
          <span>临时工 {{ dashboard?.workerStats?.temporaryWorkers || 0 }}</span>
          <span>平均绩效 {{ (dashboard?.workerStats?.averagePerformance || 0).toFixed(1) }}</span>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
          <el-icon><Operation /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ dashboard?.lineStats?.activeLines || 0 }}</div>
          <div class="stat-label">活跃产线</div>
        </div>
        <div class="stat-details">
          <span>利用率 {{ ((dashboard?.lineStats?.utilizationRate || 0) * 100).toFixed(0) }}%</span>
          <span>效率 {{ ((dashboard?.lineStats?.averageEfficiency || 0) * 100).toFixed(0) }}%</span>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover" :class="{ 'has-alerts': alerts.length > 0 }">
        <div class="stat-icon" :style="{ background: alerts.length > 0 ? 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }">
          <el-icon><Warning /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ alerts.length }}</div>
          <div class="stat-label">未处理告警</div>
        </div>
        <div class="stat-details">
          <el-button v-if="alerts.length > 0" type="danger" link size="small" @click="navigateTo('/scheduling/alerts')">
            立即处理 →
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 主要内容区 -->
    <div class="main-content">
      <!-- 今日排程 -->
      <el-card class="schedule-card">
        <template #header>
          <div class="card-header">
            <div class="header-title">
              <el-icon><Timer /></el-icon>
              <span>今日排程</span>
            </div>
            <el-button type="primary" link @click="navigateTo('/scheduling/plans')">
              查看全部 →
            </el-button>
          </div>
        </template>

        <div v-if="dashboard?.todaySchedules?.length" class="schedule-list">
          <div
            v-for="schedule in dashboard.todaySchedules"
            :key="schedule.id"
            class="schedule-item"
          >
            <div class="schedule-time">
              <span class="time-start">{{ formatTime(schedule.plannedStartTime) }}</span>
              <span class="time-separator">-</span>
              <span class="time-end">{{ formatTime(schedule.plannedEndTime) }}</span>
            </div>
            <div class="schedule-info">
              <div class="info-line">
                <span class="line-name">{{ schedule.productionLineName }}</span>
                <el-tag :color="getStatusColor(schedule.status)" size="small" effect="dark">
                  {{ getStatusText(schedule.status) }}
                </el-tag>
              </div>
              <div class="info-batch">{{ schedule.batchNumber }}</div>
              <div class="info-progress">
                <el-progress
                  :percentage="schedule.completionRate || 0"
                  :stroke-width="6"
                  :show-text="false"
                />
                <span class="progress-text">{{ schedule.completedQuantity || 0 }}/{{ schedule.targetQuantity }}</span>
              </div>
            </div>
            <div class="schedule-probability">
              <div
                class="probability-value"
                :style="{ color: getProbabilityColor(schedule.predictedCompletionProb) }"
              >
                {{ formatProbability(schedule.predictedCompletionProb) }}
              </div>
              <div class="probability-label">完成概率</div>
            </div>
            <div class="schedule-workers">
              <el-icon><User /></el-icon>
              <span>{{ schedule.assignedWorkerCount || 0 }} 人</span>
            </div>
          </div>
        </div>

        <el-empty v-else description="今日暂无排程" />
      </el-card>

      <!-- 告警列表 -->
      <el-card class="alerts-card">
        <template #header>
          <div class="card-header">
            <div class="header-title">
              <el-icon><Warning /></el-icon>
              <span>最新告警</span>
            </div>
            <el-button type="primary" link @click="navigateTo('/scheduling/alerts')">
              查看全部 →
            </el-button>
          </div>
        </template>

        <div v-if="alerts.length" class="alert-list">
          <div
            v-for="alert in alerts.slice(0, 5)"
            :key="alert.id"
            class="alert-item"
          >
            <el-tag :type="getSeverityType(alert.severity)" size="small">
              {{ alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '提示' }}
            </el-tag>
            <div class="alert-content">
              <div class="alert-message">{{ alert.message }}</div>
              <div class="alert-time">{{ new Date(alert.createdAt).toLocaleString('zh-CN') }}</div>
            </div>
            <div class="alert-action" v-if="alert.suggestedAction">
              <el-tooltip :content="alert.suggestedAction" placement="left">
                <el-icon><TrendCharts /></el-icon>
              </el-tooltip>
            </div>
          </div>
        </div>

        <el-empty v-else description="暂无告警" />
      </el-card>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <el-card class="action-card" shadow="hover" @click="navigateTo('/scheduling/plans')">
        <el-icon class="action-icon"><Calendar /></el-icon>
        <span class="action-text">调度计划</span>
      </el-card>
      <el-card class="action-card" shadow="hover" @click="navigateTo('/scheduling/realtime')">
        <el-icon class="action-icon"><Timer /></el-icon>
        <span class="action-text">实时监控</span>
      </el-card>
      <el-card class="action-card" shadow="hover" @click="navigateTo('/scheduling/workers')">
        <el-icon class="action-icon"><User /></el-icon>
        <span class="action-text">人员分配</span>
      </el-card>
      <el-card class="action-card" shadow="hover" @click="navigateTo('/scheduling/alerts')">
        <el-icon class="action-icon"><Warning /></el-icon>
        <span class="action-text">告警管理</span>
      </el-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scheduling-dashboard {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin: 0;
    }

    .last-updated {
      font-size: 12px;
      color: #909399;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  position: relative;
  overflow: hidden;

  &.has-alerts {
    animation: pulse 2s infinite;
  }

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
  }

  .stat-content {
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #303133;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-top: 4px;
    }
  }

  .stat-details {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #909399;
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(245, 108, 108, 0);
  }
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: #ebeef5;
  }

  .schedule-time {
    min-width: 100px;
    text-align: center;

    .time-start, .time-end {
      font-weight: 600;
      color: #303133;
    }

    .time-separator {
      margin: 0 4px;
      color: #909399;
    }
  }

  .schedule-info {
    flex: 1;

    .info-line {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;

      .line-name {
        font-weight: 600;
        color: #303133;
      }
    }

    .info-batch {
      font-size: 12px;
      color: #909399;
      margin-bottom: 8px;
    }

    .info-progress {
      display: flex;
      align-items: center;
      gap: 12px;

      .el-progress {
        flex: 1;
      }

      .progress-text {
        font-size: 12px;
        color: #606266;
        min-width: 60px;
        text-align: right;
      }
    }
  }

  .schedule-probability {
    text-align: center;
    min-width: 80px;

    .probability-value {
      font-size: 20px;
      font-weight: 700;
    }

    .probability-label {
      font-size: 12px;
      color: #909399;
    }
  }

  .schedule-workers {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #606266;
    font-size: 14px;
  }
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;

  .alert-content {
    flex: 1;

    .alert-message {
      font-size: 14px;
      color: #303133;
      margin-bottom: 4px;
    }

    .alert-time {
      font-size: 12px;
      color: #909399;
    }
  }

  .alert-action {
    color: #409EFF;
    cursor: pointer;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.action-card {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
  }

  .action-icon {
    font-size: 32px;
    color: #409EFF;
  }

  .action-text {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}
</style>
