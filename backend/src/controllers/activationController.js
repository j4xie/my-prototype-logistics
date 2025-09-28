import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { safeGetFactoryId } from '../utils/factory-context-handler.js';

const prisma = new PrismaClient();

/**
 * 生成激活码
 * POST /api/mobile/activation/generate
 */
export const generateActivationCode = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      type = 'device',
      maxUses = 1,
      validDays = 30,
      metadata = {},
      notes
    } = req.body;

    // 生成唯一激活码
    const code = generateUniqueCode(type);
    
    const validUntil = validDays > 0 ? new Date(Date.now() + validDays * 24 * 60 * 60 * 1000) : null;

    const activationCode = await prisma.activationCode.create({
      data: {
        code,
        type,
        factoryId: type === 'factory' ? null : factoryId, // 工厂类型激活码不绑定特定工厂
        maxUses,
        validUntil,
        createdBy: req.user.id,
        metadata,
        notes: notes || null,
        status: 'active'
      },
      include: {
        creator: {
          select: {
            fullName: true,
            department: true
          }
        },
        factory: {
          select: {
            name: true
          }
        }
      }
    });

    res.json(createSuccessResponse(activationCode, '激活码生成成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 验证激活码
 * POST /api/mobile/activation/validate
 */
export const validateActivationCode = async (req, res, next) => {
  try {
    const { code, deviceId, deviceInfo = {} } = req.body;

    if (!code || !deviceId) {
      throw new ValidationError('激活码和设备ID为必填项');
    }

    // 查找激活码
    const activationCode = await prisma.activationCode.findUnique({
      where: { code },
      include: {
        factory: {
          select: {
            id: true,
            name: true
          }
        },
        activations: {
          where: {
            deviceId
          }
        }
      }
    });

    if (!activationCode) {
      throw new NotFoundError('激活码不存在或已失效');
    }

    // 检查激活码状态
    if (activationCode.status !== 'active') {
      throw new ValidationError('激活码已禁用或过期');
    }

    // 检查有效期
    if (activationCode.validUntil && new Date() > activationCode.validUntil) {
      await prisma.activationCode.update({
        where: { id: activationCode.id },
        data: { status: 'expired' }
      });
      throw new ValidationError('激活码已过期');
    }

    // 检查使用次数
    if (activationCode.usedCount >= activationCode.maxUses) {
      await prisma.activationCode.update({
        where: { id: activationCode.id },
        data: { status: 'exhausted' }
      });
      throw new ValidationError('激活码使用次数已达上限');
    }

    // 检查设备是否已激活
    if (activationCode.activations.length > 0) {
      throw new ValidationError('该设备已使用此激活码激活');
    }

    res.json(createSuccessResponse({
      valid: true,
      activationCode: {
        id: activationCode.id,
        type: activationCode.type,
        factory: activationCode.factory,
        remainingUses: activationCode.maxUses - activationCode.usedCount,
        validUntil: activationCode.validUntil
      }
    }, '激活码验证成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 执行激活
 * POST /api/mobile/activation/activate
 */
export const activateDevice = async (req, res, next) => {
  try {
    const { code, deviceId, deviceInfo = {}, userAgent } = req.body;
    const ipAddress = req.ip;
    const userId = req.user?.id || null;

    if (!code || !deviceId) {
      throw new ValidationError('激活码和设备ID为必填项');
    }

    // 在事务中处理激活流程
    const result = await prisma.$transaction(async (tx) => {
      // 重新验证激活码（防止并发问题）
      const activationCode = await tx.activationCode.findUnique({
        where: { code },
        include: {
          activations: {
            where: { deviceId }
          }
        }
      });

      if (!activationCode || activationCode.status !== 'active') {
        throw new ValidationError('激活码无效');
      }

      if (activationCode.validUntil && new Date() > activationCode.validUntil) {
        throw new ValidationError('激活码已过期');
      }

      if (activationCode.usedCount >= activationCode.maxUses) {
        throw new ValidationError('激活码使用次数已达上限');
      }

      if (activationCode.activations.length > 0) {
        throw new ValidationError('设备已激活');
      }

      // 创建激活记录
      const activationRecord = await tx.activationRecord.create({
        data: {
          activationCodeId: activationCode.id,
          deviceId,
          userId,
          deviceInfo,
          ipAddress,
          userAgent,
          status: 'success'
        }
      });

      // 更新激活码使用次数
      const updatedActivationCode = await tx.activationCode.update({
        where: { id: activationCode.id },
        data: {
          usedCount: { increment: 1 },
          // 如果达到最大使用次数，设置为耗尽状态
          ...(activationCode.usedCount + 1 >= activationCode.maxUses && { 
            status: 'exhausted' 
          })
        },
        include: {
          factory: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return {
        activationRecord,
        activationCode: updatedActivationCode
      };
    });

    res.json(createSuccessResponse({
      activationId: result.activationRecord.id,
      deviceId: result.activationRecord.deviceId,
      activatedAt: result.activationRecord.activatedAt,
      factory: result.activationCode.factory,
      codeType: result.activationCode.type
    }, '设备激活成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 查询激活记录
 * GET /api/mobile/activation/records
 */
export const getActivationRecords = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      page = 1,
      limit = 20,
      deviceId,
      codeType,
      status,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      activationCode: {
        ...(factoryId && { factoryId }),
        ...(codeType && { type: codeType })
      },
      ...(deviceId && { deviceId: { contains: deviceId } }),
      ...(status && { status }),
      ...(startDate && endDate && {
        activatedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [records, total] = await Promise.all([
      prisma.activationRecord.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { activatedAt: 'desc' },
        include: {
          activationCode: {
            select: {
              code: true,
              type: true,
              factory: {
                select: {
                  name: true
                }
              }
            }
          },
          user: {
            select: {
              fullName: true,
              username: true
            }
          }
        }
      }),
      prisma.activationRecord.count({ where })
    ]);

    res.json(createSuccessResponse({
      records,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取激活记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取激活统计
 * GET /api/mobile/activation/statistics
 */
export const getActivationStatistics = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
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

    // 并行获取各种统计数据
    const [
      totalCodes,
      activeCodes,
      totalActivations,
      recentActivations,
      codeTypeStats,
      activationsByDay
    ] = await Promise.all([
      // 总激活码数
      prisma.activationCode.count({
        where: { factoryId }
      }),
      // 活跃激活码数
      prisma.activationCode.count({
        where: { factoryId, status: 'active' }
      }),
      // 总激活次数
      prisma.activationRecord.count({
        where: {
          activationCode: { factoryId }
        }
      }),
      // 近期激活次数
      prisma.activationRecord.count({
        where: {
          activationCode: { factoryId },
          activatedAt: dateFilter
        }
      }),
      // 按激活码类型统计
      prisma.activationCode.groupBy({
        by: ['type'],
        where: { factoryId },
        _count: { type: true },
        _sum: { usedCount: true }
      }),
      // 按日期统计激活数量
      prisma.activationRecord.findMany({
        where: {
          activationCode: { factoryId },
          activatedAt: dateFilter
        },
        select: {
          activatedAt: true
        }
      })
    ]);

    // 按日期分组统计
    const dailyStats = {};
    activationsByDay.forEach(record => {
      const date = record.activatedAt.toISOString().split('T')[0];
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    res.json(createSuccessResponse({
      summary: {
        totalCodes,
        activeCodes,
        totalActivations,
        recentActivations
      },
      distribution: {
        byType: codeTypeStats.map(stat => ({
          type: stat.type,
          codeCount: stat._count.type,
          usageCount: stat._sum.usedCount || 0
        }))
      },
      trends: Object.entries(dailyStats).map(([date, count]) => ({
        date,
        activations: count
      })).sort((a, b) => new Date(a.date) - new Date(b.date)),
      period
    }, '获取激活统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 管理激活码状态
 * PUT /api/mobile/activation/codes/:id/status
 */
export const updateActivationCodeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const factoryId = safeGetFactoryId(req);

    if (!['active', 'disabled', 'expired'].includes(status)) {
      throw new ValidationError('无效的状态值');
    }

    const activationCode = await prisma.activationCode.findFirst({
      where: { id, factoryId }
    });

    if (!activationCode) {
      throw new NotFoundError('激活码不存在');
    }

    const updatedCode = await prisma.activationCode.update({
      where: { id },
      data: {
        status,
        notes: notes || activationCode.notes,
        updatedAt: new Date()
      },
      include: {
        creator: {
          select: {
            fullName: true
          }
        }
      }
    });

    res.json(createSuccessResponse(updatedCode, '激活码状态更新成功'));
  } catch (error) {
    next(error);
  }
};

// 辅助函数：生成唯一激活码
function generateUniqueCode(type) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  const prefixes = {
    device: 'DEV',
    user: 'USR',
    factory: 'FAC',
    trial: 'TRL',
    permanent: 'PRM'
  };
  
  const prefix = prefixes[type] || 'GEN';
  return `${prefix}_${timestamp}_${random}`;
}

export default {
  generateActivationCode,
  validateActivationCode,
  activateDevice,
  getActivationRecords,
  getActivationStatistics,
  updateActivationCodeStatus
};