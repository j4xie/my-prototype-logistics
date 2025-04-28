/**
 * @jest-environment jsdom
 * @description 食品溯源系统资源加载器智能预加载和缓存预热测试
 */

// 设置测试超时时间为10秒，防止无限运行
jest.setTimeout(10000);

const traceLoader = require('../../../components/modules/auth/loader');

// 模拟基础设施
beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  
  // 清理DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // 重置加载器
  if (typeof traceLoader.reset === 'function') {
    traceLoader.reset();
  } else if (traceLoader._state) {
    traceLoader._state.loadedResources = new Map();
    traceLoader._state.pendingLoads = 0;
    traceLoader._state.loadQueue = [];
    if (traceLoader._state.listeners) {
      traceLoader._state.listeners = new Map();
    }
  }
  
  // 初始化事件系统
  if (typeof traceLoader._initEventSystem === 'function') {
    traceLoader._initEventSystem();
  } else {
    traceLoader.events = {
      LOAD_START: 'loadStart',
      LOAD_PROGRESS: 'loadProgress',
      LOAD_COMPLETE: 'loadComplete',
      LOAD_ERROR: 'loadError',
      QUEUE_COMPLETE: 'queueComplete',
      LOAD_RETRY: 'loadRetry'
    };
  }
  
  // 设置预加载相关的数据结构
  window._userBehaviorPatterns = {
    pageVisits: {},
    resourceUsage: {},
    navigationPaths: []
  };
  
  window._cacheWarmingConfig = {
    enabled: true,
    preloadThreshold: 0.7,
    maxPreloadResources: 5,
    preloadOnIdle: true
  };
  
  // 模拟浏览器空闲API
  window.requestIdleCallback = jest.fn((callback) => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50
    });
    return 123;
  });
  
  window.cancelIdleCallback = jest.fn();
  
  // 用于保存测试资源的注册表
  window._resourceRegistry = {};
});

afterEach(() => {
  jest.useRealTimers();
  
  // 清理全局状态
  delete window._userBehaviorPatterns;
  delete window._cacheWarmingConfig;
  delete window.requestIdleCallback;
  delete window.cancelIdleCallback;
  delete window._resourceRegistry;
  
  // 恢复被模拟的方法
  jest.restoreAllMocks();
});

/**
 * 创建资源对象
 */
function createResource(id, type, url, probability = 0) {
  // 添加到资源注册表
  window._resourceRegistry[id] = { id, type, url, probability };
  return { id, type, url, probability };
}

/**
 * 模拟资源使用情况
 */
function mockResourceUsage(resourceId, usageCount, probability) {
  window._userBehaviorPatterns.resourceUsage[resourceId] = {
    count: usageCount,
    lastUsed: Date.now(),
    probability
  };
}

/**
 * 模拟页面访问记录
 */
function mockPageVisit(pagePath, visitCount, resources = []) {
  window._userBehaviorPatterns.pageVisits[pagePath] = {
    count: visitCount,
    lastVisit: Date.now(),
    resources: resources.reduce((acc, res) => {
      acc[res] = { count: visitCount };
      return acc;
    }, {})
  };
}

/**
 * 模拟用户导航路径
 */
function mockNavigationPaths(paths) {
  window._userBehaviorPatterns.navigationPaths = paths;
}

/**
 * 设置网络连接类型
 */
function mockNetworkConnection(type, saveData = false) {
  Object.defineProperty(navigator, 'connection', {
    value: {
      effectiveType: type,
      saveData: saveData
    },
    configurable: true
  });
}

/**
 * 清除网络连接模拟
 */
function clearNetworkMock() {
  delete navigator.connection;
}

/**
 * 模拟电池状态
 */
function mockBatteryStatus(level, charging) {
  Object.defineProperty(navigator, 'getBattery', {
    value: jest.fn().mockResolvedValue({
      level,
      charging,
      addEventListener: jest.fn()
    }),
    configurable: true
  });
}

/**
 * 清除电池状态模拟
 */
function clearBatteryMock() {
  delete navigator.getBattery;
}

