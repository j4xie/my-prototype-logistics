/**
 * 自定义Jest环境 - 支持MSW v2.0+
 * 基于 docs/architecture/mock-api-architecture.md 第6节要求
 *
 * 解决MSW Node端所需的Web API polyfills问题：
 * - Response, Request, Headers, fetch
 * - TextEncoder, TextDecoder
 * - ReadableStream, WritableStream, TransformStream
 * - MessageChannel, BroadcastChannel
 * - crypto API
 */
const NodeEnvironment = require('jest-environment-node').default;
const { TextEncoder, TextDecoder } = require('util');

class MSWEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
  }

  async setup() {
    await super.setup();

    // 1. 基础编码API
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;

    // 2. Stream API (Node.js 16.5+)
    try {
      const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
      this.global.ReadableStream = ReadableStream;
      this.global.WritableStream = WritableStream;
      this.global.TransformStream = TransformStream;
    } catch (error) {
      console.warn('⚠️ Node.js stream/web not available, using fallback polyfills');
      // Fallback for older Node versions
      this.global.ReadableStream = class ReadableStream {};
      this.global.WritableStream = class WritableStream {};
      this.global.TransformStream = class TransformStream {};
    }

    // 3. Buffer API
    const { Blob, File } = require('buffer');
    this.global.Blob = Blob;
    this.global.File = File;

    // 4. Fetch API (使用undici)
    try {
      const { Headers, Request, Response, fetch } = require('undici');
      this.global.Headers = Headers;
      this.global.Request = Request;
      this.global.Response = Response;
      this.global.fetch = fetch;
    } catch (error) {
      console.error('❌ Failed to load undici fetch API:', error);
      throw new Error('undici is required for MSW Jest environment');
    }

    // 5. MessageChannel API (MSW内部通信)
    this.global.MessageChannel = class MessageChannel {
      constructor() {
        this.port1 = new MessagePort();
        this.port2 = new MessagePort();
        // 连接两个端口
        this.port1._otherPort = this.port2;
        this.port2._otherPort = this.port1;
      }
    };

    class MessagePort {
      constructor() {
        this.onmessage = null;
        this._listeners = {};
      }

      postMessage(data) {
        // 模拟异步消息传递
        setImmediate(() => {
          if (this._otherPort.onmessage) {
            this._otherPort.onmessage({ data });
          }

          const listeners = this._otherPort._listeners.message || [];
          listeners.forEach(listener => listener({ data }));
        });
      }

      addEventListener(type, listener) {
        if (!this._listeners[type]) {
          this._listeners[type] = [];
        }
        this._listeners[type].push(listener);
      }

      removeEventListener(type, listener) {
        const listeners = this._listeners[type];
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }
    }

        // 6. BroadcastChannel API (MSW事件广播)
    const globalContext = this.global;
    this.global.BroadcastChannel = class BroadcastChannel {
      constructor(name) {
        this.name = name;
        this.onmessage = null;
        this.onmessageerror = null;
        this._listeners = {};

        // 注册到全局频道列表
        if (!globalContext._broadcastChannels) {
          globalContext._broadcastChannels = {};
        }
        if (!globalContext._broadcastChannels[name]) {
          globalContext._broadcastChannels[name] = [];
        }
        globalContext._broadcastChannels[name].push(this);
      }

      postMessage(data) {
        const channels = globalContext._broadcastChannels[this.name] || [];

        setImmediate(() => {
          channels.forEach(channel => {
            if (channel !== this) {
              if (channel.onmessage) {
                channel.onmessage({ data, origin: '*', source: null });
              }

              const listeners = channel._listeners.message || [];
              listeners.forEach(listener => {
                listener({ data, origin: '*', source: null });
              });
            }
          });
        });
      }

      addEventListener(type, listener) {
        if (!this._listeners[type]) {
          this._listeners[type] = [];
        }
        this._listeners[type].push(listener);
      }

      removeEventListener(type, listener) {
        const listeners = this._listeners[type];
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }

      close() {
        const channels = globalContext._broadcastChannels[this.name] || [];
        const index = channels.indexOf(this);
        if (index > -1) {
          channels.splice(index, 1);
        }
      }

      dispatchEvent() { return true; }
    };

    // 7. 加密API (MSW可能需要)
    const crypto = require('crypto');
    this.global.crypto = {
      getRandomValues: (arr) => {
        return crypto.randomFillSync(arr);
      },
      randomUUID: () => crypto.randomUUID(),
      // 基础subtle实现（如果需要更完整的实现可以扩展）
      subtle: {
        digest: async (algorithm, data) => {
          // 基础实现，支持常见的hash算法
          const hash = crypto.createHash(algorithm.replace('-', '').toLowerCase());
          hash.update(data);
          return hash.digest();
        }
      }
    };

    // 8. URL API
    this.global.URL = URL;
    this.global.URLSearchParams = URLSearchParams;

    // 9. 性能API (MSW可能使用)
    this.global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => []
    };

    // 10. ServiceWorker API mock (仅用于类型兼容)
    this.global.ServiceWorker = class ServiceWorker {
      constructor() {
        this.state = 'activated';
        this.scriptURL = '/mockServiceWorker.js';
      }
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
    };

    // 11. Navigator API (部分MSW功能需要)
    this.global.navigator = {
      ...this.global.navigator,
      userAgent: 'Mozilla/5.0 (MSW Jest Environment)',
      serviceWorker: {
        register: () => Promise.resolve({
          installing: null,
          waiting: null,
          active: new this.global.ServiceWorker(),
          scope: '/',
          update: () => Promise.resolve(),
          unregister: () => Promise.resolve(true)
        }),
        ready: Promise.resolve({
          installing: null,
          waiting: null,
          active: new this.global.ServiceWorker(),
          scope: '/'
        })
      }
    };

    // 12. 设置Location对象用于相对URL解析
    this.global.location = {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: ''
    };

    // 13. 包装fetch以支持相对URL
    const originalFetch = this.global.fetch;
    this.global.fetch = (input, init) => {
      // 如果是相对URL，添加baseURL
      if (typeof input === 'string' && input.startsWith('/')) {
        input = 'http://localhost:3000' + input;
      }
      return originalFetch(input, init);
    };

    // Fix undici compatibility issues
    this.global.markResourceTiming = this.global.markResourceTiming || (() => {});
    this.global.clearResourceTimings = this.global.clearResourceTimings || (() => {});

    // Initialize MSW server in Jest Environment
    try {
      // 临时禁用MSW自动初始化，改为手动模式
      console.log('🔧 MSW Jest Environment: Manual initialization mode enabled');
      console.log('📋 Available APIs: fetch, Response, TextEncoder, ReadableStream, MessageChannel, BroadcastChannel, crypto');

      // 预留MSW服务器引用位置
      this.global._mswServer = null;
    } catch (error) {
      console.error('❌ Failed to initialize MSW in Jest environment:', error);
      // Don't throw error, allow tests to continue but log issue
    }
  }

  async teardown() {
    // 🛑 关键修复：停止MSW服务器
    if (this.global._mswServer) {
      try {
        this.global._mswServer.stop();
        delete this.global._mswServer;
        console.log('🛑 MSW server stopped in Jest environment teardown');
      } catch (error) {
        console.error('❌ Error stopping MSW server in teardown:', error);
      }
    }

    // Clean up BroadcastChannel
    if (this.global._broadcastChannels) {
      Object.keys(this.global._broadcastChannels).forEach(name => {
        this.global._broadcastChannels[name].forEach(channel => channel.close());
      });
      delete this.global._broadcastChannels;
    }

    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
}

module.exports = MSWEnvironment;
