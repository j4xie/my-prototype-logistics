/**
 * 平台管理路由
 * 平台管理员专用功能
 */

import express from 'express';
import { authenticatePlatformAdmin } from '../middleware/auth.js';
import {
  requirePlatformPermission,
  auditPermission,
  createPermissionChain
} from '../middleware/permissions.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getPlatformOverview,
  getFactories,
  createFactory,
  updateFactory,
  suspendFactory,
  activateFactory,
  deleteFactory,
  toggleFactoryStatus,
  getFactoryDetails,
  exportFactoriesData,
  exportUsersData,
  exportOverviewData,
  getOperationLogs,
  exportOperationLogs,
  getFactoryEmployees,
  updateEmployeeStatus,
  deleteEmployee,
  getPlatformWhitelists,
  batchImportWhitelists,
  updateWhitelistStatus,
  deletePlatformWhitelist,
  batchDeleteWhitelists,
  cleanupExpiredWhitelists
} from '../controllers/platformController.js';

const router = express.Router();

/**
 * 获取平台概览数据
 * GET /api/platform/overview
 * 平台管理员查看平台统计概览
 */
router.get('/overview',
  authenticatePlatformAdmin,
  requirePlatformPermission('view_platform_analytics'),
  auditPermission('view_platform_overview', 'platform_analytics'),
  asyncHandler(getPlatformOverview)
);

/**
 * 获取所有工厂列表
 * GET /api/platform/factories
 * 平台管理员查看所有工厂
 */
router.get('/factories',
  authenticatePlatformAdmin,
  requirePlatformPermission('view_factories'),
  auditPermission('view_all_factories', 'platform_management'),
  asyncHandler(getFactories)
);

/**
 * 创建新工厂
 * POST /api/platform/factories
 * 只有平台超级管理员可以创建工厂
 */
router.post('/factories',
  authenticatePlatformAdmin,
  requirePlatformPermission('create_factory'),
  auditPermission('create_factory', 'platform_management'),
  asyncHandler(createFactory)
);

/**
 * 删除工厂
 * DELETE /api/platform/factories/:id
 * 只有平台超级管理员可以删除工厂
 */
router.delete('/factories/:id',
  authenticatePlatformAdmin,
  requirePlatformPermission('delete_factory'),
  auditPermission('delete_factory', 'platform_management'),
  asyncHandler(async (req, res) => {
    const factoryId = req.params.id;
    
    // 实现工厂删除逻辑
    res.json({ 
      message: `Factory ${factoryId} deleted successfully`
    });
  })
);

/**
 * 工厂激活/停用
 * PUT /api/platform/factories/:id/status
 * 平台超级管理员功能
 */
router.put('/factories/:id/status',
  authenticatePlatformAdmin,
  requirePlatformPermission('factory_activation_control'),
  auditPermission('change_factory_status', 'platform_management'),
  asyncHandler(toggleFactoryStatus)
);

/**
 * 获取平台统计数据
 * GET /api/platform/analytics
 * 平台管理员查看平台级数据分析
 */
router.get('/analytics',
  authenticatePlatformAdmin,
  requirePlatformPermission('view_platform_analytics'),
  auditPermission('view_platform_analytics', 'platform_analytics'),
  asyncHandler(async (req, res) => {
    // 实现平台统计数据获取
    const analytics = {
      totalFactories: 0,
      activeFactories: 0,
      totalUsers: 0,
      activeUsers: 0,
      // 更多统计数据...
    };
    
    res.json(analytics);
  })
);

/**
 * 获取工厂详细信息
 * GET /api/platform/factories/:id
 * 平台管理员查看特定工厂详情
 */
router.get('/factories/:id',
  authenticatePlatformAdmin,
  requirePlatformPermission('view_factory_details'),
  auditPermission('view_factory_details', 'platform_management'),
  asyncHandler(getFactoryDetails)
);

/**
 * 导出工厂数据
 * GET /api/platform/export/factories
 * 导出所有工厂的详细数据为Excel/CSV
 */
router.get('/export/factories',
  authenticatePlatformAdmin,
  requirePlatformPermission('export_data'),
  auditPermission('export_factories_data', 'platform_management'),
  asyncHandler(exportFactoriesData)
);

/**
 * 导出用户统计数据
 * GET /api/platform/export/users
 * 导出用户统计报表
 */
router.get('/export/users',
  authenticatePlatformAdmin,
  requirePlatformPermission('export_data'),
  auditPermission('export_users_data', 'platform_management'),
  asyncHandler(exportUsersData)
);

/**
 * 导出平台概览数据
 * GET /api/platform/export/overview
 * 导出平台概览统计报表
 */
router.get('/export/overview',
  authenticatePlatformAdmin,
  requirePlatformPermission('export_data'),
  auditPermission('export_overview_data', 'platform_management'),
  asyncHandler(exportOverviewData)
);

/**
 * 系统维护模式
 * PUT /api/platform/maintenance
 * 只有平台超级管理员可以设置维护模式
 */
router.put('/maintenance',
  authenticatePlatformAdmin,
  requirePlatformPermission('system_maintenance'),
  auditPermission('set_maintenance_mode', 'platform_system'),
  asyncHandler(async (req, res) => {
    const { enabled, message } = req.body;
    
    // 实现系统维护模式设置
    res.json({ 
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      maintenanceMessage: message
    });
  })
);

/**
 * 全平台通知
 * POST /api/platform/notifications
 * 平台超级管理员发送全平台通知
 */