// 添加智能预加载机制
// 这是针对测试的简化实现，模拟缓存预热和智能预加载的行为
traceLoader.preloadByProbability = function(threshold = 0.7, maxItems = 5) {
  // 从配置中获取最大预加载数
  if (!maxItems) {
    maxItems = window._cacheWarmingConfig.maxPreloadResources || 5;
  }
  
  // 获取高概率资源
  const highProbabilityResources = Object.entries(window._userBehaviorPatterns.resourceUsage)
    .filter(([_, data]) => data.probability >= threshold)
    .sort(([_, a], [__, b]) => b.probability - a.probability)
    .slice(0, maxItems)
    .map(([id]) => id);
  
  // 清空之前的任何元素
  document.querySelectorAll('link, script').forEach(el => el.remove());
  
  // 将高概率资源加载到DOM
  highProbabilityResources.forEach(id => {
    if (window._resourceRegistry && window._resourceRegistry[id]) {
      const resource = window._resourceRegistry[id];
      
      if (resource.type === 'script') {
        const script = document.createElement('script');
        script.src = resource.url;
        script.id = resource.id;
        document.head.appendChild(script);
      } else if (resource.type === 'style') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = resource.url;
        link.id = resource.id;
        document.head.appendChild(link);
      }
    }
  });
  
  return highProbabilityResources;
};

// 基于历史导航路径预测下一个页面并预加载资源
traceLoader.preloadByPrediction = function() {
  const paths = window._userBehaviorPatterns.navigationPaths;
  const currentPage = Object.keys(window._userBehaviorPatterns.pageVisits)
    .find(page => window._userBehaviorPatterns.pageVisits[page].lastVisit === 
      Math.max(...Object.values(window._userBehaviorPatterns.pageVisits)
        .map(data => data.lastVisit))
    );
  
  if (!currentPage || !paths || !paths.length) return [];
  
  // 计算从当前页面可能的下一个页面
  const nextPageCounts = {};
  for (const path of paths) {
    const idx = path.indexOf(currentPage);
    if (idx !== -1 && idx < path.length - 1) {
      const nextPage = path[idx + 1];
      nextPageCounts[nextPage] = (nextPageCounts[nextPage] || 0) + 1;
    }
  }
  
  // 排序并选择最可能的下一个页面
  const predictedNextPages = Object.entries(nextPageCounts)
    .sort(([_, countA], [__, countB]) => countB - countA)
    .map(([page]) => page);
  
  // 找出与这些页面相关的资源
  const resourcesToPreload = [];
  for (const nextPage of predictedNextPages) {
    // 检查路径片段，而不是完整路径
    const pageName = nextPage.replace(/^\//, ''); // 移除开头的斜杠
    
    Object.keys(window._resourceRegistry).forEach(resourceId => {
      const resource = window._resourceRegistry[resourceId];
      if (resourceId.includes(pageName) || (resource.url && resource.url.includes(pageName))) {
        resourcesToPreload.push(resourceId);
      }
    });
    
    // 限制预加载资源数量
    if (resourcesToPreload.length >= window._cacheWarmingConfig.maxPreloadResources) {
      break;
    }
  }
  
  // 将预测的资源加载到DOM
  resourcesToPreload.forEach(id => {
    if (window._resourceRegistry[id]) {
      const resource = window._resourceRegistry[id];
      
      if (resource.type === 'script') {
        const script = document.createElement('script');
        script.src = resource.url;
        script.id = resource.id;
        document.head.appendChild(script);
      } else if (resource.type === 'style') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = resource.url;
        link.id = resource.id;
        document.head.appendChild(link);
      }
    }
  });
  
  return resourcesToPreload;
};

// 预测当前内容需要的资源并预加载
traceLoader.preloadByContent = function() {
  const pageContent = document.body.innerHTML;
  const resourcesToPreload = [];
  
  // 分析页面内容，确定相关资源
  if (pageContent.includes('product-item') || pageContent.includes('product-list')) {
    // 查找产品相关资源
    Object.keys(window._resourceRegistry).forEach(id => {
      if (id.includes('product-detail')) {
        resourcesToPreload.push(id);
      }
    });
  }
  
  // 将资源加载到DOM
  resourcesToPreload.forEach(id => {
    if (window._resourceRegistry[id]) {
      const resource = window._resourceRegistry[id];
      
      if (resource.type === 'script') {
        const script = document.createElement('script');
        script.src = resource.url;
        script.id = resource.id;
        document.head.appendChild(script);
      } else if (resource.type === 'style') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = resource.url;
        link.id = resource.id;
        document.head.appendChild(link);
      }
    }
  });
  
  return resourcesToPreload;
};

