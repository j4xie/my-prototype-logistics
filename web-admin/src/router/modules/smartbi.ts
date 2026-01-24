/**
 * SmartBI 智能分析路由模块
 * 面向财务主管的经营分析工具
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
        meta: { requiresAuth: true, title: '经营驾驶舱', icon: 'Odometer', module: 'analytics' },
      },
      {
        path: 'finance',
        name: 'SmartBIFinance',
        component: () => import('@/views/smart-bi/FinanceAnalysis.vue'),
        meta: { requiresAuth: true, title: '财务分析', icon: 'Money', module: 'finance' },
      },
      {
        path: 'sales',
        name: 'SmartBISales',
        component: () => import('@/views/smart-bi/SalesAnalysis.vue'),
        meta: { requiresAuth: true, title: '销售分析', icon: 'TrendCharts', module: 'sales' },
      },
      {
        path: 'query',
        name: 'SmartBIQuery',
        component: () => import('@/views/smart-bi/AIQuery.vue'),
        meta: { requiresAuth: true, title: 'AI问答', icon: 'ChatDotRound', module: 'analytics' },
      },
      {
        path: 'analysis',
        name: 'SmartBIAnalysis',
        component: () => import('@/views/smart-bi/SmartBIAnalysis.vue'),
        meta: { requiresAuth: true, title: '数据导入', icon: 'Upload', module: 'analytics', action: 'write' },
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
