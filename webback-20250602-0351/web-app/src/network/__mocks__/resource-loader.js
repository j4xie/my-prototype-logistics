// 模拟ResourceLoader类
const EVENTS = {
  LOAD_START: 'load:start',
  LOAD_COMPLETE: 'load:complete',
  LOAD_ERROR: 'load:error',
  QUEUE_COMPLETE: 'queue:complete',
  NETWORK_STATUS: 'network:status',
  CACHE_UPDATED: 'cache:updated',
  PERF_METRICS: 'perf:metrics'
};

class ResourceLoader {
  constructor(options = {}) {
    this.options = options;
    this.cache = new Map();
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = options.maxConcurrent || 5;
    this.eventListeners = {};
    this.resourceStats = new Map();
    this.batchSize = options.batchSize || 10;
  }

  loadResource(url, options = {}) {
    return Promise.resolve({ url, data: 'mock-data', size: 1024 });
  }

  loadBatch(urls, options = {}) {
    return Promise.all(urls.map(url => this.loadResource(url, options)));
  }

  setBatchSize(size) {
    this.batchSize = size;
    return this;
  }

  cleanupCompletedResources(keepCount) {
    // 模拟清理缓存的行为
    const cacheSize = this.cache.size;
    if (cacheSize <= keepCount) return;
    
    // 只保留指定数量的缓存项
    const keysToDelete = [...this.cache.keys()].slice(0, cacheSize - keepCount);
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  trimCache(keepCount) {
    this.cleanupCompletedResources(keepCount);
  }

  clearCache() {
    this.cache.clear();
    this.resourceStats.clear();
  }

  reset(preserveCache = false) {
    this.queue = [];
    this.activeRequests = 0;
    if (!preserveCache) {
      this.clearCache();
    }
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  // 模拟其他需要的方法
  pauseQueue() {}
  resumeQueue() {}
  getResourceStats() {
    return {
      totalLoaded: 0,
      averageLoadTime: 0,
      totalSize: 0,
      cacheHitRate: 0
    };
  }
}

module.exports = {
  ResourceLoader,
  EVENTS
}; 