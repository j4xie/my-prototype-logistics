/**
 * @module Badge
 * @description 食品溯源系统 - Badge徽章组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 * 
 * @deprecated 此组件已废弃，请使用新版本
 * @see web-app-next/src/components/ui/badge.tsx (权威来源)
 * @migration 新版本支持更好的TypeScript类型安全、forwardRef和WCAG 2.1 AA可访问性
 * @example 
 * // ❌ 废弃用法 (Phase-2)
 * import Badge from '@/components/ui/Badge'
 * 
 * // ✅ 推荐用法 (Phase-3)
 * import { Badge } from '@/components/ui/badge'
 */

import React from 'react';

/**
 * Badge组件 - 状态标签和标记显示
 * 符合Neo Minimal iOS-Style Admin UI设计规范
 */
const Badge = ({
  children,
  variant = 'default', // 'default', 'primary', 'success', 'warning', 'error', 'info'
  size = 'default', // 'small', 'default', 'large'
  shape = 'rounded', // 'rounded', 'pill', 'square'
  className = '',
  ...props
}) => {
  // 变体样式
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-[#E6F7FF] text-[#1890FF]',
    success: 'bg-[#F6FFED] text-[#52C41A]',
    warning: 'bg-[#FFF7E6] text-[#FA8C16]',
    error: 'bg-[#FFF2F0] text-[#FF4D4F]',
    info: 'bg-[#E6F7FF] text-[#1890FF]'
  };

  // 尺寸样式
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    default: 'px-2 py-0.5 text-xs',
    large: 'px-3 py-1 text-sm'
  };

  // 形状样式
  const shapeClasses = {
    rounded: 'rounded',
    pill: 'rounded-full',
    square: 'rounded-none'
  };

  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'whitespace-nowrap',
    'transition-colors',
    variantClasses[variant],
    sizeClasses[size],
    shapeClasses[shape],
    className
  ].join(' ');

  return (
    <span className={baseClasses} {...props}>
      {children}
    </span>
  );
};

// 预定义的状态Badge组件
export const StatusBadge = ({ status, ...props }) => {
  const statusConfig = {
    active: { variant: 'success', text: '活跃' },
    inactive: { variant: 'default', text: '非活跃' },
    pending: { variant: 'warning', text: '待处理' },
    completed: { variant: 'success', text: '已完成' },
    failed: { variant: 'error', text: '失败' },
    processing: { variant: 'info', text: '处理中' }
  };

  const config = statusConfig[status] || { variant: 'default', text: status };

  return (
    <Badge variant={config.variant} {...props}>
      {config.text}
    </Badge>
  );
};

// 数字Badge组件
export const NumberBadge = ({ count, max = 99, showZero = false, ...props }) => {
  if (!showZero && (!count || count === 0)) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge variant="error" shape="pill" size="small" {...props}>
      {displayCount}
    </Badge>
  );
};

// 点状Badge组件
export const DotBadge = ({ variant = 'primary', className = '', ...props }) => {
  const variantClasses = {
    default: 'bg-gray-400',
    primary: 'bg-[#1890FF]',
    success: 'bg-[#52C41A]',
    warning: 'bg-[#FA8C16]',
    error: 'bg-[#FF4D4F]',
    info: 'bg-[#1890FF]'
  };

  return (
    <span
      className={`
        inline-block w-2 h-2 rounded-full
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    />
  );
};

export default Badge; 