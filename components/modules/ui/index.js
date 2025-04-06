/**
 * 食品溯源系统 - UI模块索引
 * 将所有UI相关组件统一从这里导出
 * 版本: 1.0.0
 */

// 从各个UI模块导入
import { traceToast, showToast, showInfo, showSuccess, showWarning, showError, showLoading } from './toast.js';
import { traceModal, openModal, showConfirm, showAlert } from './modal.js';
import { traceUI } from './ui.js';

// 导出UI组件
export {
  // 完整UI对象
  traceUI,
  
  // Toast组件
  traceToast,
  showToast,
  showInfo,
  showSuccess,
  showWarning,
  showError,
  showLoading,
  
  // Modal组件
  traceModal,
  openModal,
  showConfirm,
  showAlert
};

// 默认导出主UI组件
export default traceUI; 