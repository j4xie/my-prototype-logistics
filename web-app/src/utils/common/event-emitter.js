/**
 * 事件发射器
 * 提供事件订阅和发布功能
 */

/**
 * 事件发射器类
 * 提供注册、移除和触发事件的功能
 */
class EventEmitter {
  /**
   * 创建一个新的事件发射器实例
   */
  constructor() {
    // 事件监听器映射
    this._events = new Map();
    // 单次事件监听器映射
    this._onceEvents = new Map();
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 事件监听器函数
   * @return {EventEmitter} 当前实例，支持链式调用
   */
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('事件监听器必须是函数');
    }

    if (!this._events.has(event)) {
      this._events.set(event, []);
    }

    this._events.get(event).push(listener);
    return this;
  }

  /**
   * 添加只执行一次的事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 事件监听器函数
   * @return {EventEmitter} 当前实例，支持链式调用
   */
  once(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('事件监听器必须是函数');
    }

    if (!this._onceEvents.has(event)) {
      this._onceEvents.set(event, []);
    }

    this._onceEvents.get(event).push(listener);
    return this;
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} [listener] - 要移除的特定监听器，如果未提供则移除该事件的所有监听器
   * @return {EventEmitter} 当前实例，支持链式调用
   */
  off(event, listener) {
    // 如果未提供特定的监听器，移除该事件的所有监听器
    if (!listener) {
      this._events.delete(event);
      this._onceEvents.delete(event);
      return this;
    }

    // 移除常规事件监听器
    if (this._events.has(event)) {
      const listeners = this._events.get(event);
      const filteredListeners = listeners.filter(l => l !== listener);
      
      if (filteredListeners.length > 0) {
        this._events.set(event, filteredListeners);
      } else {
        this._events.delete(event);
      }
    }

    // 移除单次事件监听器
    if (this._onceEvents.has(event)) {
      const onceListeners = this._onceEvents.get(event);
      const filteredOnceListeners = onceListeners.filter(l => l !== listener);
      
      if (filteredOnceListeners.length > 0) {
        this._onceEvents.set(event, filteredOnceListeners);
      } else {
        this._onceEvents.delete(event);
      }
    }

    return this;
  }

  /**
   * 移除所有事件监听器
   * @return {EventEmitter} 当前实例，支持链式调用
   */
  removeAllListeners() {
    this._events.clear();
    this._onceEvents.clear();
    return this;
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给监听器的参数
   * @return {boolean} 如果有监听器处理了事件则返回true，否则返回false
   */
  emit(event, ...args) {
    let handled = false;

    // 处理常规事件监听器
    if (this._events.has(event)) {
      const listeners = this._events.get(event);
      listeners.forEach(listener => {
        try {
          listener.apply(this, args);
          handled = true;
        } catch (err) {
          console.error(`事件监听器执行错误: ${err.message}`, err);
        }
      });
    }

    // 处理单次事件监听器
    if (this._onceEvents.has(event)) {
      const onceListeners = this._onceEvents.get(event);
      
      // 清空单次事件监听器，因为它们只会执行一次
      this._onceEvents.delete(event);
      
      onceListeners.forEach(listener => {
        try {
          listener.apply(this, args);
          handled = true;
        } catch (err) {
          console.error(`单次事件监听器执行错误: ${err.message}`, err);
        }
      });
    }

    return handled;
  }

  /**
   * 获取特定事件的监听器数量
   * @param {string} event - 事件名称
   * @return {number} 监听器数量
   */
  listenerCount(event) {
    let count = 0;
    
    if (this._events.has(event)) {
      count += this._events.get(event).length;
    }
    
    if (this._onceEvents.has(event)) {
      count += this._onceEvents.get(event).length;
    }
    
    return count;
  }

  /**
   * 获取特定事件的所有监听器
   * @param {string} event - 事件名称
   * @return {Array<Function>} 监听器数组
   */
  listeners(event) {
    const result = [];
    
    if (this._events.has(event)) {
      result.push(...this._events.get(event));
    }
    
    if (this._onceEvents.has(event)) {
      result.push(...this._onceEvents.get(event));
    }
    
    return result;
  }

  /**
   * 获取所有已注册的事件名称
   * @return {Array<string>} 事件名称数组
   */
  eventNames() {
    const eventsSet = new Set([
      ...this._events.keys(),
      ...this._onceEvents.keys()
    ]);
    
    return Array.from(eventsSet);
  }
}

module.exports = EventEmitter; 