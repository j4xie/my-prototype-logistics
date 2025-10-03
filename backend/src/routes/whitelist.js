import express from 'express';
import { z } from 'zod';
import { 
  addWhitelist, 
  getWhitelist, 
  updateWhitelist, 
  deleteWhitelist, 
  batchDeleteWhitelist, 
  getWhitelistStats,
  updateExpiredWhitelist 
} from '../controllers/whitelistController.js';
import { 
  authenticateUser, 
  requireAdmin 
} from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { whitelistSchemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// 所有白名单管理接口都需要用户认证和管理员权限
router.use(authenticateUser);
router.use(requireAdmin);

/**
 * 添加白名单
 * POST /api/whitelist
 * 管理员批量添加手机号到白名单
 */
router.post('/', 
  validate(whitelistSchemas.addWhitelist),
  asyncHandler(addWhitelist)
);

/**
 * 获取白名单列表
 * GET /api/whitelist
 * 分页获取工厂的白名单记录
 */
router.get('/', 
  validate(whitelistSchemas.getWhitelist),
  asyncHandler(getWhitelist)
);

/**
 * 获取白名单统计信息
 * GET /api/whitelist/stats
 * 获取工厂白名单的统计数据
 */
router.get('/stats', 
  asyncHandler(getWhitelistStats)
);

/**
 * 更新过期白名单
 * PUT /api/whitelist/expired
 * 自动处理过期的白名单记录
 */
router.put('/expired', 
  asyncHandler(updateExpiredWhitelist)
);

/**
 * 批量删除白名单
 * DELETE /api/whitelist/batch
 * 管理员批量删除白名单记录
 */
router.delete('/batch', 
  validate({
    body: {
      ids: z.array(z.string().transform(val => parseInt(val))).min(1, '请选择要删除的记录'),
    },
  }),
  asyncHandler(batchDeleteWhitelist)
);

/**
 * 更新白名单状态
 * PUT /api/whitelist/:id
 * 管理员手动更新白名单记录的状态
 */
router.put('/:id', 
  validate(whitelistSchemas.updateWhitelist),
  asyncHandler(updateWhitelist)
);

/**
 * 删除白名单记录
 * DELETE /api/whitelist/:id
 * 管理员删除白名单记录
 */
router.delete('/:id', 
  validate(whitelistSchemas.deleteWhitelist),
  asyncHandler(deleteWhitelist)
);

export default router;