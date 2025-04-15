/**
 * 食品溯源系统 - 状态管理模块事件系统测试
 * @version 1.0.0
 */

// 导入被测试的事件系统
import EventEmitter from '../../../components/modules/store/events.js';

describe('状态管理模块事件系统', () => {
  let events;

  beforeEach(() => {
    // 为每个测试创建新的事件实例
    events = new EventEmitter();
  });

  describe('基本功能', () => {
    test('应该能创建事件系统实例', () => {
      expect(events).toBeInstanceOf(EventEmitter);
    });

    test('初始状态下应没有监听器', () => {
      // 这里假设events有一个内部的_events或_listeners属性
      // 如果没有公开的API来检查这一点，可以省略此测试
      expect(Object.keys(events._events || {}).length).toBe(0);
    });
  });

  describe('on 和 emit', () => {
    test('应能注册和触发事件', () => {
      const mockFn = jest.fn();
      events.on('test', mockFn);
      
      events.emit('test', 'data');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('data');
    });

    test('应能触发多个监听器', () => {
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();
      
      events.on('test', mockFn1);
      events.on('test', mockFn2);
      
      events.emit('test', 'data');
      
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    test('应能传递多个参数', () => {
      const mockFn = jest.fn();
      events.on('test', mockFn);
      
      events.emit('test', 'arg1', 'arg2', 123);
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });
    
    test('当没有监听器时emit不应报错', () => {
      expect(() => {
        events.emit('nonexistent', 'data');
      }).not.toThrow();
    });
  });

  describe('once', () => {
    test('once注册的事件应只触发一次', () => {
      const mockFn = jest.fn();
      events.once('test', mockFn);
      
      events.emit('test', 'first');
      events.emit('test', 'second');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });
    
    test('once和on可以并存', () => {
      const onceFn = jest.fn();
      const onFn = jest.fn();
      
      events.once('test', onceFn);
      events.on('test', onFn);
      
      events.emit('test', 'data');
      events.emit('test', 'more');
      
      expect(onceFn).toHaveBeenCalledTimes(1);
      expect(onFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('off', () => {
    test('应能移除特定监听器', () => {
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();
      
      events.on('test', mockFn1);
      events.on('test', mockFn2);
      
      events.off('test', mockFn1);
      events.emit('test', 'data');
      
      expect(mockFn1).not.toHaveBeenCalled();
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });
    
    test('应能移除所有特定事件监听器', () => {
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();
      
      events.on('test', mockFn1);
      events.on('test', mockFn2);
      events.on('other', mockFn1);
      
      events.off('test');
      
      events.emit('test', 'data');
      events.emit('other', 'data');
      
      expect(mockFn1).toHaveBeenCalledTimes(1); // 只被other调用
      expect(mockFn2).not.toHaveBeenCalled();
    });
    
    test('移除不存在的监听器不应报错', () => {
      const mockFn = jest.fn();
      
      expect(() => {
        events.off('nonexistent', mockFn);
      }).not.toThrow();
    });
  });

  describe('事件链和上下文', () => {
    test('应支持方法链式调用', () => {
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();
      
      events
        .on('event1', mockFn1)
        .on('event2', mockFn2);
      
      events.emit('event1').emit('event2');
      
      expect(mockFn1).toHaveBeenCalled();
      expect(mockFn2).toHaveBeenCalled();
    });
    
    test('应能在正确的上下文中调用监听器', () => {
      const context = { value: 'test' };
      
      function listener() {
        expect(this).toBe(context);
      }
      
      events.on('test', listener, context);
      events.emit('test');
    });
  });
}); 