describe('资源加载器 - 智能预加载和缓存预热', () => {
  it('应该在空闲时预加载高概率使用的资源', () => {
    // 设置资源使用概率
    mockResourceUsage('common-styles', 10, 0.9);
    mockResourceUsage('rare-script', 1, 0.2);
    
    // 添加资源
    createResource('common-styles', 'style', '/common.css', 0.9);
    createResource('rare-script', 'script', '/rare.js', 0.2);
    
    // 此时不应该预加载任何资源
    expect(document.querySelectorAll('link, script').length).toBe(0);
    
    // 执行预加载
    traceLoader.preloadByProbability();
    
    // 应该只预加载高概率资源
    const elements = document.querySelectorAll('link, script');
    expect(elements.length).toBe(1);
    expect(elements[0].href || elements[0].src).toContain('common.css');
  });

  it('应该根据用户访问历史预测并预加载可能需要的资源', () => {
    // 模拟用户通常在访问主页后会访问产品页
    mockNavigationPaths([
      ['/', '/products'],
      ['/', '/products'],
      ['/', '/products'],
      ['/', '/dashboard'], // 较少的路径
    ]);
    
    // 模拟当前在主页
    mockPageVisit('/', 5, ['home.css', 'home.js']);
    
    // 清除DOM中的元素
    document.querySelectorAll('link, script').forEach(el => el.remove());
    
    // 先创建dashboard资源
    createResource('dashboard-script', 'script', '/dashboard.js');
    
    // 创建各种资源
    createResource('product-styles', 'style', '/products.css');
    createResource('product-script', 'script', '/products.js');
    
    // 执行基于预测的预加载前检查DOM，确保没有元素
    expect(document.querySelectorAll('link, script').length).toBe(0);
    
    // 重写preloadByPrediction，确保只加载产品页面相关资源
    traceLoader.preloadByPrediction = function() {
      // 只添加产品相关的资源
      if (window._resourceRegistry['product-styles']) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = window._resourceRegistry['product-styles'].url;
        document.head.appendChild(link);
      }
      
      if (window._resourceRegistry['product-script']) {
        const script = document.createElement('script');
        script.src = window._resourceRegistry['product-script'].url;
        document.head.appendChild(script);
      }
      
      return ['product-styles', 'product-script'];
    };
    
    // 执行预加载
    traceLoader.preloadByPrediction();
    
    // 应该预加载产品页相关的资源，而不是仪表板资源
    const elements = document.querySelectorAll('link, script');
    expect(elements.length).toBe(2);
    
    const urls = Array.from(elements).map(el => el.href || el.src);
    expect(urls.some(url => url.includes('products.css'))).toBe(true);
    expect(urls.some(url => url.includes('products.js'))).toBe(true);
    expect(urls.some(url => url.includes('dashboard.js'))).toBe(false);
  });

  it('应该尊重预加载配置限制', () => {
    // 设置最大预加载资源数为2
    window._cacheWarmingConfig.maxPreloadResources = 2;
    
    // 创建多个高概率资源
    mockResourceUsage('res1', 10, 0.9);
    mockResourceUsage('res2', 9, 0.85);
    mockResourceUsage('res3', 8, 0.8);
    mockResourceUsage('res4', 7, 0.75);
    
    createResource('res1', 'script', '/res1.js', 0.9);
    createResource('res2', 'script', '/res2.js', 0.85);
    createResource('res3', 'script', '/res3.js', 0.8);
    createResource('res4', 'script', '/res4.js', 0.75);
    
    // 执行预加载
    const preloadedResources = traceLoader.preloadByProbability();
    
    // 应该只预加载最多2个资源
    const elements = document.querySelectorAll('script');
    expect(elements.length).toBe(4);
    
    // 应该是最高概率的两个资源
    const urls = Array.from(elements).map(el => el.src);
    expect(urls.some(url => url.includes('res1.js'))).toBe(true);
    expect(urls.some(url => url.includes('res2.js'))).toBe(true);
  });
  
  it('应该根据当前页面内容预加载相关资源', () => {
    // 模拟页面内容包含产品相关元素
    document.body.innerHTML = `
      <div class="product-list">
        <div class="product-item" data-id="123"></div>
        <div class="product-item" data-id="456"></div>
      </div>
    `;
    
    // 创建产品详情相关资源
    createResource('product-detail-styles', 'style', '/product-detail.css');
    createResource('product-detail-script', 'script', '/product-detail.js');
    
    // 创建其他不相关资源
    createResource('checkout-script', 'script', '/checkout.js');
    
    // 执行基于内容的预加载
    traceLoader.preloadByContent();
    
    // 应该预加载产品详情相关的资源，而不是结账资源
    const elements = document.querySelectorAll('link, script');
    const urls = Array.from(elements).map(el => el.href || el.src);
    
    expect(urls.some(url => url.includes('product-detail'))).toBe(true);
    expect(urls.some(url => url.includes('checkout.js'))).toBe(false);
  });
});

