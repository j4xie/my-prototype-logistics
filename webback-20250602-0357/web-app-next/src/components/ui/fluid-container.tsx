/**
 * @module FluidContainer
 * @description 食品溯源系统 - 响应式流式布局容器组件 (TypeScript现代化版本)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/**
 * 流式容器组件属性
 */
export interface FluidContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否占满屏幕高度 */
  fullHeight?: boolean;
  /** 是否添加顶部内边距(为固定导航栏留出空间) */
  topPadding?: boolean;
  /** 是否添加底部内边距(为固定底部标签栏留出空间) */
  bottomPadding?: boolean;
  /** 容器最大宽度，默认为390px */
  maxWidth?: string;
}

// ==================== 组件实现 ====================

/**
 * 响应式流式布局容器组件
 *
 * 提供响应式流式布局容器，支持最大宽度约束，自动居中，边距控制等功能
 * 符合设计规范中定义的Neo Minimal iOS-Style Admin UI布局要求
 */
const FluidContainer = forwardRef<HTMLDivElement, FluidContainerProps>(
  (
    {
      children,
      fullHeight = true,
      topPadding = true,
      bottomPadding = true,
      maxWidth = '390px',
      className,
      ...props
    },
    ref
  ) => {
    // 构建样式类 - 遵循Neo Minimal iOS-Style Admin UI设计规范
    const containerClasses = cn(
      'mx-auto', // 水平居中
      'max-w-[390px]', // 最大宽度限制 - UI设计系统规范
      fullHeight && 'min-h-screen', // 最小高度为屏幕高度
      topPadding && 'pt-[80px]', // 顶部填充(为固定导航留空间)
      bottomPadding && 'pb-[80px]', // 底部填充(为底部导航留空间)
      'responsive', // 响应式支持标识
      className
    );

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={{ maxWidth }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

FluidContainer.displayName = 'FluidContainer';

export default FluidContainer;
