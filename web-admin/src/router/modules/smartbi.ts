/**
 * SmartBI 智能BI路由模块
 * 面向财务主管的经营分析工具
 */
import type { RouteRecordRaw } from 'vue-router';

const smartBIRoutes: RouteRecordRaw[] = [
  // SmartBI 主模块
  {
    path: 'smart-bi',
    name: 'SmartBI',
    redirect: '/smart-bi/dashboard',
    meta: { requiresAuth: true, title: '智能BI', icon: 'TrendCharts', module: 'analytics' },
    children: [
      {
        path: 'dashboard',
        name: 'SmartBIDashboard',
        component: () => import('@/views/smart-bi/Dashboard.vue'),
        meta: { requiresAuth: true, title: '经营驾驶舱', icon: 'Odometer', module: 'analytics' },
      },
      {
        path: 'finance',
        name: 'SmartBIFinance',
        component: () => import('@/views/smart-bi/FinanceAnalysis.vue'),
        meta: { requiresAuth: true, title: '财务分析', icon: 'Money', module: 'analytics' },
      },
      {
        path: 'sales',
        name: 'SmartBISales',
        component: () => import('@/views/smart-bi/SalesAnalysis.vue'),
        meta: { requiresAuth: true, title: '销售分析', icon: 'TrendCharts', module: 'analytics' },
      },
      {
        path: 'query',
        name: 'SmartBIQuery',
        component: () => import('@/views/smart-bi/AIQuery.vue'),
        meta: { requiresAuth: true, title: 'AI问答', icon: 'ChatDotRound', module: 'analytics' },
      },
      {
        path: 'query-templates',
        name: 'SmartBIQueryTemplates',
        component: () => import('@/views/smart-bi/QueryTemplateManager.vue'),
        meta: { requiresAuth: true, title: '查询模板管理', icon: 'Tickets', module: 'analytics' },
      },
      {
        path: 'analysis',
        name: 'SmartBIAnalysis',
        component: () => import('@/views/smart-bi/SmartBIAnalysis.vue'),
        meta: { requiresAuth: true, title: '智能数据分析', icon: 'DataAnalysis', module: 'analytics' },
      },
      {
        path: 'upload',
        name: 'SmartBIExcelUpload',
        component: () => import('@/views/smart-bi/ExcelUpload.vue'),
        meta: { requiresAuth: true, title: 'Excel上传', icon: 'Upload', module: 'analytics' },
      },
      {
        path: 'data-completeness',
        name: 'SmartBIDataCompleteness',
        component: () => import('@/views/smart-bi/DataCompletenessView.vue'),
        meta: { requiresAuth: true, title: '数据完整度', icon: 'Checked', module: 'analytics' },
      },
      {
        path: 'food-kb-feedback',
        name: 'SmartBIFoodKBFeedback',
        component: () => import('@/views/smart-bi/FoodKBFeedback.vue'),
        meta: { requiresAuth: true, title: '知识库反馈', icon: 'ChatDotRound', module: 'analytics' },
      },
      {
        path: 'calibration',
        name: 'SmartBICalibration',
        component: () => import('@/views/calibration/CalibrationListView.vue'),
        meta: { requiresAuth: true, title: '行为校准监控', icon: 'Aim', module: 'analytics' },
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
