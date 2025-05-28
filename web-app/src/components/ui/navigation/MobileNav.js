/**
 * @module MobileNav
 * @description 食品溯源系统 - 移动端导航组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 * 
 * @deprecated 此组件已废弃，请使用新版本
 * @see {@link web-app-next/src/components/ui/mobile-nav.tsx} 新版本组件
 * 
 * 迁移指导：
 * 1. 导入路径更新：import { MobileNav, BottomTabBar } from '@/components/ui'
 * 2. TypeScript支持：完整的类型定义和智能提示
 * 3. API改进：
 *    - 新增disabled属性支持
 *    - 改进的键盘导航
 *    - 更好的可访问性支持
 *    - forwardRef支持
 * 4. 性能优化：useCallback优化事件处理
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * 移动端导航组件
 * 支持WCAG 2.1 AA级别可访问性标准
 */
const MobileNav = ({
  items = [],
  activeItem = '',
  onItemClick,
  className = '',
  ariaLabel = '主导航',
  ...props
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // 处理键盘导航
  const handleKeyDown = (event, index) => {
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
        if (onItemClick) {
          onItemClick(items[index]);
        }
        break;
    }
  };

  // 处理项目点击
  const handleItemClick = (item, index) => {
    setFocusedIndex(index);
    if (onItemClick) {
      onItemClick(item);
    }
  };

  // 获取导航项样式
  const getNavItemClasses = (item, index, isActive) => {
    const baseClasses = 'relative flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-2';
    
    const stateClasses = isActive 
      ? 'bg-[#1890FF] text-white' 
      : 'text-gray-600 hover:text-[#1890FF] hover:bg-[#f0f8ff]';
    
    const focusClasses = focusedIndex === index ? 'ring-2 ring-[#1890FF] ring-offset-2' : '';
    
    return [baseClasses, stateClasses, focusClasses].filter(Boolean).join(' ');
  };

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className={`bg-white border-t border-gray-200 ${className}`}
      {...props}
    >
      <div className="max-w-[390px] mx-auto">
        <ul
          role="menubar"
          className="flex justify-around items-center py-2"
          aria-orientation="horizontal"
        >
          {items.map((item, index) => {
            const isActive = activeItem === item.key || activeItem === item.id;
            
            return (
              <li key={item.key || item.id || index} role="none">
                <button
                  role="menuitem"
                  type="button"
                  className={getNavItemClasses(item, index, isActive)}
                  onClick={() => handleItemClick(item, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  aria-label={item.ariaLabel || item.label}
                  aria-current={isActive ? 'page' : undefined}
                  tabIndex={focusedIndex === index || (focusedIndex === -1 && index === 0) ? 0 : -1}
                >
                  <div className="flex flex-col items-center min-w-[48px] min-h-[48px] justify-center">
                    {/* 图标 */}
                    {item.icon && (
                      <div 
                        className="w-6 h-6 mb-1 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        {typeof item.icon === 'string' ? (
                          <img src={item.icon} alt="" className="w-full h-full" />
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
                        className="absolute -top-1 -right-1 bg-[#FF4D4F] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                        aria-label={`${item.badge} 个未读`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
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
};

MobileNav.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      id: PropTypes.string,
      label: PropTypes.string.isRequired,
      icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      ariaLabel: PropTypes.string
    })
  ),
  activeItem: PropTypes.string,
  onItemClick: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string
};

/**
 * 底部标签栏组件
 * @param {Object} props - 组件属性
 * @param {Array} props.tabs - 标签项列表
 * @param {string} props.activeTab - 当前活动标签
 * @param {Function} props.onTabChange - 标签切换处理函数
 * @returns {JSX.Element} 底部标签栏组件
 */
const BottomTabBar = ({
  tabs = [],
  activeTab = '',
  onTabChange
}) => {
  const handleTabClick = (tab) => {
    if (onTabChange && !tab.disabled) {
      onTabChange(tab.key);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[999]">
      <div className="max-w-[390px] mx-auto">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab)}
              className={`flex flex-col items-center py-2 px-3 min-w-0 flex-1 transition-colors ${
                activeTab === tab.key
                  ? 'text-[#1890FF]'
                  : tab.disabled
                  ? 'text-gray-400'
                  : 'text-gray-600 hover:text-[#1890FF]'
              }`}
              disabled={tab.disabled}
              aria-label={tab.label}
            >
              <div className="w-6 h-6 mb-1">
                {tab.icon}
              </div>
              <span className="text-xs truncate">
                {tab.label}
              </span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#1890FF] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// 导出组件
MobileNav.BottomTabBar = BottomTabBar;

export default MobileNav; 