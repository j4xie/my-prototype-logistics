/**
 * @module MobileNav
 * @description 食品溯源系统 - 移动端导航组件 (TypeScript现代化版本)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { useState, useCallback, forwardRef, ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/**
 * 导航项接口
 */
export interface NavItem {
  /** 唯一标识符 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 图标 (字符串URL或React节点) */
  icon?: string | ReactNode;
  /** 徽章数量 */
  badge?: number | string;
  /** 可访问性标签 */
  ariaLabel?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 标签项接口
 */
export interface TabItem {
  /** 唯一标识符 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon?: ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * MobileNav组件属性
 */
export interface MobileNavProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'> {
  /** 导航项列表 */
  items?: NavItem[];
  /** 当前活动项 */
  activeItem?: string;
  /** 项目点击处理函数 */
  onItemClick?: (item: NavItem) => void;
  /** 可访问性标签 */
  ariaLabel?: string;
}

/**
 * BottomTabBar组件属性
 */
export interface BottomTabBarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 标签项列表 */
  tabs?: TabItem[];
  /** 当前活动标签 */
  activeTab?: string;
  /** 标签切换处理函数 */
  onTabChange?: (tabKey: string) => void;
}

// ==================== 主组件 ====================

/**
 * 移动端导航组件
 * 支持WCAG 2.1 AA级别可访问性标准
 */
const MobileNav = forwardRef<HTMLElement, MobileNavProps>(
  (
    {
      items = [],
      activeItem = '',
      onItemClick,
      className,
      ariaLabel = '主导航',
      ...props
    },
    ref
  ) => {
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // 处理键盘导航
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent, index: number) => {
        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault();
            const nextIndex = index < items.length - 1 ? index + 1 : 0;
            setFocusedIndex(nextIndex);
            break;

          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault();
            const prevIndex = index > 0 ? index - 1 : items.length - 1;
            setFocusedIndex(prevIndex);
            break;

          case 'Home':
            event.preventDefault();
            setFocusedIndex(0);
            break;

          case 'End':
            event.preventDefault();
            setFocusedIndex(items.length - 1);
            break;

          case 'Enter':
          case ' ':
            event.preventDefault();
            if (onItemClick && !items[index]?.disabled) {
              onItemClick(items[index]);
            }
            break;
        }
      },
      [items, onItemClick]
    );

    // 处理项目点击
    const handleItemClick = useCallback(
      (item: NavItem, index: number) => {
        if (item.disabled) return;

        setFocusedIndex(index);
        if (onItemClick) {
          onItemClick(item);
        }
      },
      [onItemClick]
    );

    // 获取导航项样式
    const getNavItemClasses = useCallback(
      (item: NavItem, index: number, isActive: boolean) => {
        const baseClasses =
          'relative flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-2';

        const stateClasses = item.disabled
          ? 'text-gray-400 cursor-not-allowed'
          : isActive
            ? 'bg-[#1890FF] text-white'
            : 'text-gray-600 hover:text-[#1890FF] hover:bg-[#f0f8ff]';

        const focusClasses =
          focusedIndex === index ? 'ring-2 ring-[#1890FF] ring-offset-2' : '';

        return cn(baseClasses, stateClasses, focusClasses);
      },
      [focusedIndex]
    );

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={ariaLabel}
        className={cn('border-t border-gray-200 bg-white', className)}
        {...props}
      >
        <div className="mx-auto max-w-[390px]">
          <ul
            role="menubar"
            className="flex items-center justify-around py-2"
            aria-orientation="horizontal"
          >
            {items.map((item, index) => {
              const isActive = activeItem === item.key;

              return (
                <li key={item.key} role="none">
                  <button
                    role="menuitem"
                    type="button"
                    className={getNavItemClasses(item, index, isActive)}
                    onClick={() => handleItemClick(item, index)}
                    onKeyDown={e => handleKeyDown(e, index)}
                    aria-label={item.ariaLabel || item.label}
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={item.disabled}
                    disabled={item.disabled}
                    tabIndex={
                      focusedIndex === index ||
                      (focusedIndex === -1 && index === 0)
                        ? 0
                        : -1
                    }
                  >
                    <div className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center">
                      {/* 图标 */}
                      {item.icon && (
                        <div
                          className="mb-1 flex h-6 w-6 items-center justify-center"
                          aria-hidden="true"
                        >
                          {typeof item.icon === 'string' ? (
                            <Image
                              src={item.icon}
                              alt=""
                              width={24}
                              height={24}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            item.icon
                          )}
                        </div>
                      )}

                      {/* 标签 */}
                      <span className="text-xs leading-tight">
                        {item.label}
                      </span>

                      {/* 徽章/计数器 */}
                      {item.badge && (
                        <span
                          className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF4D4F] px-1 text-xs text-white"
                          aria-label={`${item.badge} 个未读`}
                        >
                          {typeof item.badge === 'number' && item.badge > 99
                            ? '99+'
                            : item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    );
  }
);

MobileNav.displayName = 'MobileNav';

// ==================== 子组件 ====================

/**
 * 底部标签栏组件
 */
const BottomTabBar = forwardRef<HTMLDivElement, BottomTabBarProps>(
  ({ tabs = [], activeTab = '', onTabChange, className, ...props }, ref) => {
    const handleTabClick = useCallback(
      (tab: TabItem) => {
        if (onTabChange && !tab.disabled) {
          onTabChange(tab.key);
        }
      },
      [onTabChange]
    );

    return (
      <div
        ref={ref}
        className={cn(
          'fixed right-0 bottom-0 left-0 z-[999] border-t border-gray-200 bg-white',
          className
        )}
        {...props}
      >
        <div className="mx-auto max-w-[390px]">
          <div className="flex justify-around py-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center px-3 py-2 transition-colors',
                  activeTab === tab.key
                    ? 'text-[#1890FF]'
                    : tab.disabled
                      ? 'cursor-not-allowed text-gray-400'
                      : 'text-gray-600 hover:text-[#1890FF]'
                )}
                disabled={tab.disabled}
                aria-label={tab.label}
                aria-current={activeTab === tab.key ? 'page' : undefined}
              >
                <div className="mb-1 flex h-6 w-6 items-center justify-center">
                  {tab.icon}
                </div>
                <span className="truncate text-xs">{tab.label}</span>
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 transform rounded-full bg-[#1890FF]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

BottomTabBar.displayName = 'BottomTabBar';

// ==================== 导出 ====================

export { MobileNav, BottomTabBar };
export default MobileNav;
