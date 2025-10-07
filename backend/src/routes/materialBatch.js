import express from 'express';
import {
  createMaterialBatch,
  getMaterialBatches,
  getAvailableBatches,
  reserveBatches,
  releaseBatches,
  consumeBatches,
  getMaterialBatchById,
  getExpiringBatches,
  getBatchesSummary,
} from '../controllers/materialBatchController.js';

const router = express.Router();

// 批次CRUD
router.post('/', createMaterialBatch);           // 创建批次（入库）
router.get('/', getMaterialBatches);             // 获取批次列表
router.get('/available', getAvailableBatches);   // 获取可用批次（含智能推荐）
router.get('/expiring', getExpiringBatches);     // 即将过期的批次
router.get('/summary', getBatchesSummary);       // 库存汇总
router.get('/:id', getMaterialBatchById);        // 批次详情

// 批次操作
router.post('/reserve', reserveBatches);         // 预留批次
router.post('/release', releaseBatches);         // 释放批次
router.post('/consume', consumeBatches);         // 消耗批次

export default router;
