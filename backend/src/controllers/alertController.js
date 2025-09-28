import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { hasPermission, calculateUserPermissions } from '../config/permissions.js';

const prisma = new PrismaClient();

/**
 * 获取告警列表
 * GET /api/mobile/alerts
 */
export const getAlerts = async (req, res, next) => {
  try {
    const { factoryId, userType } = req.user;
    const {
      page = 1,
      limit = 20,
      alertType,
      severity,
      status,
      startDate,
      endDate,
      assignedToMe = false
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const where = {
      // 平台用户可以访问所有工厂数据，工厂用户只能访问自己工厂的数据
      ...(userType !== 'platform' && factoryId && { factoryId }),
      ...(alertType && { alertType }),
      ...(severity && { severity }),
      ...(status && { status }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }),
      ...(assignedToMe === 'true' && {
        assignedTo: {
          path: '$',
          array_contains: req.user.id
        }
      })
    };

    const [alerts, total] = await Promise.all([
      prisma.alertNotification.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [
          { severity: 'desc' }, // 按严重程度排序
          { createdAt: 'desc' }  // 然后按时间排序
        ],
        include: {
          resolver: {
            select: {
              id: true,
              fullName: true,
              department: true
            }
          }
        }
      }),
      prisma.alertNotification.count({ where })
    ]);

    // 获取相关的源数据信息
    const sourceIds = alerts.map(alert => alert.sourceId).filter(Boolean);
    const equipmentMap = {};
    const batchMap = {};

    // 获取设备信息
    if (sourceIds.length > 0) {
      const equipment = await prisma.factoryEquipment.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          equipmentCode: true,
          equipmentName: true,
          department: true
        }
      });
      equipment.forEach(eq => { equipmentMap[eq.id] = eq; });

      // 获取批次信息
      const batches = await prisma.processingBatch.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          batchNumber: true,
          productType: true,
          status: true
        }
      });
      batches.forEach(batch => { batchMap[batch.id] = batch; });
    }

    const alertsWithDetails = alerts.map(alert => ({
      ...alert,
      sourceDetails: alert.sourceType === 'equipment' 
        ? equipmentMap[alert.sourceId]
        : alert.sourceType === 'batch'
        ? batchMap[alert.sourceId]
        : null
    }));

    res.json(createSuccessResponse({
      alerts: alertsWithDetails,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取告警列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 确认告警
 * POST /api/mobile/alerts/:id/acknowledge
 */
export const acknowledgeAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;
    const userId = req.user.id;

    const alert = await prisma.alertNotification.findFirst({
      where: { id, factoryId }
    });

    if (!alert) {
      throw new NotFoundError('告警不存在');
    }

    if (alert.status !== 'new') {
      throw new ValidationError('只能确认新建状态的告警');
    }

    const updatedAlert = await prisma.alertNotification.update({
      where: { id },
      data: {
        status: 'acknowledged',
        // 将确认人添加到分配列表中（如果还没有的话）
        assignedTo: alert.assignedTo && Array.isArray(alert.assignedTo) 
          ? [...new Set([...alert.assignedTo, userId])]
          : [userId]
      },
      include: {
        resolver: {
          select: {
            id: true,
            fullName: true,
            department: true
          }
        }
      }
    });

    res.json(createSuccessResponse(updatedAlert, '告警确认成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 解决告警
 * POST /api/mobile/alerts/:id/resolve
 */
export const resolveAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;
    const userId = req.user.id;
    const { resolutionNotes } = req.body;

    const alert = await prisma.alertNotification.findFirst({
      where: { id, factoryId }
    });

    if (!alert) {
      throw new NotFoundError('告警不存在');
    }

    if (alert.status === 'resolved' || alert.status === 'closed') {
      throw new ValidationError('告警已经解决或关闭');
    }

    const updatedAlert = await prisma.alertNotification.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes: resolutionNotes || null
      },
      include: {
        resolver: {
          select: {
            id: true,
            fullName: true,
            department: true
          }
        }
      }
    });

    res.json(createSuccessResponse(updatedAlert, '告警解决成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 告警统计数据
 * GET /api/mobile/alerts/statistics
 */
export const getAlertStatistics = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { 
      startDate, 
      endDate, 
      department,
      alertType 
    } = req.query;

    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } : {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 默认最近30天
      }
    };

    const baseWhere = {
      factoryId,
      ...dateFilter,
      ...(alertType && { alertType })
    };

    // 并行获取各种统计数据
    const [
      totalAlerts,
      severityStats,
      statusStats,
      typeStats,
      avgResolutionTime,
      criticalAlerts,
      activeAlerts
    ] = await Promise.all([
      // 总告警数
      prisma.alertNotification.count({ where: baseWhere }),
      
      // 按严重级别统计
      prisma.alertNotification.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { severity: true }
      }),
      
      // 按状态统计
      prisma.alertNotification.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true }
      }),
      
      // 按类型统计
      prisma.alertNotification.groupBy({
        by: ['alertType'],
        where: baseWhere,
        _count: { alertType: true }
      }),
      
      // 平均解决时间
      getAverageResolutionTime(factoryId, dateFilter),
      
      // 严重告警数（高危和关键）
      prisma.alertNotification.count({
        where: {
          ...baseWhere,
          severity: { in: ['high', 'critical'] }
        }
      }),
      
      // 活跃告警数
      prisma.alertNotification.count({
        where: {
          factoryId,
          status: { in: ['new', 'acknowledged', 'in_progress'] }
        }
      })
    ]);

    res.json(createSuccessResponse({
      summary: {
        total: totalAlerts,
        active: activeAlerts,
        critical: criticalAlerts,
        avgResolutionHours: Math.round(avgResolutionTime * 10) / 10
      },
      distribution: {
        severity: severityStats.map(stat => ({
          level: stat.severity,
          count: stat._count.severity
        })),
        status: statusStats.map(stat => ({
          status: stat.status,
          count: stat._count.status
        })),
        type: typeStats.map(stat => ({
          type: stat.alertType,
          count: stat._count.alertType
        }))
      },
      dateRange: {
        start: dateFilter.createdAt.gte?.toISOString(),
        end: dateFilter.createdAt.lte?.toISOString()
      }
    }, '获取告警统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 告警摘要
 * GET /api/mobile/alerts/summary
 */
export const getAlertsSummary = async (req, res, next) => {
  try {
    const { factoryId } = req.user;

    // 获取各个严重级别的活跃告警数
    const activeSeverityStats = await prisma.alertNotification.groupBy({
      by: ['severity'],
      where: {
        factoryId,
        status: { in: ['new', 'acknowledged', 'in_progress'] }
      },
      _count: { severity: true }
    });

    // 获取最近的高优先级告警
    const urgentAlerts = await prisma.alertNotification.findMany({
      where: {
        factoryId,
        severity: { in: ['high', 'critical'] },
        status: { in: ['new', 'acknowledged', 'in_progress'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        resolver: {
          select: {
            fullName: true
          }
        }
      }
    });

    // 今日新增告警
    const todayAlerts = await prisma.alertNotification.count({
      where: {
        factoryId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    // 待处理告警（分配给当前用户的）
    const myPendingAlerts = await prisma.alertNotification.count({
      where: {
        factoryId,
        status: { in: ['new', 'acknowledged', 'in_progress'] },
        assignedTo: {
          path: '$',
          array_contains: req.user.id
        }
      }
    });

    res.json(createSuccessResponse({
      activeBySeverity: activeSeverityStats.reduce((acc, stat) => {
        acc[stat.severity] = stat._count.severity;
        return acc;
      }, { critical: 0, high: 0, medium: 0, low: 0 }),
      urgentAlerts: urgentAlerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        createdAt: alert.createdAt,
        status: alert.status
      })),
      todayCount: todayAlerts,
      myPendingCount: myPendingAlerts,
      overallStatus: urgentAlerts.length > 0 ? 'urgent' : 
                    (todayAlerts > 5 ? 'attention' : 'normal')
    }, '获取告警摘要成功'));
  } catch (error) {
    next(error);
  }
};

// 辅助函数：计算平均解决时间
async function getAverageResolutionTime(factoryId, dateFilter) {
  const resolvedAlerts = await prisma.alertNotification.findMany({
    where: {
      factoryId,
      status: 'resolved',
      resolvedAt: { not: null },
      ...dateFilter
    },
    select: {
      createdAt: true,
      resolvedAt: true
    }
  });

  if (resolvedAlerts.length === 0) return 0;

  const totalTime = resolvedAlerts.reduce((sum, alert) => {
    return sum + (new Date(alert.resolvedAt) - new Date(alert.createdAt));
  }, 0);

  return totalTime / resolvedAlerts.length / (1000 * 60 * 60); // 转换为小时
}

/**
 * 创建告警通知
 * POST /api/mobile/alerts
 */
export const createAlert = async (req, res, next) => {
  try {
    const { factoryId, roleCode, userType, department } = req.user;
    const {
      alertType,
      severity = 'medium',
      title,
      message,
      sourceType = 'manual',
      sourceId
    } = req.body;

    // 权限检查 - 基于用户实际权限而不是角色代码
    const { permissions } = req.user;
    const hasAlertPermission = permissions && (
      permissions.alert_management_all || 
      permissions.global_notifications ||
      permissions.factory_notifications
    );
    
    if (!hasAlertPermission) {
      throw new AuthorizationError('权限不足，无法创建告警通知');
    }

    // 验证必需字段
    if (!alertType || !title || !message) {
      throw new ValidationError('告警类型、标题和消息为必填字段');
    }

    // 验证告警类型
    const validAlertTypes = ['equipment', 'quality', 'production', 'safety'];
    if (!validAlertTypes.includes(alertType)) {
      throw new ValidationError('无效的告警类型');
    }

    // 验证严重程度
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      throw new ValidationError('无效的严重程度');
    }

    // 创建告警记录
    const alert = await prisma.alertNotification.create({
      data: {
        factoryId,
        alertType,
        severity,
        title,
        message,
        sourceType,
        sourceId,
        status: 'new'
      },
      include: {
        resolver: {
          select: {
            id: true,
            fullName: true,
            department: true
          }
        }
      }
    });

    res.status(201).json(createSuccessResponse({
      alert: {
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        status: alert.status,
        createdAt: alert.createdAt,
        sourceType: alert.sourceType,
        sourceId: alert.sourceId
      }
    }, '告警创建成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  getAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  getAlertStatistics,
  getAlertsSummary
};