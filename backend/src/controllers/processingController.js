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

/**
 * 创建原材料接收记录（工作流程1）
 * POST /api/mobile/processing/material-receipt
 */
export const createMaterialReceipt = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      rawMaterialCategory, // 鱼类品种
      rawMaterialWeight,   // 进货重量
      rawMaterialCost,     // 进货成本
      productCategory,     // 产品类型: fresh/frozen
      expectedPrice,       // 预期售价
      notes
    } = req.body;

    // 验证必填字段
    if (!rawMaterialCategory || !rawMaterialWeight || !rawMaterialCost || !productCategory) {
      throw new ValidationError('鱼类品种、进货重量、进货成本和产品类型为必填项');
    }

    // 验证产品类型
    if (!['fresh', 'frozen'].includes(productCategory)) {
      throw new ValidationError('产品类型必须是 fresh（鲜鱼）或 frozen（冻鱼）');
    }

    // 生成批次编号
    const batchNumber = await generateBatchNumber(factoryId, rawMaterialCategory);

    // 创建批次记录，包含原材料信息
    const batch = await prisma.processingBatch.create({
      data: {
        factoryId,
        batchNumber,
        productType: rawMaterialCategory,
        rawMaterials: {
          category: rawMaterialCategory,
          weight: parseFloat(rawMaterialWeight),
          cost: parseFloat(rawMaterialCost),
          receivedAt: new Date().toISOString()
        },
        rawMaterialCategory,
        rawMaterialWeight: parseFloat(rawMaterialWeight),
        rawMaterialCost: parseFloat(rawMaterialCost),
        productCategory,
        expectedPrice: expectedPrice ? parseFloat(expectedPrice) : null,
        startDate: new Date(),
        status: 'planning',
        notes
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

    res.status(201).json(createSuccessResponse(batch, '原材料接收记录创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取原材料接收记录列表
 * GET /api/mobile/processing/materials
 */
export const getMaterialReceipts = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      page = 1,
      limit = 20,
      productCategory,
      rawMaterialCategory,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件 - 只查询有原材料信息的批次
    const where = {
      factoryId,
      rawMaterialCategory: { not: null },
      ...(productCategory && { productCategory }),
      ...(rawMaterialCategory && { rawMaterialCategory: { contains: rawMaterialCategory } }),
      ...(startDate && endDate && {
        startDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [materials, total] = await Promise.all([
      prisma.processingBatch.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          batchNumber: true,
          rawMaterialCategory: true,
          rawMaterialWeight: true,
          rawMaterialCost: true,
          productCategory: true,
          expectedPrice: true,
          totalCost: true,
          profitMargin: true,
          profitRate: true,
          status: true,
          startDate: true,
          createdAt: true,
          notes: true
        }
      }),
      prisma.processingBatch.count({ where })
    ]);

    res.json(createSuccessResponse({
      materials,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取原材料列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新批次原材料信息
 * PUT /api/mobile/processing/material-receipt/:batchId
 */
export const updateMaterialReceipt = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const factoryId = safeGetFactoryId(req);
    const {
      rawMaterialCategory,
      rawMaterialWeight,
      rawMaterialCost,
      productCategory,
      expectedPrice,
      notes
    } = req.body;

    // 检查批次是否存在
    const existingBatch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId }
    });

    if (!existingBatch) {
      throw new NotFoundError('批次不存在');
    }

    // 只有planning状态的批次可以修改原材料信息
    if (existingBatch.status !== 'planning') {
      throw new ValidationError('只有计划中的批次可以修改原材料信息');
    }

    const updatedBatch = await prisma.processingBatch.update({
      where: { id: batchId },
      data: {
        ...(rawMaterialCategory && { rawMaterialCategory }),
        ...(rawMaterialWeight && { rawMaterialWeight: parseFloat(rawMaterialWeight) }),
        ...(rawMaterialCost && { rawMaterialCost: parseFloat(rawMaterialCost) }),
        ...(productCategory && { productCategory }),
        ...(expectedPrice !== undefined && { expectedPrice: expectedPrice ? parseFloat(expectedPrice) : null }),
        ...(notes !== undefined && { notes })
      }
    });

    res.json(createSuccessResponse(updatedBatch, '原材料信息更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 员工上班打卡（工作流程2 - 开始）
 * POST /api/mobile/processing/work-session/clock-in
 */
export const clockIn = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const userId = req.user.id;
    const {
      batchId,
      workTypeId,
      notes
    } = req.body;

    // 验证必填字段
    if (!batchId) {
      throw new ValidationError('批次ID为必填项');
    }

    // 检查批次是否存在
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 检查用户是否已经打卡（未打卡下班）
    const activeSession = await prisma.batchWorkSession.findFirst({
      where: {
        userId,
        batchId,
        endTime: null
      }
    });

    if (activeSession) {
      throw new ValidationError('您已经打卡上班，请先打卡下班');
    }

    // 获取用户信息（获取CCR rate）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        monthlySalary: true,
        expectedWorkMinutes: true,
        ccrRate: true
      }
    });

    // 计算CCR rate（如果用户没有预设CCR）
    let ccrRate = user.ccrRate;
    if (!ccrRate && user.monthlySalary && user.expectedWorkMinutes) {
      ccrRate = parseFloat(user.monthlySalary) / user.expectedWorkMinutes;
    }

    if (!ccrRate) {
      throw new ValidationError('无法计算CCR成本率，请先设置员工薪资和预期工作时长');
    }

    // 创建工作时段记录
    const workSession = await prisma.batchWorkSession.create({
      data: {
        batchId,
        userId,
        workTypeId,
        startTime: new Date(),
        ccrRate,
        notes
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            department: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        },
        workType: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json(createSuccessResponse(workSession, '上班打卡成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 员工下班打卡（工作流程2 - 结束）
 * POST /api/mobile/processing/work-session/clock-out
 */
export const clockOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      sessionId,
      processedQuantity,
      notes
    } = req.body;

    // 如果提供了sessionId，使用该ID；否则查找用户最近的活动session
    let workSession;
    if (sessionId) {
      workSession = await prisma.batchWorkSession.findFirst({
        where: {
          id: sessionId,
          userId,
          endTime: null
        }
      });
    } else {
      workSession = await prisma.batchWorkSession.findFirst({
        where: {
          userId,
          endTime: null
        },
        orderBy: { startTime: 'desc' }
      });
    }

    if (!workSession) {
      throw new NotFoundError('未找到活动的工作时段，请先打卡上班');
    }

    // 计算工作时长（分钟）
    const endTime = new Date();
    const totalMinutes = Math.floor((endTime - new Date(workSession.startTime)) / 1000 / 60);

    // 计算人工成本
    const laborCost = workSession.ccrRate * totalMinutes;

    // 更新工作时段记录
    const updatedSession = await prisma.batchWorkSession.update({
      where: { id: workSession.id },
      data: {
        endTime,
        totalMinutes,
        processedQuantity: processedQuantity ? parseFloat(processedQuantity) : null,
        laborCost,
        notes: notes || workSession.notes
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            department: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        },
        workType: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 更新批次的总人工成本
    await updateBatchLaborCost(workSession.batchId);

    res.json(createSuccessResponse(updatedSession, '下班打卡成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取员工工作时段列表
 * GET /api/mobile/processing/work-sessions
 */
export const getWorkSessions = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      page = 1,
      limit = 20,
      batchId,
      userId,
      startDate,
      endDate,
      activeOnly
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      batch: { factoryId },
      ...(batchId && { batchId }),
      ...(userId && { userId: parseInt(userId) }),
      ...(activeOnly === 'true' && { endTime: null }),
      ...(startDate && endDate && {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [sessions, total] = await Promise.all([
      prisma.batchWorkSession.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startTime: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              department: true
            }
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              productType: true
            }
          },
          workType: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.batchWorkSession.count({ where })
    ]);

    res.json(createSuccessResponse({
      sessions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取工作时段列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户的活动工作时段
 * GET /api/mobile/processing/work-session/active
 */
export const getActiveWorkSession = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activeSession = await prisma.batchWorkSession.findFirst({
      where: {
        userId,
        endTime: null
      },
      orderBy: { startTime: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            department: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true,
            rawMaterialCategory: true
          }
        },
        workType: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!activeSession) {
      return res.json(createSuccessResponse(null, '当前无活动工作时段'));
    }

    // 计算当前已工作时长
    const currentMinutes = Math.floor((new Date() - new Date(activeSession.startTime)) / 1000 / 60);
    const estimatedCost = activeSession.ccrRate * currentMinutes;

    res.json(createSuccessResponse({
      ...activeSession,
      currentMinutes,
      estimatedCost
    }, '获取活动工作时段成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 开始设备使用（工作流程3 - 开始）
 * POST /api/mobile/processing/equipment-usage/start
 */
export const startEquipmentUsage = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      batchId,
      equipmentId,
      notes
    } = req.body;

    // 验证必填字段
    if (!batchId || !equipmentId) {
      throw new ValidationError('批次ID和设备ID为必填项');
    }

    // 检查批次是否存在
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 检查设备是否存在
    const equipment = await prisma.factoryEquipment.findFirst({
      where: { id: equipmentId, factoryId }
    });

    if (!equipment) {
      throw new NotFoundError('设备不存在');
    }

    // 检查设备是否正在被使用
    const activeUsage = await prisma.batchEquipmentUsage.findFirst({
      where: {
        equipmentId,
        endTime: null
      }
    });

    if (activeUsage) {
      throw new ValidationError('该设备正在被使用中');
    }

    // 创建设备使用记录
    const equipmentUsage = await prisma.batchEquipmentUsage.create({
      data: {
        batchId,
        equipmentId,
        startTime: new Date(),
        notes
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        },
        equipment: {
          select: {
            id: true,
            name: true,
            equipmentType: true,
            hourlyOperationCost: true
          }
        }
      }
    });

    res.status(201).json(createSuccessResponse(equipmentUsage, '设备使用开始记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 结束设备使用（工作流程3 - 结束）
 * POST /api/mobile/processing/equipment-usage/end
 */
export const endEquipmentUsage = async (req, res, next) => {
  try {
    const {
      usageId,
      notes
    } = req.body;

    // 查找使用记录
    const usage = await prisma.batchEquipmentUsage.findUnique({
      where: { id: usageId },
      include: {
        equipment: {
          select: {
            hourlyOperationCost: true
          }
        }
      }
    });

    if (!usage) {
      throw new NotFoundError('设备使用记录不存在');
    }

    if (usage.endTime) {
      throw new ValidationError('该设备使用记录已结束');
    }

    // 计算使用时长（分钟）
    const endTime = new Date();
    const usageDuration = Math.floor((endTime - new Date(usage.startTime)) / 1000 / 60);

    // 计算设备成本
    let equipmentCost = 0;
    if (usage.equipment.hourlyOperationCost) {
      equipmentCost = (usage.equipment.hourlyOperationCost / 60) * usageDuration;
    }

    // 更新设备使用记录
    const updatedUsage = await prisma.batchEquipmentUsage.update({
      where: { id: usageId },
      data: {
        endTime,
        usageDuration,
        equipmentCost,
        notes: notes || usage.notes
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        },
        equipment: {
          select: {
            id: true,
            name: true,
            equipmentType: true
          }
        }
      }
    });

    // 更新批次的总设备成本
    await updateBatchEquipmentCost(usage.batchId);

    res.json(createSuccessResponse(updatedUsage, '设备使用结束记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取设备使用记录列表
 * GET /api/mobile/processing/equipment-usage
 */
export const getEquipmentUsageRecords = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      page = 1,
      limit = 20,
      batchId,
      equipmentId,
      startDate,
      endDate,
      activeOnly
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      batch: { factoryId },
      ...(batchId && { batchId }),
      ...(equipmentId && { equipmentId }),
      ...(activeOnly === 'true' && { endTime: null }),
      ...(startDate && endDate && {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [usageRecords, total] = await Promise.all([
      prisma.batchEquipmentUsage.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startTime: 'desc' },
        include: {
          batch: {
            select: {
              id: true,
              batchNumber: true,
              productType: true
            }
          },
          equipment: {
            select: {
              id: true,
              name: true,
              equipmentType: true
            }
          }
        }
      }),
      prisma.batchEquipmentUsage.count({ where })
    ]);

    res.json(createSuccessResponse({
      usageRecords,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取设备使用记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批次成本分析
 * GET /api/mobile/processing/batches/:batchId/cost-analysis
 */
export const getBatchCostAnalysis = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const factoryId = safeGetFactoryId(req);

    // 获取批次基本信息
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId },
      include: {
        supervisor: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 获取工作时段详情
    const workSessions = await prisma.batchWorkSession.findMany({
      where: { batchId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            department: true
          }
        },
        workType: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 获取设备使用详情
    const equipmentUsages = await prisma.batchEquipmentUsage.findMany({
      where: { batchId },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            equipmentType: true
          }
        }
      }
    });

    // 计算工作时段统计
    const laborStats = {
      totalSessions: workSessions.length,
      completedSessions: workSessions.filter(s => s.endTime).length,
      activeSessions: workSessions.filter(s => !s.endTime).length,
      totalMinutes: workSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0),
      totalLaborCost: workSessions.reduce((sum, s) => sum + (s.laborCost || 0), 0),
      totalQuantityProcessed: workSessions.reduce((sum, s) => sum + (parseFloat(s.processedQuantity) || 0), 0),
      workerDetails: workSessions.map(session => ({
        workerId: session.user.id,
        workerName: session.user.fullName,
        department: session.user.department,
        workType: session.workType?.name,
        startTime: session.startTime,
        endTime: session.endTime,
        totalMinutes: session.totalMinutes,
        processedQuantity: session.processedQuantity,
        ccrRate: session.ccrRate,
        laborCost: session.laborCost
      }))
    };

    // 计算设备使用统计
    const equipmentStats = {
      totalUsages: equipmentUsages.length,
      completedUsages: equipmentUsages.filter(u => u.endTime).length,
      activeUsages: equipmentUsages.filter(u => !u.endTime).length,
      totalDuration: equipmentUsages.reduce((sum, u) => sum + (u.usageDuration || 0), 0),
      totalEquipmentCost: equipmentUsages.reduce((sum, u) => sum + (u.equipmentCost || 0), 0),
      equipmentDetails: equipmentUsages.map(usage => ({
        equipmentId: usage.equipment.id,
        equipmentName: usage.equipment.name,
        equipmentType: usage.equipment.equipmentType,
        startTime: usage.startTime,
        endTime: usage.endTime,
        usageDuration: usage.usageDuration,
        equipmentCost: usage.equipmentCost
      }))
    };

    // 成本结构分析
    const totalCost = (batch.rawMaterialCost || 0) + (batch.laborCost || 0) + (batch.equipmentCost || 0);
    const costBreakdown = {
      rawMaterialCost: batch.rawMaterialCost || 0,
      rawMaterialPercentage: totalCost > 0 ? ((batch.rawMaterialCost || 0) / totalCost * 100).toFixed(2) : 0,
      laborCost: batch.laborCost || 0,
      laborPercentage: totalCost > 0 ? ((batch.laborCost || 0) / totalCost * 100).toFixed(2) : 0,
      equipmentCost: batch.equipmentCost || 0,
      equipmentPercentage: totalCost > 0 ? ((batch.equipmentCost || 0) / totalCost * 100).toFixed(2) : 0,
      totalCost
    };

    // 利润分析
    const expectedRevenue = batch.expectedPrice && batch.rawMaterialWeight
      ? batch.expectedPrice * batch.rawMaterialWeight
      : null;

    const profitAnalysis = {
      expectedPrice: batch.expectedPrice,
      rawMaterialWeight: batch.rawMaterialWeight,
      expectedRevenue,
      totalCost,
      profitMargin: batch.profitMargin,
      profitRate: batch.profitRate,
      breakEvenPrice: batch.rawMaterialWeight > 0
        ? (totalCost / batch.rawMaterialWeight).toFixed(2)
        : null
    };

    res.json(createSuccessResponse({
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        productType: batch.productType,
        rawMaterialCategory: batch.rawMaterialCategory,
        productCategory: batch.productCategory,
        status: batch.status,
        supervisor: batch.supervisor,
        startDate: batch.startDate,
        endDate: batch.endDate
      },
      laborStats,
      equipmentStats,
      costBreakdown,
      profitAnalysis
    }, '获取批次成本分析成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 重新计算批次成本
 * POST /api/mobile/processing/batches/:batchId/recalculate-cost
 */
export const recalculateBatchCost = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const factoryId = safeGetFactoryId(req);

    // 检查批次是否存在
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 重新计算人工成本
    await updateBatchLaborCost(batchId);

    // 重新计算设备成本
    await updateBatchEquipmentCost(batchId);

    // 获取更新后的批次信息
    const updatedBatch = await prisma.processingBatch.findUnique({
      where: { id: batchId }
    });

    res.json(createSuccessResponse(updatedBatch, '批次成本重新计算成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 记录设备维修
 * POST /api/mobile/processing/equipment-maintenance
 */
export const recordEquipmentMaintenance = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      equipmentId,
      maintenanceType,
      cost,
      description,
      performedBy,
      durationMinutes,
      partsReplaced,
      nextScheduledDate
    } = req.body;

    // 验证必填字段
    if (!equipmentId || !maintenanceType || !cost) {
      throw new ValidationError('设备ID、维修类型和成本为必填项');
    }

    // 检查设备是否存在
    const equipment = await prisma.factoryEquipment.findFirst({
      where: { id: equipmentId, factoryId }
    });

    if (!equipment) {
      throw new NotFoundError('设备不存在');
    }

    // 创建维修记录
    const maintenanceRecord = await prisma.equipmentMaintenance.create({
      data: {
        equipmentId,
        maintenanceDate: new Date(),
        maintenanceType,
        cost: parseFloat(cost),
        description,
        performedBy,
        durationMinutes,
        partsReplaced,
        nextScheduledDate: nextScheduledDate ? new Date(nextScheduledDate) : null
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            equipmentType: true
          }
        }
      }
    });

    // 更新设备的维修统计
    const maintenanceCount = equipment.maintenanceCount + 1;
    const totalMaintenanceCost = (equipment.totalMaintenanceCost || 0) + parseFloat(cost);

    await prisma.factoryEquipment.update({
      where: { id: equipmentId },
      data: {
        maintenanceCount,
        totalMaintenanceCost,
        lastMaintenanceDate: new Date()
      }
    });

    res.status(201).json(createSuccessResponse(maintenanceRecord, '设备维修记录创建成功'));
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

// 辅助函数：更新批次的总人工成本
async function updateBatchLaborCost(batchId) {
  const workSessions = await prisma.batchWorkSession.findMany({
    where: { batchId, endTime: { not: null } }
  });

  const totalLaborCost = workSessions.reduce((sum, session) => {
    return sum + (session.laborCost || 0);
  }, 0);

  await prisma.processingBatch.update({
    where: { id: batchId },
    data: { laborCost: totalLaborCost }
  });

  // 更新总成本
  await updateBatchTotalCost(batchId);
}

// 辅助函数：更新批次的总设备成本
async function updateBatchEquipmentCost(batchId) {
  const equipmentUsages = await prisma.batchEquipmentUsage.findMany({
    where: { batchId, endTime: { not: null } }
  });

  const totalEquipmentCost = equipmentUsages.reduce((sum, usage) => {
    return sum + (usage.equipmentCost || 0);
  }, 0);

  await prisma.processingBatch.update({
    where: { id: batchId },
    data: { equipmentCost: totalEquipmentCost }
  });

  // 更新总成本
  await updateBatchTotalCost(batchId);
}

// 辅助函数：更新批次总成本和利润
async function updateBatchTotalCost(batchId) {
  const batch = await prisma.processingBatch.findUnique({
    where: { id: batchId },
    select: {
      rawMaterialCost: true,
      laborCost: true,
      equipmentCost: true,
      expectedPrice: true,
      rawMaterialWeight: true
    }
  });

  if (!batch) return;

  // 计算总成本 = 原材料成本 + 人工成本 + 设备成本
  const totalCost = (batch.rawMaterialCost || 0) + (batch.laborCost || 0) + (batch.equipmentCost || 0);

  // 计算利润和利润率
  let profitMargin = null;
  let profitRate = null;

  if (batch.expectedPrice && batch.rawMaterialWeight) {
    const expectedRevenue = batch.expectedPrice * batch.rawMaterialWeight;
    profitMargin = expectedRevenue - totalCost;
    profitRate = totalCost > 0 ? (profitMargin / totalCost) * 100 : 0;
  }

  await prisma.processingBatch.update({
    where: { id: batchId },
    data: {
      totalCost,
      profitMargin,
      profitRate
    }
  });
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
  getBatchTimeline,
  createMaterialReceipt,
  getMaterialReceipts,
  updateMaterialReceipt,
  clockIn,
  clockOut,
  getWorkSessions,
  getActiveWorkSession,
  startEquipmentUsage,
  endEquipmentUsage,
  getEquipmentUsageRecords,
  recordEquipmentMaintenance,
  getBatchCostAnalysis,
  recalculateBatchCost,
  
};

/**
 * AI成本分析
 * POST /api/mobile/processing/ai-cost-analysis
 */
export const getAICostAnalysis = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const { batchId, question, session_id } = req.body;

    // 验证批次存在
    const batch = await prisma.processingBatch.findFirst({
      where: { id: batchId, factoryId }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 获取完整成本分析数据
    const costAnalysis = await getCostAnalysisData(batchId, factoryId);

    // 格式化为AI提示
    const prompt = formatCostDataForAI(costAnalysis, question);

    // 调用AI服务
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8085';
    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        session_id: session_id || undefined,
        user_id: `factory_${factoryId}_batch_${batchId}`
      })
    });

    if (!aiResponse.ok) {
      throw new AppError('AI服务调用失败', 500);
    }

    const aiResult = await aiResponse.json();

    res.json(createSuccessResponse({
      analysis: aiResult.reply,
      session_id: aiResult.session_id,
      message_count: aiResult.message_count
    }));

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return next(new AppError('AI分析服务暂时不可用，请稍后重试', 503));
    }
    next(error);
  }
};

/**
 * 获取成本分析数据（用于AI分析）
 */
async function getCostAnalysisData(batchId, factoryId) {
  const batch = await prisma.processingBatch.findFirst({
    where: { id: batchId, factoryId }
  });

  const workSessions = await prisma.batchWorkSession.findMany({
    where: { batchId },
    include: {
      user: { select: { fullName: true } },
      workType: { select: { name: true } }
    }
  });

  const equipmentUsages = await prisma.batchEquipmentUsage.findMany({
    where: { batchId },
    include: {
      equipment: { select: { name: true } }
    }
  });

  // 计算统计数据
  const laborStats = {
    totalEmployees: workSessions.length,
    totalMinutes: workSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0),
    totalCost: workSessions.reduce((sum, s) => sum + (s.laborCost || 0), 0),
    sessions: workSessions.map(s => ({
      user: s.user,
      workType: s.workType,
      totalMinutes: s.totalMinutes,
      laborCost: s.laborCost
    }))
  };

  const equipmentStats = {
    totalEquipment: equipmentUsages.length,
    totalMinutes: equipmentUsages.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
    totalCost: equipmentUsages.reduce((sum, e) => sum + (e.equipmentCost || 0), 0),
    usages: equipmentUsages.map(e => ({
      equipment: e.equipment,
      durationMinutes: e.durationMinutes,
      equipmentCost: e.equipmentCost
    }))
  };

  const totalCost = (batch.rawMaterialCost || 0) + laborStats.totalCost + equipmentStats.totalCost + (batch.otherCosts || 0);

  const costBreakdown = {
    rawMaterialCost: batch.rawMaterialCost || 0,
    rawMaterialPercentage: totalCost > 0 ? `${((batch.rawMaterialCost / totalCost) * 100).toFixed(1)}%` : '0%',
    laborCost: laborStats.totalCost,
    laborPercentage: totalCost > 0 ? `${((laborStats.totalCost / totalCost) * 100).toFixed(1)}%` : '0%',
    equipmentCost: equipmentStats.totalCost,
    equipmentPercentage: totalCost > 0 ? `${((equipmentStats.totalCost / totalCost) * 100).toFixed(1)}%` : '0%',
    otherCosts: batch.otherCosts || 0,
    otherCostsPercentage: totalCost > 0 ? `${(((batch.otherCosts || 0) / totalCost) * 100).toFixed(1)}%` : '0%',
    totalCost
  };

  const profitAnalysis = {
    expectedRevenue: batch.expectedPrice ? (batch.expectedPrice * (batch.rawMaterialWeight || 0)) : null,
    profit: null,
    profitMargin: null,
    breakEvenPrice: totalCost / (batch.rawMaterialWeight || 1)
  };

  if (profitAnalysis.expectedRevenue) {
    profitAnalysis.profit = profitAnalysis.expectedRevenue - totalCost;
    profitAnalysis.profitMargin = `${((profitAnalysis.profit / profitAnalysis.expectedRevenue) * 100).toFixed(1)}%`;
  }

  return {
    batch,
    laborStats,
    equipmentStats,
    costBreakdown,
    profitAnalysis
  };
}

/**
 * 格式化成本数据为AI提示
 */
function formatCostDataForAI(costData, userQuestion = null) {
  const { batch, laborStats, equipmentStats, costBreakdown, profitAnalysis } = costData;

  let prompt = `请分析以下批次的成本数据：

**批次信息**：
- 批次号: ${batch.batchNumber}
- 原材料: ${batch.rawMaterialCategory} ${batch.rawMaterialWeight}kg
- 原材料成本: ¥${batch.rawMaterialCost?.toFixed(2) || '0.00'} (${batch.rawMaterialWeight ? (batch.rawMaterialCost / batch.rawMaterialWeight).toFixed(2) : '0.00'}元/kg)
- 产品类别: ${batch.productCategory === 'fresh' ? '鲜品' : '冻品'}
${batch.expectedPrice ? `- 预期售价: ¥${batch.expectedPrice}/kg` : ''}

**成本结构**：
- 原材料成本: ¥${costBreakdown.rawMaterialCost.toFixed(2)} (${costBreakdown.rawMaterialPercentage})
- 人工成本: ¥${costBreakdown.laborCost.toFixed(2)} (${costBreakdown.laborPercentage})
- 设备成本: ¥${costBreakdown.equipmentCost.toFixed(2)} (${costBreakdown.equipmentPercentage})
- 其他成本: ¥${costBreakdown.otherCosts.toFixed(2)} (${costBreakdown.otherCostsPercentage})
- **总成本**: ¥${costBreakdown.totalCost.toFixed(2)}

**人工统计**：
- 参与员工: ${laborStats.totalEmployees}人
- 总工时: ${Math.floor(laborStats.totalMinutes / 60)}小时${laborStats.totalMinutes % 60}分钟
- 人工成本: ¥${laborStats.totalCost.toFixed(2)}`;

  if (laborStats.sessions && laborStats.sessions.length > 0) {
    prompt += `\n- 员工明细: ${laborStats.sessions.slice(0, 5).map(s =>
      `${s.user.fullName}(${Math.floor(s.totalMinutes / 60)}h, ¥${s.laborCost?.toFixed(2) || '0'})`
    ).join(', ')}${laborStats.sessions.length > 5 ? '...' : ''}`;
  }

  prompt += `

**设备统计**：
- 使用设备: ${equipmentStats.totalEquipment}台
- 总使用时长: ${Math.floor(equipmentStats.totalMinutes / 60)}小时${equipmentStats.totalMinutes % 60}分钟
- 设备成本: ¥${equipmentStats.totalCost.toFixed(2)}`;

  if (equipmentStats.usages && equipmentStats.usages.length > 0) {
    prompt += `\n- 设备明细: ${equipmentStats.usages.slice(0, 5).map(e =>
      `${e.equipment.name}(${Math.floor(e.durationMinutes / 60)}h, ¥${e.equipmentCost?.toFixed(2) || '0'})`
    ).join(', ')}${equipmentStats.usages.length > 5 ? '...' : ''}`;
  }

  if (profitAnalysis.expectedRevenue) {
    prompt += `

**利润分析**：
- 预期收入: ¥${profitAnalysis.expectedRevenue.toFixed(2)}
- 利润: ¥${profitAnalysis.profit?.toFixed(2) || '0.00'} (${profitAnalysis.profitMargin})
- 盈亏平衡价: ¥${profitAnalysis.breakEvenPrice.toFixed(2)}/kg`;
  }

  if (userQuestion) {
    prompt += `\n\n**用户问题**: ${userQuestion}`;
  } else {
    prompt += `\n\n请分析：
1. 成本结构是否合理？
2. 有哪些优化空间？
3. 具体改进建议是什么？`;
  }

  return prompt;
}