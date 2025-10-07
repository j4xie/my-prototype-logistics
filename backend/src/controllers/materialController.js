import { PrismaClient } from '@prisma/client';
import { createSuccessResponse } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 获取原料类型列表
 * GET /api/mobile/materials/types
 */
export const getMaterialTypes = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';

    const types = await prisma.rawMaterialType.findMany({
      where: {
        factoryId,
        isActive: true,
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        description: true,
      },
    });

    res.json(createSuccessResponse(types, '获取原料类型成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建原料类型
 * POST /api/mobile/materials/types
 */
export const createMaterialType = async (req, res, next) => {
  try {
    const factoryId = req.user?.factoryId || req.user?.factoryUser?.factoryId || 'TEST_2024_001';
    const { name, category, unit, description } = req.body;

    if (!name) {
      return res.status(400).json(createSuccessResponse(null, '原料名称不能为空', false));
    }

    const type = await prisma.rawMaterialType.create({
      data: {
        factoryId,
        name,
        category,
        unit: unit || 'kg',
        description,
        createdBy: req.user?.id || null,
      },
    });

    res.status(201).json(createSuccessResponse(type, '原料类型创建成功'));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json(createSuccessResponse(null, '该原料类型已存在', false));
    }
    next(error);
  }
};
