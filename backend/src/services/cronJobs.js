/**
 * 定时任务服务
 * 处理系统定期执行的任务
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger.js';

const prisma = new PrismaClient();
const logger = createLogger('CronJobs');

/**
 * 清理过期白名单记录
 * 每天凌晨2点执行
 */
const cleanupExpiredWhitelists = async () => {
  try {
    logger.info('开始清理过期白名单记录...');
    
    const now = new Date();
    
    // 1. 将已过期但状态仍为PENDING的记录标记为EXPIRED
    const expiredPendingResult = await prisma.userWhitelist.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now
        }
      },
      data: {
        status: 'EXPIRED',
        updatedAt: now
      }
    });
    
    logger.info(`已将 ${expiredPendingResult.count} 条过期的PENDING记录标记为EXPIRED`);
    
    // 2. 删除过期超过30天的记录（给予一定的恢复期）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const deletedResult = await prisma.userWhitelist.deleteMany({
      where: {
        status: 'EXPIRED',
        expiresAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    
    logger.info(`已删除 ${deletedResult.count} 条过期超过30天的白名单记录`);
    
    // 3. 记录操作日志
    await prisma.permissionAuditLog.create({
      data: {
        actorType: 'system',
        actorId: 0,
        username: 'system-cron',
        action: 'cleanup_expired_whitelists',
        resource: 'whitelist',
        targetResourceId: `expired:${expiredPendingResult.count},deleted:${deletedResult.count}`,
        result: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'CronJob/1.0',
        timestamp: now
      }
    });
    
    logger.info('过期白名单清理任务完成');
    
  } catch (error) {
    logger.error('清理过期白名单时发生错误:', error);
    
    // 记录错误日志
    await prisma.permissionAuditLog.create({
      data: {
        actorType: 'system',
        actorId: 0,
        username: 'system-cron',
        action: 'cleanup_expired_whitelists',
        resource: 'whitelist',
        targetResourceId: null,
        result: 'failure',
        errorMessage: error.message.substring(0, 500), // 限制错误消息长度
        ipAddress: '127.0.0.1',
        userAgent: 'CronJob/1.0',
        timestamp: new Date()
      }
    }).catch(err => {
      logger.error('记录错误日志失败:', err);
    });
  }
};

/**
 * 清理过期会话
 * 每小时执行一次
 */
const cleanupExpiredSessions = async () => {
  try {
    logger.info('开始清理过期会话...');
    
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    logger.info(`已清理 ${result.count} 个过期会话`);
    
  } catch (error) {
    logger.error('清理过期会话时发生错误:', error);
  }
};

/**
 * 更新工厂活跃状态
 * 每天凌晨3点执行
 */
const updateFactoryActiveStatus = async () => {
  try {
    logger.info('开始更新工厂活跃状态...');
    
    // 获取最近30天内有用户登录的工厂ID
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeFactoryIds = await prisma.user.groupBy({
      by: ['factoryId'],
      where: {
        lastLogin: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        id: true
      }
    });
    
    const activeIds = activeFactoryIds.map(f => f.factoryId);
    
    // 更新工厂的最后活跃时间
    for (const factoryId of activeIds) {
      const lastActiveUser = await prisma.user.findFirst({
        where: { factoryId },
        orderBy: { lastLogin: 'desc' },
        select: { lastLogin: true }
      });
      
      if (lastActiveUser?.lastLogin) {
        await prisma.factory.update({
          where: { id: factoryId },
          data: { 
            updatedAt: lastActiveUser.lastLogin
          }
        });
      }
    }
    
    logger.info(`已更新 ${activeIds.length} 个工厂的活跃状态`);
    
  } catch (error) {
    logger.error('更新工厂活跃状态时发生错误:', error);
  }
};

/**
 * 生成平台统计报告
 * 每周一早上8点执行
 */
const generateWeeklyReport = async () => {
  try {
    logger.info('开始生成周报...');
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 统计本周数据
    const [
      newFactories,
      newUsers,
      newWhitelists,
      totalLogins
    ] = await Promise.all([
      prisma.factory.count({
        where: { createdAt: { gte: oneWeekAgo } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: oneWeekAgo } }
      }),
      prisma.userWhitelist.count({
        where: { createdAt: { gte: oneWeekAgo } }
      }),
      prisma.session.count({
        where: { createdAt: { gte: oneWeekAgo } }
      })
    ]);
    
    const report = {
      period: {
        start: oneWeekAgo.toISOString(),
        end: new Date().toISOString()
      },
      statistics: {
        newFactories,
        newUsers,
        newWhitelists,
        totalLogins
      },
      generatedAt: new Date().toISOString()
    };
    
    // 这里可以将报告发送到邮件或存储到数据库
    logger.info('周报生成完成:', report);
    
  } catch (error) {
    logger.error('生成周报时发生错误:', error);
  }
};

/**
 * 初始化所有定时任务
 */
export const initCronJobs = () => {
  logger.info('初始化定时任务...');
  
  // 每天凌晨2点清理过期白名单
  cron.schedule('0 2 * * *', cleanupExpiredWhitelists, {
    timezone: 'Asia/Shanghai'
  });
  
  // 每小时清理过期会话
  cron.schedule('0 * * * *', cleanupExpiredSessions);
  
  // 每天凌晨3点更新工厂活跃状态
  cron.schedule('0 3 * * *', updateFactoryActiveStatus, {
    timezone: 'Asia/Shanghai'
  });
  
  // 每周一早上8点生成周报
  cron.schedule('0 8 * * 1', generateWeeklyReport, {
    timezone: 'Asia/Shanghai'
  });
  
  logger.info('定时任务初始化完成');
  
  // 可以立即执行一次清理任务（用于测试）
  if (process.env.NODE_ENV === 'development') {
    logger.info('开发环境：立即执行一次清理任务');
    cleanupExpiredWhitelists();
  }
};

// 导出单个任务函数，以便手动调用或测试
export {
  cleanupExpiredWhitelists,
  cleanupExpiredSessions,
  updateFactoryActiveStatus,
  generateWeeklyReport
};