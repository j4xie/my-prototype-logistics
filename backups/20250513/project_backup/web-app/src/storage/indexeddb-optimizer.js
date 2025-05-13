/**
 * @file IndexedDB优化器
 * @description 提供IndexedDB存储优化工具，包括内存监控、批处理和流式处理
 */

/**
 * 内存监控器 - 监控内存使用情况并触发优化策略
 */
class MemoryMonitor {
  static _instance = null;
  static _callbacks = {
    warning: [],
    danger: [],
    normal: []
  };
  static _statusThresholds = {
    warning: 0.7, // 70%内存使用率触发警告
    danger: 0.85  // 85%内存使用率触发危险
  };
  static _monitoring = false;
  static _interval = null;
  static _intervalTime = 10000; // 默认10秒检测一次

  /**
   * 开始内存监控
   * @param {Object} options 配置选项
   * @returns {boolean} 是否成功启动
   */
  static startMonitoring(options = {}) {
    if (MemoryMonitor._monitoring) {
      return true;
    }

    // 合并配置
    if (options.thresholds) {
      MemoryMonitor._statusThresholds = {
        ...MemoryMonitor._statusThresholds,
        ...options.thresholds
      };
    }

    if (options.intervalTime) {
      MemoryMonitor._intervalTime = options.intervalTime;
    }

    MemoryMonitor._monitoring = true;

    // 启动定期检查
    MemoryMonitor._interval = setInterval(() => {
      MemoryMonitor._checkMemory();
    }, MemoryMonitor._intervalTime);

    // 立即执行一次检查
    MemoryMonitor._checkMemory();
    return true;
  }

  /**
   * 停止内存监控
   */
  static stopMonitoring() {
    if (MemoryMonitor._interval) {
      clearInterval(MemoryMonitor._interval);
      MemoryMonitor._interval = null;
    }
    MemoryMonitor._monitoring = false;
  }

  /**
   * 检查内存使用情况
   * @private
   */
  static _checkMemory() {
    const memoryInfo = MemoryMonitor.getMemoryInfo();
    const usageRatio = memoryInfo.percentage / 100;

    // 根据内存使用率触发不同级别的回调
    if (usageRatio >= MemoryMonitor._statusThresholds.danger) {
      MemoryMonitor._triggerCallbacks('danger', memoryInfo);
    } else if (usageRatio >= MemoryMonitor._statusThresholds.warning) {
      MemoryMonitor._triggerCallbacks('warning', memoryInfo);
    } else {
      MemoryMonitor._triggerCallbacks('normal', memoryInfo);
    }
  }

  /**
   * 触发指定类型的回调
   * @param {string} type 回调类型
   * @param {Object} memoryInfo 内存信息
   * @private
   */
  static _triggerCallbacks(type, memoryInfo) {
    if (MemoryMonitor._callbacks[type]) {
      MemoryMonitor._callbacks[type].forEach(callback => {
        try {
          callback(memoryInfo);
        } catch (error) {
          console.error(`内存监控回调错误(${type}):`, error);
        }
      });
    }
  }

  /**
   * 获取当前内存使用信息
   * @returns {Object} 内存信息
   */
  static getMemoryInfo() {
    // 尝试使用Performance API获取内存信息
    if (performance && performance.memory) {
      const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = performance.memory;
      
      return {
        total: jsHeapSizeLimit,
        used: usedJSHeapSize,
        available: jsHeapSizeLimit - usedJSHeapSize,
        percentage: (usedJSHeapSize / jsHeapSizeLimit) * 100
      };
    }
    
    // 如果Performance API不可用，尝试通过其他方式估算
    // 这里使用一个保守的估计，假设总内存的30%为警告，40%为危险
    return {
      total: Infinity,
      used: 0,
      available: Infinity,
      percentage: navigator.deviceMemory ? (100 - (navigator.deviceMemory * 10)) : 30
    };
  }

  /**
   * 添加内存状态回调
   * @param {string} type 回调类型 (warning/danger/normal)
   * @param {Function} callback 回调函数
   */
  static addCallback(type, callback) {
    if (!MemoryMonitor._callbacks[type]) {
      MemoryMonitor._callbacks[type] = [];
    }
    
    if (typeof callback === 'function' && !MemoryMonitor._callbacks[type].includes(callback)) {
      MemoryMonitor._callbacks[type].push(callback);
    }
  }

  /**
   * 移除内存状态回调
   * @param {string} type 回调类型
   * @param {Function} callback 要移除的回调函数
   */
  static removeCallback(type, callback) {
    if (MemoryMonitor._callbacks[type]) {
      const index = MemoryMonitor._callbacks[type].indexOf(callback);
      if (index !== -1) {
        MemoryMonitor._callbacks[type].splice(index, 1);
      }
    }
  }

  /**
   * 建议浏览器执行垃圾回收
   * 注意：这只是一个建议，不会强制执行
   */
  static suggestGarbageCollection() {
    if (window.gc) {
      try {
        window.gc();
        console.log('已建议浏览器执行垃圾回收');
      } catch (e) {
        console.log('无法建议垃圾回收');
      }
    } else {
      // 尝试通过创建大量临时对象然后释放的方式间接触发GC
      let largeArray = new Array(10000000).fill(0);
      largeArray = null;
    }
  }
}

/**
 * 批处理器 - 将大批量操作分解为小批次处理
 */
class BatchProcessor {
  /**
   * 分批处理数据
   * @param {Array} items 待处理数据项
   * @param {Function} processFunction 处理函数
   * @param {Object} options 配置选项
   * @returns {Promise<Array>} 处理结果
   */
  static async batchProcess(items, processFunction, options = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return [];
    }

