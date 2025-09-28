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
    'factory_super_admin': 'SUPER_ADMIN',
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
    'factory_super_admin': '工厂超级管理员',
    'permission_admin': '权限管理员',
    'department_admin': '部门管理员',
    'user': '普通用户',
    'unactivated': '待激活用户'
  };
  return displayNameMap[roleCode] || '普通用户';
};

// 生成平台用户权限对象
const generatePlatformUserPermissions = (admin) => {
  const role = admin.role;

  // 系统开发者拥有所有权限
  if (role === 'system_developer') {
    return {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true,
        platform_access: true,
        debug_access: true,
        system_config: true
      },
      features: [
        'user_manage_all',
        'whitelist_manage_all',
        'stats_view_all',
        'developer_debug_access',
        'developer_system_config',
        'developer_data_export',
        'developer_cross_platform',
        'all_factories_access'
      ],
      role: 'DEVELOPER',
      roleLevel: 0, // 最高级别权限
      userType: 'platform'
    };
  }

  // 平台超级管理员权限
  if (role === 'platform_super_admin') {
    return {
      modules: {
        farming_access: true,
        processing_access: true,
        logistics_access: true,
        trace_access: true,
        admin_access: true, // 修复：应该有管理权限
        platform_access: true,
      },
      features: [
        'platform_manage_all',
        'factory_manage_all',
        'user_manage_all'
      ],
      role: 'PLATFORM_ADMIN',
      roleLevel: 1,
      userType: 'platform'
    };
  }

  // 平台操作员权限
  return {
    modules: {
      farming_access: true,
      processing_access: true,
      logistics_access: true,
      trace_access: true, // 修复：应该有追溯权限
      admin_access: false,
      platform_access: true,
    },
    features: ['factory_view_all', 'stats_view_all'],
    role: 'PLATFORM_OPERATOR',
    roleLevel: 2,
    userType: 'platform'
  };
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
  if (roleCode === 'factory_super_admin') {
    // 特殊处理：如果是开发者（通过position字段识别），给予所有权限
    if (user.position === 'SYSTEM_DEVELOPER') {
      return {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: true,
          trace_access: true,
          admin_access: true,
          platform_access: true,  // 开发者可以访问平台管理
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

    // 普通工厂超级管理员
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
      roleLevel: 5, // 修复：工厂超级管理员级别应该大于平台用户最大级别2
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
      roleLevel: 10,
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
      roleLevel: 15,
      department: department
    };
  }

  // 操作员权限
  if (roleCode === 'operator') {
    return {
      modules: {
        farming_access: department === 'farming',
        processing_access: department === 'processing',
        logistics_access: department === 'logistics',
        trace_access: true,
        admin_access: false,
        platform_access: false,
      },
      features: ['data_input', 'stats_view_basic'],
      role: 'OPERATOR',
      roleLevel: 20,
      department: department
    };
  }

  // 查看者权限
  if (roleCode === 'viewer') {
    return {
      modules: {
        farming_access: false,
        processing_access: false,
        logistics_access: false,
        trace_access: true,
        admin_access: false,
        platform_access: false,
      },
      features: ['stats_view_basic'],
      role: 'VIEWER',
      roleLevel: 30,
      department: department
    };
  }

  // 未激活用户或其他角色的默认权限
  return {
    modules: {
      farming_access: false,
      processing_access: false,
      logistics_access: false,
      trace_access: false,
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
        roleCode: 'unactivated',
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
    const { username, password } = req.body;

    console.log('🔍 统一登录请求:', { username, timestamp: new Date().toISOString() });

    // 智能用户识别：优先级1 - 平台用户 (PlatformAdmin)
    const platformUser = await prisma.platformAdmin.findUnique({
      where: { username }
    });

    if (platformUser) {
      console.log('✅ 识别为平台用户:', { username, role: platformUser.role });

      // 验证密码
      const isPasswordValid = await verifyPassword(password, platformUser.passwordHash);
      if (!isPasswordValid) {
        throw new AuthenticationError('用户名或密码错误');
      }

      // 生成平台认证令牌
      const tokens = generatePlatformAuthTokens(platformUser);

      // 生成平台用户权限
      const permissions = generatePlatformUserPermissions(platformUser);

      return res.json(createSuccessResponse({
        admin: {
          id: platformUser.id,
          username: platformUser.username,
          email: platformUser.email,
          fullName: platformUser.fullName,
          role: {
            name: platformUser.role === 'system_developer' ? 'DEVELOPER' : 'PLATFORM_ADMIN',
            displayName: platformUser.role === 'system_developer' ? '系统开发者' : '平台管理员'
          },
          permissions
        },
        tokens,
        userType: 'platform'
      }, '登录成功'));
    }

    // 智能用户识别：优先级2 - 工厂用户 (User)
    console.log('🔍 查找工厂用户:', username);

    // 通过用户名查找工厂用户，系统会自动匹配其所属工厂
    const user = await prisma.user.findFirst({
      where: {
        username,
      },
      include: {
        factory: true,
      },
    });

    if (user) {
      console.log('✅ 找到工厂用户:', { username, factoryId: user.factoryId, factoryName: user.factory?.name });

      // 验证工厂是否激活
      if (!user.factory || !user.factory.isActive) {
        console.log('❌ 用户所属工厂未激活:', user.factoryId);
        throw new NotFoundError('所属工厂不存在或已停用');
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

      // 生成工厂用户权限
      const userPermissions = generateUserPermissions(user);

      return res.json(createSuccessResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: {
            name: mapRoleCodeToRoleName(user.roleCode),
            displayName: getRoleDisplayName(user.roleCode)
          },
          permissions: userPermissions,
          roleCode: user.roleCode,
          department: user.department,
          position: user.position,
        },
        factory: {
          id: user.factory.id,
          name: user.factory.name,
          industry: user.factory.industry,
        },
        tokens,
        userType: 'factory'
      }, '登录成功'));
    }

    // 如果都没找到，返回错误
    throw new AuthenticationError('用户不存在或密码错误');

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
 * 统一登录接口 - 支持平台用户和工厂用户
 */
export const unifiedLogin = async (username, password, deviceInfo = null) => {
  try {
    console.log('🔍 统一登录请求:', { username, timestamp: new Date().toISOString() });
    
    // 智能用户识别：优先级1 - 平台用户 (PlatformAdmin)
    const platformUser = await prisma.platformAdmin.findUnique({
      where: { username }
    });
    
    if (platformUser) {
      console.log('✅ 识别为平台用户:', { username, role: platformUser.role });
      
      // 验证密码
      const isPasswordValid = await verifyPassword(password, platformUser.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: '用户名或密码错误'
        };
      }
      
      // 生成平台认证令牌
      const tokens = generatePlatformAuthTokens(platformUser);
      
      // 记录会话信息（如果有设备信息）
      if (deviceInfo) {
        // 这里可以记录设备信息到日志或数据库
        console.log('📱 平台用户设备信息:', {
          userId: platformUser.id,
          userType: 'platform',
          deviceInfo
        });
      }
      
      // 生成平台用户权限
      const permissions = generatePlatformUserPermissions(platformUser);
      
      return {
        success: true,
        message: '登录成功',
        user: {
          id: platformUser.id,
          username: platformUser.username,
          email: platformUser.email,
          phone: platformUser.phone || undefined,
          fullName: platformUser.fullName || undefined,
          role: platformUser.role,
          userType: 'platform',
          permissions,
          createdAt: platformUser.createdAt.toISOString()
        },
        tokens
      };
    }
    
    // 智能用户识别：优先级2 - 工厂用户 (User)
    console.log('🔍 查找工厂用户:', username);
    
    // 通过用户名查找工厂用户
    const user = await prisma.user.findFirst({
      where: { username },
      include: { factory: true }
    });
    
    if (user) {
      console.log('✅ 识别为工厂用户:', { 
        username, 
        factoryId: user.factoryId,
        roleCode: user.roleCode 
      });
      
      // 验证密码
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: '用户名或密码错误'
        };
      }
      
      // 检查用户是否激活
      if (!user.isActive) {
        return {
          success: false,
          message: '账号未激活，请联系管理员'
        };
      }
      
      // 生成工厂用户认证令牌
      const tokens = await generateAuthTokens(user, user.factoryId);
      
      // 更新最后登录时间
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });
      
      // 记录设备信息（如果有）
      if (deviceInfo) {
        console.log('📱 工厂用户设备信息:', {
          userId: user.id,
          userType: 'factory',
          factoryId: user.factoryId,
          deviceInfo
        });
      }
      
      // 生成工厂用户权限
      const permissions = generateUserPermissions(user);
      
      return {
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone || undefined,
          fullName: user.fullName || undefined,
          roleCode: user.roleCode,
          factoryId: user.factoryId,
          department: user.department || undefined,
          position: user.position || undefined,
          isActive: user.isActive,
          userType: 'factory',
          permissions,
          lastLoginAt: user.lastLogin?.toISOString() || undefined,
          createdAt: user.createdAt.toISOString()
        },
        tokens
      };
    }
    
    // 未找到用户
    console.log('❌ 用户不存在:', username);
    return {
      success: false,
      message: '用户名或密码错误'
    };
    
  } catch (error) {
    console.error('统一登录失败:', error);
    return {
      success: false,
      message: '登录服务暂时不可用'
    };
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
/**
 * 发送手机验证码
 */
export const sendVerificationCode = async (phoneNumber, verificationType) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { generateTempToken } = await import('../utils/jwt.js');
    const prisma = new PrismaClient();
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      return {
        success: false,
        message: '手机号格式不正确'
      };
    }
    
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 创建临时token记录验证码
    const tempToken = await generateTempToken({
      type: verificationType === 'register' ? 'PHONE_VERIFICATION' : 'PASSWORD_RESET',
      phoneNumber,
      code,
      expiresIn: 300 // 5分钟有效期
    });
    
    console.log(`📱 发送验证码: ${phoneNumber} - ${code}`);
    
    // 实际项目中这里应该调用短信服务发送验证码
    // await smsService.sendCode(phoneNumber, code);
    
    await prisma.$disconnect();
    
    return {
      success: true,
      message: '验证码已发送',
      tempToken, // 开发环境返回token，生产环境不应返回
      code // 开发环境返回验证码，生产环境绝对不能返回
    };
  } catch (error) {
    console.error('发送验证码失败:', error);
    return {
      success: false,
      message: '发送验证码失败，请稍后重试'
    };
  }
};

