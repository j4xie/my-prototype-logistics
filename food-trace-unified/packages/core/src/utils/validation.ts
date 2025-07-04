// 数据验证工具函数
import { z } from 'zod';

// 通用验证规则
export const validation = {
  // 用户名验证
  username: z.string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),

  // 邮箱验证
  email: z.string()
    .email('请输入有效的邮箱地址'),

  // 密码验证
  password: z.string()
    .min(6, '密码至少6个字符')
    .max(50, '密码最多50个字符')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含大小写字母和数字'),

  // 手机号验证
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),

  // 身份证号验证
  idCard: z.string()
    .regex(/^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/, '请输入有效的身份证号'),

  // 必填字符串
  required: z.string()
    .min(1, '此字段为必填项'),

  // 数字验证
  number: z.number()
    .min(0, '数值不能为负数'),

  // 正整数验证
  positiveInt: z.number()
    .int('必须为整数')
    .positive('必须为正数'),

  // URL验证
  url: z.string()
    .url('请输入有效的URL地址'),

  // 日期验证
  date: z.date()
    .or(z.string().datetime()),
};

// 登录表单验证
export const loginSchema = z.object({
  username: validation.username,
  password: z.string().min(1, '请输入密码'),
  rememberMe: z.boolean().optional()
});

// 注册表单验证
export const registerSchema = z.object({
  username: validation.username,
  email: validation.email,
  password: validation.password,
  confirmPassword: z.string(),
  role: z.enum(['farmer', 'processor', 'logistics', 'retailer', 'consumer']),
  organizationId: z.string().optional(),
  profile: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: validation.phone.optional()
  }).optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
});

// 用户资料验证
export const profileSchema = z.object({
  profile: z.object({
    firstName: z.string().max(50, '姓名最多50个字符').optional(),
    lastName: z.string().max(50, '姓名最多50个字符').optional(),
    phone: validation.phone.optional(),
    department: z.string().max(100, '部门名称最多100个字符').optional(),
    position: z.string().max(100, '职位名称最多100个字符').optional()
  }).optional()
});

// 批次创建验证
export const batchSchema = z.object({
  batchNumber: z.string()
    .min(1, '批次号为必填项')
    .max(50, '批次号最多50个字符'),
  products: z.array(z.object({
    name: validation.required,
    category: z.enum(['grain', 'vegetable', 'fruit', 'meat', 'dairy', 'seafood', 'processed']),
    specifications: z.record(z.any()).optional()
  })).min(1, '至少添加一个产品'),
  farmingData: z.object({
    farmId: validation.required,
    fieldId: validation.required,
    cropType: validation.required,
    seedSource: validation.required,
    plantingDate: validation.date,
    harvestDate: validation.date.optional()
  }).optional()
});

// 质量检测验证
export const qualityCheckSchema = z.object({
  type: validation.required,
  result: z.enum(['pass', 'fail', 'warning']),
  value: validation.number.optional(),
  unit: z.string().optional(),
  standard: z.string().optional(),
  notes: z.string().max(500, '备注最多500个字符').optional()
});

// 验证函数类型
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
};

// 通用验证函数
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _general: ['验证失败'] } };
  }
}

// 验证辅助函数
export const validators = {
  isValidEmail: (email: string) => validation.email.safeParse(email).success,
  isValidPhone: (phone: string) => validation.phone.safeParse(phone).success,
  isValidUsername: (username: string) => validation.username.safeParse(username).success,
  isValidPassword: (password: string) => validation.password.safeParse(password).success,
  isValidUrl: (url: string) => validation.url.safeParse(url).success,
  
  // 批次号格式验证
  isValidBatchNumber: (batchNumber: string) => {
    return /^[A-Z0-9]{2,20}$/.test(batchNumber);
  },
  
  // 二维码格式验证
  isValidQRCode: (qrCode: string) => {
    return /^[A-Z0-9]{10,50}$/.test(qrCode);
  }
};