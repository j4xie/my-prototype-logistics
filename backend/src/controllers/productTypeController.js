import { PrismaClient } from '@prisma/client';
import { createSuccessResponse, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 获取产品类型列表
 * GET /api/mobile/products/types
 */
export const getProductTypes = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { category, isActive } = req.query;

    const where = {
      factoryId,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };

    const productTypes = await prisma.productType.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(createSuccessResponse({ productTypes }, '获取产品类型成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取单个产品类型详情
 * GET /api/mobile/products/types/:id
 */
export const getProductTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const productType = await prisma.productType.findFirst({
      where: {
        id,
        factoryId,
      },
      include: {
        conversionRates: {
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
        },
        _count: {
          select: {
            productionPlans: true,
          },
        },
      },
    });

    if (!productType) {
      throw new NotFoundError('产品类型不存在');
    }

    res.json(createSuccessResponse(productType, '获取产品类型详情成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建产品类型
 * POST /api/mobile/products/types
 */
export const createProductType = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { name, code, category, description } = req.body;

    if (!name || !code) {
      throw new ValidationError('产品名称和产品代码不能为空');
    }

    const productType = await prisma.productType.create({
      data: {
        factoryId,
        name,
        code,
        category,
        description,
        createdBy: req.user?.id || null,
      },
    });

    res.status(201).json(createSuccessResponse(productType, '产品类型创建成功'));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json(createSuccessResponse(null, '产品名称或代码已存在', false));
    }
    next(error);
  }
};

/**
 * 更新产品类型
 * PUT /api/mobile/products/types/:id
 */
export const updateProductType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { name, code, category, description, isActive } = req.body;

    const existing = await prisma.productType.findFirst({
      where: { id, factoryId },
    });

    if (!existing) {
      throw new NotFoundError('产品类型不存在');
    }

    const updated = await prisma.productType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(createSuccessResponse(updated, '产品类型更新成功'));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json(createSuccessResponse(null, '产品名称或代码已存在', false));
    }
    next(error);
  }
};

/**
 * 删除产品类型
 * DELETE /api/mobile/products/types/:id
 */
export const deleteProductType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const existing = await prisma.productType.findFirst({
      where: { id, factoryId },
      include: {
        _count: {
          select: {
            productionPlans: true,
            conversionRates: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('产品类型不存在');
    }

    if (existing._count.productionPlans > 0) {
      throw new ValidationError('该产品类型已被生产计划使用,无法删除。可以选择停用该产品类型。');
    }

    await prisma.productType.delete({
      where: { id },
    });

    res.json(createSuccessResponse(null, '产品类型删除成功'));
  } catch (error) {
    next(error);
  }
};

export default {
  getProductTypes,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
};
