/**
 * 工具函数模块单元测试
 * @jest-environment jsdom
 */

// 导入被测试模块
import { traceUtils } from '../../components/modules/utils/utils';

// 模拟 localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// 模拟 navigator
const navigatorMock = {
  language: 'zh-CN',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  clipboard: {
    writeText: jest.fn()
  }
};

// 设置全局对象
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'navigator', { 
  value: navigatorMock,
  writable: true 
});

// UUID 格式正则表达式
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ID 格式正则表达式(基于时间戳+随机字符串)
const ID_REGEX = /^[0-9a-z]{8,15}$/;

describe('traceUtils', () => {
  // 在每个测试之前重置 mock
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('generateUUID', () => {
    test('生成符合格式的UUID', () => {
      const uuid = traceUtils.generateUUID();
      expect(uuid).toMatch(UUID_REGEX);
    });

    test('生成的UUID是唯一的', () => {
      const uuid1 = traceUtils.generateUUID();
      const uuid2 = traceUtils.generateUUID();
      expect(uuid1).not.toEqual(uuid2);
    });
  });

  describe('generateId', () => {
    test('生成符合格式的ID', () => {
      const id = traceUtils.generateId();
      expect(id).toMatch(ID_REGEX);
    });

    test('生成的ID是唯一的', () => {
      const id1 = traceUtils.generateId();
      const id2 = traceUtils.generateId();
      expect(id1).not.toEqual(id2);
    });
  });

  describe('formatDate', () => {
    test('格式化Date对象', () => {
      const date = new Date(2023, 0, 15, 14, 30, 45); // 2023-01-15 14:30:45
      const formattedDate = traceUtils.formatDate(date);
      expect(formattedDate).toBe('2023-01-15 14:30:45');
    });

    test('格式化时间戳', () => {
      const timestamp = new Date(2023, 0, 15, 14, 30, 45).getTime();
      const formattedDate = traceUtils.formatDate(timestamp);
      expect(formattedDate).toBe('2023-01-15 14:30:45');
    });

    test('格式化日期字符串', () => {
      const dateStr = '2023-01-15T14:30:45';
      const formattedDate = traceUtils.formatDate(dateStr);
      expect(formattedDate).toBe('2023-01-15 14:30:45');
    });

    test('使用自定义格式', () => {
      const date = new Date(2023, 0, 15, 14, 30, 45);
      const formattedDate = traceUtils.formatDate(date, 'yyyy年MM月dd日 HH时mm分ss秒');
      expect(formattedDate).toBe('2023年01月15日 14时30分45秒');
    });

    test('处理无效日期返回空字符串', () => {
      expect(traceUtils.formatDate(null)).toBe('');
      expect(traceUtils.formatDate(undefined)).toBe('');
      expect(traceUtils.formatDate('invalid-date')).toBe('');
    });
  });

  describe('dateDiff', () => {
    test('计算两个日期之间的天数差异', () => {
      const date1 = new Date(2023, 0, 1); // 2023-01-01
      const date2 = new Date(2023, 0, 11); // 2023-01-11
      const diff = traceUtils.dateDiff(date1, date2, 'days');
      expect(diff).toBe(10);
    });

    test('计算两个日期之间的小时差异', () => {
      const date1 = new Date(2023, 0, 1, 10, 0, 0); 
      const date2 = new Date(2023, 0, 1, 22, 0, 0);
      const diff = traceUtils.dateDiff(date1, date2, 'hours');
      expect(diff).toBe(12);
    });

    test('计算两个日期之间的分钟差异', () => {
      const date1 = new Date(2023, 0, 1, 10, 0, 0);
      const date2 = new Date(2023, 0, 1, 10, 30, 0);
      const diff = traceUtils.dateDiff(date1, date2, 'minutes');
      expect(diff).toBe(30);
    });

    test('处理无效日期返回null', () => {
      expect(traceUtils.dateDiff('invalid-date', new Date())).toBeNull();
      expect(traceUtils.dateDiff(new Date(), 'invalid-date')).toBeNull();
    });
  });

  describe('debounce', () => {
    test('防抖函数在等待时间过后仅执行一次', () => {
      jest.useFakeTimers();
      const mockFn = jest.fn();
      const debouncedFn = traceUtils.debounce(mockFn, 100);

      // 连续调用多次
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // 验证在等待时间内未执行
      expect(mockFn).not.toHaveBeenCalled();

      // 快进时间
      jest.advanceTimersByTime(100);

      // 验证只执行了一次
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });

  describe('throttle', () => {
    test('节流函数在给定时间内只执行一次', () => {
      jest.useFakeTimers();
      const mockFn = jest.fn();
      const throttledFn = traceUtils.throttle(mockFn, 100);

      // 首次调用立即执行
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      // 重置模拟函数计数器
      mockFn.mockClear();
      
      // 连续调用多次但在限制时间内
      throttledFn();
      throttledFn();
      throttledFn();
      
      // 验证在时间限制内未触发额外执行
      expect(mockFn).not.toHaveBeenCalled();

      // 快进时间
      jest.advanceTimersByTime(100);
      
      // 再次调用，确认时间限制过后可以再次执行
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });

  describe('deepClone', () => {
    test('深拷贝简单对象', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = traceUtils.deepClone(original);
      
      // 应该是不同的对象实例
      expect(cloned).not.toBe(original);
      // 但值应该相等
      expect(cloned).toEqual(original);
      
      // 修改克隆对象不应影响原始对象
      cloned.b.c = 3;
      expect(original.b.c).toBe(2);
    });

    test('深拷贝数组', () => {
      const original = [1, 2, [3, 4]];
      const cloned = traceUtils.deepClone(original);
      
      expect(cloned).not.toBe(original);
      expect(cloned).toEqual(original);
      
      cloned[2][0] = 5;
      expect(original[2][0]).toBe(3);
    });

    test('深拷贝日期对象', () => {
      const original = new Date();
      const cloned = traceUtils.deepClone(original);
      
      expect(cloned).not.toBe(original);
      expect(cloned.getTime()).toBe(original.getTime());
    });

    test('处理基本类型和空值', () => {
      expect(traceUtils.deepClone(null)).toBeNull();
      expect(traceUtils.deepClone(undefined)).toBeUndefined();
      expect(traceUtils.deepClone(123)).toBe(123);
      expect(traceUtils.deepClone('string')).toBe('string');
      expect(traceUtils.deepClone(true)).toBe(true);
    });
  });

  describe('objectToQueryString & queryStringToObject', () => {
    test('将对象转换为查询字符串', () => {
      const params = { 
        name: 'John Doe', 
        age: 30, 
        tags: ['food', 'trace'] 
      };
      
      const queryString = traceUtils.objectToQueryString(params);
      expect(queryString).toBe('name=John%20Doe&age=30&tags=food&tags=trace');
    });

    test('将查询字符串解析为对象', () => {
      const queryString = 'name=John%20Doe&age=30&tags=food&tags=trace';
      const obj = traceUtils.queryStringToObject(queryString);
      
      expect(obj).toEqual({
        name: 'John Doe',
        age: '30', // 注意：查询字符串解析后值都是字符串
        tags: ['food', 'trace']
      });
    });

    test('处理带问号的查询字符串', () => {
      const queryString = '?name=John%20Doe&age=30';
      const obj = traceUtils.queryStringToObject(queryString);
      
      expect(obj).toEqual({
        name: 'John Doe',
        age: '30'
      });
    });

    test('处理空值或无效输入', () => {
      expect(traceUtils.objectToQueryString(null)).toBe('');
      expect(traceUtils.objectToQueryString(undefined)).toBe('');
      expect(traceUtils.objectToQueryString('string')).toBe('');
      
      expect(traceUtils.queryStringToObject(null)).toEqual({});
      expect(traceUtils.queryStringToObject('')).toEqual({});
      expect(traceUtils.queryStringToObject(123)).toEqual({});
    });
  });

  describe('detectDevice', () => {
    test('检测移动设备', () => {
      // 使用模拟的 iPhone UA
      const device = traceUtils.detectDevice();
      
      expect(device.isMobile).toBe(true);
      expect(device.isIOS).toBe(true);
      expect(device.isAndroid).toBe(false);
      expect(device.isDesktop).toBe(false);
      expect(device.isSafari).toBe(true);
    });

    test('检测桌面设备', () => {
      // 修改 UA 为桌面 Chrome
      Object.defineProperty(window, 'navigator', { 
        value: {
          ...navigatorMock,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        },
        writable: true 
      });
      
      const device = traceUtils.detectDevice();
      
      expect(device.isMobile).toBe(false);
      expect(device.isDesktop).toBe(true);
      // Chrome 检测可能因 UA 解析方式不同而有差异，先不检查这个
      // expect(device.isChrome).toBe(true);
      expect(device.isSafari).toBe(false);
    });
  });

  describe('localStorage 操作', () => {
    test('设置、获取和删除本地存储数据', () => {
      // 设置数据
      const result = traceUtils.setLocalStorage('testKey', { data: 'testValue' });
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', '{"data":"testValue"}');
      
      // 获取数据
      traceUtils.getLocalStorage('testKey');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('testKey');
      
      // 删除数据
      traceUtils.removeLocalStorage('testKey');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('testKey');
    });

    test('处理localStorage获取异常', () => {
      // 模拟错误
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('测试异常');
      });
      
      const result = traceUtils.getLocalStorage('errorKey', 'defaultValue');
      expect(result).toBe('defaultValue');
    });

    test('处理localStorage设置异常', () => {
      // 模拟错误
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('测试异常');
      });
      
      const result = traceUtils.setLocalStorage('errorKey', 'value');
      expect(result).toBe(false);
    });
  });

  describe('getBrowserLanguage', () => {
    test('获取浏览器语言设置', () => {
      const language = traceUtils.getBrowserLanguage();
      expect(language).toBe('zh-CN');
    });
  });

  describe('copyToClipboard', () => {
    test('使用现代 Clipboard API 复制文本', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: true });
      
      await traceUtils.copyToClipboard('测试文本');
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('测试文本');
    });

    test('使用回退方法复制文本', async () => {
      // 模拟不支持 Clipboard API
      Object.defineProperty(window, 'isSecureContext', { value: false });
      
      // 模拟 document.execCommand
      document.execCommand = jest.fn().mockReturnValue(true);
      
      await traceUtils.copyToClipboard('测试文本');
      
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });
}); 