/**
 * @module Tabs
 * @description 食品溯源系统 - 现代化标签页组件 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 *
 * @note Phase-3现代化实现：TypeScript + React 18 + Tailwind CSS
 * @example
 * import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
 *
 * <Tabs value="tab1" onValueChange={setValue}>
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 *   <TabsContent value="tab2">Content 2</TabsContent>
 * </Tabs>
 */

import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

// TypeScript接口定义
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

// Context
const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component');
  }
  return context;
};

/**
 * Tabs根组件 - 提供标签页状态管理
 */
const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, children, className, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn('w-full', className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

/**
 * TabsList - 标签页导航列表容器
 */
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          'inline-flex h-10 items-center justify-center',
          'rounded-md bg-gray-100 p-1 text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1890FF] focus-visible:ring-offset-2',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

/**
 * TabsTrigger - 单个标签页触发器
 */
const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, className, disabled = false, ...props }, ref) => {
    const { value: currentValue, onValueChange } = useTabsContext();
    const isActive = currentValue === value;

    const handleClick = () => {
      if (!disabled) {
        onValueChange(value);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${value}`}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap',
          'rounded-sm px-3 py-1.5 text-sm font-medium',
          'ring-offset-white transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1890FF] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          // 活动状态
          isActive
            ? 'bg-white text-gray-950 shadow-sm'
            : 'hover:bg-gray-200 hover:text-gray-900',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    );
  }
);

/**
 * TabsContent - 标签页内容容器
 */
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className, ...props }, ref) => {
    const { value: currentValue } = useTabsContext();
    const isActive = currentValue === value;

    if (!isActive) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value}`}
        aria-labelledby={`tab-${value}`}
        className={cn(
          'mt-2 ring-offset-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1890FF] focus-visible:ring-offset-2',
          className
        )}
        tabIndex={0}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// 设置显示名称
Tabs.displayName = 'Tabs';
TabsList.displayName = 'TabsList';
TabsTrigger.displayName = 'TabsTrigger';
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
