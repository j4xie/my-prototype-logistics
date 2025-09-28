import express from 'express';
import mobileAuth from '../middleware/mobileAuth.js';
import {
  clockIn,
  clockOut,
  breakStart,
  breakEnd,
  getClockStatus,
  getClockHistory
} from '../controllers/timeclockController.js';

const router = express.Router();

// 所有路由都需要移动端认证
router.use(mobileAuth);

// 打卡相关接口
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.post('/break-start', breakStart);
router.post('/break-end', breakEnd);

// 查询接口
router.get('/status', getClockStatus);
router.get('/history', getClockHistory);

export default router;