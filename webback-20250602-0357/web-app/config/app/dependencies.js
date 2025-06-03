/**
 * 食品溯源系统 - 依赖管理入口
 * 用于统一管理所有组件的导入和导出
 * 版本: 1.0.0
 */

// 导入核心模块
import { traceCommon } from './modules/trace-common.js';
import { traceLoader } from './modules/auth/loader.js';
import { traceAuth } from './modules/auth/auth.js';
import { traceUtils } from './modules/utils/utils.js';
import { traceErrorHandler } from './modules/trace-error-handler.js';
import { traceRoutes } from './modules/trace-routes.js';
import { traceUI } from './modules/ui/trace-ui.js';
import { traceNav } from './modules/ui/trace-nav.js';
import { traceStore } from './modules/store/trace-store.js';
import { traceDataImport } from './modules/data/trace-data-import.js';

// 导出所有模块
export {
  traceCommon,
  traceLoader,
  traceAuth,
  traceUtils,
  traceErrorHandler,
  traceRoutes,
  traceUI,
  traceNav,
  traceStore,
  traceDataImport
};

// 自动初始化常用模块（可选）
window.addEventListener('DOMContentLoaded', () => {
  console.log('自动初始化核心模块...');
  
  // 初始化错误处理
  if (window.traceErrorHandler) {
    window.traceErrorHandler.init();
  }
  
  // 初始化资源加载器
  if (window.traceLoader) {
    window.traceLoader.init();
  }
});

// 向后兼容：将模块导出到全局对象
// 这样可以保证现有代码在重构过程中继续正常工作
window.traceCommon = traceCommon;
window.traceLoader = traceLoader;
window.traceAuth = traceAuth;
window.traceUtils = traceUtils;
window.traceErrorHandler = traceErrorHandler;
window.traceRoutes = traceRoutes;
window.traceUI = traceUI;
window.traceNav = traceNav;
window.traceStore = traceStore;
window.traceDataImport = traceDataImport;

console.log('依赖管理模块已加载'); 