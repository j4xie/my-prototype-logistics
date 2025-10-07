import express from 'express';
import {
  getProductTypes,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
} from '../controllers/productTypeController.js';

const router = express.Router();

// 产品类型管理路由
router.get('/types', getProductTypes);          // 获取产品类型列表
router.get('/types/:id', getProductTypeById);   // 获取产品类型详情
router.post('/types', createProductType);       // 创建产品类型
router.put('/types/:id', updateProductType);    // 更新产品类型
router.delete('/types/:id', deleteProductType); // 删除产品类型

export default router;
