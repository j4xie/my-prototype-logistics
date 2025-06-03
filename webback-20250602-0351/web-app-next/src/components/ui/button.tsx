/**
 * @module Button
 * @description 食品溯源系统 - 现代化按钮组件 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 *
 * @note Phase-3现代化实现：TypeScript + React 18 + Tailwind CSS
 * @example
 * import { Button } from '@/components/ui/button'
 *
 * <Button variant="primary" size="medium" onClick={handleClick}>
 *   点击按钮
 * </Button>
 */

import React from 'react';
import { cn } from '@/lib/utils';

// TypeScript接口定义
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * 现代化可访问性友好的按钮组件
 * 支持WCAG 2.1 AA级别标准 + React 18特性
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'medium',
      disabled = false,
      loading = false,
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // 处理键盘事件 - 保持原有可访问性逻辑
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      // Enter或Space键触发点击
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!disabled && !loading && props.onClick) {
          props.onClick(event as any);
        }
      }

      // 调用自定义键盘处理器
      if (props.onKeyDown) {
        props.onKeyDown(event);
      }
    };

    // 处理点击事件
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading && props.onClick) {
        props.onClick(event);
      }
    };

    // 构建CSS类名 - 使用cn工具函数
    const buttonClasses = cn(
      // 基础样式
      'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-current',

      // 变体样式
      {
        'bg-[#1890FF] text-white hover:bg-[#0e7bd1] focus:ring-[#1890FF] border border-[#1890FF]':
          variant === 'primary',
        'bg-white text-[#1890FF] hover:bg-[#f0f8ff] focus:ring-[#1890FF] border border-[#1890FF]':
          variant === 'secondary',
        'bg-[#52C41A] text-white hover:bg-[#389e0d] focus:ring-[#52C41A] border border-[#52C41A]':
          variant === 'success',
        'bg-[#FF4D4F] text-white hover:bg-[#cf1322] focus:ring-[#FF4D4F] border border-[#FF4D4F]':
          variant === 'danger',
        'bg-transparent text-[#1890FF] hover:bg-[#f0f8ff] focus:ring-[#1890FF] border border-[#d9d9d9]':
          variant === 'ghost',
      },

      // 尺寸样式
      {
        'px-3 py-1.5 text-sm min-h-[32px]': size === 'small',
        'px-4 py-2 text-base min-h-[40px]': size === 'medium',
        'px-6 py-3 text-lg min-h-[48px]': size === 'large',
      },

      // 加载状态
      {
        'cursor-wait': loading,
      },

      className
    );

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-label={
          props['aria-label'] ||
          (typeof children === 'string' ? children : undefined)
        }
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 -ml-1 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
