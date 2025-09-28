import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { 
  getFactoryAccessScope, 
  safeGetFactoryId, 
  buildFactoryWhereClause,
  ensureFactoryIdInData,
  logFactoryAccess 
} from '../utils/factory-context-handler.js';

const prisma = new PrismaClient();

/**
 * 创建新批次
 * POST /api/mobile/processing/batches
 */
export const createBatch = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      productType,
      rawMaterials,
      startDate,
      productionLine,
      supervisorId,
      targetQuantity,
      notes
    } = req.body;

    // 生成批次编号
    const batchNumber = await generateBatchNumber(factoryId, productType);

    const batch = await prisma.processingBatch.create({
      data: {
        factoryId,
        batchNumber,
        productType,
        rawMaterials,
        startDate: new Date(startDate),
        productionLine,
        supervisorId,
        targetQuantity: targetQuantity ? parseFloat(targetQuantity) : null,
        notes,
        status: 'planning'
      },
      include: {
        supervisor: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    res.status(201).json(createSuccessResponse(batch, '批次创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批次列表
 * GET /api/mobile/processing/batches
 */
export const getBatches = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      page = 1,
      limit = 20,
      status,
      productType,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const where = {
      factoryId,
      ...(status && { status }),
      ...(productType && { productType: { contains: productType } }),
      ...(startDate && endDate && {
        startDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }),
      ...(search && {
        OR: [
          { batchNumber: { contains: search } },
          { productType: { contains: search } },
          { notes: { contains: search } }
        ]
      })
    };

    const [batches, total] = await Promise.all([
      prisma.processingBatch.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          supervisor: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          qualityInspections: {
            select: {
              id: true,
              overallResult: true,
              qualityScore: true
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.processingBatch.count({ where })
    ]);

    res.json(createSuccessResponse({
      batches,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取批次列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批次详情
 * GET /api/mobile/processing/batches/:id
 */
export const getBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);

    const batch = await prisma.processingBatch.findFirst({
      where: {
        id,
        factoryId
      },
      include: {
        supervisor: {
          select: {
            id: true,
            username: true,
            fullName: true,
            department: true
          }
        },
        qualityInspections: {
          include: {
            inspector: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
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
 * 更新批次信息
 * PUT /api/mobile/processing/batches/:id
 */
export const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);
    const {
      productType,
      rawMaterials,
      startDate,
      endDate,
      productionLine,
      supervisorId,
      targetQuantity,
      actualQuantity,
      qualityGrade,
      notes
    } = req.body;

    // 检查批次是否存在
    const existingBatch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!existingBatch) {
      throw new NotFoundError('批次不存在');
    }

    // 检查是否可以修改（已完成的批次可能限制修改）
    if (existingBatch.status === 'completed' && req.user.roleCode !== 'factory_super_admin') {
      throw new ValidationError('已完成的批次不能修改');
    }

    const updatedBatch = await prisma.processingBatch.update({
      where: { id },
      data: {
        ...(productType && { productType }),
        ...(rawMaterials && { rawMaterials }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(productionLine && { productionLine }),
        ...(supervisorId && { supervisorId }),
        ...(targetQuantity && { targetQuantity: parseFloat(targetQuantity) }),
        ...(actualQuantity && { actualQuantity: parseFloat(actualQuantity) }),
        ...(qualityGrade && { qualityGrade }),
        ...(notes !== undefined && { notes })
      },
      include: {
        supervisor: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    res.json(createSuccessResponse(updatedBatch, '批次更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除批次
 * DELETE /api/mobile/processing/batches/:id
 */
export const deleteBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);

    // 检查批次是否存在
    const batch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 检查是否可以删除
    if (batch.status === 'in_progress' || batch.status === 'completed') {
      throw new ValidationError('进行中或已完成的批次不能删除');
    }

    await prisma.processingBatch.delete({
      where: { id }
    });

    res.json(createSuccessResponse(null, '批次删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 开始生产
 * POST /api/mobile/processing/batches/:id/start
 */
export const startProduction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);

    const batch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    if (batch.status !== 'planning') {
      throw new ValidationError('只有计划中的批次可以开始生产');
    }

    const updatedBatch = await prisma.processingBatch.update({
      where: { id },
      data: {
        status: 'in_progress',
        startDate: new Date() // 更新实际开始时间
      }
    });

    res.json(createSuccessResponse(updatedBatch, '生产已开始'));
  } catch (error) {
    next(error);
  }
};

/**
 * 完成生产
 * POST /api/mobile/processing/batches/:id/complete
 */
export const completeProduction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);
    const { actualQuantity, qualityGrade, notes } = req.body;

    const batch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    if (batch.status !== 'in_progress' && batch.status !== 'quality_check') {
      throw new ValidationError('只有进行中或质检中的批次可以完成');
    }

    const updatedBatch = await prisma.processingBatch.update({
      where: { id },
      data: {
        status: 'completed',
        endDate: new Date(),
        ...(actualQuantity && { actualQuantity: parseFloat(actualQuantity) }),
        ...(qualityGrade && { qualityGrade }),
        ...(notes && { notes })
      }
    });

    res.json(createSuccessResponse(updatedBatch, '生产已完成'));
  } catch (error) {
    next(error);
  }
};

/**
 * 暂停生产
 * POST /api/mobile/processing/batches/:id/pause
 */
export const pauseProduction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);
    const { reason } = req.body;

    const batch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    if (batch.status !== 'in_progress') {
      throw new ValidationError('只有进行中的批次可以暂停');
    }

    const updatedBatch = await prisma.processingBatch.update({
      where: { id },
      data: {
        status: 'planning', // 回到计划状态
        notes: batch.notes ? `${batch.notes}\n暂停原因: ${reason}` : `暂停原因: ${reason}`
      }
    });

    res.json(createSuccessResponse(updatedBatch, '生产已暂停'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批次时间线
 * GET /api/mobile/processing/batches/:id/timeline
 */
export const getBatchTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = safeGetFactoryId(req);

    const batch = await prisma.processingBatch.findFirst({
      where: { id, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 构建时间线事件
    const timeline = [];

    // 创建事件
    timeline.push({
      type: 'created',
      title: '批次创建',
      description: `批次 ${batch.batchNumber} 创建`,
      timestamp: batch.createdAt,
      status: 'completed'
    });

    // 开始生产事件
    if (batch.status !== 'planning') {
      timeline.push({
        type: 'started',
        title: '开始生产',
        description: '批次进入生产阶段',
        timestamp: batch.startDate,
        status: 'completed'
      });
    }

    // 质检事件
    const qualityInspections = await prisma.qualityInspection.findMany({
      where: { batchId: id },
      include: {
        inspector: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    qualityInspections.forEach(inspection => {
      timeline.push({
        type: 'quality_check',
        title: '质量检测',
        description: `${inspection.inspector.fullName} 进行了${inspection.inspectionType}检测，结果：${inspection.overallResult}`,
        timestamp: inspection.createdAt,
        status: 'completed',
        data: {
          result: inspection.overallResult,
          score: inspection.qualityScore
        }
      });
    });

    // 完成事件
    if (batch.status === 'completed') {
      timeline.push({
        type: 'completed',
        title: '生产完成',
        description: `批次生产完成，产量：${batch.actualQuantity || '未记录'}`,
        timestamp: batch.endDate,
        status: 'completed'
      });
    }

    // 按时间排序
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(createSuccessResponse({
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status
      },
      timeline
    }, '获取批次时间线成功'));
  } catch (error) {
    next(error);
  }
};

// 辅助函数：生成批次编号
async function generateBatchNumber(factoryId, productType) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 获取今天的批次数量
  const count = await prisma.processingBatch.count({
    where: {
      factoryId,
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    }
  });

  const productCode = productType.slice(0, 2).toUpperCase();
  const sequence = String(count + 1).padStart(3, '0');
  
  return `${productCode}${dateStr}${sequence}`;
}

export default {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  startProduction,
  completeProduction,
  pauseProduction,
  getBatchTimeline
};