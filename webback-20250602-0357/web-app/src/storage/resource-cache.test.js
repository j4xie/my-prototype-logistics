/**
 * 资源缓存管理类单元测试
 * 创建日期: 2025-07-17
 */

import { ResourceCache, RESOURCE_TYPES } from './resource-cache';
import StorageAbstraction from './storage-abstraction';

// 模拟依赖
jest.mock('./storage-abstraction');

describe('ResourceCache', () => {
  let resourceCache;
  let mockStorage;
  
  // 测试数据
  const testKey = 'test-resource';
  const testValue = { data: 'test-data' };
  const testImageKey = 'test-image.jpg';
  const testImageValue = 'base64encodedimagedata';
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建模拟存储实例的实现
    mockStorage = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockImplementation((key) => {
        if (key === `data:${testKey}`) return Promise.resolve(testValue);
        if (key === `meta:${testKey}`) return Promise.resolve({
          type: RESOURCE_TYPES.JSON,
          timestamp: Date.now(),
          size: 100,
          accessCount: 5,
          lastAccess: Date.now()
        });
        return Promise.resolve(null);
      }),
      remove: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([`meta:${testKey}`])
    };
    
    // 模拟 StorageAbstraction 构造函数返回我们的模拟实例
    StorageAbstraction.mockImplementation(() => mockStorage);
    
    // 创建资源缓存实例
    resourceCache = new ResourceCache({
      namespace: 'test-cache',
      defaultExpiry: 3600000 // 1小时
    });
  });
  
  describe('初始化', () => {
    test('应使用默认配置值初始化', () => {
      const defaultCache = new ResourceCache();
      expect(defaultCache.config.namespace).toBe('resource');
      expect(defaultCache.config.defaultExpiry).toBe(86400000); // 1天
      expect(defaultCache.config.maxMemoryCache).toBe(100);
      expect(defaultCache.config.persistToDisk).toBe(true);
    });
    
    test('应使用自定义配置值初始化', () => {
      const customCache = new ResourceCache({
        namespace: 'custom',
        defaultExpiry: 3600000,
        maxMemoryCache: 50,
        persistToDisk: false
      });
      
      expect(customCache.config.namespace).toBe('custom');
      expect(customCache.config.defaultExpiry).toBe(3600000);
      expect(customCache.config.maxMemoryCache).toBe(50);
      expect(customCache.config.persistToDisk).toBe(false);
    });
    
    test('应初始化存储抽象层', () => {
      expect(StorageAbstraction).toHaveBeenCalledWith({
        prefix: 'test-cache-',
        defaultExpiry: 3600000
      });
    });
  });
  
  describe('store()', () => {
    test('应成功存储资源', async () => {
      const result = await resourceCache.store(testKey, testValue);
      
      expect(result).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith(
        `data:${testKey}`,
        testValue,
        expect.any(Object)
      );
      
      // 验证元数据是否已存储
      expect(mockStorage.set).toHaveBeenCalledWith(
        `meta:${testKey}`,
        expect.objectContaining({
          type: RESOURCE_TYPES.JSON,
          timestamp: expect.any(Number),
          size: expect.any(Number),
          accessCount: 0,
          lastAccess: expect.any(Number)
        }),
        expect.any(Object)
      );
      
      // 验证内存缓存是否已更新
      expect(resourceCache._memoryCache.get(testKey)).toBe(testValue);
    });
    
    test('应正确检测资源类型', async () => {
      await resourceCache.store(testImageKey, testImageValue);
      
      expect(mockStorage.set).toHaveBeenCalledWith(
        `meta:${testImageKey}`,
        expect.objectContaining({
          type: RESOURCE_TYPES.IMAGE
        }),
        expect.any(Object)
      );
    });
    
    test('当持久化存储禁用时应只存储到内存', async () => {
      resourceCache.config.persistToDisk = false;
      const result = await resourceCache.store(testKey, testValue);
      
      expect(result).toBe(true);
      expect(mockStorage.set).not.toHaveBeenCalled();
      expect(resourceCache._memoryCache.get(testKey)).toBe(testValue);
    });
    
    test('当内存缓存已满时应移除最少使用的项', async () => {
      // 设置小内存限制
      resourceCache.config.maxMemoryCache = 2;
      
      // 存储三个项目
      await resourceCache.store('item1', 'value1');
      
      // 模拟元数据
      resourceCache._metadata.set('item1', { accessCount: 5 });
      
      await resourceCache.store('item2', 'value2');
      resourceCache._metadata.set('item2', { accessCount: 10 });
      
      await resourceCache.store('item3', 'value3');
      
      // 应移除访问计数最低的项目 (item1)
      expect(resourceCache._memoryCache.has('item1')).toBe(false);
      expect(resourceCache._memoryCache.has('item2')).toBe(true);
      expect(resourceCache._memoryCache.has('item3')).toBe(true);
    });
  });
  
  describe('get()', () => {
    test('应从内存缓存中获取资源', async () => {
      // 先存储到内存缓存
      resourceCache._memoryCache.set(testKey, testValue);
      resourceCache._metadata.set(testKey, { accessCount: 0, lastAccess: 0 });
      
      const result = await resourceCache.get(testKey);
      
      expect(result).toBe(testValue);
      expect(mockStorage.get).not.toHaveBeenCalled(); // 不应查询持久化存储
      expect(resourceCache._metadata.get(testKey).accessCount).toBe(1); // 应增加访问计数
    });
    
    test('当内存中不存在时应从持久化存储中获取', async () => {
      const result = await resourceCache.get(testKey);
      
      expect(result).toBe(testValue);
      expect(mockStorage.get).toHaveBeenCalledWith(`data:${testKey}`);
      
      // 应将结果加载到内存缓存
      expect(resourceCache._memoryCache.get(testKey)).toBe(testValue);
    });
    
    test('当资源不存在时应引发错误', async () => {
      mockStorage.get.mockResolvedValue(null);
      
      await expect(resourceCache.get('non-existent')).rejects.toThrow('资源未找到');
      expect(resourceCache._stats.misses).toBe(1);
    });
    
    test('当noThrow选项设为true且资源不存在时应返回null', async () => {
      mockStorage.get.mockResolvedValue(null);
      
      const result = await resourceCache.get('non-existent', { noThrow: true });
      
      expect(result).toBeNull();
      expect(resourceCache._stats.misses).toBe(1);
    });
  });
  
  describe('has()', () => {
    test('当资源在内存缓存中时应返回true', async () => {
      resourceCache._memoryCache.set(testKey, testValue);
      
      const result = await resourceCache.has(testKey);
      
      expect(result).toBe(true);
      expect(mockStorage.get).not.toHaveBeenCalled();
    });
    
    test('当资源在持久化存储中时应返回true', async () => {
      const result = await resourceCache.has(testKey);
      
      expect(result).toBe(true);
      expect(mockStorage.get).toHaveBeenCalledWith(`data:${testKey}`);
    });
    
    test('当资源不存在时应返回false', async () => {
      mockStorage.get.mockResolvedValue(null);
      
      const result = await resourceCache.has('non-existent');
      
      expect(result).toBe(false);
    });
  });
  
  describe('remove()', () => {
    test('应从内存和持久化存储中移除资源', async () => {
      // 先添加到内存
      resourceCache._memoryCache.set(testKey, testValue);
      resourceCache._metadata.set(testKey, { accessCount: 1 });
      
      const result = await resourceCache.remove(testKey);
      
      expect(result).toBe(true);
      expect(resourceCache._memoryCache.has(testKey)).toBe(false);
      expect(resourceCache._metadata.has(testKey)).toBe(false);
      
      // 验证从持久化存储中移除
      expect(mockStorage.remove).toHaveBeenCalledWith(`data:${testKey}`);
      expect(mockStorage.remove).toHaveBeenCalledWith(`meta:${testKey}`);
    });
  });
  
  describe('clear()', () => {
    test('应清除所有内存和持久化存储', async () => {
      // 先添加一些数据到内存
      resourceCache._memoryCache.set(testKey, testValue);
      resourceCache._metadata.set(testKey, { accessCount: 1 });
      
      // 记录初始统计数据
      resourceCache._stats.hits = 5;
      
      const result = await resourceCache.clear();
      
      expect(result).toBe(true);
      expect(resourceCache._memoryCache.size).toBe(0);
      expect(resourceCache._metadata.size).toBe(0);
      expect(mockStorage.clear).toHaveBeenCalled();
      
      // 验证统计数据已重置
      expect(resourceCache._stats.hits).toBe(0);
    });
  });
  
  describe('getStats()', () => {
    test('应返回当前统计信息', () => {
      // 设置一些测试统计数据
      resourceCache._stats.hits = 10;
      resourceCache._stats.misses = 5;
      resourceCache._memoryCache.set('key1', 'value1');
      resourceCache._metadata.set('key1', {});
      
      const stats = resourceCache.getStats();
      
      expect(stats).toEqual({
        hits: 10,
        misses: 5,
        stored: 0,
        evicted: 0,
        errors: 0,
        memoryItems: 1,
        metadataItems: 1
      });
    });
  });
  
  describe('_cleanExpiredResources()', () => {
    test('应移除过期的元数据', async () => {
      // 模拟发现过期资源的情况
      mockStorage.keys.mockResolvedValue(['meta:expired-key']);
      mockStorage.get.mockImplementation(key => {
        if (key === 'data:expired-key') return Promise.resolve(null); // 数据不存在
        return Promise.resolve(null);
      });
      
      const cleanedCount = await resourceCache._cleanExpiredResources();
      
      expect(cleanedCount).toBe(1);
      expect(mockStorage.remove).toHaveBeenCalledWith('meta:expired-key');
    });
  });
  
  describe('_estimateSize()', () => {
    test('应估算字符串大小', () => {
      const str = 'hello world';
      const size = resourceCache._estimateSize(str);
      expect(size).toBe(str.length * 2); // UTF-16编码
    });
    
    test('应估算对象大小', () => {
      const obj = { name: 'test', value: 123 };
      const size = resourceCache._estimateSize(obj);
      expect(size).toBeGreaterThan(0);
    });
    
    test('应估算数组大小', () => {
      const arr = [1, 2, 3, 4, 5];
      const size = resourceCache._estimateSize(arr);
      expect(size).toBeGreaterThan(0);
    });
    
    test('应处理特殊类型', () => {
      expect(resourceCache._estimateSize(null)).toBe(0);
      expect(resourceCache._estimateSize(undefined)).toBe(0);
      expect(resourceCache._estimateSize(123)).toBe(8);
      expect(resourceCache._estimateSize(true)).toBe(4);
    });
  });
  
  describe('_detectResourceType()', () => {
    test('应基于文件扩展名检测图片类型', () => {
      expect(resourceCache._detectResourceType('image.jpg', 'data')).toBe(RESOURCE_TYPES.IMAGE);
      expect(resourceCache._detectResourceType('image.png', 'data')).toBe(RESOURCE_TYPES.IMAGE);
      expect(resourceCache._detectResourceType('image.gif', 'data')).toBe(RESOURCE_TYPES.IMAGE);
      expect(resourceCache._detectResourceType('image.webp', 'data')).toBe(RESOURCE_TYPES.IMAGE);
    });
    
    test('应基于文件扩展名检测脚本类型', () => {
      expect(resourceCache._detectResourceType('script.js', 'data')).toBe(RESOURCE_TYPES.SCRIPT);
    });
    
    test('应基于文件扩展名检测样式表类型', () => {
      expect(resourceCache._detectResourceType('style.css', 'data')).toBe(RESOURCE_TYPES.STYLE);
    });
    
    test('应基于文件扩展名检测JSON类型', () => {
      expect(resourceCache._detectResourceType('data.json', 'data')).toBe(RESOURCE_TYPES.JSON);
    });
    
    test('应基于值类型检测JSON类型', () => {
      expect(resourceCache._detectResourceType('data', {})).toBe(RESOURCE_TYPES.JSON);
      expect(resourceCache._detectResourceType('data', [])).toBe(RESOURCE_TYPES.JSON);
    });
    
    test('对于未知类型应返回DATA类型', () => {
      expect(resourceCache._detectResourceType('unknown', 'data')).toBe(RESOURCE_TYPES.DATA);
    });
  });
}); 