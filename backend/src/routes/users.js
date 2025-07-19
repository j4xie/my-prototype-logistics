import express from 'express';
import { 
  activateUser, 
  getUsers, 
  getPendingUsers, 
  updateUser, 
  toggleUserStatus, 
  resetUserPassword, 
  getUserStats 
} from '../controllers/userController.js';
import { 
  authenticateUser, 
  requireAdmin, 
  requireSuperAdmin 
} from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { userSchemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// 所有用户管理接口都需要用户认证
router.use(authenticateUser);

/**
 * 获取用户列表
 * GET /api/users
 * 分页获取工厂的用户列表
 */
router.get('/', 
  requireAdmin,
  validate(userSchemas.getUsers),
  asyncHandler(getUsers)
);

/**
 * 获取待激活用户列表
 * GET /api/users/pending
 * 获取所有未激活的用户
 */
router.get('/pending', 
  requireAdmin,
  asyncHandler(getPendingUsers)
);

/**
 * 获取用户统计信息
 * GET /api/users/stats
 * 获取工厂用户的统计数据
 */
router.get('/stats', 
  requireAdmin,
  asyncHandler(getUserStats)
);

/**
 * 激活用户
 * POST /api/users/:userId/activate
 * 管理员激活用户并分配角色权限
 */
router.post('/:userId/activate', 
  requireAdmin,
  validate(userSchemas.activateUser),
  asyncHandler(activateUser)
);

/**
 * 更新用户信息
 * PUT /api/users/:userId
 * 管理员更新用户信息
 */
router.put('/:userId', 
  requireAdmin,
  validate(userSchemas.updateUser),
  asyncHandler(updateUser)
);

/**
 * 停用/启用用户
 * PUT /api/users/:userId/status
 * 管理员停用或启用用户
 */
router.put('/:userId/status', 
  requireAdmin,
  validate(userSchemas.toggleUserStatus),
  asyncHandler(toggleUserStatus)
);

/**
 * 重置用户密码
 * POST /api/users/:userId/reset-password
 * 管理员重置用户密码
 */
router.post('/:userId/reset-password', 
  requireAdmin,
  validate({
    params: userSchemas.updateUser.params,
  }),
  asyncHandler(resetUserPassword)
);

export default router;