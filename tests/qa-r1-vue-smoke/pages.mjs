// SmartBI Vue page registry (Round 1 part 2).
// Sources:
//   web-admin/src/router/modules/smartbi.ts (15 routes under /smart-bi)
//   web-admin/src/router/index.ts L647-L662 (3 routes under /system/smartbi-config)
// Generated 2026-05-12 from origin/main.

export const PAGES = [
  // /smart-bi/* (15)
  { name: 'SmartBIDashboard',        path: '/smart-bi/dashboard',          source: 'views/smart-bi/Dashboard.vue' },
  { name: 'SmartBIFinance',          path: '/smart-bi/finance',            source: 'views/smart-bi/FinanceAnalysis.vue' },
  { name: 'SmartBISales',            path: '/smart-bi/sales',              source: 'views/smart-bi/SalesAnalysis.vue' },
  { name: 'SmartBIQuery',            path: '/smart-bi/query',              source: 'views/smart-bi/AIQuery.vue' },
  { name: 'SmartBIQueryTemplates',   path: '/smart-bi/query-templates',    source: 'views/smart-bi/QueryTemplateManager.vue' },
  { name: 'SmartBIAnalysis',         path: '/smart-bi/analysis',           source: 'views/smart-bi/SmartBIAnalysis.vue' },
  { name: 'SmartBIExcelUpload',      path: '/smart-bi/upload',             source: 'views/smart-bi/ExcelUpload.vue' },
  { name: 'SmartBIDataCompleteness', path: '/smart-bi/data-completeness',  source: 'views/smart-bi/DataCompletenessView.vue' },
  { name: 'SmartBIFoodKBFeedback',   path: '/smart-bi/food-kb-feedback',   source: 'views/smart-bi/FoodKBFeedback.vue' },
  { name: 'SmartBIFallbackLog',      path: '/smart-bi/fallback-log',       source: 'views/smart-bi/FallbackLogAdmin.vue' },
  { name: 'SmartBICalibration',      path: '/smart-bi/calibration',        source: 'views/calibration/CalibrationListView.vue' },
  { name: 'FinancialDashboardPBI',   path: '/smart-bi/financial-dashboard', source: 'views/smart-bi/FinancialDashboardPBI.vue' },
  { name: 'SmartBIWhatIf',           path: '/smart-bi/whatif',             source: 'views/smart-bi/WhatIfSimulator.vue' },
  { name: 'SmartBIRestaurantV2',     path: '/smart-bi/restaurant-v2',      source: 'views/smart-bi/RestaurantV2Dashboard.vue' },
  { name: 'SmartBIGoldPreview',      path: '/smart-bi/gold-preview',       source: 'views/smart-bi/GoldPreview.vue' },

  // /system/smartbi-config/* (3)
  { name: 'SmartBIConfig',           path: '/system/smartbi-config',                 source: 'views/smartbi-config/SmartBIConfigView.vue' },
  { name: 'SmartBIDataSources',      path: '/system/smartbi-config/data-sources',    source: 'views/smartbi-config/DataSourceConfigView.vue' },
  { name: 'SmartBIChartTemplates',   path: '/system/smartbi-config/chart-templates', source: 'views/smartbi-config/ChartTemplateView.vue' },
];
