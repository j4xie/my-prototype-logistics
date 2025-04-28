/**
 * @file 浏览器环境模拟
 * @description 为Node.js环境提供浏览器API的模拟实现，用于测试
 */

// 模拟localStorage
class LocalStorageMock {
  constructor() {
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

  clear() {
    this.store = {};
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index) {
    return Object.keys(this.store)[index] || null;
  }
}

// 模拟SessionStorage
class SessionStorageMock extends LocalStorageMock {
  // 继承LocalStorageMock的所有方法
}

// 模拟IndexedDB
class IndexedDBMock {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const request = new IDBRequest();
    
    setTimeout(() => {
      try {
        const db = this._getDatabase(name, version);
        
        // 如果版本升级，触发onupgradeneeded
        if (db._needsUpgrade) {
          db._needsUpgrade = false;
          const upgradeEvent = { target: { result: db } };
          if (request.onupgradeneeded) {
            request.onupgradeneeded(upgradeEvent);
          }
        }
        
        // 触发成功回调
        request.result = db;
        request.readyState = 'done';
        const successEvent = { target: request };
        if (request.onsuccess) {
          request.onsuccess(successEvent);
        }
      } catch (error) {
        request.error = error;
        request.readyState = 'done';
        const errorEvent = { target: request };
        if (request.onerror) {
          request.onerror(errorEvent);
        }
      }
    }, 0);

    return request;
  }

  _getDatabase(name, version) {
    if (!this.databases.has(name)) {
      // 创建新数据库
      const newDb = {
        name,
        version,
        _needsUpgrade: true,
        _objectStores: new Map(),
        objectStoreNames: new ObjectStoreNames(),
        
        createObjectStore: function(storeName, options = {}) {
          const store = {
            name: storeName,
            keyPath: options.keyPath || null,
            autoIncrement: options.autoIncrement || false,
            data: new Map(),
            
            put: function(value, key) {
              const useKey = key !== undefined ? key : 
                (this.keyPath && value ? value[this.keyPath] : undefined);
              
              if (useKey === undefined) {
                throw new Error('Key required but not provided');
              }
              
              this.data.set(useKey, value);
              
              const request = new IDBRequest();
              setTimeout(() => {
                request.result = useKey;
                request.readyState = 'done';
                if (request.onsuccess) {
                  request.onsuccess({ target: request });
                }
              }, 0);
              
              return request;
            },
            
            get: function(key) {
              const request = new IDBRequest();
              
              setTimeout(() => {
                if (this.data.has(key)) {
                  request.result = this.data.get(key);
                }
                request.readyState = 'done';
                if (request.onsuccess) {
                  request.onsuccess({ target: request });
                }
              }, 0);
              
              return request;
            },
            
            delete: function(key) {
              const request = new IDBRequest();
              
              setTimeout(() => {
                this.data.delete(key);
                request.readyState = 'done';
                if (request.onsuccess) {
                  request.onsuccess({ target: request });
                }
              }, 0);
              
              return request;
            },
            
            clear: function() {
              const request = new IDBRequest();
              
              setTimeout(() => {
                this.data.clear();
                request.readyState = 'done';
                if (request.onsuccess) {
                  request.onsuccess({ target: request });
                }
              }, 0);
              
              return request;
            },
            
            openCursor: function(query, direction = 'next') {
              const request = new IDBRequest();
              
              const keys = Array.from(this.data.keys());
              let currentIndex = 0;
              
              const advanceCursor = () => {
                if (currentIndex < keys.length) {
                  const key = keys[currentIndex];
                  const value = this.data.get(key);
                  
                  const cursor = {
                    key,
                    value,
                    continue: () => {
                      currentIndex++;
                      setTimeout(advanceCursor, 0);
                    }
                  };
                  
                  request.result = cursor;
                  if (request.onsuccess) {
                    request.onsuccess({ target: request });
                  }
                } else {
                  request.result = null;
                  if (request.onsuccess) {
                    request.onsuccess({ target: request });
                  }
                }
              };
              
              setTimeout(advanceCursor, 0);
              
              return request;
            }
          };
          
          this._objectStores.set(storeName, store);
          this.objectStoreNames.add(storeName);
          
          return store;
        },
        
        transaction: function(storeNames, mode = 'readonly') {
          const transaction = new EventTarget();
          transaction.db = this;
          transaction.mode = mode;
          transaction.error = null;
          
          transaction.objectStore = (storeName) => {
            if (!this._objectStores.has(storeName)) {
              throw new Error(`Object store ${storeName} not found`);
            }
            return this._objectStores.get(storeName);
          };
          
          transaction.abort = function() {
            if (this.onabort) {
              this.onabort({ target: this });
            }
          };
          
          setTimeout(() => {
            if (transaction.oncomplete) {
              transaction.oncomplete({ target: transaction });
            }
          }, 0);
          
          return transaction;
        }
      };
      
      this.databases.set(name, newDb);
    }
    
    const db = this.databases.get(name);
    if (db.version < version) {
      db.version = version;
      db._needsUpgrade = true;
    }
    
    return db;
  }
}

