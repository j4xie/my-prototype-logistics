import { PrismaClient } from '@prisma/client';
import { createSuccessResponse, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 生成批次号
 * 格式: MAT-YYYYMMDD-XXX
 */
function generateBatchNumber(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 序号会在创建时通过数据库查询当天的批次数来生成
  return `MAT-${dateStr}`;
}

/**
 * 创建原材料批次（入库）
 * POST /api/mobile/material-batches
 */
export const createMaterialBatch = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const {
      materialTypeId,
      supplierId,
      quantity,
      unitPrice,
      inboundDate,
      expiryDate,
      productionDate,
      qualityGrade,
      storageLocation,
      notes,
    } = req.body;

    // 验证必填字段
    if (!materialTypeId) {
      throw new ValidationError('原材料类型不能为空');
    }
    if (!supplierId) {
      throw new ValidationError('供应商不能为空');
    }
    if (!quantity || quantity <= 0) {
      throw new ValidationError('入库数量必须大于0');
    }
    if (!unitPrice || unitPrice <= 0) {
      throw new ValidationError('单价必须大于0');
    }

    // 查询当天已有批次数，生成序号
    const datePrefix = generateBatchNumber(inboundDate ? new Date(inboundDate) : new Date());
    const todayBatches = await prisma.materialBatch.count({
      where: {
        factoryId,
        batchNumber: {
          startsWith: datePrefix,
        },
      },
    });

    const sequence = String(todayBatches + 1).padStart(3, '0');
    const batchNumber = `${datePrefix}-${sequence}`;

    // 计算总成本
    const totalCost = quantity * unitPrice;

    // 计算保质期（如果未提供但提供了天数）
    let calculatedExpiryDate = expiryDate;
    if (!calculatedExpiryDate && inboundDate && req.body.expiryDays) {
      const inbound = new Date(inboundDate);
      inbound.setDate(inbound.getDate() + parseInt(req.body.expiryDays));
      calculatedExpiryDate = inbound.toISOString().split('T')[0];
    }

    // 创建批次
    const batch = await prisma.materialBatch.create({
      data: {
        factoryId,
        batchNumber,
        materialTypeId,
        supplierId,
        inboundQuantity: quantity,
        remainingQuantity: quantity,
        reservedQuantity: 0,
        usedQuantity: 0,
        unitPrice,
        totalCost,
        inboundDate: inboundDate ? new Date(inboundDate) : new Date(),
        expiryDate: calculatedExpiryDate ? new Date(calculatedExpiryDate) : null,
        productionDate: productionDate ? new Date(productionDate) : null,
        status: 'available',
        qualityGrade,
        storageLocation,
        notes,
        createdBy: req.user?.id || 1,
      },
      include: {
        materialType: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
            contactPerson: true,
            contactPhone: true,
          },
        },
      },
    });

    console.log('✅ Material batch created:', batchNumber);

    res.status(201).json(createSuccessResponse(batch, '原材料批次创建成功'));
  } catch (error) {
    console.error('❌ Create batch error:', error);
    next(error);
  }
};

/**
 * 获取批次列表
 * GET /api/mobile/material-batches
 */
