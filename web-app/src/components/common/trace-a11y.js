/**
 * 食品溯源系统 - 无障碍性(a11y)组件
 * 提供全面的可访问性功能，确保系统对所有用户都可用
 */

class TraceAccessibility {
  constructor() {
    this.highContrastMode = false;
    this.focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    this.announcementsElement = null;
    this.keyboardShortcuts = {
      'alt+1': () => this.navigateTo('home.html'),
      'alt+2': () => this.navigateTo('trace-list.html'),
      'alt+3': () => this.navigateTo('create-trace.html'),
      'alt+4': () => this.navigateTo('profile.html'),
      'alt+h': () => this.toggleHelp(),
      'alt+c': () => this.toggleHighContrast()
    };
  }

  /**
   * 初始化无障碍性功能
   */
  init() {
    this.createAnnouncementsElement();
    this.setupFocusManagement();
    this.setupKeyboardNavigation();
    this.setupHighContrast();
    this.improveFormLabels();
    this.addSkipLinks();
    this.setupARIALandmarks();
    
    console.log('无障碍性组件已初始化');
    this.announce('无障碍性功能已启用，按Alt+H获取帮助');
  }

  /**
   * 创建屏幕阅读器公告元素
   */
  createAnnouncementsElement() {
    this.announcementsElement = document.createElement('div');
    this.announcementsElement.setAttribute('aria-live', 'polite');
    this.announcementsElement.setAttribute('aria-atomic', 'true');
    this.announcementsElement.classList.add('sr-only');
    document.body.appendChild(this.announcementsElement);
  }

  /**
   * 向屏幕阅读器发送公告
   * @param {string} message - 要公告的消息
   */
  announce(message) {
    if (!this.announcementsElement) return;
    
    this.announcementsElement.textContent = '';
    // 使用setTimeout确保屏幕阅读器能捕获更改
    setTimeout(() => {
      this.announcementsElement.textContent = message;
    }, 100);
  }

  /**
   * 设置焦点管理
   */
  setupFocusManagement() {
    // 添加可视化焦点指示器
    const style = document.createElement('style');
    style.textContent = `
      :focus {
        outline: 3px solid #4299e1 !important;
        outline-offset: 2px !important;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
      [aria-expanded="true"] {
        border-left: 3px solid #4299e1;
      }
    `;
    document.head.appendChild(style);

    // 修复任何不正确的tabindex
    document.querySelectorAll('[tabindex]').forEach(el => {
      if (el.getAttribute('tabindex') > 0) {
        el.setAttribute('tabindex', '0');
      }
    });

    // 处理模态对话框的焦点陷阱
    document.addEventListener('DOMNodeInserted', (e) => {
      if (e.target.classList && e.target.classList.contains('modal')) {
        this.trapFocusInModal(e.target);
      }
    });
  }

