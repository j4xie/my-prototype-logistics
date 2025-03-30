/**
 * 食品溯源系统 - Service Worker
 * 提供离线缓存和网络请求拦截功能
 */

// 缓存名称和版本
const CACHE_NAME = 'trace-app-cache-v1';

// 需要缓存的页面和资源
const CACHE_PAGES = [
  '/',
  '/index.html',
  '/login.html',
  '/home.html',
  '/create-trace.html',
  '/trace-list.html',
  '/trace-detail.html',
  '/assets/styles.css',
  '/components/trace-form-validation.js',
  '/components/trace-data-import.js',
  '/components/trace-blockchain.js',
  '/components/trace-store.js',
  '/components/trace-offline.js',
  '/components/trace-error-handler.js',
  '/components/trace-a11y.js',
  '/components/trace-ux.js',
  '/components/trace-performance.js'
];

// 缓存的API路由（用于预缓存模板和产品数据）
const CACHE_API_ROUTES = [
  '/api/templates',
  '/api/products',
  '/api/settings'
];

// Service Worker安装事件
self.addEventListener('install', (event) => {
  console.log('Service Worker 正在安装...');
  
  // 提前缓存核心资源
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('预缓存资源中...');
        return cache.addAll([...CACHE_PAGES, ...CACHE_API_ROUTES]);
      })
      .then(() => {
        console.log('预缓存完成');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('预缓存失败:', error);
      })
  );
});

// Service Worker激活事件
self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活');
  
  // 清理旧缓存
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即接管所有客户端
      return self.clients.claim();
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 不处理第三方请求
  if (!url.origin.includes(self.location.origin)) {
    return;
  }
  
  // 针对API请求的处理策略：网络优先，失败后使用缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // 针对HTML页面的处理策略：网络优先
  if (event.request.headers.get('Accept').includes('text/html')) {
    event.respondWith(handleHtmlRequest(event.request));
    return;
  }
  
  // 针对静态资源的处理策略：缓存优先，失败后使用网络
  event.respondWith(handleStaticAsset(event.request));
});

// 处理API请求
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 尝试从网络获取最新数据
    const response = await fetch(request);
    
    // 如果成功获取响应，则更新缓存
    if (response.status === 200) {
      cache.put(request, response.clone());
      
      // 通知客户端数据已更新
      notifyClientsDataUpdated(request.url, 'api');
    }
    
    return response;
  } catch (error) {
    console.log('API请求失败，尝试从缓存获取:', request.url);
    
    // 如果网络请求失败，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果缓存中也没有，返回自定义的错误响应
    return createOfflineResponse(request.url);
  }
}

// 处理HTML请求
async function handleHtmlRequest(request) {
  try {
    // 尝试从网络获取最新页面
    const response = await fetch(request);
    
    // 如果成功获取响应，则更新缓存
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('HTML请求失败，尝试从缓存获取:', request.url);
    
    // 如果网络请求失败，尝试从缓存获取
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果缓存中也没有，返回离线页面
    return cache.match('/login.html') || createOfflineResponse();
  }
}

// 处理静态资源
async function handleStaticAsset(request) {
  // 先从缓存中查找
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // 异步更新缓存 (Cache then Network策略的变体)
    updateCache(request);
    return cachedResponse;
  }
  
  // 如果缓存中没有，则从网络获取
  try {
    const response = await fetch(request);
    
    // 如果获取成功，则缓存响应
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('静态资源请求失败:', request.url);
    
    // 返回默认的离线图片或者JSON
    if (request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
      return caches.match('/assets/offline-image.svg') || createOfflineResponse();
    }
    
    return createOfflineResponse();
  }
}

// 异步更新缓存
async function updateCache(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request);
    
    if (response.status === 200) {
      await cache.put(request, response);
      
      // 如果是重要的数据文件（如JSON），通知客户端数据已更新
      if (request.url.match(/\.(json)$/)) {
        notifyClientsDataUpdated(request.url, 'data');
      }
    }
  } catch (error) {
    console.log('后台更新缓存失败:', request.url);
  }
}

// 创建离线响应
function createOfflineResponse(url) {
  if (url && url.endsWith('.json')) {
    return new Response(JSON.stringify({
      error: 'offline',
      message: '当前处于离线状态，无法获取数据'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>离线状态 - 食品溯源系统</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background-color: #f7f8fa;
          color: #333;
          text-align: center;
          padding: 0 20px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        h1 {
          margin-bottom: 16px;
        }
        p {
          margin-bottom: 24px;
          color: #666;
        }
        button {
          background-color: #00467F;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="icon">📶</div>
      <h1>您正在离线模式下浏览</h1>
      <p>当前处于离线状态，无法获取最新数据。部分功能可能受限。</p>
      <button onclick="window.location.reload()">重新连接</button>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}

// 通知所有客户端数据已更新
function notifyClientsDataUpdated(url, type) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_UPDATED',
        data: {
          url,
          type,
          timestamp: Date.now()
        }
      });
    });
  });
}

// 监听来自客户端的消息
self.addEventListener('message', (event) => {
  const { action, data } = event.data || {};
  
  if (action === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (action === 'CACHE_URLS') {
    // 缓存客户端请求的URLs
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(data.urls || []);
      })
    );
  } else if (action === 'CLEAR_CACHE') {
    // 清理缓存
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        return caches.open(CACHE_NAME);
      }).then(cache => {
        return cache.addAll(CACHE_PAGES);
      })
    );
  }
}); 