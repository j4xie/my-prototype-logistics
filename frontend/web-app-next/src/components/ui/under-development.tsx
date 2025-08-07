'use client';

interface UnderDevelopmentOptions {
  feature?: string;
  message?: string;
}

/**
 * 显示功能开发中的提示
 * @param options 配置选项
 */
export const showUnderDevelopment = (options: UnderDevelopmentOptions = {}) => {
  const { feature = '该功能', message = '功能正在开发中，敬请期待！' } = options;
  
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  
  // 创建提示框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 24px 32px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    text-align: center;
  `;
  
  dialog.innerHTML = `
    <div style="margin-bottom: 16px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6; margin: 0 auto;">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
    </div>
    <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #1f2937;">${feature}</h3>
    <p style="color: #6b7280; margin-bottom: 20px;">${message}</p>
    <button id="under-development-close" style="
      background-color: #3b82f6;
      color: white;
      padding: 8px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    " onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
      确定
    </button>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // 处理关闭
  const closeDialog = () => {
    document.body.removeChild(overlay);
  };
  
  // 点击确定按钮关闭
  const closeButton = dialog.querySelector('#under-development-close');
  if (closeButton) {
    closeButton.addEventListener('click', closeDialog);
  }
  
  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
    }
  });
  
  // ESC键关闭
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
};