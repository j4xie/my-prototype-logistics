<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { TrendCharts, DataAnalysis, Histogram, PieChart, Timer, Sunny } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('analytics'));

const loading = ref(false);

// 概览数据
const overviewData = ref({
  production: { todayOutput: 0, completedBatches: 0, inProgressBatches: 0, efficiency: 0 },
  quality: { totalInspections: 0, passRate: 0, pendingCount: 0 },
  warehouse: { totalMaterialBatches: 0, lowStockCount: 0, totalQuantity: 0 },
  equipment: { totalEquipments: 0, alertCount: 0, maintenanceCount: 0 },
  sales: { totalShipments: 0, pendingShipments: 0 },
  finance: { todayCost: 0, averageCost: 0 }
});

// 趋势数据
const trendData = ref({
  productionTrend: [] as any[],
  qualityTrend: [] as any[],
  costTrend: [] as any[]
});

onMounted(() => {
  loadOverviewData();
  loadTrendData();
});

async function loadOverviewData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    // 加载各模块概览
    const [prodRes, qualRes, warehouseRes, equipRes] = await Promise.allSettled([
      get(`/${factoryId.value}/reports/dashboard/production`, { params: { period: 'today' } }),
      get(`/${factoryId.value}/reports/dashboard/quality`),
      get(`/${factoryId.value}/reports/dashboard/overview`),
      get(`/${factoryId.value}/reports/dashboard/equipment`)
    ]);

    if (prodRes.status === 'fulfilled' && prodRes.value.success) {
      overviewData.value.production = {
        ...overviewData.value.production,
        ...prodRes.value.data
      };
    }
    if (qualRes.status === 'fulfilled' && qualRes.value.success) {
      overviewData.value.quality = {
        ...overviewData.value.quality,
        ...qualRes.value.data
      };
    }
    if (warehouseRes.status === 'fulfilled' && warehouseRes.value.success) {
      const data = warehouseRes.value.data || {};
      overviewData.value.warehouse.totalMaterialBatches = data.materialBatches || 0;
      overviewData.value.warehouse.lowStockCount = data.lowStockMaterials || 0;
    }
    if (equipRes.status === 'fulfilled' && equipRes.value.success) {
      overviewData.value.equipment = {
        ...overviewData.value.equipment,
        ...equipRes.value.data
      };
    }
  } catch (error) {
    console.error('加载概览数据失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadTrendData() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/reports/dashboard/trends`, {
      params: { period: 'week' }
    });
    if (response.success && response.data) {
      trendData.value = response.data;
    }
  } catch (error) {
    console.error('加载趋势数据失败:', error);
  }
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(1) + '%';
}
</script>

