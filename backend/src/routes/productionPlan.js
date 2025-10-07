import express from 'express';
import {
  getProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  updateProductionPlan,
  startProduction,
  completeProduction,
  consumeMaterial,
  getAvailableStock,
  createShipment,
  getShipments,
} from '../controllers/productionPlanController.js';

const router = express.Router();

// 生产计划管理路由
router.get('/', getProductionPlans);                          // 获取生产计划列表
router.get('/available-stock', getAvailableStock);            // 获取可用库存
router.get('/:id', getProductionPlanById);                    // 获取生产计划详情
router.post('/', createProductionPlan);                       // 创建生产计划
router.put('/:id', updateProductionPlan);                     // 更新生产计划

// 生产流程控制
router.post('/:id/start', startProduction);                   // 开始生产
router.post('/:id/complete', completeProduction);             // 完成生产
router.post('/:id/consume-material', consumeMaterial);        // 记录原料消耗
router.post('/:id/ship', createShipment);                     // 记录成品出库

// 出库记录
router.get('/shipments/list', getShipments);                  // 获取出库记录列表

export default router;
