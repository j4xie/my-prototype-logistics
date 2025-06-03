/**
 * @file 浏览器垫片注册表
 * @description 管理垫片模块的元数据和依赖关系
 * @version 1.0.0
 */

/**
 * 默认垫片配置
 * @type {Array<Object>}
 */
export const DEFAULT_POLYFILLS = [
  {
    name: 'promise',
    description: 'Promise API 填充',
    tags: ['core', 'es6'],
    condition: detector => !detector.getFeatures().supportsPromise,
    dependencies: [],
    priority: 100
  },
  {
    name: 'symbol',
    description: 'Symbol API 填充',
    tags: ['core', 'es6'],
    condition: detector => typeof Symbol === 'undefined',
    dependencies: [],
    priority: 90
  },
  {
    name: 'object-assign',
    description: 'Object.assign 方法填充',
    tags: ['core', 'es6'],
    condition: detector => !Object.assign,
    dependencies: [],
    priority: 80
  },
  {
    name: 'array-from',
    description: 'Array.from 方法填充',
    tags: ['core', 'es6'],
    condition: detector => !Array.from,
    dependencies: [],
    priority: 80
  },
  {
    name: 'fetch',
    description: 'Fetch API 填充',
    tags: ['web', 'ajax'],
    condition: detector => !detector.getFeatures().supportsFetch,
    dependencies: ['promise'],
    priority: 70
  },
  {
    name: 'url-search-params',
    description: 'URLSearchParams API 填充',
    tags: ['web', 'url'],
    condition: detector => typeof URLSearchParams === 'undefined',
    dependencies: [],
    priority: 60
  },
  {
    name: 'raf',
    description: 'requestAnimationFrame 填充',
    tags: ['dom', 'animation'],
    condition: detector => !detector.getFeatures().supportsRequestAnimationFrame,
    dependencies: [],
    priority: 60
  },
  {
    name: 'classlist',
    description: 'Element.classList API 填充',
    tags: ['dom'],
    condition: detector => {
      const features = detector.getFeatures();
      return features.isIE || !('classList' in document.documentElement);
    },
    dependencies: [],
    priority: 60
  },
  {
    name: 'indexeddb',
    description: 'IndexedDB API 填充和增强',
    tags: ['storage', 'database'],
    condition: detector => {
      const features = detector.getFeatures();
      return !features.supportsIndexedDB || 
        (features.isSafari && features.isPrivateMode);
    },
    dependencies: [],
    priority: 50
  },
  {
    name: 'localstorage',
    description: 'localStorage API 填充和增强',
    tags: ['storage'],
    condition: detector => !detector.getFeatures().supportsLocalStorage,
    dependencies: [],
    priority: 50
  },
  {
    name: 'ie-xhr',
    description: 'IE XMLHttpRequest 增强',
    tags: ['web', 'ajax', 'browser-specific'],
    condition: detector => detector.getFeatures().isIE,
    dependencies: [],
    priority: 40
  },
  {
    name: 'safari-storage',
    description: 'Safari 私有浏览模式存储修复',
    tags: ['storage', 'browser-specific'],
    condition: detector => {
      const features = detector.getFeatures();
      return features.isSafari && features.isPrivateMode;
    },
    dependencies: [],
    priority: 40
  }
];

/**
 * 垫片注册表类
 * 管理垫片元数据和依赖关系
 */
export class PolyfillRegistry {
  /**
   * 创建垫片注册表实例
   * @param {Array<Object>} initialPolyfills - 初始垫片列表
   */
  constructor(initialPolyfills = []) {
    this.polyfills = {};
    this.categories = {};
    
    // 注册初始垫片
    if (Array.isArray(initialPolyfills) && initialPolyfills.length > 0) {
      initialPolyfills.forEach(polyfill => this.register(polyfill));
    }
  }

  /**
   * 注册垫片
   * @param {Object} polyfill - 垫片配置对象
   * @returns {PolyfillRegistry} 注册表实例，用于链式调用
   */
  register(polyfill) {
    if (!polyfill || !polyfill.name) {
      throw new Error('垫片必须有名称');
    }

    // 存储垫片信息
    this.polyfills[polyfill.name] = {
      ...polyfill,
      dependencies: polyfill.dependencies || [],
      tags: polyfill.tags || [],
      priority: polyfill.priority || 0
    };

    // 更新标签分类
    (polyfill.tags || []).forEach(tag => {
      if (!this.categories[tag]) {
        this.categories[tag] = [];
      }
      if (!this.categories[tag].includes(polyfill.name)) {
        this.categories[tag].push(polyfill.name);
      }
    });

    return this;
  }

