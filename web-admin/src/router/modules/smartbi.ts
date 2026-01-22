/**
 * SmartBI 智能分析路由模块
 */
import type { RouteRecordRaw } from 'vue-router';

const smartBIRoutes: RouteRecordRaw[] = [
  // SmartBI 主模块
  {
    path: 'smart-bi',
    name: 'SmartBI',
    redirect: '/smart-bi/dashboard',
    meta: { requiresAuth: true, title: '智能分析', icon: 'TrendCharts', module: 'analytics' },
    children: [
      {
        path: 'dashboard',
        name: 'SmartBIDashboard',
        component: () => import('@/views/smart-bi/Dashboard.vue'),
        meta: { requiresAuth: true, title: '经营驾驶舱', module: 'analytics' },
      },
      {
        path: 'sales',
        name: 'SmartBISales',
        component: () => import('@/views/smart-bi/SalesAnalysis.vue'),
        meta: { requiresAuth: true, title: '智能销售分析', module: 'sales' },
      },
      {
        path: 'finance',
        name: 'SmartBIFinance',
        component: () => import('@/views/smart-bi/FinanceAnalysis.vue'),
        meta: { requiresAuth: true, title: '智能财务分析', module: 'finance' },
      },
      {
        path: 'upload',
        name: 'SmartBIUpload',
        component: () => import('@/views/smart-bi/ExcelUpload.vue'),
        meta: { requiresAuth: true, title: 'Excel上传', module: 'analytics', action: 'write' },
      },
      {
        path: 'query',
        name: 'SmartBIQuery',
        component: () => import('@/views/smart-bi/AIQuery.vue'),
        meta: { requiresAuth: true, title: 'AI问答', module: 'analytics' },
      },
      {
        path: 'calibration',
        name: 'CalibrationDashboard',
        component: () => import('@/views/smart-bi/calibration/CalibrationDashboard.vue'),
        meta: { requiresAuth: true, title: '行为校准监控', module: 'analytics', roles: ['platform_admin'] },
      },
    ],
  },

  // SmartBI 配置管理模块
  {
    path: 'smartbi-config',
    name: 'SmartBIConfig',
    redirect: '/smartbi-config/overview',
    meta: { requiresAuth: true, title: 'SmartBI配置', icon: 'Setting', module: 'system' },
    children: [
      {
        path: 'overview',
        name: 'SmartBIConfigOverview',
        component: () => import('@/views/smartbi-config/SmartBIConfigView.vue'),
        meta: { requiresAuth: true, title: '配置概览', module: 'system' },
      },
      {
        path: 'data-sources',
        name: 'SmartBIDataSources',
        component: () => import('@/views/smartbi-config/DataSourceConfigView.vue'),
        meta: { requiresAuth: true, title: '数据源配置', module: 'system', action: 'write' },
      },
      {
        path: 'chart-templates',
        name: 'SmartBIChartTemplates',
        component: () => import('@/views/smartbi-config/ChartTemplateView.vue'),
        meta: { requiresAuth: true, title: '图表模板', module: 'system', action: 'write' },
      },
    ],
  },
];

// 快捷入口重定向路由 (需要在顶层路由注册)
export const smartBIRedirects: RouteRecordRaw[] = [
  {
    path: '/sales/smart-analysis',
    redirect: '/smart-bi/sales',
  },
  {
    path: '/finance/smart-analysis',
    redirect: '/smart-bi/finance',
  },
];

export default smartBIRoutes;