/**
 * 检查白名单状态
 */
export const checkWhitelistStatus = async (phoneNumber) => {
  try {
    // 查找所有工厂的白名单记录
    const whitelistEntries = await prisma.userWhitelist.findMany({
      where: {
        phoneNumber,
        status: 'PENDING',
        expiresAt: {
          gt: new Date() // 未过期
        }
      },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            industry: true
          }
        }
      }
    });
    
    if (whitelistEntries.length === 0) {
      return {
        success: false,
        message: '您的手机号未在白名单中，请联系管理员添加',
        isInWhitelist: false
      };
    }
    
    return {
      success: true,
      message: '手机号已在白名单中',
      isInWhitelist: true,
      factories: whitelistEntries.map(entry => ({
        factoryId: entry.factory.id,
        factoryName: entry.factory.name,
        industry: entry.factory.industry
      }))
    };
  } catch (error) {
    console.error('检查白名单失败:', error);
    return {
      success: false,
      message: '检查白名单失败'
    };
  }
};

/**
 * 移动端注册第一阶段
 */
export const mobileRegisterPhaseOne = async (phoneNumber, verificationType) => {
  try {
    // 检查白名单
    const whitelistStatus = await checkWhitelistStatus(phoneNumber);
    
    if (!whitelistStatus.isInWhitelist) {
      return whitelistStatus;
    }
    
    // 发送验证码
    const codeResult = await sendVerificationCode(phoneNumber, verificationType);
    
    if (!codeResult.success) {
      return codeResult;
    }
    
    return {
      success: true,
      message: '验证码已发送，请继续完成注册',
      tempToken: codeResult.tempToken,
      factories: whitelistStatus.factories,
      nextStep: 'phone_verification'
    };
  } catch (error) {
    console.error('注册第一阶段失败:', error);
    return {
      success: false,
      message: '注册服务暂时不可用'
    };
  }
};

