/**
 * 优化后的权限中间件
 * 统一的权限检查和数据访问控制
 */

import { 
  calculateUserPermissions, 
  hasPermission, 
  generateDataFilter,
  canAccessDepartment 
} from '../config/permissions.js';

/**
 * 平台管理员权限检查中间件
 */
export const requirePlatformPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { admin } = req;
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: '需要平台管理员权限',
          errorCode: 'PLATFORM_AUTH_REQUIRED'
        });
      }
      
      const userPermissions = calculateUserPermissions('platform_admin', admin.role);
      
      if (!hasPermission(userPermissions, requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: '平台权限不足',
          errorCode: 'INSUFFICIENT_PLATFORM_PERMISSION',
          required: requiredPermission,
          userRole: admin.role,
          userPermissions: userPermissions.permissions
        });
      }
      
      // 将权限信息附加到请求对象
      req.userPermissions = userPermissions;
      req.userType = 'platform_admin';
      
      next();
    } catch (error) {
      console.error('平台权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        errorCode: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * 工厂用户权限检查中间件
 */
export const requireFactoryPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { user } = req;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '需要工厂用户权限',
          errorCode: 'FACTORY_AUTH_REQUIRED'
        });
      }
      
      const userPermissions = calculateUserPermissions('factory_user', user.roleCode, user.department);
      
      if (!hasPermission(userPermissions, requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: '工厂权限不足',
          errorCode: 'INSUFFICIENT_FACTORY_PERMISSION',
          required: requiredPermission,
          userRole: user.roleCode,
          department: user.department,
          userPermissions: userPermissions.permissions
        });
      }
      
      // 将权限信息附加到请求对象
      req.userPermissions = userPermissions;
      req.userType = 'factory_user';
      
      next();
    } catch (error) {
      console.error('工厂权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        errorCode: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * 混合权限检查中间件（平台管理员或工厂用户）
 */
export const requireAnyPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { admin, user } = req;
      
      let userPermissions = null;
      let userType = null;
      
      // 优先检查平台管理员权限
      if (admin) {
        userPermissions = calculateUserPermissions('platform_admin', admin.role);
        userType = 'platform_admin';
      } else if (user) {
        userPermissions = calculateUserPermissions('factory_user', user.roleCode, user.department);
        userType = 'factory_user';
      }
      
      if (!userPermissions) {
        return res.status(401).json({
          success: false,
          message: '需要用户认证',
          errorCode: 'AUTH_REQUIRED'
        });
      }
      
      if (!hasPermission(userPermissions, requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: '权限不足',
          errorCode: 'INSUFFICIENT_PERMISSION',
          required: requiredPermission,
          userType,
          userRole: admin?.role || user?.roleCode,
          userPermissions: userPermissions.permissions
        });
      }
      
      // 将权限信息附加到请求对象
      req.userPermissions = userPermissions;
      req.userType = userType;
      
      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        errorCode: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * 数据访问控制中间件
 */
export const requireDataAccess = (dataType = null) => {
  return async (req, res, next) => {
    try {
      const { admin, user, userPermissions } = req;
      
      if (!userPermissions) {
        return res.status(401).json({
          success: false,
          message: '未进行权限检查',
          errorCode: 'PERMISSION_CHECK_MISSING'
        });
      }
      
      // 生成数据过滤器
      const currentUser = admin || user;
      const dataFilter = generateDataFilter({
        id: currentUser.id,
        type: req.userType,
        role: currentUser.role || currentUser.roleCode,
        factoryId: currentUser.factoryId || null,
        department: currentUser.department || null
      });
      
      // 将数据过滤器附加到请求对象
      req.dataFilter = dataFilter;
      req.dataType = dataType;
      
      // 如果指定了数据类型，检查是否有访问权限
      if (dataType && userPermissions.dataTypes) {
        if (!userPermissions.dataTypes.includes(dataType)) {
          return res.status(403).json({
            success: false,
            message: '无权访问此类型数据',
            errorCode: 'DATA_TYPE_ACCESS_DENIED',
            dataType,
            allowedTypes: userPermissions.dataTypes
          });
        }
      }
      
      next();
    } catch (error) {
      console.error('数据访问控制失败:', error);
      return res.status(500).json({
        success: false,
        message: '数据访问控制失败',
        errorCode: 'DATA_ACCESS_ERROR'
      });
    }
  };
};

/**
 * 部门访问权限检查中间件
 */
export const requireDepartmentAccess = (targetDepartment = null) => {
  return async (req, res, next) => {
    try {
      const { user, admin } = req;
      
      // 平台管理员可以访问所有部门
      if (admin) {
        return next();
      }
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '需要用户认证',
          errorCode: 'AUTH_REQUIRED'
        });
      }
      
      // 从请求参数中获取目标部门（如果没有指定）
      const department = targetDepartment || req.params.department || req.body.department;
      
      if (department && !canAccessDepartment(user, department)) {
        return res.status(403).json({
          success: false,
          message: '无权访问此部门数据',
          errorCode: 'DEPARTMENT_ACCESS_DENIED',
          userDepartment: user.department,
          targetDepartment: department
        });
      }
      
      req.targetDepartment = department;
      next();
    } catch (error) {
      console.error('部门访问检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '部门访问检查失败',
        errorCode: 'DEPARTMENT_ACCESS_ERROR'
      });
    }
  };
};