export const getMaterialBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const {
      page = 1,
      limit = 20,
      materialTypeId,
      supplierId,
      status,
      sortBy = 'inboundDate',
      sortOrder = 'desc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      factoryId,
      ...(materialTypeId && { materialTypeId }),
      ...(supplierId && { supplierId }),
      ...(status && { status }),
    };

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [batches, total] = await Promise.all([
      prisma.materialBatch.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
        include: {
          materialType: {
            select: {
              id: true,
              name: true,
              category: true,
              unit: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
              contactPerson: true,
              contactPhone: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.materialBatch.count({ where }),
    ]);

    res.json(createSuccessResponse({
      batches,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit),
      },
    }, '获取批次列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取可用批次（供MaterialBatchSelector使用）
 * GET /api/mobile/material-batches/available
 */
export const getAvailableBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { materialTypeId, requiredQuantity } = req.query;

    if (!materialTypeId) {
      throw new ValidationError('materialTypeId参数必填');
    }

    // 查询可用批次
    const batches = await prisma.materialBatch.findMany({
      where: {
        factoryId,
        materialTypeId,
        status: {
          in: ['available', 'reserved'],  // 可用或部分预留的批次
        },
        remainingQuantity: {
          gt: 0,  // 剩余数量大于0
        },
      },
      orderBy: [
        { inboundDate: 'asc' },  // 先进先出：按入库日期升序
      ],
      include: {
        materialType: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
            contactPerson: true,
            contactPhone: true,
          },
        },
      },
    });

    // 计算智能推荐方案
    const recommendations = calculateRecommendations(batches, parseFloat(requiredQuantity) || 0);

    res.json(createSuccessResponse({
      batches,
      recommendations,
      summary: {
        totalBatches: batches.length,
        totalAvailable: batches.reduce((sum, b) => sum + parseFloat(b.remainingQuantity), 0),
        requiredQuantity: parseFloat(requiredQuantity) || 0,
      },
    }, '获取可用批次成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 智能推荐算法
 */
function calculateRecommendations(batches, requiredQuantity) {
  if (!batches.length || !requiredQuantity) {
    return {
      fifo: [],      // 先进先出
      costOptimal: [], // 成本最优
    };
  }

  // 方案1: 先进先出 (FIFO - First In First Out)
  const fifo = [];
  let fifoRemaining = requiredQuantity;
  const sortedByDate = [...batches].sort((a, b) => new Date(a.inboundDate) - new Date(b.inboundDate));

  for (const batch of sortedByDate) {
    if (fifoRemaining <= 0) break;
    const available = parseFloat(batch.remainingQuantity);
    const useQuantity = Math.min(available, fifoRemaining);
    fifo.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: useQuantity,
      unitPrice: parseFloat(batch.unitPrice),
      totalCost: useQuantity * parseFloat(batch.unitPrice),
      merchantName: batch.merchant.name,
      inboundDate: batch.inboundDate,
      expiryDate: batch.expiryDate,
    });
    fifoRemaining -= useQuantity;
  }

  // 方案2: 成本最优
  const costOptimal = [];
  let costRemaining = requiredQuantity;
  const sortedByPrice = [...batches].sort((a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice));

  for (const batch of sortedByPrice) {
    if (costRemaining <= 0) break;
    const available = parseFloat(batch.remainingQuantity);
    const useQuantity = Math.min(available, costRemaining);
    costOptimal.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: useQuantity,
      unitPrice: parseFloat(batch.unitPrice),
      totalCost: useQuantity * parseFloat(batch.unitPrice),
      merchantName: batch.merchant.name,
      inboundDate: batch.inboundDate,
      expiryDate: batch.expiryDate,
    });
    costRemaining -= useQuantity;
  }

  // 计算总成本
  const fifoTotalCost = fifo.reduce((sum, b) => sum + b.totalCost, 0);
  const costOptimalTotalCost = costOptimal.reduce((sum, b) => sum + b.totalCost, 0);

  return {
    fifo: {
      batches: fifo,
      totalCost: fifoTotalCost,
      description: '先进先出方案（优先使用入库早的批次）',
      advantage: '降低过期风险，符合库存管理最佳实践',
    },
    costOptimal: {
      batches: costOptimal,
      totalCost: costOptimalTotalCost,
      description: '成本最优方案（优先使用单价低的批次）',
      advantage: `节省成本 ¥${(fifoTotalCost - costOptimalTotalCost).toFixed(2)}`,
      warning: fifoTotalCost > costOptimalTotalCost ? '可能增加过期风险' : null,
    },
  };
}

/**
 * 预留批次（创建生产计划时）
 * POST /api/mobile/material-batches/reserve
 */
export const reserveBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { batchUsages } = req.body;  // [{ batchId, quantity }]

    if (!Array.isArray(batchUsages) || batchUsages.length === 0) {
      throw new ValidationError('批次使用信息不能为空');
    }

    // 使用事务处理
    const results = await prisma.$transaction(async (tx) => {
      const updated = [];

      for (const usage of batchUsages) {
        const { batchId, quantity } = usage;

        // 查询批次
        const batch = await tx.materialBatch.findFirst({
          where: { id: batchId, factoryId },
        });

        if (!batch) {
          throw new NotFoundError(`批次 ${batchId} 不存在`);
        }

        // 检查可用量
        if (parseFloat(batch.remainingQuantity) < quantity) {
          throw new ValidationError(
            `批次 ${batch.batchNumber} 可用量不足。可用: ${batch.remainingQuantity}kg, 需要: ${quantity}kg`
          );
        }

        // 更新批次
        const updatedBatch = await tx.materialBatch.update({
          where: { id: batchId },
          data: {
            reservedQuantity: { increment: quantity },
            remainingQuantity: { decrement: quantity },
            status: parseFloat(batch.remainingQuantity) - quantity <= 0 ? 'depleted' : 'reserved',
          },
        });

        updated.push(updatedBatch);
      }

      return updated;
    });

    console.log(`✅ Reserved ${batchUsages.length} batches`);

    res.json(createSuccessResponse({
      batches: results,
      count: results.length,
    }, '批次预留成功'));
  } catch (error) {
    console.error('❌ Reserve batches error:', error);
    next(error);
  }
};

/**
 * 释放批次预留（取消计划时）
 * POST /api/mobile/material-batches/release
 */
export const releaseBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { batchUsages } = req.body;  // [{ batchId, quantity }]

    if (!Array.isArray(batchUsages) || batchUsages.length === 0) {
      throw new ValidationError('批次使用信息不能为空');
    }

    // 使用事务处理
    const results = await prisma.$transaction(async (tx) => {
      const updated = [];

      for (const usage of batchUsages) {
        const { batchId, quantity } = usage;

        // 查询批次
        const batch = await tx.materialBatch.findFirst({
          where: { id: batchId, factoryId },
        });

        if (!batch) {
          throw new NotFoundError(`批次 ${batchId} 不存在`);
        }

        // 更新批次（释放预留）
        const updatedBatch = await tx.materialBatch.update({
          where: { id: batchId },
          data: {
            reservedQuantity: { decrement: quantity },
            remainingQuantity: { increment: quantity },
            status: 'available',  // 释放后恢复为可用
          },
        });

        updated.push(updatedBatch);
      }

      return updated;
    });

    console.log(`✅ Released ${batchUsages.length} batches`);

    res.json(createSuccessResponse({
      batches: results,
      count: results.length,
    }, '批次释放成功'));
  } catch (error) {
    console.error('❌ Release batches error:', error);
    next(error);
  }
};

