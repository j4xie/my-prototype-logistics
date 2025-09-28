import express from 'express';
import mobileAuth from '../middleware/mobileAuth.js';
import {
  getWorkTypes,
  createWorkType,
  updateWorkType,
  deleteWorkType,
  getWorkTypeById,
  initializeDefaultWorkTypes
} from '../controllers/workTypeController.js';

const router = express.Router();

// 所有路由都需要移动端认证
router.use(mobileAuth);

// 工作类型管理接口
router.get('/', getWorkTypes);
router.post('/', createWorkType);
router.get('/init-defaults', initializeDefaultWorkTypes);
router.get('/:id', getWorkTypeById);
router.put('/:id', updateWorkType);
router.delete('/:id', deleteWorkType);

export default router;