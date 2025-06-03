/**
 * 离线数据支持模块
 * 用于管理数据的本地存储和同步
 */

// IndexedDB数据库配置
const DB_NAME = 'farming_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'data_collection';

// 初始化数据库
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('IndexedDB初始化失败:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            console.log('IndexedDB连接成功');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 创建数据存储对象
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true });
                
                // 创建索引
                store.createIndex('syncStatus', 'syncStatus', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('dataType', 'dataType', { unique: false });
                
                console.log('IndexedDB存储对象创建成功');
            }
        };
    });
}

// 保存数据到本地
async function saveDataLocally(data) {
    try {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            // 添加本地ID和同步状态
            const dataToStore = {
                ...data,
                timestamp: data.timestamp || new Date().toISOString(),
                syncStatus: 'pending',
                createdAt: new Date().toISOString()
            };
            
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.add(dataToStore);
            
            request.onsuccess = (event) => {
                const localId = event.target.result;
                console.log(`数据已保存到本地，ID: ${localId}`);
                resolve({ ...dataToStore, localId });
            };
            
            request.onerror = (event) => {
                console.error('保存数据到本地失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('保存数据失败:', error);
        throw error;
    }
}

// 获取所有待同步的数据
async function getPendingData() {
    try {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('syncStatus');
            
            const request = index.getAll('pending');
            
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            
            request.onerror = (event) => {
                console.error('获取待同步数据失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('获取待同步数据失败:', error);
        throw error;
    }
}

// 更新数据同步状态
async function updateSyncStatus(localId, status, serverId = null) {
    try {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const getRequest = store.get(localId);
            
            getRequest.onsuccess = (event) => {
                const data = event.target.result;
                if (!data) {
                    reject(new Error(`未找到ID为${localId}的数据`));
                    return;
                }
                
                data.syncStatus = status;
                data.lastSyncTime = new Date().toISOString();
                
                if (serverId) {
                    data.serverId = serverId;
                }
                
                const updateRequest = store.put(data);
                
                updateRequest.onsuccess = () => {
                    console.log(`数据ID ${localId} 同步状态已更新为 ${status}`);
                    resolve(data);
                };
                
                updateRequest.onerror = (event) => {
                    console.error('更新同步状态失败:', event.target.error);
                    reject(event.target.error);
                };
            };
            
            getRequest.onerror = (event) => {
                console.error('获取数据失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('更新同步状态失败:', error);
        throw error;
    }
}

// 同步数据到服务器
async function syncDataToServer(apiEndpoint) {
    // 检查网络连接
    if (!navigator.onLine) {
        console.log('无网络连接，同步推迟');
        return { success: false, message: '无网络连接' };
    }
    
    try {
        // 获取所有待同步数据
        const pendingData = await getPendingData();
        
        if (pendingData.length === 0) {
            console.log('没有待同步的数据');
            return { success: true, message: '没有待同步的数据' };
        }
        
        console.log(`开始同步 ${pendingData.length} 条数据`);
        
        // 遍历同步每条数据
        const results = await Promise.allSettled(
            pendingData.map(async (data) => {
                try {
                    // 实际项目中这里应该调用真实的API
                    // 这里使用模拟的API调用
                    const response = await simulateApiCall(apiEndpoint, data);
                    
                    if (response.success) {
                        // 更新同步状态为已同步
                        await updateSyncStatus(data.localId, 'synced', response.serverId);
                        return { success: true, data, serverId: response.serverId };
                    } else {
                        // 更新同步状态为失败
                        await updateSyncStatus(data.localId, 'failed');
                        return { success: false, data, error: response.error };
                    }
                } catch (error) {
                    console.error(`同步数据ID ${data.localId} 失败:`, error);
                    // 更新同步状态为失败
                    await updateSyncStatus(data.localId, 'failed');
                    return { success: false, data, error };
                }
            })
        );
        
        // 统计同步结果
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - succeeded;
        
        return { 
            success: true, 
            message: `同步完成: ${succeeded} 成功, ${failed} 失败`,
            succeeded,
            failed,
            total: results.length
        };
    } catch (error) {
        console.error('同步数据失败:', error);
        return { success: false, message: '同步过程出错', error };
    }
}

// 模拟API调用（实际项目中应替换为真实API）
async function simulateApiCall(endpoint, data) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 模拟随机成功/失败
    const success = Math.random() > 0.2; // 80% 成功率
    
    if (success) {
        return { 
            success: true, 
            serverId: 'server_' + Date.now() + '_' + Math.floor(Math.random() * 1000) 
        };
    } else {
        return { 
            success: false, 
            error: '服务器处理错误' 
        };
    }
}

// 获取本地存储的数据总数
async function getLocalDataCount() {
    try {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                resolve(countRequest.result);
            };
            
            countRequest.onerror = (event) => {
                console.error('获取数据数量失败:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('获取数据数量失败:', error);
        throw error;
    }
}

// 检查并初始化网络状态监听
function initNetworkListener(onlineCallback, offlineCallback) {
    // 当前网络状态
    const isOnline = navigator.onLine;
    console.log(`当前网络状态: ${isOnline ? '在线' : '离线'}`);
    
    // 添加网络状态变化事件监听
    window.addEventListener('online', () => {
        console.log('网络连接已恢复');
        if (typeof onlineCallback === 'function') {
            onlineCallback();
        }
    });
    
    window.addEventListener('offline', () => {
        console.log('网络连接已断开');
        if (typeof offlineCallback === 'function') {
            offlineCallback();
        }
    });
    
    return isOnline;
}

// 导出模块函数
export {
    initDB,
    saveDataLocally,
    getPendingData,
    updateSyncStatus,
    syncDataToServer,
    getLocalDataCount,
    initNetworkListener
}; 