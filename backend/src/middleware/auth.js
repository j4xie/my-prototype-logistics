import { verifyToken, validateSession } from '../utils/jwt.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 检查用户是否为开发者
 * 开发者拥有最高权限，可以绕过所有权限检查
 */
const isDeveloper = (user) => {
  return user && user.roleCode === 'developer' && user.roleLevel === -1;
};

/**
 * 工厂用户认证中间件
 * 验证JWT令牌并获取用户信息
 */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌',
        errorCode: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    // 验证令牌格式
    const payload = verifyToken(token);
    
    if (payload.type !== 'factory_user') {
      return res.status(401).json({
        success: false,
        message: '无效的令牌类型',
        errorCode: 'INVALID_TOKEN_TYPE',
      });
    }

    // 验证会话是否有效
    const session = await validateSession(token);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: '令牌已过期或无效',
        errorCode: 'INVALID_TOKEN',
      });
    }

    // 检查用户是否仍然激活
    if (!session.user.isActive) {
      return res.status(401).json({
        success: false,
        message: '账户已被停用',
        errorCode: 'ACCOUNT_DISABLED',
      });
    }

    // 检查工厂是否仍然激活
    if (!session.user.factory.isActive) {
      return res.status(401).json({
        success: false,
        message: '工厂账户已被停用',
        errorCode: 'FACTORY_DISABLED',
      });
    }

    // 将用户信息附加到请求对象
    req.user = session.user;
    req.factory = session.user.factory;
    req.session = session;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证失败',
      errorCode: 'AUTH_FAILED',
    });
  }
};

/**
 * 平台管理员认证中间件
 * 验证平台管理员JWT令牌
 */
export const authenticatePlatformAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌',
        errorCode: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7);
    
    // 验证令牌格式
    const payload = verifyToken(token);
    
    if (payload.type !== 'platform_admin') {
      return res.status(401).json({
        success: false,
        message: '无效的令牌类型',
        errorCode: 'INVALID_TOKEN_TYPE',
      });
    }

    // 获取平台管理员信息
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: '平台管理员不存在',
        errorCode: 'ADMIN_NOT_FOUND',
      });
    }

    // 将管理员信息附加到请求对象
    req.admin = admin;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证失败',
      errorCode: 'AUTH_FAILED',
    });
  }
};

/**
 * 角色权限中间件
 * 检查用户是否具有指定的角色权限
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        errorCode: 'USER_NOT_AUTHENTICATED',
      });
    }

    // 开发者绕过权限检查
    if (isDeveloper(req.user)) {
      console.log(`🛠️ 开发者 ${req.user.username} 绕过角色权限检查: ${allowedRoles.join(', ')}`);
      return next();
    }

    const userRole = req.user.roleCode;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole,
      });
    }

    next();
  };
};

/**
 * 权限检查中间件
 * 检查用户是否具有指定的具体权限
 */
export const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        errorCode: 'USER_NOT_AUTHENTICATED',
      });
    }

    // 开发者绕过权限检查
    if (isDeveloper(req.user)) {
      console.log(`🛠️ 开发者 ${req.user.username} 绕过具体权限检查: ${requiredPermissions.join(', ')}`);
      return next();
    }

    const userPermissions = req.user.permissions || [];
    
    // 检查是否拥有所有必需的权限
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        requiredPermissions,
        userPermissions,
      });
    }

    next();
  };
};

/**
 * 管理员权限中间件
 * 检查用户是否为管理员（super_admin 或 permission_admin）
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '用户未认证',
      errorCode: 'USER_NOT_AUTHENTICATED',
    });
  }

  // 开发者绕过管理员权限检查
  if (isDeveloper(req.user)) {
    console.log(`🛠️ 开发者 ${req.user.username} 绕过管理员权限检查`);
    return next();
  }

  const adminRoles = ['factory_super_admin', 'permission_admin'];
  
  if (!adminRoles.includes(req.user.roleCode)) {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限',
      errorCode: 'ADMIN_REQUIRED',
    });
  }

  next();
};

/**
 * 超级管理员权限中间件
 * 检查用户是否为超级管理员
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '用户未认证',
      errorCode: 'USER_NOT_AUTHENTICATED',
    });
  }

  // 开发者绕过超级管理员权限检查
  if (isDeveloper(req.user)) {
    console.log(`🛠️ 开发者 ${req.user.username} 绕过超级管理员权限检查`);
    return next();
  }

  if (req.user.roleCode !== 'factory_super_admin') {
    return res.status(403).json({
      success: false,
      message: '需要超级管理员权限',
      errorCode: 'SUPER_ADMIN_REQUIRED',
    });
  }

  next();
};

/**
 * 部门权限中间件
 * 检查用户是否属于指定部门
 */
export const requireDepartment = (allowedDepartments) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        errorCode: 'USER_NOT_AUTHENTICATED',
      });
    }

    // 开发者绕过部门权限检查
    if (isDeveloper(req.user)) {
      console.log(`🛠️ 开发者 ${req.user.username} 绕过部门权限检查: ${allowedDepartments.join(', ')}`);
      return next();
    }

    const userDepartment = req.user.department;
    
    if (!allowedDepartments.includes(userDepartment)) {
      return res.status(403).json({
        success: false,
        message: '部门权限不足',
        errorCode: 'DEPARTMENT_ACCESS_DENIED',
        allowedDepartments,
        userDepartment,
      });
    }

    next();
  };
};

/**
 * 可选认证中间件
 * 如果有令牌则验证，没有令牌则继续
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // 没有令牌，继续执行
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload.type === 'factory_user') {
      const session = await validateSession(token);
      if (session && session.user.isActive && session.user.factory.isActive) {
        req.user = session.user;
        req.factory = session.user.factory;
        req.session = session;
      }
    } else if (payload.type === 'platform_admin') {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: payload.adminId },
      });
      if (admin) {
        req.admin = admin;
      }
    }

    next();
  } catch (error) {
    // 令牌无效，但继续执行
    next();
  }
};

/**
 * 开发者或平台管理员权限中间件
 * 允许开发者访问平台管理功能
 */
export const requirePlatformAccess = (req, res, next) => {
  // 检查是否有平台管理员身份
  if (req.admin) {
    return next();
  }

  // 检查是否为开发者（通过工厂用户认证，但具有开发者权限）
  if (req.user && isDeveloper(req.user)) {
    console.log(`🛠️ 开发者 ${req.user.username} 获得平台管理访问权限`);
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '需要平台管理员权限或开发者权限',
    errorCode: 'PLATFORM_ACCESS_DENIED',
  });
};

/**
 * 开发者权限检查工具函数
 * 供其他模块使用
 */
export const checkDeveloperPermission = (user) => {
  return isDeveloper(user);
};