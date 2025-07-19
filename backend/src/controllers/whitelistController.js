import { PrismaClient } from '@prisma/client';
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  BusinessLogicError,
  createSuccessResponse 
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 添加白名单
 * 管理员批量添加手机号到白名单
 */
export const addWhitelist = async (req, res, next) => {
  try {
    const { phoneNumbers, expiresAt } = req.body;
    const { user } = req;

    // 检查重复的手机号
    const existingWhitelist = await prisma.userWhitelist.findMany({
      where: {
        factoryId: user.factoryId,
        phoneNumber: {
          in: phoneNumbers,
        },
      },
    });

    if (existingWhitelist.length > 0) {
      const duplicateNumbers = existingWhitelist.map(w => w.phoneNumber);
      throw new ConflictError(`以下手机号已在白名单中: ${duplicateNumbers.join(', ')}`);
    }

    // 批量创建白名单记录
    const whitelistData = phoneNumbers.map(phoneNumber => ({
      factoryId: user.factoryId,
      phoneNumber,
      addedByUserId: user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }));

    await prisma.userWhitelist.createMany({
      data: whitelistData,
    });

    res.status(201).json(createSuccessResponse({
      addedCount: phoneNumbers.length,
      phoneNumbers,
    }, '白名单添加成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取白名单列表
 * 分页获取工厂的白名单记录
 */
export const getWhitelist = async (req, res, next) => {
  try {
    const { page, pageSize, status, search } = req.query;
    const { user } = req;

    // 构建查询条件
    const where = {
      factoryId: user.factoryId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.phoneNumber = {
        contains: search,
      };
    }

    // 获取总数
    const total = await prisma.userWhitelist.count({ where });

    // 分页查询
    const skip = (page - 1) * pageSize;
    const whitelist = await prisma.userWhitelist.findMany({
      where,
      include: {
        addedByUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    res.json(createSuccessResponse({
      items: whitelist,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      },
    }, '获取白名单成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新白名单状态
 * 管理员手动更新白名单记录的状态
 */
export const updateWhitelist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, expiresAt } = req.body;
    const { user } = req;

    // 查找白名单记录
    const whitelist = await prisma.userWhitelist.findFirst({
      where: {
        id: parseInt(id),
        factoryId: user.factoryId,
      },
    });

    if (!whitelist) {
      throw new NotFoundError('白名单记录不存在');
    }

    // 更新状态
    const updateData = { status };
    if (expiresAt) {
      updateData.expiresAt = new Date(expiresAt);
    }

    const updated = await prisma.userWhitelist.update({
      where: { id: whitelist.id },
      data: updateData,
    });

    res.json(createSuccessResponse(updated, '白名单状态更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除白名单记录
 * 管理员删除白名单记录
 */
export const deleteWhitelist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req;

    // 查找白名单记录
    const whitelist = await prisma.userWhitelist.findFirst({
      where: {
        id: parseInt(id),
        factoryId: user.factoryId,
      },
    });

    if (!whitelist) {
      throw new NotFoundError('白名单记录不存在');
    }

    // 检查是否已被注册
    if (whitelist.status === 'REGISTERED') {
      throw new BusinessLogicError('已注册的白名单记录无法删除');
    }

    // 删除记录
    await prisma.userWhitelist.delete({
      where: { id: whitelist.id },
    });

    res.json(createSuccessResponse(null, '白名单记录删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 批量删除白名单
 * 管理员批量删除白名单记录
 */
export const batchDeleteWhitelist = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const { user } = req;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('请选择要删除的记录');
    }

    // 查找白名单记录
    const whitelist = await prisma.userWhitelist.findMany({
      where: {
        id: {
          in: ids.map(id => parseInt(id)),
        },
        factoryId: user.factoryId,
      },
    });

    if (whitelist.length === 0) {
      throw new NotFoundError('未找到可删除的记录');
    }

    // 检查是否有已注册的记录
    const registeredRecords = whitelist.filter(w => w.status === 'REGISTERED');
    if (registeredRecords.length > 0) {
      throw new BusinessLogicError('存在已注册的白名单记录，无法删除');
    }

    // 批量删除
    const result = await prisma.userWhitelist.deleteMany({
      where: {
        id: {
          in: whitelist.map(w => w.id),
        },
        factoryId: user.factoryId,
      },
    });

    res.json(createSuccessResponse({
      deletedCount: result.count,
    }, '批量删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取白名单统计信息
 * 获取工厂白名单的统计数据
 */
export const getWhitelistStats = async (req, res, next) => {
  try {
    const { user } = req;

    // 统计各种状态的数量
    const stats = await prisma.userWhitelist.groupBy({
      by: ['status'],
      where: {
        factoryId: user.factoryId,
      },
      _count: {
        id: true,
      },
    });

    // 统计今天新增的数量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAdded = await prisma.userWhitelist.count({
      where: {
        factoryId: user.factoryId,
        createdAt: {
          gte: today,
        },
      },
    });

    // 统计即将过期的数量（7天内）
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const expiringSoon = await prisma.userWhitelist.count({
      where: {
        factoryId: user.factoryId,
        status: 'PENDING',
        expiresAt: {
          lte: sevenDaysLater,
          gte: new Date(),
        },
      },
    });

    // 格式化统计数据
    const statusStats = {
      PENDING: 0,
      REGISTERED: 0,
      EXPIRED: 0,
    };

    stats.forEach(stat => {
      statusStats[stat.status] = stat._count.id;
    });

    res.json(createSuccessResponse({
      statusStats,
      todayAdded,
      expiringSoon,
      total: Object.values(statusStats).reduce((sum, count) => sum + count, 0),
    }, '获取统计信息成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 批量更新即将过期的白名单
 * 自动处理过期的白名单记录
 */
export const updateExpiredWhitelist = async (req, res, next) => {
  try {
    const { user } = req;

    // 更新过期的白名单记录
    const result = await prisma.userWhitelist.updateMany({
      where: {
        factoryId: user.factoryId,
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    res.json(createSuccessResponse({
      updatedCount: result.count,
    }, '过期记录更新成功'));
  } catch (error) {
    next(error);
  }
};