  /**
   * 批量注册垫片
   * @param {Array<Object>} polyfills - 垫片配置对象数组
   * @returns {PolyfillRegistry} 注册表实例，用于链式调用
   */
  registerBulk(polyfills) {
    if (!Array.isArray(polyfills)) {
      throw new TypeError('批量注册需要数组参数');
    }

    polyfills.forEach(polyfill => this.register(polyfill));
    return this;
  }

  /**
   * 获取垫片信息
   * @param {string} name - 垫片名称
   * @returns {Object|null} 垫片信息对象，不存在时返回null
   */
  get(name) {
    return this.polyfills[name] || null;
  }

  /**
   * 检查垫片是否存在
   * @param {string} name - 垫片名称
   * @returns {boolean} 是否存在
   */
  has(name) {
    return !!this.polyfills[name];
  }

  /**
   * 获取所有垫片名称
   * @returns {Array<string>} 垫片名称数组
   */
  getAllNames() {
    return Object.keys(this.polyfills);
  }

  /**
   * 获取所有垫片信息
   * @returns {Object} 垫片信息对象，键为垫片名称
   */
  getAll() {
    return { ...this.polyfills };
  }

  /**
   * 获取按标签分类的垫片
   * @param {string} tag - 标签名称
   * @returns {Array<string>} 垫片名称数组
   */
  getByTag(tag) {
    return this.categories[tag] || [];
  }

  /**
   * 获取所有标签
   * @returns {Array<string>} 标签名称数组
   */
  getAllTags() {
    return Object.keys(this.categories);
  }

  /**
   * 获取垫片的依赖项
   * @param {string} name - 垫片名称
   * @returns {Array<string>} 依赖项名称数组
   */
  getDependencies(name) {
    return (this.polyfills[name] && this.polyfills[name].dependencies) || [];
  }

  /**
   * 获取包含传递依赖的完整依赖树
   * @param {string} name - 垫片名称
   * @param {Set<string>} [visited] - 已访问的垫片集合（用于避免循环依赖）
   * @returns {Array<string>} 完整依赖项数组（包含传递依赖）
   */
  getDependencyTree(name, visited = new Set()) {
    if (visited.has(name)) {
      return []; // 避免循环依赖
    }

    visited.add(name);
    const directDeps = this.getDependencies(name);
    const allDeps = [...directDeps];

    directDeps.forEach(dep => {
      const transitiveDeps = this.getDependencyTree(dep, visited);
      transitiveDeps.forEach(tDep => {
        if (!allDeps.includes(tDep)) {
          allDeps.push(tDep);
        }
      });
    });

    return allDeps;
  }

  /**
   * 获取按优先级排序的垫片列表
   * @returns {Array<string>} 按优先级排序的垫片名称数组
   */
  getSortedByPriority() {
    return this.getAllNames()
      .sort((a, b) => {
        const priorityA = this.polyfills[a].priority || 0;
        const priorityB = this.polyfills[b].priority || 0;
        return priorityB - priorityA; // 高优先级在前
      });
  }

  /**
   * 移除垫片
   * @param {string} name - 垫片名称
   * @returns {boolean} 是否成功移除
   */
  remove(name) {
    if (!this.has(name)) {
      return false;
    }

    // 从标签分类中移除
    const tags = this.polyfills[name].tags || [];
    tags.forEach(tag => {
      if (this.categories[tag]) {
        const index = this.categories[tag].indexOf(name);
        if (index !== -1) {
          this.categories[tag].splice(index, 1);
        }
        // 如果分类为空，移除分类
        if (this.categories[tag].length === 0) {
          delete this.categories[tag];
        }
      }
    });

    // 从注册表中移除
    delete this.polyfills[name];
    return true;
  }

  /**
   * 清空注册表
   */
  clear() {
    this.polyfills = {};
    this.categories = {};
  }
}

/**
 * 创建默认注册表实例
 * @returns {PolyfillRegistry} 包含默认垫片的注册表实例
 */
export function createDefaultRegistry() {
  return new PolyfillRegistry(DEFAULT_POLYFILLS);
}

export default PolyfillRegistry; 