# 文件迁移记录

## 核心溯源模块
- `web-app/components/trace-core.js` → `web-app/src/components/modules/trace/trace-core.js`
- `web-app/components/trace-map.js` → `web-app/src/components/modules/trace/trace-map.js`
- `web-app/components/trace-scanner.js` → `web-app/src/components/modules/trace/trace-scanner.js`
- `web-app/components/trace-blockchain.js` → `web-app/src/components/modules/trace/trace-blockchain.js`
- `web-app/components/modules/trace/TraceRecordView.js` → `web-app/src/components/modules/trace/TraceRecordView.js`
- `web-app/components/modules/trace/TraceRecordQuery.js` → `web-app/src/components/modules/trace/TraceRecordQuery.js`
- `web-app/components/modules/trace/TraceRecordDetails.js` → `web-app/src/components/modules/trace/TraceRecordDetails.js`
- `web-app/components/modules/trace/trace-data.js` → `web-app/src/components/modules/trace/trace-data.js`
- `web-app/components/modules/trace/trace-batch.js` → `web-app/src/components/modules/trace/trace-batch.js`

## UI组件
- `web-app/components/trace-ui-components.js` → `web-app/src/components/ui/trace-ui-components.js`
- `web-app/components/trace-ui.js` → `web-app/src/components/ui/trace-ui.js`
- `web-app/components/StatCard.js` → `web-app/src/components/ui/StatCard.js`
- `web-app/components/trace-nav.js` → `web-app/src/components/ui/trace-nav.js`

## 通用工具
- `web-app/components/trace-common.js` → `web-app/src/utils/common/trace-common.js`
- `web-app/components/trace-error-handler.js` → `web-app/src/utils/common/trace-error-handler.js`
- `web-app/components/trace-routes.js` → `web-app/src/utils/common/trace-routes.js`
- `web-app/components/browser-compatibility.js` → `web-app/src/utils/common/browser-compatibility.js`
- `web-app/components/utils/trace-common.js` → `web-app/src/utils/common/trace-common.js`
- `web-app/components/utils/trace-error-handler.js` → `web-app/src/utils/common/trace-error-handler.js`
- `web-app/components/utils/trace-routes.js` → `web-app/src/utils/common/trace-routes.js`

## 认证相关
- `web-app/components/trace-auth.js` → `web-app/src/utils/auth/trace-auth.js`

## 网络相关
- `web-app/components/trace-performance.js` → `web-app/src/utils/network/trace-performance.js`
- `web-app/components/trace-offline.js` → `web-app/src/utils/network/trace-offline.js`

## 存储相关
- `web-app/components/trace-store.js` → `web-app/src/utils/storage/trace-store.js`
- `web-app/components/store/trace-store.js` → `web-app/src/utils/storage/trace-store.js`

## 通用组件
- `web-app/components/trace-ux.js` → `web-app/src/components/common/trace-ux.js`
- `web-app/components/trace-form-validation.js` → `web-app/src/components/common/trace-form-validation.js`
- `web-app/components/trace-a11y.js` → `web-app/src/components/common/trace-a11y.js`
- `web-app/components/trace-button-template.js` → `web-app/src/components/common/trace-button-template.js`
- `web-app/components/trace-button-config.js` → `web-app/src/components/common/trace-button-config.js`
- `web-app/components/autoload-button-upgrade.js` → `web-app/src/components/common/autoload-button-upgrade.js`
- `web-app/components/page-template.html` → `web-app/src/components/common/page-template.html`

## 养殖模块
- `web-app/components/trace-intelligence.js` → `web-app/src/components/modules/farming/trace-intelligence.js`
- `web-app/components/trace-prediction.js` → `web-app/src/components/modules/farming/trace-prediction.js`

## 主要脚本和配置
- `web-app/components/trace-main.js` → `web-app/src/trace-main.js`
- `web-app/components/config-manager.js` → `web-app/config/app/config-manager.js`
- `web-app/components/dependencies.js` → `web-app/config/app/dependencies.js`

## HTML页面
- `web-app/components/trace-breeding.html` → `web-app/src/pages/farming/breeding.html`
- `web-app/components/trace-slaughter.html` → `web-app/src/pages/processing/slaughter.html`
- `web-app/components/trace-inspection.html` → `web-app/src/pages/processing/inspection.html`
- `web-app/components/trace-logistics.html` → `web-app/src/pages/logistics/tracking.html`
- `web-app/components/trace-sales.html` → `web-app/src/pages/trace/sales.html` 