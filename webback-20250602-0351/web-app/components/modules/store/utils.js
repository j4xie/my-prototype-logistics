/**
 * 食品溯源系统 - 状态管理模块工具函数
 * 为状态管理提供各种工具函数
 * @version 1.0.0
 */

/**
 * 解析点分隔键和数组索引
 * 例如: "user.profile.items[0].name" 会被解析为 ['user', 'profile', 'items', '0', 'name']
 * @param {string} key - 键路径
 * @returns {string[]} - 解析后的路径数组
 */
export function parseKey(key) {
  if (!key) return [''];
  
  // 将数组索引转换为点符号
  // 例如：items[0] -> items.0
  const normalized = key.replace(/\[(\w+)\]/g, '.$1');
  return normalized.split('.');
}

/**
 * 获取对象中的嵌套值
 * @param {Object} obj - 源对象
 * @param {string[]} path - 由parseKey生成的路径数组
 * @returns {*} - 找到的值或undefined
 */
export function getNestedValue(obj, path) {
  // 空对象或路径直接返回undefined
  if (!obj || !path || !path.length) return undefined;
  
  let current = obj;
  
  for (const key of path) {
    // 如果当前层为null或undefined，直接返回undefined
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * 设置对象中的嵌套值，如果路径不存在则创建
 * @param {Object} obj - 目标对象
 * @param {string[]} path - 由parseKey生成的路径数组
 * @param {*} value - 要设置的值
 * @returns {Object} - 修改后的对象或undefined
 */
export function setNestedValue(obj, path, value) {
  // 空对象直接返回
  if (!obj || !path || !path.length) return undefined;
  
  let current = obj;
  const lastIndex = path.length - 1;
  
  // 遍历路径，创建必要的对象和数组
  for (let i = 0; i < lastIndex; i++) {
    const key = path[i];
    
    // 如果下一级不存在，创建它
    if (current[key] === undefined) {
      // 如果下一个键是数字，则创建数组
      const nextKey = path[i + 1];
      current[key] = !isNaN(parseInt(nextKey)) ? [] : {};
    }
    
    current = current[key];
  }
  
  // 设置最终值
  current[path[lastIndex]] = value;
  return obj;
}

/**
 * 从对象中移除嵌套值
 * @param {Object} obj - 目标对象
 * @param {string[]} path - 由parseKey生成的路径数组
 * @returns {Object} - 修改后的对象或undefined
 */
export function removeNestedValue(obj, path) {
  // 空对象直接返回
  if (!obj || !path || !path.length) return undefined;
  
  let current = obj;
  const lastIndex = path.length - 1;
  
  // 导航到目标路径的父级
  for (let i = 0; i < lastIndex; i++) {
    const key = path[i];
    
    // 如果路径不存在，直接返回
    if (current[key] === undefined) {
      return obj;
    }
    
    current = current[key];
  }
  
  // 删除目标属性
  const lastKey = path[lastIndex];
  if (Array.isArray(current)) {
    if (!isNaN(parseInt(lastKey))) {
      current.splice(parseInt(lastKey), 1);
    }
  } else {
    delete current[lastKey];
  }
  
  return obj;
}

/**
 * 深度合并两个对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} - 合并后的对象
 */
export function deepMerge(target, source) {
  if (!source) return target;
  if (!target) return JSON.parse(JSON.stringify(source));
  
  const output = {...target};
  
  Object.keys(source).forEach(key => {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    // 如果两者都是对象，递归合并
    if (
      sourceValue && typeof sourceValue === 'object' && 
      targetValue && typeof targetValue === 'object' &&
      !Array.isArray(sourceValue) && !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue, sourceValue);
    } 
    // 否则直接覆盖
    else {
      output[key] = typeof sourceValue === 'object' 
        ? JSON.parse(JSON.stringify(sourceValue)) // 深拷贝对象/数组
        : sourceValue;
    }
  });
  
  return output;
}

/**
 * 创建对象的深拷贝
 * @param {*} obj - 要拷贝的对象
 * @returns {*} - 深拷贝后的对象
 */
export function deepClone(obj) {
  // 处理null和基础类型
  if (obj === null || typeof obj !== 'object') return obj;
  
  // 处理日期
  if (obj instanceof Date) return new Date(obj);
  
  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  // 处理对象
  const clone = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  
  return clone;
}

/**
 * 比较两个值是否相等
 * @param {*} a - 第一个值
 * @param {*} b - 第二个值
 * @returns {boolean} - 是否相等
 */
export function isEqual(a, b) {
  // 处理null和undefined
  if (a === b) return true;
  if (a == null || b == null) return false;
  
  // 处理基础类型
  if (typeof a !== 'object' && typeof b !== 'object') return a === b;
  
  // 处理日期
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // 不同类型不相等
  if (typeof a !== typeof b) return false;
  
  // 数组比较
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }
  
  // 确保两者都是对象
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  
  // 比较对象属性
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => keysB.includes(key) && isEqual(a[key], b[key]));
} 