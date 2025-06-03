import React, { useEffect, useRef } from 'react';

/**
 * 标准化的Modal对话框组件
 * 
 * @param {Object} props - 组件属性
 * @param {boolean} props.isOpen - 是否显示模态框
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.title - 标题
 * @param {React.ReactNode} props.children - 内容
 * @param {React.ReactNode} props.footer - 底部内容
 * @param {string} props.size - 尺寸 ('sm', 'md', 'lg', 'xl', 'full')
 * @param {boolean} props.closable - 是否可关闭
 * @param {boolean} props.maskClosable - 点击遮罩是否关闭
 * @param {boolean} props.keyboard - 按ESC是否关闭
 * @param {string} props.className - 额外的CSS类名
 */
const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closable = true,
  maskClosable = true,
  keyboard = true,
  className = '',
  ...props
}) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // 尺寸样式映射
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  };

  // 处理键盘事件
  useEffect(() => {
    if (!isOpen || !keyboard) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, keyboard, onClose]);

  // 焦点管理
  useEffect(() => {
    if (isOpen) {
      // 保存当前焦点
      previousFocusRef.current = document.activeElement;
      
      // 设置焦点到模态框
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 100);
    } else {
      // 恢复之前的焦点
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 处理遮罩点击
  const handleMaskClick = (e) => {
    if (maskClosable && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // 处理关闭按钮点击
  const handleClose = () => {
    if (closable) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={handleMaskClick}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300" />
      
      {/* 模态框内容 */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`
          relative bg-white rounded-lg shadow-xl transform transition-all duration-300
          ${sizeClasses[size]} w-full mx-4 max-h-[90vh] flex flex-col
          ${className}
        `}
        {...props}
      >
        {/* 头部 */}
        {(title || closable) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {title && (
              <h3 id="modal-title" className="text-lg font-medium text-gray-900">
                {title}
              </h3>
            )}
            
            {closable && (
              <button
                type="button"
                onClick={handleClose}
                className="
                  p-1 ml-auto bg-transparent border-0 text-gray-400 
                  hover:text-gray-600 focus:outline-none focus:text-gray-600
                  transition-colors duration-200
                "
                aria-label="关闭"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 p-4 overflow-y-auto">
          {children}
        </div>

        {/* 底部 */}
        {footer && (
          <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal; 