  /**
   * 在模态对话框中创建焦点陷阱
   * @param {HTMLElement} modal - 模态对话框元素
   */
  trapFocusInModal(modal) {
    const focusableElements = modal.querySelectorAll(this.focusableElements);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    });

    // 自动聚焦第一个元素
    setTimeout(() => {
      firstElement.focus();
    }, 100);
  }

  /**
   * 设置键盘导航和快捷键
   */
  setupKeyboardNavigation() {
    // 监听键盘事件以处理快捷键
    document.addEventListener('keydown', (e) => {
      // 构建组合键字符串
      let combo = '';
      if (e.altKey) combo += 'alt+';
      if (e.ctrlKey) combo += 'ctrl+';
      if (e.shiftKey) combo += 'shift+';
      combo += e.key.toLowerCase();

      // 检查是否有匹配的快捷键
      if (this.keyboardShortcuts[combo]) {
        e.preventDefault();
        this.keyboardShortcuts[combo]();
      }
    });

    // 为表单添加增强键盘支持
    document.querySelectorAll('form').forEach(form => {
      // 允许按Enter键在表单字段间移动
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.nodeName !== 'TEXTAREA' && e.target.type !== 'submit') {
          e.preventDefault();
          const formElements = Array.from(form.elements);
          const currentIndex = formElements.indexOf(e.target);
          const nextElement = formElements[currentIndex + 1];
          if (nextElement) nextElement.focus();
        }
      });
    });

    // 增强表格导航
    document.querySelectorAll('table').forEach(table => {
      const cells = table.querySelectorAll('td, th');
      cells.forEach((cell, index) => {
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('keydown', (e) => {
          let targetCell;
          if (e.key === 'ArrowRight') {
            targetCell = cells[index + 1];
          } else if (e.key === 'ArrowLeft') {
            targetCell = cells[index - 1];
          } else if (e.key === 'ArrowUp') {
            const rowLength = table.rows[0].cells.length;
            targetCell = cells[index - rowLength];
          } else if (e.key === 'ArrowDown') {
            const rowLength = table.rows[0].cells.length;
            targetCell = cells[index + rowLength];
          }
          
          if (targetCell) {
            e.preventDefault();
            targetCell.focus();
          }
        });
      });
    });
  }

  /**
   * 设置高对比度模式
   */
  setupHighContrast() {
    // 创建高对比度样式
    const highContrastStyle = document.createElement('style');
    highContrastStyle.id = 'high-contrast-style';
    highContrastStyle.textContent = `
      body.high-contrast {
        background-color: #000 !important;
        color: #fff !important;
      }
      body.high-contrast a, 
      body.high-contrast button,
      body.high-contrast input,
      body.high-contrast select,
      body.high-contrast textarea {
        background-color: #000 !important;
        color: #ffff00 !important;
        border: 1px solid #ffff00 !important;
      }
      body.high-contrast th {
        background-color: #000 !important;
        color: #fff !important;
        border: 1px solid #fff !important;
      }
      body.high-contrast .card,
      body.high-contrast .form-section,
      body.high-contrast .modal {
        background-color: #000 !important;
        border: 2px solid #fff !important;
      }
      body.high-contrast img {
        filter: grayscale(100%) contrast(150%) !important;
      }
      body.high-contrast .trace-progress .step.active {
        background-color: #ffff00 !important;
        color: #000 !important;
      }
    `;
    document.head.appendChild(highContrastStyle);

    // 添加高对比度切换按钮
    const contrastButton = document.createElement('button');
    contrastButton.setAttribute('aria-label', '切换高对比度模式');
    contrastButton.classList.add('contrast-toggle');
    contrastButton.innerHTML = '高对比度';
    contrastButton.addEventListener('click', () => this.toggleHighContrast());
    
    // 将按钮添加到页面底部
    const footer = document.querySelector('footer') || document.body;
    footer.appendChild(contrastButton);

    // 检查是否有保存的偏好
    const savedPreference = localStorage.getItem('highContrastMode');
    if (savedPreference === 'true') {
      this.toggleHighContrast();
    }
  }

  /**
   * 切换高对比度模式
   */
  toggleHighContrast() {
    this.highContrastMode = !this.highContrastMode;
    document.body.classList.toggle('high-contrast', this.highContrastMode);
    localStorage.setItem('highContrastMode', this.highContrastMode);
    
    if (this.highContrastMode) {
      this.announce('高对比度模式已启用');
    } else {
      this.announce('高对比度模式已禁用');
    }
  }

  /**
   * 改进表单标签和说明
   */
  improveFormLabels() {
    // 确保所有输入都有关联的标签
    document.querySelectorAll('input, select, textarea').forEach(input => {
      if (!input.id) {
        input.id = `input-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      let label = document.querySelector(`label[for="${input.id}"]`);
      if (!label) {
        // 尝试查找父元素中的标签
        const parentLabel = input.closest('label');
        if (parentLabel) {
          parentLabel.setAttribute('for', input.id);
        } else {
          // 为没有标签的输入创建隐藏标签
          const newLabel = document.createElement('label');
          newLabel.setAttribute('for', input.id);
          newLabel.classList.add('sr-only');
          newLabel.textContent = input.placeholder || input.name || input.id;
          input.parentNode.insertBefore(newLabel, input);
        }
      }
      
      // 添加ARIA描述（如果有占位符）
      if (input.placeholder) {
        const descId = `desc-${input.id}`;
        const desc = document.createElement('div');
        desc.id = descId;
        desc.classList.add('sr-only');
        desc.textContent = input.placeholder;
        input.setAttribute('aria-describedby', descId);
        input.after(desc);
      }
      
      // 为必填字段添加指示
      if (input.required) {
        input.setAttribute('aria-required', 'true');
        
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label && !label.querySelector('.required-indicator')) {
          const indicator = document.createElement('span');
          indicator.classList.add('required-indicator');
          indicator.setAttribute('aria-hidden', 'true');
          indicator.textContent = ' *';
          label.appendChild(indicator);
        }
      }
    });
    
    // 添加验证错误处理
    document.querySelectorAll('form').forEach(form => {
      form.noValidate = true;
      form.addEventListener('submit', (e) => {
        const invalidFields = form.querySelectorAll(':invalid');
        if (invalidFields.length > 0) {
          e.preventDefault();
          
          // 聚焦第一个无效字段并宣布
          invalidFields[0].focus();
          this.announce(`验证错误：${invalidFields.length}个字段需要修正`);
          
          // 为无效字段添加ARIA属性
          invalidFields.forEach(field => {
            field.setAttribute('aria-invalid', 'true');
            
            let errorMsg = field.validationMessage;
            const errorId = `error-${field.id}`;
            let errorElement = document.getElementById(errorId);
            
            if (!errorElement) {
              errorElement = document.createElement('div');
              errorElement.id = errorId;
              errorElement.classList.add('error-message');
              errorElement.setAttribute('aria-live', 'assertive');
              field.parentNode.insertBefore(errorElement, field.nextSibling);
            }
            
            errorElement.textContent = errorMsg;
            field.setAttribute('aria-describedby', `${field.getAttribute('aria-describedby') || ''} ${errorId}`.trim());
          });
        }
      });
    });
  }

  /**
   * 添加跳过导航链接
   */
  addSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.textContent = '跳到主要内容';
    skipLink.href = '#main-content';
    skipLink.classList.add('skip-link');
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('main-content') || document.querySelector('main');
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
      }
    });
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: #4299e1;
        color: white;
        padding: 8px;
        z-index: 100;
        transition: top 0.3s;
      }
      .skip-link:focus {
        top: 0;
      }
    `;
    document.head.appendChild(style);
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // 确保主要内容区域有正确的ID
    const main = document.querySelector('main') || document.querySelector('.main-content');
    if (main && !main.id) {
      main.id = 'main-content';
    }
  }

  /**
   * 设置ARIA地标角色
   */
  setupARIALandmarks() {
    // 添加主要地标
    const landmarks = [
      { selector: 'header, .header', role: 'banner' },
      { selector: 'nav, .nav, .navigation', role: 'navigation' },
      { selector: 'main, .main, .main-content', role: 'main' },
      { selector: 'aside, .sidebar', role: 'complementary' },
      { selector: 'footer, .footer', role: 'contentinfo' },
      { selector: 'form, .search-form', role: 'search', condition: el => el.querySelector('input[type="search"]') }
    ];
    
    landmarks.forEach(({ selector, role, condition }) => {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.getAttribute('role') && (!condition || condition(el))) {
          el.setAttribute('role', role);
        }
      });
    });
    
    // 为各部分添加合适的ARIA标签
    document.querySelectorAll('section, article').forEach(section => {
      const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && !section.getAttribute('aria-labelledby')) {
        if (!heading.id) {
          heading.id = `heading-${Math.random().toString(36).substr(2, 9)}`;
        }
        section.setAttribute('aria-labelledby', heading.id);
      }
    });
  }

  /**
   * 显示帮助信息
   */
  toggleHelp() {
    // 创建或显示帮助模态
    let helpModal = document.getElementById('a11y-help-modal');
    
    if (!helpModal) {
      helpModal = document.createElement('div');
      helpModal.id = 'a11y-help-modal';
      helpModal.classList.add('modal');
      helpModal.setAttribute('role', 'dialog');
      helpModal.setAttribute('aria-labelledby', 'help-title');
      helpModal.setAttribute('aria-modal', 'true');
      
      helpModal.innerHTML = `
        <div class="modal-content">
          <h2 id="help-title">无障碍快捷键帮助</h2>
          <button class="close-button" aria-label="关闭帮助窗口">&times;</button>
          <div class="help-content">
            <p>以下快捷键可用于导航:</p>
            <ul>
              <li><kbd>Alt</kbd> + <kbd>1</kbd>: 主页</li>
              <li><kbd>Alt</kbd> + <kbd>2</kbd>: 溯源列表</li>
              <li><kbd>Alt</kbd> + <kbd>3</kbd>: 创建溯源</li>
              <li><kbd>Alt</kbd> + <kbd>4</kbd>: 个人资料</li>
              <li><kbd>Alt</kbd> + <kbd>H</kbd>: 显示此帮助</li>
              <li><kbd>Alt</kbd> + <kbd>C</kbd>: 切换高对比度模式</li>
            </ul>
            <p>表单导航技巧:</p>
            <ul>
              <li>使用 <kbd>Tab</kbd> 在表单字段间移动</li>
              <li>使用 <kbd>Space</kbd> 选择选项或按下按钮</li>
              <li>使用 <kbd>↑</kbd> <kbd>↓</kbd> 在选择框中移动</li>
            </ul>
          </div>
        </div>
      `;
      
      document.body.appendChild(helpModal);
      
      // 处理关闭按钮
      const closeButton = helpModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        helpModal.style.display = 'none';
        this.announce('帮助窗口已关闭');
      });
      
      // 点击模态外部关闭
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
          helpModal.style.display = 'none';
        }
      });
      
      // 按ESC关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && helpModal.style.display === 'block') {
          helpModal.style.display = 'none';
          this.announce('帮助窗口已关闭');
        }
      });
      
      // 添加样式
      if (!document.getElementById('help-modal-style')) {
        const style = document.createElement('style');
        style.id = 'help-modal-style';
        style.textContent = `
          #a11y-help-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 1000;
          }
          #a11y-help-modal .modal-content {
            position: relative;
            background-color: white;
            margin: 10% auto;
            padding: 20px;
            width: 80%;
            max-width: 600px;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          #a11y-help-modal .close-button {
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 24px;
            font-weight: bold;
            border: none;
            background: none;
            cursor: pointer;
          }
          #a11y-help-modal kbd {
            background-color: #f7f7f7;
            border: 1px solid #ccc;
            border-radius: 3px;
            box-shadow: 0 1px 0 rgba(0,0,0,0.2);
            color: #333;
            display: inline-block;
            font-size: 0.85em;
            font-weight: bold;
            line-height: 1;
            padding: 2px 4px;
            white-space: nowrap;
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // 显示帮助
    if (helpModal.style.display === 'block') {
      helpModal.style.display = 'none';
      this.announce('帮助窗口已关闭');
    } else {
      helpModal.style.display = 'block';
      const helpTitle = document.getElementById('help-title');
      if (helpTitle) helpTitle.focus();
      this.announce('无障碍帮助窗口已打开');
    }
  }

  /**
   * 导航到指定页面
   * @param {string} page - 目标页面URL
   */
  navigateTo(page) {
    this.announce(`正在导航到${page.replace('.html', '')}页面`);
    window.location.href = page;
  }
}

// 初始化并导出
const traceA11y = new TraceAccessibility();

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  traceA11y.init();
});

// 导出组件
export default traceA11y; 