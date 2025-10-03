import express from 'express';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import {
  generateActivationCode,
  validateActivationCode,
  activateDevice,
  getActivationRecords,
  getActivationStatistics,
  updateActivationCodeStatus
} from '../controllers/activationController.js';

const router = express.Router();

// 验证激活码（无需认证，用于设备首次激活）
router.post('/validate', validateActivationCode);
router.post('/activate', activateDevice);

// 以下路由需要移动端认证
router.use(mobileAuthMiddleware);

// 激活码管理（需要管理员权限）
router.post('/generate', generateActivationCode);              // 生成激活码
router.get('/records', getActivationRecords);                  // 查询激活记录
router.get('/statistics', getActivationStatistics);            // 获取激活统计
router.put('/codes/:id/status', updateActivationCodeStatus);   // 更新激活码状态

export default router;