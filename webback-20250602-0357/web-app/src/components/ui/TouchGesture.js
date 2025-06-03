import React, { useRef, useEffect, useState } from 'react';
import { mediaQueryManager } from '@/utils/common/media-query-manager.js';

/**
 * @deprecated 此组件已废弃，请使用 web-app-next/src/components/ui/touch-gesture.tsx
 * 
 * 迁移指导：
 * - 新版本使用TypeScript，提供完整类型安全
 * - 改进了触摸设备检测逻辑，移除mediaQueryManager依赖
 * - 优化了事件处理和内存管理
 * - 增强了可访问性支持和现代React模式
 * - 支持forwardRef和完整的HTML属性扩展
 * 
 * 导入方式：
 * import { TouchGesture, SwipeCard, DraggableListItem } from '@/components/ui';
 * 
 * 触摸手势支持组件
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const TouchGesture = ({ 
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onDoubleTap,
  onLongPress,
  swipeThreshold = 50,
  longPressDelay = 500,
  className = '',
  disabled = false
}) => {
  const elementRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const lastTapRef = useRef(0);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || disabled || !mediaQueryManager.isTouchDevice()) {
      return;
    }

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      
      setIsPressed(true);

      // 长按检测
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          onLongPress(e);
          setIsPressed(false);
        }, longPressDelay);
      }
    };

    const handleTouchMove = (e) => {
      // 如果有移动，取消长按
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleTouchEnd = (e) => {
      setIsPressed(false);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      const deltaX = touchEndRef.current.x - touchStartRef.current.x;
      const deltaY = touchEndRef.current.y - touchStartRef.current.y;
      const deltaTime = touchEndRef.current.time - touchStartRef.current.time;

      // 检测滑动手势
      if (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // 水平滑动
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight(e);
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft(e);
          }
        } else {
          // 垂直滑动
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown(e);
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp(e);
          }
        }
      } else if (deltaTime < 300) {
        // 检测点击和双击
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;
        
        if (timeSinceLastTap < 300 && onDoubleTap) {
          onDoubleTap(e);
          lastTapRef.current = 0; // 重置以避免三击
        } else {
          lastTapRef.current = now;
          setTimeout(() => {
            if (lastTapRef.current === now && onTap) {
              onTap(e);
            }
          }, 300);
        }
      }

      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    const handleTouchCancel = () => {
      setIsPressed(false);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    // 添加事件监听器
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [
    onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown,
    onTap, onDoubleTap, onLongPress,
    swipeThreshold, longPressDelay, disabled
  ]);

  const containerClasses = [
    'touch-gesture-container',
    'select-none', // 防止文本选择
    isPressed ? 'touch-pressed' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={elementRef}
      className={containerClasses}
      style={{
        touchAction: disabled ? 'auto' : 'manipulation', // 优化触摸响应
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {children}
    </div>
  );
};

/**
 * 滑动卡片组件
 * 支持左右滑动操作
 */
export const SwipeCard = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  leftAction, 
  rightAction,
  className = '' 
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSwipeLeft = () => {
    if (onSwipeLeft) {
      setIsAnimating(true);
      setSwipeOffset(-100);
      setTimeout(() => {
        onSwipeLeft();
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleSwipeRight = () => {
    if (onSwipeRight) {
      setIsAnimating(true);
      setSwipeOffset(100);
      setTimeout(() => {
        onSwipeRight();
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 左侧操作区域 */}
      {leftAction && (
        <div className="absolute left-0 top-0 h-full w-20 bg-red-500 flex items-center justify-center text-white">
          {leftAction}
        </div>
      )}
      
      {/* 右侧操作区域 */}
      {rightAction && (
        <div className="absolute right-0 top-0 h-full w-20 bg-green-500 flex items-center justify-center text-white">
          {rightAction}
        </div>
      )}
      
      {/* 主内容 */}
      <TouchGesture
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
      >
        <div
          className={`transform transition-transform ${isAnimating ? 'duration-200' : 'duration-0'}`}
          style={{
            transform: `translateX(${swipeOffset}%)`
          }}
        >
          {children}
        </div>
      </TouchGesture>
    </div>
  );
};

/**
 * 可拖拽排序列表项
 */
export const DraggableListItem = ({ 
  children, 
  onDragStart, 
  onDragEnd, 
  className = '' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleLongPress = () => {
    setIsDragging(true);
    if (onDragStart) onDragStart();
  };

  return (
    <TouchGesture
      onLongPress={handleLongPress}
      className={`${className} ${isDragging ? 'opacity-75 scale-105' : ''}`}
    >
      <div
        className={`transition-all duration-200 ${isDragging ? 'shadow-lg z-10' : ''}`}
        style={{
          transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : 'none'
        }}
      >
        {children}
      </div>
    </TouchGesture>
  );
};

export default TouchGesture; 