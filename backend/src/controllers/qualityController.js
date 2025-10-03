import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 提交质检记录
 * POST /api/mobile/quality/inspections
 */
export const submitInspection = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const inspectorId = req.user.id;
    const {
      batchId,
      inspectionType,
      testItems,
      overallResult,
      qualityScore,
      defectDetails,
      correctiveActions,
      photos
    } = req.body;

    // 验证批次是否存在
    const batch = await prisma.processingBatch.findFirst({
      where: {
        id: batchId,
        factoryId
      }
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    // 创建质检记录
    const inspection = await prisma.qualityInspection.create({
      data: {
        batchId,
        factoryId,
        inspectorId,
        inspectionType,
        inspectionDate: new Date(),
        testItems,
        overallResult,
        qualityScore: qualityScore ? parseFloat(qualityScore) : null,
        defectDetails,
        correctiveActions,
        photos
      },
      include: {
        inspector: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        }
      }
    });

    // 如果是失败的质检，更新批次状态
    if (overallResult === 'fail') {
      await prisma.processingBatch.update({
        where: { id: batchId },
        data: { status: 'failed' }
      });
    } else if (overallResult === 'pass' && batch.status === 'in_progress') {
      // 如果质检通过且批次在进行中，更新为质检中状态
      await prisma.processingBatch.update({
        where: { id: batchId },
        data: { status: 'quality_check' }
      });
    }

    res.status(201).json(createSuccessResponse(inspection, '质检记录提交成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 查询质检记录
 * GET /api/mobile/quality/inspections
 */
export const getInspections = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      page = 1,
      limit = 20,
      batchId,
      inspectionType,
      overallResult,
      inspectorId,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const where = {
      factoryId,
      ...(batchId && { batchId }),
      ...(inspectionType && { inspectionType }),
      ...(overallResult && { overallResult }),
      ...(inspectorId && { inspectorId: parseInt(inspectorId) }),
      ...(startDate && endDate && {
        inspectionDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }),
      ...(search && {
        OR: [
          { batch: { batchNumber: { contains: search } } },
          { batch: { productType: { contains: search } } },
          { inspector: { fullName: { contains: search } } }
        ]
      })
    };

    const [inspections, total] = await Promise.all([
      prisma.qualityInspection.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { inspectionDate: 'desc' },
        include: {
          inspector: {
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
              status: true
            }
          }
        }
      }),
      prisma.qualityInspection.count({ where })
    ]);

    res.json(createSuccessResponse({
      inspections,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total,
        limit: parseInt(limit)
      }
    }, '获取质检记录成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取质检详情
 * GET /api/mobile/quality/inspections/:id
 */
export const getInspectionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;

    const inspection = await prisma.qualityInspection.findFirst({
      where: {
        id,
        factoryId
      },
      include: {
        inspector: {
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
            status: true,
            rawMaterials: true,
            targetQuantity: true,
            actualQuantity: true
          }
        }
      }
    });

    if (!inspection) {
      throw new NotFoundError('质检记录不存在');
    }

    res.json(createSuccessResponse(inspection, '获取质检详情成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新质检结果
 * PUT /api/mobile/quality/inspections/:id
 */
export const updateInspection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { factoryId } = req.user;
    const {
      testItems,
      overallResult,
      qualityScore,
      defectDetails,
      correctiveActions,
      photos
    } = req.body;

    // 检查质检记录是否存在
    const existingInspection = await prisma.qualityInspection.findFirst({
      where: { id, factoryId },
      include: { batch: true }
    });

    if (!existingInspection) {
      throw new NotFoundError('质检记录不存在');
    }

    // 检查是否可以修改
    if (existingInspection.batch.status === 'completed') {
      throw new ValidationError('已完成批次的质检记录不能修改');
    }

    const updatedInspection = await prisma.qualityInspection.update({
      where: { id },
      data: {
        ...(testItems && { testItems }),
        ...(overallResult && { overallResult }),
        ...(qualityScore !== undefined && { qualityScore: qualityScore ? parseFloat(qualityScore) : null }),
        ...(defectDetails && { defectDetails }),
        ...(correctiveActions !== undefined && { correctiveActions }),
        ...(photos && { photos })
      },
      include: {
        inspector: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            productType: true
          }
        }
      }
    });

    // 如果修改了检测结果，可能需要更新批次状态
    if (overallResult && overallResult !== existingInspection.overallResult) {
      if (overallResult === 'fail') {
        await prisma.processingBatch.update({
          where: { id: existingInspection.batchId },
          data: { status: 'failed' }
        });
      }
    }

    res.json(createSuccessResponse(updatedInspection, '质检记录更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 质检统计数据
 * GET /api/mobile/quality/statistics
 */
export const getQualityStatistics = async (req, res, next) => {
  try {
    const { factoryId, userType } = req.user;
    const {
      startDate,
      endDate,
      inspectionType,
      department
    } = req.query;

    const dateFilter = startDate && endDate ? {
      inspectionDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } : {};

    const inspectorFilter = department ? {
      inspector: {
        department: department
      }
    } : {};

    // 构建基础查询条件 - 平台用户可以访问所有工厂数据
    const baseWhere = {
      ...(userType !== 'platform' && factoryId && { factoryId }),
      ...dateFilter,
      ...(inspectionType && { inspectionType }),
      ...inspectorFilter
    };

    // 基本统计
    const totalInspections = await prisma.qualityInspection.count({
      where: baseWhere
    });

    // 按结果分组统计
    const resultStats = await prisma.qualityInspection.groupBy({
      by: ['overallResult'],
      where: baseWhere,
      _count: {
        overallResult: true
      }
    });

    // 按检测类型分组统计
    const typeStats = await prisma.qualityInspection.groupBy({
      by: ['inspectionType'],
      where: baseWhere,
      _count: {
        inspectionType: true
      },
      _avg: {
        qualityScore: true
      }
    });

    // 平均质量分数
    const avgQualityScore = await prisma.qualityInspection.aggregate({
      where: {
        ...baseWhere,
        qualityScore: { not: null }
      },
      _avg: {
        qualityScore: true
      }
    });

    // 检测员统计
    const inspectorStats = await prisma.qualityInspection.groupBy({
      by: ['inspectorId'],
      where: baseWhere,
      _count: {
        inspectorId: true
      },
      _avg: {
        qualityScore: true
      }
    });

    // 获取检测员信息
    const inspectorIds = inspectorStats.map(stat => stat.inspectorId);
    const inspectors = await prisma.user.findMany({
      where: {
        id: { in: inspectorIds }
      },
      select: {
        id: true,
        fullName: true,
        department: true
      }
    });

    const inspectorStatsWithNames = inspectorStats.map(stat => {
      const inspector = inspectors.find(i => i.id === stat.inspectorId);
      return {
        inspector,
        count: stat._count.inspectorId,
        avgScore: stat._avg.qualityScore
      };
    });

    res.json(createSuccessResponse({
      summary: {
        totalInspections,
        avgQualityScore: avgQualityScore._avg.qualityScore
      },
      resultDistribution: resultStats.reduce((acc, stat) => {
        acc[stat.overallResult] = stat._count.overallResult;
        return acc;
      }, {}),
      typeStats: typeStats.map(stat => ({
        type: stat.inspectionType,
        count: stat._count.inspectionType,
        avgScore: stat._avg.qualityScore
      })),
      inspectorStats: inspectorStatsWithNames
    }, '获取质检统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 质量趋势分析
 * GET /api/mobile/quality/trends
 */
export const getQualityTrends = async (req, res, next) => {
  try {
    const { factoryId } = req.user;
    const {
      period = 'month', // week, month, quarter
      inspectionType
    } = req.query;

    let dateRange;
    let groupBy;
    
    const now = new Date();
    
    switch (period) {
      case 'week':
        dateRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'quarter':
        dateRange = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
        break;
      default: // month
        dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
    }

    // 获取趋势数据
    const inspections = await prisma.qualityInspection.findMany({
      where: {
        factoryId,
        inspectionDate: { gte: dateRange },
        ...(inspectionType && { inspectionType })
      },
      select: {
        inspectionDate: true,
        overallResult: true,
        qualityScore: true
      },
      orderBy: { inspectionDate: 'asc' }
    });

    // 按时间分组
    const trends = {};
    inspections.forEach(inspection => {
      const date = inspection.inspectionDate.toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = {
          date,
          total: 0,
          pass: 0,
          fail: 0,
          conditional_pass: 0,
          avgScore: 0,
          scores: []
        };
      }
      
      trends[date].total++;
      trends[date][inspection.overallResult]++;
      
      if (inspection.qualityScore) {
        trends[date].scores.push(inspection.qualityScore);
      }
    });

    // 计算平均分数
    Object.values(trends).forEach(trend => {
      if (trend.scores.length > 0) {
        trend.avgScore = trend.scores.reduce((sum, score) => sum + parseFloat(score), 0) / trend.scores.length;
      }
      delete trend.scores; // 删除临时数组
    });

    const trendData = Object.values(trends);

    // 计算合格率趋势
    const passRateData = trendData.map(trend => ({
      date: trend.date,
      passRate: trend.total > 0 ? (trend.pass / trend.total) * 100 : 0,
      total: trend.total
    }));

    res.json(createSuccessResponse({
      period,
      dateRange: {
        start: dateRange.toISOString(),
        end: now.toISOString()
      },
      trends: trendData,
      passRateData,
      summary: {
        totalInspections: inspections.length,
        overallPassRate: inspections.length > 0 
          ? (inspections.filter(i => i.overallResult === 'pass').length / inspections.length) * 100 
          : 0
      }
    }, '获取质量趋势成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  submitInspection,
  getInspections,
  getInspectionById,
  updateInspection,
  getQualityStatistics,
  getQualityTrends
};