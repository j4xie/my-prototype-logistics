<script setup lang="ts">
/**
 * 财务管理 Dashboard
 * 适用角色: finance_manager
 * 特点: 财务数据、成本分析、AI 分析入口
 * 备注: 财务模块是 Web 专属功能
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { Money, TrendCharts, Coin, Document } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const loadError = ref('');
const factoryId = computed(() => authStore.factoryId);

// 财务统计数据
const financeStats = ref({
  totalRevenue: 0,
  totalCost: 0,
  grossProfit: 0,
  profitMargin: 0
});

// 统计卡片
const statCards = computed(() => [
  {
    title: '本月收入',
    value: financeStats.value.totalRevenue,
    unit: '万元',
    icon: Money,
    color: '#409eff',
    route: '/smart-bi/finance'
  },
  {
    title: '本月成本',
    value: financeStats.value.totalCost,
    unit: '万元',
    icon: Coin,
    color: '#e6a23c',
    route: '/smart-bi/finance?tab=cost'
  },
  {
    title: '毛利润',
    value: financeStats.value.grossProfit,
    unit: '万元',
    icon: TrendCharts,
    color: '#67c23a',
    route: '/smart-bi/finance'
  },
  {
    title: '利润率',
    value: financeStats.value.profitMargin,
    unit: '%',
    icon: Document,
    color: '#909399',
    route: '/smart-bi/finance'
  }
]);

// 快捷操作
const quickActions = [
  { title: '成本分析', icon: TrendCharts, route: '/smart-bi/finance?tab=cost', color: '#409eff', badge: 'AI' },
  { title: '财务报表', icon: Document, route: '/smart-bi/finance', color: '#67c23a' }
];

onMounted(async () => {
  await loadFinanceData();
});

async function loadFinanceData() {
  if (!factoryId.value) return;

  loading.value = true;
  loadError.value = '';
  try {
    // Default date range: first day of current month to today
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];

    const response = await get<any>(
      `/${factoryId.value}/smart-bi/analysis/finance`,
      { params: { startDate, endDate, analysisType: 'profit' } }
    );
    if (response.success && response.data) {
      const data = response.data;
      financeStats.value = {
        totalRevenue: (data.totalRevenue ?? data.revenue ?? 0) / 10000,
        totalCost: (data.totalCost ?? data.cost ?? 0) / 10000,
        grossProfit: (data.grossProfit ?? data.profit ?? 0) / 10000,
        profitMargin: data.profitMargin ?? data.profitRate ?? 0
      };
    } else {
      loadError.value = response.message || '暂无财务数据';
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '加载财务数据失败';
    loadError.value = msg;
  } finally {
    loading.value = false;
  }
}

function navigateTo(route: string) {
  router.push(route);
}
</script>

<template>
  <div class="dashboard-finance" v-loading="loading">
    <!-- 欢迎区 -->
    <div class="welcome-section">
      <div class="welcome-info">
        <h1>欢迎回来，{{ authStore.user?.fullName || authStore.user?.username }}</h1>
        <p>
          <el-tag type="danger" size="small">财务经理</el-tag>
          <el-tag type="info" size="small" class="web-tag">Web 专属</el-tag>
          <span class="factory-info">工厂: {{ factoryId }}</span>
        </p>
      </div>
      <div class="ai-entry">
        <el-button type="primary" @click="navigateTo('/smart-bi/finance?tab=cost')">
          <el-icon><TrendCharts /></el-icon>
          AI 成本分析
        </el-button>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-alert v-if="loadError" :title="loadError" type="warning" show-icon :closable="false" style="margin-bottom: 16px">
      <template #default>
        <el-button type="primary" link @click="loadFinanceData()">重试</el-button>
        <span style="margin-left: 8px; color: #909399;">或前往</span>
        <el-button type="primary" link @click="navigateTo('/smart-bi/finance')">财务分析</el-button>
        <span style="color: #909399;">查看详情</span>
      </template>
    </el-alert>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col v-for="card in statCards" :key="card.title" :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover" @click="navigateTo(card.route)">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-title">{{ card.title }}</span>
              <span class="stat-value" :style="{ color: card.color }">
                <template v-if="loadError">--</template>
                <template v-else>
                  {{ card.value.toFixed(1) }}
                  <small>{{ card.unit }}</small>
                </template>
              </span>
            </div>
            <el-icon class="stat-icon" :style="{ backgroundColor: card.color + '20', color: card.color }">
              <component :is="card.icon" />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷操作 -->
    <el-card class="quick-actions-card">
      <template #header>
        <span>财务管理</span>
      </template>
      <div class="quick-actions">
        <div
          v-for="action in quickActions"
          :key="action.title"
          class="action-item"
          @click="navigateTo(action.route)"
        >
          <div class="action-icon-wrapper">
            <el-icon :size="32" :style="{ color: action.color }">
              <component :is="action.icon" />
            </el-icon>
            <el-tag v-if="action.badge" type="danger" size="small" class="ai-badge">
              {{ action.badge }}
            </el-tag>
          </div>
          <span>{{ action.title }}</span>
        </div>
      </div>
    </el-card>

    <!-- 财务概览 -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>本月收支概览</span>
              <el-button type="primary" link @click="navigateTo('/smart-bi/finance')">
                查看详情
              </el-button>
            </div>
          </template>
          <div class="revenue-overview">
            <el-empty v-if="loadError || financeStats.totalRevenue === 0" description="暂无本月收支数据" :image-size="80" />
            <div v-else class="overview-chart">
              <div class="chart-bar revenue" :style="{ width: '100%' }">
                <span class="label">收入</span>
                <span class="value">¥{{ (financeStats.totalRevenue * 10000).toLocaleString() }}</span>
              </div>
              <div class="chart-bar cost" :style="{ width: `${financeStats.totalRevenue ? (financeStats.totalCost / financeStats.totalRevenue) * 100 : 0}%` }">
                <span class="label">成本</span>
                <span class="value">¥{{ (financeStats.totalCost * 10000).toLocaleString() }}</span>
              </div>
              <div class="chart-bar profit" :style="{ width: `${financeStats.totalRevenue ? (financeStats.grossProfit / financeStats.totalRevenue) * 100 : 0}%` }">
                <span class="label">利润</span>
                <span class="value">¥{{ (financeStats.grossProfit * 10000).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>AI 成本分析</span>
              <el-button type="primary" link @click="navigateTo('/smart-bi/finance?tab=cost')">
                开始分析
              </el-button>
            </div>
          </template>
          <div class="ai-analysis-preview">
            <el-icon :size="48" color="#409eff"><TrendCharts /></el-icon>
            <p>使用 AI 智能分析成本结构，获取优化建议</p>
            <el-button type="primary" @click="navigateTo('/smart-bi/finance?tab=cost')">
              立即分析
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-finance {
  min-height: calc(100vh - 144px);
}

.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;

  .welcome-info {
    h1 {
      font-size: 24px;
      color: #333;
      margin: 0 0 8px;
    }

    p {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #999;
      font-size: 14px;

      .web-tag {
        background-color: #f0f9ff;
        border-color: #b3d8ff;
        color: #409eff;
      }
    }
  }
}

.stat-cards {
  margin-bottom: 24px;

  .stat-card {
    margin-bottom: 20px;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .stat-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-title {
    font-size: 14px;
    color: #999;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;

    small {
      font-size: 14px;
      font-weight: 400;
      margin-left: 4px;
    }
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
}

.quick-actions-card {
  margin-bottom: 24px;

  .quick-actions {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f5f7fa;
    }

    span {
      font-size: 14px;
      color: #606266;
    }
  }

  .action-icon-wrapper {
    position: relative;

    .ai-badge {
      position: absolute;
      top: -8px;
      right: -16px;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.revenue-overview {
  padding: 20px 0;

  .overview-chart {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chart-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 4px;
    min-width: 200px;

    .label {
      font-size: 14px;
      color: white;
    }

    .value {
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    &.revenue {
      background-color: #409eff;
    }

    &.cost {
      background-color: #e6a23c;
    }

    &.profit {
      background-color: #67c23a;
    }
  }
}

.ai-analysis-preview {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  p {
    margin: 16px 0;
    font-size: 14px;
    color: #606266;
  }
}

.el-card {
  margin-bottom: 20px;
}
</style>
