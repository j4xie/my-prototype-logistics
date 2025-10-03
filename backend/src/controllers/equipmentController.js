import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 获取设备实时状态列表
 * GET /api/mobile/equipment/monitoring
 */
export const getEquipmentMonitoring = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      department,
      status,
      equipmentType,
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const where = {
      factoryId,
      ...(department && { department }),
      ...(status && { status }),
      ...(equipmentType && { equipmentType: { contains: equipmentType } })
    };

    const [equipment, total] = await Promise.all([
      prisma.factoryEquipment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          monitoringData: {
            take: 1,
            orderBy: { timestamp: 'desc' },
            select: {
              timestamp: true,
              metrics: true,
              status: true,
              alertTriggered: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.factoryEquipment.count({ where })
    ]);

    // 格式化响应数据
    const equipmentWithStatus = equipment.map(item => ({
      id: item.id,
      equipmentCode: item.equipmentCode,
      equipmentName: item.equipmentName,
      equipmentType: item.equipmentType,
      department: item.department,
      status: item.status,
      location: item.location,
      specifications: item.specifications,
      latestData: item.monitoringData.length > 0 ? item.monitoringData[0] : null,
      isOnline: item.monitoringData.length > 0 && 
                new Date() - new Date(item.monitoringData[0].timestamp) < 5 * 60 * 1000 // 5分钟内有数据认为在线
    }));

    res.json(createSuccessResponse({
      equipment: equipmentWithStatus,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取设备监控状态成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取设备指标历史数据
 * GET /api/mobile/equipment/:id/metrics
 */
export const getEquipmentMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;
    const {
      startDate,
      endDate,
      limit = 100,
      interval = 'hour' // hour, day
    } = req.query;

    // 验证设备存在
    const equipment = await prisma.factoryEquipment.findFirst({
      where: { id, factoryId }
    });

    if (!equipment) {
      throw new NotFoundError('设备不存在');
    }

    // 构建时间查询条件
    const timeFilter = {};
    if (startDate && endDate) {
      timeFilter.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else {
      // 默认获取最近24小时的数据
      timeFilter.timestamp = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      };
    }

    const monitoringData = await prisma.deviceMonitoringData.findMany({
      where: {
        equipmentId: id,
        ...timeFilter
      },
      select: {
        timestamp: true,
        metrics: true,
        status: true,
        alertTriggered: true,
        dataSource: true
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit)
    });

    // 根据interval聚合数据
    let aggregatedData = monitoringData;
    if (interval === 'day' && monitoringData.length > 24) {
      // 按天聚合
      const dailyData = {};
      monitoringData.forEach(data => {
        const day = data.timestamp.toISOString().split('T')[0];
        if (!dailyData[day]) {
          dailyData[day] = {
            timestamp: new Date(day),
            metrics: [],
            statusCounts: {},
            alertCount: 0,
            dataCount: 0
          };
        }
        
        dailyData[day].metrics.push(data.metrics);
        dailyData[day].statusCounts[data.status] = (dailyData[day].statusCounts[data.status] || 0) + 1;
        if (data.alertTriggered) dailyData[day].alertCount++;
        dailyData[day].dataCount++;
      });

      // 计算每天的平均值
      aggregatedData = Object.values(dailyData).map(day => ({
        timestamp: day.timestamp,
        metrics: calculateAverageMetrics(day.metrics),
        status: getMostFrequentStatus(day.statusCounts),
        alertTriggered: day.alertCount > 0,
        dataSource: 'aggregated',
        aggregationInfo: {
          dataPoints: day.dataCount,
          alertCount: day.alertCount
        }
      }));
    }

    res.json(createSuccessResponse({
      equipment: {
        id: equipment.id,
        equipmentCode: equipment.equipmentCode,
        equipmentName: equipment.equipmentName
      },
      timeRange: {
        start: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      },
      interval,
      data: aggregatedData.reverse(), // 按时间正序
      summary: {
        totalPoints: monitoringData.length,
        alertCount: monitoringData.filter(d => d.alertTriggered).length
      }
    }, '获取设备指标数据成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 上报设备监控数据
 * POST /api/mobile/equipment/:id/data
 */
export const reportEquipmentData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;
    const {
      metrics,
      status = 'normal',
      dataSource = 'manual'
    } = req.body;

    // 验证设备存在
    const equipment = await prisma.factoryEquipment.findFirst({
      where: { id, factoryId }
    });

    if (!equipment) {
      throw new NotFoundError('设备不存在');
    }

    // 验证指标数据
    if (!metrics || typeof metrics !== 'object') {
      throw new ValidationError('指标数据格式不正确');
    }

    // 检查是否触发告警
    const alertTriggered = checkAlertConditions(metrics, equipment.specifications);

    // 保存监控数据
    const monitoringData = await prisma.deviceMonitoringData.create({
      data: {
        equipmentId: id,
        factoryId,
        timestamp: new Date(),
        metrics,
        status,
        alertTriggered,
        dataSource
      }
    });

    // 如果触发告警，创建告警通知
    if (alertTriggered) {
      await createEquipmentAlert(equipment, metrics, req.user.id);
    }

    // 更新设备状态 (映射无效状态到有效枚举值)
    let validStatus = status;
    if (status === 'warning') {
      validStatus = 'maintenance'; // 将warning映射为maintenance
    }
    
    if (equipment.status !== validStatus && validStatus !== 'normal') {
      await prisma.factoryEquipment.update({
        where: { id },
        data: { status: validStatus }
      });
    }

    res.status(201).json(createSuccessResponse({
      id: monitoringData.id,
      timestamp: monitoringData.timestamp,
      alertTriggered,
      message: alertTriggered ? '数据上报成功，已触发告警' : '数据上报成功'
    }, '设备监控数据上报成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取设备告警列表
 * GET /api/mobile/equipment/alerts
 */
export const getEquipmentAlerts = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      equipmentId,
      severity,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const where = {
      factoryId,
      alertType: 'equipment',
      ...(equipmentId && { sourceId: equipmentId }),
      ...(severity && { severity }),
      ...(status && { status })
    };

    const [alerts, total] = await Promise.all([
      prisma.alertNotification.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
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

    // 获取设备信息
    const equipmentIds = alerts.map(alert => alert.sourceId).filter(Boolean);
    const equipmentMap = {};
    
    if (equipmentIds.length > 0) {
      const equipment = await prisma.factoryEquipment.findMany({
        where: {
          id: { in: equipmentIds }
        },
        select: {
          id: true,
          equipmentCode: true,
          equipmentName: true,
          department: true
        }
      });
      
      equipment.forEach(eq => {
        equipmentMap[eq.id] = eq;
      });
    }

    const alertsWithEquipment = alerts.map(alert => ({
      ...alert,
      equipment: alert.sourceId ? equipmentMap[alert.sourceId] : null
    }));

    res.json(createSuccessResponse({
      alerts: alertsWithEquipment,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取设备告警列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取单个设备状态
 * GET /api/mobile/equipment/:id/status
 */
export const getEquipmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;

    const equipment = await prisma.factoryEquipment.findFirst({
      where: { id, factoryId },
      include: {
        monitoringData: {
          take: 10,
          orderBy: { timestamp: 'desc' },
          select: {
            timestamp: true,
            metrics: true,
            status: true,
            alertTriggered: true
          }
        }
      }
    });

    if (!equipment) {
      throw new NotFoundError('设备不存在');
    }

    // 计算设备健康度
    const healthScore = calculateEquipmentHealth(equipment.monitoringData);
    
    // 获取最近的告警
    const recentAlerts = await prisma.alertNotification.findMany({
      where: {
        factoryId,
        alertType: 'equipment',
        sourceId: id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        severity: true,
        title: true,
        createdAt: true,
        status: true
      }
    });

    // 计算运行时间
    const latestData = equipment.monitoringData.length > 0 ? equipment.monitoringData[0] : null;
    const isOnline = latestData && new Date() - new Date(latestData.timestamp) < 5 * 60 * 1000;
    const uptime = calculateUptime(equipment.monitoringData);

    res.json(createSuccessResponse({
      equipment: {
        id: equipment.id,
        equipmentCode: equipment.equipmentCode,
        equipmentName: equipment.equipmentName,
        equipmentType: equipment.equipmentType,
        department: equipment.department,
        status: equipment.status,
        location: equipment.location,
        specifications: equipment.specifications
      },
      currentStatus: {
        isOnline,
        lastUpdate: latestData?.timestamp,
        status: latestData?.status || 'unknown',
        healthScore: Math.round(healthScore),
        uptime: uptime
      },
      latestMetrics: latestData?.metrics,
      recentData: equipment.monitoringData,
      recentAlerts
    }, '获取设备状态成功'));
  } catch (error) {
    next(error);
  }
};

// 辅助函数
function calculateAverageMetrics(metricsArray) {
  if (metricsArray.length === 0) return {};
  
  const result = {};
  const keys = Object.keys(metricsArray[0] || {});
  
  keys.forEach(key => {
    const values = metricsArray
      .map(m => parseFloat(m[key]))
      .filter(v => !isNaN(v));
    
    if (values.length > 0) {
      result[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
  });
  
  return result;
}

function getMostFrequentStatus(statusCounts) {
  let maxCount = 0;
  let mostFrequent = 'normal';
  
  for (const [status, count] of Object.entries(statusCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = status;
    }
  }
  
  return mostFrequent;
}

function checkAlertConditions(metrics, specifications) {
  // 简单的告警检查逻辑
  // 实际项目中应该根据具体的设备规格和阈值来判断
  if (!specifications || !specifications.alerts) {
    return false;
  }
  
  const alertRules = specifications.alerts;
  
  for (const [metricName, value] of Object.entries(metrics)) {
    const rule = alertRules[metricName];
    if (rule) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (rule.max && numValue > rule.max) return true;
        if (rule.min && numValue < rule.min) return true;
      }
    }
  }
  
  return false;
}

async function createEquipmentAlert(equipment, metrics, userId) {
  try {
    await prisma.alertNotification.create({
      data: {
        factoryId: equipment.factoryId,
        alertType: 'equipment',
        severity: 'medium',
        title: `设备异常: ${equipment.equipmentName}`,
        message: `设备 ${equipment.equipmentCode} 监控数据异常，请及时检查。`,
        sourceId: equipment.id,
        sourceType: 'equipment',
        assignedTo: [userId], // 分配给上报数据的用户
        status: 'new'
      }
    });
  } catch (error) {
    console.error('创建设备告警失败:', error);
  }
}

function calculateEquipmentHealth(monitoringData) {
  if (monitoringData.length === 0) return 0;
  
  let healthScore = 100;
  const recentData = monitoringData.slice(0, 5); // 最近5条数据
  
  recentData.forEach(data => {
    if (data.status === 'error') healthScore -= 20;
    else if (data.status === 'warning') healthScore -= 10;
    else if (data.status === 'maintenance') healthScore -= 5;
    
    if (data.alertTriggered) healthScore -= 15;
  });
  
  return Math.max(0, healthScore);
}

function calculateUptime(monitoringData) {
  if (monitoringData.length === 0) return 0;
  
  const last24Hours = monitoringData.filter(data => 
    new Date() - new Date(data.timestamp) <= 24 * 60 * 60 * 1000
  );
  
  const totalPoints = last24Hours.length;
  const normalPoints = last24Hours.filter(data => 
    data.status === 'normal' && !data.alertTriggered
  ).length;
  
  return totalPoints > 0 ? (normalPoints / totalPoints) * 100 : 0;
}

export default {
  getEquipmentMonitoring,
  getEquipmentMetrics,
  reportEquipmentData,
  getEquipmentAlerts,
  getEquipmentStatus
};