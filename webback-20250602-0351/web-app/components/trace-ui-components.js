/**
 * 食品溯源系统UI组件库
 * 版本: 2.0.0
 * 提供系统中使用的各种组件实现
 */

window.traceUIComponents = (function() {
  // 存储已升级按钮的ID，避免重复升级
  const upgradedButtons = new Set();
  
  // 按钮ID计数器
  let buttonIdCounter = 0;
  
  /**
   * 生成唯一ID
   * @param {string} prefix - ID前缀
   * @return {string} 唯一ID
   */
  function generateUniqueId(prefix = 'trace-btn') {
    // 增加页面路径信息以确保不同页面按钮ID不重复
    const pathInfo = window.location.pathname.replace(/[\/\.]/g, '-').replace(/^-/, '');
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 10000);
    
    buttonIdCounter++;
    
    // 组合信息生成唯一ID: 前缀-路径信息-时间戳-计数器-随机数
    return `${prefix}-${pathInfo}-${timestamp}-${buttonIdCounter}-${randomPart}`;
  }
  
  /**
   * 生成合适的无障碍标签
   * @param {HTMLElement} button - 按钮元素
   * @return {string} 无障碍标签
   */
  function generateAccessibleLabel(button) {
    const config = window.traceButtonConfig?.getAccessibilityConfig()?.labelGeneration || {
      useInnerText: true,
      useTitle: true,
      useAriaLabel: true,
      useClosestLabel: true,
      generateFromId: true,
      fallbackPrefix: 'Button'
    };
    
    // 如果已有aria-label，直接返回
    if (config.useAriaLabel && button.getAttribute('aria-label')) {
      return button.getAttribute('aria-label');
    }
    
    // 如果有aria-labelledby，不再生成标签
    if (button.getAttribute('aria-labelledby')) {
      return null;
    }
    
    // 尝试使用按钮文本
    if (config.useInnerText && button.innerText && button.innerText.trim()) {
      return button.innerText.trim();
    }
    
    // 尝试使用title属性
    if (config.useTitle && button.title && button.title.trim()) {
      return button.title.trim();
    }
    
    // 尝试使用alt属性（对于图片按钮）
    if (button.querySelector('img[alt]')) {
      const imgAlt = button.querySelector('img[alt]').getAttribute('alt');
      if (imgAlt && imgAlt.trim()) {
        return imgAlt.trim();
      }
    }
    
    // 尝试使用aria-describedby引用的元素内容
    const describedById = button.getAttribute('aria-describedby');
    if (describedById) {
      const descElement = document.getElementById(describedById);
      if (descElement && descElement.innerText.trim()) {
        return descElement.innerText.trim();
      }
    }
    
    // 尝试使用最近的label元素
    if (config.useClosestLabel) {
      const id = button.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label && label.innerText.trim()) {
          return label.innerText.trim();
        }
      }
      
      // 查找父级或相邻元素中的标签信息
      const parentLabel = button.closest('label');
      if (parentLabel && parentLabel.innerText.trim()) {
        // 排除按钮自身的文本
        const buttonText = button.innerText.trim();
        const labelText = parentLabel.innerText.trim();
        
        if (labelText !== buttonText) {
          return labelText;
        }
      }
    }
    
    // 尝试从ID生成
    if (config.generateFromId && button.id) {
      // 将ID转换为可读文本
      const readableId = button.id
        .replace(/([A-Z])/g, ' $1') // 在大写字母前添加空格
        .replace(/[-_]/g, ' ')      // 替换连字符和下划线为空格
        .replace(/^\w/, c => c.toUpperCase()) // 首字母大写
        .trim();
      
      if (readableId) {
        return readableId;
      }
    }
    
    // 尝试从data属性中获取标签
    const dataAttrs = ['data-label', 'data-title', 'data-name', 'data-action'];
    for (const attr of dataAttrs) {
      if (button.hasAttribute(attr)) {
        const attrValue = button.getAttribute(attr);
        if (attrValue && attrValue.trim()) {
          return attrValue.trim();
        }
      }
    }
    
    // 尝试从按钮的类名中获取信息
    if (button.className) {
      // 从类名中提取有意义的词汇，如"btn-save"提取"save"
      const classMatch = button.className.match(/(?:btn|button)-([a-z0-9_-]+)/i);
      if (classMatch && classMatch[1]) {
        const action = classMatch[1]
          .replace(/[-_]/g, ' ')
          .replace(/^\w/, c => c.toUpperCase());
        
        return `${action} button`;
      }
    }
    
    // 获取当前页面的上下文
    let pageContext = '';
    const pagePath = window.location.pathname;
    if (pagePath) {
      const pathSegments = pagePath.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        pageContext = pathSegments[pathSegments.length - 1]
          .replace('.html', '')
          .replace(/[-_]/g, ' ')
          .replace(/^\w/, c => c.toUpperCase());
      }
    }
    
    // 使用最后的回退方案，生成一个基本标签
    const buttonType = button.getAttribute('type') || 'default';
    const buttonContext = button.closest('[data-context]')?.getAttribute('data-context') || pageContext;
    return `${config.fallbackPrefix} ${buttonContext} ${buttonType}`.trim();
  }
  
  /**
   * 添加按钮反馈效果（如波纹效果）
   * @param {HTMLElement} button - 按钮元素
   */
  function addButtonFeedbackEffect(button) {
    if (!button) return;
    
    // 获取配置
    const config = window.traceButtonConfig?.getBehaviorConfig()?.feedback || {
      useRippleEffect: true,
      playSoundEffect: false,
      useHapticFeedback: false,
      useVisualState: true
    };
    
    // 如果已经添加过反馈效果，不再重复添加
    if (button.getAttribute('data-feedback-added') === 'true') return;
    
    // 添加视觉状态类
    if (config.useVisualState) {
      const buttonStyle = getButtonStyles(button);
      
      if (buttonStyle.hoverClass && !button.classList.contains(buttonStyle.hoverClass)) {
        button.classList.add(buttonStyle.hoverClass);
      }
      
      if (buttonStyle.activeClass && !button.classList.contains(buttonStyle.activeClass)) {
        button.classList.add(buttonStyle.activeClass);
      }
      
      if (buttonStyle.focusClass && !button.classList.contains(buttonStyle.focusClass)) {
        button.classList.add(buttonStyle.focusClass);
      }
      
      // 添加CSS变量以支持自定义动画
      button.style.setProperty('--button-transition-duration', '0.3s');
      button.style.setProperty('--button-hover-scale', '1.03');
      button.style.setProperty('--button-active-scale', '0.98');
      
      // 确保按钮有适当的过渡效果
      const currentStyle = window.getComputedStyle(button);
      if (!currentStyle.transition || currentStyle.transition === 'none') {
        button.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease, background-color 0.3s ease';
      }
    }
    
    // 添加波纹效果
    if (config.useRippleEffect) {
      button.addEventListener('click', function(e) {
        // 如果按钮禁用，不显示波纹效果
        if (button.disabled || button.getAttribute('disabled') || 
            button.classList.contains('trace-button-disabled')) {
          return;
        }
        
        // 检查和添加相对定位，确保波纹效果定位正确
        const computedStyle = window.getComputedStyle(button);
        if (computedStyle.position === 'static') {
          button.style.position = 'relative';
        }
        
        // 确保按钮有overflow: hidden以正确显示波纹效果
        if (computedStyle.overflow !== 'hidden') {
          button.style.overflow = 'hidden';
        }
        
        // 创建波纹效果元素
        const ripple = document.createElement('span');
        ripple.classList.add('trace-button-ripple');
        
        // 计算波纹尺寸和位置
        const buttonRect = button.getBoundingClientRect();
        const size = Math.max(buttonRect.width, buttonRect.height) * 2;
        const x = e.clientX - buttonRect.left - size / 2;
        const y = e.clientY - buttonRect.top - size / 2;
        
        // 设置波纹样式
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // 确保波纹效果有正确的基本样式
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'trace-button-ripple-effect 0.8s ease-out forwards';
        
        // 添加波纹到按钮中
        button.appendChild(ripple);
        
        // 动画结束后移除波纹元素
        setTimeout(() => {
          ripple.remove();
        }, config.rippleAnimationDuration || 800);
      });
      
      // 添加焦点效果
      button.addEventListener('focus', function() {
        button.classList.add('trace-button-focus');
      });
      
      button.addEventListener('blur', function() {
        button.classList.remove('trace-button-focus');
      });
      
      // 添加悬停效果
      button.addEventListener('mouseenter', function() {
        // 避免对禁用按钮应用效果
        if (!button.disabled && !button.classList.contains('trace-button-disabled')) {
          button.style.transform = `scale(var(--button-hover-scale))`;
        }
      });
      
      button.addEventListener('mouseleave', function() {
        button.style.transform = 'scale(1)';
      });
      
      // 添加按下效果
      button.addEventListener('mousedown', function() {
        if (!button.disabled && !button.classList.contains('trace-button-disabled')) {
          button.style.transform = `scale(var(--button-active-scale))`;
        }
      });
      
      button.addEventListener('mouseup', function() {
        if (!button.disabled && !button.classList.contains('trace-button-disabled')) {
          button.style.transform = `scale(var(--button-hover-scale))`;
        }
      });
    }
    
    // 标记为已添加反馈效果
    button.setAttribute('data-feedback-added', 'true');
    button.setAttribute('data-has-visual-feedback', 'true');
  }
  
  /**
   * 获取按钮样式配置
   * @param {HTMLElement} button - 按钮元素
   * @return {Object} 样式配置
   */
  function getButtonStyles(button) {
    // 默认使用主按钮样式
    let buttonType = 'primary';
    
    // 检查按钮类名，确定按钮类型
    if (button.classList.contains('trace-button-secondary')) {
      buttonType = 'secondary';
    } else if (button.classList.contains('trace-button-icon')) {
      buttonType = 'icon';
    } else if (button.classList.contains('trace-button-danger')) {
      buttonType = 'danger';
    }
    
    // 返回按钮样式配置
    return window.traceButtonConfig?.getButtonStyle(buttonType) || {
      class: 'trace-button trace-button-primary',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled'
    };
  }
  
  /**
   * 增强现有按钮
   * @param {HTMLElement} button - 要增强的按钮元素
   * @return {boolean} 是否成功增强
   */
  function upgradeExistingButton(button) {
    if (!button || !button.nodeType || button.nodeType !== Node.ELEMENT_NODE) return false;
    
    // 避免重复升级同一个按钮
    if (button.hasAttribute('data-upgraded')) {
      return false;
    }
    
    try {
      // 记录按钮升级前的状态
      const preUpgradeState = {
        hasId: !!button.id,
        hasAccessibility: button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby'),
        hasVisualFeedback: button.hasAttribute('data-feedback-added') || button.hasAttribute('data-has-visual-feedback')
      };
      
      // 1. 确保按钮有ID
      if (!button.id) {
        button.id = generateUniqueId();
      }
      
      // 记录此按钮已升级
      upgradedButtons.add(button.id);
      
      // 2. 确保非按钮元素有正确的角色
      if (button.tagName.toLowerCase() !== 'button') {
        if (!button.getAttribute('role')) {
          button.setAttribute('role', 'button');
        }
        
        // 3. 确保可聚焦
        if (!button.getAttribute('tabindex')) {
          button.setAttribute('tabindex', '0');
        }
      }
      
      // 4. 添加无障碍标签 (aria-label)
      if (!button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby')) {
        const label = generateAccessibleLabel(button);
        if (label) {
          button.setAttribute('aria-label', label);
        }
      }
      
      // 5. 添加视觉反馈效果
      addButtonFeedbackEffect(button);
      
      // 6. 添加键盘支持
      if (!button.getAttribute('data-keyboard-handled')) {
        const keyHandler = function(e) {
          const keys = window.traceButtonConfig?.getBehaviorConfig()?.keyboardKeys?.activate || ['Enter', 'Space'];
          if (keys.includes(e.code) || keys.includes(e.key)) {
            e.preventDefault();
            button.click();
          }
        };
        
        button.addEventListener('keydown', keyHandler);
        button.setAttribute('data-keyboard-handled', 'true');
      }
      
      // 7. 添加描述性微数据属性，提高SEO和可访问性
      if (!button.hasAttribute('data-action') && button.innerText) {
        // 尝试从按钮文本中提取操作类型，如"保存"、"删除"等
        const actionText = button.innerText.trim().toLowerCase();
        button.setAttribute('data-action', actionText);
      }
      
      // 8. 添加状态反馈属性
      if (button.disabled || button.getAttribute('disabled') === 'true' ||
          button.classList.contains('disabled') || button.classList.contains('trace-button-disabled')) {
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.setAttribute('aria-disabled', 'false');
      }
      
      // 9. 确保按钮可点击（cursor: pointer）
      const computedStyle = window.getComputedStyle(button);
      if (computedStyle.cursor !== 'pointer' && !button.disabled) {
        button.style.cursor = 'pointer';
      }
      
      // 10. 标记为已升级
      button.setAttribute('data-upgraded', 'true');
      button.setAttribute('data-has-unique-id', 'true');
      button.setAttribute('data-is-accessible', 'true');
      
      // 添加数据属性，用于测试脚本收集信息
      button.setAttribute('data-test-id', button.id);
      button.setAttribute('data-test-accessible', 'true');
      
      // 记录升级改进
      if (!preUpgradeState.hasId) {
        button.setAttribute('data-upgrade-id-added', 'true');
      }
      
      if (!preUpgradeState.hasAccessibility) {
        button.setAttribute('data-upgrade-accessibility-added', 'true');
      }
      
      if (!preUpgradeState.hasVisualFeedback) {
        button.setAttribute('data-upgrade-feedback-added', 'true');
      }
      
      // 记录日志
      console.log(`按钮 [${button.id}] 已升级: ${button.getAttribute('aria-label') || button.innerText || 'unnamed'}`);
      return true;
    } catch (error) {
      console.error(`按钮升级失败: ${error.message}`, button);
      return false;
    }
  }
  
  /**
   * 升级页面上所有按钮
   * @return {number} 成功升级的按钮数量
   */
  function upgradeAllButtons() {
    // 1. 查找页面上所有按钮和按钮状元素
    const buttonSelectors = [
      'button',
      '[role="button"]',
      '.btn', '.button',
      'input[type="submit"]', 'input[type="button"]', 'input[type="reset"]',
      '.trace-button', '.trace-button-primary', '.trace-button-secondary', '.trace-button-danger',
      '.tab-button', '.action-button', '.icon-button',
      '.module-card', '[data-button="true"]',
      'a.btn', 'a.button', 'a[class*="btn-"]', 
      '.nav-link', '.card-link', '.dropdown-item'
    ].join(', ');
    
    const buttons = document.querySelectorAll(buttonSelectors);
    console.log(`发现 ${buttons.length} 个潜在按钮元素`);
    
    // 2. 升级每个按钮
    let upgradedCount = 0;
    
    buttons.forEach(button => {
      // 忽略已标记为不需要升级的元素
      if (button.getAttribute('data-no-upgrade') === 'true') return;
      
      // 忽略隐藏或CSS禁用的元素
      const computedStyle = window.getComputedStyle(button);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        // 仍然为隐藏元素设置ID，但不进行完全升级
        if (!button.id) {
          button.id = generateUniqueId('hidden-btn');
        }
        return;
      }
      
      // 尝试升级按钮
      const upgraded = upgradeExistingButton(button);
      if (upgraded) {
        upgradedCount++;
      }
    });
    
    console.log(`成功升级 ${upgradedCount} 个按钮元素`);
    return upgradedCount;
  }
  
  /**
   * 创建新按钮
   * @param {Object} options - 按钮配置选项
   * @param {string} options.id - 按钮ID (可选)
   * @param {string} options.text - 按钮文本
   * @param {string} options.type - 按钮类型 (primary, secondary, icon, danger)
   * @param {string} options.icon - 图标类名 (可选)
   * @param {Function} options.onClick - 点击回调
   * @param {boolean} options.disabled - 是否禁用 (可选)
   * @param {string} options.ariaLabel - 无障碍标签 (可选)
   * @return {HTMLElement} 创建的按钮元素
   */
  function createButton(options = {}) {
    // 创建按钮元素
    const button = document.createElement('button');
    
    // 设置ID
    button.id = options.id || generateUniqueId();
    
    // 获取按钮样式配置
    const buttonType = options.type || 'primary';
    const buttonStyle = window.traceButtonConfig?.getButtonStyle(buttonType) || {
      class: 'trace-button trace-button-primary',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled'
    };
    
    // 应用样式类
    button.className = buttonStyle.class;
    button.classList.add(buttonStyle.hoverClass);
    button.classList.add(buttonStyle.activeClass);
    button.classList.add(buttonStyle.focusClass);
    
    // 设置按钮文本
    if (options.text) {
      button.textContent = options.text;
    }
    
    // 添加图标 (如果有)
    if (options.icon) {
      const iconElement = document.createElement('span');
      iconElement.className = options.icon;
      // 如果有文本和图标，添加间距
      if (options.text) {
        iconElement.style.marginRight = '8px';
      }
      button.insertBefore(iconElement, button.firstChild);
    }
    
    // 设置禁用状态
    if (options.disabled) {
      button.disabled = true;
      button.classList.add(buttonStyle.disabledClass);
    }
    
    // 设置无障碍标签
    button.setAttribute('aria-label', options.ariaLabel || options.text || '');
    
    // 添加点击事件处理
    if (typeof options.onClick === 'function') {
      button.addEventListener('click', options.onClick);
    }
    
    // 添加视觉反馈效果
    addButtonFeedbackEffect(button);
    
    // 标记为已升级
    button.setAttribute('data-upgraded', 'true');
    button.setAttribute('data-has-unique-id', 'true');
    button.setAttribute('data-is-accessible', 'true');
    button.setAttribute('data-has-visual-feedback', 'true');
    
    return button;
  }
  
  // 暴露公共API
  return {
    createButton: createButton,
    upgradeExistingButton: upgradeExistingButton,
    upgradeAllButtons: upgradeAllButtons,
    addButtonFeedbackEffect: addButtonFeedbackEffect,
    generateUniqueId: generateUniqueId
  };
})(); 