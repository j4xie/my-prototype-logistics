/**
 * 食品溯源系统 - 按钮模板生成器
 * 版本: 1.0.0
 * 用于生成系统中标准化的按钮模板
 */

window.traceButtonTemplates = (function() {
  // 私有属性
  const eventHandlers = new Map();
  let templateCounter = 0;

  // 按钮模板定义
  const buttonTemplates = {
    // 主要动作按钮
    primary: {
      template: function(options) {
        return createButtonFromTemplate('primary', options);
      },
      className: 'trace-button trace-button-primary trace-button-hover trace-button-active trace-button-focus',
      icon: '',
      defaultText: '确认'
    },
    
    // 次要动作按钮
    secondary: {
      template: function(options) {
        return createButtonFromTemplate('secondary', options);
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '',
      defaultText: '取消'
    },
    
    // 返回按钮
    back: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 12.5l-4-4 4-4M2.5 8.5h11"></path></svg>',
          text: '返回',
          onClick: function() {
            window.history.back();
          }
        };
        return createButtonFromTemplate('secondary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 12.5l-4-4 4-4M2.5 8.5h11"></path></svg>',
      defaultText: '返回'
    },
    
    // 保存按钮
    save: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 4.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h8a1 1 0 011 1v.5zM4.5 8.5h7m-3.5-4v8"></path></svg>',
          text: '保存',
          onClick: null
        };
        return createButtonFromTemplate('primary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-primary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 4.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h8a1 1 0 011 1v.5zM4.5 8.5h7m-3.5-4v8"></path></svg>',
      defaultText: '保存'
    },
    
    // 添加按钮
    add: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5v9M3.5 8h9"></path></svg>',
          text: '添加',
          onClick: null
        };
        return createButtonFromTemplate('primary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-primary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5v9M3.5 8h9"></path></svg>',
      defaultText: '添加'
    },
    
    // 删除按钮
    delete: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 4.5h11M5.5 4.5v9a1 1 0 001 1h3a1 1 0 001-1v-9M6.5 4.5v-1a1 1 0 011-1h1a1 1 0 011 1v1"></path></svg>',
          text: '删除',
          onClick: null
        };
        return createButtonFromTemplate('danger', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-danger trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 4.5h11M5.5 4.5v9a1 1 0 001 1h3a1 1 0 001-1v-9M6.5 4.5v-1a1 1 0 011-1h1a1 1 0 011 1v1"></path></svg>',
      defaultText: '删除'
    },
    
    // 编辑按钮
    edit: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 4.5l-7 7V14h2.5l7-7-2.5-2.5z M11.5 4.5l2.5-2.5 2.5 2.5-2.5 2.5-2.5-2.5z"></path></svg>',
          text: '编辑',
          onClick: null
        };
        return createButtonFromTemplate('secondary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 4.5l-7 7V14h2.5l7-7-2.5-2.5z M11.5 4.5l2.5-2.5 2.5 2.5-2.5 2.5-2.5-2.5z"></path></svg>',
      defaultText: '编辑'
    },
    
    // 搜索按钮
    search: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10.5 10.5l4 4-4-4z M7 12A5 5 0 107 2a5 5 0 000 10z"></path></svg>',
          text: '搜索',
          onClick: null
        };
        return createButtonFromTemplate('primary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-primary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10.5 10.5l4 4-4-4z M7 12A5 5 0 107 2a5 5 0 000 10z"></path></svg>',
      defaultText: '搜索'
    },
    
    // 导出按钮
    export: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 12h10M8 3v6M5 6l3-3 3 3"></path></svg>',
          text: '导出',
          onClick: null
        };
        return createButtonFromTemplate('secondary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 12h10M8 3v6M5 6l3-3 3 3"></path></svg>',
      defaultText: '导出'
    },
    
    // 导入按钮
    import: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 12h10M8 9v-6M5 6l3 3 3-3"></path></svg>',
          text: '导入',
          onClick: null
        };
        return createButtonFromTemplate('secondary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 12h10M8 9v-6M5 6l3 3 3-3"></path></svg>',
      defaultText: '导入'
    },
    
    // 刷新按钮
    refresh: {
      template: function(options) {
        const defaultOptions = {
          icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 8c0 3-2.5 5.5-5.5 5.5S2.5 11 2.5 8 5 2.5 8 2.5c1.5 0 2.9.6 3.9 1.6l1.6-1.6M15 2.5v3h-3"></path></svg>',
          text: '刷新',
          onClick: function() {
            window.location.reload();
          }
        };
        return createButtonFromTemplate('secondary', Object.assign({}, defaultOptions, options));
      },
      className: 'trace-button trace-button-secondary trace-button-hover trace-button-active trace-button-focus',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 8c0 3-2.5 5.5-5.5 5.5S2.5 11 2.5 8 5 2.5 8 2.5c1.5 0 2.9.6 3.9 1.6l1.6-1.6M15 2.5v3h-3"></path></svg>',
      defaultText: '刷新'
    },
    
    // 图标按钮（无文本）
    icon: {
      template: function(options) {
        const iconOptions = Object.assign({}, options, { 
          text: '',
          ariaLabel: options.ariaLabel || options.title || '图标按钮'
        });
        return createButtonFromTemplate('icon', iconOptions);
      },
      className: 'trace-button trace-button-icon trace-button-hover trace-button-active trace-button-focus',
      icon: '',
      defaultText: ''
    }
  };
  
  /**
   * 根据模板创建按钮
   * @param {string} templateName - 模板名称
   * @param {Object} options - 按钮选项
   * @returns {HTMLElement} 创建的按钮元素
   */
  function createButtonFromTemplate(templateName, options = {}) {
    // 获取模板定义
    const template = buttonTemplates[templateName] || buttonTemplates.primary;
    
    // 为按钮创建唯一ID
    templateCounter++;
    const buttonId = options.id || 
                     `trace-btn-${templateName}-${Date.now()}-${templateCounter}`;
    
    // 基本属性
    const buttonType = options.type || 'button';
    const buttonText = options.text !== undefined ? options.text : template.defaultText;
    const buttonClass = options.className || template.className;
    const isDisabled = options.disabled || false;
    
    // 创建按钮元素
    const button = document.createElement('button');
    button.id = buttonId;
    button.type = buttonType;
    button.className = buttonClass;
    
    // 设置无障碍属性
    const ariaLabel = options.ariaLabel || buttonText;
    if (ariaLabel) {
      button.setAttribute('aria-label', ariaLabel);
    }
    
    // 设置标题（鼠标悬停提示）
    if (options.title) {
      button.title = options.title;
    }
    
    // 设置禁用状态
    if (isDisabled) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    }
    
    // 添加图标（如果有）
    if (options.icon || template.icon) {
      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'button-icon';
      iconWrapper.innerHTML = options.icon || template.icon;
      button.appendChild(iconWrapper);
    }
    
    // 添加文本（如果有）
    if (buttonText) {
      const textWrapper = document.createElement('span');
      textWrapper.className = 'button-text';
      textWrapper.textContent = buttonText;
      button.appendChild(textWrapper);
    }
    
    // 添加点击事件处理
    if (typeof options.onClick === 'function') {
      button.addEventListener('click', function(event) {
        if (!button.disabled) {
          options.onClick.call(this, event);
        }
      });
      
      // 存储事件处理器
      eventHandlers.set(buttonId, options.onClick);
    }
    
    // 添加键盘支持
    button.addEventListener('keydown', function(event) {
      if ((event.key === 'Enter' || event.key === ' ') && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    });
    
    // 标记为已升级
    button.setAttribute('data-upgraded', 'true');
    button.setAttribute('data-has-unique-id', 'true');
    button.setAttribute('data-is-accessible', 'true');
    button.setAttribute('data-has-visual-feedback', 'true');
    
    // 如果traceUIComponents可用，增强按钮
    if (window.traceUIComponents && window.traceUIComponents.addButtonFeedbackEffect) {
      window.traceUIComponents.addButtonFeedbackEffect(button);
    }
    
    return button;
  }
  
  /**
   * 创建并添加按钮到容器
   * @param {string} templateName - 按钮模板名称
   * @param {Object} options - 按钮选项
   * @param {HTMLElement|string} container - 容器元素或选择器
   * @returns {HTMLElement} 创建的按钮元素
   */
  function createAndAddButton(templateName, options, container) {
    const button = createButtonFromTemplate(templateName, options);
    
    // 找到容器元素
    let containerElement;
    if (typeof container === 'string') {
      containerElement = document.querySelector(container);
    } else {
      containerElement = container;
    }
    
    // 将按钮添加到容器
    if (containerElement) {
      containerElement.appendChild(button);
    } else {
      console.warn('无法找到按钮容器元素');
    }
    
    return button;
  }
  
  /**
   * 创建多个按钮
   * @param {Array} buttonsConfig - 按钮配置数组
   * @param {HTMLElement|string} container - 容器元素或选择器
   * @returns {Array<HTMLElement>} 创建的按钮元素数组
   */
  function createButtonGroup(buttonsConfig, container) {
    // 找到容器元素
    let containerElement;
    if (typeof container === 'string') {
      containerElement = document.querySelector(container);
    } else {
      containerElement = container;
    }
    
    if (!containerElement) {
      console.warn('无法找到按钮组容器元素');
      return [];
    }
    
    // 创建按钮组包装器
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'trace-button-group';
    
    // 创建并添加每个按钮
    const buttons = [];
    
    buttonsConfig.forEach(config => {
      const { template, ...options } = config;
      const templateName = template || 'primary';
      
      const button = createButtonFromTemplate(templateName, options);
      buttonGroup.appendChild(button);
      buttons.push(button);
    });
    
    // 将按钮组添加到容器
    containerElement.appendChild(buttonGroup);
    
    return buttons;
  }
  
  /**
   * 更新现有按钮的属性
   * @param {HTMLElement|string} button - 按钮元素或选择器
   * @param {Object} options - 要更新的选项
   * @returns {HTMLElement} 更新后的按钮元素
   */
  function updateButton(button, options) {
    // 获取按钮元素
    let buttonElement;
    if (typeof button === 'string') {
      buttonElement = document.querySelector(button);
    } else {
      buttonElement = button;
    }
    
    if (!buttonElement) {
      console.warn('无法找到要更新的按钮');
      return null;
    }
    
    // 更新文本
    if (options.text !== undefined) {
      let textElement = buttonElement.querySelector('.button-text');
      
      if (textElement) {
        textElement.textContent = options.text;
      } else if (options.text) {
        textElement = document.createElement('span');
        textElement.className = 'button-text';
        textElement.textContent = options.text;
        buttonElement.appendChild(textElement);
      }
    }
    
    // 更新图标
    if (options.icon !== undefined) {
      let iconElement = buttonElement.querySelector('.button-icon');
      
      if (iconElement) {
        if (options.icon) {
          iconElement.innerHTML = options.icon;
        } else {
          iconElement.remove();
        }
      } else if (options.icon) {
        iconElement = document.createElement('span');
        iconElement.className = 'button-icon';
        iconElement.innerHTML = options.icon;
        buttonElement.insertBefore(iconElement, buttonElement.firstChild);
      }
    }
    
    // 更新禁用状态
    if (options.disabled !== undefined) {
      buttonElement.disabled = options.disabled;
      buttonElement.setAttribute('aria-disabled', options.disabled.toString());
    }
    
    // 更新点击事件
    if (typeof options.onClick === 'function') {
      const buttonId = buttonElement.id;
      
      // 移除旧的事件处理器
      if (eventHandlers.has(buttonId)) {
        buttonElement.removeEventListener('click', eventHandlers.get(buttonId));
        eventHandlers.delete(buttonId);
      }
      
      // 添加新的事件处理器
      buttonElement.addEventListener('click', options.onClick);
      eventHandlers.set(buttonId, options.onClick);
    }
    
    // 更新类名
    if (options.className) {
      buttonElement.className = options.className;
    }
    
    // 更新无障碍标签
    if (options.ariaLabel) {
      buttonElement.setAttribute('aria-label', options.ariaLabel);
    }
    
    // 更新标题
    if (options.title !== undefined) {
      buttonElement.title = options.title;
    }
    
    return buttonElement;
  }
  
  // 暴露公共API
  return {
    // 模板函数
    primary: buttonTemplates.primary.template,
    secondary: buttonTemplates.secondary.template,
    back: buttonTemplates.back.template,
    save: buttonTemplates.save.template,
    add: buttonTemplates.add.template,
    delete: buttonTemplates.delete.template,
    edit: buttonTemplates.edit.template,
    search: buttonTemplates.search.template,
    export: buttonTemplates.export.template,
    import: buttonTemplates.import.template,
    refresh: buttonTemplates.refresh.template,
    icon: buttonTemplates.icon.template,
    
    // 实用函数
    createButtonFromTemplate: createButtonFromTemplate,
    createAndAddButton: createAndAddButton,
    createButtonGroup: createButtonGroup,
    updateButton: updateButton
  };
})(); 