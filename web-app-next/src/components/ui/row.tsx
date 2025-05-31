/**
 * @module Row
 * @description 食品溯源系统 - 响应式行布局组件 (TypeScript现代化版本)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/**
 * 水平对齐方式
 */
export type JustifyContent =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

/**
 * 垂直对齐方式
 */
export type AlignItems = 'start' | 'center' | 'end' | 'stretch';

/**
 * 间距大小
 */
export type Spacing =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '8'
  | '10'
  | '12';

/**
 * 行组件属性
 */
export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 水平对齐方式 */
  justify?: JustifyContent;
  /** 垂直对齐方式 */
  align?: AlignItems;
  /** 子元素间距 */
  spacing?: Spacing;
  /** 是否允许换行 */
  wrap?: boolean;
  /** 是否反向排列 */
  reverse?: boolean;
}

// ==================== 组件实现 ====================

/**
 * 响应式行组件
 *
 * 提供响应式行布局组件，支持不同的对齐方式、间距控制和换行行为
 * 基于Flexbox实现灵活的一维布局
 */
const Row = forwardRef<HTMLDivElement, RowProps>(
  (
    {
      children,
      justify = 'start',
      align = 'center',
      spacing = '4',
      wrap = true,
      reverse = false,
      className,
      ...props
    },
    ref
  ) => {
    // 映射对齐方式到Tailwind类名
    const justifyMapping: Record<JustifyContent, string> = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    };

    const alignMapping: Record<AlignItems, string> = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };

    // 构建样式类
    const rowClasses = cn(
      'flex', // 使用Flexbox
      justifyMapping[justify],
      alignMapping[align],
      `gap-${spacing}`, // 元素间距
      wrap ? 'flex-wrap' : 'flex-nowrap',
      reverse ? 'flex-row-reverse' : 'flex-row',
      className
    );

    return (
      <div ref={ref} className={rowClasses} {...props}>
        {children}
      </div>
    );
  }
);

Row.displayName = 'Row';

export default Row;
