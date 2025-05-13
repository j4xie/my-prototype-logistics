/**
 * 测试辅助工具
 * 包含各种测试辅助函数，用于模拟不同测试场景和收集测试数据
 * 
 * @module tools/test-utils
 * @version 1.0.0
 */

/**
 * 创建测试资源
 * 生成指定数量的测试资源对象，用于加载测试
 * 
 * @param {number} count - 资源数量
 * @param {boolean} withPriority - 是否添加随机优先级
 * @return {Array} 测试资源数组
 */
export function createTestResources(count, withPriority = false) {
  const resources = [];
  const types = ['image', 'script', 'style'];
  
  for (let i = 0; i < count; i++) {
    const typeIndex = i % 3;
    const resource = {
      url: `/test/resource${i}.${getExtension(types[typeIndex])}`,
      type: types[typeIndex]
    };
    
    if (withPriority) {
      // 为不同资源分配不同优先级
      if (i < count * 0.3) {
        resource.priority = 8 + Math.floor(Math.random() * 3); // 高优先级
      } else if (i < count * 0.7) {
        resource.priority = 4 + Math.floor(Math.random() * 4); // 中优先级
      } else {
        resource.priority = 1 + Math.floor(Math.random() * 3); // 低优先级
      }
    }
    
    resources.push(resource);
  }
  
  return resources;
}

/**
 * 获取资源类型对应的文件扩展名
 * 
 * @param {string} type - 资源类型
 * @return {string} 文件扩展名
 */
function getExtension(type) {
  switch (type) {
    case 'image': return 'jpg';
    case 'script': return 'js';
    case 'style': return 'css';
    default: return 'txt';
  }
}

/**
 * 模拟网络条件
 * 根据指定参数模拟不同的网络条件
 * 
 * @param {Object} condition - 网络条件参数
 * @param {number} condition.downloadSpeed - 下载速度 (MB/s)
 * @param {number} condition.latency - 延迟 (ms)
 * @param {number} condition.packetLoss - 丢包率 (%)
 * @param {boolean} condition.unstable - 是否不稳定
 */
export function simulateNetworkCondition(condition) {
  // 保存原始的setTimeout和XMLHttpRequest
  const originalSetTimeout = window.setTimeout;
  const OriginalXHR = window.XMLHttpRequest;
  
  // 根据延迟调整setTimeout
  window.setTimeout = function(callback, time) {
    // 对资源加载相关的setTimeout添加模拟延迟
    const adjustedTime = time + (Math.random() * condition.latency);
    return originalSetTimeout(callback, adjustedTime);
  };
  
  // 模拟XMLHttpRequest以模拟网络条件
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    // 覆盖open方法
    xhr.open = function() {
      return originalOpen.apply(xhr, arguments);
    };
    
    // 覆盖send方法添加延迟和模拟错误
    xhr.send = function() {
      // 模拟网络延迟
      originalSetTimeout(() => {
        // 模拟丢包
        if (Math.random() * 100 < condition.packetLoss) {
          // 触发错误事件
          const errorEvent = new ErrorEvent('error', {
            message: '模拟网络错误',
            error: new Error('模拟网络丢包')
          });
          xhr.dispatchEvent(errorEvent);
          return;
        }
        
        // 模拟网络不稳定
        if (condition.unstable && Math.random() > 0.7) {
          // 随机延迟响应
          originalSetTimeout(() => {
            xhr.readyState = 4;
            xhr.status = 200;
            xhr.dispatchEvent(new Event('readystatechange'));
            xhr.dispatchEvent(new Event('load'));
          }, Math.random() * 1000 + 500);
        } else {
          // 正常响应
          xhr.readyState = 4;
          xhr.status = 200;
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
        }
      }, condition.latency);
      
      return originalSend.apply(xhr, arguments);
    };
    
    return xhr;
  };
  
  // 根据下载速度模拟资源加载时间
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(document, tagName);
    
    if (['img', 'script', 'link'].includes(tagName)) {
      const originalSetAttribute = element.setAttribute;
      
      element.setAttribute = function(name, value) {
        originalSetAttribute.call(element, name, value);
        
        // 如果设置的是资源URL
        if ((name === 'src' || name === 'href') && value) {
          // 模拟资源大小 (KB)
          let resourceSize = 0;
          
          if (tagName === 'img') {
            resourceSize = Math.random() * 500 + 100; // 100-600KB
          } else if (tagName === 'script') {
            resourceSize = Math.random() * 200 + 50; // 50-250KB
          } else if (tagName === 'link') {
            resourceSize = Math.random() * 100 + 30; // 30-130KB
          }
          
          // 计算加载时间 (ms) = 资源大小(KB) / 下载速度(KB/ms)
          const downloadSpeedKBms = condition.downloadSpeed * 1024 / 1000;
          let loadTime = resourceSize / downloadSpeedKBms;
          
          // 添加延迟
          loadTime += condition.latency;
          
          // 模拟不稳定性
          if (condition.unstable) {
            loadTime *= (1 + Math.random() * 0.5); // 增加0-50%的随机时间
          }
          
          // 随机模拟请求失败
          if (Math.random() * 100 < condition.packetLoss) {
            setTimeout(() => {
              element.dispatchEvent(new ErrorEvent('error', {
                message: '模拟资源加载失败',
                error: new Error('模拟加载错误')
              }));
            }, loadTime);
          } else {
            // 模拟资源加载完成
            setTimeout(() => {
              element.dispatchEvent(new Event('load'));
            }, loadTime);
          }
        }
      };
    }
    
    return element;
  };
}