// 简单的事件目标模拟
class EventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  removeEventListener(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  }

  dispatchEvent(event) {
    if (!this.listeners[event.type]) return true;
    this.listeners[event.type].forEach(callback => callback(event));
    return !event.defaultPrevented;
  }
}

// 模拟ObjectStoreNames
class ObjectStoreNames {
  constructor() {
    this.storeNames = [];
  }

  contains(name) {
    return this.storeNames.includes(name);
  }

  add(name) {
    if (!this.contains(name)) {
      this.storeNames.push(name);
    }
  }

  remove(name) {
    const index = this.storeNames.indexOf(name);
    if (index !== -1) {
      this.storeNames.splice(index, 1);
    }
  }

  get length() {
    return this.storeNames.length;
  }

  item(index) {
    return this.storeNames[index] || null;
  }
}

// 模拟IDBRequest
class IDBRequest extends EventTarget {
  constructor() {
    super();
    this.result = null;
    this.error = null;
    this.source = null;
    this.transaction = null;
    this.readyState = 'pending';
  }
}

// 模拟navigator
const navigatorMock = {
  userAgent: 'Mozilla/5.0 (Node.js) Jest Test Environment',
  deviceMemory: 8,
  onLine: true
};

// 模拟performance API
const performanceMock = {
  now: () => Date.now(),
  memory: {
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    totalJSHeapSize: 512 * 1024 * 1024,      // 512MB
    usedJSHeapSize: 256 * 1024 * 1024        // 256MB
  }
};

// 模拟window对象
const windowMock = {
  localStorage: new LocalStorageMock(),
  sessionStorage: new SessionStorageMock(),
  indexedDB: new IndexedDBMock(),
  navigator: navigatorMock,
  performance: performanceMock,
  
  addEventListener: (type, handler) => {
    // 模拟事件监听
  },
  
  removeEventListener: (type, handler) => {
    // 模拟事件移除
  },
  
  dispatchEvent: (event) => {
    // 模拟事件触发
    return true;
  },
  
  gc: function() {
    global.gc && global.gc();
  }
};

// 导出模拟
module.exports = {
  setupMocks: function() {
    // 设置全局变量
    global.localStorage = windowMock.localStorage;
    global.sessionStorage = windowMock.sessionStorage;
    global.indexedDB = windowMock.indexedDB;
    global.navigator = navigatorMock;
    global.performance = performanceMock;
    global.window = windowMock;

    // 模拟document对象
    global.document = {
      createElement: (tag) => ({
        style: {},
        setAttribute: () => {},
        appendChild: () => {}
      }),
      head: {
        appendChild: () => {},
        removeChild: () => {}
      },
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    };

    // 设置Event类
    global.Event = class Event {
      constructor(type) {
        this.type = type;
        this.defaultPrevented = false;
      }
      
      preventDefault() {
        this.defaultPrevented = true;
      }
    };

    // 设置其他必要的全局变量
    global.setTimeout = setTimeout;
    global.clearTimeout = clearTimeout;
    global.console = console;

    // 返回清理函数
    return () => {
      delete global.localStorage;
      delete global.sessionStorage;
      delete global.indexedDB;
      delete global.navigator;
      delete global.performance;
      delete global.window;
      delete global.document;
      delete global.Event;
    };
  }
}; 