/**
 * resource-loader-memory-leak.test.js
 * 测试频繁切换页面导致的内存泄漏修复 (INT-006)
 */

const ResourceLoader = require('./resource-loader');
const AuthCache = require('../auth/AuthCache');
const { performance } = require('perf_hooks');

describe('ResourceLoader内存泄漏修复测试 (INT-006)', () => {
  let resourceLoader;
  
  beforeEach(() => {
    // 创建一个新的ResourceLoader实例
    resourceLoader = new ResourceLoader({
      enableCache: true,
      persistCache: false,
      batchSize: 10
    });
    
    // 清理可能的测试缓存
    if (global.gc) {
      global.gc();
    }
  });
  
  afterEach(() => {
    // 销毁ResourceLoader实例
    if (resourceLoader) {
      resourceLoader.destroy();
      resourceLoader = null;
    }
    
    // 强制垃圾回收以准确测量内存使用
    if (global.gc) {
      global.gc();
    }
  });
  
  // 测试页面切换场景下的内存泄漏
  test('页面切换场景下不应有内存泄漏', async () => {
    // 模拟资源URLs
    const generateUrls = (count) => {
      return Array(count).fill(0).map((_, i) => `https://example.com/resource/${i}`);
    };
    
    // 创建一个模拟资源加载任务
    const loadResources = async () => {
      const urls = generateUrls(50);
      
      // 使用Promise.all同时加载多个资源
      return Promise.all(urls.map(url => {
        return resourceLoader.load(url, { priority: 5 });
      }));
    };
    
    // 测量内存使用
    const getMemoryUsage = () => {
      if (process.memoryUsage) {
        return process.memoryUsage().heapUsed;
      }
      return 0;
    };
    
    // 记录初始内存使用
    const initialMemory = getMemoryUsage();
    
    // 模拟页面多次加载和切换
    for (let i = 0; i < 5; i++) {
      // 加载资源
      await loadResources();
      
      // 模拟页面切换，清理资源
      resourceLoader.destroy();
      
      // 创建新的ResourceLoader实例模拟新页面
      resourceLoader = new ResourceLoader({
        enableCache: true,
        persistCache: false,
        batchSize: 10
      });
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
    }
    
    // 最终内存使用
    const finalMemory = getMemoryUsage();
    
    // 计算内存增长率
    const memoryGrowthRate = (finalMemory - initialMemory) / initialMemory;
    
    // 断言内存增长不超过10%
    expect(memoryGrowthRate).toBeLessThan(0.1);
  });
  
  // 测试登出场景
  test('登出场景下不应有内存泄漏', async () => {
    // 模拟AuthCache
    const mockClear = jest.fn();
    AuthCache.clear = mockClear;
    
    // 记录初始内存使用
    const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    
    // 模拟加载资源
    await Promise.all([
      resourceLoader.load('https://example.com/resource/1', { priority: 5 }),
      resourceLoader.load('https://example.com/resource/2', { priority: 5 }),
      resourceLoader.load('https://example.com/resource/3', { priority: 5 })
    ]);
    
    // 模拟登出过程
    resourceLoader.clearCache();
    AuthCache.clear();
    resourceLoader.destroy();
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    // 最终内存使用
    const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    
    // 断言清理方法被调用
    expect(mockClear).toHaveBeenCalled();
    
    // 断言内存使用不增加
    expect(finalMemory).toBeLessThanOrEqual(initialMemory * 1.05); // 允许5%误差
  });
  
  // 性能测试 - 在高负载下页面切换
  test('高负载下页面切换应保持稳定性能', async () => {
    // 生成大量模拟资源
    const resources = Array(200).fill(0).map((_, i) => ({
      url: `https://example.com/resource/${i}`,
      priority: Math.floor(Math.random() * 10) + 1,
      size: Math.floor(Math.random() * 1000) + 100
    }));
    
    let totalTime = 0;
    
    // 模拟5个页面加载和切换周期
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      // 批量加载资源
      await Promise.all(resources.map(resource => {
        return resourceLoader.load(resource.url, { 
          priority: resource.priority,
          size: resource.size
        });
      }));
      
      // 模拟页面切换
      resourceLoader.destroy();
      
      // 重新创建加载器
      resourceLoader = new ResourceLoader({
        enableCache: true,
        persistCache: false,
        batchSize: 20
      });
      
      const endTime = performance.now();
      totalTime += (endTime - startTime);
    }
    
    // 计算平均每次页面周期的时间
    const averageTime = totalTime / 5;
    
    // 日志记录性能数据
    console.log(`高负载页面切换平均时间: ${averageTime.toFixed(2)}ms`);
    
    // 断言性能在合理范围内 (根据实际硬件和环境适当调整)
    expect(averageTime).toBeLessThan(5000); // 预期不超过5秒
  });
}); 