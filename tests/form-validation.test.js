/**
 * 食品溯源系统 - 表单验证测试
 * 
 * 用于测试表单验证功能的正确性
 * 使用Jest测试框架
 */

// 引入被测试模块
import { traceStore } from '../components/trace-store.js';

// 模拟浏览器环境
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

global.document = {
  addEventListener: jest.fn()
};

// 表单验证测试套件
describe('表单验证测试', () => {
  
  // 每个测试前重置模拟函数
  beforeEach(() => {
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
    document.addEventListener.mockClear();
  });
  
  test('必填字段验证', () => {
    // 准备测试数据
    const testData = {
      name: '',  // 空值，应该验证失败
      age: 30
    };
    
    const rules = {
      name: {
        required: true,
        label: '姓名'
      },
      age: {
        required: true,
        type: 'number',
        label: '年龄'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('name');
    expect(result.errors[0].message).toContain('姓名是必填项');
  });
  
  test('数字类型验证', () => {
    // 准备测试数据
    const testData = {
      age: 'abc'  // 非数字，应该验证失败
    };
    
    const rules = {
      age: {
        required: true,
        type: 'number',
        label: '年龄'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('age');
    expect(result.errors[0].message).toContain('年龄必须是数字');
  });
  
  test('日期类型验证', () => {
    // 准备测试数据
    const testData = {
      birthDate: 'invalid-date'  // 无效日期，应该验证失败
    };
    
    const rules = {
      birthDate: {
        required: true,
        type: 'date',
        label: '出生日期'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('birthDate');
    expect(result.errors[0].message).toContain('出生日期不是有效的日期格式');
  });
  
  test('正则表达式模式验证', () => {
    // 准备测试数据
    const testData = {
      email: 'invalid-email'  // 无效邮箱，应该验证失败
    };
    
    const rules = {
      email: {
        required: true,
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        message: '请输入有效的邮箱地址',
        label: '邮箱'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('email');
    expect(result.errors[0].message).toBe('请输入有效的邮箱地址');
  });
  
  test('字符串长度验证', () => {
    // 准备测试数据
    const testData = {
      shortName: 'A',       // 太短，应该验证失败
      longName: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'  // 太长，应该验证失败
    };
    
    const rules = {
      shortName: {
        required: true,
        minLength: 2,
        label: '简称'
      },
      longName: {
        required: true,
        maxLength: 10,
        label: '名称'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(2);
    
    const shortNameError = result.errors.find(err => err.field === 'shortName');
    expect(shortNameError).toBeTruthy();
    expect(shortNameError.message).toContain('长度不能小于2个字符');
    
    const longNameError = result.errors.find(err => err.field === 'longName');
    expect(longNameError).toBeTruthy();
    expect(longNameError.message).toContain('长度不能超过10个字符');
  });
  
  test('全部验证通过', () => {
    // 准备测试数据 - 所有字段都有效
    const testData = {
      name: '张三',
      age: 30,
      email: 'zhangsan@example.com',
      birthDate: '1990-01-01'
    };
    
    const rules = {
      name: {
        required: true,
        minLength: 2,
        label: '姓名'
      },
      age: {
        required: true,
        type: 'number',
        label: '年龄'
      },
      email: {
        required: true,
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        label: '邮箱'
      },
      birthDate: {
        required: true,
        type: 'date',
        label: '出生日期'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.data).toEqual(testData);
  });
  
  test('非必填字段为空值', () => {
    // 准备测试数据 - 非必填字段为空
    const testData = {
      name: '张三',
      remark: ''  // 非必填，为空，应该验证通过
    };
    
    const rules = {
      name: {
        required: true,
        label: '姓名'
      },
      remark: {
        required: false,
        label: '备注'
      }
    };
    
    // 执行验证
    const result = traceStore.validateTraceData(testData, rules);
    
    // 断言结果
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

// 表单存储测试套件
describe('表单存储测试', () => {
  
  beforeEach(() => {
    // 模拟localStorage中的数据
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'trace_drafts') {
        return JSON.stringify({
          'draft1': {
            id: 'draft1',
            data: { name: '测试1' },
            updatedAt: Date.now() - 1000
          }
        });
      }
      return null;
    });
  });
  
  test('保存表单草稿', () => {
    // 准备测试数据
    const draftId = 'draft2';
    const draftData = { name: '测试2', age: 25 };
    
    // 执行保存
    const result = traceStore.saveTraceDraft(draftId, draftData);
    
    // 断言结果
    expect(result).toBeTruthy();
    expect(traceStore.trace.currentId).toBe(draftId);
    expect(traceStore.trace.isModified).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalled();
  });
  
  test('获取表单草稿', () => {
    // 获取已存在的草稿
    const draft = traceStore.getTraceDraft('draft1');
    
    // 断言结果
    expect(draft).toBeTruthy();
    expect(draft.data.name).toBe('测试1');
  });
  
  test('删除表单草稿', () => {
    // 先模拟当前正在编辑这个草稿
    traceStore.trace.currentId = 'draft1';
    
    // 执行删除
    traceStore.deleteTraceDraft('draft1');
    
    // 断言结果
    expect(traceStore.trace.currentId).toBeNull();
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});

// 运行测试
// 在项目根目录执行: npm test 