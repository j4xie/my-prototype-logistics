<script setup lang="ts">
/**
 * 默认 Dashboard
 * 适用角色: viewer, quality_manager, procurement_manager, sales_manager, equipment_admin 等
 * 特点: 通用简洁版，根据权限显示可访问模块
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import type { DashboardOverview } from '@/types/api';
import {
  House, TrendCharts, Box, Checked, ShoppingCart,
  Goods, User, Monitor, Money, Setting
} from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();

const loading = ref(false);
const overview = ref<DashboardOverview | null>(null);
const factoryId = computed(() => authStore.factoryId);

// 模块配置
const moduleConfig = [
  { key: 'dashboard', title: '首页', icon: House, route: '/dashboard', color: '#409eff' },
  { key: 'production', title: '生产管理', icon: TrendCharts, route: '/production/batches', color: '#67c23a' },
  { key: 'warehouse', title: '仓储管理', icon: Box, route: '/warehouse/materials', color: '#e6a23c' },
  { key: 'quality', title: '质量管理', icon: Checked, route: '/quality/inspections', color: '#f56c6c' },
  { key: 'procurement', title: '采购管理', icon: ShoppingCart, route: '/procurement/suppliers', color: '#909399' },
  { key: 'sales', title: '销售管理', icon: Goods, route: '/sales/customers', color: '#b88230' },
  { key: 'hr', title: '人事管理', icon: User, route: '/hr/employees', color: '#7b5ba6' },
  { key: 'equipment', title: '设备管理', icon: Monitor, route: '/equipment/list', color: '#5b8ff9' },
  { key: 'finance', title: '财务管理', icon: Money, route: '/finance/costs', color: '#5ad8a6' },
  { key: 'system', title: '系统管理', icon: Setting, route: '/system/users', color: '#5d7092' }
];

// 可访问的模块
const accessibleModules = computed(() => {
  return moduleConfig.filter(m => {
    if (m.key === 'dashboard') return false; // 排除首页本身
    return permissionStore.canAccess(m.key as any);
  });
});

onMounted(async () => {
  await loadOverviewData();
});

async function loadOverviewData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get<DashboardOverview>(`/${factoryId.value}/reports/dashboard/overview`);
    if (response.success) {
      overview.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load overview:', error);
  } finally {
    loading.value = false;
  }
}

function navigateTo(route: string) {
  router.push(route);
}

// 获取权限标签
function getPermissionLabel(module: string): string {
  const permission = permissionStore.getPermission(module as any);
  if (permission === 'rw') return '读写';
  if (permission === 'r') return '只读';
  if (permission === 'w') return '只写';
  return '-';
}
</script>

<template>
  <div class="dashboard-default" v-loading="loading">
    <!-- 欢迎区 -->
    <div class="welcome-section">
      <div class="welcome-info">
        <h1>欢迎回来，{{ authStore.user?.fullName || authStore.user?.username }}</h1>
        <p>
          <el-tag :type="authStore.userLevel <= 10 ? 'danger' : 'info'" size="small">
            {{ authStore.roleMetadata?.displayName }}
          </el-tag>
          <span class="factory-info">工厂: {{ factoryId }}</span>
        </p>
      </div>
    </div>

    <!-- 可访问模块 -->
    <el-card class="modules-card">
      <template #header>
        <span>可访问模块</span>
      </template>
      <div class="modules-grid">
        <div
          v-for="module in accessibleModules"
          :key="module.key"
          class="module-item"
          @click="navigateTo(module.route)"
        >
          <el-icon :size="36" :style="{ color: module.color }">
            <component :is="module.icon" />
          </el-icon>
          <span class="module-title">{{ module.title }}</span>
          <el-tag size="small" :type="getPermissionLabel(module.key) === '只读' ? 'info' : 'success'">
            {{ getPermissionLabel(module.key) }}
          </el-tag>
        </div>
      </div>
      <el-empty v-if="accessibleModules.length === 0" description="暂无可访问模块" />
    </el-card>

    <!-- 概览数据 (如果有权限) -->
    <el-row :gutter="20" v-if="overview">
      <el-col :xs="24" :md="12">
        <el-card>
          <template #header>
            <span>今日概览</span>
          </template>
          <div class="overview-content">
            <div class="overview-item" v-if="permissionStore.canAccess('production')">
              <span class="label">今日产量</span>
              <span class="value">{{ overview.todayOutput ?? '-' }} kg</span>
            </div>
            <div class="overview-item" v-if="permissionStore.canAccess('production')">
              <span class="label">完成批次</span>
              <span class="value">{{ overview.completedBatches ?? '-' }} 个</span>
            </div>
            <div class="overview-item" v-if="permissionStore.canAccess('production')">
              <span class="label">完成率</span>
              <span class="value">{{ overview.completionRate ?? '-' }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card>
          <template #header>
            <span>权限说明</span>
          </template>
          <div class="permission-info">
            <p>您当前的角色是 <strong>{{ authStore.roleMetadata?.displayName }}</strong></p>
            <p>权限级别: Level {{ authStore.userLevel }}</p>
            <p>可访问 {{ accessibleModules.length }} 个业务模块</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-default {
  min-height: calc(100vh - 144px);
}

.welcome-section {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    color: #333;
    margin: 0 0 8px;
  }

  p {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: #999;
    font-size: 14px;
  }
}

.modules-card {
  margin-bottom: 24px;

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
  }

  .module-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
      transform: translateY(-2px);
    }

    .module-title {
      font-size: 14px;
      color: #303133;
      font-weight: 500;
    }
  }
}

.overview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .overview-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed #ebeef5;

    &:last-child {
      border-bottom: none;
    }

    .label {
      color: #909399;
      font-size: 14px;
    }

    .value {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }
  }
}

.permission-info {
  p {
    margin: 0 0 12px;
    font-size: 14px;
    color: #606266;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: #409eff;
    }
  }
}

.el-card {
  margin-bottom: 20px;
}
</style>
