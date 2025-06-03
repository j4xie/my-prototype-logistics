/**
 * 食品溯源系统 - 离线数据支持组件
 * 提供Service Worker管理、离线数据存储和同步功能
 */

// UPDATED CODE: 使用ES模块导出
// 配置项
const config = {
  enabled: true,
  syncEndpoint: '/api/sync',
  cacheVersion: 'v1',
  syncInterval: 60000, // 1分钟同步一次
  maxQueueSize: 100,
  useIndexedDB: true // 如果为false则使用localStorage
};

// 缓存的页面和资源
const CACHE_PAGES = [
  '/',
  '/index.html',
  '/login.html',
  '/home.html',
  '/create-trace.html',
  '/trace-list.html',
  '/trace-detail.html',
  '/assets/styles.css',
  '/components/trace-form-validation.js',
  '/components/trace-data-import.js',
  '/components/trace-blockchain.js',
  '/components/trace-store.js'
];

// 缓存的API请求
const CACHE_API_ROUTES = [
  '/api/templates',
  '/api/products',
  '/api/settings'
];

// 数据库对象
let db = null;

// 同步队列
let syncQueue = [];

// 事件监听器
const eventListeners = {
  'offlinechange': [],
  'syncstatus': [],
  'dataupdated': []
};

/**
 * 初始化离线支持
 */
async function init() {
  // 从本地存储加载队列
  loadSyncQueue();
  
  // 初始化Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await registerServiceWorker();
      console.log('Service Worker注册成功');
    } catch (error) {
      console.error('Service Worker注册失败:', error);
    }
  }
  
  // 初始化数据库
  if (config.useIndexedDB) {
    try {
      await initDatabase();
      console.log('IndexedDB初始化成功');
    } catch (error) {
      console.error('IndexedDB初始化失败，降级到localStorage:', error);
      config.useIndexedDB = false;
    }
  }
  
  // 监听在线状态变化
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);
  
  // 初始显示离线状态指示器
  updateOfflineIndicator();
  
  // 设置自动同步
  setInterval(syncData, config.syncInterval);
  
  // 如果有pending的同步任务，尝试立即同步
  if (syncQueue.length > 0 && navigator.onLine) {
    syncData();
  }
  
  // 在DOM加载完成时更新UI
  document.addEventListener('DOMContentLoaded', updateOfflineIndicator);
  
  console.log('离线数据支持已初始化');
  return true;
}

/**
 * 注册Service Worker
 * @return {Promise}
 */
async function registerServiceWorker() {
  if (!navigator.serviceWorker) {
    return Promise.reject(new Error('浏览器不支持Service Worker'));
  }
  
  // 检查是否已有活跃的Service Worker
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  
  // 监听Service Worker消息
  navigator.serviceWorker.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    if (type === 'CACHE_UPDATED') {
      dispatchEvent('dataupdated', { type: 'cache', data });
    }
  });
  
  return registration;
}

/**
 * 初始化IndexedDB数据库
 * @return {Promise}
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('浏览器不支持IndexedDB'));
    }
    
    const request = indexedDB.open('TraceDB', 1);
    
    request.onerror = event => {
      reject(new Error('数据库打开失败: ' + event.target.errorCode));
    };
    
    request.onsuccess = event => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = event => {
      const database = event.target.result;
      
      // 创建存储对象
      const stores = [
        { name: 'traces', keyPath: 'id' },
        { name: 'drafts', keyPath: 'id' },
        { name: 'templates', keyPath: 'id' },
        { name: 'products', keyPath: 'id' }
      ];
      
      stores.forEach(store => {
        if (!database.objectStoreNames.contains(store.name)) {
          database.createObjectStore(store.name, { keyPath: store.keyPath });
          console.log(`创建存储对象: ${store.name}`);
        }
      });
    };
  });
}

/**
 * 处理在线状态变化
 */
function handleOnlineStatusChange() {
  const isOnline = navigator.onLine;
  
  updateOfflineIndicator();
  
  dispatchEvent('offlinechange', { isOnline });
  
  // 如果重新上线，尝试同步数据
  if (isOnline && syncQueue.length > 0) {
    syncData();
  }
}

/**
 * 更新离线状态指示器
 */
function updateOfflineIndicator() {
  const isOnline = navigator.onLine;
  const indicator = document.getElementById('offline-mode-indicator');
  
  if (indicator) {
    if (!isOnline) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }
}

/**
 * 保存溯源记录
 * @param {string} id 记录ID
 * @param {Object} data 记录数据
 * @return {Promise<Object>} 保存结果
 */
