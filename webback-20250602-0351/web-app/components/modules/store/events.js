/**
 * 食品溯源系统 - 状态管理模块事件系统
 * 简单的事件发布/订阅实现
 * @version 1.0.0
 */

/**
 * 事件发射器类
 * 提供事件注册、触发和删除功能
 */
class EventEmitter {
  constructor() {
    // 存储所有事件及其监听器
    this._events = {};
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} context - 监听器上下文
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  on(event, listener, context) {
    if (typeof listener !== 'function') {
      throw new TypeError('事件监听器必须是函数');
    }

    // 确保事件数组存在
    this._events[event] = this._events[event] || [];
    
    // 添加监听器和上下文
    this._events[event].push({
      listener,
      context: context || this
    });

    return this;
  }

  /**
   * 注册只执行一次的事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} context - 监听器上下文
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  once(event, listener, context) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener.apply(context || this, args);
    };
    
    return this.on(event, wrapper, this);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给监听器的参数
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  emit(event, ...args) {
    const listeners = this._events[event];
    
    if (listeners && listeners.length) {
      // 复制监听器数组，防止在回调中修改数组导致问题
      const listenersCopy = [...listeners];
      
      for (const item of listenersCopy) {
        try {
          item.listener.apply(item.context, args);
        } catch (err) {
          console.error(`事件监听器执行错误: ${err.message}`);
        }
      }
    }
    
    return this;
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} [listener] - 要移除的特定监听器，如不提供则移除所有监听器
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  off(event, listener) {
    const listeners = this._events[event];
    
    if (!listeners) return this;
    
    if (!listener) {
      // 移除该事件的所有监听器
      delete this._events[event];
    } else {
      // 移除特定监听器
      const index = listeners.findIndex(item => item.listener === listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      // 如果没有监听器了，清理事件
      if (listeners.length === 0) {
        delete this._events[event];
      }
    }
    
    return this;
  }
  
  /**
   * 获取事件所有监听器
   * @param {string} event - 事件名称
   * @returns {Function[]} - 监听器函数数组
   */
  listeners(event) {
    const listeners = this._events[event];
    return listeners ? listeners.map(item => item.listener) : [];
  }
  
  /**
   * 清除所有事件监听器
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  clearAllListeners() {
    this._events = {};
    return this;
  }
}

// export default EventEmitter; 
// CommonJS导出
module.exports = EventEmitter;
