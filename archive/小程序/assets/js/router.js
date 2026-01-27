/*
 * 简单路由系统 - 溯源商城高保真原型系统
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.history = [];
  }

  /**
   * 注册路由
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * 批量注册路由
   * @param {Object} routes - 路由配置对象 {path: handler}
   */
  registerAll(routes) {
    Object.entries(routes).forEach(([path, handler]) => {
      this.register(path, handler);
    });
  }

  /**
   * 导航到指定路径
   * @param {string} path - 路径
   * @param {Object} params - 参数
   * @param {Object} options - 选项
   */
  navigate(path, params = {}, options = {}) {
    const { replace = false, state = {} } = options;

    // 添加到历史记录
    if (!replace) {
      this.history.push({
        path: this.currentRoute?.path,
        params: this.currentRoute?.params
      });
    }

    // 更新当前路由
    this.currentRoute = { path, params, state };

    // 执行路由处理函数
    const handler = this.routes.get(path);
    if (handler) {
      handler(params, state);
    } else {
      console.warn(`Route not found: ${path}`);
    }

    // 更新浏览器历史
    const url = this.buildUrl(path, params);
    if (replace) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
  }

  /**
   * 返回上一页
   */
  back() {
    if (this.history.length > 0) {
      const previous = this.history.pop();
      this.navigate(previous.path, previous.params, { replace: true });
    } else {
      window.history.back();
    }
  }

  /**
   * 构建URL
   * @param {string} path - 路径
   * @param {Object} params - 参数
   * @returns {string} URL
   */
  buildUrl(path, params = {}) {
    const searchParams = new URLSearchParams(params);
    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  /**
   * 解析URL参数
   * @returns {Object} 参数对象
   */
  parseParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  }

  /**
   * 获取当前路由
   * @returns {Object} 当前路由信息
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * 获取历史记录
   * @returns {Array} 历史记录
   */
  getHistory() {
    return this.history;
  }

  /**
   * 清空历史记录
   */
  clearHistory() {
    this.history = [];
  }
}

// 创建全局实例
const globalRouter = new Router();

// 监听浏览器前进/后退按钮
window.addEventListener('popstate', (event) => {
  if (event.state) {
    const path = window.location.pathname;
    const params = globalRouter.parseParams();
    globalRouter.navigate(path, params, { replace: true, state: event.state });
  }
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Router, globalRouter };
}
