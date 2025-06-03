/**
 * @file 浏览器检测集成示例
 * @description 演示如何在实际应用中集成和使用浏览器检测功能
 * @version 1.0.0
 */

import BrowserDetector from './browser-detector';
import BrowserDetectorUtils from './browser-detector-utils';

/**
 * 应用配置管理器
 * 根据浏览器环境自动调整应用配置
 */
export class AppConfigManager {
  constructor() {
    this.detector = new BrowserDetector();
    this.initializeBrowserFeatures();
    this.config = this.generateAppConfig();
  }

  /**
   * 初始化浏览器特性检测
   */
  initializeBrowserFeatures() {
    this.detector.initialize();
    this.detector.detect();
    
    // 记录浏览器检测结果到控制台
    console.log('浏览器类型:', this.detector.browserName);
    console.log('浏览器版本:', this.detector.browserVersion);
    console.log('设备类型:', this.detector.deviceType);
    console.log('操作系统:', this.detector.operatingSystem);
  }

  /**
   * 生成应用配置
   * @returns {Object} 应用配置对象
   */
  generateAppConfig() {
    // 获取性能配置
    const performanceConfig = BrowserDetectorUtils.generatePerformanceConfig();
    
    // 合并检测到的特性和性能配置
    return {
      features: this.detector.features,
      performance: performanceConfig,
      ui: this.generateUIConfig(),
      media: this.generateMediaConfig(),
      network: this.generateNetworkConfig()
    };
  }

  /**
   * 生成UI配置
   * @returns {Object} UI配置对象
   */
  generateUIConfig() {
    const config = {
      theme: BrowserDetectorUtils.isDarkMode() ? 'dark' : 'light',
      animations: true,
      transitionDuration: '300ms',
      fontScale: 1,
      highContrastMode: false,
      reducedMotion: BrowserDetectorUtils.isLowPowerMode(),
      touchOptimized: BrowserDetectorUtils.supportsTouchEvents(),
      useNativeControls: BrowserDetectorUtils.isMobileDevice()
    };

    // 为旧版浏览器禁用复杂动画
    if (this.detector.browserName === 'IE' || 
        (this.detector.browserName === 'Safari' && parseFloat(this.detector.browserVersion) < 10)) {
      config.animations = false;
      config.transitionDuration = '0ms';
    }

    // 低端设备禁用特效
    if (BrowserDetectorUtils.getDeviceMemory() <= 2 || 
        BrowserDetectorUtils.getHardwareConcurrency() <= 2) {
      config.animations = false;
      config.reducedMotion = true;
    }

    return config;
  }

  /**
   * 生成媒体配置
   * @returns {Object} 媒体配置对象
   */
  generateMediaConfig() {
    const isHighEndDevice = BrowserDetectorUtils.getDeviceMemory() >= 4 && 
                           BrowserDetectorUtils.getHardwareConcurrency() >= 4;
    
    const config = {
      autoplay: !BrowserDetectorUtils.isMobileDevice() || isHighEndDevice,
      preload: BrowserDetectorUtils.getNetworkType() === '4g' ? 'auto' : 'metadata',
      imageQuality: 'medium',
      videoQuality: 'auto',
      useWebP: false,
      maxImageDimension: 1920,
      lazyLoadImages: true,
      lazyLoadThreshold: 0.5
    };

    // 检查WebP支持
    BrowserDetectorUtils.supportsWebP().then(supportsWebP => {
      config.useWebP = supportsWebP;
    });

    // 根据设备类型调整图片质量
    if (BrowserDetectorUtils.isMobileDevice()) {
      config.maxImageDimension = 1280;
      if (BrowserDetectorUtils.getNetworkType() !== '4g') {
        config.imageQuality = 'low';
        config.maxImageDimension = 800;
      }
    } else if (isHighEndDevice) {
      config.imageQuality = 'high';
      config.maxImageDimension = 2560;
    }

    return config;
  }

  /**
   * 生成网络配置
   * @returns {Object} 网络配置对象
   */
  generateNetworkConfig() {
    const networkType = BrowserDetectorUtils.getNetworkType();
    
    return {
      batchRequests: true,
      requestTimeout: networkType === 'slow-2g' ? 60000 : 
                      networkType === '2g' ? 30000 : 
                      networkType === '3g' ? 15000 : 10000,
      retryCount: networkType === '4g' ? 1 : 2,
      retryDelay: networkType === 'slow-2g' ? 5000 : 
                 networkType === '2g' ? 3000 : 
                 networkType === '3g' ? 2000 : 1000,
      cacheStrategy: 'network-first',
      prefetchEnabled: networkType === '4g' || networkType === '3g',
      offlineMode: false,
      compressionEnabled: networkType !== '4g'
    };
  }