/**
 * 消耗批次（生产完成时）
 * POST /api/mobile/material-batches/consume
 */
export const consumeBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { batchUsages } = req.body;  // [{ batchId, quantity }]

    if (!Array.isArray(batchUsages) || batchUsages.length === 0) {
      throw new ValidationError('批次使用信息不能为空');
    }

    const results = await prisma.$transaction(async (tx) => {
      const updated = [];

      for (const usage of batchUsages) {
        const { batchId, quantity } = usage;

        const batch = await tx.materialBatch.findFirst({
          where: { id: batchId, factoryId },
        });

        if (!batch) {
          throw new NotFoundError(`批次 ${batchId} 不存在`);
        }

        // 更新批次（从预留转为已使用）
        const updatedBatch = await tx.materialBatch.update({
          where: { id: batchId },
          data: {
            reservedQuantity: { decrement: quantity },
            usedQuantity: { increment: quantity },
            // remainingQuantity 保持不变（因为已经在预留时扣减过了）
            status: parseFloat(batch.reservedQuantity) - quantity <= 0 && parseFloat(batch.remainingQuantity) <= 0
              ? 'depleted'
              : batch.status,
          },
        });

        updated.push(updatedBatch);
      }

      return updated;
    });

    console.log(`✅ Consumed ${batchUsages.length} batches`);

    res.json(createSuccessResponse({
      batches: results,
      count: results.length,
    }, '批次消耗记录成功'));
  } catch (error) {
    console.error('❌ Consume batches error:', error);
    next(error);
  }
};

/**
 * 获取批次详情
 * GET /api/mobile/material-batches/:id
 */
export const getMaterialBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const batch = await prisma.materialBatch.findFirst({
      where: { id, factoryId },
      include: {
        materialType: true,
        supplier: true,
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        planUsages: {
          include: {
            productionPlan: {
              select: {
                id: true,
                planNumber: true,
                status: true,
              },
            },
          },
        },
        adjustments: {
          include: {
            adjuster: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: { adjustedAt: 'desc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    res.json(createSuccessResponse(batch, '获取批次详情成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 检查即将过期的批次
 * GET /api/mobile/material-batches/expiring
 */
export const getExpiringBatches = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { days = 3 } = req.query;  // 默认3天内过期

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const batches = await prisma.materialBatch.findMany({
      where: {
        factoryId,
        status: {
          in: ['available', 'reserved'],
        },
        remainingQuantity: {
          gt: 0,
        },
        expiryDate: {
          lte: futureDate,
          gte: new Date(),  // 还未过期
        },
      },
      orderBy: {
        expiryDate: 'asc',  // 按过期日期升序
      },
      include: {
        materialType: {
          select: {
            id: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(createSuccessResponse({
      batches,
      count: batches.length,
      days: parseInt(days),
    }, `查询到 ${batches.length} 个即将过期的批次`));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批次库存汇总
 * GET /api/mobile/material-batches/summary
 */
export const getBatchesSummary = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    // 按原材料类型汇总
    const summary = await prisma.materialBatch.groupBy({
      by: ['materialTypeId', 'status'],
      where: {
        factoryId,
      },
      _sum: {
        inboundQuantity: true,
        remainingQuantity: true,
        reservedQuantity: true,
        usedQuantity: true,
        totalCost: true,
      },
      _count: {
        id: true,
      },
    });

    // 获取原材料类型名称
    const materialTypeIds = [...new Set(summary.map(s => s.materialTypeId))];
    const materialTypes = await prisma.rawMaterialType.findMany({
      where: {
        id: {
          in: materialTypeIds,
        },
      },
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
      },
    });

    const materialTypeMap = {};
    materialTypes.forEach(mt => {
      materialTypeMap[mt.id] = mt;
    });

    // 格式化结果
    const formatted = summary.map(s => ({
      materialType: materialTypeMap[s.materialTypeId],
      status: s.status,
      batchCount: s._count.id,
      totalInbound: s._sum.inboundQuantity,
      totalRemaining: s._sum.remainingQuantity,
      totalReserved: s._sum.reservedQuantity,
      totalUsed: s._sum.usedQuantity,
      totalCost: s._sum.totalCost,
    }));

    res.json(createSuccessResponse({
      summary: formatted,
      count: formatted.length,
    }, '获取库存汇总成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  createMaterialBatch,
  getMaterialBatches,
  getAvailableBatches,
  reserveBatches,
  releaseBatches,
  consumeBatches,
  getMaterialBatchById,
  getExpiringBatches,
  getBatchesSummary,
};
