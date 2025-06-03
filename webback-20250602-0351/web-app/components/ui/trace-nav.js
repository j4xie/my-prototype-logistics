/**
 * 食品溯源系统 - 导航菜单组件
 * 版本: 1.0.0
 */

const traceNav = {
  /**
   * 初始化导航菜单
   * @param {string} containerId - 容器元素ID
   * @param {string} activeItem - 当前激活的菜单项
   */
  init(containerId = 'nav-container', activeItem = null) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`导航容器不存在: #${containerId}`);
      return;
    }
    
    // 创建导航菜单
    this.createNavMenu(container, activeItem);
    
    // 检查页面顶部是否已有导航
    this.createTopNav();
    
    console.log('导航菜单已初始化');
  },
  
  /**
   * 创建导航菜单
   * @param {Element} container - 容器元素
   * @param {string} activeItem - 当前激活的菜单项
   */
  createNavMenu(container, activeItem) {
    // 创建导航元素
    const nav = document.createElement('nav');
    nav.className = 'trace-nav';
    nav.setAttribute('role', 'navigation');
    
    // 导航项配置
    const menuItems = [
      { id: 'home', text: '首页', icon: 'home', url: this.getHomeUrl() },
      { id: 'farming', text: '种植', icon: 'leaf', url: this.getModuleUrl('farming') },
      { id: 'processing', text: '加工', icon: 'industry', url: this.getModuleUrl('processing') },
      { id: 'logistics', text: '物流', icon: 'truck', url: this.getModuleUrl('logistics') },
      { id: 'trace', text: '溯源', icon: 'qrcode', url: this.getModuleUrl('trace') },
      { id: 'profile', text: '我的', icon: 'user', url: this.getModuleUrl('profile') }
    ];
    
    // 创建菜单HTML
    nav.innerHTML = `
      <div class="trace-nav-container">
        <ul class="trace-nav-list">
          ${menuItems.map(item => this.createNavItem(item, activeItem)).join('')}
        </ul>
      </div>
    `;
    
    // 添加样式
    this.addNavStyles();
    
    // 添加到容器
    container.appendChild(nav);
    
    // 绑定点击事件
    this.bindNavEvents(nav);
  },
  
  /**
   * 创建顶部导航
   */
  createTopNav() {
    // 检查是否已存在顶部导航
    if (document.querySelector('.trace-top-nav')) {
      return;
    }
    
    // 获取页面标题
    const pageTitle = document.title.replace(' - 食品溯源系统', '').trim();
    
    // 创建顶部导航
    const topNav = document.createElement('header');
    topNav.className = 'trace-top-nav';
    
    topNav.innerHTML = `
      <div class="trace-top-nav-container">
        <div class="trace-top-nav-left">
          <button class="trace-top-nav-back" aria-label="返回">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h1 class="trace-top-nav-title">${pageTitle || '食品溯源系统'}</h1>
        </div>
        <div class="trace-top-nav-right">
          <button class="trace-top-nav-button" aria-label="搜索">
            <i class="fas fa-search"></i>
          </button>
          <button class="trace-top-nav-button" aria-label="更多选项">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </div>
      </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .trace-top-nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999;
        background-color: #1890FF;
        color: white;
        height: 56px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .trace-top-nav-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 100%;
        padding: 0 16px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .trace-top-nav-left, .trace-top-nav-right {
        display: flex;
        align-items: center;
      }
      .trace-top-nav-back {
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        padding: 8px;
        margin-right: 8px;
        cursor: pointer;
        border-radius: 50%;
      }
      .trace-top-nav-back:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      .trace-top-nav-title {
        font-size: 18px;
        font-weight: 500;
        margin: 0;
      }
      .trace-top-nav-button {
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        padding: 8px;
        margin-left: 8px;
        cursor: pointer;
        border-radius: 50%;
      }
      .trace-top-nav-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      body {
        padding-top: 56px; /* 为顶部导航预留空间 */
        padding-bottom: 60px; /* 为底部导航预留空间 */
      }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(topNav, document.body.firstChild);
    
    // 绑定返回按钮事件
    const backButton = topNav.querySelector('.trace-top-nav-back');
    backButton.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = this.getHomeUrl();
      }
    });
  },
  
  /**
   * 创建导航项
   * @param {Object} item - 导航项配置
   * @param {string} activeItem - 当前激活的导航项
   * @returns {string} 导航项HTML
   */
  createNavItem(item, activeItem) {
    const isActive = activeItem === item.id || 
                    (activeItem === null && item.id === 'home') ||
                    window.location.pathname.includes(`/${item.id}/`);
    
    return `
      <li class="trace-nav-item ${isActive ? 'active' : ''}">
        <a href="${item.url}" class="trace-nav-link" data-nav-id="${item.id}">
          <i class="fas fa-${item.icon}"></i>
          <span>${item.text}</span>
        </a>
      </li>
    `;
  },
  
  /**
   * 添加导航样式
   */
  addNavStyles() {
    // 检查是否已添加样式
    if (document.getElementById('trace-nav-styles')) {
      return;
    }
    
    // 创建样式元素
    const style = document.createElement('style');
    style.id = 'trace-nav-styles';
    
    // 设置样式
    style.textContent = `
      .trace-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: white;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
        z-index: 900;
      }
      .trace-nav-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      .trace-nav-list {
        display: flex;
        justify-content: space-around;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .trace-nav-item {
        flex: 1;
        text-align: center;
      }
      .trace-nav-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        color: #555;
        text-decoration: none;
        padding: 8px 0;
        transition: color 0.2s;
      }
      .trace-nav-link i {
        font-size: 20px;
        margin-bottom: 4px;
      }
      .trace-nav-link span {
        font-size: 12px;
      }
      .trace-nav-item.active .trace-nav-link {
        color: #1890FF;
      }
      .trace-nav-item.active::after {
        content: '';
        display: block;
        width: 100%;
        height: 2px;
        background-color: #1890FF;
        position: absolute;
        bottom: 0;
        left: 0;
      }
    `;
    
    // 添加样式到head
    document.head.appendChild(style);
  },
  
  /**
   * 绑定导航事件
   * @param {Element} nav - 导航元素
   */
  bindNavEvents(nav) {
    // 获取所有导航链接
    const links = nav.querySelectorAll('.trace-nav-link');
    
    // 绑定点击事件
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const navId = link.getAttribute('data-nav-id');
        
        // 如果处于同一页面，阻止默认行为并滚动到顶部
        if (this.isCurrentPage(navId)) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  },
  
  /**
   * 判断是否为当前页面
   * @param {string} navId - 导航ID
   * @returns {boolean} 是否为当前页面
   */
  isCurrentPage(navId) {
    if (navId === 'home' && (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html'))) {
      return true;
    }
    
    return window.location.pathname.includes(`/${navId}/`);
  },
  
  /**
   * 获取首页URL
   * @returns {string} 首页URL
   */
  getHomeUrl() {
    const currentPath = window.location.pathname;
    
    // 如果当前在子目录中
    if (currentPath.includes('/pages/')) {
      const depth = currentPath.split('/').filter(Boolean).length - 1;
      return '../'.repeat(depth) + 'index.html';
    }
    
    return './index.html';
  },
  
  /**
   * 获取模块URL
   * @param {string} module - 模块名称
   * @returns {string} 模块URL
   */
  getModuleUrl(module) {
    const currentPath = window.location.pathname;
    
    // 如果当前在子目录中
    if (currentPath.includes('/pages/')) {
      const depth = currentPath.split('/').filter(Boolean).length - 1;
      const prefix = currentPath.includes(`/pages/${module}/`) ? './' : '../'.repeat(depth - 1) + module + '/';
      return prefix + 'index.html';
    }
    
    return `./pages/${module}/index.html`;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { traceNav };
} else {
  window.traceNav = traceNav;
}

// 在文档加载完成后自动初始化
document.addEventListener('DOMContentLoaded', () => {
  // 尝试初始化导航
  traceNav.init();
}); 