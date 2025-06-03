'use client';

import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';

// TypeScript接口定义
export interface TouchGestureProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onTouchStart' | 'onTouchMove' | 'onTouchEnd'
  > {
  children: React.ReactNode;
  onSwipeLeft?: (e: TouchEvent) => void;
  onSwipeRight?: (e: TouchEvent) => void;
  onSwipeUp?: (e: TouchEvent) => void;
  onSwipeDown?: (e: TouchEvent) => void;
  onTap?: (e: TouchEvent) => void;
  onDoubleTap?: (e: TouchEvent) => void;
  onLongPress?: (e: TouchEvent) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  className?: string;
  disabled?: boolean;
}

export interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export interface DraggableListItemProps {
  children: React.ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

// 检测是否为触摸设备的工具函数
const isTouchDevice = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is not in TypeScript definitions but exists in some browsers
      navigator.msMaxTouchPoints > 0)
  );
};

/**
 * 触摸手势支持组件
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 * 支持滑动、点击、双击、长按等手势识别
 */
export const TouchGesture = forwardRef<HTMLDivElement, TouchGestureProps>(
  (
    {
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
      disabled = false,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<TouchPoint | null>(null);
    const touchEndRef = useRef<TouchPoint | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapRef = useRef<number>(0);
    const [isPressed, setIsPressed] = useState(false);

    // 使用传入的ref或内部ref
    const elementRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

    useEffect(() => {
      const element = elementRef.current;
      if (!element || disabled || !isTouchDevice()) {
        return;
      }

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
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

      const handleTouchMove = () => {
        // 如果有移动，取消长按
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
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
          time: Date.now(),
        };

        const deltaX = touchEndRef.current.x - touchStartRef.current.x;
        const deltaY = touchEndRef.current.y - touchStartRef.current.y;
        const deltaTime = touchEndRef.current.time - touchStartRef.current.time;

        // 检测滑动手势
        if (
          Math.abs(deltaX) > swipeThreshold ||
          Math.abs(deltaY) > swipeThreshold
        ) {
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
      element.addEventListener('touchstart', handleTouchStart, {
        passive: false,
      });
      element.addEventListener('touchmove', handleTouchMove, {
        passive: false,
      });
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
      element.addEventListener('touchcancel', handleTouchCancel, {
        passive: false,
      });

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
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onTap,
      onDoubleTap,
      onLongPress,
      swipeThreshold,
      longPressDelay,
      disabled,
      elementRef,
    ]);

    const containerClasses = cn(
      'touch-gesture-container select-none',
      isPressed && 'touch-pressed',
      className
    );

    return (
      <div
        ref={elementRef}
        className={containerClasses}
        style={{
          touchAction: disabled ? 'auto' : 'manipulation', // 优化触摸响应
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TouchGesture.displayName = 'TouchGesture';

/**
 * 滑动卡片组件
 * 支持左右滑动操作
 */
export const SwipeCard: React.FC<SwipeCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = '',
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
    <div className={cn('relative overflow-hidden', className)}>
      {/* 左侧操作区域 */}
      {leftAction && (
        <div className="absolute top-0 left-0 z-0 flex h-full w-20 items-center justify-center bg-red-500 text-white">
          {leftAction}
        </div>
      )}

      {/* 右侧操作区域 */}
      {rightAction && (
        <div className="absolute top-0 right-0 z-0 flex h-full w-20 items-center justify-center bg-green-500 text-white">
          {rightAction}
        </div>
      )}

      {/* 主内容 */}
      <TouchGesture
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
      >
        <div
          className={cn(
            'relative z-10 transform transition-transform',
            isAnimating ? 'duration-200' : 'duration-0'
          )}
          style={{
            transform: `translateX(${swipeOffset}%)`,
          }}
        >
          {children}
        </div>
      </TouchGesture>
    </div>
  );
};

SwipeCard.displayName = 'SwipeCard';

/**
 * 可拖拽排序列表项
 */
export const DraggableListItem: React.FC<DraggableListItemProps> = ({
  children,
  onDragStart,
  onDragEnd,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleLongPress = () => {
    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    onDragEnd?.();
  };

  return (
    <TouchGesture
      onLongPress={handleLongPress}
      className={cn(
        'transition-all duration-200',
        isDragging && 'scale-105 opacity-75',
        className
      )}
    >
      <div
        className={cn(
          'transition-all duration-200',
          isDragging && 'z-10 shadow-lg'
        )}
        style={{
          transform: isDragging
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
            : 'none',
        }}
        onTransitionEnd={isDragging ? undefined : handleDragEnd}
      >
        {children}
      </div>
    </TouchGesture>
  );
};

DraggableListItem.displayName = 'DraggableListItem';

export default TouchGesture;
