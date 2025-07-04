/**
 * 通用工具函数
 */

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as Record<string, any>;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned as T;
  }

  return obj;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(null, args);
    };

    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(null, args);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 异步延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  backoff: boolean = true
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }

      const waitTime = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      await delay(waitTime);
    }
  }

  throw lastError!;
}

/**
 * 生成唯一ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T>(
  jsonString: string,
  defaultValue: T
): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}

/**
 * 安全的JSON字符串化
 */
export function safeJsonStringify(
  obj: any,
  space?: number
): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return '{}';
  }
}

/**
 * 检查是否为空值
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 数组去重
 */
export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter(item => {
    const val = item[key];
    if (seen.has(val)) {
      return false;
    }
    seen.add(val);
    return true;
  });
}

/**
 * 数组分组
 */
export function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * 数组分页
 */
export function paginate<T>(
  array: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalItems = array.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const items = array.slice(startIndex, endIndex);

  return {
    items,
    totalPages,
    totalItems,
    currentPage: page,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * 对象属性选择
 */
export function pick<T, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * 对象属性排除
 */
export function omit<T, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

/**
 * 平台检测
 */
export const Platform = {
  /**
   * 是否为Web环境
   */
  isWeb: typeof window !== 'undefined' && typeof document !== 'undefined',

  /**
   * 是否为React Native环境
   */
  isReactNative: typeof navigator !== 'undefined' && 
    navigator.product === 'ReactNative',

  /**
   * 是否为移动设备
   */
  isMobile: (() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
      .test(navigator.userAgent);
  })(),

  /**
   * 获取平台类型
   */
  get type(): 'web' | 'react-native' | 'unknown' {
    if (Platform.isWeb) return 'web';
    if (Platform.isReactNative) return 'react-native';
    return 'unknown';
  }
};

/**
 * URL参数处理
 */
export const URLParams = {
  /**
   * 解析URL参数
   */
  parse(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const urlObj = new URL(url);
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  },

  /**
   * 构建URL参数字符串
   */
  stringify(params: Record<string, string | number | boolean>): string {
    const urlParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      urlParams.append(key, String(value));
    });
    
    return urlParams.toString();
  }
};

/**
 * 颜色工具
 */
export const ColorUtils = {
  /**
   * 十六进制转RGB
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * RGB转十六进制
   */
  rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  /**
   * 生成随机颜色
   */
  random(): string {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }
};