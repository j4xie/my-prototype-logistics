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
          <button class="trace-top-nav-back" aria-label="返回" id="nav-back-button">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h1 class="trace-top-nav-title">${pageTitle || '食品溯源系统'}</h1>
        </div>
        <div class="trace-top-nav-right">
          <button class="trace-top-nav-button" aria-label="搜索" id="nav-search-button">
            <i class="fas fa-search"></i>
          </button>
          <button class="trace-top-nav-button" aria-label="更多选项" id="nav-more-button">
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
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        transition: background-color 0.2s;
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
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        transition: background-color 0.2s;
        text-align: center;
        position: relative;
      }
      .trace-top-nav-button i {
        pointer-events: none;
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
    
    // 绑定顶部导航按钮事件
    this.bindTopNavEvents(topNav);
  },
  
  /**
   * 绑定顶部导航按钮事件
   * @param {Element} topNav - 顶部导航元素
   */
  bindTopNavEvents(topNav) {
    // 返回按钮
    const backButton = topNav.querySelector('#nav-back-button');
    if (backButton) {
      backButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('返回按钮被点击');
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = this.getHomeUrl();
        }
      });
    }
    
    // 搜索按钮
    const searchButton = topNav.querySelector('#nav-search-button');
    if (searchButton) {
      searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('搜索按钮被点击');
        // 显示搜索框或导航到搜索页面
        alert('搜索功能即将上线');
      });
    }
    
    // 更多选项按钮
    const moreButton = topNav.querySelector('#nav-more-button');
    if (moreButton) {
      moreButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('更多选项按钮被点击');
        // 显示更多选项菜单
        this.showMoreOptions(moreButton);
      });
    }
  },
  
  /**
   * 显示更多选项菜单
   * @param {Element} button - 更多选项按钮元素
   */
  showMoreOptions(button) {
    // 检查是否已存在菜单
    let menu = document.querySelector('.trace-more-menu');
    
    if (menu) {
      // 如果菜单已存在，则切换显示/隐藏
      menu.classList.toggle('visible');
      return;
    }
    
    // 创建菜单
    menu = document.createElement('div');
    menu.className = 'trace-more-menu visible';
    
    // 菜单选项
    const options = [
      { text: '刷新页面', icon: 'sync', action: () => location.reload() },
      { text: '系统设置', icon: 'cog', action: () => location.href = this.getModuleUrl('profile') + 'settings.html' },
      { text: '帮助中心', icon: 'question-circle', action: () => alert('帮助中心即将上线') },
      { text: '关于我们', icon: 'info-circle', action: () => alert('食品溯源系统 V1.0.0') }
    ];
    
    // 创建菜单HTML
    menu.innerHTML = `
      <ul class="trace-more-menu-list">
        ${options.map(option => `
          <li class="trace-more-menu-item" data-action="${option.text}">
            <i class="fas fa-${option.icon}"></i>
            <span>${option.text}</span>
          </li>
        `).join('')}
      </ul>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .trace-more-menu {
        position: fixed;
        top: 56px;
        right: 16px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        width: 180px;
        z-index: 1000;
        display: none;
      }
      .trace-more-menu.visible {
        display: block;
      }
      .trace-more-menu-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .trace-more-menu-item {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      .trace-more-menu-item:hover {
        background-color: #f5f5f5;
      }
      .trace-more-menu-item i {
        margin-right: 12px;
        color: #666;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(menu);
    
    // 绑定菜单项点击事件
    menu.querySelectorAll('.trace-more-menu-item').forEach((item, index) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove('visible');
        options[index].action();
      });
    });
    
    // 点击其他区域关闭菜单
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== button) {
        menu.classList.remove('visible');
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
        font-size: 1.2rem;
        margin-bottom: 4px;
      }
      .trace-nav-link span {
        font-size: 0.8rem;
      }
      .trace-nav-item.active .trace-nav-link {
        color: #1890FF;
      }
    `;
    
    // 添加到文档头
    document.head.appendChild(style);
  },
  
  /**
   * 绑定导航事件
   * @param {Element} nav - 导航元素
   */
  bindNavEvents(nav) {
    nav.querySelectorAll('.trace-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const navId = link.getAttribute('data-nav-id');
        
        // 如果点击当前页，阻止导航
        if (this.isCurrentPage(navId)) {
          e.preventDefault();
          return false;
        }
      });
    });
  },
  
  /**
   * 检查是否是当前页
   * @param {string} navId - 导航ID
   * @returns {boolean} 是否是当前页
   */
  isCurrentPage(navId) {
    if (navId === 'home') {
      return window.location.pathname === '/' || 
             window.location.pathname === '/index.html';
    }
    
    return window.location.pathname.includes(`/${navId}/`);
  },
  
  /**
   * 获取首页URL
   * @returns {string} 首页URL
   */
  getHomeUrl() {
    // 获取当前应用的基础URL
    const baseUrl = window.location.pathname.includes('/pages/') 
      ? '../'
      : './';
    
    return baseUrl;
  },
  
  /**
   * 获取模块URL
   * @param {string} module - 模块名称
   * @returns {string} 模块URL
   */
  getModuleUrl(module) {
    // 获取当前应用的基础URL
    const baseUrl = window.location.pathname.includes('/pages/') 
      ? '../'
      : './';
    
    return `${baseUrl}pages/${module}/`;
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化顶部导航
  traceNav.init();
}); 