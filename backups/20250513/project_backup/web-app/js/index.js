/**
 * 食品溯源系统主入口文件
 * 用于初始化系统全局配置和公共功能
 */

// 系统配置
const TraceSystemConfig = {
  version: '1.0.0',
  apiBase: '/api',
  debug: false,
  features: {
    offlineMode: true,
    autoUpgrade: true,
    analytics: true
  }
};

// 初始化系统
function initTraceSystem() {
  console.log('食品溯源系统初始化中...');
  
  // 检测网络状态
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  
  // 初始化组件
  if (typeof initTraceComponents === 'function') {
    initTraceComponents();
  }
  
  // 初始化用户界面
  initUI();
  
  console.log('食品溯源系统初始化完成');
}

// 更新网络状态
function updateNetworkStatus() {
  if (navigator.onLine) {
    console.log('网络已连接');
    document.body.classList.remove('offline-mode');
    syncData();
  } else {
    console.log('网络已断开');
    document.body.classList.add('offline-mode');
  }
}

// 同步数据
function syncData() {
  if (TraceSystemConfig.features.offlineMode && window.localStorage) {
    // 同步本地存储的数据
    console.log('正在同步本地数据...');
  }
}

// 初始化用户界面
function initUI() {
  // 升级所有按钮
  if (typeof upgradeAllButtons === 'function') {
    upgradeAllButtons();
  }
  
  // 设置主题
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDarkMode) {
    document.body.classList.add('dark-mode');
  }
}

// 当页面加载完成时初始化系统
document.addEventListener('DOMContentLoaded', function() {
  initTraceSystem();
}); 