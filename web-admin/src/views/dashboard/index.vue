<script setup lang="ts">
/**
 * Dashboard 主页面
 * 根据用户角色动态加载对应的 Dashboard 组件
 *
 * 角色映射:
 * - factory_super_admin → DashboardAdmin (全功能)
 * - hr_admin → DashboardHR (人事管理)
 * - production_manager, workshop_supervisor → DashboardProduction (生产管理)
 * - warehouse_manager → DashboardWarehouse (仓储管理)
 * - finance_manager → DashboardFinance (财务管理)
 * - 其他角色 → DashboardDefault (通用版)
 */
import { computed, defineAsyncComponent } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { getDashboardComponent } from '@/components/dashboard';

const authStore = useAuthStore();

// 获取当前角色对应的 Dashboard 组件名称
const dashboardComponentName = computed(() => {
  return getDashboardComponent(authStore.currentRole);
});

// 动态组件映射
const dashboardComponents = {
  DashboardAdmin: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardAdmin.vue')
  ),
  DashboardHR: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardHR.vue')
  ),
  DashboardProduction: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardProduction.vue')
  ),
  DashboardWarehouse: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardWarehouse.vue')
  ),
  DashboardFinance: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardFinance.vue')
  ),
  DashboardDefault: defineAsyncComponent(() =>
    import('@/components/dashboard/DashboardDefault.vue')
  )
};

// 获取当前角色对应的组件
const CurrentDashboard = computed(() => {
  const componentName = dashboardComponentName.value as keyof typeof dashboardComponents;
  return dashboardComponents[componentName] || dashboardComponents.DashboardDefault;
});
</script>

<template>
  <div class="dashboard-container">
    <component :is="CurrentDashboard" />
  </div>
</template>

<style lang="scss" scoped>
.dashboard-container {
  min-height: calc(100vh - 144px);
}
</style>
