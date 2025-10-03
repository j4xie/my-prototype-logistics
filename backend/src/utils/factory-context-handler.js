/**
 * 工厂上下文处理工具
 * 智能处理不同用户类型的factoryId访问逻辑
 */

import { ValidationError } from '../middleware/errorHandler.js';

/**
 * 智能获取工厂访问范围
 * @param {Object} req - Express请求对象
 * @returns {Object} 查询条件对象
 */
export const getFactoryAccessScope = (req) => {
  if (!req.user) {
    throw new ValidationError('用户认证信息缺失');
  }

  const { factoryId, userType } = req.user;

  if (userType === 'platform') {
    // 平台用户：可以访问所有工厂或指定工厂
    return factoryId ? { factoryId } : {}; // 空对象表示查询所有工厂
  } else if (userType === 'factory') {
    // 工厂用户：只能访问自己的工厂
    if (!factoryId) {
      throw new ValidationError('工厂用户必须有关联的工厂ID');
    }
    return { factoryId };
  } else {
    // 其他类型用户（如mobile临时用户）
    return factoryId ? { factoryId } : {};
  }
};

/**
 * 获取用户可访问的工厂ID列表
 * @param {Object} req - Express请求对象
 * @returns {Array} 工厂ID数组，空数组表示可以访问所有工厂
 */
export const getAccessibleFactoryIds = (req) => {
  if (!req.user) {
    throw new ValidationError('用户认证信息缺失');
  }

  const { factoryId, userType } = req.user;

  if (userType === 'platform') {
    // 平台用户：返回空数组表示可以访问所有工厂
    return factoryId ? [factoryId] : [];
  } else if (userType === 'factory') {
    // 工厂用户：只能访问自己的工厂
    if (!factoryId) {
      throw new ValidationError('工厂用户必须有关联的工厂ID');
    }
    return [factoryId];
  } else {
    // 其他用户类型
    return factoryId ? [factoryId] : [];
  }
};

/**
 * 检查用户是否可以访问指定工厂
 * @param {Object} req - Express请求对象
 * @param {string} targetFactoryId - 目标工厂ID
 * @returns {boolean} 是否可以访问
 */
export const canAccessFactory = (req, targetFactoryId) => {
  if (!req.user) {
    return false;
  }

  const { factoryId, userType } = req.user;

  if (userType === 'platform') {
    // 平台用户可以访问所有工厂，或者访问分配给他们的特定工厂
    return !factoryId || factoryId === targetFactoryId;
  } else if (userType === 'factory') {
    // 工厂用户只能访问自己的工厂
    return factoryId === targetFactoryId;
  } else {
    // 其他用户类型
    return !factoryId || factoryId === targetFactoryId;
  }
};

/**
 * 安全地从req.user获取factoryId
 * 防止解构undefined导致的错误
 * @param {Object} req - Express请求对象
 * @returns {string|null} 工厂ID或null
 */
export const safeGetFactoryId = (req) => {
  return req.user?.factoryId || null;
};

/**
 * 为数据库查询构建工厂过滤条件
 * @param {Object} req - Express请求对象
 * @param {Object} additionalWhere - 额外的查询条件
 * @returns {Object} 完整的where查询条件
 */
export const buildFactoryWhereClause = (req, additionalWhere = {}) => {
  const factoryScope = getFactoryAccessScope(req);
  return {
    ...factoryScope,
    ...additionalWhere
  };
};

/**
 * 检查并设置创建数据时的factoryId
 * @param {Object} req - Express请求对象
 * @param {Object} data - 要创建的数据
 * @returns {Object} 包含factoryId的完整数据
 */
export const ensureFactoryIdInData = (req, data) => {
  const factoryId = safeGetFactoryId(req);
  
  if (!factoryId && req.user?.userType === 'factory') {
    throw new ValidationError('工厂用户必须有关联的工厂ID才能创建数据');
  }

  if (factoryId) {
    return {
      ...data,
      factoryId
    };
  }

  return data;
};

/**
 * 记录工厂访问日志
 * @param {Object} req - Express请求对象
 * @param {string} action - 执行的操作
 * @param {string} resource - 访问的资源
 * @param {Object} details - 详细信息
 */
export const logFactoryAccess = (req, action, resource, details = {}) => {
  const { id, username, userType, factoryId } = req.user || {};
  
  console.log(`[Factory Access] ${new Date().toISOString()}`, {
    userId: id,
    username,
    userType,
    factoryId,
    action,
    resource,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    ...details
  });
};

export default {
  getFactoryAccessScope,
  getAccessibleFactoryIds,
  canAccessFactory,
  safeGetFactoryId,
  buildFactoryWhereClause,
  ensureFactoryIdInData,
  logFactoryAccess
};