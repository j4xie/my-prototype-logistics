/**
 * 食品溯源系统 - 资源加载管理模块
 * 版本: 1.0.0
 */

// 资源加载管理
export const traceLoader = {
  // 缓存已加载的资源
  loadedResources: {},
  
  /**
   * 初始化资源加载器
   */
  init() {
    // 预加载常用图标
    this.preloadIcons(['home', 'record', 'user']);
    
    // 添加错误处理
    window.addEventListener('error', this.handleResourceError.bind(this), true);
    
    console.log('资源加载器已初始化');
    return this;
  },
  
  /**
   * 预加载图标资源
   * @param {Array} iconNames - 图标名称数组
   */
  preloadIcons(iconNames) {
    if (!window.traceRoutes || !window.traceRoutes.getIconPath) {
      // 如果traceRoutes未定义或缺少getIconPath方法，使用默认图标路径
      iconNames.forEach(name => {
        // 计算相对路径
        let iconPath = '';
        const pagePath = window.location.pathname;
        
        if (pagePath.includes('/pages/')) {
          // 在子页面中
          const depth = pagePath.split('/').filter(Boolean).length - 1;
          iconPath = '../'.repeat(depth) + 'assets/icons/';
        } else {
          // 在根目录
          iconPath = './assets/icons/';
        }
        
        const iconUrl = `${iconPath}${name}.svg`;
        this.preloadImage(iconUrl);
      });
      return;
    }
    
    iconNames.forEach(name => {
      // 预加载灰色和蓝色图标
      [false, true].forEach(isActive => {
        const iconUrl = window.traceRoutes.getIconPath(name, isActive);
        this.preloadImage(iconUrl);
      });
    });
  },
  
  /**
   * 预加载图片
   * @param {string} url - 图片URL
   * @returns {Promise} - 加载完成的Promise
   */
  preloadImage(url) {
    if (this.loadedResources[url]) {
      return Promise.resolve(this.loadedResources[url]);
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedResources[url] = img;
        resolve(img);
      };
      img.onerror = (err) => {
        console.error(`图片加载失败: ${url}`, err);
        reject(err);
      };
      img.src = url;
    });
  },
  
  /**
   * 处理资源加载错误
   * @param {Event} event - 错误事件
   */
  handleResourceError(event) {
    if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
      console.error(`资源加载失败: ${event.target.src || event.target.href}`);
      
      // 图标加载错误时使用备用图标
      if (event.target.tagName === 'IMG' && event.target.src.includes('/icons/')) {
        event.preventDefault();
        // 计算备用图标路径
        let fallbackPath = '';
        const pagePath = window.location.pathname;
        
        if (pagePath.includes('/pages/')) {
          // 在子页面中
          const depth = pagePath.split('/').filter(Boolean).length - 1;
          fallbackPath = '../'.repeat(depth) + 'assets/icons/default-icon.svg';
        } else {
          // 在根目录
          fallbackPath = './assets/icons/default-icon.svg';
        }
        
        // 替换为备用图标
        event.target.src = fallbackPath;
        // 使用灰色背景表示异常
        event.target.style.backgroundColor = '#f5f5f5';
        event.target.style.borderRadius = '4px';
        event.target.style.padding = '2px';
      }
    }
  },
  
  /**
   * 加载JavaScript脚本
   * @param {string} url - 脚本URL
   * @returns {Promise} - 加载完成的Promise
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      // 检查脚本是否已加载
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      script.onload = () => {
        resolve();
      };
      
      script.onerror = (err) => {
        console.error(`脚本加载失败: ${url}`, err);
        reject(err);
      };
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 加载CSS样式表
   * @param {string} url - 样式表URL
   * @returns {Promise} - 加载完成的Promise
   */
  loadStylesheet(url) {
    return new Promise((resolve, reject) => {
      // 检查样式表是否已加载
      if (document.querySelector(`link[href="${url}"]`)) {
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      
      link.onload = () => {
        resolve();
      };
      
      link.onerror = (err) => {
        console.error(`样式表加载失败: ${url}`, err);
        reject(err);
      };
      
      document.head.appendChild(link);
    });
  },
  
  /**
   * 批量加载多个资源
   * @param {Object} resources - 资源配置对象 {scripts: [], styles: []}
   * @returns {Promise} - 所有资源加载完成的Promise
   */
  loadResources(resources) {
    const promises = [];
    
    // 加载脚本
    if (resources.scripts && Array.isArray(resources.scripts)) {
      resources.scripts.forEach(url => {
        promises.push(this.loadScript(url));
      });
    }
    
    // 加载样式表
    if (resources.styles && Array.isArray(resources.styles)) {
      resources.styles.forEach(url => {
        promises.push(this.loadStylesheet(url));
      });
    }
    
    return Promise.all(promises);
  }
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceLoader = traceLoader;
} 