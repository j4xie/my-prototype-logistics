/**
 * 客户路由
 * /api/mobile/customers
 */

import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats
} from '../controllers/customerController.js';

const router = express.Router();

// 获取所有客户
router.get('/', getCustomers);

// 获取单个客户详情
router.get('/:id', getCustomerById);

// 获取客户统计信息
router.get('/:id/stats', getCustomerStats);

// 创建客户
router.post('/', createCustomer);

// 更新客户
router.put('/:id', updateCustomer);

// 删除客户（软删除）
router.delete('/:id', deleteCustomer);

export default router;