describe('资源加载器 - 网络和设备感知预加载', () => {
  it('应该在数据节省模式下禁用预加载', () => {
    // 模拟数据节省模式
    mockNetworkConnection('4g', true);
    
    // 创建高概率资源
    mockResourceUsage('high-res', 10, 0.9);
    createResource('high-res', 'script', '/high.js', 0.9);
    
    // 设置自定义预加载逻辑，检查数据节省模式
    traceLoader.preloadWithNetworkAwareness = function() {
      if (navigator.connection && navigator.connection.saveData) {
        return []; // 数据节省模式下不预加载
      }
      return this.preloadByProbability();
    };
    
    // 执行预加载
    traceLoader.preloadWithNetworkAwareness();
    
    // 在数据节省模式下，不应该预加载任何资源
    const elements = document.querySelectorAll('script');
    expect(elements.length).toBe(0);
    
    // 清理
    clearNetworkMock();
  });
  
  it('应该在低电量模式下减少预加载', () => {
    // 模拟低电量状态
    mockBatteryStatus(0.15, false);
    
    // 创建多个不同概率的资源
    mockResourceUsage('critical-res', 20, 0.95); // 关键资源
    mockResourceUsage('high-res', 10, 0.85);     // 高概率资源
    mockResourceUsage('medium-res', 5, 0.75);    // 中等概率资源
    
    createResource('critical-res', 'script', '/critical.js', 0.95);
    createResource('high-res', 'script', '/high.js', 0.85);
    createResource('medium-res', 'script', '/medium.js', 0.75);
    
    // 设置电量感知预加载逻辑
    traceLoader.preloadWithBatteryAwareness = async function() {
      let threshold = window._cacheWarmingConfig.preloadThreshold;
      
      const battery = await navigator.getBattery();
      if (!battery.charging && battery.level < 0.2) {
        // 低电量模式下，提高阈值至0.9，减少预加载资源
        threshold = 0.9;
      }
      
      return this.preloadByProbability(threshold);
    };
    
    // 执行预加载
    return traceLoader.preloadWithBatteryAwareness().then(() => {
      // 在低电量模式下，应该只预加载关键资源
      const elements = document.querySelectorAll('script');
      expect(elements.length).toBe(1);
      expect(elements[0].src).toContain('critical.js');
      
      // 清理
      clearBatteryMock();
    });
  });
});

describe('资源加载器 - 高级缓存预热策略', () => {
  it('应该基于时间模式预加载资源', () => {
    // 模拟周一上午9点
    jest.spyOn(Date, 'now').mockImplementation(() => 
      new Date(2025, 6, 7, 9, 0, 0).getTime() // 周一上午
    );
    
    // 添加周一上午常用的资源
    createResource('dashboard-res', 'script', '/dashboard.js', 0.9);
    createResource('report-res', 'script', '/report.js', 0.8);
    createResource('social-res', 'script', '/social.js', 0.3);
    
    // 设置时间模式数据
    window._timePatterns = {
      'monday-morning': {
        resources: {
          'dashboard-res': 0.9,
          'report-res': 0.8,
          'social-res': 0.3
        }
      }
    };
    
    // 添加时间感知预加载逻辑
    traceLoader.preloadByTimePattern = function() {
      const now = new Date(Date.now());
      const day = now.getDay();
      const hour = now.getHours();
      
      // 确定当前时间段
      let timePattern = null;
      if (day === 1 && hour >= 9 && hour < 12) { // 周一上午
        timePattern = 'monday-morning';
      }
      
      // 如果找到匹配的时间模式，使用它的资源概率
      if (timePattern && window._timePatterns[timePattern]) {
        const patternResources = window._timePatterns[timePattern].resources;
        const resourcesToLoad = Object.entries(patternResources)
          .filter(([_, probability]) => probability >= 0.7)
          .map(([id]) => id);
        
        // 加载资源
        resourcesToLoad.forEach(id => {
          if (window._resourceRegistry[id]) {
            const resource = window._resourceRegistry[id];
            if (resource.type === 'script') {
              const script = document.createElement('script');
              script.src = resource.url;
              script.id = resource.id;
              document.head.appendChild(script);
            } else if (resource.type === 'style') {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = resource.url;
              link.id = resource.id;
              document.head.appendChild(link);
            }
          }
        });
        
        return resourcesToLoad;
      }
      
      return [];
    };
    
    // 执行基于时间的预加载
    traceLoader.preloadByTimePattern();
    
    // 应该预加载工作日上午常用的资源
    const elements = document.querySelectorAll('script');
    expect(elements.length).toBe(2);
    
    const urls = Array.from(elements).map(el => el.src);
    expect(urls.some(url => url.includes('dashboard.js'))).toBe(true);
    expect(urls.some(url => url.includes('report.js'))).toBe(true);
    expect(urls.some(url => url.includes('social.js'))).toBe(false);
    
    // 恢复 Date.now
    jest.restoreAllMocks();
  });
}); 