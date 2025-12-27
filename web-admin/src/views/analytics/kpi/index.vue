<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { Refresh, TrendCharts, Histogram, Timer, Check } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);

// KPI 数据
const kpiData = ref({
  production: {
    oee: 0,           // Overall Equipment Effectiveness
    yield: 0,         // 良品率
    cycleTime: 0,     // 周期时间
    throughput: 0     // 产出量
  },
  quality: {
    fpy: 0,           // First Pass Yield
    defectRate: 0,    // 缺陷率
    reworkRate: 0,    // 返工率
    scrapRate: 0      // 报废率
  },
  delivery: {
    onTimeRate: 0,    // 准时交付率
    leadTime: 0,      // 交期
    fillRate: 0       // 订单满足率
  },
  cost: {
    unitCost: 0,      // 单位成本
    materialCost: 0,  // 原料成本占比
    laborCost: 0,     // 人工成本占比
    overheadCost: 0   // 间接成本占比
  }
});

// 目标值
const targets = {
  oee: 85,
  yield: 95,
  fpy: 90,
  onTimeRate: 95,
  defectRate: 5
};

onMounted(() => {
  loadKPIData();
});

async function loadKPIData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/reports/kpi`);
    if (response.success && response.data) {
      kpiData.value = { ...kpiData.value, ...response.data };
    }
  } catch (error) {
    console.error('加载KPI数据失败:', error);
  } finally {
    loading.value = false;
  }
}

function getProgressStatus(value: number, target: number) {
  const ratio = value / target;
  if (ratio >= 1) return 'success';
  if (ratio >= 0.8) return 'warning';
  return 'exception';
}

function formatPercent(value: number) {
  return (value * 100).toFixed(1) + '%';
}
</script>

<template>
  <div class="kpi-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/analytics' }">数据分析</el-breadcrumb-item>
          <el-breadcrumb-item>KPI看板</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>KPI看板</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="loadKPIData">刷新数据</el-button>
      </div>
    </div>

    <div class="kpi-grid" v-loading="loading">
      <!-- 生产效率KPI -->
      <el-card class="kpi-card">
        <template #header>
          <div class="card-header">
            <el-icon><TrendCharts /></el-icon>
            <span>生产效率</span>
          </div>
        </template>

        <div class="kpi-item">
          <div class="kpi-label">设备综合效率 (OEE)</div>
          <el-progress
            :percentage="kpiData.production.oee * 100"
            :status="getProgressStatus(kpiData.production.oee * 100, targets.oee)"
            :stroke-width="12"
          />
          <div class="kpi-meta">
            <span>当前: {{ formatPercent(kpiData.production.oee) }}</span>
            <span class="target">目标: {{ targets.oee }}%</span>
          </div>
        </div>

        <div class="kpi-item">
          <div class="kpi-label">良品率</div>
          <el-progress
            :percentage="kpiData.production.yield * 100"
            :status="getProgressStatus(kpiData.production.yield * 100, targets.yield)"
            :stroke-width="12"
          />
          <div class="kpi-meta">
            <span>当前: {{ formatPercent(kpiData.production.yield) }}</span>
            <span class="target">目标: {{ targets.yield }}%</span>
          </div>
        </div>

        <div class="kpi-stats">
          <div class="stat">
            <div class="stat-value">{{ kpiData.production.throughput }}</div>
            <div class="stat-label">日产出</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ kpiData.production.cycleTime }}min</div>
            <div class="stat-label">周期时间</div>
          </div>
        </div>
      </el-card>

      <!-- 质量KPI -->
      <el-card class="kpi-card">
        <template #header>
          <div class="card-header">
            <el-icon><Check /></el-icon>
            <span>质量指标</span>
          </div>
        </template>

        <div class="kpi-item">
          <div class="kpi-label">一次合格率 (FPY)</div>
          <el-progress
            :percentage="kpiData.quality.fpy * 100"
            :status="getProgressStatus(kpiData.quality.fpy * 100, targets.fpy)"
            :stroke-width="12"
          />
          <div class="kpi-meta">
            <span>当前: {{ formatPercent(kpiData.quality.fpy) }}</span>
            <span class="target">目标: {{ targets.fpy }}%</span>
          </div>
        </div>

        <div class="kpi-stats">
          <div class="stat danger">
            <div class="stat-value">{{ formatPercent(kpiData.quality.defectRate) }}</div>
            <div class="stat-label">缺陷率</div>
          </div>
          <div class="stat warning">
            <div class="stat-value">{{ formatPercent(kpiData.quality.reworkRate) }}</div>
            <div class="stat-label">返工率</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ formatPercent(kpiData.quality.scrapRate) }}</div>
            <div class="stat-label">报废率</div>
          </div>
        </div>
      </el-card>

      <!-- 交付KPI -->
      <el-card class="kpi-card">
        <template #header>
          <div class="card-header">
            <el-icon><Timer /></el-icon>
            <span>交付指标</span>
          </div>
        </template>

        <div class="kpi-item">
          <div class="kpi-label">准时交付率</div>
          <el-progress
            :percentage="kpiData.delivery.onTimeRate * 100"
            :status="getProgressStatus(kpiData.delivery.onTimeRate * 100, targets.onTimeRate)"
            :stroke-width="12"
          />
          <div class="kpi-meta">
            <span>当前: {{ formatPercent(kpiData.delivery.onTimeRate) }}</span>
            <span class="target">目标: {{ targets.onTimeRate }}%</span>
          </div>
        </div>

        <div class="kpi-stats">
          <div class="stat">
            <div class="stat-value">{{ kpiData.delivery.leadTime }}天</div>
            <div class="stat-label">平均交期</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ formatPercent(kpiData.delivery.fillRate) }}</div>
            <div class="stat-label">订单满足率</div>
          </div>
        </div>
      </el-card>

      <!-- 成本KPI -->
      <el-card class="kpi-card">
        <template #header>
          <div class="card-header">
            <el-icon><Histogram /></el-icon>
            <span>成本结构</span>
          </div>
        </template>

        <div class="cost-breakdown">
          <div class="cost-item">
            <div class="cost-label">单位成本</div>
            <div class="cost-value">¥{{ kpiData.cost.unitCost.toFixed(2) }}</div>
          </div>

          <el-divider />

          <div class="cost-pie">
            <div class="pie-item material">
              <div class="pie-bar" :style="{ width: kpiData.cost.materialCost * 100 + '%' }"></div>
              <span class="pie-label">原料 {{ formatPercent(kpiData.cost.materialCost) }}</span>
            </div>
            <div class="pie-item labor">
              <div class="pie-bar" :style="{ width: kpiData.cost.laborCost * 100 + '%' }"></div>
              <span class="pie-label">人工 {{ formatPercent(kpiData.cost.laborCost) }}</span>
            </div>
            <div class="pie-item overhead">
              <div class="pie-bar" :style="{ width: kpiData.cost.overheadCost * 100 + '%' }"></div>
              <span class="pie-label">间接 {{ formatPercent(kpiData.cost.overheadCost) }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kpi-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left h1 {
    margin: 12px 0 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.kpi-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      font-size: 18px;
      color: #409EFF;
    }
  }
}

.kpi-item {
  margin-bottom: 20px;

  .kpi-label {
    font-size: 13px;
    color: #606266;
    margin-bottom: 8px;
  }

  .kpi-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: #909399;

    .target {
      color: #67C23A;
    }
  }
}

.kpi-stats {
  display: flex;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;

  .stat {
    flex: 1;
    text-align: center;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 8px;

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }

    .stat-label {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }

    &.danger .stat-value {
      color: #F56C6C;
    }

    &.warning .stat-value {
      color: #E6A23C;
    }
  }
}

.cost-breakdown {
  .cost-item {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .cost-label {
      font-size: 14px;
      color: #606266;
    }

    .cost-value {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }
  }

  .cost-pie {
    .pie-item {
      margin-bottom: 12px;

      .pie-bar {
        height: 8px;
        border-radius: 4px;
        margin-bottom: 4px;
      }

      .pie-label {
        font-size: 12px;
        color: #909399;
      }

      &.material .pie-bar {
        background: #409EFF;
      }

      &.labor .pie-bar {
        background: #67C23A;
      }

      &.overhead .pie-bar {
        background: #E6A23C;
      }
    }
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
