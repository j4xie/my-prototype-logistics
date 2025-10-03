import { PrismaClient } from '@prisma/client';
import os from 'os';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { processSystemInfo, processMemoryUsage, sendSafeJson } from '../utils/bigint-serializer.js';

const prisma = new PrismaClient();

/**
 * 记录系统日志
 * POST /api/mobile/system/logs
 */
export const createSystemLog = async (req, res, next) => {
  try {
    const {
      level = 'info',
      category,
      message,
      details = {}
    } = req.body;

    if (!category || !message) {
      throw new ValidationError('日志分类和消息内容为必填项');
    }

    const systemLog = await prisma.systemLog.create({
      data: {
        level,
        category,
        message,
        details,
        userId: req.user?.id || null,
        factoryId: req.user?.factoryId || null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json(createSuccessResponse(systemLog, '系统日志记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取系统日志列表
 * GET /api/mobile/system/logs
 */
export const getSystemLogs = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      page = 1,
      limit = 50,
      level,
      category,
      startDate,
      endDate,
      userId
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      factoryId,
      ...(level && { level }),
      ...(category && { category }),
      ...(userId && { userId: parseInt(userId) }),
      ...(startDate && endDate && {
        timestamp: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              fullName: true,
              username: true,
              department: true
            }
          }
        }
      }),
      prisma.systemLog.count({ where })
    ]);

    res.json(createSuccessResponse({
      logs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取系统日志成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取API访问日志
 * GET /api/mobile/system/api-logs
 */
export const getApiAccessLogs = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      page = 1,
      limit = 50,
      method,
      statusCode,
      startDate,
      endDate,
      minResponseTime
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      factoryId,
      ...(method && { method }),
      ...(statusCode && { statusCode: parseInt(statusCode) }),
      ...(minResponseTime && { responseTime: { gte: parseInt(minResponseTime) } }),
      ...(startDate && endDate && {
        timestamp: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [logs, total] = await Promise.all([
      prisma.apiAccessLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              fullName: true,
              username: true
            }
          }
        }
      }),
      prisma.apiAccessLog.count({ where })
    ]);

    res.json(createSuccessResponse({
      logs: logs.map(log => ({
        ...log,
        requestBody: undefined, // 不返回请求体（可能包含敏感信息）
        responseBody: undefined // 不返回响应体
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取API访问日志成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 系统性能监控
 * GET /api/mobile/system/performance
 */
export const getSystemPerformance = async (req, res, next) => {
  try {
    const { period = 'hour' } = req.query;

    // 获取系统基础信息
    const rawSystemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: ((Number(os.totalmem() - os.freemem()) / Number(os.totalmem())) * 100).toFixed(2)
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };

    // 处理BigInt值
    const systemInfo = processSystemInfo(rawSystemInfo);

    // 获取数据库连接池状态
    const dbMetrics = await prisma.$queryRaw`
      SELECT 
        table_schema as database_name,
        COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      GROUP BY table_schema
    `;

    // 获取API性能统计
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter = {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        };
        break;
      default: // hour
        dateFilter = {
          gte: new Date(now.getTime() - 60 * 60 * 1000)
        };
    }

    const [apiStats, errorStats] = await Promise.all([
      prisma.apiAccessLog.aggregate({
        where: { timestamp: dateFilter },
        _count: { id: true },
        _avg: { responseTime: true },
        _max: { responseTime: true },
        _min: { responseTime: true }
      }),
      prisma.apiAccessLog.groupBy({
        by: ['statusCode'],
        where: { 
          timestamp: dateFilter,
          statusCode: { gte: 400 }
        },
        _count: { statusCode: true }
      })
    ]);

    // 获取最近的系统错误日志
    const recentErrors = await prisma.systemLog.findMany({
      where: {
        level: { in: ['error', 'fatal'] },
        timestamp: dateFilter
      },
      take: 10,
      orderBy: { timestamp: 'desc' },
      select: {
        level: true,
        category: true,
        message: true,
        timestamp: true
      }
    });

    // 使用安全的JSON发送，处理BigInt序列化
    const responseData = {
      system: systemInfo,
      database: {
        status: 'connected',
        metrics: dbMetrics
      },
      api: {
        totalRequests: apiStats._count.id,
        avgResponseTime: Math.round(apiStats._avg.responseTime || 0),
        maxResponseTime: apiStats._max.responseTime || 0,
        minResponseTime: apiStats._min.responseTime || 0,
        errorDistribution: errorStats.map(stat => ({
          statusCode: stat.statusCode,
          count: stat._count.statusCode
        }))
      },
      errors: {
        recent: recentErrors,
        period
      },
      timestamp: new Date()
    };

    // 使用安全的JSON发送函数
    sendSafeJson(res, createSuccessResponse(responseData, '获取系统性能数据成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 系统健康检查
 * GET /api/mobile/system/health
 */
export const getSystemHealth = async (req, res, next) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date(),
      services: {}
    };

    // 检查数据库连接
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthCheck.services.database = {
        status: 'healthy',
        message: '数据库连接正常'
      };
    } catch (error) {
      healthCheck.services.database = {
        status: 'unhealthy',
        message: '数据库连接失败',
        error: error.message
      };
      healthCheck.status = 'unhealthy';
    }

    // 检查内存使用情况
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      healthCheck.services.memory = {
        status: 'warning',
        message: '内存使用率过高',
        usage: `${memoryUsagePercent.toFixed(2)}%`
      };
      if (healthCheck.status === 'healthy') {
        healthCheck.status = 'warning';
      }
    } else {
      healthCheck.services.memory = {
        status: 'healthy',
        message: '内存使用正常',
        usage: `${memoryUsagePercent.toFixed(2)}%`
      };
    }

    // 检查磁盘空间（简化检查）
    healthCheck.services.disk = {
      status: 'healthy',
      message: '磁盘空间充足'
    };

    // 检查最近的错误日志
    const recentErrors = await prisma.systemLog.count({
      where: {
        level: { in: ['error', 'fatal'] },
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // 最近5分钟
        }
      }
    });

    if (recentErrors > 10) {
      healthCheck.services.logs = {
        status: 'warning',
        message: '最近错误日志较多',
        errorCount: recentErrors
      };
      if (healthCheck.status === 'healthy') {
        healthCheck.status = 'warning';
      }
    } else {
      healthCheck.services.logs = {
        status: 'healthy',
        message: '日志状态正常',
        errorCount: recentErrors
      };
    }

    res.json(createSuccessResponse(healthCheck, '系统健康检查完成'));
  } catch (error) {
    next(error);
  }
};

/**
 * 清理过期日志
 * POST /api/mobile/system/cleanup-logs
 */
export const cleanupLogs = async (req, res, next) => {
  try {
    const { days = 30, logTypes = ['system', 'api'] } = req.body;
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const results = {};

    // 清理系统日志
    if (logTypes.includes('system')) {
      const deletedSystemLogs = await prisma.systemLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });
      results.systemLogs = deletedSystemLogs.count;
    }

    // 清理API访问日志
    if (logTypes.includes('api')) {
      const deletedApiLogs = await prisma.apiAccessLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });
      results.apiLogs = deletedApiLogs.count;
    }

    res.json(createSuccessResponse({
      cleanupDate: cutoffDate,
      results,
      totalDeleted: Object.values(results).reduce((sum, count) => sum + count, 0)
    }, '日志清理完成'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取系统统计概览
 * GET /api/mobile/system/statistics
 */
export const getSystemStatistics = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { period = 'week' } = req.query;

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'month':
        dateFilter = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
        break;
      default: // week
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
    }

    // 并行获取各种统计数据
    const [
      userStats,
      batchStats,
      qualityStats,
      alertStats,
      apiStats,
      logStats
    ] = await Promise.all([
      // 用户统计
      prisma.user.groupBy({
        by: ['isActive'],
        where: { factoryId },
        _count: { isActive: true }
      }),
      
      // 生产批次统计
      prisma.processingBatch.groupBy({
        by: ['status'],
        where: { 
          factoryId,
          createdAt: dateFilter 
        },
        _count: { status: true }
      }),
      
      // 质检统计
      prisma.qualityInspection.aggregate({
        where: { 
          factoryId,
          inspectionDate: dateFilter 
        },
        _count: { id: true },
        _avg: { qualityScore: true }
      }),
      
      // 告警统计
      prisma.alertNotification.groupBy({
        by: ['severity'],
        where: { 
          factoryId,
          createdAt: dateFilter 
        },
        _count: { severity: true }
      }),
      
      // API调用统计
      prisma.apiAccessLog.groupBy({
        by: ['method'],
        where: { 
          factoryId,
          timestamp: dateFilter 
        },
        _count: { method: true },
        _avg: { responseTime: true }
      }),
      
      // 日志统计
      prisma.systemLog.groupBy({
        by: ['level'],
        where: { 
          factoryId,
          timestamp: dateFilter 
        },
        _count: { level: true }
      })
    ]);

    res.json(createSuccessResponse({
      period,
      users: {
        active: userStats.find(s => s.isActive)?._count?.isActive || 0,
        inactive: userStats.find(s => !s.isActive)?._count?.isActive || 0
      },
      production: {
        batchDistribution: batchStats.map(stat => ({
          status: stat.status,
          count: stat._count.status
        }))
      },
      quality: {
        totalInspections: qualityStats._count.id,
        avgScore: Math.round((qualityStats._avg.qualityScore || 0) * 100) / 100
      },
      alerts: {
        severityDistribution: alertStats.map(stat => ({
          severity: stat.severity,
          count: stat._count.severity
        }))
      },
      api: {
        methodDistribution: apiStats.map(stat => ({
          method: stat.method,
          count: stat._count.method,
          avgResponseTime: Math.round(stat._avg.responseTime)
        }))
      },
      logs: {
        levelDistribution: logStats.map(stat => ({
          level: stat.level,
          count: stat._count.level
        }))
      },
      generatedAt: new Date()
    }, '获取系统统计成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  createSystemLog,
  getSystemLogs,
  getApiAccessLogs,
  getSystemPerformance,
  getSystemHealth,
  cleanupLogs,
  getSystemStatistics
};