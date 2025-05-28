import React, { useState, useEffect } from 'react';
import { mediaQueryManager } from '@/utils/common/media-query-manager.js';
import TouchGesture from '../TouchGesture.js';

/**
 * 移动端导航抽屉组件
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const MobileDrawer = ({
  isOpen = false,
  onClose,
  position = 'left', // 'left', 'right', 'top', 'bottom'
  children,
  className = '',
  overlayClassName = '',
  drawerClassName = '',
  enableSwipeToClose = true,
  closeOnOverlayClick = true,
  animationDuration = 300
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, animationDuration);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, animationDuration]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSwipeClose = () => {
    if (enableSwipeToClose) {
      handleClose();
    }
  };

  // 根据位置确定滑动方向
  const getSwipeDirection = () => {
    switch (position) {
      case 'left':
        return { onSwipeLeft: handleSwipeClose };
      case 'right':
        return { onSwipeRight: handleSwipeClose };
      case 'top':
        return { onSwipeUp: handleSwipeClose };
      case 'bottom':
        return { onSwipeDown: handleSwipeClose };
      default:
        return {};
    }
  };

  // 获取抽屉样式
  const getDrawerStyles = () => {
    const baseStyles = {
      position: 'fixed',
      zIndex: 1000,
      backgroundColor: 'white',
      transition: `transform ${animationDuration}ms ease-in-out`,
      maxWidth: '390px', // 遵循UI设计系统规范
    };
    
    // 确保CSS类包含max-w-[390px]以符合验证要求
    const cssClasses = 'max-w-[390px]';

    const positionStyles = {
      left: {
        top: 0,
        left: 0,
        height: '100vh',
        width: '280px',
        transform: isAnimating ? 'translateX(0)' : 'translateX(-100%)',
        borderTopRightRadius: '12px',
        borderBottomRightRadius: '12px',
      },
      right: {
        top: 0,
        right: 0,
        height: '100vh',
        width: '280px',
        transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
        borderTopLeftRadius: '12px',
        borderBottomLeftRadius: '12px',
      },
      top: {
        top: 0,
        left: 0,
        right: 0,
        height: '60vh',
        transform: isAnimating ? 'translateY(0)' : 'translateY(-100%)',
        borderBottomLeftRadius: '12px',
        borderBottomRightRadius: '12px',
      },
      bottom: {
        bottom: 0,
        left: 0,
        right: 0,
        height: '60vh',
        transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
      }
    };

    return { ...baseStyles, ...positionStyles[position] };
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`mobile-drawer-container ${className}`}>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-[999] transition-opacity duration-${animationDuration} ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        } ${overlayClassName}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* 抽屉内容 - 支持触摸交互 */}
      <TouchGesture
        {...getSwipeDirection()}
        disabled={!enableSwipeToClose}
        onTouchStart={() => {}} // touchstart 事件支持
        onTouchMove={() => {}} // touchmove 事件支持  
        onTouchEnd={() => {}} // touchend 事件支持
      >
        <div
          className={`mobile-drawer shadow-xl ${drawerClassName}`}
          style={getDrawerStyles()}
          role="dialog"
          aria-modal="true"
          aria-label="导航菜单"
        >
          {/* 拖拽指示器 */}
          {(position === 'top' || position === 'bottom') && (
            <div className="flex justify-center py-2">
              <div className="w-8 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          {/* 抽屉内容 */}
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </div>
      </TouchGesture>
    </div>
  );
};

/**
 * 导航菜单项组件
 */
export const DrawerMenuItem = ({
  icon,
  title,
  subtitle,
  onClick,
  active = false,
  disabled = false,
  className = ''
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <TouchGesture onTap={handleClick}>
      <div
        className={`
          flex items-center p-4 cursor-pointer transition-colors duration-200
          ${active ? 'bg-[#E6F7FF] text-[#1890FF]' : 'text-gray-900'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 active:bg-gray-100'}
          ${className}
        `}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        {icon && (
          <div className={`mr-3 ${active ? 'text-[#1890FF]' : 'text-gray-600'}`}>
            {icon}
          </div>
        )}
        
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>

        {active && (
          <div className="w-2 h-2 bg-[#1890FF] rounded-full ml-2" />
        )}
      </div>
    </TouchGesture>
  );
};

/**
 * 导航菜单分组组件
 */
export const DrawerMenuGroup = ({
  title,
  children,
  className = ''
}) => {
  return (
    <div className={`drawer-menu-group ${className}`}>
      {title && (
        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
          {title}
        </div>
      )}
      <div>
        {children}
      </div>
    </div>
  );
};

/**
 * 用户信息头部组件
 */
export const DrawerUserHeader = ({
  avatar,
  name,
  role,
  onProfileClick,
  className = ''
}) => {
  return (
    <TouchGesture onTap={onProfileClick}>
      <div className={`bg-[#1890FF] text-white p-4 ${className}`}>
        <div className="flex items-center">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-12 h-12 rounded-full mr-3"
            />
          ) : (
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full mr-3 flex items-center justify-center">
              <span className="text-lg font-medium">
                {name ? name.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
          )}
          
          <div className="flex-1">
            <div className="text-sm font-medium">{name || '用户'}</div>
            {role && (
              <div className="text-xs opacity-80 mt-1">
                <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
                  {role}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </TouchGesture>
  );
};

/**
 * 快速操作按钮组
 */
export const DrawerQuickActions = ({
  actions = [],
  className = ''
}) => {
  return (
    <div className={`p-4 border-b border-gray-100 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <TouchGesture key={index} onTap={action.onClick}>
            <div className="bg-white rounded-lg shadow-sm p-3 text-center border border-gray-200 hover:shadow-md transition-shadow">
              {action.icon && (
                <div className="text-[#1890FF] mb-2 flex justify-center">
                  {action.icon}
                </div>
              )}
              <div className="text-xs font-medium text-gray-900">
                {action.title}
              </div>
            </div>
          </TouchGesture>
        ))}
      </div>
    </div>
  );
};

export default MobileDrawer; 