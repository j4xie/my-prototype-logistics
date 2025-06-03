/**
 * 食品溯源系统 - 按钮组件配置文件
 * 版本: 1.0.0
 * 定义了系统中所有按钮的默认配置、样式和行为规则
 */

window.traceButtonConfig = (function() {
  // 按钮类型与对应的样式
  const buttonStyles = {
    // 主要按钮
    primary: {
      class: 'trace-button trace-button-primary',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled',
      cssVars: {
        '--primary-button-bg': '#2c974b',
        '--primary-button-hover-bg': '#228b48',
        '--primary-button-text': '#ffffff',
        '--primary-button-border': 'none'
      }
    },
    // 次要按钮
    secondary: {
      class: 'trace-button trace-button-secondary',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled',
      cssVars: {
        '--secondary-button-bg': '#f6f8fa',
        '--secondary-button-hover-bg': '#e0e3e6',
        '--secondary-button-text': '#24292f',
        '--secondary-button-border': '1px solid rgba(27, 31, 36, 0.15)'
      }
    },
    // 圆形图标按钮
    icon: {
      class: 'trace-button trace-button-icon',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled',
      cssVars: {
        '--icon-button-size': '36px',
        '--icon-button-border-radius': '50%',
        '--icon-button-bg': 'transparent',
        '--icon-button-hover-bg': 'rgba(0, 0, 0, 0.05)'
      }
    },
    // 危险操作按钮
    danger: {
      class: 'trace-button trace-button-danger',
      hoverClass: 'trace-button-hover',
      activeClass: 'trace-button-active',
      focusClass: 'trace-button-focus',
      disabledClass: 'trace-button-disabled',
      cssVars: {
        '--danger-button-bg': '#cf222e',
        '--danger-button-hover-bg': '#a40e26',
        '--danger-button-text': '#ffffff',
        '--danger-button-border': 'none'
      }
    }
  };

  // 按钮行为配置
  const buttonBehaviors = {
    // 按钮反馈动画持续时间
    rippleAnimationDuration: 800, // 毫秒
    
    // 按键支持
    keyboardKeys: {
      activate: ['Enter', 'Space'],
      navigate: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab']
    },
    
    // 默认事件防抖延迟
    debounceDelay: 300, // 毫秒
    
    // 是否默认阻止按钮事件冒泡
    stopPropagation: false,
    
    // 点击反馈配置
    feedback: {
      useRippleEffect: true,       // 是否使用波纹效果
      playSoundEffect: false,      // 是否播放声音效果
      useHapticFeedback: false,    // 是否使用触觉反馈（在支持的移动设备上）
      useVisualState: true         // 是否使用视觉状态（hover/active/focus）
    }
  };

  // 无障碍配置
  const accessibilityConfig = {
    // 必要的无障碍属性
    requiredAttributes: [
      'aria-label',    // 或 aria-labelledby
      'role',          // 当元素不是 <button> 标签时需要
      'tabindex'       // 当元素不是 <button> 标签时需要
    ],
    
    // 对焦行为
    focusSettings: {
      showFocusRing: true,         // 是否显示对焦环
      focusRingColor: '#0969da',   // 对焦环颜色
      focusRingWidth: '3px',       // 对焦环宽度
      focusRingStyle: 'solid',     // 对焦环样式
    },
    
    // 无障碍标签生成策略
    labelGeneration: {
      useInnerText: true,          // 尝试使用按钮的内部文本作为标签
      useTitle: true,              // 尝试使用title属性作为标签
      useAriaLabel: true,          // 优先使用已存在的aria-label
      useClosestLabel: true,       // 尝试查找最近的label元素
      generateFromId: true,        // 尝试从ID生成标签
      fallbackPrefix: 'Button'     // 当无法生成标签时的前缀
    }
  };

  // CSS样式规则
  const cssRules = `
    /* 按钮基础样式 */
    .trace-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      position: relative;
      white-space: nowrap;
      vertical-align: middle;
      cursor: pointer;
      user-select: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      height: 32px;
      padding: 0 12px;
      transition: background-color 0.2s, box-shadow 0.2s, border-color 0.2s;
      overflow: hidden;
    }
    
    /* 禁用状态 */
    .trace-button[disabled], .trace-button-disabled {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    /* 主要按钮样式 */
    .trace-button-primary {
      background-color: var(--primary-button-bg, #2c974b);
      color: var(--primary-button-text, #ffffff);
      border: var(--primary-button-border, none);
    }
    .trace-button-primary.trace-button-hover:hover:not([disabled]) {
      background-color: var(--primary-button-hover-bg, #228b48);
    }
    
    /* 次要按钮样式 */
    .trace-button-secondary {
      background-color: var(--secondary-button-bg, #f6f8fa);
      color: var(--secondary-button-text, #24292f);
      border: var(--secondary-button-border, 1px solid rgba(27, 31, 36, 0.15));
    }
    .trace-button-secondary.trace-button-hover:hover:not([disabled]) {
      background-color: var(--secondary-button-hover-bg, #e0e3e6);
    }
    
    /* 图标按钮样式 */
    .trace-button-icon {
      width: var(--icon-button-size, 36px);
      height: var(--icon-button-size, 36px);
      padding: 0;
      border-radius: var(--icon-button-border-radius, 50%);
      background-color: var(--icon-button-bg, transparent);
    }
    .trace-button-icon.trace-button-hover:hover:not([disabled]) {
      background-color: var(--icon-button-hover-bg, rgba(0, 0, 0, 0.05));
    }
    
    /* 危险按钮样式 */
    .trace-button-danger {
      background-color: var(--danger-button-bg, #cf222e);
      color: var(--danger-button-text, #ffffff);
      border: var(--danger-button-border, none);
    }
    .trace-button-danger.trace-button-hover:hover:not([disabled]) {
      background-color: var(--danger-button-hover-bg, #a40e26);
    }
    
    /* 点击效果 */
    .trace-button-ripple {
      position: absolute;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.4);
      transform: scale(0);
      animation: trace-button-ripple-effect 0.8s linear;
      pointer-events: none;
    }
    
    /* 波纹动画 */
    @keyframes trace-button-ripple-effect {
      to {
        transform: scale(2.5);
        opacity: 0;
      }
    }
    
    /* 对焦样式 */
    .trace-button-focus:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
    }
    
    /* 活动状态样式 */
    .trace-button-active:active:not([disabled]) {
      transform: translateY(1px);
    }
  `;

  // 注入CSS样式
  function injectStyles() {
    if (!document.getElementById('trace-button-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'trace-button-styles';
      styleEl.textContent = cssRules;
      document.head.appendChild(styleEl);
      console.log('按钮样式已注入');
    }
  }

  // 自动注入CSS
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }

  // 公开API
  return {
    getButtonStyle: function(type = 'primary') {
      return buttonStyles[type] || buttonStyles.primary;
    },
    getBehaviorConfig: function() {
      return {...buttonBehaviors};
    },
    getAccessibilityConfig: function() {
      return {...accessibilityConfig};
    },
    injectStyles: injectStyles
  };
})(); 