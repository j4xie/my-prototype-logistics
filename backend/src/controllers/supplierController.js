/**
 * 供应商管理控制器
 * 管理原材料供应商信息
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 生成供应商代码
 */
function generateSupplierCode(count) {
  return `SUP${String(count + 1).padStart(3, '0')}`;
}

/**
 * 获取工厂的所有供应商
 * GET /api/mobile/suppliers
 */
export async function getSuppliers(req, res) {
  try {
    const { factoryId } = req.user;
    const { isActive } = req.query;

    const where = {
      factoryId,
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        _count: {
          select: {
            materialBatches: true  // 提供的批次数量
          }
        }
      }
    });

    res.json({
      success: true,
      data: suppliers
    });

  } catch (error) {
    console.error('获取供应商列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取供应商列表失败',
      error: error.message
    });
  }
}

/**
 * 获取单个供应商详情
 * GET /api/mobile/suppliers/:id
 */
export async function getSupplierById(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    const supplier = await prisma.supplier.findFirst({
      where: {
        id,
        factoryId
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        materialBatches: {
          take: 10,
          orderBy: { inboundDate: 'desc' },
          include: {
            materialType: true
          }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    res.json({
      success: true,
      data: supplier
    });

  } catch (error) {
    console.error('获取供应商详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取供应商详情失败',
      error: error.message
    });
  }
}

/**
 * 创建供应商
 * POST /api/mobile/suppliers
 */
export async function createSupplier(req, res) {
  try {
    const { factoryId, userId } = req.user;
    const {
      name,
      contactPerson,
      contactPhone,
      address,
      businessType,
      creditLevel,
      deliveryArea,
      paymentTerms
    } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '供应商名称不能为空'
      });
    }

    // 生成供应商代码
    const count = await prisma.supplier.count({
      where: { factoryId }
    });
    const code = generateSupplierCode(count);

    // 创建供应商
    const supplier = await prisma.supplier.create({
      data: {
        factoryId,
        name,
        code,
        contactPerson,
        contactPhone,
        address,
        businessType,
        creditLevel,
        deliveryArea,
        paymentTerms,
        createdBy: userId
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: '供应商创建成功',
      data: supplier
    });

  } catch (error) {
    console.error('创建供应商失败:', error);
    res.status(500).json({
      success: false,
      message: '创建供应商失败',
      error: error.message
    });
  }
}

/**
 * 更新供应商
 * PUT /api/mobile/suppliers/:id
 */
export async function updateSupplier(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;
    const {
      name,
      contactPerson,
      contactPhone,
      address,
      businessType,
      creditLevel,
      deliveryArea,
      paymentTerms,
      isActive
    } = req.body;

    // 验证供应商是否存在
    const existing = await prisma.supplier.findFirst({
      where: { id, factoryId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    // 更新供应商
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(address !== undefined && { address }),
        ...(businessType !== undefined && { businessType }),
        ...(creditLevel !== undefined && { creditLevel }),
        ...(deliveryArea !== undefined && { deliveryArea }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: '供应商更新成功',
      data: supplier
    });

  } catch (error) {
    console.error('更新供应商失败:', error);
    res.status(500).json({
      success: false,
      message: '更新供应商失败',
      error: error.message
    });
  }
}

/**
 * 删除供应商（软删除）
 * DELETE /api/mobile/suppliers/:id
 */
export async function deleteSupplier(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    // 验证供应商是否存在
    const existing = await prisma.supplier.findFirst({
      where: { id, factoryId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    // 检查是否有关联的批次
    const batchCount = await prisma.materialBatch.count({
      where: { supplierId: id }
    });

    if (batchCount > 0) {
      // 有关联数据，只能软删除
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false }
      });

      return res.json({
        success: true,
        message: `供应商已停用（有 ${batchCount} 个关联批次）`
      });
    }

    // 无关联数据，可以硬删除
    await prisma.supplier.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: '供应商已删除'
    });

  } catch (error) {
    console.error('删除供应商失败:', error);
    res.status(500).json({
      success: false,
      message: '删除供应商失败',
      error: error.message
    });
  }
}

/**
 * 获取供应商统计信息
 * GET /api/mobile/suppliers/:id/stats
 */
export async function getSupplierStats(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findFirst({
      where: { id, factoryId }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    // 统计信息
    const [
      totalBatches,
      activeBatches,
      totalPurchaseValue,
      recentBatches
    ] = await Promise.all([
      // 总批次数
      prisma.materialBatch.count({
        where: { supplierId: id }
      }),
      // 活跃批次数
      prisma.materialBatch.count({
        where: {
          supplierId: id,
          status: 'available'
        }
      }),
      // 采购总金额
      prisma.materialBatch.aggregate({
        where: { supplierId: id },
        _sum: { totalCost: true }
      }),
      // 最近批次
      prisma.materialBatch.findMany({
        where: { supplierId: id },
        take: 5,
        orderBy: { inboundDate: 'desc' },
        include: {
          materialType: {
            select: {
              name: true,
              unit: true
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        supplier,
        stats: {
          totalBatches,
          activeBatches,
          totalPurchaseValue: totalPurchaseValue._sum.totalCost || 0,
          recentBatches
        }
      }
    });

  } catch (error) {
    console.error('获取供应商统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取供应商统计失败',
      error: error.message
    });
  }
}
