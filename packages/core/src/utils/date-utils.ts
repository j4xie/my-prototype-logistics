/**
 * 日期时间工具函数
 */

/**
 * 日期格式化选项
 */
export interface DateFormatOptions {
  locale?: string;
  timezone?: string;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  hour12?: boolean;
}

/**
 * 日期工具类
 */
export class DateUtils {
  /**
   * 格式化日期
   */
  static format(
    date: Date | string | number,
    pattern: string = 'YYYY-MM-DD HH:mm:ss',
    options?: DateFormatOptions
  ): string {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }

    // 如果有locale选项，使用Intl.DateTimeFormat
    if (options?.locale) {
      return new Intl.DateTimeFormat(options.locale, options).format(d);
    }

    // 简单模式匹配
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 相对时间格式化（如：2小时前）
   */
  static formatRelative(
    date: Date | string | number,
    locale: string = 'zh-CN'
  ): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (locale === 'zh-CN') {
      if (diffSec < 60) return '刚刚';
      if (diffMin < 60) return `${diffMin}分钟前`;
      if (diffHour < 24) return `${diffHour}小时前`;
      if (diffDay < 7) return `${diffDay}天前`;
      if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
      if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
      return `${Math.floor(diffDay / 365)}年前`;
    } else {
      if (diffSec < 60) return 'just now';
      if (diffMin < 60) return `${diffMin} minutes ago`;
      if (diffHour < 24) return `${diffHour} hours ago`;
      if (diffDay < 7) return `${diffDay} days ago`;
      if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
      if (diffDay < 365) return `${Math.floor(diffDay / 30)} months ago`;
      return `${Math.floor(diffDay / 365)} years ago`;
    }
  }

  /**
   * 检查是否为今天
   */
  static isToday(date: Date | string | number): boolean {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  /**
   * 检查是否为昨天
   */
  static isYesterday(date: Date | string | number): boolean {
    const d = new Date(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
  }

  /**
   * 检查是否为本周
   */
  static isThisWeek(date: Date | string | number): boolean {
    const d = new Date(date);
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    
    return d >= startOfWeek && d <= endOfWeek;
  }

  /**
   * 获取两个日期间的差值
   */
  static diff(
    date1: Date | string | number,
    date2: Date | string | number,
    unit: 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds' = 'days'
  ): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d2.getTime() - d1.getTime());

    switch (unit) {
      case 'years':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
      case 'months':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
      case 'days':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'hours':
        return Math.floor(diffMs / (1000 * 60 * 60));
      case 'minutes':
        return Math.floor(diffMs / (1000 * 60));
      case 'seconds':
        return Math.floor(diffMs / 1000);
      case 'milliseconds':
        return diffMs;
      default:
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  /**
   * 日期加减运算
   */
  static add(
    date: Date | string | number,
    amount: number,
    unit: 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds'
  ): Date {
    const d = new Date(date);

    switch (unit) {
      case 'years':
        d.setFullYear(d.getFullYear() + amount);
        break;
      case 'months':
        d.setMonth(d.getMonth() + amount);
        break;
      case 'days':
        d.setDate(d.getDate() + amount);
        break;
      case 'hours':
        d.setHours(d.getHours() + amount);
        break;
      case 'minutes':
        d.setMinutes(d.getMinutes() + amount);
        break;
      case 'seconds':
        d.setSeconds(d.getSeconds() + amount);
        break;
    }

    return d;
  }

  /**
   * 获取日期范围的开始和结束
   */
  static getDateRange(
    range: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear',
    timezone?: string
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;

      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        break;

      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        start = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
        end = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999);
        break;

      case 'lastWeek':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        start = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate());
        end = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate() + 6, 23, 59, 59, 999);
        break;

      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;

      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = lastMonth;
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;

      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    return { start, end };
  }

  /**
   * 解析ISO字符串
   */
  static parseISO(dateString: string): Date | null {
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * 转换为ISO字符串
   */
  static toISO(date: Date | string | number): string {
    return new Date(date).toISOString();
  }

  /**
   * 获取时区偏移量
   */
  static getTimezoneOffset(timezone?: string): number {
    if (!timezone) {
      return new Date().getTimezoneOffset();
    }

    try {
      const date = new Date();
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
      const targetTime = new Date(utc + (this.getTimezoneOffsetByName(timezone) * 60000));
      return (targetTime.getTime() - date.getTime()) / 60000;
    } catch {
      return new Date().getTimezoneOffset();
    }
  }

  /**
   * 根据时区名称获取偏移量
   */
  private static getTimezoneOffsetByName(timezone: string): number {
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'Asia/Shanghai': 8 * 60,
      'Asia/Tokyo': 9 * 60,
      'America/New_York': -5 * 60,
      'America/Los_Angeles': -8 * 60,
      'Europe/London': 0,
      'Europe/Paris': 1 * 60,
    };

    return timezoneOffsets[timezone] || 0;
  }

  /**
   * 检查日期是否有效
   */
  static isValid(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 获取月份天数
   */
  static getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /**
   * 检查是否为闰年
   */
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * 获取季度
   */
  static getQuarter(date: Date | string | number): number {
    const d = new Date(date);
    return Math.floor((d.getMonth() + 3) / 3);
  }

  /**
   * 获取周数
   */
  static getWeekNumber(date: Date | string | number): number {
    const d = new Date(date);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
    return weekNumber;
  }
}

/**
 * 时间段枚举
 */
export enum TimeRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'thisWeek',
  LAST_WEEK = 'lastWeek',
  THIS_MONTH = 'thisMonth',
  LAST_MONTH = 'lastMonth',
  THIS_QUARTER = 'thisQuarter',
  LAST_QUARTER = 'lastQuarter',
  THIS_YEAR = 'thisYear',
  LAST_YEAR = 'lastYear',
  CUSTOM = 'custom'
}

/**
 * 导出便捷函数
 */
export const formatDate = DateUtils.format;
export const formatRelativeTime = DateUtils.formatRelative;
export const isToday = DateUtils.isToday;
export const isYesterday = DateUtils.isYesterday;
export const dateDiff = DateUtils.diff;
export const addToDate = DateUtils.add;
export const getDateRange = DateUtils.getDateRange;
export const parseISO = DateUtils.parseISO;
export const toISO = DateUtils.toISO;

// 默认导出
export default DateUtils;