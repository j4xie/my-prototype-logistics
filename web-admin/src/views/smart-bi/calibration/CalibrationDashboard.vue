<script setup lang="ts">
/**
 * CalibrationDashboard - AI 行为校准监控仪表盘
 * 展示 ET-Agent 的行为校准指标、趋势和工具调用情况
 */
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Setting, Download, TrendCharts, Histogram } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/modules/auth';
import {
  getCalibrationDashboard,
  getMetricsTrend,
  getToolReliabilityRanking,
  getToolCalls,
  getFactoryOptions
} from '@/api/calibration';
import type {
  MetricItem,
  TrendDataPoint,
  ToolReliabilityItem,
  ToolCallRecord,
  TimeGranularity,
  FactoryOption,
  ToolCallQueryParams
} from '@/types/calibration';

// 组件导入
import MetricCard from '@/components/calibration/MetricCard.vue';
import MetricsTrendChart from '@/components/calibration/MetricsTrendChart.vue';
import ToolReliabilityTable from '@/components/calibration/ToolReliabilityTable.vue';
import ToolCallsTable from '@/components/calibration/ToolCallsTable.vue';

const authStore = useAuthStore();

// 判断是否为平台管理员
const isPlatformAdmin = computed(() => {
  return authStore.user?.role === 'platform_admin';
});

// 当前工厂 ID
const currentFactoryId = computed(() => {
  return selectedFactoryId.value || authStore.factoryId;
});

// ==================== 状态定义 ====================

// 加载状态
const dashboardLoading = ref(false);
const metricsLoading = ref(false);
const trendLoading = ref(false);
const reliabilityLoading = ref(false);
const callsLoading = ref(false);

// 工厂选择（平台管理员）
const factoryOptions = ref<FactoryOption[]>([]);
const selectedFactoryId = ref<string>('');

// 时间粒度
const timeGranularity = ref<TimeGranularity>('day');

// 指标数据
const metrics = ref<MetricItem[]>([]);

// 趋势数据
const trendData = ref<TrendDataPoint[]>([]);

// 工具可靠性排名
const toolReliability = ref<ToolReliabilityItem[]>([]);

// 工具调用记录
const toolCalls = ref<ToolCallRecord[]>([]);
const toolCallsTotal = ref(0);
const toolCallsPage = ref(1);
const toolCallsPageSize = ref(10);
const toolCallsFilters = ref<{ status?: string; toolCode?: string }>({});

// 工具选项（用于筛选）
const toolOptions = computed(() => {
  return toolReliability.value.map(t => ({
    label: t.toolName,
    value: t.toolCode
  }));
});

// 最后更新时间
const lastUpdated = ref<string>('');

// ==================== 数据加载 ====================

async function loadDashboard() {
  dashboardLoading.value = true;
  try {
    await Promise.all([
      loadMetrics(),
      loadTrendData(),
      loadToolReliability(),
      loadToolCalls()
    ]);
    lastUpdated.value = new Date().toLocaleString('zh-CN');
  } catch (error) {
    console.error('加载仪表盘数据失败:', error);
    ElMessage.error('加载数据失败，请重试');
  } finally {
    dashboardLoading.value = false;
  }
}

async function loadMetrics() {
  metricsLoading.value = true;
  try {
    const response = await getCalibrationDashboard(currentFactoryId.value);
    if (response.success && response.data) {
      metrics.value = response.data.metrics;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载指标数据失败');
    }
  } catch (error) {
    console.error('加载指标数据失败:', error);
    ElMessage.error('加载指标数据失败');
  } finally {
    metricsLoading.value = false;
  }
}

async function loadTrendData() {
  trendLoading.value = true;
  try {
    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // 默认 14 天

    const response = await getMetricsTrend({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      granularity: timeGranularity.value,
      factoryId: currentFactoryId.value
    });

    if (response.success && response.data) {
      trendData.value = response.data;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载趋势数据失败');
    }
  } catch (error) {
    console.error('加载趋势数据失败:', error);
    ElMessage.error('加载趋势数据失败');
  } finally {
    trendLoading.value = false;
  }
}

