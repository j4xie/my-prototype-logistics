/**
 * @deprecated 此组件已废弃，请使用 PageLayout 组件: 
 * import { PageLayout } from '@/components/ui';
 * 请查看迁移指南文档 refactor/phase-3/docs/MIGRATION-GUIDE.md 获取更多信息
 * 
 * @module PageLayout
 * @description 食品溯源系统 - 响应式页面布局组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

import { useEffect, useState } from 'react';
import MobileNav from '../navigation/MobileNav';

/**
 * 响应式页面布局组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 页面内容
 * @param {string} props.title - 页面标题
 * @param {boolean} props.showBack - 是否显示返回按钮
 * @param {Function} props.onBack - 返回按钮点击处理函数
 * @param {React.ReactNode} props.rightContent - 右侧内容
 * @param {Array} props.menuItems - 菜单项列表
 * @param {Array} props.bottomTabs - 底部标签栏配置
 * @param {string} props.activeTab - 当前活动标签
 * @param {Function} props.onTabChange - 标签切换处理函数
 * @param {boolean} props.fullHeight - 是否占满全屏高度
 * @param {string} props.className - 额外的CSS类名
 * @returns {JSX.Element} 页面布局组件
 */
const PageLayout = ({
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
  className = ''
}) => {
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
  const containerClasses = [
    'flex flex-col min-h-screen', // 外层页面包装器布局 - 验证规范要求
    'max-w-[390px]', // UI设计系统规范的最大宽度
    'mx-auto', // 居中布局
    fullHeight ? 'min-h-screen' : '',
    className
  ].filter(Boolean).join(' ');

  // 内容区域样式
  const contentClasses = [
    'flex-1',
    'w-full',
    getContentPadding()
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {/* 移动端导航栏 */}
      {isMobile && (title || showBack || rightContent || menuItems.length > 0) && (
        <MobileNav
          title={title}
          showBack={showBack}
          onBack={onBack}
          rightContent={rightContent}
          menuItems={menuItems}
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
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
              <h1 className="text-2xl font-semibold text-gray-900">
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
        <MobileNav.BottomTabBar
          tabs={bottomTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
};

/**
 * 内容区域组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 内容
 * @param {string} props.className - 额外的CSS类名
 * @param {boolean} props.padding - 是否添加内边距
 * @returns {JSX.Element} 内容区域组件
 */
PageLayout.Content = ({
  children,
  className = '',
  padding = true
}) => {
  const contentClasses = [
    'w-full',
    padding ? 'p-4' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={contentClasses}>
      {children}
    </div>
  );
};

/**
 * 页面头部组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 头部内容
 * @param {string} props.className - 额外的CSS类名
 * @returns {JSX.Element} 页面头部组件
 */
PageLayout.Header = ({
  children,
  className = ''
}) => {
  const headerClasses = [
    'bg-white',
    'border-b',
    'border-gray-200',
    'p-4',
    className
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClasses}>
      {children}
    </header>
  );
};

/**
 * 页面底部组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 底部内容
 * @param {string} props.className - 额外的CSS类名
 * @returns {JSX.Element} 页面底部组件
 */
PageLayout.Footer = ({
  children,
  className = ''
}) => {
  const footerClasses = [
    'bg-white',
    'border-t',
    'border-gray-200',
    'p-4',
    'mt-auto',
    className
  ].filter(Boolean).join(' ');

  return (
    <footer className={footerClasses}>
      {children}
    </footer>
  );
};

export default PageLayout; 