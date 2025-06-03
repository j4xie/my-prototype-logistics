/**
 * 媒体查询管理系统
 * 统一管理响应式断点和媒体查询
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */

// 标准响应式断点配置（与Tailwind CSS保持一致）
export const BREAKPOINTS = {
  xs: 320,   // 小屏手机
  sm: 640,   // 大屏手机
  md: 768,   // 平板
  lg: 1024,  // 小屏桌面
  xl: 1280,  // 大屏桌面
  '2xl': 1536 // 超大屏
};

// 媒体查询字符串生成器
export const createMediaQuery = (minWidth, maxWidth = null) => {
  if (maxWidth) {
    return `(min-width: ${minWidth}px) and (max-width: ${maxWidth - 1}px)`;
  }
  return `(min-width: ${minWidth}px)`;
};

// 预定义的媒体查询
export const MEDIA_QUERIES = {
  mobile: createMediaQuery(BREAKPOINTS.xs, BREAKPOINTS.md),
  tablet: createMediaQuery(BREAKPOINTS.md, BREAKPOINTS.lg),
  desktop: createMediaQuery(BREAKPOINTS.lg),
  largeDesktop: createMediaQuery(BREAKPOINTS.xl),
  
  // 特殊查询
  mobileOnly: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  tabletAndUp: createMediaQuery(BREAKPOINTS.md),
  desktopAndUp: createMediaQuery(BREAKPOINTS.lg),
  
  // 方向查询
  landscape: '(orientation: landscape)',
  portrait: '(orientation: portrait)',
  
  // 触摸设备检测
  touch: '(hover: none) and (pointer: coarse)',
  noTouch: '(hover: hover) and (pointer: fine)',
  
  // 高分辨率屏幕
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)'
};

/**
 * 媒体查询匹配检测器
 */
export class MediaQueryManager {
  constructor() {
    this.listeners = new Map();
    this.currentMatches = new Map();
    
    // 初始化所有媒体查询的匹配状态
    this.initializeMatches();
  }
  
  /**
   * 初始化媒体查询匹配状态
   */
  initializeMatches() {
    Object.entries(MEDIA_QUERIES).forEach(([key, query]) => {
      if (typeof window !== 'undefined') {
        const mediaQuery = window.matchMedia(query);
        this.currentMatches.set(key, mediaQuery.matches);
        
        // 监听变化
        mediaQuery.addEventListener('change', (e) => {
          this.currentMatches.set(key, e.matches);
          this.notifyListeners(key, e.matches);
        });
      }
    });
  }
  
  /**
   * 检查媒体查询是否匹配
   * @param {string} queryName - 查询名称
   * @returns {boolean}
   */
  matches(queryName) {
    return this.currentMatches.get(queryName) || false;
  }
  
  /**
   * 获取当前屏幕尺寸类别
   * @returns {string}
   */
  getCurrentScreenSize() {
    if (this.matches('mobile')) return 'mobile';
    if (this.matches('tablet')) return 'tablet';
    if (this.matches('desktop')) return 'desktop';
    if (this.matches('largeDesktop')) return 'largeDesktop';
    return 'unknown';
  }
  
  /**
   * 检查是否为移动设备
   * @returns {boolean}
   */
  isMobile() {
    return this.matches('mobileOnly');
  }
  
  /**
   * 检查是否为平板设备
   * @returns {boolean}
   */
  isTablet() {
    return this.matches('tablet');
  }
  
  /**
   * 检查是否为桌面设备
   * @returns {boolean}
   */
  isDesktop() {
    return this.matches('desktopAndUp');
  }
  
  /**
   * 检查是否为触摸设备
   * @returns {boolean}
   */
  isTouchDevice() {
    return this.matches('touch');
  }
  
  /**
   * 检查是否为高分辨率屏幕
   * @returns {boolean}
   */
  isRetina() {
    return this.matches('retina');
  }
  
  /**
   * 添加媒体查询变化监听器
   * @param {string} queryName - 查询名称
   * @param {Function} callback - 回调函数
   */
  addListener(queryName, callback) {
    if (!this.listeners.has(queryName)) {
      this.listeners.set(queryName, new Set());
    }
    this.listeners.get(queryName).add(callback);
  }
  
  /**
   * 移除媒体查询变化监听器
   * @param {string} queryName - 查询名称
   * @param {Function} callback - 回调函数
   */
  removeListener(queryName, callback) {
    const callbacks = this.listeners.get(queryName);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
  
  /**
   * 通知监听器
   * @param {string} queryName - 查询名称
   * @param {boolean} matches - 是否匹配
   */
  notifyListeners(queryName, matches) {
    const callbacks = this.listeners.get(queryName);
    if (callbacks) {
      callbacks.forEach(callback => callback(matches));
    }
  }
  
  /**
   * 获取适合当前屏幕的容器最大宽度
   * @returns {string}
   */
  getContainerMaxWidth() {
    // 严格遵循UI设计系统规范：max-w-[390px]
    return 'max-w-[390px]';
  }
  
  /**
   * 获取适合当前屏幕的网格列数
   * @returns {string}
   */
  getGridColumns() {
    if (this.isMobile()) {
      return 'grid-cols-1';
    } else if (this.isTablet()) {
      return 'grid-cols-2';
    } else {
      return 'grid-cols-2'; // 遵循UI设计系统规范
    }
  }
  
  /**
   * 获取适合当前屏幕的间距
   * @returns {string}
   */
  getSpacing() {
    return this.isMobile() ? 'gap-3' : 'gap-4';
  }
}

// 创建全局实例
export const mediaQueryManager = new MediaQueryManager();

/**
 * React Hook for media queries
 * @param {string} queryName - 查询名称
 * @returns {boolean}
 */
export const useMediaQuery = (queryName) => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const [matches, setMatches] = React.useState(
    mediaQueryManager.matches(queryName)
  );
  
  React.useEffect(() => {
    const handleChange = (newMatches) => {
      setMatches(newMatches);
    };
    
    mediaQueryManager.addListener(queryName, handleChange);
    
    return () => {
      mediaQueryManager.removeListener(queryName, handleChange);
    };
  }, [queryName]);
  
  return matches;
};

/**
 * 获取CSS媒体查询字符串
 * @param {string} queryName - 查询名称
 * @returns {string}
 */
export const getCSSMediaQuery = (queryName) => {
  return MEDIA_QUERIES[queryName] || '';
};

/**
 * 生成响应式CSS类名
 * @param {Object} classMap - 断点到类名的映射
 * @returns {string}
 */
export const generateResponsiveClasses = (classMap) => {
  const classes = [];
  
  Object.entries(classMap).forEach(([breakpoint, className]) => {
    if (breakpoint === 'base') {
      classes.push(className);
    } else {
      classes.push(`${breakpoint}:${className}`);
    }
  });
  
  return classes.join(' ');
};

export default mediaQueryManager; 