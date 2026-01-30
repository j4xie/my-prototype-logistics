<script setup lang="ts">
/**
 * SmartBI 经营驾驶舱
 * 展示企业经营核心 KPI、排行榜、趋势图表和 AI 洞察
 * 使用动态渲染组件，自动适配后端返回的任意 KPI/排行/图表数据
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Refresh } from '@element-plus/icons-vue';
import DynamicKPIRow from '@/components/smartbi/DynamicKPIRow.vue';
import DynamicRankingsRow from '@/components/smartbi/DynamicRankingsRow.vue';
import DynamicChartsSection from '@/components/smartbi/DynamicChartsSection.vue';
import type { DashboardResponse, KPICard, RankingItem, ChartConfig } from '@/types/smartbi';

const router = useRouter();
const authStore = useAuthStore();
// 使用 authStore 的 factoryId，如果为空则使用默认值 (用于测试/演示)
const factoryId = computed(() => authStore.factoryId || 'F001');

// ==================== 类型定义 ====================

// 前端使用的 AI 洞察
interface AIInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  content: string;
  suggestion?: string;
}

// ==================== 状态 ====================

const loading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// Dashboard 数据
const dashboardData = ref<DashboardResponse | null>(null);

// 动态 KPI 卡片
const kpiCards = computed<KPICard[]>(() => {
  return dashboardData.value?.kpiCards?.filter(c => c.rawValue != null) || [];
});

// 动态排行
const rankings = computed<Record<string, RankingItem[]>>(() => {
  return dashboardData.value?.rankings || {};
});

// 动态图表
const charts = computed<Record<string, ChartConfig>>(() => {
  return dashboardData.value?.charts || {};
});

const hasRankings = computed(() => {
  return Object.values(rankings.value).some(items => items && items.length > 0);
});

const hasCharts = computed(() => {
  return Object.keys(charts.value).length > 0;
});

// AI 洞察 (从 aiInsights 提取)
const aiInsights = computed<AIInsight[]>(() => {
  if (!dashboardData.value?.aiInsights) return [];

  return dashboardData.value.aiInsights.map(insight => ({
    type: mapInsightLevel(insight.level),
    title: insight.category || getCategoryTitle(insight.level),
    content: insight.message,
    suggestion: insight.actionSuggestion,
  }));
});

// 快捷问答
const quickQuestions = [
  '本月销售额如何?',
  '哪个部门业绩最好?',
  '利润率变化趋势如何?',
  '客户增长情况怎样?',
];

// ==================== 生命周期 ====================

onMounted(() => {
  loadDashboardData();
});

// ==================== API 调用 ====================

async function loadDashboardData() {
  if (!factoryId.value) {
    ElMessage.warning('未获取到工厂ID，请重新登录');
    return;
  }

  loading.value = true;
  hasError.value = false;
  errorMessage.value = '';

  try {
    const response = await get(`/${factoryId.value}/smart-bi/dashboard/executive?period=month`);

    if (response.success && response.data) {
      dashboardData.value = response.data as DashboardResponse;
    } else {
      throw new Error(response.message || '获取驾驶舱数据失败');
    }
  } catch (error) {
    console.error('加载驾驶舱数据失败:', error);
    hasError.value = true;
    errorMessage.value = error instanceof Error ? error.message : '加载数据失败，请稍后重试';
    ElMessage.error(errorMessage.value);
    dashboardData.value = null;
  } finally {
    loading.value = false;
  }
}

// ==================== 工具函数 ====================

function mapInsightLevel(level: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (level) {
    case 'GREEN': return 'success';
    case 'YELLOW': return 'warning';
    case 'RED': return 'danger';
    case 'INFO':
    default: return 'info';
  }
}

function getCategoryTitle(level: string): string {
  switch (level) {
    case 'GREEN': return '正向趋势';
    case 'YELLOW': return '需要关注';
    case 'RED': return '风险预警';
    case 'INFO':
    default: return '数据洞察';
  }
}

function goToAIQuery(question?: string) {
  if (question) {
    router.push({ name: 'SmartBIAIQuery', query: { q: question } });
  } else {
    router.push({ name: 'SmartBIAIQuery' });
  }
}

function getInsightTagType(type: string): 'success' | 'warning' | 'danger' | 'info' {
  return type as 'success' | 'warning' | 'danger' | 'info';
}
</script>

<template>
  <div class="smart-bi-dashboard">
    <div class="page-header">
      <div class="header-left">
        <h1>经营驾驶舱</h1>
        <span class="subtitle">Smart BI - Business Intelligence Dashboard</span>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="loadDashboardData" :loading="loading">刷新数据</el-button>
        <el-button type="success" :icon="ChatDotRound" @click="goToAIQuery()">AI 问答</el-button>
      </div>
    </div>

    <!-- 错误状态 -->
    <el-alert
      v-if="hasError"
      :title="errorMessage"
      type="error"
      show-icon
      closable
      class="error-alert"
      @close="hasError = false"
    />

    <!-- 动态 KPI 卡片区 -->
    <DynamicKPIRow :cards="kpiCards" :loading="loading" />

    <!-- 动态排行榜区 -->
    <DynamicRankingsRow v-if="hasRankings" :rankings="rankings" :loading="loading" />

    <!-- 动态图表区 -->
    <DynamicChartsSection v-if="hasCharts" :charts="charts" :loading="loading" />

    <!-- AI 洞察区 -->
    <el-row :gutter="16" class="insight-section">
      <el-col :span="24">
        <el-card class="insight-card" v-loading="loading">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI 智能洞察</span>
            </div>
          </template>
          <div class="insight-list" v-if="aiInsights.length > 0">
            <div
              v-for="(insight, index) in aiInsights"
              :key="index"
              class="insight-item"
            >
              <el-tag :type="getInsightTagType(insight.type)" size="small">
                {{ insight.title }}
              </el-tag>
              <span class="insight-content">{{ insight.content }}</span>
              <span v-if="insight.suggestion" class="insight-suggestion">
                建议: {{ insight.suggestion }}
              </span>
            </div>
          </div>
          <el-empty v-else description="暂无 AI 洞察数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷问答入口 -->
    <el-row :gutter="16" class="quick-qa-section">
      <el-col :span="24">
        <el-card class="quick-qa-card">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>快捷问答</span>
            </div>
          </template>
          <div class="quick-questions">
            <el-button
              v-for="(q, index) in quickQuestions"
              :key="index"
              round
              @click="goToAIQuery(q)"
            >
              {{ q }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.smart-bi-dashboard {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .header-left {
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }

    .subtitle {
      font-size: 13px;
      color: #909399;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.error-alert {
  margin-bottom: 16px;
}

// AI 洞察区
.insight-section {
  margin-bottom: 16px;
}

.insight-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }

  .insight-list {
    .insight-item {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child {
        border-bottom: none;
      }

      .el-tag {
        flex-shrink: 0;
      }

      .insight-content {
        font-size: 14px;
        color: #606266;
        line-height: 1.6;
        flex: 1;
        min-width: 200px;
      }

      .insight-suggestion {
        font-size: 13px;
        color: #909399;
        font-style: italic;
        width: 100%;
        padding-left: 60px;
      }
    }
  }
}

// 快捷问答区
.quick-qa-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }

  .quick-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
}

// 响应式适配
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
</style>
