/**
 * 工厂设置路由
 * 工厂超级管理员专用功能
 */

import express from 'express';
import mobileAuthMiddleware from '../middleware/mobileAuth.js';
import { PrismaClient } from '@prisma/client';
import { createSuccessResponse } from '../middleware/errorHandler.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * 权限检查：仅工厂超级管理员
 */
const requireSuperAdmin = (req, res, next) => {
  const roleCode = req.user?.factoryUser?.roleCode;

  if (roleCode !== 'factory_super_admin') {
  }

  next();
};

/**
 * 获取当前ISO周数和年份
 */
function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return { year, weekNumber };
}

// ==================== AI设置管理 ====================

/**
 * 获取AI设置（不含配额限制修改权限）
 * GET /api/mobile/factory-settings/ai
 * 工厂超级管理员查看AI配置
 */
router.get('/ai',
  mobileAuthMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const factoryId = req.user.factoryId;

      const factory = await prisma.factory.findUnique({
        where: { id: factoryId },
        select: {
          aiWeeklyQuota: true,  // 只读，用于显示
          settings: { select: { aiSettings: true } }
        }
      });

      const defaultSettings = {
        enabled: true,
        tone: 'professional',
        goal: 'cost_optimization',
        detailLevel: 'standard',
        industryStandards: {
          laborCostPercentage: 30,
          equipmentUtilization: 80,
          profitMargin: 20
        },
        customPrompt: ''
      };

      res.json(createSuccessResponse({
        settings: factory?.settings?.aiSettings || defaultSettings,
        weeklyQuota: factory?.aiWeeklyQuota || 20,  // 只读字段
        quotaEditable: false  // 标记：配额不可编辑
      }, '获取AI设置成功'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 更新AI设置（不含配额）
 * PUT /api/mobile/factory-settings/ai
 * 工厂超级管理员配置AI语气、目标等，但不能修改次数限制
 */
router.put('/ai',
  mobileAuthMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const factoryId = req.user.factoryId;
      const {
        enabled,
        tone,
        goal,
        detailLevel,
        industryStandards,
        customPrompt
      } = req.body;

      // ⚠️ 注意：不接受weeklyQuota参数（由平台管理员统一设置）

      // 验证参数
      const validTones = ['professional', 'friendly', 'concise'];
      const validGoals = ['cost_optimization', 'efficiency', 'profit'];
      const validDetailLevels = ['brief', 'standard', 'detailed'];

      if (tone && !validTones.includes(tone)) {
      }

      if (goal && !validGoals.includes(goal)) {
      }

      if (detailLevel && !validDetailLevels.includes(detailLevel)) {
      }

      const aiSettings = {
        enabled: enabled ?? true,
        tone: tone || 'professional',
        goal: goal || 'cost_optimization',
        detailLevel: detailLevel || 'standard',
        industryStandards: industryStandards || {
          laborCostPercentage: 30,
          equipmentUtilization: 80,
          profitMargin: 20
        },
        customPrompt: customPrompt || ''
      };

      await prisma.factorySettings.upsert({
        where: { factoryId },
        update: { aiSettings },
        create: {
          factoryId,
          aiSettings,
          allowSelfRegistration: false,
          requireAdminApproval: true,
          defaultUserRole: 'viewer'
        }
      });

      res.json(createSuccessResponse(aiSettings, '更新AI设置成功'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 获取本工厂AI使用统计
 * GET /api/mobile/factory-settings/ai/usage-stats
 * 工厂超级管理员查看本工厂的AI使用情况
 */
router.get('/ai/usage-stats',
  mobileAuthMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const factoryId = req.user.factoryId;
      const { period = 'week' } = req.query;
      const { year, weekNumber } = getCurrentWeek();

      const where = period === 'week'
        ? { factoryId, year, weekNumber }
        : { factoryId };

      const logs = await prisma.aiUsageLog.findMany({
        where,
        include: {
          user: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100  // 限制返回100条
      });

      const stats = {
        period: period === 'week' ? `${year}-W${weekNumber}` : 'all',
        totalCalls: logs.length,
        byType: {
          analysis: logs.filter(l => l.requestType === 'analysis').length,
          question: logs.filter(l => l.requestType === 'question').length
        },
        byUser: logs.reduce((acc, log) => {
          const name = log.user.fullName || '未知用户';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {}),
        recentLogs: logs.slice(0, 20).map(log => ({
          id: log.id,
          userName: log.user.fullName,
          requestType: log.requestType,
          question: log.question?.substring(0, 50),
          createdAt: log.createdAt
        }))
      };

      res.json(createSuccessResponse(stats, '获取使用统计成功'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
