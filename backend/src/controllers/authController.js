import { PrismaClient } from '@prisma/client';
import {
  generateAuthTokens,
  generatePlatformAuthTokens,
  generateTempToken,
  verifyAndUseTempToken,
  revokeUserTokens
} from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  createSuccessResponse
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// 角色代码映射到角色名称
const mapRoleCodeToRoleName = (roleCode) => {
  const roleMap = {
    'developer': 'DEVELOPER',
    'platform_admin': 'PLATFORM_ADMIN',
    'super_admin': 'SUPER_ADMIN',
    'permission_admin': 'PERMISSION_ADMIN',
    'department_admin': 'DEPARTMENT_ADMIN',
    'user': 'USER',
    'unactivated': 'USER'
  };
  return roleMap[roleCode] || 'USER';
};

// 获取角色显示名称
const getRoleDisplayName = (roleCode) => {
  const displayNameMap = {
    'developer': '系统开发者',
    'platform_admin': '平台管理员',
    'super_admin': '工厂超级管理员',
    'permission_admin': '权限管理员',
    'department_admin': '部门管理员',
    'user': '普通用户',
    'unactivated': '待激活用户'
  };
  return displayNameMap[roleCode] || '普通用户';
};

// 生成用户权限对象
const generateUserPermissions = (user) => {
  const roleCode = user.roleCode;
  const department = user.department;
  
  // 开发者拥有所有权限
  if (roleCode === 'developer') {
    return {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true,
        platform_access: true,
      },
      features: [
        'user_manage_all',
        'whitelist_manage_all',
        'stats_view_all',
        'developer_debug_access',
        'developer_system_config',
        'developer_data_export',
        'developer_cross_platform'
      ],
      role: 'DEVELOPER',
      roleLevel: -1,
      department: department
    };
  }
  
  // 平台管理员权限
  if (roleCode === 'platform_admin') {
    return {
      modules: {
        farming_access: false,
        processing_access: false,
        logistics_access: false,
        trace_access: false,
        admin_access: false,
        platform_access: true,
      },
      features: ['platform_manage_all'],
      role: 'PLATFORM_ADMIN',
      roleLevel: 0,
      department: null
    };
  }
  
  // 工厂超级管理员权限
  if (roleCode === 'super_admin') {
    return {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true,
        platform_access: false,
      },
      features: [
        'user_manage_all',
        'whitelist_manage_all',
        'stats_view_all'
      ],
      role: 'SUPER_ADMIN',
      roleLevel: 0,
      department: department
    };
  }
  
  // 权限管理员权限
  if (roleCode === 'permission_admin') {
    return {
      modules: {
        farming_access: false,
        processing_access: false,
        logistics_access: false,
        trace_access: true,
        admin_access: true,
        platform_access: false,
      },
      features: [
        'user_manage_all',
        'stats_view_all'
      ],
      role: 'PERMISSION_ADMIN',
      roleLevel: 5,
      department: department
    };
  }
  
  // 部门管理员权限
  if (roleCode === 'department_admin') {
    return {
      modules: {
        farming_access: department === 'farming',
        processing_access: department === 'processing',
        logistics_access: department === 'logistics',
        trace_access: true,
        admin_access: false,
        platform_access: false,
      },
      features: [
        'user_manage_own_dept',
        'stats_view_own_dept'
      ],
      role: 'DEPARTMENT_ADMIN',
      roleLevel: 10,
      department: department
    };
  }
  
  // 普通用户权限
  return {
    modules: {
      farming_access: department === 'farming',
      processing_access: department === 'processing',
      logistics_access: department === 'logistics',
      trace_access: true,
      admin_access: false,
      platform_access: false,
    },
    features: [],
    role: 'USER',
    roleLevel: 50,
    department: department
  };
};

/**
 * 手机号验证接口
 * 验证手机号是否在白名单中且可以注册
 */
