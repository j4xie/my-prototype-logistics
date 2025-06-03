/**
 * 食品溯源系统 - UI模块索引
 * 此文件整合了所有UI组件，提供统一的导出接口
 * 版本: 1.0.0
 */

// 导入UI主组件和各种组件
const { traceUI } = require('./ui.js');
const { 
  traceToast, 
  showToast, 
  showInfo, 
  showSuccess, 
  showWarning, 
  showError, 
  showLoading 
} = require('./toast.js');

const { 
  traceModal, 
  openModal, 
  showConfirm, 
  showAlert 
} = require('./modal.js');

// CommonJS导出
module.exports = traceUI;

// 扩展导出所有组件和方法
Object.assign(module.exports, {
  // 主UI组件
  traceUI,
  
  // Toast组件及方法
  traceToast,
  showToast,
  showInfo,
  showSuccess,
  showWarning,
  showError,
  showLoading,
  
  // Modal组件及方法
  traceModal,
  openModal,
  showConfirm,
  showAlert
});