async function loadToolReliability() {
  reliabilityLoading.value = true;
  try {
    const response = await getToolReliabilityRanking(currentFactoryId.value, 10);
    if (response.success && response.data) {
      toolReliability.value = response.data;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载工具可靠性排名失败');
    }
  } catch (error) {
    console.error('加载工具可靠性数据失败:', error);
    ElMessage.error('加载工具可靠性排名失败');
  } finally {
    reliabilityLoading.value = false;
  }
}

async function loadToolCalls() {
  callsLoading.value = true;
  try {
    const params: ToolCallQueryParams = {
      page: toolCallsPage.value - 1,
      size: toolCallsPageSize.value,
      ...toolCallsFilters.value
    };

    const response = await getToolCalls(params);
    if (response.success && response.data) {
      toolCalls.value = response.data.content;
      toolCallsTotal.value = response.data.totalElements;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载工具调用记录失败');
    }
  } catch (error) {
    console.error('加载工具调用记录失败:', error);
    ElMessage.error('加载工具调用记录失败');
  } finally {
    callsLoading.value = false;
  }
}

async function loadFactoryOptions() {
  if (!isPlatformAdmin.value) return;

  try {
    const response = await getFactoryOptions();
    if (response.success && response.data) {
      factoryOptions.value = response.data;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载工厂列表失败');
    }
  } catch (error) {
    console.error('加载工厂列表失败:', error);
    ElMessage.error('加载工厂列表失败');
  }
}

// ==================== 事件处理 ====================

function handleRefresh() {
  loadDashboard();
}

function handleGranularityChange(granularity: TimeGranularity) {
  timeGranularity.value = granularity;
  loadTrendData();
}

function handleFactoryChange() {
  loadDashboard();
}

function handleToolCallsPageChange(page: number) {
  toolCallsPage.value = page;
  loadToolCalls();
}

function handleToolCallsSizeChange(size: number) {
  toolCallsPageSize.value = size;
  toolCallsPage.value = 1;
  loadToolCalls();
}

function handleToolCallsFilter(filters: { status?: string; toolCode?: string }) {
  toolCallsFilters.value = filters;
  toolCallsPage.value = 1;
  loadToolCalls();
}

function handleToolCallsRefresh() {
  loadToolCalls();
}

function handleViewToolCallDetail(record: ToolCallRecord) {
  ElMessage.info(`查看详情: ${record.id}`);
  // 可以打开详情弹窗或跳转详情页
}

function handleToolClick(tool: ToolReliabilityItem) {
  // 筛选该工具的调用记录
  toolCallsFilters.value = { toolCode: tool.toolCode };
  toolCallsPage.value = 1;
  loadToolCalls();
  ElMessage.success(`已筛选工具: ${tool.toolName}`);
}

// ==================== 生命周期 ====================

onMounted(() => {
  loadFactoryOptions();
  loadDashboard();
});

// 监听工厂变化
watch(selectedFactoryId, () => {
  if (isPlatformAdmin.value) {
    loadDashboard();
  }
});
</script>

