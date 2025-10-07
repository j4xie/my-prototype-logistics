/**
 * 供应商路由
 * /api/mobile/suppliers
 */

import express from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierStats
} from '../controllers/supplierController.js';

const router = express.Router();

// 获取所有供应商
router.get('/', getSuppliers);

// 获取单个供应商详情
router.get('/:id', getSupplierById);

// 获取供应商统计信息
router.get('/:id/stats', getSupplierStats);

// 创建供应商
router.post('/', createSupplier);

// 更新供应商
router.put('/:id', updateSupplier);

// 删除供应商（软删除）
router.delete('/:id', deleteSupplier);

export default router;