  /**
   * 应用配置到DOM
   */
  applyConfigToDOM() {
    // 应用主题
    document.documentElement.classList.toggle('dark-theme', this.config.ui.theme === 'dark');
    document.documentElement.classList.toggle('reduced-motion', this.config.ui.reducedMotion);
    document.documentElement.classList.toggle('touch-device', this.config.ui.touchOptimized);
    
    // 设置CSS变量
    document.documentElement.style.setProperty('--transition-duration', this.config.ui.transitionDuration);
    document.documentElement.style.setProperty('--font-scale', this.config.ui.fontScale);
    
    // 添加浏览器和设备类标识符
    document.documentElement.classList.add(`browser-${this.detector.browserName.toLowerCase()}`);
    document.documentElement.classList.add(`device-${this.detector.deviceType.toLowerCase()}`);
    document.documentElement.classList.add(`os-${this.detector.operatingSystem.toLowerCase().replace(/\s+/g, '-')}`);
  }

  /**
   * 加载浏览器特定的polyfills
   * @returns {Promise<void>} 加载完成的Promise
   */
  async loadBrowserSpecificPolyfills() {
    const polyfills = [];
    
    // IE11 polyfills
    if (this.detector.browserName === 'IE' && parseInt(this.detector.browserVersion) === 11) {
      polyfills.push(
        import('./polyfills/promise-polyfill'),
        import('./polyfills/fetch-polyfill'),
        import('./polyfills/array-polyfill')
      );
    }
    
    // 旧版Safari polyfills
    if (this.detector.browserName === 'Safari' && parseFloat(this.detector.browserVersion) < 10) {
      polyfills.push(
        import('./polyfills/intersection-observer-polyfill')
      );
    }
    
    // 根据特性检测加载polyfills
    if (!this.detector.features.WebAnimations) {
      polyfills.push(import('./polyfills/web-animations-polyfill'));
    }
    
    if (!this.detector.features.IntersectionObserver) {
      polyfills.push(import('./polyfills/intersection-observer-polyfill'));
    }
    
    if (!this.detector.features.ResizeObserver) {
      polyfills.push(import('./polyfills/resize-observer-polyfill'));
    }
    
    // 等待所有polyfills加载完成
    try {
      await Promise.all(polyfills);
      console.log('所有必要的polyfills已加载完成');
    } catch (error) {
      console.error('加载polyfills时出错:', error);
    }
  }

  /**
   * 注册事件监听器
   */
  registerEventListeners() {
    // 监听暗模式变化
    if (window.matchMedia) {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', e => {
          this.config.ui.theme = e.matches ? 'dark' : 'light';
          this.applyConfigToDOM();
        });
      }
    }
    
    // 监听网络状态变化
    if (navigator.connection) {
      BrowserDetectorUtils.createEventListener(navigator.connection, 'change', () => {
        this.config.network = this.generateNetworkConfig();
        console.log('网络配置已更新:', this.config.network);
      });
    }
    
    // 监听设备方向变化
    BrowserDetectorUtils.createEventListener(window, 'orientationchange', () => {
      // 更新触摸优化设置
      this.config.ui.touchOptimized = BrowserDetectorUtils.supportsTouchEvents();
      this.applyConfigToDOM();
    });
  }
}

/**
 * 资源加载器类
 * 根据浏览器环境优化资源加载
 */
export class OptimizedResourceLoader {
  constructor(appConfig) {
    this.config = appConfig;
    this.resourceQueue = [];
    this.isLoading = false;
  }

