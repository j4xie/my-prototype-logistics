import express from 'express';
import { analyzeFoodProcessing } from '../controllers/aiAnalysisController.js';

const router = express.Router();

/**
 * AI食品加工数据分析路由
 */

// POST /api/mobile/ai/food-processing-analysis
router.post('/food-processing-analysis', analyzeFoodProcessing);

export default router;
