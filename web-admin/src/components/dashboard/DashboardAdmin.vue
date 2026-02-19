<script setup lang="ts">
/**
 * 管理员专属 Dashboard
 * 适用角色: factory_super_admin
 * 特点: 全模块数据 + AI 分析入口 + 系统状态
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import type { DashboardOverview, ProductionStats, QualityStats, EquipmentStats } from '@/types/api';
import {
  TrendCharts, DataLine, Timer, Warning, Box, User, Money, Setting
} from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const overview = ref<DashboardOverview | null>(null);
const productionStats = ref<ProductionStats | null>(null);
const qualityStats = ref<QualityStats | null>(null);
const equipmentStats = ref<EquipmentStats | null>(null);

const factoryId = computed(() => authStore.factoryId);

// 统计卡片 - 管理员看全部
const statCards = computed(() => [
  {
    title: '今日产量',
    value: overview.value?.todayOutput ?? 0,
    unit: 'kg',
    icon: TrendCharts,
    color: '#1B65A8',
    route: '/production/batches'
  },
  {
    title: '完成批次',
    value: overview.value?.completedBatches ?? 0,
    unit: '个',
    icon: DataLine,
    color: '#36B37E',
    route: '/production/batches'
  },
  {
    title: '设备运行',
    value: equipmentStats.value?.running ?? 0,
    unit: '台',
    icon: Timer,
    color: '#FFAB00',
    route: '/equipment/list'
  },
  {
    title: '设备告警',
    value: equipmentStats.value?.activeAlerts ?? 0,
    unit: '条',
    icon: Warning,
    color: '#FF5630',
    route: '/equipment/alerts'
  }
]);

// 快捷操作 - 管理员专属
const quickActions = [
  { title: '生产管理', icon: TrendCharts, route: '/production/batches', color: '#1B65A8' },
  { title: '仓储管理', icon: Box, route: '/warehouse/materials', color: '#36B37E' },
  { title: '人员管理', icon: User, route: '/hr/employees', color: '#FFAB00' },
  { title: '财务报表', icon: Money, route: '/finance/reports', color: '#FF5630' },
  { title: '系统设置', icon: Setting, route: '/system/settings', color: '#6B778C' }
];

onMounted(async () => {
  await loadDashboardData();
});

async function loadDashboardData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const [overviewRes, productionRes, qualityRes, equipmentRes] = await Promise.allSettled([
      get<DashboardOverview>(`/${factoryId.value}/reports/dashboard/overview`),
      get<ProductionStats>(`/${factoryId.value}/reports/dashboard/production?period=today`),
      get<QualityStats>(`/${factoryId.value}/reports/dashboard/quality`),
      get<EquipmentStats>(`/${factoryId.value}/reports/dashboard/equipment`)
    ]);

    if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
      overview.value = overviewRes.value.data;
    }
    if (productionRes.status === 'fulfilled' && productionRes.value.success) {
      productionStats.value = productionRes.value.data;
    }
    if (qualityRes.status === 'fulfilled' && qualityRes.value.success) {
      qualityStats.value = qualityRes.value.data;
    }
    if (equipmentRes.status === 'fulfilled' && equipmentRes.value.success) {
      equipmentStats.value = equipmentRes.value.data;
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  } finally {
    loading.value = false;
  }
}

function navigateTo(route: string) {
  router.push(route);
}
</script>

<template>
  <div class="dashboard-admin" v-loading="loading">
    <!-- 欢迎区 -->
    <div class="welcome-section">
      <div class="welcome-info">
        <h1>欢迎回来，{{ authStore.user?.fullName || authStore.user?.username }}</h1>
        <p>
          <el-tag type="danger" size="small">超级管理员</el-tag>
          <span class="factory-info">工厂: {{ factoryId }}</span>
        </p>
      </div>
      <div class="ai-entry">
        <el-button type="primary" @click="navigateTo('/finance/costs')">
          <el-icon><TrendCharts /></el-icon>
          AI 成本分析
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col v-for="card in statCards" :key="card.title" :xs="24" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover" @click="navigateTo(card.route)">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-title">{{ card.title }}</span>
              <span class="stat-value" :style="{ color: card.color }">
                {{ card.value }}
                <small>{{ card.unit }}</small>
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
        <span>快捷操作</span>
      </template>
      <div class="quick-actions">
        <div
          v-for="action in quickActions"
          :key="action.title"
          class="action-item"
          @click="navigateTo(action.route)"
        >
          <el-icon :size="32" :style="{ color: action.color }">
            <component :is="action.icon" />
          </el-icon>
          <span>{{ action.title }}</span>
        </div>
      </div>
    </el-card>

    <!-- 数据概览 -->
    <el-row :gutter="20" class="overview-section">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <span>今日生产概览</span>
          </template>
          <div class="overview-content">
            <div class="overview-item">
              <span class="label">计划产量</span>
              <span class="value">{{ overview?.plannedOutput ?? '-' }} kg</span>
            </div>
            <div class="overview-item">
              <span class="label">实际产量</span>
              <span class="value">{{ overview?.todayOutput ?? '-' }} kg</span>
            </div>
            <div class="overview-item">
              <span class="label">完成率</span>
              <span class="value" :class="{ 'text-success': (overview?.completionRate ?? 0) >= 100 }">
                {{ overview?.completionRate ?? '-' }}%
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <span>质量统计</span>
          </template>
          <div class="overview-content">
            <div class="overview-item">
              <span class="label">今日检验</span>
              <span class="value">{{ qualityStats?.todayInspections ?? '-' }} 批</span>
            </div>
            <div class="overview-item">
              <span class="label">合格率</span>
              <span class="value text-success">{{ qualityStats?.passRate ?? '-' }}%</span>
            </div>
            <div class="overview-item">
              <span class="label">不合格批次</span>
              <span class="value" :class="{ 'text-danger': (qualityStats?.failedBatches ?? 0) > 0 }">
                {{ qualityStats?.failedBatches ?? '-' }} 批
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
@import './dashboard-shared.scss';

.dashboard-admin {
  min-height: calc(100vh - 144px);
}

.overview-section {
  .overview-content {
    .overview-item {
      border-bottom-style: solid;
    }
  }
}
</style>
