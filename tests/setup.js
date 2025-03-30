/**
 * 测试环境设置文件
 * 在每个测试文件运行前执行
 */

// 扩展Jest断言函数
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `期望 ${received} 不在 ${floor} - ${ceiling} 范围内`,
        pass: true,
      };
    } else {
      return {
        message: () => `期望 ${received} 在 ${floor} - ${ceiling} 范围内`,
        pass: false,
      };
    }
  },
});

// 模拟浏览器全局对象
global.navigator = {
  userAgent: 'node.js',
  onLine: true
};

// 模拟localStorage
if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
}

// 模拟XMLHttpRequest
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  readyState: 4,
  status: 200,
  onreadystatechange: null
}));

// 模拟fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// 模拟IndexedDB
const indexedDB = {
  open: jest.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          put: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          get: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          getAll: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          })),
          delete: jest.fn(() => ({
            onsuccess: null,
            onerror: null
          }))
        }))
      })),
      objectStoreNames: {
        contains: jest.fn(() => true)
      },
      createObjectStore: jest.fn()
    }
  }))
};

global.indexedDB = indexedDB;

// 模拟window.location
const location = {
  href: 'http://localhost/',
  origin: 'http://localhost',
  reload: jest.fn()
};

if (!global.location) {
  global.location = location;
}

// 模拟控制台方法以便测试
global.console = {
  ...global.console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn()
}; 