/**
 * 移动端注册第二阶段
 */
export const mobileRegisterPhaseTwo = async (data) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { verifyAndUseTempToken, generateAuthTokens } = await import('../utils/jwt.js');
    const { hashPassword } = await import('../utils/password.js');
    const prisma = new PrismaClient();
    
    const {
      phoneNumber,
      verificationCode,
      username,
      password,
      realName,
      deviceInfo
    } = data;
    
    // 验证验证码 (暂时跳过真实验证)
    console.log('验证码验证 (开发模式):', { phoneNumber, verificationCode });
    
    // 查找可用的工厂ID
    const whitelistEntry = await prisma.userWhitelist.findFirst({
      where: {
        phoneNumber,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });
    
    if (!whitelistEntry) {
      return {
        success: false,
        message: '白名单记录不存在或已过期'
      };
    }
    
    const factoryId = whitelistEntry.factoryId;
    
    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { phone: phoneNumber }
        ]
      }
    });
    
    if (existingUser) {
      await prisma.$disconnect();
      return {
        success: false,
        message: '用户名或手机号已被注册'
      };
    }
    
    // 创建用户
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        factoryId,
        username,
        passwordHash: hashedPassword,
        email: `${username}@${factoryId}.local`, // 临时邮箱
        phone: phoneNumber,
        fullName: realName,
        isActive: true, // 白名单用户自动激活
        roleCode: 'viewer', // 默认查看者角色
        lastLogin: new Date()
      }
    });
    
    // 更新白名单状态
    await prisma.userWhitelist.updateMany({
      where: {
        phoneNumber,
        factoryId,
        status: 'PENDING'
      },
      data: {
        status: 'REGISTERED'
      }
    });
    
    // 生成认证令牌
    const tokens = await generateAuthTokens(newUser, factoryId);
    
    await prisma.$disconnect();
    
    return {
      success: true,
      message: '注册成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        fullName: newUser.fullName,
        roleCode: newUser.roleCode,
        factoryId: newUser.factoryId,
        isActive: newUser.isActive,
        userType: 'factory',
        permissions: {
          modules: {
            farming_access: true,
            processing_access: true,
            logistics_access: true,
            trace_access: true,
            admin_access: false,
            platform_access: false,
          },
          features: ['data_view_own', 'report_view'],
          role: 'viewer',
          userType: 'factory',
          level: 50,
          departments: []
        },
        createdAt: newUser.createdAt.toISOString()
      },
      tokens
    };
  } catch (error) {
    console.error('注册第二阶段失败:', error);
    return {
      success: false,
      message: '注册失败，请稍后重试'
    };
  }
};

