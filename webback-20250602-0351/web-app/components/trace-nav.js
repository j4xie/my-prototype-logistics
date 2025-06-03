/**
 * 食品溯源系统 - 导航菜单组件
 * 版本: 2.0.0
 */

const traceNav = {
  /**
   * 初始化导航菜单
   * @param {string} containerId - 容器元素ID (可选，默认为'nav-container')
   * @param {string} activeItem - 当前激活的菜单项 (可选: 'home', 'info', 'profile'，默认为'home')
   */
  init(containerId = 'nav-container', activeItem = 'home') {
    // 检查容器是否存在
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`导航容器不存在: #${containerId}`);
      // 如果容器不存在，自动创建一个并添加到body
      this.createNavContainer(containerId);
      return this.init(containerId, activeItem);
    }
    
    // 创建底部导航栏
    this.createBottomNav(container, activeItem);
    
    // 检查页面顶部是否已有导航
    this.createTopNav();
    
    console.log('导航菜单已初始化');
  },
  
  /**
   * 创建导航容器
   * @param {string} containerId - 容器元素ID
   */
  createNavContainer(containerId) {
    const container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
    console.log(`已创建导航容器: #${containerId}`);
  },
  
  /**
   * 创建底部导航栏
   * @param {Element} container - 容器元素
   * @param {string} activeItem - 当前激活的菜单项
   */
  createBottomNav(container, activeItem) {
    // 清空容器
    container.innerHTML = '';
    
    // 创建导航元素
    const nav = document.createElement('nav');
    nav.className = 'trace-bottom-nav';
    nav.setAttribute('role', 'navigation');
    
    // 定义导航项
    const navItems = [
      { id: 'home', text: '首页', icon: 'home', url: this.getHomeUrl() },
      { id: 'info', text: '信息管理', icon: 'file-alt', url: this.getInfoUrl() },
      { id: 'data-collection', text: '数据采集', icon: 'database', url: this.getBaseUrl() + 'pages/farming/data-collection-center.html' },
      { id: 'profile', text: '我的', icon: 'user', url: this.getProfileUrl() }
    ];
    
    // 创建底部导航HTML
    nav.innerHTML = `
      <div class="trace-nav-container">
        ${navItems.map(item => `
          <a href="${item.url}" class="trace-nav-item ${activeItem === item.id ? 'active' : ''}" 
             data-nav-id="${item.id}" aria-label="${item.text}" tabindex="0">
            <i class="fas fa-${item.icon}"></i>
            <span>${item.text}</span>
          </a>
        `).join('')}
      </div>
    `;
    
    // 添加导航样式
    this.addBottomNavStyles();
    
    // 添加到容器
    container.appendChild(nav);
    
    // 绑定导航事件，仅绑定到导航项元素上
    this.bindNavEvents(nav);
  },
  
  /**
   * 创建顶部导航栏 (保留之前的实现)
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
        background-color: #1677FF;
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
   * 绑定顶部导航按钮事件 (保留之前的实现)
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
   * 显示更多选项菜单 (保留之前的实现)
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
      { text: '系统设置', icon: 'cog', action: () => location.href = this.getProfileUrl() + 'settings.html' },
      { text: '帮助中心', icon: 'question-circle', action: () => alert('帮助中心即将上线') },
      { text: '关于我们', icon: 'info-circle', action: () => alert('食品溯源系统 V2.0.0') }
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
   * 添加底部导航样式
   */
  addBottomNavStyles() {
    // 检查是否已添加样式
    if (document.getElementById('trace-bottom-nav-styles')) {
      return;
    }
    
    // 创建样式元素
    const style = document.createElement('style');
    style.id = 'trace-bottom-nav-styles';
    
    // 设置样式
    style.textContent = `
      .trace-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: white;
        box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
        z-index: 900;
        padding-bottom: env(safe-area-inset-bottom, 0);
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
        pointer-events: none; /* 防止导航容器捕获点击事件 */
      }
      
      .trace-nav-container {
        display: flex;
        max-width: 390px;
        margin: 0 auto;
        justify-content: space-between;
        pointer-events: none; /* 防止容器捕获点击事件 */
      }
      
      .trace-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: #7F7F7F;
        transition: color 0.2s ease;
        width: 25%;
        padding: 10px 0;
        position: relative;
        pointer-events: auto; /* 只允许导航项捕获点击事件 */
      }
      
      .trace-nav-item i {
        font-size: 22px;
        margin-bottom: 4px;
        display: block;
        text-align: center;
        width: 100%;
        position: relative;
      }
      
      /* 确保信息管理图标完美居中 */
      .trace-nav-item[data-nav-id="info"] i {
        transform: translateX(0);
      }
      
      .trace-nav-item span {
        font-size: 12px;
        text-align: center;
        display: block;
        width: 100%;
      }
      
      .trace-nav-item.active {
        color: #1677FF;
      }
      
      /* 增大触摸区域 */
      .trace-nav-item::before {
        content: '';
        position: absolute;
        top: -10px;
        left: 0;
        right: 0;
        bottom: -10px;
        z-index: -1;
      }
      
      .trace-nav-item:active {
        opacity: 0.8;
      }
      
      /* 适应不同尺寸的屏幕 */
      @media (max-width: 360px) {
        .trace-nav-item i {
          font-size: 20px;
        }
        
        .trace-nav-item span {
          font-size: 11px;
        }
      }
      
      @media (min-width: 500px) {
        .trace-nav-container {
          max-width: 500px;
        }
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
    nav.querySelectorAll('.trace-nav-item').forEach(item => {
      // 点击事件
      item.addEventListener('click', (e) => {
        // 获取导航项ID
        const navId = item.getAttribute('data-nav-id');
        
        // 设置活动状态
        this.setActiveNavItem(navId);
        
        // 如果点击当前页，阻止导航
        if (this.isCurrentSection(navId)) {
          e.preventDefault();
          return false;
        }
      });
      
      // 键盘事件
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
      
      // 触摸反馈
      item.addEventListener('touchstart', () => {
        item.style.opacity = '0.7';
      });
      
      item.addEventListener('touchend', () => {
        item.style.opacity = '1';
      });
    });
  },
  
  /**
   * 设置活动导航项
   * @param {string} navId - 导航项ID
   */
  setActiveNavItem(navId) {
    document.querySelectorAll('.trace-nav-item').forEach(item => {
      if (item.getAttribute('data-nav-id') === navId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  },
  
  /**
   * 检查是否是当前部分
   * @param {string} navId - 导航ID
   * @returns {boolean} 是否是当前部分
   */
  isCurrentSection(navId) {
    if (navId === 'home') {
      return window.location.pathname.endsWith('/home-selector.html') || 
             window.location.pathname === '/' || 
             window.location.pathname === '/index.html';
    } else if (navId === 'info') {
      return window.location.pathname.includes('/home-farming.html') ||
             window.location.pathname.includes('/farming/') ||
             window.location.pathname.includes('/farming-');
    } else if (navId === 'profile') {
      return window.location.pathname.includes('/profile/');
    }
    
    return false;
  },
  
  /**
   * 获取首页URL
   * @returns {string} 首页URL
   */
  getHomeUrl() {
    return this.getBaseUrl() + 'pages/home/home-selector.html';
  },
  
  /**
   * 获取信息管理URL
   * @returns {string} 信息管理URL
   */
  getInfoUrl() {
    return this.getBaseUrl() + 'pages/home/home-farming.html';
  },
  
  /**
   * 获取个人中心URL
   * @returns {string} 个人中心URL
   */
  getProfileUrl() {
    return this.getBaseUrl() + 'pages/profile/profile.html';
  },
  
  /**
   * 获取基础URL
   * @returns {string} 基础URL
   */
  getBaseUrl() {
    const currentPath = window.location.pathname;
    
    // 如果已经在pages目录下
    if (currentPath.includes('/pages/')) {
      const pathParts = currentPath.split('/pages/');
      return pathParts[0] + '/';
    }
    
    // 如果在根目录
    return './';
  }
};

// 自动初始化顶部导航
document.addEventListener('DOMContentLoaded', () => {
  // 初始化顶部导航
  if (document.querySelector('.trace-top-nav') === null) {
    traceNav.createTopNav();
  }
  
  // 尝试查找默认容器并初始化底部导航
  const defaultContainer = document.getElementById('nav-container');
  if (defaultContainer && document.querySelector('.trace-bottom-nav') === null) {
    // 尝试从当前URL确定活动项
    let activeItem = 'home';
    
    if (window.location.pathname.includes('/home-farming.html') || 
        window.location.pathname.includes('/farming/') ||
        window.location.pathname.includes('/farming-')) {
      activeItem = 'info';
    } else if (window.location.pathname.includes('/profile/')) {
      activeItem = 'profile';
    }
    
    traceNav.init('nav-container', activeItem);
  }
}); 