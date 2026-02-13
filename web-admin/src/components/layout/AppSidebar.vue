<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '@/store/modules/app';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore, ModuleName } from '@/store/modules/permission';
import {
  House, Operation, Box, Checked, ShoppingCart, Goods,
  User, Monitor, Money, Setting, DataAnalysis, Calendar,
  TrendCharts, Sell, Upload, ChatDotRound, Aim, Odometer, Tickets,
  Histogram
} from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();

// 当前用户角色
const roleCode = computed(() => authStore.currentRole);

// 图标映射
const iconMap: Record<string, any> = {
  House, Operation, Box, Checked, ShoppingCart, Goods,
  User, Monitor, Money, Setting, DataAnalysis, Calendar,
  TrendCharts, Sell, Upload, ChatDotRound, Aim, Odometer, Tickets,
  Histogram
};

// 菜单配置
interface MenuItem {
  path: string;
  title: string;
  icon: string;
  module: ModuleName;
  roles?: string[];  // 可选：限制特定角色可见
  children?: MenuItem[];
  groupLabel?: string;  // 可选：分组标签（仅作为子菜单内的分割标题）
}

// 财务主管专用菜单 - 简化版
const financeManagerMenu: MenuItem[] = [
  { path: '/smart-bi/dashboard', title: '经营驾驶舱', icon: 'Odometer', module: 'analytics' },
  { path: '/smart-bi/finance', title: '财务分析', icon: 'Money', module: 'analytics' },
  { path: '/smart-bi/sales', title: '销售分析', icon: 'TrendCharts', module: 'analytics' },
  { path: '/smart-bi/query', title: 'AI问答', icon: 'ChatDotRound', module: 'analytics' },
  { path: '/smart-bi/query-templates', title: '查询模板管理', icon: 'Tickets', module: 'analytics' },
  { path: '/smart-bi/analysis', title: '智能数据分析', icon: 'DataAnalysis', module: 'analytics' }
];

