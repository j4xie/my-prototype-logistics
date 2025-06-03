/**
 * @module Utils
 * @description 食品溯源系统 - 工具函数库 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并Tailwind CSS类名的工具函数
 * 支持条件类名和类名冲突解决
 *
 * @param inputs - 类名输入
 * @returns 合并后的类名字符串
 *
 * @example
 * cn('px-2 py-1', 'bg-blue-500', { 'text-white': true })
 * // => 'px-2 py-1 bg-blue-500 text-white'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化日期为本地化字符串
 * @param date - 日期对象或字符串
 * @param options - 格式化选项
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(dateObj);
}

/**
 * 延迟执行函数
 * @param ms - 延迟毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param func - 要防抖的函数
 * @param wait - 等待时间
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 * @param func - 要节流的函数
 * @param limit - 限制时间
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
