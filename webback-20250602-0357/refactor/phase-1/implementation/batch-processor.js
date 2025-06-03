/**
 * 批量数据处理工具
 * 用于解决大数据量处理时的超时问题(BUG-004)
 * 
 * 功能特点：
 * 1. 自动将大批量数据拆分为小批次处理，避免阻塞UI和超时
 * 2. 支持进度跟踪和状态报告
 * 3. 支持暂停、恢复和取消操作
 * 4. 内置错误处理和重试机制
 * 5. 优化内存使用，避免内存泄漏
 */

/**
 * 批处理配置选项接口
 * @typedef {Object} BatchProcessorOptions
 * @property {number} batchSize - 每批处理的数据量，默认100
 * @property {number} batchDelay - 批次间延迟(ms)，默认0
 * @property {number} maxRetries - 失败时最大重试次数，默认3
 * @property {number} retryDelay - 重试前等待时间(ms)，默认1000
 * @property {Function} onProgress - 进度回调函数(progress, stats)
 * @property {Function} onBatchComplete - 单批次完成回调(batchResults, batchIndex)
 * @property {Function} onComplete - 全部完成回调(results)
 * @property {Function} onError - 错误处理回调(error, retry, skip)
 */

/**
 * 批处理统计信息接口
 * @typedef {Object} BatchProcessorStats
 * @property {number} total - 总数据条数
 * @property {number} processed - 已处理数据条数
 * @property {number} successful - 成功处理条数
 * @property {number} failed - 失败条数
 * @property {number} skipped - 跳过条数
 * @property {number} batches - 总批次数
 * @property {number} completedBatches - 已完成批次数
 * @property {number} currentBatch - 当前批次索引
 * @property {number} retries - 重试次数
 * @property {Date} startTime - 开始时间
 * @property {number} elapsedTime - 已用时间(ms)
 * @property {number} estimatedTimeRemaining - 预估剩余时间(ms)
 */

class BatchProcessor {
  /**
   * 创建批处理器实例
   * @param {Array} items - 需处理的数据项数组
   * @param {Function} processFn - 处理单个数据项的函数
   * @param {BatchProcessorOptions} options - 批处理配置选项
   */
  constructor(items, processFn, options = {}) {
    this.items = Array.isArray(items) ? items : [];
    this.processFn = processFn;
    
    // 默认选项
    this.options = {
      batchSize: 100,
      batchDelay: 0,
      maxRetries: 3,
      retryDelay: 1000,
      onProgress: () => {},
      onBatchComplete: () => {},
      onComplete: () => {},
      onError: () => {},
      ...options
    };
    
    // 内部状态
    this.state = {
      status: 'idle', // idle, running, paused, completed, error
      results: [],
      stats: {
        total: this.items.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        batches: Math.ceil(this.items.length / this.options.batchSize),
        completedBatches: 0,
        currentBatch: 0,
        retries: 0,
        startTime: null,
        elapsedTime: 0,
        estimatedTimeRemaining: 0
      },
      currentBatchIndex: 0,
      currentItemIndex: 0,
      pauseRequested: false,
      cancelRequested: false,
      error: null,
      batchPromise: null,
      timeoutId: null
    };
  }
  
  /**
   * 开始批处理
   * @returns {Promise} 处理完成后的Promise
   */
  async start() {
    if (this.state.status === 'running') {
      return Promise.reject(new Error('BatchProcessor is already running'));
    }
    
    this.state.status = 'running';
    this.state.stats.startTime = new Date();
    this.state.results = new Array(this.items.length);
    this.state.currentBatchIndex = 0;
    this.state.currentItemIndex = 0;
    
    return this._processBatches();
  }
  
  /**
   * 暂停处理
   * @returns {Promise} 暂停完成后的Promise
   */
  async pause() {
    if (this.state.status !== 'running') {
      return Promise.resolve();
    }
    
    this.state.pauseRequested = true;
    return new Promise(resolve => {
      const checkPaused = () => {
        if (this.state.status === 'paused') {
          resolve();
        } else {
          setTimeout(checkPaused, 100);
        }
      };
      checkPaused();
    });
  }
  
  /**
   * 恢复处理
   * @returns {Promise} 处理完成后的Promise
   */
  async resume() {
    if (this.state.status !== 'paused') {
      return Promise.resolve();
    }
    
    this.state.pauseRequested = false;
    this.state.status = 'running';
    return this._processBatches();
  }
  
  /**
   * 取消处理
   * @returns {Promise} 取消完成后的Promise
   */
  async cancel() {
    this.state.cancelRequested = true;
    
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }
    
