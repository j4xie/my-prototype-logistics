// 全局Jest设置文件

// 模拟全局类
global.Blob = class Blob {
  constructor(content, options = {}) {
    this.content = content;
    this.options = options;
    this.size = content.join('').length;
    this.type = options.type || '';
  }
};

// 模拟全局浏览器对象
global.window = global.window || {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  },
  fetch: jest.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob([''])),
    })
  ),
  performance: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    },
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn().mockReturnValue([])
  },
  console: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
};

global.document = global.document || {
  createElement: jest.fn().mockReturnValue({
    style: {},
    setAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn()
  }),
  head: {
    appendChild: jest.fn()
  },
  body: {
    appendChild: jest.fn()
  },
  createEvent: jest.fn(),
  querySelector: jest.fn().mockReturnValue(null),
  querySelectorAll: jest.fn().mockReturnValue([])
};

global.navigator = global.navigator || {
  userAgent: 'node.js',
  onLine: true
};

global.Event = global.Event || class Event {
  constructor(type) {
    this.type = type;
  }
};

// 模拟定时器
jest.useFakeTimers(); 