  /**
   * 加载图片资源
   * @param {string} url 图片URL
   * @param {Object} options 选项
   * @returns {Promise<HTMLImageElement>} 加载完成的Promise
   */
  loadImage(url, options = {}) {
    // 应用WebP优化如果支持
    if (this.config.media.useWebP && url.match(/\.(jpe?g|png)$/i)) {
      url = url.replace(/\.(jpe?g|png)$/i, '.webp');
    }
    
    // 应用图片尺寸限制
    if (options.resize !== false && url.includes('?')) {
      url += `&maxWidth=${this.config.media.maxImageDimension}`;
    } else if (options.resize !== false) {
      url += `?maxWidth=${this.config.media.maxImageDimension}`;
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  }

  /**
   * 预加载关键资源
   * @param {Array<string>} resources 资源URL数组
   */
  preloadCriticalResources(resources) {
    // 如果在低端网络上，则减少预加载
    if (!this.config.network.prefetchEnabled) {
      console.log('由于网络条件，跳过预加载');
      return;
    }
    
    resources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      
      if (url.match(/\.(css)$/i)) {
        link.as = 'style';
      } else if (url.match(/\.(jpe?g|png|gif|webp|svg)$/i)) {
        link.as = 'image';
      } else if (url.match(/\.(js)$/i)) {
        link.as = 'script';
      } else if (url.match(/\.(woff2?|ttf|otf|eot)$/i)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      }
      
      link.href = url;
      document.head.appendChild(link);
    });
  }

  /**
   * 加载JavaScript资源
   * @param {string} url JavaScript URL
   * @param {Object} options 选项
   * @returns {Promise<void>} 加载完成的Promise
   */
  loadScript(url, options = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = options.async !== false;
      script.defer = options.defer !== false;
      
      script.onload = () => resolve();
      script.onerror = (error) => reject(error);
      
      document.head.appendChild(script);
    });
  }

  /**
   * 延迟加载非关键资源
   * @param {Array<{url: string, type: string}>} resources 资源数组
   */
  lazyLoadResources(resources) {
    if (!('IntersectionObserver' in window) || !this.config.media.lazyLoadImages) {
      // 如果不支持IntersectionObserver或禁用了懒加载，则立即加载
      resources.forEach(resource => {
        if (resource.type === 'image') {
          this.loadImage(resource.url);
        } else if (resource.type === 'script') {
          this.loadScript(resource.url);
        }
      });
      return;
    }
    
    // 创建观察器
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const resourceId = entry.target.dataset.resourceId;
            const resource = resources.find(r => r.id === resourceId);
            
            if (resource) {
              if (resource.type === 'image') {
                if (entry.target.tagName === 'IMG') {
                  entry.target.src = resource.url;
                } else {
                  entry.target.style.backgroundImage = `url('${resource.url}')`;
                }
              } else if (resource.type === 'script') {
                this.loadScript(resource.url);
              }
              
              // 停止观察此元素
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: this.config.media.lazyLoadThreshold }
    );
    
    // 开始观察具有data-resource-id属性的元素
    document.querySelectorAll('[data-resource-id]').forEach(el => {
      observer.observe(el);
    });
  }
}

/**
 * 创建优化的应用实例
 * @returns {Object} 配置好的应用实例
 */
export function createOptimizedApp() {
  const configManager = new AppConfigManager();
  const resourceLoader = new OptimizedResourceLoader(configManager.config);
  
  // 应用DOM配置
  configManager.applyConfigToDOM();
  
  // 加载浏览器特定的polyfills
  configManager.loadBrowserSpecificPolyfills();
  
  // 注册事件监听器
  configManager.registerEventListeners();
  
  // 预加载关键资源
  resourceLoader.preloadCriticalResources([
    '/css/main.css',
    '/js/vendor.js',
    '/fonts/main.woff2'
  ]);
  
  return {
    config: configManager.config,
    detector: configManager.detector,
    resourceLoader,
    
    /**
     * 应用初始化
     */
    init() {
      console.log('应用已使用优化配置初始化');
      console.log('设备内存:', BrowserDetectorUtils.getDeviceMemory(), 'GB');
      console.log('CPU核心数:', BrowserDetectorUtils.getHardwareConcurrency());
      console.log('网络类型:', BrowserDetectorUtils.getNetworkType());
      
      // 根据设备能力调整UI
      this.adjustUIForDevice();
    },
    
    /**
     * 根据设备能力调整UI
     */
    adjustUIForDevice() {
      const container = document.getElementById('app-container');
      if (!container) return;
      
      // 根据浏览器和设备应用特定的类名
      container.classList.add(`browser-${configManager.detector.browserName.toLowerCase()}`);
      container.classList.add(`device-${configManager.detector.deviceType.toLowerCase()}`);
      
      // 根据性能配置应用样式
      if (!configManager.config.performance.useAnimations) {
        container.classList.add('no-animations');
      }
      
      if (configManager.config.performance.imageQuality === 'low') {
        container.classList.add('low-quality-images');
      }
      
      // 触摸优化
      if (configManager.config.ui.touchOptimized) {
        container.classList.add('touch-optimized');
        
        // 增加按钮和可点击元素的尺寸
        document.querySelectorAll('button, .clickable, a').forEach(el => {
          el.classList.add('touch-target');
        });
      }
    }
  };
}

// 导出默认实例
export default createOptimizedApp(); 