    const {
      batchSize = 100,
      delay = 0,
      onProgress = null,
      abortSignal = null
    } = options;

    const results = [];
    const totalItems = items.length;
    let processedItems = 0;

    for (let i = 0; i < totalItems; i += batchSize) {
      // 检查是否已取消
      if (abortSignal && abortSignal.aborted) {
        throw new Error('批处理已取消');
      }

      const batchEnd = Math.min(i + batchSize, totalItems);
      const batch = items.slice(i, batchEnd);

      // 处理当前批次
      const batchResults = await processFunction(batch);
      results.push(...batchResults);

      // 更新进度
      processedItems += batch.length;
      if (typeof onProgress === 'function') {
        onProgress({
          processed: processedItems,
          total: totalItems,
          percentage: (processedItems / totalItems) * 100
        });
      }

      // 如果还有更多批次，添加延迟以避免阻塞UI
      if (batchEnd < totalItems && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * 异步迭代批处理器
   * @param {Array} items 待处理数据项
   * @param {number} batchSize 批处理大小
   * @yields {Array} 当前批次数据
   */
  static async *batchIterator(items, batchSize = 100) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const totalItems = items.length;

    for (let i = 0; i < totalItems; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, totalItems);
      const batch = items.slice(i, batchEnd);
      yield batch;

      // 微任务延迟，避免长时间阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

/**
 * IndexedDB流处理器 - 提供流式处理大量IndexedDB数据的方法
 */
class IndexedDBStreamProcessor {
  /**
   * 流式写入数据到IndexedDB
   * @param {IDBDatabase} db 数据库实例
   * @param {string} storeName 存储名称
   * @param {Array} items 数据项数组，每项包含{key, value}
   * @param {Object} options 配置选项
   * @returns {Promise<boolean>} 是否成功
   */
  static async streamWrite(db, storeName, items, options = {}) {
    if (!db || !storeName || !items || !Array.isArray(items)) {
      return false;
    }

    const {
      batchSize = 100,
      processingDelay = 0,
      onProgress = null,
      abortSignal = null
    } = options;

    try {
      let processed = 0;
      const total = items.length;

      // 使用BatchProcessor进行分批处理
      await BatchProcessor.batchProcess(
        items,
        async (batch) => {
          // 创建写入事务
          return new Promise((resolve, reject) => {
            try {
              const transaction = db.transaction([storeName], 'readwrite');
              const store = transaction.objectStore(storeName);

              transaction.oncomplete = () => resolve(batch);
              transaction.onerror = (event) => reject(event.target.error);

              // 将每个项目添加到存储中
              batch.forEach(item => {
                if (item && item.key !== undefined) {
                  store.put(item.value, item.key);
                }
              });
            } catch (error) {
              reject(error);
            }
          });
        },
        {
          batchSize,
          delay: processingDelay,
          onProgress: progressInfo => {
            processed = progressInfo.processed;
            if (typeof onProgress === 'function') {
              onProgress({
                processed,
                total,
                percentage: (processed / total) * 100
              });
            }
          },
          abortSignal
        }
      );

      return true;
    } catch (error) {
      console.error('流式写入失败:', error);
      return false;
    }
  }

  /**
   * 流式读取IndexedDB数据
   * @param {IDBDatabase} db 数据库实例
   * @param {string} storeName 存储名称
   * @param {Object} options 配置选项
   * @returns {Promise<Array>} 读取结果
   */
  static async streamRead(db, storeName, options = {}) {
    if (!db || !storeName) {
      return [];
    }

    const {
      keyRange = null,
      limit = 0,
      offset = 0,
      direction = 'next',
      onProgress = null,
      abortSignal = null,
      batchSize = 100
    } = options;

    try {
      return new Promise((resolve, reject) => {
        const results = [];
        let processed = 0;

        try {
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = keyRange ? store.openCursor(keyRange, direction) : store.openCursor(null, direction);

          // 跳过偏移量
          let skipped = 0;
          let currentBatch = [];

          request.onsuccess = (event) => {
            if (abortSignal && abortSignal.aborted) {
              transaction.abort();
              reject(new Error('流式读取已取消'));
              return;
            }

            const cursor = event.target.result;
            
            if (cursor) {
              // 处理偏移量
              if (skipped < offset) {
                skipped++;
                cursor.continue();
                return;
              }

              // 添加到结果中
              currentBatch.push({
                key: cursor.key,
                value: cursor.value
              });
              
              processed++;

              // 批次处理完成
              if (currentBatch.length >= batchSize) {
                results.push(...currentBatch);
                currentBatch = [];
                
                // 报告进度
                if (typeof onProgress === 'function') {
                  onProgress({
                    processed,
                    batchCompleted: true
                  });
                }
              }

              // 检查是否达到限制
              if (limit > 0 && processed >= limit) {
                // 添加剩余批次
                if (currentBatch.length > 0) {
                  results.push(...currentBatch);
                }
                
                // 报告最终进度
                if (typeof onProgress === 'function') {
                  onProgress({
                    processed,
                    completed: true
                  });
                }
                
                resolve(results);
                return;
              }

              // 继续下一个
              cursor.continue();
            } else {
              // 没有更多数据了
              // 添加剩余批次
              if (currentBatch.length > 0) {
                results.push(...currentBatch);
              }
              
              // 报告最终进度
              if (typeof onProgress === 'function') {
                onProgress({
                  processed,
                  completed: true
                });
              }
              
              resolve(results);
            }
          };

          request.onerror = (event) => reject(event.target.error);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('流式读取失败:', error);
      return [];
    }
  }
}

module.exports = {
  MemoryMonitor,
  BatchProcessor,
  IndexedDBStreamProcessor
}; 