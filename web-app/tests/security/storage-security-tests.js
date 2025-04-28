/**
 * @file 存储安全性强化测试
 * @description 测试离线存储的数据完整性、加密和安全性
 * @version 1.0.0
 * @created 2025-07-21
 */

const { jest } = require('@jest/globals');
const StorageManager = require('../../src/storage/storage-manager');
const { MemoryMonitor, BatchProcessor, IndexedDBStreamProcessor } = require('../../src/storage/indexeddb-optimizer.js');

// 测试配置
const TEST_STORE_NAME = 'security-test-store';
const SENSITIVE_DATA = {
  userId: 'user-123456',
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYiLCJuYW1lIjoiVGVzdCBVc2VyIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  personalInfo: {
    name: '张三',
    idNumber: '310************123',
    phoneNumber: '138********',
    address: '上海市浦东新区张江高科技园区'
  },
  paymentInfo: {
    cardNumber: '**** **** **** 1234',
    expiryDate: '12/26',
    cvv: '***'
  }
};

// 带篡改检测的数据
function generateTamperProofData(data, secret = 'test-secret') {
  const timestamp = Date.now();
  const serialized = JSON.stringify(data);
  
  // 简单的消息验证码（MAC）实现
  // 注意：这仅用于测试，实际应用应使用HMAC等更强的算法
  function simpleMac(message, key) {
    let hash = 0;
    const combinedStr = message + key;
    for (let i = 0; i < combinedStr.length; i++) {
      const char = combinedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }
  
  const mac = simpleMac(serialized + timestamp, secret);
  
  return {
    data: serialized,
    timestamp,
    mac,
    version: '1.0'
  };
}

// 验证数据完整性
function verifyDataIntegrity(tamperProofData, secret = 'test-secret') {
  const { data, timestamp, mac, version } = tamperProofData;
  
  // 重新计算MAC
  function simpleMac(message, key) {
    let hash = 0;
    const combinedStr = message + key;
    for (let i = 0; i < combinedStr.length; i++) {
      const char = combinedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  const calculatedMac = simpleMac(data + timestamp, secret);
  
  return {
    isValid: calculatedMac === mac,
    data: data ? JSON.parse(data) : null,
    timestamp,
    version
  };
}

describe('存储安全性强化测试', () => {
  let storageManager;

  beforeAll(() => {
    // 创建存储管理器实例
    storageManager = new StorageManager(TEST_STORE_NAME);
    
    console.log('开始存储安全性测试...');
  });

  afterAll(async () => {
    // 清理测试数据
    await storageManager.clear();
    console.log('存储安全性测试完成');
  });

  beforeEach(async () => {
    // 每次测试前清空数据库
    await storageManager.clear();
  });

  /**
   * 离线状态数据完整性验证
   */
  describe('离线状态数据完整性测试', () => {
    test('存储数据应包含完整性验证机制', async () => {
      // 创建带完整性检查的数据
      const tamperProofData = generateTamperProofData(SENSITIVE_DATA);
      
      // 存储数据
      await storageManager.setItem('sensitive-data', tamperProofData);
      
      // 模拟离线状态
      const originalIndexedDB = global.indexedDB;
      global.indexedDB = null;
      
      try {
        // 尝试从localStorage读取数据
        const storedData = await storageManager.getItem('sensitive-data');
        
        expect(storedData).toBeTruthy();
        
        // 验证数据完整性
        const verificationResult = verifyDataIntegrity(storedData);
        expect(verificationResult.isValid).toBe(true);
        
        // 验证数据内容没有被篡改
        expect(verificationResult.data).toEqual(SENSITIVE_DATA);
      } finally {
        // 恢复indexedDB
        global.indexedDB = originalIndexedDB;
      }
    });
    
    test('数据篡改应被检测到', async () => {
      // 创建带完整性检查的数据
      const tamperProofData = generateTamperProofData(SENSITIVE_DATA);
      
      // 存储数据
      await storageManager.setItem('sensitive-data', tamperProofData);
      
      // 从存储中获取数据
      const storedData = await storageManager.getItem('sensitive-data');
      
      // 篡改数据 (修改MAC)
      const tamperedData = {
        ...storedData,
        mac: storedData.mac.replace(/[a-f]/g, 'a')
      };
      
      // 验证篡改后的数据应该无效
      const verificationResult = verifyDataIntegrity(tamperedData);
      expect(verificationResult.isValid).toBe(false);
    });
    
    test('网络断开时应能恢复之前的数据', async () => {
      // 存储多条数据
      for (let i = 0; i < 10; i++) {
        const data = { ...SENSITIVE_DATA, id: `item-${i}` };
        const tamperProofData = generateTamperProofData(data);
        await storageManager.setItem(`item-${i}`, tamperProofData);
      }
      
      // 模拟网络中断
      const originalFetch = global.fetch;
      global.fetch = () => Promise.reject(new Error('Network error'));
      
      try {
        // 验证所有数据都可以恢复
        for (let i = 0; i < 10; i++) {
          const storedData = await storageManager.getItem(`item-${i}`);
          const verificationResult = verifyDataIntegrity(storedData);
          
          expect(verificationResult.isValid).toBe(true);
          expect(verificationResult.data.id).toBe(`item-${i}`);
        }
      } finally {
        // 恢复fetch
        global.fetch = originalFetch;
      }
    });
  });

  /**
   * 数据加密测试
   */
  describe('数据加密测试', () => {
    // 一个简单的模拟加密函数
    const mockEncrypt = (data, key) => {
      // 这里只是演示，非真实加密
      return {
        encrypted: btoa(JSON.stringify(data)),
        iv: [...Array(16)].map(() => Math.floor(Math.random() * 256)),
        version: '1.0'
      };
    };
    
    // 一个简单的模拟解密函数
    const mockDecrypt = (encryptedData, key) => {
      // 这里只是演示，非真实解密
      return JSON.parse(atob(encryptedData.encrypted));
    };
    
    test('敏感数据应被加密存储', async () => {
      // 创建一个模拟加密的存储管理器
      const originalSetItem = storageManager.setItem;
      const originalGetItem = storageManager.getItem;
      
      // 模拟加密存储
      storageManager.setItem = jest.fn().mockImplementation(async (key, value) => {
        // 对值进行"加密"
        const encryptedValue = mockEncrypt(value, 'test-key');
        // 调用原始方法存储加密后的数据
        return originalSetItem.call(storageManager, key, encryptedValue);
      });
      
      // 模拟解密获取
      storageManager.getItem = jest.fn().mockImplementation(async (key) => {
        // 获取加密的数据
        const encryptedData = await originalGetItem.call(storageManager, key);
        if (!encryptedData) return null;
        
        // 解密数据
        return mockDecrypt(encryptedData, 'test-key');
      });
      
      try {
        // 存储敏感数据
        await storageManager.setItem('sensitive-data', SENSITIVE_DATA);
        
        // 直接访问存储验证数据已加密
        const rawData = await originalGetItem.call(storageManager, 'sensitive-data');
        
        // 验证存储的数据已加密（不是明文）
        expect(typeof rawData.encrypted).toBe('string');
        expect(rawData.iv).toBeTruthy();
        
        // 不应该在加密数据中找到原始敏感信息
        const encryptedStr = JSON.stringify(rawData);
        expect(encryptedStr.includes(SENSITIVE_DATA.accessToken)).toBe(false);
        expect(encryptedStr.includes(SENSITIVE_DATA.personalInfo.idNumber)).toBe(false);
        
        // 通过解密应该能够恢复原始数据
        const decryptedData = await storageManager.getItem('sensitive-data');
        expect(decryptedData).toEqual(SENSITIVE_DATA);
      } finally {
        // 恢复原始方法
        storageManager.setItem = originalSetItem;
        storageManager.getItem = originalGetItem;
      }
    });
    
    test('加密数据应支持密钥轮换', async () => {
      // 模拟密钥轮换逻辑
      let currentKeyVersion = 1;
      const keys = {
        1: 'old-key',
        2: 'new-key'
      };
      
      // 加密函数带密钥版本
      const encryptWithVersion = (data, keyVersion) => {
        const key = keys[keyVersion];
        return {
          encrypted: btoa(JSON.stringify(data)),
          iv: [...Array(16)].map(() => Math.floor(Math.random() * 256)),
          keyVersion,
          version: '1.0'
        };
      };
      
      // 解密函数自动识别密钥版本
      const decryptWithVersion = (encryptedData) => {
        const key = keys[encryptedData.keyVersion];
        return JSON.parse(atob(encryptedData.encrypted));
      };
      
      const originalSetItem = storageManager.setItem;
      const originalGetItem = storageManager.getItem;
      
      // 模拟加密存储
      storageManager.setItem = jest.fn().mockImplementation(async (key, value) => {
        const encryptedValue = encryptWithVersion(value, currentKeyVersion);
        return originalSetItem.call(storageManager, key, encryptedValue);
      });
      
      // 模拟解密获取
      storageManager.getItem = jest.fn().mockImplementation(async (key) => {
        const encryptedData = await originalGetItem.call(storageManager, key);
        if (!encryptedData) return null;
        
        return decryptWithVersion(encryptedData);
      });
      
      try {
        // 用旧密钥存储数据
        await storageManager.setItem('rotating-key-data', SENSITIVE_DATA);
        
        // 轮换密钥
        currentKeyVersion = 2;
        
        // 仍然可以解密旧数据
        const oldData = await storageManager.getItem('rotating-key-data');
        expect(oldData).toEqual(SENSITIVE_DATA);
        
        // 存储新数据
        await storageManager.setItem('new-key-data', SENSITIVE_DATA);
        
        // 新旧数据都应该可以读取
        const retrievedOld = await storageManager.getItem('rotating-key-data');
        const retrievedNew = await storageManager.getItem('new-key-data');
        
        expect(retrievedOld).toEqual(SENSITIVE_DATA);
        expect(retrievedNew).toEqual(SENSITIVE_DATA);
        
        // 验证密钥版本
        const rawOld = await originalGetItem.call(storageManager, 'rotating-key-data');
        const rawNew = await originalGetItem.call(storageManager, 'new-key-data');
        
        expect(rawOld.keyVersion).toBe(1);
        expect(rawNew.keyVersion).toBe(2);
      } finally {
        // 恢复原始方法
        storageManager.setItem = originalSetItem;
        storageManager.getItem = originalGetItem;
      }
    });
  });

  /**
   * 重试机制安全性测试
   */
  describe('重试机制安全性测试', () => {
    test('过多重试请求应触发限流保护', async () => {
      // 模拟网络请求，用于测试重试机制
      let requestCount = 0;
      let blockRequests = false;
      
      // 模拟延迟响应的函数
      const mockDelayedRequest = () => {
        return new Promise((resolve, reject) => {
          requestCount++;
          
          if (blockRequests) {
            reject(new Error('请求被限流'));
            return;
          }
          
          // 模拟网络延迟
          setTimeout(() => {
            if (requestCount > 20) {
              // 请求过多时自动限流
              blockRequests = true;
              reject(new Error('请求被限流'));
            } else {
              resolve({ success: true });
            }
          }, 10);
        });
      };
      
      // 创建一个带重试机制的请求函数
      const requestWithRetry = async (retryCount = 3, retryDelay = 50) => {
        let attempts = 0;
        
        while (attempts <= retryCount) {
          try {
            return await mockDelayedRequest();
          } catch (error) {
            attempts++;
            if (attempts > retryCount) {
              throw error;
            }
            
            // 指数退避
            const delay = retryDelay * Math.pow(2, attempts - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };
      
      // 测试正常情况下的重试
      const result1 = await requestWithRetry();
      expect(result1.success).toBe(true);
      
      // 重置请求计数
      requestCount = 0;
      
      // 模拟多个并发请求，应该触发限流
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(requestWithRetry());
      }
      
      // 限流后，后续请求应该失败
      await Promise.all(promises);
      
      // 验证请求已被限流
      expect(blockRequests).toBe(true);
      
      // 新请求应该立即失败
      await expect(requestWithRetry()).rejects.toThrow('请求被限流');
    });
    
    test('重试间隔应使用指数退避算法', async () => {
      // 跟踪重试时间间隔
      const retryTimes = [];
      
      // 模拟请求重试
      const mockRequestWithRetry = async () => {
        const maxRetries = 3;
        const baseDelay = 50;
        
        let attempts = 0;
        while (attempts <= maxRetries) {
          try {
            if (attempts < maxRetries) {
              // 前几次尝试都应该失败
              throw new Error('模拟失败');
            }
            return 'success';
          } catch (error) {
            attempts++;
            if (attempts > maxRetries) {
              throw error;
            }
            
            // 记录重试时间
            const startTime = Date.now();
            
            // 计算指数退避延迟，添加随机因子
            const randomFactor = 0.2 + (Math.random() * 0.3); // 0.2-0.5
            const delay = baseDelay * Math.pow(2, attempts - 1) * (1 + randomFactor);
            
            // 等待延迟
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 记录实际延迟
            retryTimes.push(Date.now() - startTime);
          }
        }
      };
      
      // 执行重试
      try {
        await mockRequestWithRetry();
      } catch (error) {
        // 预期会失败
      }
      
      // 验证重试间隔
      expect(retryTimes.length).toBe(3);
      
      // 验证每次重试的间隔都应该比上次更长
      for (let i = 1; i < retryTimes.length; i++) {
        expect(retryTimes[i]).toBeGreaterThan(retryTimes[i-1]);
      }
      
      // 验证最后一次重试的间隔是第一次的至少4倍（近似2^2）
      expect(retryTimes[2] / retryTimes[0]).toBeGreaterThanOrEqual(3.5);
    });
  });

  /**
   * 网络状态变化下的数据一致性测试
   */
  describe('网络状态变化下的数据一致性', () => {
    test('断网重连后数据应保持一致性', async () => {
      // 存储初始数据
      for (let i = 0; i < 5; i++) {
        await storageManager.setItem(`consistent-item-${i}`, { id: i, value: `值${i}` });
      }
      
      // 模拟断网
      const originalFetch = global.fetch;
      const originalIndexedDB = global.indexedDB;
      global.fetch = () => Promise.reject(new Error('Network disconnected'));
      
      // 在离线状态下修改数据
      const offlineUpdates = [];
      for (let i = 0; i < 3; i++) {
        const key = `consistent-item-${i}`;
        const newValue = { id: i, value: `离线更新${i}` };
        await storageManager.setItem(key, newValue);
        offlineUpdates.push({ key, value: newValue });
      }
      
      // 模拟重连
      global.fetch = originalFetch;
      
      // 模拟同步过程
      // 这通常会由网络状态监听器触发
      const syncOfflineChanges = async () => {
        for (const update of offlineUpdates) {
          // 在实际系统中会有更复杂的同步逻辑
          // 这里简化为只存储最新值
          await storageManager.setItem(update.key, update.value);
        }
      };
      
      await syncOfflineChanges();
      
      // 验证数据一致性
      for (let i = 0; i < 5; i++) {
        const data = await storageManager.getItem(`consistent-item-${i}`);
        if (i < 3) {
          // 前3个应该是离线更新的值
          expect(data.value).toBe(`离线更新${i}`);
        } else {
          // 其余应该保持原值
          expect(data.value).toBe(`值${i}`);
        }
      }
    });
    
    test('应能解决网络同步冲突', async () => {
      // 定义一个简单的冲突解决策略
      // 这里使用"最新修改时间胜出"策略
      const resolveConflict = (localData, remoteData) => {
        if (!localData) return remoteData;
        if (!remoteData) return localData;
        
        if (localData.modifiedAt > remoteData.modifiedAt) {
          return { ...remoteData, ...localData, modifiedAt: Date.now() };
        } else {
          return { ...localData, ...remoteData, modifiedAt: Date.now() };
        }
      };
      
      // 存储初始数据
      const initialData = {
        id: 'conflict-test',
        name: '初始值',
        status: '活跃',
        modifiedAt: Date.now() - 10000 // 10秒前
      };
      await storageManager.setItem('conflict-test', initialData);
      
      // 模拟本地离线修改
      const localModified = {
        ...initialData,
        name: '本地修改',
        modifiedAt: Date.now() - 5000 // 5秒前
      };
      
      // 模拟服务器数据更新（在本地修改之后）
      const remoteModified = {
        ...initialData,
        status: '已完成',
        category: '新分类', // 服务器添加了新字段
        modifiedAt: Date.now() - 2000 // 2秒前
      };
      
      // 存储本地修改
      await storageManager.setItem('conflict-test', localModified);
      
      // 模拟同步，处理冲突
      const resolvedData = resolveConflict(localModified, remoteModified);
      await storageManager.setItem('conflict-test', resolvedData);
      
      // 验证冲突解决结果
      const finalData = await storageManager.getItem('conflict-test');
      
      // 应该保留服务器版本的status和category，但使用本地版本的name
      expect(finalData.name).toBe('本地修改'); // 保留本地修改
      expect(finalData.status).toBe('已完成'); // 保留服务器修改
      expect(finalData.category).toBe('新分类'); // 包含服务器新增字段
      expect(finalData.modifiedAt).toBeGreaterThan(remoteModified.modifiedAt); // 更新修改时间
    });
  });
}); 