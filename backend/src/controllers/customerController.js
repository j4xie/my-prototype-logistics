/**
 * 客户管理控制器
 * 管理成品客户信息
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 生成客户代码
 */
function generateCustomerCode(count) {
  return `CUS${String(count + 1).padStart(3, '0')}`;
}

/**
 * 获取工厂的所有客户
 * GET /api/mobile/customers
 */
export async function getCustomers(req, res) {
  try {
    const { factoryId } = req.user;
    const { isActive } = req.query;

    const where = {
      factoryId,
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const customers = await prisma.customer.findMany({
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
            productionPlans: true,  // 订单数量
            shipmentRecords: true   // 出货次数
          }
        }
      }
    });

    res.json({
      success: true,
      data: customers
    });

  } catch (error) {
    console.error('获取客户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取客户列表失败',
      error: error.message
    });
  }
}

/**
 * 获取单个客户详情
 * GET /api/mobile/customers/:id
 */
export async function getCustomerById(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
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
        productionPlans: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            productType: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('获取客户详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取客户详情失败',
      error: error.message
    });
  }
}

/**
 * 创建客户
 * POST /api/mobile/customers
 */
export async function createCustomer(req, res) {
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
        message: '客户名称不能为空'
      });
    }

    // 生成客户代码
    const count = await prisma.customer.count({
      where: { factoryId }
    });
    const code = generateCustomerCode(count);

    // 创建客户
    const customer = await prisma.customer.create({
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
      message: '客户创建成功',
      data: customer
    });

  } catch (error) {
    console.error('创建客户失败:', error);
    res.status(500).json({
      success: false,
      message: '创建客户失败',
      error: error.message
    });
  }
}

/**
 * 更新客户
 * PUT /api/mobile/customers/:id
 */
export async function updateCustomer(req, res) {
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

    // 验证客户是否存在
    const existing = await prisma.customer.findFirst({
      where: { id, factoryId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    // 更新客户
    const customer = await prisma.customer.update({
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
      message: '客户更新成功',
      data: customer
    });

  } catch (error) {
    console.error('更新客户失败:', error);
    res.status(500).json({
      success: false,
      message: '更新客户失败',
      error: error.message
    });
  }
}

/**
 * 删除客户（软删除）
 * DELETE /api/mobile/customers/:id
 */
export async function deleteCustomer(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    // 验证客户是否存在
    const existing = await prisma.customer.findFirst({
      where: { id, factoryId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    // 检查是否有关联的订单
    const planCount = await prisma.productionPlan.count({
      where: { customerId: id }
    });

    if (planCount > 0) {
      // 有关联数据，只能软删除
      await prisma.customer.update({
        where: { id },
        data: { isActive: false }
      });

      return res.json({
        success: true,
        message: `客户已停用（有 ${planCount} 个关联订单）`
      });
    }

    // 无关联数据，可以硬删除
    await prisma.customer.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: '客户已删除'
    });

  } catch (error) {
    console.error('删除客户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除客户失败',
      error: error.message
    });
  }
}

/**
 * 获取客户统计信息
 * GET /api/mobile/customers/:id/stats
 */
export async function getCustomerStats(req, res) {
  try {
    const { factoryId } = req.user;
    const { id } = req.params;

    // 验证客户是否存在
    const customer = await prisma.customer.findFirst({
      where: { id, factoryId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    // 统计信息
    const [
      totalOrders,
      activeOrders,
      completedOrders,
      totalShipments,
      totalSalesValue,
      recentOrders
    ] = await Promise.all([
      // 总订单数
      prisma.productionPlan.count({
        where: { customerId: id }
      }),
      // 进行中的订单
      prisma.productionPlan.count({
        where: {
          customerId: id,
          status: { in: ['pending', 'in_progress'] }
        }
      }),
      // 已完成订单
      prisma.productionPlan.count({
        where: {
          customerId: id,
          status: 'completed'
        }
      }),
      // 出货次数
      prisma.shipmentRecord.count({
        where: { customerId: id }
      }),
      // 销售总额（基于出货记录）
      prisma.shipmentRecord.aggregate({
        where: { customerId: id },
        _sum: { shippedQuantity: true }
      }),
      // 最近订单
      prisma.productionPlan.findMany({
        where: { customerId: id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          productType: {
            select: {
              name: true,
              code: true
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        customer,
        stats: {
          totalOrders,
          activeOrders,
          completedOrders,
          totalShipments,
          totalSalesQuantity: totalSalesValue._sum.shippedQuantity || 0,
          recentOrders
        }
      }
    });

  } catch (error) {
    console.error('获取客户统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取客户统计失败',
      error: error.message
    });
  }
}
