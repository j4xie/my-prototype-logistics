/**
 * 食品溯源系统主要脚本文件
 * 版本: 1.1.0
 * 负责初始化系统和加载必要的组件
 */

// 在页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 初始化系统模块
  initializeTraceSystem();
});

/**
 * 初始化溯源系统
 */
function initializeTraceSystem() {
  // 加载必要的样式表
  loadStylesheet('/styles/trace-components.css');
  
  // 根据页面路径初始化相应的功能模块
  const currentPath = window.location.pathname;
  
  // 升级页面中的所有按钮
  if (window.traceUIComponents) {
    // 立即执行一次按钮升级
    const upgradeCount = window.traceUIComponents.upgradeAllButtons();
    console.log(`初始按钮升级: ${upgradeCount}个按钮已升级`);
    
    // 使用MutationObserver监控DOM变化，自动升级新添加的按钮
    setupButtonUpgradeObserver();
    
    // 仍然保留延迟升级，确保动态加载的内容也被处理
    setTimeout(() => {
      const lateUpgradeCount = window.traceUIComponents.upgradeAllButtons();
      console.log(`延迟按钮升级: 额外${lateUpgradeCount}个按钮已升级`);
    }, 1000);
  } else {
    console.warn('按钮组件工具类未加载，请确保在页面中引入trace-ui-components.js');
  }
  
  // 根据页面路径初始化不同模块
  if (currentPath.includes('/trace/trace-map.html')) {
    initializeTraceMap();
  } else if (currentPath.includes('/trace/trace-list.html')) {
    initializeTraceList();
  } else if (currentPath.includes('/trace/trace-detail.html')) {
    initializeTraceDetail();
  } else if (currentPath.includes('/home/home-selector.html')) {
    initializeHomeSelector();
  } else if (currentPath.includes('/auth/login.html')) {
    initializeLogin();
  } else if (currentPath.includes('/product-trace.html')) {
    initializeProductTrace();
  }
}

/**
 * 设置MutationObserver监控DOM变化，自动升级新添加的按钮
 */
function setupButtonUpgradeObserver() {
  if (!window.traceUIComponents) return;
  
  // 创建一个观察器实例
  const observer = new MutationObserver((mutations) => {
    let hasNewButtons = false;
    
    // 检查是否有新按钮被添加
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          // 检查添加的节点是否是元素节点
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查节点本身是否是按钮
            if (isButtonElement(node)) {
              hasNewButtons = true;
            }
            
            // 检查节点内部是否有按钮
            if (node.querySelectorAll) {
              const buttons = node.querySelectorAll('button, [role="button"], .btn, .button, input[type="submit"], input[type="button"], input[type="reset"]');
              if (buttons.length > 0) {
                hasNewButtons = true;
              }
            }
          }
        });
      }
    });
    
    // 如果检测到新按钮，执行升级
    if (hasNewButtons) {
      const upgradeCount = window.traceUIComponents.upgradeAllButtons();
      if (upgradeCount > 0) {
        console.log(`DOM变更: ${upgradeCount}个新按钮已升级`);
      }
    }
  });
  
  // 开始观察整个文档
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 保存观察器引用，以便可以在需要时断开连接
  window._buttonUpgradeObserver = observer;
  
  console.log('按钮自动升级观察器已启动');
}

/**
 * 检查元素是否是按钮
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 是否是按钮元素
 */
function isButtonElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName?.toLowerCase();
  
  // 检查标签名
  if (tagName === 'button') return true;
  
  // 检查input类型
  if (tagName === 'input') {
    const type = element.type?.toLowerCase();
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return true;
    }
  }
  
  // 检查role属性
  if (element.getAttribute('role') === 'button') return true;
  
  // 检查类名是否包含按钮相关类
  const classList = element.classList;
  if (classList) {
    const buttonClasses = ['btn', 'button', 'trace-button', 'trace-button-secondary', 'tab-button', 'module-card'];
    for (const cls of buttonClasses) {
      if (classList.contains(cls)) return true;
    }
  }
  
  return false;
}

/**
 * 加载样式表
 * @param {string} href - 样式表的路径
 */