<template>
  <div class="analytics-page">
    <div class="page-header">
      <h1>
        <el-icon><DataAnalysis /></el-icon>
        数据分析中心
      </h1>
      <p class="subtitle">全局数据概览与趋势分析</p>
    </div>

    <!-- 模块概览卡片 -->
    <el-row :gutter="16" class="overview-cards" v-loading="loading">
      <!-- 生产模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card production" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><TrendCharts /></el-icon>
            <span>生产</span>
          </div>
          <div class="stat-value">{{ formatNumber(overviewData.production.todayOutput) }}</div>
          <div class="stat-label">今日产量</div>
          <div class="stat-footer">
            <span>完成批次: {{ overviewData.production.completedBatches }}</span>
          </div>
        </el-card>
      </el-col>

      <!-- 质量模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card quality" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><Sunny /></el-icon>
            <span>质量</span>
          </div>
          <div class="stat-value">{{ formatPercent(overviewData.quality.passRate) }}</div>
          <div class="stat-label">合格率</div>
          <div class="stat-footer">
            <span>待检: {{ overviewData.quality.pendingCount }}</span>
          </div>
        </el-card>
      </el-col>

      <!-- 仓储模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card warehouse" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><Histogram /></el-icon>
            <span>仓储</span>
          </div>
          <div class="stat-value">{{ formatNumber(overviewData.warehouse.totalMaterialBatches) }}</div>
          <div class="stat-label">原料批次</div>
          <div class="stat-footer">
            <span :class="{ 'text-warning': overviewData.warehouse.lowStockCount > 0 }">
              低库存: {{ overviewData.warehouse.lowStockCount }}
            </span>
          </div>
        </el-card>
      </el-col>

      <!-- 设备模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card equipment" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><Timer /></el-icon>
            <span>设备</span>
          </div>
          <div class="stat-value">{{ overviewData.equipment.totalEquipments }}</div>
          <div class="stat-label">设备总数</div>
          <div class="stat-footer">
            <span :class="{ 'text-danger': overviewData.equipment.alertCount > 0 }">
              告警: {{ overviewData.equipment.alertCount }}
            </span>
          </div>
        </el-card>
      </el-col>

      <!-- 销售模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card sales" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><PieChart /></el-icon>
            <span>销售</span>
          </div>
          <div class="stat-value">{{ formatNumber(overviewData.sales.totalShipments) }}</div>
          <div class="stat-label">出货记录</div>
          <div class="stat-footer">
            <span>待发货: {{ overviewData.sales.pendingShipments }}</span>
          </div>
        </el-card>
      </el-col>

      <!-- 财务模块 -->
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <el-card class="stat-card finance" shadow="hover">
          <div class="card-header">
            <el-icon class="module-icon"><DataAnalysis /></el-icon>
            <span>成本</span>
          </div>
          <div class="stat-value">{{ formatNumber(overviewData.finance.todayCost) }}</div>
          <div class="stat-label">今日成本</div>
          <div class="stat-footer">
            <span>平均: {{ formatNumber(overviewData.finance.averageCost) }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷导航 -->
    <el-row :gutter="16" class="quick-nav">
      <el-col :span="8">
        <router-link to="/analytics/trends" class="nav-card">
          <el-card shadow="hover">
            <el-icon size="32"><TrendCharts /></el-icon>
            <h3>趋势分析</h3>
            <p>查看各模块历史趋势和数据变化</p>
          </el-card>
        </router-link>
      </el-col>
      <el-col :span="8">
        <router-link to="/analytics/ai-reports" class="nav-card">
          <el-card shadow="hover">
            <el-icon size="32"><DataAnalysis /></el-icon>
            <h3>AI分析报告</h3>
            <p>智能分析报告和异常检测</p>
          </el-card>
        </router-link>
      </el-col>
      <el-col :span="8">
        <router-link to="/analytics/kpi" class="nav-card">
          <el-card shadow="hover">
            <el-icon size="32"><Histogram /></el-icon>
            <h3>KPI看板</h3>
            <p>关键绩效指标实时监控</p>
          </el-card>
        </router-link>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.analytics-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #909399;
    font-size: 14px;
    margin: 0;
  }
}

.overview-cards {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  margin-bottom: 16px;
  border-radius: 12px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-4px);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 12px;
    color: #606266;
    font-size: 14px;
  }

  .module-icon {
    font-size: 18px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #303133;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .stat-footer {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
    font-size: 12px;
    color: #606266;
  }

  &.production {
    border-top: 3px solid #409EFF;
    .stat-value { color: #409EFF; }
  }

  &.quality {
    border-top: 3px solid #67C23A;
    .stat-value { color: #67C23A; }
  }

  &.warehouse {
    border-top: 3px solid #E6A23C;
    .stat-value { color: #E6A23C; }
  }

  &.equipment {
    border-top: 3px solid #909399;
    .stat-value { color: #909399; }
  }

  &.sales {
    border-top: 3px solid #9B59B6;
    .stat-value { color: #9B59B6; }
  }

  &.finance {
    border-top: 3px solid #E74C3C;
    .stat-value { color: #E74C3C; }
  }
}

.text-warning {
  color: #E6A23C !important;
}

.text-danger {
  color: #F56C6C !important;
}

.quick-nav {
  margin-top: 24px;

  .nav-card {
    text-decoration: none;
    display: block;

    .el-card {
      text-align: center;
      padding: 24px;
      cursor: pointer;
      transition: all 0.3s;
      border-radius: 12px;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      }

      .el-icon {
        color: #409EFF;
        margin-bottom: 12px;
      }

      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        color: #303133;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: #909399;
      }
    }
  }
}
</style>
