/**
 * 食品溯源系统 - Modal对话框组件
 * 版本: 1.0.0
 */

// Modal对话框组件
export const traceModal = {
  // 配置选项
  config: {
    containerClass: 'trace-modal-container',
    modalClass: 'trace-modal',
    overlayClass: 'trace-modal-overlay',
    closeButtonClass: 'trace-modal-close',
    animations: true,      // 是否启用动画
    closeOnEscape: true,   // 按ESC键关闭
    closeOnOverlayClick: true, // 点击遮罩层关闭
    removeOnClose: true,   // 关闭时移除DOM元素
    showCloseButton: true, // 显示关闭按钮
    lockScroll: true,      // 锁定页面滚动
    zIndex: 1000          // 基础z-index值
  },
  
  // 内部状态
  _state: {
    modals: [],           // 当前打开的模态框列表
    stylesAdded: false,   // 样式是否已添加
    uniqueId: 1           // 唯一ID计数器
  },
  
  /**
   * 初始化Modal组件
   * @param {Object} options - 可选配置参数
   * @returns {Object} - Modal组件实例
   */
  init(options = {}) {
    // 合并配置
    this.config = { ...this.config, ...options };
    
    // 添加样式
    if (!this._state.stylesAdded) {
      this._addModalStyles();
      this._state.stylesAdded = true;
    }
    
    // 添加全局事件监听
    if (this.config.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._state.modals.length > 0) {
          const lastModalId = this._state.modals[this._state.modals.length - 1];
          this.close(lastModalId);
        }
      });
    }
    
    console.log('Modal组件已初始化');
    return this;
  },
  
  /**
   * 添加Modal样式
   * @private
   */
  _addModalStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .${this.config.overlayClass} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${this.config.zIndex};
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      
      .${this.config.overlayClass}.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .${this.config.modalClass} {
        background-color: #fff;
        border-radius: 6px;
        box-shadow: 0 3px 15px rgba(0, 0, 0, 0.2);
        max-width: 90%;
        width: auto;
        max-height: 90vh;
        overflow: auto;
        position: relative;
        transform: translateY(-20px);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }
      
      .${this.config.overlayClass}.visible .${this.config.modalClass} {
        transform: translateY(0);
        opacity: 1;
      }
      
      .${this.config.modalClass}-header {
        padding: 16px 20px;
        border-bottom: 1px solid #eaeaea;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .${this.config.modalClass}-title {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: #333;
      }
      
      .${this.config.closeButtonClass} {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: #999;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
      }
      
      .${this.config.closeButtonClass}:hover {
        color: #666;
      }
      
      .${this.config.modalClass}-body {
        padding: 20px;
      }
      
      .${this.config.modalClass}-footer {
        padding: 16px 20px;
        border-top: 1px solid #eaeaea;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .${this.config.modalClass}-btn {
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid #ddd;
        background-color: #f5f5f5;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .${this.config.modalClass}-btn:hover {
        background-color: #e9e9e9;
      }
      
      .${this.config.modalClass}-btn-primary {
        background-color: #2196F3;
        border-color: #1976D2;
        color: white;
      }
      
      .${this.config.modalClass}-btn-primary:hover {
        background-color: #1976D2;
      }
      
      .${this.config.modalClass}-enter {
        opacity: 0;
        transform: translateY(-20px);
      }
      
      .${this.config.modalClass}-enter-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .${this.config.modalClass}-exit {
        opacity: 1;
        transform: translateY(0);
      }
      
      .${this.config.modalClass}-exit-active {
        opacity: 0;
        transform: translateY(-20px);
      }
      
      /* 尺寸变体 */
      .${this.config.modalClass}-small {
        width: 300px;
      }
      
      .${this.config.modalClass}-medium {
        width: 500px;
      }
      
      .${this.config.modalClass}-large {
        width: 800px;
      }
      
      .${this.config.modalClass}-fullscreen {
        width: 95%;
        height: 95vh;
      }
    `;
    
    document.head.appendChild(styleEl);
  },
  
  /**
   * 创建Modal对话框
   * @param {Object} options - 模态框选项
   * @param {string} options.title - 模态框标题
   * @param {string|HTMLElement} options.content - 模态框内容(HTML字符串或DOM元素)
   * @param {string} options.size - 模态框尺寸 ('small', 'medium', 'large', 'fullscreen', 或自定义宽度如'600px')
   * @param {Array} options.buttons - 底部按钮配置数组
   * @param {boolean} options.closable - 是否可关闭
   * @param {Function} options.onOpen - 打开回调
   * @param {Function} options.onClose - 关闭回调
   * @returns {Object} - 包含模态框ID和控制方法的对象
   */
  create(options = {}) {
    // 如果样式未添加，初始化
    if (!this._state.stylesAdded) {
      this.init();
    }
    
    // 创建唯一ID
    const id = `modal-${this._state.uniqueId++}`;
    
    // 合并选项
    const modalOptions = {
      title: '对话框',
      content: '',
      size: 'medium',
      buttons: [],
      closable: true,
      onOpen: null,
      onClose: null,
      ...options
    };
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = this.config.overlayClass;
    overlay.id = `${id}-overlay`;
    
    // 如果启用点击遮罩关闭
    if (this.config.closeOnOverlayClick && modalOptions.closable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close(id);
        }
      });
    }
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = this.config.modalClass;
    modal.id = id;
    
    // 设置尺寸
    if (['small', 'medium', 'large', 'fullscreen'].includes(modalOptions.size)) {
      modal.classList.add(`${this.config.modalClass}-${modalOptions.size}`);
    } else if (modalOptions.size) {
      // 自定义宽度
      modal.style.width = modalOptions.size;
    }
    
    // 创建模态框头部
    const header = document.createElement('div');
    header.className = `${this.config.modalClass}-header`;
    
    const title = document.createElement('h3');
    title.className = `${this.config.modalClass}-title`;
    title.textContent = modalOptions.title;
    header.appendChild(title);
    
    // 添加关闭按钮
    if (this.config.showCloseButton && modalOptions.closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = this.config.closeButtonClass;
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.addEventListener('click', () => this.close(id));
      header.appendChild(closeBtn);
    }
    
    modal.appendChild(header);
    
    // 创建模态框内容
    const body = document.createElement('div');
    body.className = `${this.config.modalClass}-body`;
    
    if (typeof modalOptions.content === 'string') {
      body.innerHTML = modalOptions.content;
    } else if (modalOptions.content instanceof HTMLElement) {
      body.appendChild(modalOptions.content);
    }
    
    modal.appendChild(body);
    
    // 如果有按钮，创建底部按钮区域
    if (modalOptions.buttons && modalOptions.buttons.length > 0) {
      const footer = document.createElement('div');
      footer.className = `${this.config.modalClass}-footer`;
      
      modalOptions.buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `${this.config.modalClass}-btn`;
        
        if (btn.primary) {
          button.classList.add(`${this.config.modalClass}-btn-primary`);
        }
        
        button.textContent = btn.text || '按钮';
        
        if (btn.onClick) {
          button.addEventListener('click', (e) => {
            btn.onClick(e, {
              close: () => this.close(id),
              id
            });
          });
        }
        
        if (btn.close) {
          button.addEventListener('click', () => this.close(id));
        }
        
        footer.appendChild(button);
      });
      
      modal.appendChild(footer);
    }
    
    // 添加模态框到遮罩层
    overlay.appendChild(modal);
    
    // 添加到文档
    document.body.appendChild(overlay);
    
    // 记录模态框
    this._state.modals.push(id);
    
    // 如果需要锁定滚动
    if (this.config.lockScroll) {
      document.body.style.overflow = 'hidden';
    }
    
    // 使用requestAnimationFrame来确保DOM已更新
    requestAnimationFrame(() => {
      // 显示遮罩和模态框
      overlay.classList.add('visible');
      
      // 触发打开回调
      if (typeof modalOptions.onOpen === 'function') {
        modalOptions.onOpen({
          id,
          close: () => this.close(id),
          overlay,
          modal
        });
      }
    });
    
    // 返回控制对象
    return {
      id,
      close: () => this.close(id),
      update: (content) => this.update(id, content),
      getElement: () => document.getElementById(id)
    };
  },
  
  /**
   * 更新Modal内容
   * @param {string} id - Modal ID
   * @param {string|HTMLElement} content - 新内容
   * @returns {boolean} - 更新是否成功
   */
  update(id, content) {
    const modal = document.getElementById(id);
    if (!modal) return false;
    
    const body = modal.querySelector(`.${this.config.modalClass}-body`);
    if (!body) return false;
    
    // 清空当前内容
    body.innerHTML = '';
    
    // 设置新内容
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }
    
    return true;
  },
  
  /**
   * 关闭Modal
   * @param {string} id - Modal ID
   * @returns {boolean} - 关闭是否成功
   */
  close(id) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById(`${id}-overlay`);
    
    if (!modal || !overlay) return false;
    
    // 查找并执行关闭回调
    const modalIndex = this._state.modals.indexOf(id);
    const options = modal._options || {};
    
    // 移除遮罩可见类
    overlay.classList.remove('visible');
    
    // 如果有关闭回调，执行
    if (typeof options.onClose === 'function') {
      options.onClose({
        id,
        modal,
        overlay
      });
    }
    
    // 从模态框列表中移除
    if (modalIndex !== -1) {
      this._state.modals.splice(modalIndex, 1);
    }
    
    // 移除元素
    setTimeout(() => {
      if (this.config.removeOnClose) {
        document.body.removeChild(overlay);
      } else {
        overlay.style.display = 'none';
      }
      
      // 如果没有打开的模态框且需要解锁滚动
      if (this._state.modals.length === 0 && this.config.lockScroll) {
        document.body.style.overflow = '';
      }
    }, 300); // 等待动画完成
    
    return true;
  },
  
  /**
   * 关闭所有打开的Modal
   */
  closeAll() {
    // 复制数组，因为在循环中会修改原数组
    const modals = [...this._state.modals];
    modals.forEach(id => this.close(id));
  },
  
  /**
   * 打开确认对话框
   * @param {Object} options - 确认框选项
   * @param {string} options.title - 标题
   * @param {string} options.message - 消息内容
   * @param {string} options.confirmText - 确认按钮文本
   * @param {string} options.cancelText - 取消按钮文本
   * @param {Function} options.onConfirm - 确认回调
   * @param {Function} options.onCancel - 取消回调
   * @returns {Object} - Modal控制对象
   */
  confirm(options = {}) {
    const confirmOptions = {
      title: '确认',
      message: '确定要执行此操作吗？',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: null,
      onCancel: null,
      ...options
    };
    
    return this.create({
      title: confirmOptions.title,
      content: `<p>${confirmOptions.message}</p>`,
      size: 'small',
      buttons: [
        {
          text: confirmOptions.cancelText,
          close: true,
          onClick: (e, { close }) => {
            if (typeof confirmOptions.onCancel === 'function') {
              confirmOptions.onCancel();
            }
            close();
          }
        },
        {
          text: confirmOptions.confirmText,
          primary: true,
          close: true,
          onClick: (e, { close }) => {
            if (typeof confirmOptions.onConfirm === 'function') {
              confirmOptions.onConfirm();
            }
            close();
          }
        }
      ]
    });
  },
  
  /**
   * 打开提示对话框
   * @param {Object} options - 提示框选项
   * @param {string} options.title - 标题
   * @param {string} options.message - 消息内容
   * @param {string} options.buttonText - 按钮文本
   * @param {Function} options.onClose - 关闭回调
   * @returns {Object} - Modal控制对象
   */
  alert(options = {}) {
    const alertOptions = {
      title: '提示',
      message: '',
      buttonText: '确定',
      onClose: null,
      ...options
    };
    
    return this.create({
      title: alertOptions.title,
      content: `<p>${alertOptions.message}</p>`,
      size: 'small',
      buttons: [
        {
          text: alertOptions.buttonText,
          primary: true,
          close: true,
          onClick: (e, { close }) => {
            if (typeof alertOptions.onClose === 'function') {
              alertOptions.onClose();
            }
            close();
          }
        }
      ]
    });
  }
};

// 便捷方法
export const openModal = (options) => traceModal.create(options);
export const showConfirm = (options) => traceModal.confirm(options);
export const showAlert = (options) => traceModal.alert(options);

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceModal = traceModal;
  window.openModal = openModal;
  window.showConfirm = showConfirm;
  window.showAlert = showAlert;
} 