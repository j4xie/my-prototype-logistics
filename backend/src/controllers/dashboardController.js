import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 生产概览数据
 * GET /api/mobile/dashboard/overview
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { period = 'today' } = req.query; // today, week, month

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'month':
        dateFilter = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
        break;
      default: // today
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        };
    }

    // 并行获取各种统计数据
    const [
      totalBatches,
      activeBatches,
      completedBatches,
      qualityInspections,
      passedInspections,
      activeEquipment,
      totalEquipment,
      activeAlerts,
      onDutyWorkers,
      totalWorkers
    ] = await Promise.all([
      // 总批次数
      prisma.processingBatch.count({
        where: { factoryId, createdAt: dateFilter }
      }),
      // 进行中的批次（包括 planning, in_progress, quality_check）
      prisma.processingBatch.count({
        where: {
          factoryId,
          status: { in: ['planning', 'in_progress', 'quality_check'] }
        }
      }),
      // 完成的批次
      prisma.processingBatch.count({
        where: { factoryId, status: 'completed', endDate: dateFilter }
      }),
      // 质检记录数
      prisma.qualityInspection.count({
        where: { factoryId, inspectionDate: dateFilter }
      }),
      // 通过的质检
      prisma.qualityInspection.count({
        where: { factoryId, overallResult: 'pass', inspectionDate: dateFilter }
      }),
      // 活跃设备数
      prisma.factoryEquipment.count({
        where: { factoryId, status: 'active' }
      }),
      // 总设备数
      prisma.factoryEquipment.count({
        where: { factoryId }
      }),
      // 活跃告警数
      prisma.alertNotification.count({
        where: { factoryId, status: { in: ['new', 'acknowledged', 'in_progress'] } }
      }),
      // 在岗人员数（今日已打卡上班且未打卡下班的人员）
      prisma.employeeTimeClock.groupBy({
        by: ['userId'],
        where: {
          factoryId,
          clockTime: dateFilter,
          clockType: 'clock_in'
        },
        _count: { userId: true }
      }).then(clockIns => {
        // 获取今日已打卡下班的人员
        return prisma.employeeTimeClock.groupBy({
          by: ['userId'],
          where: {
            factoryId,
            clockTime: dateFilter,
            clockType: 'clock_out'
          }
        }).then(clockOuts => {
          const clockOutUserIds = new Set(clockOuts.map(c => c.userId));
          // 打卡上班但未打卡下班的人员数
          return clockIns.filter(c => !clockOutUserIds.has(c.userId)).length;
        });
      }),
      // 总员工数
      prisma.factoryUser.count({
        where: { factoryId }
      })
    ]);

    // 计算关键指标
    const qualityPassRate = qualityInspections > 0 ? (passedInspections / qualityInspections) * 100 : 0;
    const equipmentUtilization = totalEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;
    const productionEfficiency = totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0;

    res.json(createSuccessResponse({
      period,
      summary: {
        totalBatches,
        activeBatches,
        completedBatches,
        qualityInspections,
        activeAlerts,
        onDutyWorkers,
        totalWorkers
      },
      kpi: {
        productionEfficiency: Math.round(productionEfficiency),
        qualityPassRate: Math.round(qualityPassRate),
        equipmentUtilization: Math.round(equipmentUtilization)
      },
      alerts: {
        active: activeAlerts,
        status: activeAlerts > 0 ? 'attention' : 'normal'
      }
    }, '获取概览数据成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 生产统计数据
 * GET /api/mobile/dashboard/production
 */
export const getProductionStatistics = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { startDate, endDate, department } = req.query;

    const dateFilter = startDate && endDate ? {
      startDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } : {};

    // 按状态统计批次
    const batchStats = await prisma.processingBatch.groupBy({
      by: ['status'],
      where: {
        factoryId,
        ...dateFilter
      },
      _count: { status: true },
      _sum: { actualQuantity: true }
    });

    // 按产品类型统计
    const productStats = await prisma.processingBatch.groupBy({
      by: ['productType'],
      where: {
        factoryId,
        ...dateFilter
      },
      _count: { productType: true },
      _sum: { actualQuantity: true },
      _avg: { actualQuantity: true }
    });

    // 按时间统计趋势
    const batches = await prisma.processingBatch.findMany({
      where: {
        factoryId,
        ...dateFilter
      },
      select: {
        startDate: true,
        status: true,
        actualQuantity: true
      }
    });

    // 按日期分组统计
    const dailyStats = {};
    batches.forEach(batch => {
      const date = batch.startDate.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          batches: 0,
          quantity: 0,
          completed: 0
        };
      }
      dailyStats[date].batches++;
      dailyStats[date].quantity += parseFloat(batch.actualQuantity || 0);
      if (batch.status === 'completed') {
        dailyStats[date].completed++;
      }
    });

    res.json(createSuccessResponse({
      batchStatusDistribution: batchStats.map(stat => ({
        status: stat.status,
        count: stat._count.status,
        totalQuantity: stat._sum.actualQuantity || 0
      })),
      productTypeStats: productStats.map(stat => ({
        productType: stat.productType,
        count: stat._count.productType,
        totalQuantity: stat._sum.actualQuantity || 0,
        avgQuantity: stat._avg.actualQuantity || 0
      })),
      dailyTrends: Object.values(dailyStats).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      )
    }, '获取生产统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 质量统计和趋势
 * GET /api/mobile/dashboard/quality
 */
export const getQualityDashboard = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { period = 'month' } = req.query;

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'quarter':
        dateFilter = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        };
        break;
      default: // month
        dateFilter = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
    }

    // 质检结果统计
    const qualityStats = await prisma.qualityInspection.groupBy({
      by: ['overallResult'],
      where: {
        factoryId,
        inspectionDate: dateFilter
      },
      _count: { overallResult: true },
      _avg: { qualityScore: true }
    });

    // 按检测类型统计
    const typeStats = await prisma.qualityInspection.groupBy({
      by: ['inspectionType'],
      where: {
        factoryId,
        inspectionDate: dateFilter
      },
      _count: { inspectionType: true },
      _avg: { qualityScore: true }
    });

    // 质量分数分布
    const inspections = await prisma.qualityInspection.findMany({
      where: {
        factoryId,
        inspectionDate: dateFilter,
        qualityScore: { not: null }
      },
      select: {
        qualityScore: true,
        inspectionDate: true
      }
    });

    // 分数区间统计
    const scoreDistribution = {
      excellent: 0,  // 90-100
      good: 0,       // 80-89
      average: 0,    // 70-79
      poor: 0        // <70
    };

    inspections.forEach(inspection => {
      const score = parseFloat(inspection.qualityScore);
      if (score >= 90) scoreDistribution.excellent++;
      else if (score >= 80) scoreDistribution.good++;
      else if (score >= 70) scoreDistribution.average++;
      else scoreDistribution.poor++;
    });

    res.json(createSuccessResponse({
      period,
      resultDistribution: qualityStats.map(stat => ({
        result: stat.overallResult,
        count: stat._count.overallResult,
        avgScore: stat._avg.qualityScore
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.inspectionType,
        count: stat._count.inspectionType,
        avgScore: stat._avg.qualityScore
      })),
      scoreDistribution,
      totalInspections: inspections.length,
      averageScore: inspections.length > 0 
        ? inspections.reduce((sum, i) => sum + parseFloat(i.qualityScore), 0) / inspections.length
        : 0
    }, '获取质量统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 设备状态统计
 * GET /api/mobile/dashboard/equipment
 */
export const getEquipmentDashboard = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    
    // 设备状态统计
    const statusStats = await prisma.factoryEquipment.groupBy({
      by: ['status'],
      where: { factoryId },
      _count: { status: true }
    });

    // 按部门统计设备
    const deptStats = await prisma.factoryEquipment.groupBy({
      by: ['department'],
      where: { factoryId },
      _count: { department: true }
    });

    // 获取最近的告警
    const recentAlerts = await prisma.alertNotification.count({
      where: {
        factoryId,
        alertType: 'equipment',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        }
      }
    });

    // 设备利用率（简化计算）
    const totalEquipment = await prisma.factoryEquipment.count({
      where: { factoryId }
    });
    
    const activeEquipment = await prisma.factoryEquipment.count({
      where: { factoryId, status: 'active' }
    });

    const utilizationRate = totalEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;

    res.json(createSuccessResponse({
      statusDistribution: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.status
      })),
      departmentDistribution: deptStats.map(stat => ({
        department: stat.department || 'unassigned',
        count: stat._count.department
      })),
      summary: {
        totalEquipment,
        activeEquipment,
        utilizationRate: Math.round(utilizationRate),
        recentAlerts
      }
    }, '获取设备统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 告警统计和分布
 * GET /api/mobile/dashboard/alerts
 */
