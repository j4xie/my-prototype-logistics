import express from 'express';
import { 
  createFactory, 
  getFactories, 
  updateFactory, 
  toggleFactoryStatus,
  getFactoryStats,
  createSuperAdmin 
} from '../controllers/platformController.js';
import { 
  authenticatePlatformAdmin 
} from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { platformSchemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// 所有平台管理接口都需要平台管理员认证
router.use(authenticatePlatformAdmin);

/**
 * 创建工厂
 * POST /api/platform/factories
 * 平台管理员创建新工厂
 */
router.post('/factories', 
  validate(platformSchemas.createFactory),
  asyncHandler(createFactory)
);

/**
 * 获取工厂列表
 * GET /api/platform/factories
 * 分页获取所有工厂
 */
router.get('/factories', 
  validate(platformSchemas.getFactories),
  asyncHandler(getFactories)
);

/**
 * 获取工厂统计信息
 * GET /api/platform/factories/stats
 * 获取工厂统计数据
 */
router.get('/factories/stats', 
  asyncHandler(getFactoryStats)
);

/**
 * 更新工厂信息
 * PUT /api/platform/factories/:id
 * 平台管理员更新工厂信息
 */
router.put('/factories/:id', 
  validate(platformSchemas.updateFactory),
  asyncHandler(updateFactory)
);

/**
 * 启用/停用工厂
 * PUT /api/platform/factories/:id/status
 * 平台管理员启用或停用工厂
 */
router.put('/factories/:id/status', 
  validate(platformSchemas.toggleFactoryStatus),
  asyncHandler(toggleFactoryStatus)
);

/**
 * 创建工厂超级管理员
 * POST /api/platform/factories/:id/super-admin
 * 为工厂创建超级管理员账户
 */
router.post('/factories/:id/super-admin', 
  validate(platformSchemas.createSuperAdmin),
  asyncHandler(createSuperAdmin)
);

export default router;