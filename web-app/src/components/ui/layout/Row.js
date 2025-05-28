/**
 * @deprecated 此组件已废弃，请使用 Row 组件: 
 * import { Row } from '@/components/ui';
 * 请查看迁移指南文档 refactor/phase-3/docs/MIGRATION-GUIDE.md 获取更多信息
 * 
 * Row 组件
 * 
 * 提供响应式行布局组件，支持不同的对齐方式、间距控制和换行行为
 * 基于Flexbox实现灵活的一维布局
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 响应式行组件
 * 
 * @param {Object} props 组件属性
 * @param {React.ReactNode} props.children 子元素
 * @param {string} props.justify 水平对齐方式 (start, center, end, between, around, evenly)
 * @param {string} props.align 垂直对齐方式 (start, center, end, stretch)
 * @param {string} props.spacing 子元素间距 (0, 1, 2, 3, 4, 5, 6, 8, 10, 12)
 * @param {boolean} props.wrap 是否允许换行
 * @param {boolean} props.reverse 是否反向排列
 * @param {string} props.className 额外的CSS类名
 * @returns {React.ReactElement} 响应式行组件
 */
const Row = ({
  children,
  justify = 'start',
  align = 'center',
  spacing = '4',
  wrap = true,
  reverse = false,
  className = '',
}) => {
  // 映射对齐方式到Tailwind类名
  const justifyMapping = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  const alignMapping = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  // 构建样式类
  const rowClasses = [
    'flex', // 使用Flexbox
    justifyMapping[justify] || 'justify-start',
    alignMapping[align] || 'items-center',
    `gap-${spacing}`, // 元素间距
    wrap ? 'flex-wrap' : 'flex-nowrap',
    reverse ? 'flex-row-reverse' : 'flex-row',
    className, // 用户提供的额外类名
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClasses}>
      {children}
    </div>
  );
};

Row.propTypes = {
  children: PropTypes.node,
  justify: PropTypes.oneOf(['start', 'center', 'end', 'between', 'around', 'evenly']),
  align: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  spacing: PropTypes.string,
  wrap: PropTypes.bool,
  reverse: PropTypes.bool,
  className: PropTypes.string,
};

export default Row; 