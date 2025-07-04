// 日期处理工具函数
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 格式化日期
export const formatDate = (date: Date | string, pattern: string = 'yyyy-MM-dd') => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return format(dateObj, pattern, { locale: zhCN });
  } catch {
    return '';
  }
};

// 格式化日期时间
export const formatDateTime = (date: Date | string) => {
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
};

// 格式化相对时间
export const formatRelativeTime = (date: Date | string) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return formatDistanceToNow(dateObj, { 
      addSuffix: true, 
      locale: zhCN 
    });
  } catch {
    return '';
  }
};

// 格式化时间
export const formatTime = (date: Date | string) => {
  return formatDate(date, 'HH:mm:ss');
};

// 获取当前时间戳
export const getCurrentTimestamp = () => {
  return Date.now();
};

// 检查日期是否过期
export const isExpired = (date: Date | string) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return dateObj < new Date();
  } catch {
    return false;
  }
};

// 获取日期范围
export const getDateRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
};

// 解析ISO日期字符串
export const parseDate = (dateString: string): Date | null => {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
};

// 日期常量
export const DATE_FORMATS = {
  DATE: 'yyyy-MM-dd',
  TIME: 'HH:mm:ss',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
  DATETIME_SHORT: 'MM-dd HH:mm',
  DATE_CN: 'yyyy年MM月dd日',
  DATETIME_CN: 'yyyy年MM月dd日 HH:mm:ss'
} as const;