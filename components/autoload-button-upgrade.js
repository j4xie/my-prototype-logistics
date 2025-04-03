/**
 * 食品溯源系统 - 按钮自动升级脚本
 * 版本: 2.0.0
 * 此脚本用于确保系统中所有按钮都得到自动升级
 */

(function() {
  // 检查是否已经在运行，避免重复执行
  if (document.body && document.body.hasAttribute('data-trace-buttons-autoloaded')) {
    console.log('按钮自动升级脚本已在运行，跳过重复初始化');
    return;
  }
  
  // 设置标记，标明脚本已开始运行
  if (document.body) {
    document.body.setAttribute('data-trace-buttons-autoloaded', 'true');
  }
  
  // 统计信息
  const stats = {
    totalProcessed: 0,
    totalUpgraded: 0,
    uniqueIdsAdded: 0,
    accessibilityAdded: 0,
    visualFeedbackAdded: 0,
    pageUrl: window.location.pathname,
    startTime: new Date().toISOString()
  };
  
  // 检查必要的依赖
  if (!window.traceButtonConfig || !window.traceUIComponents) {
    console.log('按钮自动升级: 正在加载必要依赖...');
    
    // 动态加载依赖
    loadDependency('/components/trace-button-config.js', function() {
      loadDependency('/components/trace-ui-components.js', function() {
        console.log('按钮自动升级: 依赖加载完成，开始初始化');
        initButtonUpgrade();
      });
    });
  } else {
    // 已加载依赖，直接初始化
    console.log('按钮自动升级: 依赖已存在，直接初始化');
    initButtonUpgrade();
  }
  
  /**
   * 动态加载JavaScript依赖
   * @param {string} src - 脚本路径
   * @param {Function} callback - 加载完成后的回调
   */
  function loadDependency(src, callback) {
    console.log(`正在加载依赖: ${src}`);
    
    // 检查脚本是否已加载
    const existingScript = document.querySelector(`script[src*="${src}"]`);
    if (existingScript) {
      console.log(`依赖已存在: ${src}`);
      if (callback) callback();
      return;
    }
    
    // 创建script元素并添加到文档
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    // 设置加载完成回调
    script.onload = function() {
      console.log(`依赖加载完成: ${src}`);
      if (callback) callback();
    };
    
    script.onerror = function() {
      console.error(`依赖加载失败: ${src}`);
      
      // 尝试使用相对路径
      const relativeSrc = src.startsWith('/') ? src.substring(1) : src;
      console.log(`尝试使用相对路径加载: ${relativeSrc}`);
      
      const retryScript = document.createElement('script');
      retryScript.src = relativeSrc;
      retryScript.async = true;
      
      retryScript.onload = function() {
        console.log(`使用相对路径加载成功: ${relativeSrc}`);
        if (callback) callback();
      };
      
      retryScript.onerror = function() {
        console.error(`无法加载依赖: ${src} 或 ${relativeSrc}`);
        
        // 最后尝试从父目录加载
        const parentSrc = `../components/${path.basename(src)}`;
        console.log(`尝试从父目录加载: ${parentSrc}`);
        
        const lastRetryScript = document.createElement('script');
        lastRetryScript.src = parentSrc;
        lastRetryScript.async = true;
        
        lastRetryScript.onload = function() {
          console.log(`从父目录加载成功: ${parentSrc}`);
          if (callback) callback();
        };
        
        lastRetryScript.onerror = function() {
          console.error(`所有加载尝试失败: ${src}`);
          // 即使加载失败也尝试继续执行
          if (callback) callback();
        };
        
        document.head.appendChild(lastRetryScript);
      };
      
      document.head.appendChild(retryScript);
    };
    
    document.head.appendChild(script);
  }
  
  /**
   * 初始化按钮升级流程
   */
  function initButtonUpgrade() {
    console.log('开始初始化按钮自动升级流程');
    
    // 确保样式已注入
    if (window.traceButtonConfig) {
      window.traceButtonConfig.injectStyles();
    }
    
    // 立即执行一次升级
    upgradeButtonsNow();
    
    // 设置DOM变化观察器
    setupMutationObserver();
    
    // 设置多轮延迟升级，确保异步加载内容也得到处理
    const delays = [300, 1000, 3000];
    delays.forEach(delay => {
      window.setTimeout(upgradeButtonsNow, delay);
    });
    
    // 为动态加载的内容设置事件监听
    setupEventListeners();
    
    // 设置页面卸载时的日志记录
    window.addEventListener('beforeunload', logUpgradeStatistics);
    
    console.log('按钮自动升级流程初始化完成');
  }
  
  /**
   * 立即升级所有按钮
   */
  function upgradeButtonsNow() {
    if (window.traceUIComponents && window.traceUIComponents.upgradeAllButtons) {
      const beforeCount = stats.totalUpgraded;
      const count = window.traceUIComponents.upgradeAllButtons();
      
      // 更新统计信息
      if (count > 0) {
        stats.totalProcessed += count;
        stats.totalUpgraded += count;
        console.log(`按钮自动升级完成: ${count}个按钮已升级`);
      }
      
      // 如果新升级的按钮数量大于0，记录到控制台
      const newUpgraded = stats.totalUpgraded - beforeCount;
      if (newUpgraded > 0) {
        console.log(`本轮新升级按钮: ${newUpgraded}个`);
      }
      
      return count;
    } else {
      console.warn('无法升级按钮: traceUIComponents.upgradeAllButtons未找到');
      return 0;
    }
  }
  
  /**
   * 设置DOM变化观察器，监控新添加的按钮
   */
  function setupMutationObserver() {
    if (!window.MutationObserver) {
      console.warn('当前浏览器不支持MutationObserver，无法监控DOM变化');
      return;
    }
    
    const observer = new MutationObserver(function(mutations) {
      let hasNewButtons = false;
      
      mutations.forEach(function(mutation) {
        // 只关注子节点的添加
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            
            // 检查是否是元素节点
            if (node.nodeType === 1) {
              // 检查节点自身是否是按钮
              if (isButtonElement(node)) {
                hasNewButtons = true;
              }
              
              // 检查节点内部是否包含按钮
              if (node.querySelectorAll) {
                const buttons = node.querySelectorAll(getButtonSelectors());
                if (buttons.length > 0) {
                  hasNewButtons = true;
                }
              }
            }
          }
        }
      });
      
      // 如果检测到新按钮，执行升级
      if (hasNewButtons) {
        upgradeButtonsNow();
      }
    });
    
    // 开始观察整个文档
    observer.observe(document.body || document.documentElement, {
      childList: true,  // 监视子节点的添加或删除
      subtree: true     // 监视所有后代节点
    });
    
    // 保存观察器引用
    window._buttonUpgradeObserver = observer;
    console.log('DOM变化观察器已设置');
  }
  
  /**
   * 设置事件监听器，处理可能触发动态内容加载的事件
   */
  function setupEventListeners() {
    // 监听可能导致内容变化的事件
    const events = ['load', 'DOMContentLoaded', 'ajaxComplete', 'fetch', 'xhr'];
    
    events.forEach(function(eventName) {
      window.addEventListener(eventName, function() {
        // 延迟执行升级，以确保内容已完全加载
        setTimeout(upgradeButtonsNow, 200);
      });
    });
    
    // 特别处理XHR请求
    if (window.XMLHttpRequest && XMLHttpRequest.prototype) {
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function() {
        this.addEventListener('load', function() {
          // XHR完成后，延迟执行按钮升级
          setTimeout(upgradeButtonsNow, 200);
        });
        return originalXhrOpen.apply(this, arguments);
      };
    }
    
    // 特别处理fetch API
    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = function() {
        const fetchPromise = originalFetch.apply(this, arguments);
        fetchPromise.then(function() {
          setTimeout(upgradeButtonsNow, 300);
        });
        return fetchPromise;
      };
    }
    
    // 特别处理点击事件，可能触发内容变化
    document.addEventListener('click', function() {
      setTimeout(upgradeButtonsNow, 500);
    });
    
    console.log('事件监听器设置完成');
  }
  
  /**
   * 获取所有按钮选择器字符串
   */
  function getButtonSelectors() {
    return 'button, [role="button"], .btn, .button, input[type="submit"], input[type="button"], input[type="reset"], ' + 
           '.trace-button, .tab-button, .module-card, [data-button="true"], a.btn, a.button, ' +
           'a[class*="btn-"], a.nav-link, a.card-link, .nav-item, .dropdown-item';
  }
  
  /**
   * 检查元素是否是按钮
   * @param {Element} element - 要检查的元素
   * @returns {boolean} 是否是按钮元素
   */
  function isButtonElement(element) {
    if (!element || !element.tagName) return false;
    
    const tagName = element.tagName.toLowerCase();
    
    // 检查标签名
    if (tagName === 'button') return true;
    
    // 检查input类型
    if (tagName === 'input') {
      const type = element.type && element.type.toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'reset') {
        return true;
      }
    }
    
    // 检查角色属性
    if (element.getAttribute && element.getAttribute('role') === 'button') return true;
    
    // 检查类名
    if (element.classList) {
      const buttonClasses = [
        'btn', 'button', 'trace-button', 'trace-button-secondary', 
        'tab-button', 'module-card', 'action-button', 'icon-button',
        'btn-primary', 'btn-secondary', 'btn-danger', 'btn-warning',
        'btn-success', 'btn-info', 'btn-light', 'btn-dark'
      ];
      
      for (let i = 0; i < buttonClasses.length; i++) {
        if (element.classList.contains(buttonClasses[i])) {
          return true;
        }
      }
    }
    
    // 检查链接是否行为像按钮
    if (tagName === 'a') {
      if (element.classList) {
        for (let i = 0; i < element.classList.length; i++) {
          const className = element.classList[i];
          if (className.includes('btn') || className.includes('button')) {
            return true;
          }
        }
      }
      
      // 检查是否有onclick或href="#"
      if (element.hasAttribute('onclick') || element.getAttribute('href') === '#') {
        return true;
      }
    }
    
    // 检查data属性
    if (element.getAttribute && element.getAttribute('data-button') === 'true') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 记录按钮升级统计信息
   */
  function logUpgradeStatistics() {
    // 更新结束时间
    stats.endTime = new Date().toISOString();
    stats.duration = (new Date(stats.endTime) - new Date(stats.startTime)) + 'ms';
    
    // 计算页面上现有的按钮统计
    const buttonsWithUniqueId = document.querySelectorAll('[data-has-unique-id="true"]').length;
    const buttonsWithAccessibility = document.querySelectorAll('[data-is-accessible="true"]').length;
    const buttonsWithVisualFeedback = document.querySelectorAll('[data-has-visual-feedback="true"]').length;
    
    stats.finalStats = {
      buttonsWithUniqueId,
      buttonsWithAccessibility,
      buttonsWithVisualFeedback
    };
    
    // 输出到控制台
    console.log('===== 按钮升级报告 =====');
    console.log(`页面: ${stats.pageUrl}`);
    console.log(`总处理按钮数: ${stats.totalProcessed}`);
    console.log(`成功升级按钮数: ${stats.totalUpgraded}`);
    console.log(`当前页面有唯一ID的按钮: ${buttonsWithUniqueId}`);
    console.log(`当前页面有无障碍属性的按钮: ${buttonsWithAccessibility}`);
    console.log(`当前页面有视觉反馈的按钮: ${buttonsWithVisualFeedback}`);
    console.log(`执行时间: ${stats.duration}`);
    console.log('========================');
    
    // 尝试发送统计信息到服务器
    try {
      const statsData = JSON.stringify(stats);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/button-upgrade-stats', statsData);
      } else {
        // 回退方案，使用异步XHR
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/button-upgrade-stats', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(statsData);
      }
    } catch (error) {
      console.error('无法发送按钮升级统计信息:', error);
    }
  }
})(); 