router.post('/notifications',
  authenticatePlatformAdmin,
  requirePlatformPermission('global_notifications'),
  auditPermission('send_global_notification', 'platform_communications'),
  asyncHandler(async (req, res) => {
    const { title, content, targetFactories, priority } = req.body;
    
    // 实现全平台通知发送
    res.json({ 
      message: 'Global notification sent',
      notification: { title, content, targetFactories, priority }
    });
  })
);

/**
 * 获取操作日志
 * GET /api/platform/logs
 * 平台管理员查看操作日志，支持复杂筛选
 */
router.get('/logs',
  authenticatePlatformAdmin,
  requirePlatformPermission('audit_all_logs'),
  auditPermission('view_operation_logs', 'platform_audit'),
  asyncHandler(getOperationLogs)
);

/**
 * 导出操作日志
 * GET /api/platform/export/logs
 * 导出操作日志数据
 */
router.get('/export/logs',
  authenticatePlatformAdmin,
  requirePlatformPermission('export_data'),
  auditPermission('export_operation_logs', 'platform_audit'),
  asyncHandler(exportOperationLogs)
);

/**
 * 平台审计日志 (保留旧端点兼容性)
 * GET /api/platform/audit-logs
 * 平台管理员查看审计日志
 */
router.get('/audit-logs',
  authenticatePlatformAdmin,
  requirePlatformPermission('audit_all_logs'),
  asyncHandler(getOperationLogs)
);

/**
 * 更新工厂信息
 * PUT /api/platform/factories/:id
 * 平台管理员更新工厂基本信息
 */
router.put('/factories/:id',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_all_factories'),
  auditPermission('update_factory', 'platform_management'),
  asyncHandler(updateFactory)
);

/**
 * 暂停工厂
 * PUT /api/platform/factories/:id/suspend
 * 平台管理员暂停工厂运营，禁止所有员工登录
 */
router.put('/factories/:id/suspend',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_all_factories'),
  auditPermission('suspend_factory', 'platform_management'),
  asyncHandler(suspendFactory)
);

/**
 * 激活工厂
 * PUT /api/platform/factories/:id/activate
 * 平台管理员激活工厂运营，恢复员工登录
 */
router.put('/factories/:id/activate',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_all_factories'),
  auditPermission('activate_factory', 'platform_management'),
  asyncHandler(activateFactory)
);

/**
 * 删除工厂
 * DELETE /api/platform/factories/:id
 * 平台管理员删除工厂（需要密码验证）
 */
router.delete('/factories/:id',
  authenticatePlatformAdmin,
  requirePlatformPermission('delete_factories'),
  auditPermission('delete_factory', 'platform_management'),
  asyncHandler(deleteFactory)
);

/**
 * ============ 员工管理路由 ============
 */

/**
 * 获取指定工厂的员工列表
 * GET /api/platform/factories/:factoryId/employees
 * 平台管理员查看工厂员工
 */
router.get('/factories/:factoryId/employees',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_factory_users'),
  auditPermission('view_factory_employees', 'platform_management'),
  asyncHandler(getFactoryEmployees)
);

/**
 * 更新员工状态
 * PUT /api/platform/factories/:factoryId/employees/:employeeId/status
 * 平台管理员激活/暂停员工
 */
router.put('/factories/:factoryId/employees/:employeeId/status',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_factory_users'),
  auditPermission('update_employee_status', 'platform_management'),
  asyncHandler(updateEmployeeStatus)
);

/**
 * 删除员工
 * DELETE /api/platform/factories/:factoryId/employees/:employeeId
 * 平台管理员删除员工
 */
router.delete('/factories/:factoryId/employees/:employeeId',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_factory_users'),
  auditPermission('delete_employee', 'platform_management'),
  asyncHandler(deleteEmployee)
);

/**
 * ============ 白名单管理路由 ============
 */

/**
 * 获取平台白名单列表
 * GET /api/platform/whitelists
 * 平台管理员查看所有工厂的白名单
 */
router.get('/whitelists',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('view_platform_whitelists', 'platform_management'),
  asyncHandler(getPlatformWhitelists)
);

/**
 * 批量导入白名单
 * POST /api/platform/whitelists/batch-import
 * 平台管理员批量导入白名单记录
 */
router.post('/whitelists/batch-import',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('batch_import_whitelists', 'platform_management'),
  asyncHandler(batchImportWhitelists)
);

/**
 * 更新白名单状态
 * PUT /api/platform/whitelists/:whitelistId/status
 * 平台管理员更新白名单记录状态
 */
router.put('/whitelists/:whitelistId/status',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('update_whitelist_status', 'platform_management'),
  asyncHandler(updateWhitelistStatus)
);

/**
 * 删除白名单记录
 * DELETE /api/platform/whitelists/:whitelistId
 * 平台管理员删除白名单记录
 */
router.delete('/whitelists/:whitelistId',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('delete_whitelist', 'platform_management'),
  asyncHandler(deletePlatformWhitelist)
);

/**
 * 批量删除白名单记录
 * POST /api/platform/whitelists/batch-delete
 * 平台管理员批量删除白名单记录
 */
router.post('/whitelists/batch-delete',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('batch_delete_whitelists', 'platform_management'),
  asyncHandler(batchDeleteWhitelists)
);

/**
 * 清理过期白名单记录
 * POST /api/platform/whitelists/cleanup-expired
 * 清理所有过期的白名单记录
 */
router.post('/whitelists/cleanup-expired',
  authenticatePlatformAdmin,
  requirePlatformPermission('manage_whitelist'),
  auditPermission('cleanup_expired_whitelists', 'platform_management'),
  asyncHandler(cleanupExpiredWhitelists)
);

export default router;