export const getAlertsDashboard = async (req, res, next) => {
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

    // 按严重级别统计
    const severityStats = await prisma.alertNotification.groupBy({
      by: ['severity'],
      where: {
        factoryId,
        createdAt: dateFilter
      },
      _count: { severity: true }
    });

    // 按类型统计
    const typeStats = await prisma.alertNotification.groupBy({
      by: ['alertType'],
      where: {
        factoryId,
        createdAt: dateFilter
      },
      _count: { alertType: true }
    });

    // 按状态统计
    const statusStats = await prisma.alertNotification.groupBy({
      by: ['status'],
      where: {
        factoryId,
        createdAt: dateFilter
      },
      _count: { status: true }
    });

    // 活跃告警
    const activeAlerts = await prisma.alertNotification.count({
      where: {
        factoryId,
        status: { in: ['new', 'acknowledged', 'in_progress'] }
      }
    });

    // 平均解决时间（已解决的告警）
    const resolvedAlerts = await prisma.alertNotification.findMany({
      where: {
        factoryId,
        status: 'resolved',
        createdAt: dateFilter,
        resolvedAt: { not: null }
      },
      select: {
        createdAt: true,
        resolvedAt: true
      }
    });

    let avgResolutionTime = 0;
    if (resolvedAlerts.length > 0) {
      const totalTime = resolvedAlerts.reduce((sum, alert) => {
        return sum + (new Date(alert.resolvedAt) - new Date(alert.createdAt));
      }, 0);
      avgResolutionTime = totalTime / resolvedAlerts.length / (1000 * 60 * 60); // 转换为小时
    }

    res.json(createSuccessResponse({
      period,
      severityDistribution: severityStats.map(stat => ({
        severity: stat.severity,
        count: stat._count.severity
      })),
      typeDistribution: typeStats.map(stat => ({
        type: stat.alertType,
        count: stat._count.alertType
      })),
      statusDistribution: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.status
      })),
      summary: {
        activeAlerts,
        totalAlerts: severityStats.reduce((sum, stat) => sum + stat._count.severity, 0),
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10 // 保留1位小数
      }
    }, '获取告警统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 关键指标趋势分析
 * GET /api/mobile/dashboard/trends
 */
