/**
 * 数据验证工具
 */

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  phone?: boolean;
  url?: boolean;
  custom?: (value: any) => boolean | string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationSchema {
  [field: string]: ValidationRule | ValidationRule[];
}

/**
 * 验证器类
 */
export class Validator {
  /**
   * 验证单个值
   */
  static validateValue(value: any, rules: ValidationRule | ValidationRule[]): ValidationResult {
    const ruleArray = Array.isArray(rules) ? rules : [rules];
    const errors: string[] = [];

    for (const rule of ruleArray) {
      const error = this.checkRule(value, rule);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证对象
   */
  static validateObject(obj: Record<string, any>, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      const result = this.validateValue(value, rules);
      
      if (!result.isValid) {
        errors.push(...result.errors.map(error => `${field}: ${error}`));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 检查单个规则
   */
  private static checkRule(value: any, rule: ValidationRule): string | null {
    // 必填检查
    if (rule.required && this.isEmpty(value)) {
      return rule.message || '此字段为必填项';
    }

    // 如果值为空且不是必填，跳过其他验证
    if (this.isEmpty(value) && !rule.required) {
      return null;
    }

    // 最小值检查
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
      return rule.message || `值不能小于 ${rule.min}`;
    }

    // 最大值检查
    if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
      return rule.message || `值不能大于 ${rule.max}`;
    }

    // 最小长度检查
    if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
      return rule.message || `长度不能少于 ${rule.minLength} 个字符`;
    }

    // 最大长度检查
    if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
      return rule.message || `长度不能超过 ${rule.maxLength} 个字符`;
    }

    // 正则表达式检查
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return rule.message || '格式不正确';
    }

    // 邮箱格式检查
    if (rule.email && typeof value === 'string' && !this.isEmail(value)) {
      return rule.message || '邮箱格式不正确';
    }

    // 手机号格式检查
    if (rule.phone && typeof value === 'string' && !this.isPhone(value)) {
      return rule.message || '手机号格式不正确';
    }

    // URL格式检查
    if (rule.url && typeof value === 'string' && !this.isUrl(value)) {
      return rule.message || 'URL格式不正确';
    }

    // 自定义验证
    if (rule.custom) {
      const result = rule.custom(value);
      if (result === false) {
        return rule.message || '验证失败';
      }
      if (typeof result === 'string') {
        return result;
      }
    }

    return null;
  }

  /**
   * 检查值是否为空
   */
  private static isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * 邮箱格式验证
   */
  private static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 手机号格式验证（中国手机号）
   */
  private static isPhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * URL格式验证
   */
  private static isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 预定义验证规则
 */
export const ValidationRules = {
  /**
   * 必填
   */
  required: (message?: string): ValidationRule => ({
    required: true,
    message
  }),

  /**
   * 字符串长度
   */
  length: (min: number, max?: number, message?: string): ValidationRule => ({
    minLength: min,
    maxLength: max,
    message
  }),

  /**
   * 数值范围
   */
  range: (min: number, max?: number, message?: string): ValidationRule => ({
    min,
    max,
    message
  }),

  /**
   * 邮箱
   */
  email: (message?: string): ValidationRule => ({
    email: true,
    message
  }),

  /**
   * 手机号
   */
  phone: (message?: string): ValidationRule => ({
    phone: true,
    message
  }),

  /**
   * URL
   */
  url: (message?: string): ValidationRule => ({
    url: true,
    message
  }),

  /**
   * 正则表达式
   */
  pattern: (regex: RegExp, message?: string): ValidationRule => ({
    pattern: regex,
    message
  }),

  /**
   * 用户名规则
   */
  username: (message?: string): ValidationRule => ({
    pattern: /^[a-zA-Z0-9_]{3,20}$/,
    message: message || '用户名只能包含字母、数字和下划线，长度3-20位'
  }),

  /**
   * 密码强度规则
   */
  password: (message?: string): ValidationRule => ({
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    message: message || '密码必须包含大小写字母和数字，长度至少8位'
  }),

  /**
   * 身份证号规则
   */
  idCard: (message?: string): ValidationRule => ({
    pattern: /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/,
    message: message || '身份证号格式不正确'
  }),

  /**
   * QQ号规则
   */
  qq: (message?: string): ValidationRule => ({
    pattern: /^[1-9][0-9]{4,10}$/,
    message: message || 'QQ号格式不正确'
  }),

  /**
   * 微信号规则
   */
  wechat: (message?: string): ValidationRule => ({
    pattern: /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/,
    message: message || '微信号格式不正确'
  }),

  /**
   * IP地址规则
   */
  ip: (message?: string): ValidationRule => ({
    pattern: /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    message: message || 'IP地址格式不正确'
  }),

  /**
   * 中文字符
   */
  chinese: (message?: string): ValidationRule => ({
    pattern: /^[\u4e00-\u9fa5]+$/,
    message: message || '只能输入中文字符'
  }),

  /**
   * 数字字符
   */
  numeric: (message?: string): ValidationRule => ({
    pattern: /^\d+$/,
    message: message || '只能输入数字'
  }),

  /**
   * 字母字符
   */
  alpha: (message?: string): ValidationRule => ({
    pattern: /^[a-zA-Z]+$/,
    message: message || '只能输入字母'
  }),

  /**
   * 字母数字字符
   */
  alphanumeric: (message?: string): ValidationRule => ({
    pattern: /^[a-zA-Z0-9]+$/,
    message: message || '只能输入字母和数字'
  })
};

/**
 * 常用验证模式
 */
export const ValidationSchemas = {
  /**
   * 用户注册
   */
  userRegister: {
    username: [
      ValidationRules.required('用户名不能为空'),
      ValidationRules.username()
    ],
    email: [
      ValidationRules.required('邮箱不能为空'),
      ValidationRules.email()
    ],
    password: [
      ValidationRules.required('密码不能为空'),
      ValidationRules.password()
    ],
    phone: ValidationRules.phone()
  },

  /**
   * 用户登录
   */
  userLogin: {
    username: ValidationRules.required('用户名不能为空'),
    password: ValidationRules.required('密码不能为空')
  },

  /**
   * 产品信息
   */
  product: {
    name: [
      ValidationRules.required('产品名称不能为空'),
      ValidationRules.length(2, 50, '产品名称长度为2-50个字符')
    ],
    price: [
      ValidationRules.required('价格不能为空'),
      ValidationRules.range(0, undefined, '价格必须大于0')
    ],
    description: ValidationRules.length(0, 500, '描述不能超过500个字符')
  },

  /**
   * 批次信息
   */
  batch: {
    batchNumber: [
      ValidationRules.required('批次号不能为空'),
      ValidationRules.pattern(/^[A-Z0-9]{8,16}$/, '批次号格式不正确')
    ],
    productName: [
      ValidationRules.required('产品名称不能为空'),
      ValidationRules.length(2, 100)
    ],
    productionDate: ValidationRules.required('生产日期不能为空'),
    expiryDate: ValidationRules.required('过期日期不能为空')
  }
};

/**
 * 便捷验证函数
 */
export const validate = Validator.validateValue;
export const validateObject = Validator.validateObject;

// 默认导出
export default Validator;