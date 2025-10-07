import { PrismaClient } from '@prisma/client';
import { createSuccessResponse, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 获取转换率列表
 * GET /api/mobile/conversions
 */
export const getConversionRates = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { materialTypeId, productTypeId } = req.query;

    const where = {
      factoryId,
      ...(materialTypeId && { materialTypeId }),
      ...(productTypeId && { productTypeId }),
    };

    const conversions = await prisma.materialProductConversion.findMany({
      where,
      include: {
        materialType: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
          },
        },
        productType: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
          },
        },
      },
      orderBy: [
        { materialType: { name: 'asc' } },
        { productType: { name: 'asc' } },
      ],
    });

    res.json(createSuccessResponse(conversions, '获取转换率列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取转换率矩阵 (用于前端表格展示)
 * GET /api/mobile/conversions/matrix
 */
export const getConversionMatrix = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const [materials, products, conversions] = await Promise.all([
      prisma.rawMaterialType.findMany({
        where: { factoryId, isActive: true },
        select: { id: true, name: true, category: true },
        orderBy: { name: 'asc' },
      }),
      prisma.productType.findMany({
        where: { factoryId, isActive: true },
        select: { id: true, name: true, code: true, category: true },
        orderBy: { name: 'asc' },
      }),
      prisma.materialProductConversion.findMany({
        where: { factoryId },
        select: {
          id: true,
          materialTypeId: true,
          productTypeId: true,
          conversionRate: true,
          wastageRate: true,
        },
      }),
    ]);

    // 构建转换率矩阵
    const matrix = materials.map(material => ({
      material,
      conversions: products.map(product => {
        const conversion = conversions.find(
          c => c.materialTypeId === material.id && c.productTypeId === product.id
        );
        return {
          productId: product.id,
          productName: product.name,
          conversionId: conversion?.id || null,
          conversionRate: conversion?.conversionRate || null,
          wastageRate: conversion?.wastageRate || null,
          hasConversion: !!conversion,
        };
      }),
    }));

    res.json(createSuccessResponse({ materials, products, matrix }, '获取转换率矩阵成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建或更新转换率
 * POST /api/mobile/conversions
 */
export const upsertConversionRate = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { materialTypeId, productTypeId, conversionRate, wastageRate, notes } = req.body;

    if (!materialTypeId || !productTypeId || !conversionRate) {
      throw new ValidationError('原料类型、产品类型和转换率不能为空');
    }

    if (conversionRate <= 0 || conversionRate > 100) {
      throw new ValidationError('转换率必须在0-100之间');
    }

    if (wastageRate && (wastageRate < 0 || wastageRate > 100)) {
      throw new ValidationError('损耗率必须在0-100之间');
    }

    // 检查原料类型和产品类型是否存在
    const [material, product] = await Promise.all([
      prisma.rawMaterialType.findFirst({
        where: { id: materialTypeId, factoryId },
      }),
      prisma.productType.findFirst({
        where: { id: productTypeId, factoryId },
      }),
    ]);

    if (!material) {
      throw new NotFoundError('原料类型不存在');
    }

    if (!product) {
      throw new NotFoundError('产品类型不存在');
    }

    const conversion = await prisma.materialProductConversion.upsert({
      where: {
        materialTypeId_productTypeId: {
          materialTypeId,
          productTypeId,
        },
      },
      update: {
        conversionRate: parseFloat(conversionRate),
        wastageRate: wastageRate ? parseFloat(wastageRate) : null,
        notes,
        createdBy: req.user?.id || null,
      },
      create: {
        factoryId,
        materialTypeId,
        productTypeId,
        conversionRate: parseFloat(conversionRate),
        wastageRate: wastageRate ? parseFloat(wastageRate) : null,
        notes,
        createdBy: req.user?.id || null,
      },
      include: {
        materialType: {
          select: {
            name: true,
          },
        },
        productType: {
          select: {
            name: true,
          },
        },
      },
    });

    res.status(201).json(createSuccessResponse(conversion, '转换率保存成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除转换率
 * DELETE /api/mobile/conversions/:id
 */
export const deleteConversionRate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const existing = await prisma.materialProductConversion.findFirst({
      where: { id, factoryId },
    });

    if (!existing) {
      throw new NotFoundError('转换率配置不存在');
    }

    await prisma.materialProductConversion.delete({
      where: { id },
    });

    res.json(createSuccessResponse(null, '转换率删除成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 预估原料用量
 * POST /api/mobile/conversions/estimate
 */
export const estimateMaterialUsage = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { productTypeId, plannedQuantity, materialTypeId } = req.body;

    if (!productTypeId || !plannedQuantity) {
      throw new ValidationError('产品类型和计划产量不能为空');
    }

    if (plannedQuantity <= 0) {
      throw new ValidationError('计划产量必须大于0');
    }

    // 查询转换率
    const conversion = await prisma.materialProductConversion.findFirst({
      where: {
        factoryId,
        productTypeId,
        ...(materialTypeId && { materialTypeId }),
      },
      include: {
        materialType: true,
        productType: true,
      },
    });

    if (!conversion) {
      throw new NotFoundError('未找到相应的转换率配置,请先配置转换率');
    }

    // 计算预估原料用量
    const conversionRate = parseFloat(conversion.conversionRate) / 100; // 转换为小数
    const wastageRate = conversion.wastageRate ? parseFloat(conversion.wastageRate) / 100 : 0;

    // 基础原料需求 = 计划产量 / 转换率
    const baseRequirement = plannedQuantity / conversionRate;

    // 加上损耗 = 基础需求 * (1 + 损耗率)
    const estimatedUsage = baseRequirement * (1 + wastageRate);

    res.json(createSuccessResponse({
      productType: {
        id: conversion.productType.id,
        name: conversion.productType.name,
      },
      materialType: {
        id: conversion.materialType.id,
        name: conversion.materialType.name,
        unit: conversion.materialType.unit,
      },
      plannedQuantity: parseFloat(plannedQuantity),
      conversionRate: conversion.conversionRate,
      wastageRate: conversion.wastageRate || 0,
      baseRequirement: parseFloat(baseRequirement.toFixed(2)),
      estimatedUsage: parseFloat(estimatedUsage.toFixed(2)),
    }, '原料用量预估成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  getConversionRates,
  getConversionMatrix,
  upsertConversionRate,
  deleteConversionRate,
  estimateMaterialUsage,
};
