import { PrismaClient } from '@prisma/client';
import { createSuccessResponse, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 获取生产计划列表
 * GET /api/mobile/production-plans
 */
export const getProductionPlans = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { page = 1, limit = 20, status, productTypeId, customerId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      factoryId,
      ...(status && { status }),
      ...(productTypeId && { productTypeId }),
      ...(customerId && { customerId }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [plans, total] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          productType: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              materialConsumptions: true,
              shipmentRecords: true,
            },
          },
        },
      }),
      prisma.productionPlan.count({ where }),
    ]);

    res.json(createSuccessResponse({
      plans,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit),
      },
    }, '获取生产计划列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取生产计划详情
 * GET /api/mobile/production-plans/:id
 */
export const getProductionPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const plan = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
      include: {
        productType: true,
        customer: true,
        creator: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        materialConsumptions: {
          include: {
            batch: {
              select: {
                id: true,
                batchNumber: true,
                rawMaterialCategory: true,
                rawMaterialWeight: true,
              },
            },
            recorder: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: { consumedAt: 'desc' },
        },
        shipmentRecords: {
          include: {
            recorder: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: { shippedAt: 'desc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundError('生产计划不存在');
    }

    res.json(createSuccessResponse(plan, '获取生产计划详情成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建生产计划
 * POST /api/mobile/production-plans
 */
export const createProductionPlan = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { productTypeId, customerId, plannedQuantity, selectedBatches, notes } = req.body;

    if (!productTypeId || !customerId || !plannedQuantity) {
      throw new ValidationError('产品类型、客户和计划产量不能为空');
    }

    if (plannedQuantity <= 0) {
      throw new ValidationError('计划产量必须大于0');
    }

    // 验证产品类型和客户是否存在
    const [productType, customer] = await Promise.all([
      prisma.productType.findFirst({
        where: { id: productTypeId, factoryId },
      }),
      prisma.customer.findFirst({
        where: { id: customerId, factoryId },
      }),
    ]);

    if (!productType) {
      throw new NotFoundError('产品类型不存在');
    }

    if (!customer) {
      throw new NotFoundError('客户不存在');
    }

    // 查询转换率以计算预估原料用量
    const conversion = await prisma.materialProductConversion.findFirst({
      where: {
        factoryId,
        productTypeId,
      },
      include: {
        materialType: true,
      },
    });

    let estimatedMaterialUsage = 0;
    if (conversion) {
      const conversionRate = parseFloat(conversion.conversionRate) / 100;
      const wastageRate = conversion.wastageRate ? parseFloat(conversion.wastageRate) / 100 : 0;
      const baseRequirement = plannedQuantity / conversionRate;
      estimatedMaterialUsage = baseRequirement * (1 + wastageRate);
    }

    // 生成生产计划编号
    const planNumber = await generatePlanNumber(factoryId);

    // 创建生产计划
    const plan = await prisma.productionPlan.create({
      data: {
        planNumber,
        factoryId,
        productTypeId,
        customerId,
        plannedQuantity: parseFloat(plannedQuantity),
        estimatedMaterialUsage: parseFloat(estimatedMaterialUsage.toFixed(2)),
        notes,
        createdBy: req.user?.id || 1,
      },
      include: {
        productType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 如果选择了批次，创建批次使用记录并预留库存
    if (selectedBatches && Array.isArray(selectedBatches) && selectedBatches.length > 0) {
      console.log(`📦 Processing ${selectedBatches.length} batch selections...`);

      for (const batchSelection of selectedBatches) {
        const { batchId, quantity, unitPrice } = batchSelection;

        // 验证批次是否存在且有足够库存
        const batch = await prisma.materialBatch.findUnique({
          where: { id: batchId },
        });

        if (!batch) {
          throw new NotFoundError(`批次 ${batchId} 不存在`);
        }

        if (parseFloat(batch.remainingQuantity) < quantity) {
          throw new ValidationError(`批次 ${batch.batchNumber} 库存不足`);
        }

        // 创建批次使用关联记录
        await prisma.productionPlanBatchUsage.create({
          data: {
            productionPlanId: plan.id,
            materialBatchId: batchId,
            plannedQuantity: parseFloat(quantity),
            unitPrice: parseFloat(unitPrice),
            totalCost: parseFloat((quantity * unitPrice).toFixed(2)),
          },
        });

        // 预留库存：增加reservedQuantity，减少remainingQuantity
        await prisma.materialBatch.update({
          where: { id: batchId },
          data: {
            reservedQuantity: {
              increment: parseFloat(quantity),
            },
            remainingQuantity: {
              decrement: parseFloat(quantity),
            },
            // 如果库存用完，更新状态
            ...(parseFloat(batch.remainingQuantity) - parseFloat(quantity) <= 0 && {
              status: 'depleted',
            }),
          },
        });

        console.log(`✅ Reserved ${quantity}kg from batch ${batch.batchNumber}`);
      }
    }

    res.status(201).json(createSuccessResponse(plan, '生产计划创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新生产计划
 * PUT /api/mobile/production-plans/:id
 */
export const updateProductionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { plannedQuantity, actualQuantity, notes, status } = req.body;

    const existing = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
    });

    if (!existing) {
      throw new NotFoundError('生产计划不存在');
    }

    if (existing.status === 'completed' || existing.status === 'shipped') {
      throw new ValidationError('已完成或已出货的生产计划不能修改');
    }

    const updated = await prisma.productionPlan.update({
      where: { id },
      data: {
        ...(plannedQuantity && { plannedQuantity: parseFloat(plannedQuantity) }),
        ...(actualQuantity !== undefined && { actualQuantity: actualQuantity ? parseFloat(actualQuantity) : null }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        productType: true,
        customer: true,
      },
    });

    res.json(createSuccessResponse(updated, '生产计划更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 开始生产
 * POST /api/mobile/production-plans/:id/start
 */
export const startProduction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const plan = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
    });

    if (!plan) {
      throw new NotFoundError('生产计划不存在');
    }

    if (plan.status !== 'pending') {
      throw new ValidationError('只有待生产状态的计划可以开始生产');
    }

    const updated = await prisma.productionPlan.update({
      where: { id },
      data: { status: 'in_progress' },
      include: {
        productType: true,
        customer: true,
      },
    });

    res.json(createSuccessResponse(updated, '生产已开始'));
  } catch (error) {
    next(error);
  }
};

/**
 * 完成生产
 * POST /api/mobile/production-plans/:id/complete
 */
export const completeProduction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { actualQuantity } = req.body;

    const plan = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
    });

    if (!plan) {
      throw new NotFoundError('生产计划不存在');
    }

    if (plan.status !== 'in_progress') {
      throw new ValidationError('只有生产中的计划可以完成');
    }

    if (!actualQuantity || actualQuantity <= 0) {
      throw new ValidationError('实际产量必须大于0');
    }

    const updated = await prisma.productionPlan.update({
      where: { id },
      data: {
        status: 'completed',
        actualQuantity: parseFloat(actualQuantity),
      },
      include: {
        productType: true,
        customer: true,
      },
    });

    res.json(createSuccessResponse(updated, '生产已完成'));
  } catch (error) {
    next(error);
  }
};

/**
 * 记录原料消耗
 * POST /api/mobile/production-plans/:id/consume-material
 */
export const consumeMaterial = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { batchId, consumedQuantity, notes } = req.body;

    if (!batchId || !consumedQuantity) {
      throw new ValidationError('批次ID和消耗量不能为空');
    }

    if (consumedQuantity <= 0) {
      throw new ValidationError('消耗量必须大于0');
    }

    // 验证生产计划
    const plan = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
    });

    if (!plan) {
      throw new NotFoundError('生产计划不存在');
    }

    if (plan.status === 'completed' || plan.status === 'shipped') {
      throw new ValidationError('已完成或已出货的计划不能再消耗原料');
    }

    // 验证批次
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    if (!batch.rawMaterialWeight) {
      throw new ValidationError('该批次没有原料重量信息');
    }

    // 计算批次已消耗量
    const consumptions = await prisma.materialConsumption.findMany({
      where: { batchId },
    });

    const totalConsumed = consumptions.reduce((sum, c) => sum + parseFloat(c.consumedQuantity), 0);
    const available = parseFloat(batch.rawMaterialWeight) - totalConsumed;

    if (consumedQuantity > available) {
      throw new ValidationError(`该批次可用原料不足。可用量: ${available.toFixed(2)}kg, 需要: ${consumedQuantity}kg`);
    }

    // 创建消耗记录
    const consumption = await prisma.materialConsumption.create({
      data: {
        planId: id,
        batchId,
        consumedQuantity: parseFloat(consumedQuantity),
        notes,
        recordedBy: req.user?.id || 1,
      },
      include: {
        batch: {
          select: {
            batchNumber: true,
            rawMaterialCategory: true,
          },
        },
      },
    });

    // 更新生产计划的实际原料用量
    const allConsumptions = await prisma.materialConsumption.findMany({
      where: { planId: id },
    });

    const actualMaterialUsed = allConsumptions.reduce((sum, c) => sum + parseFloat(c.consumedQuantity), 0);

    await prisma.productionPlan.update({
      where: { id },
      data: { actualMaterialUsed },
    });

    res.status(201).json(createSuccessResponse(consumption, '原料消耗记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取可用原料库存
 * GET /api/mobile/production-plans/available-stock
 */
export const getAvailableStock = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { productTypeId } = req.query;

    // 如果提供了productTypeId，返回该产品需要的原料库存
    if (productTypeId) {
      // 1. 查询转换率，获取需要的原料类型
      const conversion = await prisma.materialProductConversion.findFirst({
        where: {
          factoryId,
          productTypeId,
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
        },
      });

      if (!conversion) {
        return res.json(createSuccessResponse({
          materialType: null,
          batches: [],
          totalAvailable: 0,
          conversionRate: null,
          wastageRate: null,
        }, '未配置转换率'));
      }

      // 2. 查询该原料类型的所有可用批次
      const batches = await prisma.materialBatch.findMany({
        where: {
          factoryId,
          materialTypeId: conversion.materialTypeId,
          status: 'available',
          remainingQuantity: { gt: 0 },
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
        orderBy: [
          { inboundDate: 'asc' },  // FIFO: 先进先出
          { expiryDate: 'asc' },   // 快过期的优先
        ],
      });

      // 3. 计算总可用量
      const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remainingQuantity), 0);

      return res.json(createSuccessResponse({
        materialType: conversion.materialType,
        conversionRate: conversion.conversionRate,
        wastageRate: conversion.wastageRate,
        batches: batches.map(b => ({
          id: b.id,
          batchNumber: b.batchNumber,
          materialType: b.materialType,
          supplier: b.supplier,
          inboundQuantity: b.inboundQuantity,
          remainingQuantity: b.remainingQuantity,
          reservedQuantity: b.reservedQuantity,
          unitPrice: b.unitPrice,
          totalCost: b.totalCost,
          inboundDate: b.inboundDate,
          expiryDate: b.expiryDate,
          qualityGrade: b.qualityGrade,
        })),
        totalAvailable: parseFloat(totalAvailable.toFixed(2)),
      }, '获取可用库存成功'));
    }

    // 如果未提供productTypeId，返回所有原料的汇总
    const allBatches = await prisma.materialBatch.findMany({
      where: {
        factoryId,
        status: 'available',
        remainingQuantity: { gt: 0 },
      },
      include: {
        materialType: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });

    // 按原料类型汇总
    const summary = {};
    allBatches.forEach(batch => {
      const category = batch.materialType.category || '未分类';
      if (!summary[category]) {
        summary[category] = {
          category,
          totalAvailable: 0,
          batchCount: 0,
        };
      }
      summary[category].totalAvailable += parseFloat(batch.remainingQuantity);
      summary[category].batchCount += 1;
    });

    res.json(createSuccessResponse({
      summary: Object.values(summary),
      totalBatches: allBatches.length,
    }, '获取库存汇总成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 记录成品出库
 * POST /api/mobile/production-plans/:id/ship
 */
export const createShipment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { shippedQuantity, actualWeight, qualityGrade, shippedAt, notes } = req.body;

    if (!shippedQuantity || !actualWeight) {
      throw new ValidationError('出库数量和实际称重不能为空');
    }

    if (shippedQuantity <= 0 || actualWeight <= 0) {
      throw new ValidationError('出库数量和实际称重必须大于0');
    }

    // 验证生产计划
    const plan = await prisma.productionPlan.findFirst({
      where: { id, factoryId },
      include: {
        customer: true,
      },
    });

    if (!plan) {
      throw new NotFoundError('生产计划不存在');
    }

    if (plan.status !== 'completed') {
      throw new ValidationError('只有已完成的生产计划可以出库');
    }

    // 生成出库单号
    const shipmentNumber = await generateShipmentNumber(factoryId);

    const shipment = await prisma.shipmentRecord.create({
      data: {
        shipmentNumber,
        planId: id,
        customerId: plan.customerId,
        shippedQuantity: parseFloat(shippedQuantity),
        actualWeight: parseFloat(actualWeight),
        qualityGrade,
        shippedAt: shippedAt ? new Date(shippedAt) : new Date(),
        notes,
        recordedBy: req.user?.id || 1,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 更新生产计划状态为已出货
    await prisma.productionPlan.update({
      where: { id },
      data: { status: 'shipped' },
    });

    res.status(201).json(createSuccessResponse(shipment, '成品出库记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取出库记录列表
 * GET /api/mobile/shipments
 */
export const getShipments = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { page = 1, limit = 20, customerId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      plan: { factoryId },
      ...(customerId && { customerId }),
      ...(startDate && endDate && {
        shippedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [shipments, total] = await Promise.all([
      prisma.shipmentRecord.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { shippedAt: 'desc' },
        include: {
          plan: {
            select: {
              planNumber: true,
              productType: {
                select: {
                  name: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          recorder: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.shipmentRecord.count({ where }),
    ]);

    res.json(createSuccessResponse({
      shipments,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit),
      },
    }, '获取出库记录列表成功'));
  } catch (error) {
    next(error);
  }
};

// ==================== 辅助函数 ====================

/**
 * 生成生产计划编号
 */
async function generatePlanNumber(factoryId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const count = await prisma.productionPlan.count({
    where: {
      factoryId,
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(3, '0');
  return `PLAN-${dateStr}-${sequence}`;
}

/**
 * 生成出库单号
 */
async function generateShipmentNumber(factoryId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const count = await prisma.shipmentRecord.count({
    where: {
      plan: { factoryId },
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(3, '0');
  return `SHIP-${dateStr}-${sequence}`;
}

export default {
  getProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  updateProductionPlan,
  startProduction,
  completeProduction,
  consumeMaterial,
  getAvailableStock,
  createShipment,
  getShipments,
};