/**
 * 清理测试资源
 * 清理测试过程中创建的DOM元素和全局修改
 */
export function cleanupTestResources() {
  // 清理创建的测试资源
  const testElements = document.querySelectorAll('[data-test-resource]');
  testElements.forEach(element => {
    element.parentNode.removeChild(element);
  });
  
  // 恢复被修改的全局对象（如有必要）
  if (window._originalSetTimeout) {
    window.setTimeout = window._originalSetTimeout;
    delete window._originalSetTimeout;
  }
  
  if (window._originalXMLHttpRequest) {
    window.XMLHttpRequest = window._originalXMLHttpRequest;
    delete window._originalXMLHttpRequest;
  }
}

/**
 * 测量内存使用情况
 * 使用performance API测量当前内存使用情况
 * 
 * @return {Promise<number>} 内存使用量（字节）
 */
export async function measureMemoryUsage() {
  // 尝试使用现代API
  if (performance.memory) {
    return performance.memory.usedJSHeapSize;
  }
  
  // 尝试使用Chrome特定的API
  if (window.performance && window.performance.memory) {
    return window.performance.memory.usedJSHeapSize;
  }
  
  // 如果支持，使用更新的measureUserAgentSpecificMemory API
  if (performance.measureUserAgentSpecificMemory) {
    try {
      const result = await performance.measureUserAgentSpecificMemory();
      return result.bytes;
    } catch (e) {
      console.warn('性能API不支持: ', e);
    }
  }
  
  // 退化方案：返回模拟值
  console.warn('浏览器不支持内存测量API，使用模拟值');
  return Math.random() * 100 * 1024 * 1024; // 返回随机值用于测试
}

/**
 * 格式化持续时间
 * 将毫秒转换为人类可读的时间格式
 * 
 * @param {number} ms - 毫秒数
 * @return {string} 格式化的时间字符串
 */
export function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * 格式化内存大小
 * 将字节转换为人类可读的大小格式
 * 
 * @param {number} bytes - 字节数
 * @return {string} 格式化的大小字符串
 */
export function formatMemorySize(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
}

/**
 * 计算统计数据
 * 计算数据集的平均值、中值、最小值、最大值等统计数据
 * 
 * @param {Array<number>} data - 数值数组
 * @return {Object} 包含统计值的对象
 */
export function calculateStats(data) {
  if (!data || data.length === 0) return null;
  
  // 排序数据用于计算中值
  const sortedData = [...data].sort((a, b) => a - b);
  
  // 计算平均值
  const sum = data.reduce((acc, val) => acc + val, 0);
  const average = sum / data.length;
  
  // 计算中值
  const middle = Math.floor(sortedData.length / 2);
  const median = sortedData.length % 2 === 0
    ? (sortedData[middle - 1] + sortedData[middle]) / 2
    : sortedData[middle];
  
  // 找出最小值和最大值
  const min = sortedData[0];
  const max = sortedData[sortedData.length - 1];
  
  // 计算标准差
  const squareDiffs = data.map(value => {
    const diff = value - average;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / data.length;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  return {
    count: data.length,
    average,
    median,
    min,
    max,
    stdDev
  };
} 