async function saveTraceRecord(id, data) {
  try {
    const record = {
      id: id || `trace_${Date.now()}`,
      data,
      createdAt: Date.now(),
      synced: false
    };
    
    // 存储记录
    if (config.useIndexedDB && db) {
      await saveToIndexedDB('traces', record);
    } else {
      saveToLocalStorage('traces', record);
    }
    
    // 添加到同步队列
    addToSyncQueue({
      type: 'trace',
      action: 'create',
      id: record.id,
      data
    });
    
    return { success: true, id: record.id };
  } catch (error) {
    console.error('保存溯源记录失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 保存表单草稿
 * @param {string} id 草稿ID
 * @param {Object} data 草稿数据
 * @return {Promise<Object>} 保存结果
 */
async function saveDraft(id, data) {
  try {
    const draft = {
      id: id || `draft_${Date.now()}`,
      data,
      updatedAt: Date.now()
    };
    
    // 存储草稿
    if (config.useIndexedDB && db) {
      await saveToIndexedDB('drafts', draft);
    } else {
      saveToLocalStorage('drafts', draft);
    }
    
    // 草稿不加入同步队列，只在本地存储
    
    return { success: true, id: draft.id };
  } catch (error) {
    console.error('保存草稿失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取溯源记录
 * @param {string} id 记录ID
 * @return {Promise<Object>} 记录数据
 */
async function getTraceRecord(id) {
  try {
    if (config.useIndexedDB && db) {
      return await getFromIndexedDB('traces', id);
    } else {
      return getFromLocalStorage('traces', id);
    }
  } catch (error) {
    console.error('获取溯源记录失败:', error);
    return null;
  }
}

/**
 * 获取草稿
 * @param {string} id 草稿ID
 * @return {Promise<Object>} 草稿数据
 */
async function getDraft(id) {
  try {
    if (config.useIndexedDB && db) {
      return await getFromIndexedDB('drafts', id);
    } else {
      return getFromLocalStorage('drafts', id);
    }
  } catch (error) {
    console.error('获取草稿失败:', error);
    return null;
  }
}

/**
 * 列出所有溯源记录
 * @return {Promise<Array>} 记录列表
 */
async function listTraceRecords() {
  try {
    if (config.useIndexedDB && db) {
      return await getAllFromIndexedDB('traces');
    } else {
      return getAllFromLocalStorage('traces');
    }
  } catch (error) {
    console.error('列出溯源记录失败:', error);
    return [];
  }
}

/**
 * 列出所有草稿
 * @return {Promise<Array>} 草稿列表
 */
async function listDrafts() {
  try {
    if (config.useIndexedDB && db) {
      return await getAllFromIndexedDB('drafts');
    } else {
      return getAllFromLocalStorage('drafts');
    }
  } catch (error) {
    console.error('列出草稿失败:', error);
    return [];
  }
}

/**
 * 删除溯源记录
 * @param {string} id 记录ID
 * @return {Promise<boolean>} 删除结果
 */
async function deleteTraceRecord(id) {
  try {
    if (config.useIndexedDB && db) {
      await deleteFromIndexedDB('traces', id);
    } else {
      deleteFromLocalStorage('traces', id);
    }
    
    // 添加到同步队列
    addToSyncQueue({
      type: 'trace',
      action: 'delete',
      id
    });
    
    return true;
  } catch (error) {
    console.error('删除溯源记录失败:', error);
    return false;
  }
}

/**
 * 删除草稿
 * @param {string} id 草稿ID
 * @return {Promise<boolean>} 删除结果
 */
async function deleteDraft(id) {
  try {
    if (config.useIndexedDB && db) {
      await deleteFromIndexedDB('drafts', id);
    } else {
      deleteFromLocalStorage('drafts', id);
    }
    
    return true;
  } catch (error) {
    console.error('删除草稿失败:', error);
    return false;
  }
}

/**
 * 将数据存储到IndexedDB
 * @param {string} storeName 存储对象名称
 * @param {Object} data 数据
 * @return {Promise}
 */
function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('数据库未初始化'));
    }
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => resolve(data);
    request.onerror = event => reject(new Error(`保存到IndexedDB失败: ${event.target.errorCode}`));
  });
}

/**
 * 从IndexedDB获取数据
 * @param {string} storeName 存储对象名称
 * @param {string} id 数据ID
 * @return {Promise<Object>}
 */
function getFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('数据库未初始化'));
    }
    
    const transaction = db.transaction([storeName]);
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(new Error(`从IndexedDB获取数据失败: ${event.target.errorCode}`));
  });
}

/**
 * 从IndexedDB获取所有数据
 * @param {string} storeName 存储对象名称
 * @return {Promise<Array>}
 */
function getAllFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('数据库未初始化'));
    }
    
    const transaction = db.transaction([storeName]);
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = event => resolve(event.target.result || []);
    request.onerror = event => reject(new Error(`从IndexedDB获取所有数据失败: ${event.target.errorCode}`));
  });
}

