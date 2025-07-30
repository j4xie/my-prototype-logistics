/**
 * 用户管理路由
 * 支持多层级权限控制
 */

import express from 'express';
import { 
  authenticateUser, 
  authenticatePlatformAdmin 
} from '../middleware/auth.js';
import {
  requireFactoryPermission,
  requirePlatformPermission,
  requireDataAccess,
  requireDepartmentAccess,
  auditPermission,
  createPermissionChain
} from '../middleware/permissions.js';
import { validate } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * 获取用户列表
 * GET /api/users
 * 根据角色返回不同范围的用户
 */
router.get('/', 
  ...createPermissionChain({
    permission: 'view_user_reports',
    userType: 'factory',
    dataAccess: true,
    dataType: 'users',
    audit: true,
    action: 'view_users'
  }),
  asyncHandler(async (req, res) => {
    // 实现获取用户列表的逻辑
    // req.dataFilter 包含了根据权限生成的数据过滤条件
    res.json({ message: 'Get users with permission filtering' });
  })
);

/**
 * 获取待审核用户
 * GET /api/users/pending
 * 只有权限管理员和工厂超管可以访问
 */
router.get('/pending',
  authenticateUser,
  requireFactoryPermission('activate_users'),
  requireDataAccess('users'),
  auditPermission('view_pending_users'),
  asyncHandler(async (req, res) => {
    res.json({ message: 'Get pending users' });
  })
);

/**
 * 激活用户
 * PUT /api/users/:id/activate
 * 权限管理员和工厂超管功能
 */
router.put('/:id/activate',
  authenticateUser,
  requireFactoryPermission('activate_users'),
  auditPermission('activate_user', 'user_management'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    // 实现用户激活逻辑
    res.json({ message: `Activate user ${userId}` });
  })
);

/**
 * 分配角色
 * PUT /api/users/:id/role
 * 根据当前用户角色限制可分配的角色
 */
router.put('/:id/role',
  authenticateUser,
  requireFactoryPermission('assign_roles'),
  auditPermission('assign_role', 'user_management'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { roleCode, department } = req.body;
    
    // 这里需要实现角色分配的业务逻辑
    // 包括检查是否有权限分配特定角色
    
    res.json({ 
      message: `Assign role ${roleCode} to user ${userId}`,
      department 
    });
  })
);

/**
 * 删除用户
 * DELETE /api/users/:id
 * 只有工厂超管可以删除用户
 */
router.delete('/:id',
  authenticateUser,
  requireFactoryPermission('delete_users'),
  auditPermission('delete_user', 'user_management'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    res.json({ message: `Delete user ${userId}` });
  })
);

/**
 * 获取部门用户
 * GET /api/users/department/:department
 * 部门管理员只能查看本部门用户
 */
router.get('/department/:department',
  authenticateUser,
  requireFactoryPermission('view_department_data'),
  requireDepartmentAccess(),
  requireDataAccess('users'),
  auditPermission('view_department_users'),
  asyncHandler(async (req, res) => {
    const department = req.params.department;
    // req.dataFilter 会自动包含部门过滤条件
    res.json({ 
      message: `Get users from department ${department}`,
      filter: req.dataFilter 
    });
  })
);

/**
 * 用户统计信息
 * GET /api/users/stats
 * 根据权限返回不同级别的统计
 */
router.get('/stats',
  authenticateUser,
  requireFactoryPermission('view_user_reports'),
  requireDataAccess('users'),
  asyncHandler(async (req, res) => {
    const { userPermissions, dataFilter } = req;
    
    // 根据权限返回不同级别的统计信息
    const stats = {
      scope: userPermissions.dataAccess,
      filter: dataFilter,
      // 实际统计数据...
    };
    
    res.json(stats);
  })
);

export default router;