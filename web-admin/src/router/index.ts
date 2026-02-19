/**
 * Vue Router 配置
 */
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { setupRouterGuards } from './guards';
import smartBIRoutes, { smartBIRedirects } from './modules/smartbi';
import productionAnalyticsRoutes from './modules/production-analytics';

// 基础路由 - 不需要权限
const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { requiresAuth: false, title: '无权限' }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { requiresAuth: false, title: '页面不存在' }
  },
  {
    path: '/mobile-only',
    name: 'MobileOnly',
    component: () => import('@/views/error/mobile-only.vue'),
    meta: { requiresAuth: false, title: '请使用移动端' }
  },
  {
    path: '/smart-bi/share/:token',
    name: 'SmartBISharedView',
    component: () => import('@/views/smart-bi/SharedView.vue'),
    meta: { requiresAuth: false, title: '分享分析' }
  }
];

// 业务路由 - 需要权限
const businessRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/components/layout/AppLayout.vue'),
    redirect: '/dashboard',
    children: [
      // Dashboard
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { requiresAuth: true, title: '首页', icon: 'House', module: 'dashboard' }
      },

      // 生产管理
      {
        path: 'production',
        name: 'Production',
        redirect: '/production/batches',
        meta: { requiresAuth: true, title: '生产管理', icon: 'Operation', module: 'production' },
        children: [
          {
            path: 'batches',
            name: 'ProductionBatches',
            component: () => import('@/views/production/batches/list.vue'),
            meta: { requiresAuth: true, title: '生产批次', module: 'production' }
          },
          {
            path: 'batches/:id',
            name: 'ProductionBatchDetail',
            component: () => import('@/views/production/batches/detail.vue'),
            meta: { requiresAuth: true, title: '批次详情', module: 'production', hidden: true }
          },
          {
            path: 'plans',
            name: 'ProductionPlans',
            component: () => import('@/views/production/plans/list.vue'),
            meta: { requiresAuth: true, title: '生产计划', module: 'production' }
          },
          {
            path: 'conversions',
            name: 'ProductionConversions',
            component: () => import('@/views/production/conversions/index.vue'),
            meta: { requiresAuth: true, title: '转换率配置', module: 'production' }
          },
          {
            path: 'bom',
            name: 'BomManagement',
            component: () => import('@/views/production/bom/index.vue'),
            meta: { requiresAuth: true, title: 'BOM成本管理', module: 'production' }
          }
        ]
      },

      // 仓储管理
      {
        path: 'warehouse',
        name: 'Warehouse',
        redirect: '/warehouse/materials',
        meta: { requiresAuth: true, title: '仓储管理', icon: 'Box', module: 'warehouse' },
        children: [
          {
            path: 'materials',
            name: 'WarehouseMaterials',
            component: () => import('@/views/warehouse/materials/list.vue'),
            meta: { requiresAuth: true, title: '原材料批次', module: 'warehouse' }
          },
          {
            path: 'shipments',
            name: 'WarehouseShipments',
            component: () => import('@/views/warehouse/shipments/list.vue'),
            meta: { requiresAuth: true, title: '出货管理', module: 'warehouse' }
          },
          {
            path: 'inventory',
            name: 'WarehouseInventory',
            component: () => import('@/views/warehouse/inventory/index.vue'),
            meta: { requiresAuth: true, title: '盘点管理', module: 'warehouse' }
          }
        ]
      },

      // 调拨管理
      {
        path: 'transfer',
        name: 'Transfer',
        redirect: '/transfer/list',
        meta: { requiresAuth: true, title: '调拨管理', icon: 'Sell', module: 'warehouse' },
        children: [
          {
            path: 'list',
            name: 'TransferList',
            component: () => import('@/views/transfer/list.vue'),
            meta: { requiresAuth: true, title: '调拨单列表', module: 'warehouse' }
          },
          {
            path: ':id',
            name: 'TransferDetail',
            component: () => import('@/views/transfer/detail.vue'),
            meta: { requiresAuth: true, title: '调拨详情', module: 'warehouse', hidden: true }
          }
        ]
      },

      // 质量管理
      {
        path: 'quality',
        name: 'Quality',
        redirect: '/quality/inspections',
        meta: { requiresAuth: true, title: '质量管理', icon: 'Checked', module: 'quality' },
        children: [
          {
            path: 'inspections',
            name: 'QualityInspections',
            component: () => import('@/views/quality/inspections/list.vue'),
            meta: { requiresAuth: true, title: '质检记录', module: 'quality' }
          },
          {
            path: 'disposals',
            name: 'QualityDisposals',
            component: () => import('@/views/quality/disposals/list.vue'),
            meta: { requiresAuth: true, title: '废弃处理', module: 'quality' }
          }
        ]
      },

      // 采购管理
      {
        path: 'procurement',
        name: 'Procurement',
        redirect: '/procurement/orders',
        meta: { requiresAuth: true, title: '采购管理', icon: 'ShoppingCart', module: 'procurement' },
        children: [
          {
            path: 'orders',
            name: 'ProcurementOrders',
            component: () => import('@/views/procurement/orders/list.vue'),
            meta: { requiresAuth: true, title: '采购订单', module: 'procurement' }
          },
          {
            path: 'orders/:id',
            name: 'ProcurementOrderDetail',
            component: () => import('@/views/procurement/orders/detail.vue'),
            meta: { requiresAuth: true, title: '采购订单详情', module: 'procurement', hidden: true }
          },
          {
            path: 'suppliers',
            name: 'ProcurementSuppliers',
            component: () => import('@/views/procurement/suppliers/list.vue'),
            meta: { requiresAuth: true, title: '供应商管理', module: 'procurement' }
          },
          {
            path: 'price-lists',
            name: 'ProcurementPriceLists',
            component: () => import('@/views/procurement/price-lists/list.vue'),
            meta: { requiresAuth: true, title: '价格表管理', module: 'procurement' }
          }
        ]
      },

      // 销售管理
      {
        path: 'sales',
        name: 'Sales',
        redirect: '/sales/orders',
        meta: { requiresAuth: true, title: '销售管理', icon: 'Goods', module: 'sales' },
        children: [
          {
            path: 'orders',
            name: 'SalesOrders',
            component: () => import('@/views/sales/orders/list.vue'),
            meta: { requiresAuth: true, title: '销售订单', module: 'sales' }
          },
          {
            path: 'orders/:id',
            name: 'SalesOrderDetail',
            component: () => import('@/views/sales/orders/detail.vue'),
            meta: { requiresAuth: true, title: '销售订单详情', module: 'sales', hidden: true }
          },
          {
            path: 'finished-goods',
            name: 'SalesFinishedGoods',
            component: () => import('@/views/sales/finished-goods/list.vue'),
            meta: { requiresAuth: true, title: '成品库存', module: 'sales' }
          },
          {
            path: 'customers',
            name: 'SalesCustomers',
            component: () => import('@/views/sales/customers/list.vue'),
            meta: { requiresAuth: true, title: '客户管理', module: 'sales' }
          }
        ]
      },

      // 人事管理
      {
        path: 'hr',
        name: 'HR',
        redirect: '/hr/employees',
        meta: { requiresAuth: true, title: '人事管理', icon: 'User', module: 'hr' },
        children: [
          {
            path: 'employees',
            name: 'HREmployees',
            component: () => import('@/views/hr/employees/list.vue'),
            meta: { requiresAuth: true, title: '员工管理', module: 'hr' }
          },
          {
            path: 'attendance',
            name: 'HRAttendance',
            component: () => import('@/views/hr/attendance/list.vue'),
            meta: { requiresAuth: true, title: '考勤管理', module: 'hr' }
          },
          {
            path: 'whitelist',
            name: 'HRWhitelist',
            component: () => import('@/views/hr/whitelist/index.vue'),
            meta: { requiresAuth: true, title: '白名单管理', module: 'hr' }
          },
          {
            path: 'departments',
            name: 'HRDepartments',
            component: () => import('@/views/hr/departments/index.vue'),
            meta: { requiresAuth: true, title: '部门管理', module: 'hr' }
          }
        ]
      },

      // 设备管理
      {
        path: 'equipment',
        name: 'Equipment',
        redirect: '/equipment/list',
        meta: { requiresAuth: true, title: '设备管理', icon: 'Monitor', module: 'equipment' },
        children: [
          {
            path: 'list',
            name: 'EquipmentList',
            component: () => import('@/views/equipment/list/index.vue'),
            meta: { requiresAuth: true, title: '设备列表', module: 'equipment' }
          },
          {
            path: 'maintenance',
            name: 'EquipmentMaintenance',
            component: () => import('@/views/equipment/maintenance/index.vue'),
            meta: { requiresAuth: true, title: '维护记录', module: 'equipment' }
          },
          {
            path: 'alerts',
            name: 'EquipmentAlerts',
            component: () => import('@/views/equipment/alerts/index.vue'),
            meta: { requiresAuth: true, title: '告警管理', module: 'equipment' }
          }
        ]
      },

      // 财务管理 (Web专属)
      {
        path: 'finance',
        name: 'Finance',
        redirect: '/finance/costs',
        meta: { requiresAuth: true, title: '财务管理', icon: 'Money', module: 'finance' },
        children: [
          {
            path: 'costs',
            name: 'FinanceCosts',
            component: () => import('@/views/finance/costs/index.vue'),
            meta: { requiresAuth: true, title: '成本分析', module: 'finance' }
          },
          {
            path: 'reports',
            name: 'FinanceReports',
            component: () => import('@/views/finance/reports/index.vue'),
            meta: { requiresAuth: true, title: '财务报表', module: 'finance' }
          },
          {
            path: 'ar-ap',
            name: 'FinanceArAp',
            component: () => import('@/views/finance/ar-ap/index.vue'),
            meta: { requiresAuth: true, title: '应收应付', module: 'finance' }
          }
        ]
      },

      // 系统管理 (Web专属)
      {
        path: 'system',
        name: 'System',
        redirect: '/system/users',
        meta: { requiresAuth: true, title: '系统管理', icon: 'Setting', module: 'system' },
        children: [
          {
            path: 'users',
            name: 'SystemUsers',
            component: () => import('@/views/system/users/list.vue'),
            meta: { requiresAuth: true, title: '用户管理', module: 'system' }
          },
          {
            path: 'roles',
            name: 'SystemRoles',
            component: () => import('@/views/system/roles/index.vue'),
            meta: { requiresAuth: true, title: '角色管理', module: 'system' }
          },
          {
            path: 'logs',
            name: 'SystemLogs',
            component: () => import('@/views/system/logs/index.vue'),
            meta: { requiresAuth: true, title: '操作日志', module: 'system' }
          },
          {
            path: 'settings',
            name: 'SystemSettings',
            component: () => import('@/views/system/settings/index.vue'),
            meta: { requiresAuth: true, title: '系统设置', module: 'system' }
          },
          {
            path: 'ai-intents',
            name: 'SystemAIIntents',
            component: () => import('@/views/system/ai-intents/index.vue'),
            meta: { requiresAuth: true, title: 'AI意图配置', module: 'system' }
          },
          {
            path: 'products',
            name: 'ProductManagement',
            component: () => import('@/views/system/products/index.vue'),
            meta: { requiresAuth: true, title: '产品信息管理', module: 'system' }
          },
          {
            path: 'features',
            name: 'SystemFeatures',
            component: () => import('@/views/system/features/index.vue'),
            meta: { requiresAuth: true, title: '功能模块配置', module: 'system' }
          },
          {
            path: 'pos',
            name: 'SystemPos',
            component: () => import('@/views/system/pos/list.vue'),
            meta: { requiresAuth: true, title: 'POS集成', module: 'system' }
          }
        ]
      },

      // 数据分析中心 (调度专属)
      {
        path: 'analytics',
        name: 'Analytics',
        redirect: '/analytics/overview',
        meta: { requiresAuth: true, title: '数据分析', icon: 'DataAnalysis', module: 'analytics' },
        children: [
          {
            path: 'overview',
            name: 'AnalyticsOverview',
            component: () => import('@/views/analytics/index.vue'),
            meta: { requiresAuth: true, title: '分析概览', module: 'analytics' }
          },
          {
            path: 'trends',
            name: 'AnalyticsTrends',
            component: () => import('@/views/analytics/trends/index.vue'),
            meta: { requiresAuth: true, title: '趋势分析', module: 'analytics' }
          },
          {
            path: 'ai-reports',
            name: 'AnalyticsAIReports',
            component: () => import('@/views/analytics/ai-reports/index.vue'),
            meta: { requiresAuth: true, title: 'AI分析报告', module: 'analytics' }
          },
          {
            path: 'kpi',
            name: 'AnalyticsKPI',
            component: () => import('@/views/analytics/kpi/index.vue'),
            meta: { requiresAuth: true, title: 'KPI看板', module: 'analytics' }
          },
          {
            path: 'production-report',
            name: 'ProductionReport',
            component: () => import('@/views/analytics/production-report/index.vue'),
            meta: { requiresAuth: true, title: '车间实时生产报表', module: 'analytics' }
          },
          {
            path: 'alert-dashboard',
            name: 'AlertDashboard',
            component: () => import('@/views/analytics/AlertDashboard.vue'),
            meta: { requiresAuth: true, title: '生产异常预警', module: 'analytics' }
          }
        ]
      },

      // 行为校准管理
      {
        path: 'calibration',
        name: 'Calibration',
        redirect: '/calibration/list',
        meta: { requiresAuth: true, title: '行为校准', icon: 'Aim', module: 'system' },
        children: [
          {
            path: 'list',
            name: 'CalibrationList',
            component: () => import('@/views/calibration/CalibrationListView.vue'),
            meta: { requiresAuth: true, title: '校准列表', module: 'system' }
          },
          {
            path: ':id',
            name: 'CalibrationDetail',
            component: () => import('@/views/calibration/CalibrationDetailView.vue'),
            meta: { requiresAuth: true, title: '校准详情', module: 'system', hidden: true }
          }
        ]
      },

      // 智能调度
      {
        path: 'scheduling',
        name: 'Scheduling',
        redirect: '/scheduling/overview',
        meta: { requiresAuth: true, title: '智能调度', icon: 'Calendar', module: 'scheduling' },
        children: [
          {
            path: 'overview',
            name: 'SchedulingOverview',
            component: () => import('@/views/scheduling/index.vue'),
            meta: { requiresAuth: true, title: '调度中心', module: 'scheduling' }
          },
          {
            path: 'plans',
            name: 'SchedulingPlans',
            component: () => import('@/views/scheduling/plans/list.vue'),
            meta: { requiresAuth: true, title: '调度计划', module: 'scheduling' }
          },
          {
            path: 'plans/create',
            name: 'SchedulingPlanCreate',
            component: () => import('@/views/scheduling/plans/create.vue'),
            meta: { requiresAuth: true, title: '创建计划', module: 'scheduling', hidden: true }
          },
          {
            path: 'plans/:id',
            name: 'SchedulingPlanDetail',
            component: () => import('@/views/scheduling/plans/detail.vue'),
            meta: { requiresAuth: true, title: '计划详情', module: 'scheduling', hidden: true }
          },
          {
            path: 'realtime',
            name: 'SchedulingRealtime',
            component: () => import('@/views/scheduling/realtime/index.vue'),
            meta: { requiresAuth: true, title: '实时监控', module: 'scheduling' }
          },
          {
            path: 'workers',
            name: 'SchedulingWorkers',
            component: () => import('@/views/scheduling/workers/assignment.vue'),
            meta: { requiresAuth: true, title: '人员分配', module: 'scheduling' }
          },
          {
            path: 'alerts',
            name: 'SchedulingAlerts',
            component: () => import('@/views/scheduling/alerts/index.vue'),
            meta: { requiresAuth: true, title: '告警管理', module: 'scheduling' }
          }
        ]
      },

      // 生产分析 & 人效分析 (独立模块)
      ...productionAnalyticsRoutes,

      // SmartBI 智能BI (导入自模块)
      ...smartBIRoutes
    ]
  },

  // SmartBI 快捷入口重定向
  ...smartBIRedirects,

  // 404 兜底
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes: [...baseRoutes, ...businessRoutes]
});

// 注意：路由守卫需要在 pinia 初始化后设置，因此移到 main.ts 中调用
// setupRouterGuards(router);  // 已移至 main.ts

export default router;

// 导出 setupRouterGuards 供 main.ts 使用
export { setupRouterGuards };