export const getTrendAnalysis = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const { period = 'month', metric = 'production' } = req.query;

    let dateFilter = {};
    let groupBy = 'day';
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        groupBy = 'day';
        break;
      case 'quarter':
        dateFilter = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        };
        groupBy = 'week';
        break;
      default: // month
        dateFilter = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
        groupBy = 'day';
    }

    let trendData = {};

    if (metric === 'production') {
      // 生产趋势
      const batches = await prisma.processingBatch.findMany({
        where: {
          factoryId,
          createdAt: dateFilter
        },
        select: {
          createdAt: true,
          status: true,
          actualQuantity: true
        }
      });

      batches.forEach(batch => {
        const date = batch.createdAt.toISOString().split('T')[0];
        if (!trendData[date]) {
          trendData[date] = { date, value: 0, completed: 0, total: 0 };
        }
        trendData[date].total++;
        trendData[date].value += parseFloat(batch.actualQuantity || 0);
        if (batch.status === 'completed') {
          trendData[date].completed++;
        }
      });
    } else if (metric === 'quality') {
      // 质量趋势
      const inspections = await prisma.qualityInspection.findMany({
        where: {
          factoryId,
          inspectionDate: dateFilter
        },
        select: {
          inspectionDate: true,
          overallResult: true,
          qualityScore: true
        }
      });

      inspections.forEach(inspection => {
        const date = inspection.inspectionDate.toISOString().split('T')[0];
        if (!trendData[date]) {
          trendData[date] = { date, value: 0, passed: 0, total: 0, scores: [] };
        }
        trendData[date].total++;
        if (inspection.overallResult === 'pass') {
          trendData[date].passed++;
        }
        if (inspection.qualityScore) {
          trendData[date].scores.push(parseFloat(inspection.qualityScore));
        }
      });

      // 计算平均分数
      Object.values(trendData).forEach(day => {
        if (day.scores && day.scores.length > 0) {
          day.value = day.scores.reduce((sum, score) => sum + score, 0) / day.scores.length;
        }
        delete day.scores;
      });
    }

    const trends = Object.values(trendData).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(createSuccessResponse({
      period,
      metric,
      groupBy,
      trends,
      summary: {
        totalPoints: trends.length,
        avgValue: trends.length > 0 
          ? trends.reduce((sum, t) => sum + t.value, 0) / trends.length 
          : 0
      }
    }, '获取趋势分析成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardOverview,
  getProductionStatistics,
  getQualityDashboard,
  getEquipmentDashboard,
  getAlertsDashboard,
  getTrendAnalysis
};