const menuConfig: MenuItem[] = [
  { path: '/dashboard', title: '首页', icon: 'House', module: 'dashboard' },
  {
    path: '/production', title: '生产管理', icon: 'Operation', module: 'production',
    children: [
      { path: '/production/batches', title: '生产批次', icon: '', module: 'production' },
      { path: '/production/plans', title: '生产计划', icon: '', module: 'production' },
      { path: '/production/conversions', title: '转换率配置', icon: '', module: 'production' },
      { path: '/production/bom', title: 'BOM成本管理', icon: '', module: 'production' }
    ]
  },
  {
    path: '/warehouse', title: '仓储管理', icon: 'Box', module: 'warehouse',
    children: [
      { path: '/warehouse/materials', title: '原材料批次', icon: '', module: 'warehouse' },
      { path: '/warehouse/shipments', title: '出货管理', icon: '', module: 'warehouse' },
      { path: '/warehouse/inventory', title: '盘点管理', icon: '', module: 'warehouse' }
    ]
  },
  {
    path: '/quality', title: '质量管理', icon: 'Checked', module: 'quality',
    children: [
      { path: '/quality/inspections', title: '质检记录', icon: '', module: 'quality' },
      { path: '/quality/disposals', title: '废弃处理', icon: '', module: 'quality' }
    ]
  },
  {
    path: '/procurement', title: '采购管理', icon: 'ShoppingCart', module: 'procurement',
    children: [
      { path: '/procurement/suppliers', title: '供应商管理', icon: '', module: 'procurement' }
    ]
  },
  {
    path: '/sales', title: '销售管理', icon: 'Goods', module: 'sales',
    children: [
      { path: '/sales/customers', title: '客户管理', icon: '', module: 'sales' },
      { path: '/sales/smart-analysis', title: '智能销售分析', icon: 'TrendCharts', module: 'sales' }
    ]
  },
  {
    path: '/hr', title: '人事管理', icon: 'User', module: 'hr',
    children: [
      { path: '/hr/employees', title: '员工管理', icon: '', module: 'hr' },
      { path: '/hr/attendance', title: '考勤管理', icon: '', module: 'hr' },
      { path: '/hr/whitelist', title: '白名单管理', icon: '', module: 'hr' },
      { path: '/hr/departments', title: '部门管理', icon: '', module: 'hr' }
    ]
  },
  {
    path: '/equipment', title: '设备管理', icon: 'Monitor', module: 'equipment',
    children: [
      { path: '/equipment/list', title: '设备列表', icon: '', module: 'equipment' },
      { path: '/equipment/maintenance', title: '维护记录', icon: '', module: 'equipment' },
      { path: '/equipment/alerts', title: '告警管理', icon: '', module: 'equipment' }
    ]
  },
  {
    path: '/finance', title: '财务管理', icon: 'Money', module: 'finance',
    children: [
      { path: '/finance/costs', title: '成本分析', icon: '', module: 'finance' },
      { path: '/finance/reports', title: '财务报表', icon: '', module: 'finance' },
      { path: '/finance/smart-analysis', title: '智能财务分析', icon: 'TrendCharts', module: 'finance' }
    ]
  },
  {
    path: '/system', title: '系统管理', icon: 'Setting', module: 'system',
    children: [
      { path: '/system/users', title: '用户管理', icon: '', module: 'system' },
      { path: '/system/roles', title: '角色管理', icon: '', module: 'system' },
      { path: '/system/logs', title: '操作日志', icon: '', module: 'system' },
      { path: '/system/settings', title: '系统设置', icon: '', module: 'system' },
      { path: '/system/ai-intents', title: 'AI意图配置', icon: '', module: 'system' },
      { path: '/system/products', title: '产品信息管理', icon: '', module: 'system' },
      { path: '/system/features', title: '功能模块配置', icon: '', module: 'system' }
    ]
  },
  {
    path: '/analytics', title: '数据分析', icon: 'DataAnalysis', module: 'analytics',
    children: [
      { path: '/analytics/overview', title: '分析概览', icon: '', module: 'analytics' },
      { path: '/analytics/trends', title: '趋势分析', icon: '', module: 'analytics' },
      { path: '/analytics/ai-reports', title: 'AI分析报告', icon: '', module: 'analytics' },
      { path: '/analytics/kpi', title: 'KPI看板', icon: '', module: 'analytics' },
      { path: '/analytics/production-report', title: '车间实时生产报表', icon: '', module: 'analytics' },
      { path: '/analytics/alert-dashboard', title: '异常预警', icon: '', module: 'analytics' }
    ]
  },
  {
    path: '/scheduling', title: '智能调度', icon: 'Calendar', module: 'scheduling',
    children: [
      { path: '/scheduling/overview', title: '调度中心', icon: '', module: 'scheduling' },
      { path: '/scheduling/plans', title: '调度计划', icon: '', module: 'scheduling' },
      { path: '/scheduling/realtime', title: '实时监控', icon: '', module: 'scheduling' },
      { path: '/scheduling/workers', title: '人员分配', icon: '', module: 'scheduling' },
      { path: '/scheduling/alerts', title: '告警管理', icon: '', module: 'scheduling' }
    ]
  },
  {
    path: '/calibration', title: '行为校准', icon: 'Aim', module: 'system',
    children: [
      { path: '/calibration/list', title: '校准管理', icon: '', module: 'system' }
    ]
  },
  {
    path: '/production-analytics', title: '生产分析', icon: 'Histogram', module: 'analytics',
    children: [
      { path: '/production-analytics/production', title: '生产数据分析', icon: 'Histogram', module: 'analytics' },
      { path: '/production-analytics/efficiency', title: '人效分析', icon: 'User', module: 'analytics' }
    ]
  },
  {
    path: '/smart-bi', title: '智能BI', icon: 'TrendCharts', module: 'analytics',
    children: [
      // -- 分析入口 --
      { path: '/smart-bi/dashboard', title: '经营驾驶舱', icon: 'Monitor', module: 'analytics', groupLabel: '分析入口' },
      { path: '/smart-bi/analysis', title: '智能数据分析', icon: 'DataAnalysis', module: 'analytics' },
      { path: '/smart-bi/query', title: 'AI问答', icon: 'ChatDotRound', module: 'analytics' },
      // -- 预定义报表 --
      { path: '/smart-bi/sales', title: '销售数据分析', icon: 'Sell', module: 'analytics', groupLabel: '预定义报表' },
      { path: '/smart-bi/finance', title: '财务数据分析', icon: 'Money', module: 'analytics' },
      // -- 数据管理 --
      { path: '/smart-bi/upload', title: 'Excel上传', icon: 'Upload', module: 'analytics', groupLabel: '数据管理' },
      { path: '/smart-bi/query-templates', title: '查询模板', icon: 'Tickets', module: 'analytics' },
      { path: '/smart-bi/data-completeness', title: '数据完整度', icon: 'DataAnalysis', module: 'analytics' },
      { path: '/smart-bi/food-kb-feedback', title: '知识库反馈', icon: 'ChatDotRound', module: 'analytics', groupLabel: '质量管理' },
      { path: '/smart-bi/calibration', title: '行为校准监控', icon: 'Aim', module: 'analytics', roles: ['platform_admin'] }
    ]
  }
];

