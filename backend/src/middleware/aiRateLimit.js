import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
/**
 * 获取当前ISO周数和年份
 */
function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();

  // ISO 8601周数计算
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  return { year, weekNumber };
}

/**
 * 获取下周一日期（用于显示重置时间）
 */
function getNextMonday() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  return nextMonday.toISOString();
}

/**
 * AI使用量限制中间件（按周计算）
 */
export const aiRateLimitMiddleware = async (req, res, next) => {
  try {
    const factoryId = req.user.factoryId;
    const userId = req.user.id;

    // 1. 获取工厂AI配置
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId },
      select: {
        aiWeeklyQuota: true,
        settings: { select: { aiSettings: true } }
      }
    });

    if (!factory) {
      throw new Error('工厂不存在', 404);
    }

    const aiSettings = factory.settings?.aiSettings || {};

    // 2. 检查AI是否启用
    if (aiSettings.enabled === false) {
      throw new Error('AI分析功能已被工厂管理员禁用', 403);
    }

    // 3. 获取当前周数
    const { year, weekNumber } = getCurrentWeek();

    // 4. 统计本周使用量
    const weeklyCount = await prisma.aiUsageLog.count({
      where: {
        factoryId,
        year,
        weekNumber
      }
    });

    // 5. 检查是否超限
    const weeklyQuota = factory.aiWeeklyQuota || 20;

    if (weeklyCount >= weeklyQuota) {
      throw new Error(
        `本周AI分析次数已达上限（${weeklyQuota}次），请下周一再试`,
        429
      );
    }

    // 6. 将配额信息附加到req
    req.aiQuota = {
      used: weeklyCount,
      limit: weeklyQuota,
      remaining: weeklyQuota - weeklyCount,
      period: 'weekly',
      resetDate: getNextMonday()
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 记录AI使用日志（包含周数）
 */
export const logAIUsage = async (params) => {
  const { factoryId, userId, batchId, requestType, question, responseLength, sessionId } = params;
  const { year, weekNumber } = getCurrentWeek();

  try {
    await prisma.aiUsageLog.create({
      data: {
        factoryId,
        userId,
        batchId,
        requestType,
        question,
        responseLength,
        sessionId,
        year,
        weekNumber
      }
    });
  } catch (error) {
    console.error('记录AI使用日志失败:', error);
    // 不影响主流程，静默失败
  }
};