/**
 * 操作权限检查中间件
 */
export const requireOperation = (operation) => {
  return async (req, res, next) => {
    try {
      const { userPermissions } = req;
      
      if (!userPermissions) {
        return res.status(401).json({
          success: false,
          message: '未进行权限检查',
          errorCode: 'PERMISSION_CHECK_MISSING'
        });
      }
      
      // 检查是否允许此操作
      const accessRule = userPermissions.dataAccess;
      if (accessRule && accessRule.operations) {
        if (!accessRule.operations.includes(operation)) {
          return res.status(403).json({
            success: false,
            message: '不允许此操作',
            errorCode: 'OPERATION_NOT_ALLOWED',
            operation,
            allowedOperations: accessRule.operations
          });
        }
      }
      
      req.operation = operation;
      next();
    } catch (error) {
      console.error('操作权限检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '操作权限检查失败',
        errorCode: 'OPERATION_CHECK_ERROR'
      });
    }
  };
};

/**
 * 资源所有权检查中间件
 */
export const requireResourceOwnership = (resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const { user, admin } = req;
      const resourceId = req.params[resourceIdParam];
      
      // 平台管理员和工厂超管跳过所有权检查
      if (admin || (user && user.roleCode === 'factory_super_admin')) {
        return next();
      }
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '需要用户认证',
          errorCode: 'AUTH_REQUIRED'
        });
      }
      
      // 这里需要根据具体业务逻辑检查资源所有权
      // 例如：检查记录是否属于当前用户或其部门
      req.resourceId = resourceId;
      req.requireOwnershipCheck = true;
      
      next();
    } catch (error) {
      console.error('资源所有权检查失败:', error);
      return res.status(500).json({
        success: false,
        message: '资源所有权检查失败',
        errorCode: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

/**
 * 权限审计日志中间件
 */
export const auditPermission = (action, resource = null) => {
  return async (req, res, next) => {
    try {
      const { admin, user, userType } = req;
      const actor = admin || user;
      
      if (actor) {
        // 记录权限使用日志
        const auditLog = {
          timestamp: new Date(),
          actorType: userType,
          actorId: actor.id,
          username: actor.username,
          action,
          resource: resource || req.route?.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          factoryId: actor.factoryId || null,
          department: actor.department || null
        };
        
        // 这里应该保存到审计日志表
        console.log('权限审计:', auditLog);
        
        // 将审计信息附加到请求对象，供后续使用
        req.auditLog = auditLog;
      }
      
      next();
    } catch (error) {
      console.error('权限审计失败:', error);
      // 审计失败不应阻止请求继续
      next();
    }
  };
};

/**
 * 组合中间件工厂函数
 */
export const createPermissionChain = (config) => {
  const middlewares = [];
  
  // 权限检查
  if (config.permission) {
    if (config.userType === 'platform') {
      middlewares.push(requirePlatformPermission(config.permission));
    } else if (config.userType === 'factory') {
      middlewares.push(requireFactoryPermission(config.permission));
    } else {
      middlewares.push(requireAnyPermission(config.permission));
    }
  }
  
  // 数据访问控制
  if (config.dataAccess) {
    middlewares.push(requireDataAccess(config.dataType));
  }
  
  // 部门访问控制
  if (config.department) {
    middlewares.push(requireDepartmentAccess(config.department));
  }
  
  // 操作权限
  if (config.operation) {
    middlewares.push(requireOperation(config.operation));
  }
  
  // 资源所有权
  if (config.ownership) {
    middlewares.push(requireResourceOwnership(config.resourceIdParam));
  }
  
  // 审计日志
  if (config.audit) {
    middlewares.push(auditPermission(config.action, config.resource));
  }
  
  return middlewares;
};

export default {
  requirePlatformPermission,
  requireFactoryPermission,
  requireAnyPermission,
  requireDataAccess,
  requireDepartmentAccess,
  requireOperation,
  requireResourceOwnership,
  auditPermission,
  createPermissionChain
};