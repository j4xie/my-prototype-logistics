/**
 * BigInt序列化工具
 * 解决Node.js JSON.stringify无法处理BigInt的问题
 */

/**
 * 安全的BigInt字符串转换
 * @param {any} value - 可能包含BigInt的值
 * @returns {any} 转换后的值
 */
export const safeBigIntStringify = (value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  
  if (Array.isArray(value)) {
    return value.map(safeBigIntStringify);
  }
  
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = safeBigIntStringify(val);
    }
    return result;
  }
  
  return value;
};

/**
 * 安全的JSON序列化（处理BigInt）
 * @param {any} obj - 要序列化的对象
 * @param {Function} replacer - 可选的替换函数
 * @param {string|number} space - 可选的空格
 * @returns {string} JSON字符串
 */
export const safeJsonStringify = (obj, replacer = null, space = null) => {
  return JSON.stringify(obj, (key, value) => {
    // 首先处理BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    // 如果有自定义replacer，继续调用
    if (replacer && typeof replacer === 'function') {
      return replacer(key, value);
    }
    
    return value;
  }, space);
};

/**
 * 处理系统信息中的BigInt值
 * @param {Object} systemInfo - 系统信息对象
 * @returns {Object} 处理后的系统信息
 */
export const processSystemInfo = (systemInfo) => {
  return {
    ...systemInfo,
    memory: systemInfo.memory ? {
      ...systemInfo.memory,
      total: systemInfo.memory.total?.toString() || systemInfo.memory.total,
      free: systemInfo.memory.free?.toString() || systemInfo.memory.free,
      used: systemInfo.memory.used?.toString() || systemInfo.memory.used
    } : systemInfo.memory
  };
};

/**
 * 处理进程内存使用情况
 * @param {Object} memoryUsage - process.memoryUsage()的返回值
 * @returns {Object} 处理后的内存信息
 */
export const processMemoryUsage = (memoryUsage) => {
  const processed = {};
  for (const [key, value] of Object.entries(memoryUsage)) {
    processed[key] = typeof value === 'bigint' ? value.toString() : value;
  }
  return processed;
};

/**
 * Express响应中间件：安全发送包含BigInt的JSON
 * @param {Object} res - Express响应对象
 * @param {any} data - 要发送的数据
 */
export const sendSafeJson = (res, data) => {
  try {
    const safeData = safeBigIntStringify(data);
    res.json(safeData);
  } catch (error) {
    console.error('JSON序列化错误:', error);
    res.status(500).json({
      success: false,
      message: '数据序列化失败'
    });
  }
};

export default {
  safeBigIntStringify,
  safeJsonStringify,
  processSystemInfo,
  processMemoryUsage,
  sendSafeJson
};