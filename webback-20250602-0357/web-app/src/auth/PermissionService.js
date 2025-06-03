/**
 * PermissionService.js - 权限服务
 * 用于管理用户权限，并提供权限检查功能
 * @version 1.2.0
 */

import EventEmitter from '../utils/event-emitter';

/**
 * 权限服务类
 * 负责管理和检查用户权限
 */
class PermissionService {
  /**
   * 创建权限服务实例
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = {
      endpoint: '/api/permissions',
      refreshInterval: 300000, // 5分钟
      cacheKey: 'user_permissions',
      ...options
    };
    
    // 权限缓存
    this.permissions = new Map();
    
    // 初始权限加载状态
    this.initialized = false;
    
    // 监听权限失效事件
    EventEmitter.on('permission:invalidated', () => this.refreshPermissions());
  }
  
  /**
   * 初始化权限服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadPermissions();
      this.initialized = true;
    } catch (error) {
      console.error('初始化权限服务失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载用户权限
   * @returns {Promise<Map>} 权限映射
   */
  async loadPermissions() {
    try {
      // 从API获取权限
      const response = await fetch(this.options.endpoint);
      if (!response.ok) {
        throw new Error(`权限加载失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 更新权限缓存
      this.updatePermissionCache(data);
      
      return this.permissions;
    } catch (error) {
      console.error('加载权限失败:', error);
      
      // 尝试从本地存储恢复
      this.restoreFromCache();
      
      return this.permissions;
    }
  }
  
  /**
   * 刷新权限数据
   * @returns {Promise<void>}
   */
  async refreshPermissions() {
    await this.loadPermissions();
    EventEmitter.emit('permissions:updated', { permissions: this.permissions });
  }
  
  /**
   * 检查用户是否拥有指定权限
   * @param {string} permissionId - 权限ID 
   * @param {string} tenantId - 租户ID (可选)
   * @returns {boolean} 是否拥有权限
   */
  hasPermission(permissionId, tenantId = null) {
    if (!this.initialized) {
      console.warn('权限服务尚未初始化');
      return false;
    }
    
    // 优先检查特定租户的权限
    if (tenantId && this.permissions.has(`${tenantId}:${permissionId}`)) {
      return true;
    }
    
    // 然后检查全局权限
    return this.permissions.has(permissionId);
  }
  
  /**
   * 更新权限缓存
   * @param {Object} permissionData - 权限数据
   * @private
   */
  updatePermissionCache(permissionData) {
    this.permissions.clear();
    
    // 全局权限
    if (permissionData.global && Array.isArray(permissionData.global)) {
      permissionData.global.forEach(perm => {
        this.permissions.set(perm, true);
      });
    }
    
    // 特定租户权限
    if (permissionData.tenants && typeof permissionData.tenants === 'object') {
      Object.entries(permissionData.tenants).forEach(([tenantId, perms]) => {
        if (Array.isArray(perms)) {
          perms.forEach(perm => {
            this.permissions.set(`${tenantId}:${perm}`, true);
          });
        }
      });
    }
    
    // 保存到本地存储
    this.saveToCache();
  }
  
  /**
   * 保存权限到本地缓存
   * @private
   */
  saveToCache() {
    try {
      const serialized = JSON.stringify(Array.from(this.permissions.entries()));
      localStorage.setItem(this.options.cacheKey, serialized);
    } catch (error) {
      console.error('保存权限到缓存失败:', error);
    }
  }
  
  /**
   * 从本地缓存恢复权限
   * @private
   */
  restoreFromCache() {
    try {
      const serialized = localStorage.getItem(this.options.cacheKey);
      if (serialized) {
        const entries = JSON.parse(serialized);
        this.permissions = new Map(entries);
      }
    } catch (error) {
      console.error('从缓存恢复权限失败:', error);
      this.permissions.clear();
    }
  }
  
  /**
   * 清除权限缓存
   */
  clearCache() {
    this.permissions.clear();
    localStorage.removeItem(this.options.cacheKey);
  }
}

export default PermissionService; 