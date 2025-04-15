/**
 * 食品溯源系统 - 状态管理模块工具函数测试
 * @version 1.0.0
 */

// 导入被测试的工具函数
import * as utils from '../../../components/modules/store/utils.js';

describe('状态管理模块工具函数', () => {
  describe('parseKey', () => {
    test('应正确处理简单字符串键', () => {
      const result = utils.parseKey('simple');
      expect(result).toEqual(['simple']);
    });

    test('应正确处理点分隔的嵌套键', () => {
      const result = utils.parseKey('user.profile.name');
      expect(result).toEqual(['user', 'profile', 'name']);
    });

    test('应正确处理数组索引键', () => {
      const result = utils.parseKey('items[0].name');
      expect(result).toEqual(['items', '0', 'name']);
    });

    test('应处理空字符串', () => {
      const result = utils.parseKey('');
      expect(result).toEqual(['']);
    });
  });

  describe('getNestedValue', () => {
    const testObj = {
      user: {
        profile: {
          name: '张三',
          age: 30
        },
        roles: ['admin', 'editor']
      },
      items: [
        { id: 1, name: '苹果' },
        { id: 2, name: '香蕉' }
      ]
    };

    test('应获取顶层属性', () => {
      const result = utils.getNestedValue(testObj, ['user']);
      expect(result).toBe(testObj.user);
    });

    test('应获取嵌套属性', () => {
      const result = utils.getNestedValue(testObj, ['user', 'profile', 'name']);
      expect(result).toBe('张三');
    });

    test('应获取数组元素', () => {
      const result = utils.getNestedValue(testObj, ['items', '1']);
      expect(result).toBe(testObj.items[1]);
    });

    test('应获取嵌套数组元素属性', () => {
      const result = utils.getNestedValue(testObj, ['items', '0', 'name']);
      expect(result).toBe('苹果');
    });

    test('当路径不存在时应返回undefined', () => {
      const result = utils.getNestedValue(testObj, ['user', 'address']);
      expect(result).toBeUndefined();
    });

    test('当对象为空时应返回undefined', () => {
      const result = utils.getNestedValue(null, ['user']);
      expect(result).toBeUndefined();
    });
  });

  describe('setNestedValue', () => {
    let testObj;
    
    beforeEach(() => {
      // 每个测试前重置测试对象
      testObj = {
        user: {
          profile: {
            name: '张三',
            age: 30
          }
        },
        items: [
          { id: 1, name: '苹果' }
        ]
      };
    });

    test('应设置顶层属性', () => {
      utils.setNestedValue(testObj, ['status'], 'active');
      expect(testObj.status).toBe('active');
    });

    test('应设置嵌套属性', () => {
      utils.setNestedValue(testObj, ['user', 'profile', 'name'], '李四');
      expect(testObj.user.profile.name).toBe('李四');
    });

    test('应设置数组元素', () => {
      utils.setNestedValue(testObj, ['items', '0', 'name'], '橙子');
      expect(testObj.items[0].name).toBe('橙子');
    });

    test('应创建不存在的嵌套对象路径', () => {
      utils.setNestedValue(testObj, ['user', 'address', 'city'], '北京');
      expect(testObj.user.address.city).toBe('北京');
    });

    test('应创建不存在的数组路径', () => {
      utils.setNestedValue(testObj, ['categories', '0', 'name'], '水果');
      expect(testObj.categories[0].name).toBe('水果');
    });

    test('当对象为空时应返回不修改', () => {
      const result = utils.setNestedValue(null, ['user', 'name'], '张三');
      expect(result).toBeUndefined();
    });
  });

  describe('removeNestedValue', () => {
    let testObj;
    
    beforeEach(() => {
      // 每个测试前重置测试对象
      testObj = {
        user: {
          profile: {
            name: '张三',
            age: 30
          }
        },
        items: [
          { id: 1, name: '苹果' }
        ],
        status: 'active'
      };
    });

    test('应删除顶层属性', () => {
      utils.removeNestedValue(testObj, ['status']);
      expect(testObj.status).toBeUndefined();
    });

    test('应删除嵌套属性', () => {
      utils.removeNestedValue(testObj, ['user', 'profile', 'age']);
      expect(testObj.user.profile.age).toBeUndefined();
      expect(testObj.user.profile.name).toBe('张三'); // 其他属性不受影响
    });

    test('应删除数组元素属性', () => {
      utils.removeNestedValue(testObj, ['items', '0', 'name']);
      expect(testObj.items[0].name).toBeUndefined();
      expect(testObj.items[0].id).toBe(1); // 其他属性不受影响
    });

    test('当路径不存在时不应报错', () => {
      utils.removeNestedValue(testObj, ['user', 'address', 'city']);
      expect(testObj).toEqual({
        user: {
          profile: {
            name: '张三',
            age: 30
          }
        },
        items: [
          { id: 1, name: '苹果' }
        ],
        status: 'active'
      });
    });

    test('当对象为空时应不做任何操作', () => {
      const result = utils.removeNestedValue(null, ['status']);
      expect(result).toBeUndefined();
    });
  });
}); 