<template>
  <div class="calibration-dashboard">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>AI 行为校准监控</h1>
        <span class="subtitle">ET-Agent Behavior Calibration Dashboard</span>
      </div>
      <div class="header-right">
        <!-- 工厂选择器（平台管理员） -->
        <el-select
          v-if="isPlatformAdmin && factoryOptions.length > 0"
          v-model="selectedFactoryId"
          placeholder="选择工厂"
          clearable
          style="width: 200px; margin-right: 12px"
          @change="handleFactoryChange"
        >
          <el-option
            v-for="factory in factoryOptions"
            :key="factory.factoryId"
            :label="factory.name"
            :value="factory.factoryId"
          />
        </el-select>
        <el-button :icon="Refresh" @click="handleRefresh" :loading="dashboardLoading">
          刷新
        </el-button>
        <el-button :icon="Download" type="primary">
          导出报告
        </el-button>
      </div>
    </div>

    <!-- 更新时间提示 -->
    <div v-if="lastUpdated" class="last-updated">
      最后更新: {{ lastUpdated }}
    </div>

    <!-- 指标卡片区 -->
    <el-row :gutter="16" class="metrics-section">
      <el-col
        v-for="metric in metrics"
        :key="metric.key"
        :xs="24"
        :sm="12"
        :md="6"
      >
        <MetricCard
          :label="metric.label"
          :value="metric.value"
          :unit="metric.unit"
          :change="metric.change"
          :change-label="metric.changeLabel"
          :trend="metric.trend"
          :status="metric.status"
          :description="metric.description"
          :loading="metricsLoading"
          :format="metric.key === 'conciseness' || metric.key === 'successRate' ? 'percent' : 'score'"
        />
      </el-col>
    </el-row>

    <!-- 趋势图 -->
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><TrendCharts /></el-icon>
            <span>指标趋势</span>
          </div>
        </div>
      </template>
      <MetricsTrendChart
        :data="trendData"
        :loading="trendLoading"
        :height="350"
        @granularity-change="handleGranularityChange"
      />
    </el-card>

    <!-- 下方两栏 -->
    <el-row :gutter="16" class="bottom-section">
      <!-- 工具可靠性排名 -->
      <el-col :xs="24" :lg="8">
        <el-card class="reliability-card">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><Histogram /></el-icon>
                <span>工具可靠性排名</span>
              </div>
            </div>
          </template>
          <ToolReliabilityTable
            :data="toolReliability"
            :loading="reliabilityLoading"
            :max-items="8"
            @tool-click="handleToolClick"
          />
        </el-card>
      </el-col>

      <!-- 最近调用记录 -->
      <el-col :xs="24" :lg="16">
        <el-card class="calls-card">
          <template #header>
            <div class="card-header">
              <div class="header-title">
                <el-icon><Setting /></el-icon>
                <span>最近调用记录</span>
              </div>
            </div>
          </template>
          <ToolCallsTable
            :data="toolCalls"
            :loading="callsLoading"
            :total="toolCallsTotal"
            :page-size="toolCallsPageSize"
            :current-page="toolCallsPage"
            :tool-options="toolOptions"
            @page-change="handleToolCallsPageChange"
            @size-change="handleToolCallsSizeChange"
            @filter="handleToolCallsFilter"
            @refresh="handleToolCallsRefresh"
            @view-detail="handleViewToolCallDetail"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.calibration-dashboard {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .header-left {
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);
    }

    .subtitle {
      display: block;
      font-size: 13px;
      color: var(--el-text-color-secondary, #909399);
      margin-top: 4px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.last-updated {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 16px;
}

.metrics-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.chart-card,
.reliability-card,
.calls-card {
  border-radius: 12px;
  margin-bottom: 16px;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f2f5;
  }

  :deep(.el-card__body) {
    padding: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary, #303133);

      .el-icon {
        color: var(--el-color-primary, #1B65A8);
      }
    }
  }
}

.bottom-section {
  .el-col {
    margin-bottom: 16px;
  }
}

.reliability-card {
  height: 100%;

  :deep(.el-card__body) {
    max-height: 500px;
    overflow-y: auto;
  }
}

.calls-card {
  height: 100%;
}

// 响应式
@media (max-width: 768px) {
  .calibration-dashboard {
    padding: 12px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;

    .header-right {
      width: 100%;
      flex-wrap: wrap;

      .el-select {
        width: 100% !important;
        margin-right: 0 !important;
        margin-bottom: 8px;
      }
    }
  }
}
</style>
