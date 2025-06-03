/**
 * @module Button
 * @description 食品溯源系统 - 标准化按钮组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 * 
 * @deprecated 此组件已废弃，请使用新版本
 * @see web-app-next/src/components/ui/button.tsx (权威来源)
 * @migration 新版本支持更好的TypeScript类型安全和WCAG 2.1 AA可访问性
 * @example 
 * // ❌ 废弃用法 (Phase-2)
 * import Button from '@/components/ui/Button'
 * 
 * // ✅ 推荐用法 (Phase-3)
 * import { Button } from '@/components/ui/button'
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 可访问性友好的按钮组件
 * 支持WCAG 2.1 AA级别标准
 */
const Button = ({
  children,
  onClick,
  onKeyDown,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className = '',
  ariaLabel,
  ariaDescribedBy,
  tabIndex = 0,
  autoFocus = false,
  ...props
}) => {
  // 处理键盘事件
  const handleKeyDown = (event) => {
    // Enter或Space键触发点击
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled && onClick) {
        onClick(event);
      }
    }
    
    // 调用自定义键盘处理器
    if (onKeyDown) {
      onKeyDown(event);
    }
  };

  // 处理点击事件
  const handleClick = (event) => {
    if (!disabled && onClick) {
      onClick(event);
    }
  };

  // 构建CSS类名
  const getButtonClasses = () => {
    const baseClasses = 'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variantClasses = {
      primary: 'bg-[#1890FF] text-white hover:bg-[#0e7bd1] focus:ring-[#1890FF] border border-[#1890FF]',
      secondary: 'bg-white text-[#1890FF] hover:bg-[#f0f8ff] focus:ring-[#1890FF] border border-[#1890FF]',
      success: 'bg-[#52C41A] text-white hover:bg-[#389e0d] focus:ring-[#52C41A] border border-[#52C41A]',
      danger: 'bg-[#FF4D4F] text-white hover:bg-[#cf1322] focus:ring-[#FF4D4F] border border-[#FF4D4F]',
      ghost: 'bg-transparent text-[#1890FF] hover:bg-[#f0f8ff] focus:ring-[#1890FF] border border-[#d9d9d9]'
    };
    
    const sizeClasses = {
      small: 'px-3 py-1.5 text-sm min-h-[32px]',
      medium: 'px-4 py-2 text-base min-h-[40px]',
      large: 'px-6 py-3 text-lg min-h-[48px]'
    };
    
    const disabledClasses = 'opacity-50 cursor-not-allowed hover:bg-current';
    
    return [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      disabled && disabledClasses,
      className
    ].filter(Boolean).join(' ');
  };

  return (
    <button
      type={type}
      className={getButtonClasses()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-disabled={disabled}
      aria-describedby={ariaDescribedBy}
      tabIndex={disabled ? -1 : tabIndex}
      autoFocus={autoFocus}
      {...props}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  onKeyDown: PropTypes.func,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  ariaDescribedBy: PropTypes.string,
  tabIndex: PropTypes.number,
  autoFocus: PropTypes.bool
};

export default Button; 