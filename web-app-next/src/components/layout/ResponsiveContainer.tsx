'use client';

import { ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'mobile' | 'tablet' | 'desktop' | 'full';
}

/**
 * 响应式容器组件
 * 解决页面布局在大屏幕上过窄的问题
 */
export function ResponsiveContainer({
  children,
  className = '',
  maxWidth = 'desktop'
}: ResponsiveContainerProps) {
  // 根据最大宽度设置不同的容器样式
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'mobile':
        return 'max-w-[390px]'; // 移动端设计尺寸
      case 'tablet':
        return 'max-w-[768px]'; // 平板端
      case 'desktop':
        return 'max-w-[1200px]'; // 桌面端
      case 'full':
        return 'max-w-full'; // 全宽
      default:
        return 'max-w-[1200px]';
    }
  };

  return (
    <div className={`
      w-full
      ${getMaxWidthClass()}
      mx-auto
      px-4
      sm:px-6
      lg:px-8
      ${className}
    `}>
      {children}
    </div>
  );
}

/**
 * 页面级别的响应式容器
 * 包含完整的页面布局结构
 */
interface ResponsivePageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'mobile' | 'tablet' | 'desktop' | 'full';
  bgColor?: string;
}

export function ResponsivePageContainer({
  children,
  className = '',
  maxWidth = 'desktop',
  bgColor = 'bg-gray-50'
}: ResponsivePageContainerProps) {
  return (
    <div className={`flex flex-col min-h-screen ${bgColor}`}>
      <ResponsiveContainer maxWidth={maxWidth} className={className}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 专用的移动端容器（保持原有390px设计）
 * 用于需要严格移动端体验的页面
 */
export function MobileContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[390px] mx-auto ${className}`}>
      {children}
    </div>
  );
}
