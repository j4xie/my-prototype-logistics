/**
 * @deprecated 此组件已废弃，请使用 Column 组件: 
 * import { Column } from '@/components/ui';
 * 请查看迁移指南文档 refactor/phase-3/docs/MIGRATION-GUIDE.md 获取更多信息
 * 
 * Column 组件
 * 
 * 提供响应式列布局组件，支持不同的宽度配置和响应式行为
 * 与Row组件配合使用，构建灵活的网格布局系统
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 响应式列组件
 * 
 * @param {Object} props 组件属性
 * @param {React.ReactNode} props.children 子元素
 * @param {number|string} props.width 列宽度(1-12或'auto'或'full')
 * @param {number|string} props.sm 小屏幕宽度(对应sm:640px+)
 * @param {number|string} props.md 中等屏幕宽度(对应md:768px+)
 * @param {number|string} props.lg 大屏幕宽度(对应lg:1024px+)
 * @param {number|string} props.xl 特大屏幕宽度(对应xl:1280px+)
 * @param {string} props.grow 是否允许增长('0'或'1')
 * @param {string} props.shrink 是否允许收缩('0'或'1')
 * @param {string} props.className 额外的CSS类名
 * @returns {React.ReactElement} 响应式列组件
 */
const Column = ({
  children,
  width = 'auto',
  sm,
  md,
  lg,
  xl,
  grow = '1',
  shrink = '1',
  className = '',
}) => {
  // 将数字或特殊字符串转换为适当的Tailwind类
  const getWidthClass = (value, prefix = '') => {
    if (value === undefined) return '';
    
    // 处理特殊值
    if (value === 'auto') return `${prefix}w-auto`;
    if (value === 'full') return `${prefix}w-full`;
    
    // 处理数字(1-12)
    if (typeof value === 'number' || !isNaN(parseInt(value))) {
      const numValue = parseInt(value);
      if (numValue >= 1 && numValue <= 12) {
        return `${prefix}w-${Math.round(numValue / 12 * 100)}/100`;
      }
    }
    
    return '';
  };

  // 构建基础和响应式类名
  const columnClasses = [
    'flex-' + grow, // flex-grow
    'shrink-' + shrink, // flex-shrink
    getWidthClass(width), // 基础宽度
    getWidthClass(sm, 'sm:'), // 小屏宽度
    getWidthClass(md, 'md:'), // 中屏宽度
    getWidthClass(lg, 'lg:'), // 大屏宽度
    getWidthClass(xl, 'xl:'), // 特大屏宽度
    className, // 用户提供的额外类名
  ].filter(Boolean).join(' ');

  return (
    <div className={columnClasses}>
      {children}
    </div>
  );
};

Column.propTypes = {
  children: PropTypes.node,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sm: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  md: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  lg: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  xl: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  grow: PropTypes.string,
  shrink: PropTypes.string,
  className: PropTypes.string,
};

export default Column; 