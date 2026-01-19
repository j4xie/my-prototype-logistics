/**
 * SmartBI 模块导出
 * 包含经营驾驶舱、销售分析、财务分析、数据导入和 AI 问答功能
 */

// 布局容器
export { default as SmartBILayout } from './Layout.vue';

// 页面组件
export { default as Dashboard } from './Dashboard.vue';
export { default as SalesAnalysis } from './SalesAnalysis.vue';
export { default as FinanceAnalysis } from './FinanceAnalysis.vue';
export { default as ExcelUpload } from './ExcelUpload.vue';
export { default as AIQuery } from './AIQuery.vue';

// 路由配置
export const smartBIRoutes = [
  {
    path: '/smart-bi',
    name: 'SmartBI',
    component: () => import('./Layout.vue'),
    meta: {
      title: 'Smart BI',
      icon: 'TrendCharts',
      roles: ['factory_super_admin', 'finance_manager', 'sales_manager']
    },
    redirect: '/smart-bi/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'SmartBIDashboard',
        component: () => import('./Dashboard.vue'),
        meta: {
          title: '经营驾驶舱',
          icon: 'DataLine'
        }
      },
      {
        path: 'sales',
        name: 'SmartBISalesAnalysis',
        component: () => import('./SalesAnalysis.vue'),
        meta: {
          title: '销售分析',
          icon: 'TrendCharts'
        }
      },
      {
        path: 'finance',
        name: 'SmartBIFinanceAnalysis',
        component: () => import('./FinanceAnalysis.vue'),
        meta: {
          title: '财务分析',
          icon: 'Wallet'
        }
      },
      {
        path: 'upload',
        name: 'SmartBIExcelUpload',
        component: () => import('./ExcelUpload.vue'),
        meta: {
          title: '数据导入',
          icon: 'Upload'
        }
      },
      {
        path: 'ai-query',
        name: 'SmartBIAIQuery',
        component: () => import('./AIQuery.vue'),
        meta: {
          title: 'AI 问答',
          icon: 'ChatDotRound'
        }
      }
    ]
  }
];
