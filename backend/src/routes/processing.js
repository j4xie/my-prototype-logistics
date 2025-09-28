import express from 'express';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  startProduction,
  completeProduction,
  pauseProduction,
  getBatchTimeline
} from '../controllers/processingController.js';
import {
  submitInspection,
  getInspections,
  getInspectionById,
  updateInspection,
  getQualityStatistics,
  getQualityTrends
} from '../controllers/qualityController.js';
import {
  getEquipmentMonitoring,
  getEquipmentMetrics,
  reportEquipmentData,
  getEquipmentAlerts,
  getEquipmentStatus
} from '../controllers/equipmentController.js';
import {
  getDashboardOverview,
  getProductionStatistics,
  getQualityDashboard,
  getEquipmentDashboard,
  getAlertsDashboard,
  getTrendAnalysis
} from '../controllers/dashboardController.js';
import {
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  getAlertStatistics,
  getAlertsSummary
} from '../controllers/alertController.js';

const router = express.Router();

// 所有路由都需要移动端认证
router.use(mobileAuthMiddleware);

// 批次CRUD操作
router.post('/batches', createBatch);                    // 创建新批次
router.get('/batches', getBatches);                      // 查询批次列表 (支持分页、过滤)
router.get('/batches/:id', getBatchById);                // 获取批次详情
router.put('/batches/:id', updateBatch);                 // 更新批次信息
router.delete('/batches/:id', deleteBatch);              // 删除批次

// 批次流程操作
router.post('/batches/:id/start', startProduction);     // 开始生产
router.post('/batches/:id/complete', completeProduction); // 完成生产
router.post('/batches/:id/pause', pauseProduction);     // 暂停生产
router.get('/batches/:id/timeline', getBatchTimeline);  // 获取批次时间线

// 质检记录管理API
router.post('/quality/inspections', submitInspection);             // 提交质检记录
router.get('/quality/inspections', getInspections);                // 查询质检记录 (分页、过滤)
router.get('/quality/inspections/:id', getInspectionById);         // 获取质检详情
router.put('/quality/inspections/:id', updateInspection);          // 更新质检结果
router.get('/quality/statistics', getQualityStatistics);           // 质检统计数据
router.get('/quality/trends', getQualityTrends);                   // 质量趋势分析

// 设备监控管理API
router.get('/equipment/monitoring', getEquipmentMonitoring);       // 获取设备实时状态列表
router.get('/equipment/:id/metrics', getEquipmentMetrics);         // 获取设备指标历史数据
router.post('/equipment/:id/data', reportEquipmentData);           // 上报设备监控数据
router.get('/equipment/alerts', getEquipmentAlerts);               // 获取设备告警列表
router.get('/equipment/:id/status', getEquipmentStatus);           // 获取单个设备状态

// 仪表板API
router.get('/dashboard/overview', getDashboardOverview);           // 生产概览数据
router.get('/dashboard/production', getProductionStatistics);      // 生产统计 (今日、本周、本月)
router.get('/dashboard/quality', getQualityDashboard);             // 质量统计和趋势
router.get('/dashboard/equipment', getEquipmentDashboard);         // 设备状态统计
router.get('/dashboard/alerts', getAlertsDashboard);               // 告警统计和分布
router.get('/dashboard/trends', getTrendAnalysis);                 // 关键指标趋势分析

// 告警管理API
router.get('/alerts', getAlerts);                                  // 获取告警列表 (分页、过滤、排序)
router.post('/alerts/:id/acknowledge', acknowledgeAlert);          // 确认告警
router.post('/alerts/:id/resolve', resolveAlert);                  // 解决告警
router.get('/alerts/statistics', getAlertStatistics);              // 告警统计数据
router.get('/alerts/summary', getAlertsSummary);                   // 告警摘要 (按严重级别)

export default router;