/**
 * Jest测试环境设置文件
 * 
 * 在测试前模拟浏览器环境和全局对象
 */

// 模拟localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();

// 模拟window全局对象和DOM API
global.window = {
  addEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  localStorage: global.localStorage,
  matchMedia: jest.fn(() => ({
    matches: false,
    addEventListener: jest.fn(),
    addListener: jest.fn() // 兼容旧API
  }))
};

// 模拟document全局对象
global.document = {
  createElement: jest.fn(tag => ({
    className: '',
    style: {},
    dataset: {},
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getElementsByClassName: jest.fn(() => []),
    contains: jest.fn(() => true),
    src: '',
    href: '',
    innerHTML: '',
    textContent: '',
    // 对于特定元素类型添加特定属性
    ...(tag === 'div' ? { classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false)
    }} : {}),
    ...(tag === 'style' ? { textContent: '' } : {})
  })),
  addEventListener: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {}
  },
  head: {
    appendChild: jest.fn()
  },
  documentElement: {
    lang: 'zh-CN'
  },
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => [])
};

// 模拟navigator对象
global.navigator = {
  language: 'zh-CN',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
};

// 模拟Image构造函数
global.Image = class {
  constructor() {
    this.src = '';
    this.onload = () => {};
    this.onerror = () => {};
  }
};

// 模拟其他常用DOM API
global.HTMLElement = class {};
global.CustomEvent = class {
  constructor(name, options = {}) {
    this.name = name;
    this.detail = options.detail || {};
  }
};

// 模拟定时器函数
global.setTimeout = jest.fn((callback, timeout) => {
  return 123; // 模拟定时器ID
});
global.clearTimeout = jest.fn();
global.setInterval = jest.fn(() => 456);
global.clearInterval = jest.fn();
global.requestAnimationFrame = jest.fn(callback => {
  callback();
  return 789;
});

// 模拟console方法
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// 绑定全局对象到window
global.window.isSecureContext = false;
global.window.location = { pathname: '/', href: 'http://localhost/' };

// 导出全局模拟以便在测试中使用
module.exports = {
  localStorage: global.localStorage,
  resetLocalStorage: () => {
    global.localStorage.clear();
  },
  resetMocks: () => {
    jest.clearAllMocks();
  }
}; 