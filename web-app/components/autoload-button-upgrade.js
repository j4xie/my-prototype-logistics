/**
 * 按钮自动升级
 * 为按钮添加辅助功能、视觉反馈等
 * 版本: 1.0.0
 */

(function() {
  // 在DOM加载完成后执行
  document.addEventListener('DOMContentLoaded', function() {
    upgradeButtons();
  });
  
  /**
   * 升级页面中的所有按钮
   */
  function upgradeButtons() {
    // 查找所有按钮
    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
    
    buttons.forEach(function(button, index) {
      // 添加唯一ID
      if (!button.id) {
        button.id = `btn_${Date.now()}_${index}`;
      }
      
      // 确保有aria角色
      if (!button.hasAttribute('role')) {
        button.setAttribute('role', 'button');
      }
      
      // 添加视觉反馈
      addVisualFeedback(button);
      
      // 添加键盘支持
      addKeyboardSupport(button);
    });
    
    console.log(`自动升级了 ${buttons.length} 个按钮`);
  }
  
  /**
   * 添加视觉反馈
   * @param {HTMLElement} button - 按钮元素
   */
  function addVisualFeedback(button) {
    // 添加悬停效果
    button.addEventListener('mouseenter', function() {
      button.classList.add('hover-effect');
    });
    
    button.addEventListener('mouseleave', function() {
      button.classList.remove('hover-effect');
    });
    
    // 添加点击效果
    button.addEventListener('mousedown', function() {
      button.classList.add('active-effect');
    });
    
    button.addEventListener('mouseup', function() {
      button.classList.remove('active-effect');
    });
  }
  
  /**
   * 添加键盘支持
   * @param {HTMLElement} button - 按钮元素
   */
  function addKeyboardSupport(button) {
    // 确保可聚焦
    if (!button.hasAttribute('tabindex')) {
      button.setAttribute('tabindex', '0');
    }
    
    // 添加键盘事件
    button.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        button.click();
      }
    });
  }
  
  // 导出模块
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { upgradeButtons };
  } else {
    window.buttonUpgrade = { upgradeButtons };
  }
})();