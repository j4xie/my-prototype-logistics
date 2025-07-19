/**
 * @module Column
 * @description 食品溯源系统 - 响应式列布局组件 (TypeScript现代化版本)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/**
 * 列宽度类型
 */
export type ColumnWidth =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 'auto'
  | 'full';

/**
 * Flex增长/收缩值
 */
export type FlexValue = '0' | '1';

/**
 * 列组件属性
 */
export interface ColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 列宽度(1-12或'auto'或'full') */
  width?: ColumnWidth;
  /** 小屏幕宽度(对应sm:640px+) */
  sm?: ColumnWidth;
  /** 中等屏幕宽度(对应md:768px+) */
  md?: ColumnWidth;
  /** 大屏幕宽度(对应lg:1024px+) */
  lg?: ColumnWidth;
  /** 特大屏幕宽度(对应xl:1280px+) */
  xl?: ColumnWidth;
  /** 是否允许增长 */
  grow?: FlexValue;
  /** 是否允许收缩 */
  shrink?: FlexValue;
}

// ==================== 组件实现 ====================

/**
 * 响应式列组件
 *
 * 提供响应式列布局组件，支持不同的宽度配置和响应式行为
 * 与Row组件配合使用，构建灵活的网格布局系统
 */
const Column = forwardRef<HTMLDivElement, ColumnProps>(
  (
    {
      children,
      width = 'auto',
      sm,
      md,
      lg,
      xl,
      grow = '1',
      shrink = '1',
      className,
      ...props
    },
    ref
  ) => {
    // 将数字或特殊字符串转换为适当的Tailwind类
    const getWidthClass = (
      value: ColumnWidth | undefined,
      prefix = ''
    ): string => {
      if (value === undefined) return '';

      // 处理特殊值
      if (value === 'auto') return `${prefix}w-auto`;
      if (value === 'full') return `${prefix}w-full`;

      // 处理数字(1-12)
      if (typeof value === 'number') {
        if (value >= 1 && value <= 12) {
          // 使用Tailwind的分数宽度类
          const fractionMap: Record<number, string> = {
            1: 'w-1/12',
            2: 'w-2/12',
            3: 'w-3/12',
            4: 'w-4/12',
            5: 'w-5/12',
            6: 'w-6/12',
            7: 'w-7/12',
            8: 'w-8/12',
            9: 'w-9/12',
            10: 'w-10/12',
            11: 'w-11/12',
            12: 'w-full',
          };
          return `${prefix}${fractionMap[value]}`;
        }
      }

      return '';
    };

    // 构建基础和响应式类名
    const columnClasses = cn(
      `flex-${grow}`, // flex-grow
      `shrink-${shrink}`, // flex-shrink
      getWidthClass(width), // 基础宽度
      getWidthClass(sm, 'sm:'), // 小屏宽度
      getWidthClass(md, 'md:'), // 中屏宽度
      getWidthClass(lg, 'lg:'), // 大屏宽度
      getWidthClass(xl, 'xl:'), // 特大屏宽度
      className
    );

    return (
      <div ref={ref} className={columnClasses} {...props}>
        {children}
      </div>
    );
  }
);

Column.displayName = 'Column';

export default Column;
