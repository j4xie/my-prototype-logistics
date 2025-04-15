/**
 * 测试辅助工具 - 用于处理模块路径和导入
 * 此文件解决测试环境中的路径解析问题
 */
const path = require('path');
const fs = require('fs');

/**
 * 查找web-app目录
 * @returns {string} web-app目录的绝对路径
 */
function findWebAppDir() {
  let currentDir = __dirname;
  const maxDepth = 10;
  let depth = 0;
  
  while (depth < maxDepth) {
    // 检查当前目录是否为web-app目录
    if (path.basename(currentDir) === 'web-app') {
      return currentDir;
    }
    
    // 检查上层目录是否为web-app目录
    const parentDir = path.dirname(currentDir);
    if (path.basename(parentDir) === 'web-app') {
      return parentDir;
    }
    
    // 向上一级目录查找
    currentDir = parentDir;
    depth++;
  }
  
  // 默认返回相对于tests目录的web-app路径
  return path.resolve(__dirname, '..');
}

/**
 * 解析模块路径
 * @param {string} modulePath - 要解析的模块路径
 * @returns {string} 解析后的模块路径
 */
function resolveModulePath(modulePath) {
  // 处理模块路径，支持绝对路径和相对路径
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    return modulePath;
  }
  
  // 获取web-app目录
  const webAppDir = findWebAppDir();
  
  // 构建相对于tests目录的路径
  const relativePath = path.join('..', modulePath);
  
  // 如果存在components/modules目录，优先使用
  const modulesPath = path.join(webAppDir, 'components', 'modules', modulePath);
  if (fs.existsSync(modulesPath)) {
    return path.relative(__dirname, modulesPath);
  }
  
  // 否则假设模块路径相对于web-app目录
  return path.relative(__dirname, path.join(webAppDir, modulePath));
}

/**
 * 创建模拟对象
 * @param {Object} baseObj - 基础对象
 * @param {Array} methods - 要模拟的方法列表
 * @returns {Object} 模拟对象
 */
function createMock(baseObj = {}, methods = []) {
  const mock = { ...baseObj };
  
  methods.forEach(methodName => {
    mock[methodName] = jest.fn();
  });
  
  return mock;
}

/**
 * 模拟localStorage
 * @returns {Object} 模拟的localStorage对象
 */
function createLocalStorageMock() {
  let store = {};
  
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn(index => {
      return Object.keys(store)[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    }
  };
}

/**
 * 设置DOM环境
 */
function setupDOMEnvironment() {
  // 创建基本DOM元素
  if (!document.getElementById('root')) {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  
  // 模拟matchMedia
  if (!window.matchMedia) {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }));
  }
  
  // 模拟localStorage
  if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true
    });
  }
}

/**
 * 等待指定的毫秒数
 * @param {number} ms - 等待的毫秒数
 * @returns {Promise} 等待完成的Promise
 */
function wait(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    // 确保测试完成时计时器被清理
    afterAll(() => clearTimeout(timer));
  });
}

/**
 * 等待DOM元素出现
 * @param {string} selector - CSS选择器
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise<Element>} 找到的DOM元素
 */
async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await wait(100);
  }
  
  throw new Error(`等待元素 "${selector}" 超时`);
}

// 测试辅助函数
module.exports = {
  resolveModulePath,
  createMock,
  createLocalStorageMock,
  setupDOMEnvironment,
  wait,
  waitForElement
}; 