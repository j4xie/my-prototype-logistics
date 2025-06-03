/**
 * @module StatCard
 * @description 食品溯源系统 - StatCard统计卡片组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 * 
 * @deprecated 此组件已废弃，请使用新版本
 * @see web-app-next/src/components/ui/stat-card.tsx (权威来源)
 * @migration 新版本支持趋势指示器、加载状态、数值格式化等增强功能
 * @example 
 * // ❌ 废弃用法 (Phase-2)
 * import StatCard from '@/components/ui/StatCard'
 * 
 * // ✅ 推荐用法 (Phase-3)
 * import { StatCard } from '@/components/ui/stat-card'
 */

import React from 'react';

/**
 * StatCard React组件
 * 统计数据卡片，用于展示关键指标
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 * @param {Object} props - 组件属性
 * @param {string} props.title - 指标名称
 * @param {string|number} props.value - 指标值
 * @param {string} props.icon - 图标名称
 * @param {string} props.color - 颜色主题 'primary'|'success'|'warning'|'error'|'purple'
 * @param {string} props.size - 卡片尺寸 'normal'|'small'|'large'
 * @param {Function} props.onClick - 点击回调
 * @param {string} props.className - 额外的CSS类名
 */
const StatCard = ({
  title = '指标名称',
  value = 0,
  icon = 'chart-line',
  color = 'primary',
  size = 'normal',
  onClick,
  className = ''
}) => {
  // 获取颜色主题类名
  const getColorClasses = () => {
    const colorMap = {
      primary: 'bg-icon-primary text-[#1890FF]',
      success: 'bg-icon-success text-[#52C41A]',
      warning: 'bg-icon-warning text-[#FF4D4F]',
      error: 'bg-icon-danger text-[#FF4D4F]',
      purple: 'bg-icon-purple text-[#722ED1]'
    };
    return colorMap[color] || colorMap.primary;
  };

  // 构建卡片样式类 - 遵循UI设计系统规范
  const cardClasses = [
    'bg-white rounded-lg shadow-sm p-4', // 基础卡片样式
    'grid-cols-2', // 网格布局支持
    onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.03] transition-all duration-200' : '',
    size === 'small' ? 'p-3' : size === 'large' ? 'p-6' : 'p-4',
    className
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className={cardClasses} onClick={handleClick}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-lg font-medium text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses()}`}>
          <i className={`fas fa-${icon} text-lg`}></i>
        </div>
      </div>
    </div>
  );
};

export default StatCard; 