// 检查菜单项是否可见（基于角色限制）
function canSeeMenuItem(item: MenuItem): boolean {
  // 如果没有 roles 限制，只检查模块权限
  if (!item.roles || item.roles.length === 0) {
    return permissionStore.canAccess(item.module);
  }
  // 有 roles 限制时，检查当前角色是否在允许列表中
  return item.roles.includes(permissionStore.currentRole) && permissionStore.canAccess(item.module);
}

// 过滤有权限的菜单
const filteredMenu = computed(() => {
  // 财务主管使用简化菜单
  if (roleCode.value === 'finance_manager') {
    return financeManagerMenu;
  }

  return menuConfig
    .filter(item => permissionStore.canAccess(item.module))
    .map(item => {
      if (!item.children) return item;
      // 过滤子菜单中有角色限制的项
      const filteredChildren = item.children.filter(child => canSeeMenuItem(child));
      return { ...item, children: filteredChildren };
    })
    .filter(item => !item.children || item.children.length > 0);  // 移除没有可见子菜单的父菜单
});

// 当前激活的菜单
const activeMenu = computed(() => route.path);

// 默认展开的菜单
const defaultOpeneds = computed(() => {
  const path = route.path;
  const parent = menuConfig.find(item =>
    item.children?.some(child => path.startsWith(child.path))
  );
  return parent ? [parent.path] : [];
});

function handleSelect(path: string) {
  router.push(path);
}
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'is-collapsed': appStore.sidebarCollapsed }"
  >
    <!-- Logo -->
    <div class="sidebar-logo">
      <img src="/logo.svg" alt="Logo" class="logo-icon" />
      <span v-if="!appStore.sidebarCollapsed" class="logo-text">白垩纪管理系统</span>
    </div>

    <!-- 菜单 -->
    <el-scrollbar class="sidebar-menu-wrap">
      <el-menu
        :default-active="activeMenu"
        :default-openeds="defaultOpeneds"
        :collapse="appStore.sidebarCollapsed"
        unique-opened
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#ffffff"
        @select="handleSelect"
      >
        <template v-for="item in filteredMenu" :key="item.path">
          <!-- 有子菜单 -->
          <el-sub-menu v-if="item.children?.length" :index="item.path">
            <template #title>
              <el-icon><component :is="iconMap[item.icon]" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <template v-for="child in item.children" :key="child.path">
              <div v-if="child.groupLabel && !appStore.sidebarCollapsed" class="menu-group-label">
                {{ child.groupLabel }}
              </div>
              <el-menu-item :index="child.path">
                {{ child.title }}
              </el-menu-item>
            </template>
          </el-sub-menu>

          <!-- 无子菜单 -->
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="iconMap[item.icon]" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
  </aside>
</template>

<style lang="scss" scoped>
.app-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 220px;
  background-color: #001529;
  transition: width 0.3s;
  z-index: 100;
  display: flex;
  flex-direction: column;

  &.is-collapsed {
    width: 64px;
  }
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .logo-icon {
    width: 32px;
    height: 32px;
  }

  .logo-text {
    margin-left: 12px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
  }
}

.sidebar-menu-wrap {
  flex: 1;
  overflow-y: auto;
}

:deep(.el-menu) {
  border-right: none;

  .el-menu-item,
  .el-sub-menu__title {
    &:hover {
      background-color: #000c17 !important;
    }
  }

  .el-menu-item.is-active {
    background-color: #1890ff !important;
  }
}

.menu-group-label {
  padding: 8px 20px 4px 44px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;

  &:not(:first-child) {
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 10px;
  }
}
</style>
