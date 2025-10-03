import express from 'express';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import {
  createSystemLog,
  getSystemLogs,
  getApiAccessLogs,
  getSystemPerformance,
  getSystemHealth,
  cleanupLogs,
  getSystemStatistics
} from '../controllers/systemController.js';

const router = express.Router();

// 系统健康检查（无需认证）
router.get('/health', getSystemHealth);

// 以下路由需要移动端认证
router.use(mobileAuthMiddleware);

// 系统日志管理
router.post('/logs', createSystemLog);                  // 记录系统日志
router.get('/logs', getSystemLogs);                     // 获取系统日志列表
router.get('/api-logs', getApiAccessLogs);              // 获取API访问日志

// 系统监控
router.get('/performance', getSystemPerformance);       // 系统性能监控
router.get('/statistics', getSystemStatistics);         // 系统统计概览

// 系统维护（需要管理员权限）
router.post('/cleanup-logs', cleanupLogs);              // 清理过期日志

export default router;