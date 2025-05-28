import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// StatCard组件类型定义
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'purple';
  size?: 'small' | 'normal' | 'large';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  loading?: boolean;
  formatValue?: (value: string | number) => string;
}

/**
 * StatCard组件 - 统计数据卡片
 * 用于展示关键指标，支持趋势显示和交互
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const StatCard = forwardRef<HTMLDivElement, StatCardProps>(({
  title,
  value,
  icon = 'chart-line',
  color = 'primary',
  size = 'normal',
  trend,
  loading = false,
  formatValue,
  onClick,
  className,
  ...props
}, ref) => {
  // 颜色主题映射
  const colorClasses = {
    primary: 'bg-[#E6F7FF] text-[#1890FF]',
    success: 'bg-[#F6FFED] text-[#52C41A]',
    warning: 'bg-[#FFF7E6] text-[#FAAD14]',
    error: 'bg-[#FFF2F0] text-[#FF4D4F]',
    purple: 'bg-[#F9F0FF] text-[#722ED1]'
  };

  // 趋势指示器颜色
  const trendClasses = {
    up: 'text-[#52C41A]',
    down: 'text-[#FF4D4F]',
    neutral: 'text-gray-500'
  };

  // 趋势图标映射
  const trendIcons = {
    up: 'fa-arrow-up',
    down: 'fa-arrow-down',
    neutral: 'fa-minus'
  };

  // 尺寸样式映射
  const sizeClasses = {
    small: 'p-3',
    normal: 'p-4',
    large: 'p-6'
  };

  // 格式化数值
  const displayValue = formatValue ? formatValue(value) : value;

  return (
    <div
      ref={ref}
      className={cn(
        // 基础卡片样式
        'bg-white rounded-lg shadow-sm',
        sizeClasses[size],
        // 交互样式
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.03] transition-all duration-200',
        // 加载状态
        loading && 'opacity-60',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${title}: ${displayValue}` : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as any);
        }
      } : undefined}
      {...props}
    >
      <div className="flex items-center justify-between">
        {/* 左侧内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 mb-1 truncate" title={title}>
            {title}
          </p>
          
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-medium text-gray-900" title={String(displayValue)}>
                {displayValue}
              </p>
              
              {/* 趋势指示器 */}
              {trend && (
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  trendClasses[trend.direction]
                )}>
                  <i className={cn('fas', trendIcons[trend.direction])} aria-hidden="true" />
                  <span>{Math.abs(trend.value)}%</span>
                  {trend.label && (
                    <span className="text-gray-500">({trend.label})</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧图标 */}
        <div className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-3',
          colorClasses[color]
        )}>
          {loading ? (
            <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <i 
              className={cn('fas', `fa-${icon}`, 'text-lg')} 
              aria-hidden="true"
              title={title}
            />
          )}
        </div>
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard; 