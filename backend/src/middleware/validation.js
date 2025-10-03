import { z } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * 通用验证中间件
 * @param {Object} schema - Zod验证schema对象，包含body、query、params
 * @returns {Function} 中间件函数
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // 验证请求体
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // 验证查询参数
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // 验证路径参数
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        next(new ValidationError('数据验证失败', validationErrors));
      } else {
        next(error);
      }
    }
  };
};

// 通用字段验证规则
const phoneRegex = /^1[3-9]\d{9}$/;
const factoryIdRegex = /^([A-Z]+_\d{4}_\d{3}|\d{3}-[A-Z]{2}-\d{4}-\d{3})$/;
const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// 基础验证schema
export const baseSchemas = {
  phoneNumber: z.string().regex(phoneRegex, '请输入正确的手机号码'),
  factoryId: z.string().regex(factoryIdRegex, '工厂ID格式不正确'),
  username: z.string().regex(usernameRegex, '用户名长度4-20位，只能包含字母、数字、下划线'),
  password: z.string().regex(passwordRegex, '密码至少8位，包含大小写字母和数字'),
  email: z.string().email('请输入正确的邮箱地址'),
  id: z.string().transform(val => parseInt(val)).refine(val => val > 0, '无效的ID'),
};

// 认证相关验证schema
export const authSchemas = {
  // 手机号验证
  phoneVerification: {
    body: z.object({
      phoneNumber: baseSchemas.phoneNumber,
      factoryId: baseSchemas.factoryId,
    }),
  },

  // 用户注册
  userRegistration: {
    body: z.object({
      phoneNumber: baseSchemas.phoneNumber,
      username: baseSchemas.username,
      password: baseSchemas.password,
      email: baseSchemas.email,
      fullName: z.string().min(2, '姓名至少2个字符').max(50, '姓名不能超过50个字符'),
      tempToken: z.string().optional(),
    }),
  },

  // 用户登录
  userLogin: {
    body: z.object({
      username: z.string().min(1, '用户名不能为空'),
      password: z.string().min(1, '密码不能为空'),
      factoryId: z.string().optional(), // 统一登录接口中factoryId为完全可选，不验证格式
    }),
  },

  // 平台管理员登录
  platformAdminLogin: {
    body: z.object({
      username: z.string().min(1, '用户名不能为空'),
      password: z.string().min(1, '密码不能为空'),
    }),
  },

  // 刷新令牌
  refreshToken: {
    body: z.object({
      refreshToken: z.string().min(1, '刷新令牌不能为空'),
    }),
  },

  // 密码重置
  resetPassword: {
    body: z.object({
      token: z.string().min(1, '重置令牌不能为空'),
      newPassword: baseSchemas.password,
    }),
  },
};

// 白名单管理验证schema
export const whitelistSchemas = {
  // 添加白名单
  addWhitelist: {
    body: z.object({
      phoneNumbers: z.array(baseSchemas.phoneNumber)
        .min(1, '至少添加一个手机号')
        .max(100, '一次最多添加100个手机号'),
      expiresAt: z.string().datetime().optional(),
    }),
  },

  // 获取白名单列表
  getWhitelist: {
    query: z.object({
      page: z.string().transform(val => parseInt(val) || 1),
      pageSize: z.string().transform(val => Math.min(parseInt(val) || 10, 100)),
      status: z.enum(['PENDING', 'REGISTERED', 'EXPIRED']).optional(),
      search: z.string().optional(),
    }),
  },

  // 更新白名单状态
  updateWhitelist: {
    params: z.object({
      id: baseSchemas.id,
    }),
    body: z.object({
      status: z.enum(['PENDING', 'REGISTERED', 'EXPIRED']),
      expiresAt: z.string().datetime().optional(),
    }),
  },

  // 删除白名单
  deleteWhitelist: {
    params: z.object({
      id: baseSchemas.id,
    }),
  },
};

// 用户管理验证schema
export const userSchemas = {
  // 激活用户
  activateUser: {
    params: z.object({
      userId: baseSchemas.id,
    }),
    body: z.object({
      roleCode: z.enum(['factory_super_admin', 'permission_admin', 'department_admin', 'user']),
      roleLevel: z.number().int().min(1).max(99),
      department: z.string().optional(),
      position: z.string().optional(),
      permissions: z.array(z.string()).optional(),
    }),
  },

  // 更新用户信息
  updateUser: {
    params: z.object({
      userId: baseSchemas.id,
    }),
    body: z.object({
      fullName: z.string().min(2).max(50).optional(),
      email: baseSchemas.email.optional(),
      phone: baseSchemas.phoneNumber.optional(),
      department: z.string().optional(),
      position: z.string().optional(),
      permissions: z.array(z.string()).optional(),
    }),
  },

  // 获取用户列表
  getUsers: {
    query: z.object({
      page: z.string().transform(val => parseInt(val) || 1),
      pageSize: z.string().transform(val => Math.min(parseInt(val) || 10, 100)),
      isActive: z.enum(['true', 'false']).optional(),
      roleCode: z.string().optional(),
      department: z.string().optional(),
      search: z.string().optional(),
    }),
  },

  // 停用/启用用户
  toggleUserStatus: {
    params: z.object({
      userId: baseSchemas.id,
    }),
    body: z.object({
      isActive: z.boolean(),
    }),
  },
};

// 平台管理验证schema
export const platformSchemas = {
  // 创建工厂
  createFactory: {
    body: z.object({
      name: z.string().min(2, '工厂名称至少2个字符').max(100, '工厂名称不能超过100个字符'),
      industry: z.string().optional(),
      contactEmail: baseSchemas.email.optional(),
      contactPhone: baseSchemas.phoneNumber.optional(),
      address: z.string().optional(),
      description: z.string().optional(),
    }),
  },

  // 更新工厂信息
  updateFactory: {
    params: z.object({
      id: baseSchemas.id,
    }),
    body: z.object({
      name: z.string().min(2).max(100).optional(),
      industry: z.string().optional(),
      contactEmail: baseSchemas.email.optional(),
      contactPhone: baseSchemas.phoneNumber.optional(),
      address: z.string().optional(),
      description: z.string().optional(),
    }),
  },

  // 获取工厂列表
  getFactories: {
    query: z.object({
      page: z.string().transform(val => parseInt(val) || 1),
      pageSize: z.string().transform(val => Math.min(parseInt(val) || 10, 100)),
      isActive: z.enum(['true', 'false']).optional(),
      industry: z.string().optional(),
      search: z.string().optional(),
    }),
  },

  // 停用/启用工厂
  toggleFactoryStatus: {
    params: z.object({
      id: baseSchemas.id,
    }),
    body: z.object({
      isActive: z.boolean(),
    }),
  },

  // 创建超级管理员
  createSuperAdmin: {
    params: z.object({
      id: baseSchemas.id,
    }),
    body: z.object({
      username: baseSchemas.username,
      email: baseSchemas.email.optional(),
      fullName: z.string().min(2).max(50),
      phone: baseSchemas.phoneNumber.optional(),
    }),
  },
};

// 权限管理验证schema
export const permissionSchemas = {
  // 获取部门权限
  getDepartmentPermissions: {
    query: z.object({
      department: z.string().optional(),
    }),
  },

  // 更新用户权限
  updateUserPermissions: {
    params: z.object({
      userId: baseSchemas.id,
    }),
    body: z.object({
      permissions: z.array(z.string()),
    }),
  },
};