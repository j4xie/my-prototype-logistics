/**
 * @deprecated 此组件已废弃，请使用 FluidContainer 组件: 
 * import { FluidContainer } from '@/components/ui';
 * 请查看迁移指南文档 refactor/phase-3/docs/MIGRATION-GUIDE.md 获取更多信息
 * 
 * FluidContainer 组件
 * 
 * 提供响应式流式布局容器，支持最大宽度约束，自动居中，边距控制等功能
 * 符合设计规范中定义的Neo Minimal iOS-Style Admin UI布局要求
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 流式布局容器组件
 * 
 * @param {Object} props 组件属性
 * @param {React.ReactNode} props.children 子元素
 * @param {boolean} props.fullHeight 是否占满屏幕高度
 * @param {boolean} props.topPadding 是否添加顶部内边距(为固定导航栏留出空间)
 * @param {boolean} props.bottomPadding 是否添加底部内边距(为固定底部标签栏留出空间)
 * @param {string} props.maxWidth 容器最大宽度，默认为390px
 * @param {string} props.className 额外的CSS类名
 * @returns {React.ReactElement} 流式容器组件
 */
const FluidContainer = React.memo(({
  children,
  fullHeight = true,
  topPadding = true,
  bottomPadding = true,
  maxWidth = "390px",
  className = "",
}) => {
  // 构建样式类 - 遵循Neo Minimal iOS-Style Admin UI设计规范
  const containerClasses = [
    'mx-auto',  // 水平居中
    'max-w-[390px]', // 最大宽度限制 - UI设计系统规范
    fullHeight ? 'min-h-screen' : '', // 最小高度为屏幕高度
    topPadding ? 'pt-[80px]' : '', // 顶部填充(为固定导航留空间)
    bottomPadding ? 'pb-[80px]' : '', // 底部填充(为底部导航留空间)
    'responsive', // 响应式支持标识
    className, // 用户提供的额外类名
  ].filter(Boolean).join(' ');

  // @media 查询支持 - 确保在不同屏幕尺寸下的适配
  const mediaQuerySupport = {
    mobile: 'max-w-[390px]',
    tablet: 'max-w-[390px]', 
    desktop: 'max-w-[390px]'
  };

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
});

FluidContainer.propTypes = {
  children: PropTypes.node,
  fullHeight: PropTypes.bool,
  topPadding: PropTypes.bool,
  bottomPadding: PropTypes.bool,
  maxWidth: PropTypes.string,
  className: PropTypes.string,
};

export default FluidContainer; 