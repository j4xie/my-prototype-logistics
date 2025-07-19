import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Badge组件类型定义
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'default' | 'large';
  shape?: 'rounded' | 'pill' | 'square';
}

// StatusBadge组件类型定义
export interface StatusBadgeProps extends Omit<BadgeProps, 'children'> {
  status:
    | 'active'
    | 'inactive'
    | 'pending'
    | 'completed'
    | 'failed'
    | 'processing'
    | string;
}

// NumberBadge组件类型定义
export interface NumberBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number;
  max?: number;
  showZero?: boolean;
}

// DotBadge组件类型定义
export interface DotBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * Badge组件 - 状态标签和标记显示
 * 符合Neo Minimal iOS-Style Admin UI设计规范
 * 支持WCAG 2.1 AA可访问性标准
 */
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = 'default',
      size = 'default',
      shape = 'rounded',
      className,
      ...props
    },
    ref
  ) => {
    // 变体样式
    const variantClasses = {
      default: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      primary: 'bg-[#E6F7FF] text-[#1890FF] hover:bg-[#BAE7FF]',
      success: 'bg-[#F6FFED] text-[#52C41A] hover:bg-[#D9F7BE]',
      warning: 'bg-[#FFF7E6] text-[#FA8C16] hover:bg-[#FFE7BA]',
      error: 'bg-[#FFF2F0] text-[#FF4D4F] hover:bg-[#FFCCC7]',
      info: 'bg-[#E6F7FF] text-[#1890FF] hover:bg-[#BAE7FF]',
    };

    // 尺寸样式
    const sizeClasses = {
      small: 'px-2 py-0.5 text-xs min-h-[18px]',
      default: 'px-2 py-0.5 text-xs min-h-[20px]',
      large: 'px-3 py-1 text-sm min-h-[24px]',
    };

    // 形状样式
    const shapeClasses = {
      rounded: 'rounded',
      pill: 'rounded-full',
      square: 'rounded-none',
    };

    return (
      <span
        ref={ref}
        className={cn(
          // 基础样式
          'inline-flex items-center justify-center font-medium whitespace-nowrap',
          'transition-all duration-200 focus:ring-2 focus:ring-offset-1 focus:outline-none',
          // 变体样式
          variantClasses[variant],
          // 尺寸样式
          sizeClasses[size],
          // 形状样式
          shapeClasses[shape],
          // Focus ring颜色
          variant === 'primary' || variant === 'info'
            ? 'focus:ring-[#1890FF]'
            : variant === 'success'
              ? 'focus:ring-[#52C41A]'
              : variant === 'warning'
                ? 'focus:ring-[#FA8C16]'
                : variant === 'error'
                  ? 'focus:ring-[#FF4D4F]'
                  : 'focus:ring-gray-400',
          className
        )}
        role="status"
        aria-label={typeof children === 'string' ? children : undefined}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * StatusBadge - 预定义的状态Badge组件
 * 支持常见的状态类型，自动映射到相应的样式和文本
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, ...props }, ref) => {
    const statusConfig = {
      active: { variant: 'success' as const, text: '活跃' },
      inactive: { variant: 'default' as const, text: '非活跃' },
      pending: { variant: 'warning' as const, text: '待处理' },
      completed: { variant: 'success' as const, text: '已完成' },
      failed: { variant: 'error' as const, text: '失败' },
      processing: { variant: 'info' as const, text: '处理中' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: 'default' as const,
      text: status,
    };

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        aria-label={`状态: ${config.text}`}
        {...props}
      >
        {config.text}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

/**
 * NumberBadge - 数字Badge组件
 * 用于显示计数信息，支持最大值限制和零值控制
 */
export const NumberBadge = forwardRef<HTMLSpanElement, NumberBadgeProps>(
  ({ count, max = 99, showZero = false, ...props }, ref) => {
    if (!showZero && (!count || count === 0)) {
      return null;
    }

    const displayCount = count > max ? `${max}+` : count.toString();

    return (
      <Badge
        ref={ref}
        variant="error"
        shape="pill"
        size="small"
        aria-label={`数量: ${count}`}
        {...props}
      >
        {displayCount}
      </Badge>
    );
  }
);

NumberBadge.displayName = 'NumberBadge';

/**
 * DotBadge - 点状Badge组件
 * 用于简单的状态指示器，只显示颜色点而不显示文本
 */
export const DotBadge = forwardRef<HTMLSpanElement, DotBadgeProps>(
  ({ variant = 'primary', className, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-gray-400',
      primary: 'bg-[#1890FF]',
      success: 'bg-[#52C41A]',
      warning: 'bg-[#FA8C16]',
      error: 'bg-[#FF4D4F]',
      info: 'bg-[#1890FF]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-block h-2 w-2 rounded-full transition-colors duration-200',
          'focus:ring-2 focus:ring-offset-1 focus:outline-none',
          variantClasses[variant],
          // Focus ring颜色
          variant === 'primary' || variant === 'info'
            ? 'focus:ring-[#1890FF]'
            : variant === 'success'
              ? 'focus:ring-[#52C41A]'
              : variant === 'warning'
                ? 'focus:ring-[#FA8C16]'
                : variant === 'error'
                  ? 'focus:ring-[#FF4D4F]'
                  : 'focus:ring-gray-400',
          className
        )}
        role="status"
        aria-label={`状态指示器: ${variant}`}
        tabIndex={0}
        {...props}
      />
    );
  }
);

DotBadge.displayName = 'DotBadge';

export default Badge;