    return new Promise(resolve => {
      const checkCancelled = () => {
        if (this.state.status !== 'running') {
          this.state.status = 'idle';
          resolve();
        } else {
          setTimeout(checkCancelled, 100);
        }
      };
      checkCancelled();
    });
  }
  
  /**
   * 获取当前处理统计信息
   * @returns {BatchProcessorStats} 统计信息
   */
  getStats() {
    // 更新已用时间和预估剩余时间
    if (this.state.stats.startTime) {
      const now = new Date();
      this.state.stats.elapsedTime = now - this.state.stats.startTime;
      
      if (this.state.stats.processed > 0) {
        const timePerItem = this.state.stats.elapsedTime / this.state.stats.processed;
        const remainingItems = this.state.stats.total - this.state.stats.processed;
        this.state.stats.estimatedTimeRemaining = Math.round(timePerItem * remainingItems);
      }
    }
    
    return { ...this.state.stats };
  }
  
  /**
   * 内部方法：处理所有批次
   * @private
   * @returns {Promise} 处理完成后的Promise
   */
  async _processBatches() {
    try {
      while (
        this.state.currentBatchIndex < Math.ceil(this.items.length / this.options.batchSize) &&
        !this.state.cancelRequested
      ) {
        if (this.state.pauseRequested) {
          this.state.status = 'paused';
          return;
        }
        
        const batchStartIndex = this.state.currentBatchIndex * this.options.batchSize;
        const batchEndIndex = Math.min(batchStartIndex + this.options.batchSize, this.items.length);
        const currentBatch = this.items.slice(batchStartIndex, batchEndIndex);
        
        this.state.stats.currentBatch = this.state.currentBatchIndex + 1;
        
        try {
          // 处理当前批次
          const batchResults = await this._processBatch(currentBatch, batchStartIndex);
          
          // 更新结果
          for (let i = 0; i < batchResults.length; i++) {
            const resultIndex = batchStartIndex + i;
            this.state.results[resultIndex] = batchResults[i];
          }
          
          this.state.stats.completedBatches++;
          this.state.currentBatchIndex++;
          
          // 调用批次完成回调
          this.options.onBatchComplete(batchResults, this.state.currentBatchIndex - 1);
          
          // 批次间延迟
          if (this.options.batchDelay > 0 && this.state.currentBatchIndex < Math.ceil(this.items.length / this.options.batchSize)) {
            await new Promise(resolve => {
              this.state.timeoutId = setTimeout(resolve, this.options.batchDelay);
            });
          }
        } catch (error) {
          this.state.error = error;
          throw error;
        }
      }
      
      if (this.state.cancelRequested) {
        return this.state.results;
      }
      
      this.state.status = 'completed';
      this.options.onComplete(this.state.results);
      return this.state.results;
    } catch (error) {
      this.state.status = 'error';
      throw error;
    }
  }
  
  /**
   * 内部方法：处理单个批次
   * @private
   * @param {Array} batch - 当前批次数据
   * @param {number} batchStartIndex - 批次起始索引
   * @returns {Promise<Array>} 批次处理结果
   */
  async _processBatch(batch, batchStartIndex) {
    const batchResults = new Array(batch.length);
    
    // 并行处理每个数据项
    const promises = batch.map(async (item, index) => {
      const globalIndex = batchStartIndex + index;
      let retryCount = 0;
      
      while (retryCount <= this.options.maxRetries) {
        try {
          if (this.state.cancelRequested) {
            batchResults[index] = { status: 'cancelled', data: null, error: null };
            return;
          }
          
          // 处理单个数据项
          const result = await this.processFn(item, globalIndex);
          
          // 更新结果和统计信息
          batchResults[index] = { status: 'success', data: result, error: null };
          this.state.stats.processed++;
          this.state.stats.successful++;
          
          // 更新进度
          this._updateProgress();
          
          return;
        } catch (error) {
          retryCount++;
          this.state.stats.retries++;
          
          // 如果达到最大重试次数，标记为失败
          if (retryCount > this.options.maxRetries) {
            batchResults[index] = { status: 'error', data: null, error };
            this.state.stats.processed++;
            this.state.stats.failed++;
            
            // 调用错误处理回调
            const shouldSkip = await new Promise(resolve => {
              const retry = () => resolve(false);
              const skip = () => resolve(true);
              this.options.onError(error, retry, skip);
            });
            
            if (shouldSkip) {
              batchResults[index] = { status: 'skipped', data: null, error };
              this.state.stats.skipped++;
            } else {
              // 如果不跳过，继续重试
              retryCount--;
            }
          } else {
            // 等待一段时间后重试
            await new Promise(resolve => {
              setTimeout(resolve, this.options.retryDelay);
            });
          }
        }
      }
    });
    
    await Promise.all(promises);
    return batchResults;
  }
  
  /**
   * 内部方法：更新进度
   * @private
   */
  _updateProgress() {
    const progress = this.state.stats.total > 0 
      ? this.state.stats.processed / this.state.stats.total 
      : 0;
    
    this.options.onProgress(progress, this.getStats());
  }
}

// 导出批处理器
module.exports = BatchProcessor;

// 使用示例
/*
const processor = new BatchProcessor(
  largeDataArray,
  async (item, index) => {
    // 处理单个数据项的逻辑
    return processedItem;
  },
  {
    batchSize: 50,
    batchDelay: 100,
    onProgress: (progress, stats) => {
      console.log(`Progress: ${Math.round(progress * 100)}%`);
      console.log(`Estimated time remaining: ${Math.round(stats.estimatedTimeRemaining / 1000)} seconds`);
    },
    onComplete: (results) => {
      console.log(`Processing complete. ${results.length} items processed.`);
    },
    onError: (error, retry, skip) => {
      console.error(`Error processing item: ${error.message}`);
      if (error.retryable) {
        retry();
      } else {
        skip();
      }
    }
  }
);

// 开始处理
processor.start().then(results => {
  console.log('All items processed successfully');
}).catch(error => {
  console.error('Processing failed', error);
});

// 可以在其他地方调用这些方法
// processor.pause();
// processor.resume();
// processor.cancel();
*/ 