import express from 'express';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import {
  getReportTemplates,
  generateExcelReport,
  generatePDFReport,
  downloadReport,
  createReportTemplate
} from '../controllers/reportController.js';

const router = express.Router();

// 所有路由都需要移动端认证
router.use(mobileAuthMiddleware);

// 报表模板管理
router.get('/templates', getReportTemplates);           // 获取报表模板列表
router.post('/templates', createReportTemplate);        // 创建自定义报表模板

// 报表生成
router.post('/generate/excel', generateExcelReport);    // 生成Excel报表
router.post('/generate/pdf', generatePDFReport);        // 生成PDF报表

// 报表下载
router.get('/download/:filename', downloadReport);      // 下载报表文件

export default router;