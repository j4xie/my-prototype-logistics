/**
 * @module PageLayout
 * @description 食品溯源系统 - 响应式页面布局组件 (TypeScript现代化版本)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { forwardRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import MobileNav, { BottomTabBar, TabItem } from './mobile-nav';

// ==================== 类型定义 ====================

/**
 * 菜单项定义
 */
export interface MenuItem {
  /** 唯一标识 */
  id: string;
  /** 菜单项标签 */
  label: string;
  /** 图标 (可选) */
  icon?: React.ReactNode;
  /** 点击处理函数 */
  onClick: () => void;
}

/**
 * 页面布局组件属性
 */
export interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 页面标题 */
  title?: string;
  /** 是否显示返回按钮 */
  showBack?: boolean;
  /** 返回按钮点击处理函数 */
  onBack?: () => void;
  /** 右侧内容 */
  rightContent?: React.ReactNode;
  /** 菜单项列表 */
  menuItems?: MenuItem[];
  /** 底部标签栏配置 */
  bottomTabs?: TabItem[];
  /** 当前活动标签 */
  activeTab?: string;
  /** 标签切换处理函数 */
  onTabChange?: (tabId: string) => void;
  /** 是否占满全屏高度 */
  fullHeight?: boolean;
}

/**
 * 内容区域组件属性
 */
export interface ContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否添加内边距 */
  padding?: boolean;
}

/**
 * 页面头部组件属性
 */
export type HeaderProps = React.HTMLAttributes<HTMLElement>;

/**
 * 页面底部组件属性
 */
export type FooterProps = React.HTMLAttributes<HTMLElement>;

// ==================== 组件实现 ====================

/**
 * 响应式页面布局组件
 */
const PageLayout = forwardRef<HTMLDivElement, PageLayoutProps>(({
  children,
  title = '',
  showBack = false,
  onBack,
  rightContent,
  menuItems = [],
  bottomTabs = [],
  activeTab = '',
  onTabChange,
  fullHeight = true,
  className,
  ...props
}, ref) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 计算内容区域的padding - 严格遵循UI设计系统规范
  const getContentPadding = () => {
    const topPadding = isMobile && (title || showBack || rightContent || menuItems.length > 0) ? 'pt-[80px]' : '';
    const bottomPadding = isMobile && bottomTabs.length > 0 ? 'pb-[80px]' : '';
    return `${topPadding} ${bottomPadding}`.trim();
  };

  // 页面容器样式 - 严格遵循Neo Minimal iOS-Style Admin UI设计规范
  const containerClasses = cn(
    'flex flex-col', // 外层页面包装器布局 - 验证规范要求
    'max-w-[390px]', // UI设计系统规范的最大宽度
    'mx-auto', // 居中布局
    fullHeight && 'min-h-screen',
    className
  );

  // 内容区域样式
  const contentClasses = cn(
    'flex-1',
    'w-full',
    getContentPadding()
  );

  // 转换菜单项为MobileNav所需的格式
  const navItems = menuItems.map(item => ({
    key: item.id,
    label: item.label,
    icon: item.icon,
    onClick: item.onClick
  }));

  return (
    <div ref={ref} className={containerClasses} {...props}>
      {/* 移动端导航栏 */}
      {isMobile && (title || showBack || rightContent || menuItems.length > 0) && (
        <MobileNav
          items={navItems}
          className="fixed top-0 left-0 right-0 z-[999]"
          ariaLabel="页面导航"
        />
      )}

      {/* 桌面端标题栏 */}
      {!isMobile && title && (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {showBack && (
                <button
                  onClick={onBack || (() => window.history.back())}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="返回"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const handleAction = onBack || (() => window.history.back());
                      handleAction();
                    }
                  }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <h1 className="text-2xl font-medium text-gray-900">
                {title}
              </h1>
            </div>
            {rightContent && (
              <div className="flex items-center space-x-2">
                {rightContent}
              </div>
            )}
          </div>
        </header>
      )}

      {/* 主要内容区域 */}
      <main className={contentClasses}>
        {children}
      </main>

      {/* 移动端底部标签栏 */}
      {isMobile && bottomTabs.length > 0 && (
        <BottomTabBar
          tabs={bottomTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
});

PageLayout.displayName = 'PageLayout';

// ==================== 子组件 ====================

/**
 * 内容区域组件
 */
const Content = forwardRef<HTMLDivElement, ContentProps>(({
  children,
  className,
  padding = true,
  ...props
}, ref) => {
  const contentClasses = cn(
    'w-full',
    padding && 'p-4',
    className
  );

  return (
    <div ref={ref} className={contentClasses} {...props}>
      {children}
    </div>
  );
});

Content.displayName = 'PageLayout.Content';

/**
 * 页面头部组件
 */
const Header = forwardRef<HTMLElement, HeaderProps>(({
  children,
  className,
  ...props
}, ref) => {
  const headerClasses = cn(
    'bg-white',
    'border-b',
    'border-gray-200',
    'p-4',
    className
  );

  return (
    <header ref={ref} className={headerClasses} {...props}>
      {children}
    </header>
  );
});

Header.displayName = 'PageLayout.Header';

/**
 * 页面底部组件
 */
const Footer = forwardRef<HTMLElement, FooterProps>(({
  children,
  className,
  ...props
}, ref) => {
  const footerClasses = cn(
    'bg-white',
    'border-t',
    'border-gray-200',
    'p-4',
    'mt-auto',
    className
  );

  return (
    <footer ref={ref} className={footerClasses} {...props}>
      {children}
    </footer>
  );
});

Footer.displayName = 'PageLayout.Footer';

// 组合子组件
const PageLayoutWithComponents = Object.assign(PageLayout, {
  Content,
  Header,
  Footer
});

export default PageLayoutWithComponents; 