/**
 * 从IndexedDB删除数据
 * @param {string} storeName 存储对象名称
 * @param {string} id 数据ID
 * @return {Promise}
 */
function deleteFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('数据库未初始化'));
    }
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve(true);
    request.onerror = event => reject(new Error(`从IndexedDB删除数据失败: ${event.target.errorCode}`));
  });
}

/**
 * 将数据存储到localStorage
 * @param {string} storeName 存储对象名称
 * @param {Object} data 数据
 */
function saveToLocalStorage(storeName, data) {
  try {
    // 获取现有数据
    const items = JSON.parse(localStorage.getItem(`trace_${storeName}`) || '{}');
    
    // 添加或更新数据
    items[data.id] = data;
    
    // 保存回localStorage
    localStorage.setItem(`trace_${storeName}`, JSON.stringify(items));
    
    return data;
  } catch (error) {
    console.error(`保存到localStorage失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从localStorage获取数据
 * @param {string} storeName 存储对象名称
 * @param {string} id 数据ID
 * @return {Object} 数据
 */
function getFromLocalStorage(storeName, id) {
  try {
    const items = JSON.parse(localStorage.getItem(`trace_${storeName}`) || '{}');
    return items[id] || null;
  } catch (error) {
    console.error(`从localStorage获取数据失败: ${error.message}`);
    return null;
  }
}

/**
 * 从localStorage获取所有数据
 * @param {string} storeName 存储对象名称
 * @return {Array} 数据列表
 */
function getAllFromLocalStorage(storeName) {
  try {
    const items = JSON.parse(localStorage.getItem(`trace_${storeName}`) || '{}');
    return Object.values(items);
  } catch (error) {
    console.error(`从localStorage获取所有数据失败: ${error.message}`);
    return [];
  }
}

/**
 * 从localStorage删除数据
 * @param {string} storeName 存储对象名称
 * @param {string} id 数据ID
 * @return {boolean} 是否成功
 */
function deleteFromLocalStorage(storeName, id) {
  try {
    const items = JSON.parse(localStorage.getItem(`trace_${storeName}`) || '{}');
    
    if (items[id]) {
      delete items[id];
      localStorage.setItem(`trace_${storeName}`, JSON.stringify(items));
    }
    
    return true;
  } catch (error) {
    console.error(`从localStorage删除数据失败: ${error.message}`);
    return false;
  }
}

/**
 * 添加到同步队列
 * @param {Object} item 队列项
 */
function addToSyncQueue(item) {
  // 限制队列大小
  if (syncQueue.length >= config.maxQueueSize) {
    syncQueue.shift(); // 移除最旧的项
  }
  
  // 添加时间戳
  item.timestamp = Date.now();
  
  // 添加到队列
  syncQueue.push(item);
  
  // 保存队列
  saveSyncQueue();
  
  // 如果有网络，尝试立即同步
  if (navigator.onLine) {
    syncData();
  }
}

/**
 * 保存同步队列到本地存储
 */
function saveSyncQueue() {
  try {
    localStorage.setItem('trace_sync_queue', JSON.stringify(syncQueue));
  } catch (error) {
    console.error('保存同步队列失败:', error);
  }
}

/**
 * 从本地存储加载同步队列
 */
function loadSyncQueue() {
  try {
    const queue = localStorage.getItem('trace_sync_queue');
    if (queue) {
      syncQueue = JSON.parse(queue);
    }
  } catch (error) {
    console.error('加载同步队列失败:', error);
    syncQueue = [];
  }
}

/**
 * 同步数据到服务器
 */
async function syncData() {
  if (!navigator.onLine || syncQueue.length === 0) {
    return;
  }
  
  dispatchEvent('syncstatus', { status: 'syncing', count: syncQueue.length });
  showSyncNotification({ status: 'syncing', count: syncQueue.length });
  
  const queue = [...syncQueue];
  const results = [];
  
  for (const item of queue) {
    try {
      // 调用API
      const response = await fetch(config.syncEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(item)
      });
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // 从队列中移除已同步的项
      syncQueue = syncQueue.filter(i => i.timestamp !== item.timestamp);
      saveSyncQueue();
      
      results.push({ item, success: true, result });
      
      // 更新本地记录的同步状态
      if (item.type === 'trace' && item.action === 'create' && item.id) {
        updateRecordSyncStatus(item.id, true);
      }
    } catch (error) {
      console.error('同步数据项失败:', error, item);
      results.push({ item, success: false, error: error.message });
      
      // 如果是网络错误，停止同步
      if (error.name === 'NetworkError' || !navigator.onLine) {
        break;
      }
    }
  }
  
  const status = {
    status: 'completed',
    total: queue.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
  
  dispatchEvent('syncstatus', status);
  showSyncNotification(status);
}

/**
 * 更新记录的同步状态
 * @param {string} id 记录ID
 * @param {boolean} synced 是否已同步
 */
async function updateRecordSyncStatus(id, synced) {
  try {
    // 获取记录
    let record;
    if (config.useIndexedDB && db) {
      record = await getFromIndexedDB('traces', id);
    } else {
      record = getFromLocalStorage('traces', id);
    }
    
    if (record) {
      // 更新状态
      record.synced = synced;
      record.syncedAt = synced ? Date.now() : null;
      
      // 保存回存储
      if (config.useIndexedDB && db) {
        await saveToIndexedDB('traces', record);
      } else {
        saveToLocalStorage('traces', record);
      }
    }
  } catch (error) {
    console.error('更新记录同步状态失败:', error);
  }
}

/**
 * 显示同步状态通知
 * @param {Object} status 状态信息
 */
function showSyncNotification(status) {
  if (status.status === 'syncing') {
    showNotification(`正在同步数据 (${status.count}项)`, 'info');
  } else if (status.status === 'completed') {
    if (status.failed === 0) {
      showNotification(`数据同步完成 (共${status.total}项)`, 'success');
    } else {
      showNotification(`数据同步部分完成 (成功${status.success}项，失败${status.failed}项)`, 'warning');
    }
  }
}

/**
 * 显示通知
 * @param {string} message 消息内容
 * @param {string} type 通知类型
 * @param {number} duration 显示时长(毫秒)
 */
function showNotification(message, type = 'info', duration = 3000) {
  try {
    const notifContainer = document.querySelector('.trace-notifications');
    
    if (!notifContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} shadow-md rounded-md p-3 mb-2`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${getIconForType(type)} mr-2"></i>
        <span>${message}</span>
      </div>
    `;
    
    notifContainer.appendChild(notification);
    
    // 动画效果
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 自动移除
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('hide');
      setTimeout(() => {
        notifContainer.removeChild(notification);
      }, 300);
    }, duration);
  } catch (error) {
    console.error('显示通知失败:', error);
  }
}

/**
 * 根据通知类型获取图标
 * @param {string} type 通知类型
 * @return {string} 图标名称
 */
function getIconForType(type) {
  switch (type) {
    case 'success': return 'check-circle';
    case 'error': return 'exclamation-circle';
    case 'warning': return 'exclamation-triangle';
    case 'info': 
    default: return 'info-circle';
  }
}

/**
 * 注册事件监听器
 * @param {string} eventName 事件名称
 * @param {Function} callback 回调函数
 * @return {string} 监听器ID
 */
function addEventListener(eventName, callback) {
  if (!eventListeners[eventName]) {
    eventListeners[eventName] = [];
  }
  
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  eventListeners[eventName].push({
    id,
    callback
  });
  
  return id;
}

/**
 * 移除事件监听器
 * @param {string} eventName 事件名称
 * @param {string} id 监听器ID
 * @return {boolean} 是否成功移除
 */
function removeEventListener(eventName, id) {
  if (!eventListeners[eventName]) {
    return false;
  }
  
  const initialLength = eventListeners[eventName].length;
  eventListeners[eventName] = eventListeners[eventName].filter(listener => listener.id !== id);
  
  return eventListeners[eventName].length < initialLength;
}

/**
 * 分发事件
 * @param {string} eventName 事件名称
 * @param {Object} data 事件数据
 */
function dispatchEvent(eventName, data) {
  if (!eventListeners[eventName]) {
    return;
  }
  
  eventListeners[eventName].forEach(listener => {
    try {
      listener.callback(data);
    } catch (error) {
      console.error(`执行事件监听器失败: ${eventName}`, error);
    }
  });
}

// UPDATED CODE: 导出离线支持API
export const TraceOffline = {
  init,
  saveTraceRecord,
  saveDraft,
  getTraceRecord,
  getDraft,
  listTraceRecords,
  listDrafts,
  deleteTraceRecord,
  deleteDraft,
  syncData,
  addEventListener,
  removeEventListener,
  showNotification,
  getConfig: () => ({ ...config }),
  setConfig: (newConfig) => {
    Object.assign(config, newConfig);
    return { ...config };
  },
  getOnlineStatus: () => navigator.onLine,
  getSyncQueue: () => [...syncQueue],
  getCacheList: () => [...CACHE_PAGES, ...CACHE_API_ROUTES]
};

// 在文档加载完成后初始化离线支持
document.addEventListener('DOMContentLoaded', () => {
  if (config.enabled) {
    init();
  }
});