/**
 * Lock.js - 锁定工具
 * 用于防止并发操作冲突的锁定机制
 * @version 1.1.0
 */

/**
 * 锁定类
 * 提供资源锁定功能，支持按租户隔离
 */
class LockManager {
  /**
   * 创建锁管理器实例
   */
  constructor() {
    // 双层映射: Map<tenantId, Map<key, Lock>>
    this.locks = new Map();
    
    // 全局默认租户ID
    this.DEFAULT_TENANT = 'default';
    
    // 锁定超时时间 (毫秒)
    this.lockTimeout = 10000;
    
    // 定期清理过期锁
    this.cleanupInterval = setInterval(() => this.cleanupExpiredLocks(), 30000);
  }
  
  /**
   * 获取指定租户的锁映射
   * @private
   * @param {string} tenantId - 租户ID
   * @returns {Map} 锁映射
   */
  _getTenantLocks(tenantId) {
    const tenant = tenantId || this.DEFAULT_TENANT;
    
    if (!this.locks.has(tenant)) {
      this.locks.set(tenant, new Map());
    }
    
    return this.locks.get(tenant);
  }
  
  /**
   * 尝试获取锁
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   * @returns {boolean} 是否成功获取锁
   */
  tryAcquire(key, tenantId) {
    if (!key) {
      throw new Error('锁定键不能为空');
    }
    
    const tenantLocks = this._getTenantLocks(tenantId);
    
    // 如果锁不存在或已过期，创建新锁
    if (!tenantLocks.has(key) || this.isExpired(key, tenantId)) {
      tenantLocks.set(key, {
        acquired: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.lockTimeout
      });
      return true;
    }
    
    return false;
  }
  
  /**
   * 强制获取锁
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   */
  acquire(key, tenantId) {
    if (!key) {
      throw new Error('锁定键不能为空');
    }
    
    const tenantLocks = this._getTenantLocks(tenantId);
    
    tenantLocks.set(key, {
      acquired: true,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.lockTimeout
    });
  }
  
  /**
   * 释放锁
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   * @returns {boolean} 是否成功释放
   */
  release(key, tenantId) {
    if (!key) {
      throw new Error('锁定键不能为空');
    }
    
    const tenantLocks = this._getTenantLocks(tenantId);
    
    if (tenantLocks.has(key)) {
      tenantLocks.delete(key);
      return true;
    }
    
    return false;
  }
  
  /**
   * 检查锁是否存在
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   * @returns {boolean} 锁是否存在
   */
  isLocked(key, tenantId) {
    if (!key) return false;
    
    const tenantLocks = this._getTenantLocks(tenantId);
    
    return tenantLocks.has(key) && !this.isExpired(key, tenantId);
  }
  
  /**
   * 检查锁是否已过期
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   * @returns {boolean} 是否已过期
   */
  isExpired(key, tenantId) {
    if (!key) return true;
    
    const tenantLocks = this._getTenantLocks(tenantId);
    const lock = tenantLocks.get(key);
    
    if (!lock) return true;
    
    return Date.now() > lock.expiresAt;
  }
  
  /**
   * 清理所有过期的锁
   */
  cleanupExpiredLocks() {
    const now = Date.now();
    
    // 遍历所有租户
    for (const [tenantId, tenantLocks] of this.locks.entries()) {
      // 查找过期的锁
      const expiredKeys = [];
      
      for (const [key, lock] of tenantLocks.entries()) {
        if (now > lock.expiresAt) {
          expiredKeys.push(key);
        }
      }
      
      // 删除过期的锁
      expiredKeys.forEach(key => tenantLocks.delete(key));
      
      // 如果租户没有任何锁，删除租户映射
      if (tenantLocks.size === 0) {
        this.locks.delete(tenantId);
      }
    }
  }
  
  /**
   * 延长锁定时间
   * @param {string} key - 锁定键
   * @param {string} [tenantId] - 租户ID
   * @param {number} [duration=10000] - 延长时间(毫秒)
   * @returns {boolean} 是否成功延长
   */
  extend(key, tenantId, duration = 10000) {
    if (!key) return false;
    
    const tenantLocks = this._getTenantLocks(tenantId);
    const lock = tenantLocks.get(key);
    
    if (!lock || this.isExpired(key, tenantId)) {
      return false;
    }
    
    lock.expiresAt = Date.now() + duration;
    return true;
  }
  
  /**
   * 清除指定租户的所有锁
   * @param {string} [tenantId] - 租户ID
   */
  clearTenant(tenantId) {
    const tenant = tenantId || this.DEFAULT_TENANT;
    this.locks.delete(tenant);
  }
  
  /**
   * 清除所有锁
   */
  clearAll() {
    this.locks.clear();
  }
  
  /**
   * 销毁锁管理器
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.locks.clear();
  }
}

// 导出单例实例
const lockManager = new LockManager();
export default lockManager; 