export const verifyPhone = async (req, res, next) => {
  try {
    const { phoneNumber, factoryId } = req.body;

    // 验证工厂是否存在且激活
    const factory = await prisma.factory.findFirst({
      where: {
        id: factoryId,
        isActive: true,
      },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在或已停用');
    }

    // 查询白名单记录
    const whitelist = await prisma.userWhitelist.findFirst({
      where: {
        factoryId,
        phoneNumber,
      },
    });

    if (!whitelist) {
      throw new ValidationError('该手机号未被邀请注册');
    }

    // 检查白名单状态
    if (whitelist.status === 'REGISTERED') {
      throw new ConflictError('该手机号已被注册');
    }

    if (whitelist.status === 'EXPIRED') {
      throw new BusinessLogicError('邀请已过期，请联系管理员');
    }

    // 检查是否过期
    if (whitelist.expiresAt && new Date() > whitelist.expiresAt) {
      // 更新状态为过期
      await prisma.userWhitelist.update({
        where: { id: whitelist.id },
        data: { status: 'EXPIRED' },
      });
      throw new BusinessLogicError('邀请已过期，请联系管理员');
    }

    // 生成临时令牌
    const tempToken = await generateTempToken(
      'PHONE_VERIFICATION',
      factoryId,
      phoneNumber,
      { whitelistId: whitelist.id },
      30 // 30分钟有效期
    );

    res.json(createSuccessResponse({
      tempToken,
      message: '验证通过，请在30分钟内完成注册',
    }, '手机号验证成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 用户注册接口
 * 完成用户注册，需要先通过手机验证
 */
export const register = async (req, res, next) => {
  try {
    const { phoneNumber, username, password, email, fullName, tempToken } = req.body;

    // 验证临时令牌
    if (!tempToken) {
      throw new ValidationError('缺少手机验证令牌');
    }

    const tokenData = await verifyAndUseTempToken(tempToken, 'PHONE_VERIFICATION');

    if (tokenData.phoneNumber !== phoneNumber) {
      throw new ValidationError('手机号与验证令牌不匹配');
    }

    const { factoryId } = tokenData;

    // 再次验证白名单状态
    const whitelist = await prisma.userWhitelist.findFirst({
      where: {
        factoryId,
        phoneNumber,
        status: 'PENDING',
      },
    });

    if (!whitelist) {
      throw new ValidationError('白名单状态已改变，请重新验证');
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        factoryId,
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictError('用户名已存在');
      }
      if (existingUser.email === email) {
        throw new ConflictError('邮箱已存在');
      }
    }

    // 创建用户
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        factoryId,
        username,
        passwordHash,
        email,
        phone: phoneNumber,
        fullName,
        isActive: false,
        roleLevel: 99,
        roleCode: 'unactivated',
        permissions: [],
      },
    });

    // 更新白名单状态
    await prisma.userWhitelist.update({
      where: { id: whitelist.id },
      data: { status: 'REGISTERED' },
    });

    res.status(201).json(createSuccessResponse({
      userId: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
    }, '注册成功，请等待管理员激活'));
  } catch (error) {
    next(error);
  }
};

/**
 * 用户登录接口
 * 支持多租户登录，检查激活状态
 */
export const login = async (req, res, next) => {
  try {
    const { username, password, factoryId } = req.body;

    // 验证工厂是否存在且激活
    const factory = await prisma.factory.findFirst({
      where: {
        id: factoryId,
        isActive: true,
      },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在或已停用');
    }

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        factoryId,
        username,
      },
      include: {
        factory: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('用户名或密码错误');
    }

    // 检查用户是否激活
    if (!user.isActive) {
      throw new BusinessLogicError('账户尚未激活，请联系管理员', 'USER_NOT_ACTIVATED');
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // 生成认证令牌
    const tokens = await generateAuthTokens(user);

    // 为开发者生成完整的权限数据
    const userPermissions = generateUserPermissions(user);

    res.json(createSuccessResponse({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: {
          name: mapRoleCodeToRoleName(user.roleCode),
          displayName: getRoleDisplayName(user.roleCode),
          level: user.roleLevel
        },
        permissions: userPermissions,
        roleCode: user.roleCode,
        roleLevel: user.roleLevel,
        department: user.department,
        position: user.position,
      },
      factory: {
        id: user.factory.id,
        name: user.factory.name,
        industry: user.factory.industry,
      },
      tokens,
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 平台管理员登录接口
 */
export const platformLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 查找平台管理员
    const admin = await prisma.platformAdmin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new AuthenticationError('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('用户名或密码错误');
    }

    // 生成认证令牌
    const tokens = generatePlatformAuthTokens(admin);

    res.json(createSuccessResponse({
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
      },
      tokens,
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 用户登出接口
 */
export const logout = async (req, res, next) => {
  try {
    const { user, session } = req;

    if (session) {
      // 撤销当前会话
      await prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
    }

    res.json(createSuccessResponse(null, '登出成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const { user, factory } = req;

    res.json(createSuccessResponse({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roleCode: user.roleCode,
        roleLevel: user.roleLevel,
        department: user.department,
        position: user.position,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
      },
      factory: {
        id: factory.id,
        name: factory.name,
        industry: factory.industry,
      },
    }, '获取用户信息成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 刷新令牌接口
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const newTokens = await refreshAuthToken(refreshToken);

    res.json(createSuccessResponse({
      tokens: newTokens,
    }, '令牌刷新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 修改密码接口
 */
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { user } = req;

    // 验证旧密码
    const isOldPasswordValid = await verifyPassword(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new AuthenticationError('旧密码错误');
    }

    // 加密新密码
    const newPasswordHash = await hashPassword(newPassword);

    // 更新密码
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // 撤销所有现有的会话
    await revokeUserTokens(user.id, user.factoryId);

    res.json(createSuccessResponse(null, '密码修改成功，请重新登录'));
  } catch (error) {
    next(error);
  }
};

/**
 * 检查认证状态
 */
export const checkAuthStatus = async (req, res, next) => {
  try {
    const { user, admin } = req;

    if (user) {
      res.json(createSuccessResponse({
        type: 'factory_user',
        isAuthenticated: true,
        user: {
          id: user.id,
          username: user.username,
          roleCode: user.roleCode,
          factoryId: user.factoryId,
        },
      }));
    } else if (admin) {
      res.json(createSuccessResponse({
        type: 'platform_admin',
        isAuthenticated: true,
        admin: {
          id: admin.id,
          username: admin.username,
        },
      }));
    } else {
      res.json(createSuccessResponse({
        isAuthenticated: false,
      }));
    }
  } catch (error) {
    next(error);
  }
};