function loadStylesheet(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * 初始化溯源地图页面
 */
function initializeTraceMap() {
  console.log('初始化溯源地图页面');
  // 绑定产品筛选按钮事件
  const filterButtons = document.querySelectorAll('.flex-shrink-0');
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // 移除所有按钮的激活状态
      filterButtons.forEach(btn => {
        btn.classList.remove('bg-[#00467F]', 'text-white');
        btn.classList.add('bg-white', 'text-gray-600', 'border', 'border-gray-200');
      });
      
      // 设置当前按钮为激活状态
      this.classList.remove('bg-white', 'text-gray-600', 'border', 'border-gray-200');
      this.classList.add('bg-[#00467F]', 'text-white');
      
      // 这里可以添加筛选地图上的产品点的逻辑
    });
  });
}

/**
 * 初始化溯源记录列表页面
 */
function initializeTraceList() {
  console.log('初始化溯源记录列表页面');
  // 为记录列表项绑定点击事件
  const listItems = document.querySelectorAll('.trace-list-item');
  listItems.forEach(item => {
    item.addEventListener('click', function() {
      // 导航到详情页
      window.location.href = '/pages/trace/trace-detail.html';
    });
  });
}

/**
 * 初始化溯源详情页面
 */
function initializeTraceDetail() {
  console.log('初始化溯源详情页面');
  // 标签切换功能
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // 移除所有标签的激活状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.add('hidden'));
      
      // 激活当前标签
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      const activeContent = document.getElementById(tabId);
      if (activeContent) {
        activeContent.classList.remove('hidden');
      }
    });
  });
}

/**
 * 初始化首页模块选择
 */
function initializeHomeSelector() {
  console.log('初始化首页模块选择');
  // 为模块卡片绑定点击事件
  const moduleCards = document.querySelectorAll('.module-card');
  moduleCards.forEach(card => {
    card.addEventListener('click', function() {
      const moduleId = this.getAttribute('id');
      switch (moduleId) {
        case 'farmingModule':
          window.location.href = '/pages/farming/index.html';
          break;
        case 'processingModule':
          window.location.href = '/pages/processing/index.html';
          break;
        case 'logisticsModule':
          window.location.href = '/pages/logistics/index.html';
          break;
        case 'traceModule':
          window.location.href = '/pages/trace/trace-map.html';
          break;
        case 'userManageModule':
          window.location.href = '/pages/profile/index.html';
          break;
        case 'systemConfigModule':
          window.location.href = '/pages/admin/index.html';
          break;
      }
    });
  });
}

/**
 * 初始化登录页面
 */
function initializeLogin() {
  console.log('初始化登录页面');
  // 登录表单提交处理
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const loginBtn = document.getElementById('login-btn');
      
      // 添加加载状态
      if (window.traceUIComponents) {
        window.traceUIComponents.setButtonLoadingState(loginBtn, true);
      } else {
        loginBtn.disabled = true;
      }
      
      try {
        // 模拟登录请求
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 登录成功，重定向到首页
        window.location.href = '/pages/home/home-selector.html';
      } catch (error) {
        // 登录失败，显示错误信息
        alert('登录失败，请检查用户名和密码');
      } finally {
        // 移除加载状态
        if (window.traceUIComponents) {
          window.traceUIComponents.setButtonLoadingState(loginBtn, false);
        } else {
          loginBtn.disabled = false;
        }
      }
    });
  }
}

/**
 * 初始化产品溯源页面
 */
function initializeProductTrace() {
  console.log('初始化产品溯源页面');
  // 为返回按钮绑定事件
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', function() {
      window.history.back();
    });
  }
  
  // 为扫描按钮绑定事件
  const scanButton = document.getElementById('scanButton');
  if (scanButton) {
    scanButton.addEventListener('click', async function() {
      // 模拟扫描过程
      if (window.traceUIComponents) {
        window.traceUIComponents.setButtonLoadingState(this, true);
      } else {
        this.disabled = true;
      }
      
      try {
        // 模拟扫描时间
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 扫描成功后跳转到详情页
        window.location.href = '/pages/trace/trace-detail.html';
      } catch (error) {
        alert('扫描失败，请重试');
      } finally {
        // 恢复按钮状态
        if (window.traceUIComponents) {
          window.traceUIComponents.setButtonLoadingState(this, false);
        } else {
          this.disabled = false;
        }
      }
    });
  }
  
  // 为手动输入按钮绑定事件
  const inputCodeButton = document.getElementById('inputCodeButton');
  if (inputCodeButton) {
    inputCodeButton.addEventListener('click', function() {
      // 显示输入溯源码的弹窗
      const code = prompt('请输入溯源码');
      if (code) {
        // 输入成功后跳转到详情页
        window.location.href = '/pages/trace/trace-detail.html';
      }
    });
  }
} 