import express from 'express';
import mobileAuth from '../middleware/mobileAuth.js';
import {
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getStatsByWorkType,
  getProductivityAnalysis
} from '../controllers/timeStatsController.js';

const router = express.Router();

// 所有路由都需要移动端认证
router.use(mobileAuth);

// 时间统计接口
router.get('/daily', getDailyStats);
router.get('/weekly', getWeeklyStats);
router.get('/monthly', getMonthlyStats);
router.get('/by-type', getStatsByWorkType);
router.get('/productivity', getProductivityAnalysis);

export default router;