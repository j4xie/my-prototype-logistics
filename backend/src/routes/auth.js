import express from 'express';
import { 
  verifyPhone, 
  register, 
  login, 
  platformLogin, 
  logout, 
  getCurrentUser, 
  refreshToken, 
  changePassword, 
  checkAuthStatus 
} from '../controllers/authController.js';
import { 
  authenticateUser, 
  authenticatePlatformAdmin, 
  optionalAuth 
} from '../middleware/auth.js';
import {
  requirePlatformPermission,
  requireFactoryPermission,
  requireDataAccess,
  auditPermission,
  createPermissionChain
} from '../middleware/permissions.js';
import { validate } from '../middleware/validation.js';
import { authSchemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * 手机号验证
 * POST /api/auth/verify-phone
 * 验证手机号是否在白名单中且可以注册
 */
router.post('/verify-phone', 
  validate(authSchemas.phoneVerification),
  asyncHandler(verifyPhone)
);

/**
 * 用户注册
 * POST /api/auth/register
 * 完成用户注册，需要先通过手机验证
 */
router.post('/register', 
  validate(authSchemas.userRegistration),
  asyncHandler(register)
);

/**
 * 工厂用户登录
 * POST /api/auth/login
 * 支持多租户登录，检查激活状态
 */
router.post('/login', 
  validate(authSchemas.userLogin),
  asyncHandler(login)
);

/**
 * 平台管理员登录
 * POST /api/auth/platform-login
 * 平台管理员专用登录接口
 */
router.post('/platform-login', 
  validate(authSchemas.platformAdminLogin),
  auditPermission('platform_login', 'auth'),
  asyncHandler(platformLogin)
);

/**
 * 用户登出
 * POST /api/auth/logout
 * 撤销当前会话
 */
router.post('/logout', 
  authenticateUser,
  auditPermission('logout', 'auth'),
  asyncHandler(logout)
);

/**
 * 获取当前用户信息
 * GET /api/auth/me
 * 获取当前登录用户的详细信息
 */
router.get('/me', 
  authenticateUser,
  asyncHandler(getCurrentUser)
);

/**
 * 刷新令牌
 * POST /api/auth/refresh
 * 使用刷新令牌获取新的访问令牌
 */
router.post('/refresh', 
  validate(authSchemas.refreshToken),
  asyncHandler(refreshToken)
);

/**
 * 修改密码
 * PUT /api/auth/password
 * 修改当前用户密码
 */
router.put('/password', 
  authenticateUser,
  validate({
    body: authSchemas.userRegistration.body.pick({
      password: true,
    }).extend({
      oldPassword: authSchemas.userRegistration.body.shape.password,
      newPassword: authSchemas.userRegistration.body.shape.password,
    }),
  }),
  auditPermission('change_password', 'auth'),
  asyncHandler(changePassword)
);

/**
 * 检查认证状态
 * GET /api/auth/status
 * 检查当前用户的认证状态
 */
router.get('/status', 
  optionalAuth,
  asyncHandler(checkAuthStatus)
);

export default router;