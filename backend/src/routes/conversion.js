import express from 'express';
import {
  getConversionRates,
  getConversionMatrix,
  upsertConversionRate,
  deleteConversionRate,
  estimateMaterialUsage,
} from '../controllers/conversionController.js';

const router = express.Router();

// 转换率管理路由
router.get('/', getConversionRates);              // 获取转换率列表
router.get('/matrix', getConversionMatrix);       // 获取转换率矩阵
router.post('/', upsertConversionRate);           // 创建/更新转换率
router.delete('/:id', deleteConversionRate);      // 删除转换率
router.post('/estimate', estimateMaterialUsage);  // 预估原料用量

export default router;