/**
 * 设备绑定
 */
export const bindDevice = async (user, deviceId, deviceInfo) => {
  try {
    const userId = user.id;
    const userType = user.role ? 'platform' : 'factory';
    
    // 记录设备绑定信息到会话或日志
    console.log('📱 设备绑定:', {
      userId,
      userType,
      deviceId,
      deviceInfo,
      timestamp: new Date().toISOString()
    });
    
    // 可以在Session表中添加设备信息字段来记录
    // 或创建专门的设备绑定表
    
    return {
      success: true,
      message: '设备绑定成功',
      deviceToken: Buffer.from(`${userId}:${deviceId}:${Date.now()}`).toString('base64')
    };
  } catch (error) {
    console.error('设备绑定失败:', error);
    return {
      success: false,
      message: '设备绑定失败'
    };
  }
};

/**
 * 设备登录
 */
export const deviceLogin = async (deviceId, deviceToken) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { generatePlatformAuthTokens, generateAuthTokens } = await import('../utils/jwt.js');
    const prisma = new PrismaClient();
    
    // 解析设备token
    const decoded = Buffer.from(deviceToken, 'base64').toString();
    const [userId, boundDeviceId] = decoded.split(':');
    
    if (boundDeviceId !== deviceId) {
      await prisma.$disconnect();
      return {
        success: false,
        message: '设备信息不匹配'
      };
    }
    
    // 查找用户（先尝试平台用户，再尝试工厂用户）
    let user = await prisma.platformAdmin.findUnique({
      where: { id: parseInt(userId) }
    });
    
    let userType = 'platform';
    let tokens;
    let permissions;
    
    if (user) {
      tokens = generatePlatformAuthTokens(user);
      permissions = {
        modules: {
          farming_access: false,
          processing_access: false,
          logistics_access: false,
          trace_access: false,
          admin_access: false,
          platform_access: true,
        },
        features: ['platform_manage_all', 'factory_manage_all', 'user_manage_all'],
        role: user.role,
        userType: 'platform',
        level: 0,
        departments: []
      };
    } else {
      user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        include: { factory: true }
      });
      
      if (!user) {
        await prisma.$disconnect();
        return {
          success: false,
          message: '用户不存在'
        };
      }
      
      userType = 'factory';
      tokens = await generateAuthTokens(user, user.factoryId);
      permissions = {
        modules: {
          farming_access: true,
          processing_access: true,
          logistics_access: true,
          trace_access: true,
          admin_access: false,
          platform_access: false,
        },
        features: ['data_view_own', 'report_view'],
        role: user.roleCode,
        userType: 'factory',
        level: 50,
        departments: []
      };
      
      // 更新最后登录时间
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });
    }
    
    await prisma.$disconnect();
    
    return {
      success: true,
      message: '设备登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || undefined,
        fullName: user.fullName || undefined,
        role: user.role || user.roleCode,
        userType,
        permissions,
        ...(userType === 'factory' && {
          factoryId: user.factoryId,
          department: user.department,
          isActive: user.isActive
        }),
        createdAt: user.createdAt.toISOString()
      },
      tokens
    };
  } catch (error) {
    console.error('设备登录失败:', error);
    return {
      success: false,
      message: '设备登录失败'
    };
  }
};