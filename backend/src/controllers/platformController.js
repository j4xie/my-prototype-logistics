import { PrismaClient } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { hashPassword, generateRandomPassword } from '../utils/password.js';
import { factoryIdGenerator } from '../utils/factory-id-generator.js';

const prisma = new PrismaClient();

/**
 * 获取平台概览数据
 * 为前端OverviewCards组件提供数据
 */
export const getPlatformOverview = async (req, res, next) => {
  try {
    // 获取工厂统计数据
    const totalFactories = await prisma.factory.count();
    const activeFactories = await prisma.factory.count({
      where: { isActive: true }
    });
    const pendingFactories = await prisma.factory.count({
      where: { isActive: false }
    });

    // 获取用户统计数据
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    // 按角色统计用户数量
    const roleStats = await prisma.user.groupBy({
      by: ['roleCode'],
      _count: {
        id: true
      }
    });

    // 计算月增长率（简化版本，实际项目中需要更复杂的计算）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    const oldUsers = totalUsers - recentUsers;
    const monthlyGrowthRate = oldUsers > 0 ? ((recentUsers / oldUsers) * 100).toFixed(1) : 0;

    // 收入数据（实际项目中应该从订阅或付费表中获取）
    // 目前功能尚未实现，显示0或占位符
    const totalRevenue = 0; // 功能尚未实现

    // 数据使用量（实际项目中应该从系统监控获取）
    // 目前功能尚未实现，显示占位符
    const dataUsageTotalGb = 0; // 功能尚未实现

    const overviewData = {
      total_factories: totalFactories,
      active_factories: activeFactories,
      pending_factories: pendingFactories,
      total_users: totalUsers,
      active_users: activeUsers,
      monthly_growth_rate: parseFloat(monthlyGrowthRate),
      total_revenue: totalRevenue,
      data_usage_total_gb: dataUsageTotalGb,
      role_distribution: roleStats.reduce((acc, stat) => {
        acc[stat.roleCode] = stat._count.id;
        return acc;
      }, {})
    };

    res.json({
      code: 200,
      message: '获取平台概览数据成功',
      data: overviewData
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取工厂详细信息
 * 返回特定工厂的详细信息和统计数据
 */
export const getFactoryDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 获取工厂基本信息
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            roleCode: true,
            department: true,
            isActive: true,
            lastLogin: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            users: true,
            sessions: true
          }
        }
      }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 按角色统计用户
    const roleDistribution = factory.users.reduce((acc, user) => {
      acc[user.roleCode] = (acc[user.roleCode] || 0) + 1;
      return acc;
    }, {});

    // 统计活跃用户（最近7天内登录）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsersRecent = factory.users.filter(user =>
      user.lastLogin && user.lastLogin >= sevenDaysAgo
    ).length;

    const factoryDetails = {
      id: factory.id,
      name: factory.name,
      industry: factory.industry,
      address: factory.address,
      contactName: factory.contactName,
      contactEmail: factory.contactEmail,
      contactPhone: factory.contactPhone,
      employeeCount: factory.employeeCount,
      subscriptionPlan: factory.subscriptionPlan,
      isActive: factory.isActive,
      createdAt: factory.createdAt,
      updatedAt: factory.updatedAt,

      // 统计信息
      statistics: {
        totalUsers: factory._count.users,
        activeUsers: factory.users.filter(user => user.isActive).length,
        recentActiveUsers: activeUsersRecent,
        totalSessions: factory._count.sessions,
        roleDistribution
      },

      // 用户列表
      users: factory.users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roleCode: user.roleCode,
        department: user.department,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }))
    };

    res.json(createSuccessResponse(factoryDetails, '获取工厂详情成功'));

  } catch (error) {
    next(error);
  }
};

/**
 * 生成工厂ID
 * 格式: FCT_YYYY_XXX (例: FCT_2024_001)
 */
const generateFactoryId = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `FCT_${currentYear}_`;

  // 查询当年已有的工厂数量
  const existingFactories = await prisma.factory.count({
    where: {
      id: {
        startsWith: prefix
      }
    }
  });

  // 生成三位递增序号
  const sequence = (existingFactories + 1).toString().padStart(3, '0');
  return `${prefix}${sequence}`;
};

/**
 * 创建工厂
 * 平台管理员创建新工厂
 * 使用智能工厂ID生成系统
 */
export const createFactory = async (req, res, next) => {
  try {
    const { name, industry, contactEmail, contactPhone, address, description } = req.body;
    const { admin } = req;

    // 检查工厂名称是否已存在
    const existingFactory = await prisma.factory.findFirst({
      where: { name },
    });

    if (existingFactory) {
      throw new ConflictError('工厂名称已存在');
    }

    // 检查邮箱是否已存在
    if (contactEmail) {
      const existingEmail = await prisma.factory.findFirst({
        where: { contactEmail },
      });

      if (existingEmail) {
        throw new ConflictError('联系邮箱已被使用');
      }
    }

    // 使用智能工厂ID生成系统
    const factoryData = {
      name,
      industry,
      address,
      contactPhone,
      contactEmail
    };

    const generationResult = await factoryIdGenerator.generateNewFactoryId(factoryData);

    // 生成老格式ID作为备用
    const legacyId = await generateFactoryId();

    // 创建工厂
    const factory = await prisma.factory.create({
      data: {
        id: generationResult.factoryId, // 使用新格式ID
        name,
        industry,
        contactEmail,
        contactPhone,
        address,
        description,
        isActive: true,
        // 新增字段
        industryCode: generationResult.industryCode,
        regionCode: generationResult.regionCode,
        factoryYear: generationResult.factoryYear,
        sequenceNumber: generationResult.sequenceNumber,
        legacyId: legacyId, // 保存老格式ID
        inferenceData: generationResult.reasoning,
        confidence: generationResult.confidence.overall,
        manuallyVerified: !generationResult.needsConfirmation,
      },
    });

    res.status(201).json(createSuccessResponse({
      factory: {
        id: factory.id,
        name: factory.name,
        industry: factory.industry,
        contactEmail: factory.contactEmail,
        contactPhone: factory.contactPhone,
        address: factory.address,
        description: factory.description,
        isActive: factory.isActive,
        createdAt: factory.createdAt,
        // 新增智能推断信息
        intelligentCoding: {
          industryCode: factory.industryCode,
          regionCode: factory.regionCode,
          factoryYear: factory.factoryYear,
          sequenceNumber: factory.sequenceNumber,
          industryName: generationResult.industryName,
          regionName: generationResult.regionName,
          confidence: factory.confidence,
          needsConfirmation: generationResult.needsConfirmation,
          reasoning: generationResult.reasoning,
          legacyId: factory.legacyId
        }
      },
    }, '工厂创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取工厂列表
 * 分页获取所有工厂，返回前端期望的数据格式
 */
export const getFactories = async (req, res, next) => {
  try {
    const { page = 1, size = 10, keyword, status } = req.query;
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);

    // 构建查询条件
    const where = {};

    // 状态筛选
    if (status) {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'suspended') {
        where.isActive = false;
      }
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { contactEmail: { contains: keyword } },
        { contactName: { contains: keyword } },
        { address: { contains: keyword } },
        { industry: { contains: keyword } },
      ];
    }

    // 获取总数
    const total = await prisma.factory.count({ where });

    // 分页查询
    const skip = (pageNum - 1) * pageSize;
    const factories = await prisma.factory.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    // 转换数据格式以匹配前端期望
    const formattedFactories = factories.map(factory => ({
      id: factory.id,
      name: factory.name,
      industry: factory.industry || '未分类',
      status: factory.isActive ? 'active' : 'suspended',
      subscription_plan: factory.subscriptionPlan || 'basic',
      employee_count: factory._count.users || 0,
      owner_user_id: `owner_${factory.id}`,
      owner_name: factory.contactName || '未设置',
      owner_email: factory.contactEmail || '',
      owner_phone: factory.contactPhone || '',
      contact_address: factory.address || '',
      created_at: factory.createdAt.toISOString(),
      updated_at: factory.updatedAt.toISOString(),
      last_active_at: factory.updatedAt.toISOString(),
      monthly_revenue: factory.isActive ? Math.floor(Math.random() * 50000) + 10000 : 0, // 模拟收入数据
      data_usage_gb: Math.random() * 30 + 1 // 模拟数据使用量
    }));

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      code: 200,
      message: '获取工厂列表成功',
      data: {
        factories: formattedFactories,
        pagination: {
          page: pageNum,
          size: pageSize,
          total,
          pages: totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新工厂信息
 * 平台管理员更新工厂信息
 */
export const updateFactory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, industry, contactEmail, contactPhone, address, description } = req.body;
    const { admin } = req;

    // 查找工厂
    const factory = await prisma.factory.findUnique({
      where: { id },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 检查工厂名称是否已被其他工厂使用
    if (name && name !== factory.name) {
      const existingFactory = await prisma.factory.findFirst({
        where: {
          name,
          id: { not: factory.id },
        },
      });

      if (existingFactory) {
        throw new ConflictError('工厂名称已存在');
      }
    }

    // 检查邮箱是否已被其他工厂使用
    if (contactEmail && contactEmail !== factory.contactEmail) {
      const existingEmail = await prisma.factory.findFirst({
        where: {
          contactEmail,
          id: { not: factory.id },
        },
      });

      if (existingEmail) {
        throw new ConflictError('联系邮箱已被使用');
      }
    }

    // 构建更新数据
    const updateData = {};
    if (name) updateData.name = name;
    if (industry) updateData.industry = industry;
    if (contactEmail) updateData.contactEmail = contactEmail;
    if (contactPhone) updateData.contactPhone = contactPhone;
    if (address) updateData.address = address;
    if (description) updateData.description = description;

    // 更新工厂
    const updatedFactory = await prisma.factory.update({
      where: { id: factory.id },
      data: updateData,
    });

    res.json(createSuccessResponse({
      factory: {
        id: updatedFactory.id,
        name: updatedFactory.name,
        industry: updatedFactory.industry,
        contactEmail: updatedFactory.contactEmail,
        contactPhone: updatedFactory.contactPhone,
        address: updatedFactory.address,
        description: updatedFactory.description,
        isActive: updatedFactory.isActive,
        updatedAt: updatedFactory.updatedAt,
      },
    }, '工厂信息更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 启用/停用工厂
 * 平台管理员启用或停用工厂
 */
export const toggleFactoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // 查找工厂
    const factory = await prisma.factory.findUnique({
      where: { id },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 转换前端status到数据库isActive
    const isActive = status === 'active';

    // 更新工厂状态
    const updatedFactory = await prisma.factory.update({
      where: { id: factory.id },
      data: { isActive },
    });

    // 如果停用工厂，撤销该工厂所有用户的会话
    if (!isActive) {
      await prisma.session.updateMany({
        where: { factoryId: factory.id },
        data: { isRevoked: true },
      });
    }

    // 返回前端期望的数据格式
    const formattedFactory = {
      id: updatedFactory.id,
      name: updatedFactory.name,
      industry: updatedFactory.industry || '未分类',
      status: updatedFactory.isActive ? 'active' : 'suspended',
      subscription_plan: updatedFactory.subscriptionPlan || 'basic',
      employee_count: updatedFactory.employeeCount || 0,
      owner_name: updatedFactory.contactName || '未设置',
      owner_email: updatedFactory.contactEmail || '',
      owner_phone: updatedFactory.contactPhone || '',
      contact_address: updatedFactory.address || '',
      created_at: updatedFactory.createdAt.toISOString(),
      updated_at: updatedFactory.updatedAt.toISOString(),
    };

    res.json({
      code: 200,
      message: `工厂${isActive ? '激活' : '暂停'}成功`,
      data: formattedFactory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取工厂统计信息
 * 获取工厂统计数据
 */
export const getFactoryStats = async (req, res, next) => {
  try {
    const { admin } = req;

    // 统计活跃和非活跃工厂数量
    const activeFactories = await prisma.factory.count({
      where: { isActive: true },
    });

    const inactiveFactories = await prisma.factory.count({
      where: { isActive: false },
    });

    // 按行业统计
    const industryStats = await prisma.factory.groupBy({
      by: ['industry'],
      where: { isActive: true },
      _count: {
        id: true,
      },
    });

    // 统计今天新增的工厂数量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAdded = await prisma.factory.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    // 统计所有工厂的用户总数
    const totalUsers = await prisma.user.count();

    // 统计活跃用户数
    const activeUsers = await prisma.user.count({
      where: { isActive: true },
    });

    // 统计最近7天内登录的用户
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLoginUsers = await prisma.user.count({
      where: {
        lastLogin: {
          gte: sevenDaysAgo,
        },
      },
    });

    res.json(createSuccessResponse({
      factories: {
        total: activeFactories + inactiveFactories,
        active: activeFactories,
        inactive: inactiveFactories,
        todayAdded,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        recentLogin: recentLoginUsers,
      },
      industryStats: industryStats.reduce((acc, stat) => {
        acc[stat.industry] = stat._count.id;
        return acc;
      }, {}),
    }, '获取统计信息成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 导出工厂数据
 * 导出所有工厂的详细数据
 */
export const exportFactoriesData = async (req, res, next) => {
  try {
    const { format = 'json' } = req.query;

    // 获取所有工厂数据
    const factories = await prisma.factory.findMany({
      include: {
        _count: {
          select: {
            users: true,
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 转换为导出格式
    const exportData = factories.map(factory => ({
      '工厂ID': factory.id,
      '工厂名称': factory.name,
      '所属行业': factory.industry || '未分类',
      '工厂状态': factory.isActive ? '运行中' : '已暂停',
      '订阅套餐': factory.subscriptionPlan || 'basic',
      '员工数量': factory.employeeCount || 0,
      '负责人姓名': factory.contactName || '未设置',
      '联系邮箱': factory.contactEmail || '',
      '联系电话': factory.contactPhone || '',
      '工厂地址': factory.address || '',
      '用户总数': factory._count.users,
      '活跃会话数': factory._count.sessions,
      '创建时间': factory.createdAt.toLocaleString('zh-CN'),
      '更新时间': factory.updatedAt.toLocaleString('zh-CN'),
    }));

    // 设置响应头
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `factories_export_${timestamp}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

    res.json({
      code: 200,
      message: '工厂数据导出成功',
      data: {
        export_time: new Date().toISOString(),
        total_records: exportData.length,
        records: exportData,
      },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 导出用户统计数据
 * 导出用户统计报表
 */
export const exportUsersData = async (req, res, next) => {
  try {
    // 按工厂统计用户数据
    const factoryUserStats = await prisma.factory.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        isActive: true,
        _count: {
          select: {
            users: true,
          },
        },
        users: {
          select: {
            roleCode: true,
            isActive: true,
            createdAt: true,
            lastLogin: true,
          },
        },
      },
    });

    // 按角色统计全平台用户
    const roleStats = await prisma.user.groupBy({
      by: ['roleCode'],
      _count: {
        id: true,
      },
    });

    // 转换工厂用户统计
    const factoryStats = factoryUserStats.map(factory => {
      const roleDistribution = factory.users.reduce((acc, user) => {
        acc[user.roleCode] = (acc[user.roleCode] || 0) + 1;
        return acc;
      }, {});

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentActiveUsers = factory.users.filter(user =>
        user.lastLogin && user.lastLogin >= sevenDaysAgo
      ).length;

      return {
        '工厂ID': factory.id,
        '工厂名称': factory.name,
        '所属行业': factory.industry || '未分类',
        '工厂状态': factory.isActive ? '运行中' : '已暂停',
        '用户总数': factory._count.users,
        '活跃用户数': factory.users.filter(u => u.isActive).length,
        '近7天活跃用户': recentActiveUsers,
        '超级管理员数': roleDistribution.factory_super_admin || 0,
        '权限管理员数': roleDistribution.permission_admin || 0,
        '部门管理员数': roleDistribution.department_admin || 0,
        '操作员数': roleDistribution.operator || 0,
        '查看者数': roleDistribution.viewer || 0,
        '未激活用户数': roleDistribution.unactivated || 0,
      };
    });

    const exportData = {
      factory_user_statistics: factoryStats,
      platform_role_statistics: roleStats.map(stat => ({
        '角色类型': stat.roleCode,
        '用户数量': stat._count.id,
      })),
      summary: {
        '总工厂数': factoryUserStats.length,
        '活跃工厂数': factoryUserStats.filter(f => f.isActive).length,
        '平台用户总数': factoryUserStats.reduce((sum, f) => sum + f._count.users, 0),
      },
    };

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `users_statistics_${timestamp}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

    res.json({
      code: 200,
      message: '用户统计数据导出成功',
      data: {
        export_time: new Date().toISOString(),
        ...exportData,
      },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 导出平台概览数据
 * 导出平台概览统计报表
 */
export const exportOverviewData = async (req, res, next) => {
  try {
    // 重用现有的概览数据逻辑
    const totalFactories = await prisma.factory.count();
    const activeFactories = await prisma.factory.count({
      where: { isActive: true }
    });
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    // 按工厂获取详细统计
    const factoryDetails = await prisma.factory.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    // 按时间统计（最近30天的数据）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newFactoriesLast30Days = await prisma.factory.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const newUsersLast30Days = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const exportData = {
      platform_summary: {
        '工厂总数': totalFactories,
        '活跃工厂数': activeFactories,
        '暂停工厂数': totalFactories - activeFactories,
        '用户总数': totalUsers,
        '活跃用户数': activeUsers,
        '非活跃用户数': totalUsers - activeUsers,
        '最近30天新增工厂': newFactoriesLast30Days,
        '最近30天新增用户': newUsersLast30Days,
      },
      factory_details: factoryDetails.map(factory => ({
        '工厂ID': factory.id,
        '工厂名称': factory.name,
        '所属行业': factory.industry || '未分类',
        '状态': factory.isActive ? '运行中' : '已暂停',
        '用户数量': factory._count.users,
        '创建时间': factory.createdAt.toLocaleString('zh-CN'),
      })),
      export_metadata: {
        '导出时间': new Date().toLocaleString('zh-CN'),
        '数据有效期': '导出时刻的实时数据',
        '报表版本': 'v1.0',
      },
    };

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `platform_overview_${timestamp}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

    res.json({
      code: 200,
      message: '平台概览数据导出成功',
      data: exportData,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取操作日志
 * 支持复杂筛选的操作日志查询
 */
export const getOperationLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      size = 20,
      startDate,
      endDate,
      action,
      actorType,
      factoryId,
      result
    } = req.query;

    const pageNum = parseInt(page);
    const pageSize = parseInt(size);

    // 构建查询条件
    const where = {};

    // 时间范围筛选
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // 操作类型筛选
    if (action) {
      where.action = {
        contains: action
      };
    }

    // 操作者类型筛选
    if (actorType) {
      where.actorType = actorType;
    }

    // 工厂筛选
    if (factoryId) {
      where.factoryId = factoryId;
    }

    // 结果筛选
    if (result) {
      where.result = result;
    }

    // 获取总数
    const total = await prisma.permissionAuditLog.count({ where });

    // 分页查询
    const skip = (pageNum - 1) * pageSize;
    const logs = await prisma.permissionAuditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take: pageSize,
    });

    // 转换为前端期望的格式
    const formattedLogs = logs.map(log => ({
      id: log.id.toString(),
      operator_id: log.actorId.toString(),
      operator_name: log.username,
      operator_type: log.actorType,
      action: log.action,
      target_type: log.resource || 'unknown',
      target_id: log.targetResourceId || '',
      target_name: log.targetResourceId || 'N/A',
      description: log.action,
      ip_address: log.ipAddress || 'Unknown',
      user_agent: log.userAgent || 'Unknown',
      factory_id: log.factoryId,
      result: log.result,
      error_message: log.errorMessage,
      created_at: log.timestamp.toISOString(),
    }));

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      code: 200,
      message: '获取操作日志成功',
      data: {
        logs: formattedLogs,
        pagination: {
          page: pageNum,
          size: pageSize,
          total,
          pages: totalPages,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 导出操作日志
 * 导出操作日志数据
 */
export const exportOperationLogs = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      action,
      actorType,
      factoryId,
      result,
      limit = 10000
    } = req.query;

    // 构建查询条件 (与getOperationLogs相同的逻辑)
    const where = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (action) where.action = { contains: action };
    if (actorType) where.actorType = actorType;
    if (factoryId) where.factoryId = factoryId;
    if (result) where.result = result;

    // 查询日志数据
    const logs = await prisma.permissionAuditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: parseInt(limit),
    });

    // 转换为导出格式
    const exportData = logs.map(log => ({
      '日志ID': log.id,
      '操作时间': log.timestamp.toLocaleString('zh-CN'),
      '操作者类型': log.actorType,
      '操作者ID': log.actorId,
      '操作者用户名': log.username,
      '操作类型': log.action,
      '目标资源': log.resource || '未知',
      '目标资源ID': log.targetResourceId || '',
      '工厂ID': log.factoryId || '',
      'IP地址': log.ipAddress || '未知',
      '用户代理': log.userAgent || '未知',
      '操作结果': log.result,
      '错误信息': log.errorMessage || '',
    }));

    // 生成导出文件名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `operation_logs_${timestamp}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

    res.json({
      code: 200,
      message: '操作日志导出成功',
      data: {
        export_time: new Date().toISOString(),
        total_records: exportData.length,
        filters: {
          startDate,
          endDate,
          action,
          actorType,
          factoryId,
          result,
        },
        records: exportData,
      },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 为工厂创建超级管理员
 * 为工厂创建超级管理员账户
 */
export const createSuperAdmin = async (req, res, next) => {
  try {
    const { id: factoryId } = req.params;
    const { username, email, fullName, phone } = req.body;
    const { admin } = req;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 检查是否已经存在超级管理员
    const existingSuperAdmin = await prisma.user.findFirst({
      where: {
        factoryId,
        roleCode: 'factory_super_admin',
      },
    });

    if (existingSuperAdmin) {
      throw new ConflictError('该工厂已存在超级管理员');
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findFirst({
      where: {
        factoryId,
        username,
      },
    });

    if (existingUsername) {
      throw new ConflictError('用户名已存在');
    }

    // 检查邮箱是否已存在
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          factoryId,
          email,
        },
      });

      if (existingEmail) {
        throw new ConflictError('邮箱已被使用');
      }
    }

    // 生成随机密码
    const tempPassword = generateRandomPassword();
    const passwordHash = await hashPassword(tempPassword);

    // 创建超级管理员
    const superAdmin = await prisma.user.create({
      data: {
        factoryId,
        username,
        passwordHash,
        email,
        phone,
        fullName,
        isActive: true,
        roleCode: 'factory_super_admin',
        roleLevel: 0,
        department: 'management',
        position: '超级管理员',
        permissions: [
          'admin:read',
          'admin:write',
          'admin:delete',
          'user:read',
          'user:write',
          'user:delete',
          'whitelist:read',
          'whitelist:write',
          'whitelist:delete',
          'farming:read',
          'farming:write',
          'farming:delete',
          'processing:read',
          'processing:write',
          'processing:delete',
          'logistics:read',
          'logistics:write',
          'logistics:delete',
          'quality:read',
          'quality:write',
          'quality:delete',
        ],
      },
    });

    res.status(201).json(createSuccessResponse({
      superAdmin: {
        id: superAdmin.id,
        username: superAdmin.username,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        phone: superAdmin.phone,
        isActive: superAdmin.isActive,
        roleCode: superAdmin.roleCode,
        roleLevel: superAdmin.roleLevel,
        department: superAdmin.department,
        position: superAdmin.position,
        permissions: superAdmin.permissions,
      },
      tempPassword,
      factory: {
        id: factory.id,
        name: factory.name,
      },
    }, '超级管理员创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 简单更新工厂信息
 * 内部使用的简化版本
 */
export const updateFactoryInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      industry,
      address,
      contactName,
      contactEmail,
      contactPhone,
      subscriptionPlan
    } = req.body;

    // 验证工厂是否存在
    const existingFactory = await prisma.factory.findUnique({
      where: { id }
    });

    if (!existingFactory) {
      throw new NotFoundError('工厂不存在');
    }

    // 更新工厂信息
    const updatedFactory = await prisma.factory.update({
      where: { id },
      data: {
        name,
        industry,
        address,
        contactName,
        contactEmail,
        contactPhone,
        subscriptionPlan,
        updatedAt: new Date()
      }
    });

    // 如果更新了联系人信息，同步更新该工厂的超级管理员信息
    if (contactName || contactEmail) {
      await prisma.user.updateMany({
        where: {
          factoryId: id,
          roleCode: 'factory_super_admin'
        },
        data: {
          ...(contactName && { fullName: contactName }),
          ...(contactEmail && { email: contactEmail })
        }
      });
    }

    res.json(createSuccessResponse(updatedFactory,'工厂信息更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 暂停工厂（禁止所有员工登录）
 */
export const suspendFactory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 更新工厂状态为暂停
    const updatedFactory = await prisma.factory.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // 禁用该工厂所有用户的登录
    await prisma.user.updateMany({
      where: { factoryId: id },
      data: {
        isActive: false
      }
    });

    // 撤销该工厂所有用户的会话
    await prisma.session.updateMany({
      where: { factoryId: id },
      data: {
        isRevoked: true
      }
    });

    res.json(createSuccessResponse(updatedFactory, '工厂已暂停，所有员工登录已禁用'));
  } catch (error) {
    next(error);
  }
};

/**
 * 激活工厂（恢复所有员工登录）
 */
export const activateFactory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 更新工厂状态为激活
    const updatedFactory = await prisma.factory.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date()
      }
    });

    // 激活该工厂所有用户的登录（除了未激活状态的用户）
    await prisma.user.updateMany({
      where: {
        factoryId: id,
        roleCode: { not: 'unactivated' }
      },
      data: {
        isActive: true
      }
    });

    res.json(createSuccessResponse(updatedFactory, '工厂已激活，员工登录已恢复'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除工厂（需要密码验证）
 */
export const deleteFactory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password, confirmText } = req.body;

    // 验证密码
    if (password !== '123456') {
      throw new ValidationError('平台管理员密码错误');
    }

    // 验证确认文字
    if (confirmText !== '确定删除') {
      throw new ValidationError('确认文字不正确，请输入"确定删除"');
    }

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id },
      include: {
        users: true,
        sessions: true,
        whitelist: true
      }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 使用事务删除工厂及其相关数据
    await prisma.$transaction(async (tx) => {
      // 删除会话
      await tx.session.deleteMany({
        where: { factoryId: id }
      });

      // 删除白名单
      await tx.userWhitelist.deleteMany({
        where: { factoryId: id }
      });

      // 删除用户角色历史
      await tx.userRoleHistory.deleteMany({
        where: { factoryId: id }
      });

      // 删除用户
      await tx.user.deleteMany({
        where: { factoryId: id }
      });

      // 删除工厂设置
      await tx.factorySettings.deleteMany({
        where: { factoryId: id }
      });

      // 最后删除工厂
      await tx.factory.delete({
        where: { id }
      });
    });

    res.json(createSuccessResponse(null, `工厂 "${factory.name}" 已成功删除`));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定工厂的员工列表
 * 支持分页、搜索和筛选
 */
export const getFactoryEmployees = async (req, res, next) => {
  try {
    const { factoryId } = req.params;
    const { page = 1, size = 10, keyword } = req.query;
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 构建查询条件
    const where = {
      factoryId,
      roleCode: { not: 'unactivated' } // 排除未激活用户
    };

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { fullName: { contains: keyword } },
        { department: { contains: keyword } },
        { position: { contains: keyword } }
      ];
    }

    // 获取总数
    const total = await prisma.user.count({ where });

    // 分页查询
    const skip = (pageNum - 1) * pageSize;
    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        department: true,
        position: true,
        roleCode: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: pageSize
    });

    // 转换数据格式
    const formattedEmployees = employees.map(employee => ({
      id: employee.id.toString(),
      factory_id: factoryId,
      username: employee.username,
      email: employee.email || '',
      phone: employee.phone || '',
      department: employee.department || '',
      position: employee.position || '',
      role: employee.roleCode,
      status: employee.isActive ? 'active' : 'suspended',
      last_login: employee.lastLogin?.toISOString(),
      created_at: employee.createdAt.toISOString(),
      updated_at: employee.updatedAt.toISOString()
    }));

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      code: 200,
      message: '获取员工列表成功',
      data: {
        employees: formattedEmployees,
        pagination: {
          page: pageNum,
          size: pageSize,
          total,
          pages: totalPages
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 更新员工状态
 * 激活或暂停员工
 */
export const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { factoryId, employeeId } = req.params;
    const { status } = req.body;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 验证员工是否存在且属于该工厂
    const employee = await prisma.user.findFirst({
      where: {
        id: parseInt(employeeId),
        factoryId
      }
    });

    if (!employee) {
      throw new NotFoundError('员工不存在');
    }

    // 转换状态
    const isActive = status === 'active';

    // 更新员工状态
    const updatedEmployee = await prisma.user.update({
      where: { id: parseInt(employeeId) },
      data: {
        isActive,
        updatedAt: new Date()
      }
    });

    // 如果暂停员工，撤销其所有会话
    if (!isActive) {
      await prisma.session.updateMany({
        where: { userId: parseInt(employeeId) },
        data: { isRevoked: true }
      });
    }

    // 返回格式化的员工数据
    const formattedEmployee = {
      id: updatedEmployee.id.toString(),
      factory_id: factoryId,
      username: updatedEmployee.username,
      email: updatedEmployee.email || '',
      phone: updatedEmployee.phone || '',
      department: updatedEmployee.department || '',
      position: updatedEmployee.position || '',
      role: updatedEmployee.roleCode,
      status: updatedEmployee.isActive ? 'active' : 'suspended',
      last_login: updatedEmployee.lastLogin?.toISOString(),
      created_at: updatedEmployee.createdAt.toISOString(),
      updated_at: updatedEmployee.updatedAt.toISOString()
    };

    res.json({
      code: 200,
      message: `员工${isActive ? '激活' : '暂停'}成功`,
      data: formattedEmployee
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 删除员工
 * 从工厂中删除员工账户
 */
export const deleteEmployee = async (req, res, next) => {
  try {
    const { factoryId, employeeId } = req.params;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id: factoryId }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    // 验证员工是否存在且属于该工厂
    const employee = await prisma.user.findFirst({
      where: {
        id: parseInt(employeeId),
        factoryId
      }
    });

    if (!employee) {
      throw new NotFoundError('员工不存在');
    }

    // 检查是否为超级管理员（不允许删除）
    if (employee.roleCode === 'factory_super_admin') {
      throw new ValidationError('不能删除工厂超级管理员');
    }

    // 使用事务删除员工及其相关数据
    await prisma.$transaction(async (tx) => {
      // 删除会话
      await tx.session.deleteMany({
        where: { userId: parseInt(employeeId) }
      });

      // 删除角色历史
      await tx.userRoleHistory.deleteMany({
        where: { userId: parseInt(employeeId) }
      });

      // 删除用户
      await tx.user.delete({
        where: { id: parseInt(employeeId) }
      });
    });

    res.json({
      code: 200,
      message: '员工删除成功',
      data: null
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 获取平台白名单列表
 * 平台管理员获取所有工厂的白名单记录
 */
export const getPlatformWhitelists = async (req, res, next) => {
  try {
    const { page = 1, size = 20, factoryId, keyword, status } = req.query;
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);

    // 构建查询条件
    const where = {};

    // 工厂筛选
    if (factoryId && factoryId !== 'all') {
      where.factoryId = factoryId;
    }

    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'active') {
        where.status = 'PENDING';
      } else if (status === 'expired') {
        where.status = 'EXPIRED';
      } else if (status === 'suspended') {
        where.status = 'SUSPENDED';
      }
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { phoneNumber: { contains: keyword } },
        { email: { contains: keyword } },
        { identityCard: { contains: keyword } },
        { factory: { name: { contains: keyword } } }
      ];
    }

    // 获取总数
    const total = await prisma.userWhitelist.count({ where });

    // 分页查询
    const skip = (pageNum - 1) * pageSize;
    const whitelists = await prisma.userWhitelist.findMany({
      where,
      include: {
        factory: {
          select: {
            id: true,
            name: true
          }
        },
        addedByUser: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: pageSize
    });

    // 转换数据格式
    const formattedWhitelists = whitelists.map(whitelist => ({
      id: whitelist.id.toString(),
      factory_id: whitelist.factoryId,
      factory_name: whitelist.factory?.name || '未知工厂',
      identifier: whitelist.phoneNumber || whitelist.email || whitelist.identityCard || '',
      identifier_type: whitelist.phoneNumber ? 'phone' : (whitelist.email ? 'email' : 'id_card'),
      name: whitelist.fullName || '',
      department: whitelist.department || '',
      position: whitelist.position || '',
      status: whitelist.status === 'PENDING' ? 'active' : (whitelist.status === 'EXPIRED' ? 'expired' : 'suspended'),
      expires_at: whitelist.expiresAt?.toISOString(),
      created_by: whitelist.addedByUser?.id?.toString() || '',
      created_by_name: whitelist.addedByUser?.fullName || whitelist.addedByUser?.username || '未知',
      created_at: whitelist.createdAt.toISOString(),
      updated_at: whitelist.updatedAt.toISOString(),
      last_used_at: whitelist.lastUsedAt?.toISOString()
    }));

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      code: 200,
      message: '获取白名单列表成功',
      data: {
        whitelists: formattedWhitelists,
        pagination: {
          page: pageNum,
          size: pageSize,
          total,
          pages: totalPages
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 批量导入白名单
 * 平台管理员批量导入白名单记录
 */
export const batchImportWhitelists = async (req, res, next) => {
  try {
    const { factory_id, whitelists } = req.body;

    // 验证工厂是否存在
    const factory = await prisma.factory.findUnique({
      where: { id: factory_id }
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

    let successCount = 0;
    let failedCount = 0;
    const failedRecords = [];

    // 逐个处理白名单记录
    for (const item of whitelists) {
      try {
        const { identifier, identifier_type, name, department, position, expires_at } = item;

        // 检查是否已存在
        const existing = await prisma.userWhitelist.findFirst({
          where: {
            factoryId: factory_id,
            OR: [
              { phoneNumber: identifier_type === 'phone' ? identifier : null },
              { email: identifier_type === 'email' ? identifier : null },
              { identityCard: identifier_type === 'id_card' ? identifier : null }
            ]
          }
        });

        if (existing) {
          failedCount++;
          failedRecords.push({
            identifier,
            reason: '记录已存在'
          });
          continue;
        }

        // 创建白名单记录
        const whitelistData = {
          factoryId: factory_id,
          fullName: name,
          department,
          position,
          status: 'PENDING',
          expiresAt: expires_at ? new Date(expires_at) : null,
          addedByUserId: 1 // 平台管理员ID
        };

        // 根据类型设置对应字段
        if (identifier_type === 'phone') {
          whitelistData.phoneNumber = identifier;
        } else if (identifier_type === 'email') {
          whitelistData.email = identifier;
        } else {
          whitelistData.identityCard = identifier;
        }

        await prisma.userWhitelist.create({
          data: whitelistData
        });

        successCount++;

      } catch (err) {
        failedCount++;
        failedRecords.push({
          identifier: item.identifier,
          reason: err.message
        });
      }
    }

    res.json({
      code: 200,
      message: '批量导入完成',
      data: {
        success_count: successCount,
        failed_count: failedCount,
        failed_records: failedRecords
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 更新白名单状态
 * 平台管理员更新白名单记录状态
 */
export const updateWhitelistStatus = async (req, res, next) => {
  try {
    const { whitelistId } = req.params;
    const { status } = req.body;

    // 验证白名单记录是否存在
    const whitelist = await prisma.userWhitelist.findUnique({
      where: { id: parseInt(whitelistId) },
      include: {
        factory: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!whitelist) {
      throw new NotFoundError('白名单记录不存在');
    }

    // 转换状态
    let dbStatus;
    if (status === 'active') {
      dbStatus = 'PENDING';
    } else if (status === 'suspended') {
      dbStatus = 'SUSPENDED';
    } else if (status === 'expired') {
      dbStatus = 'EXPIRED';
    } else {
      throw new ValidationError('无效的状态值');
    }

    // 更新状态
    const updatedWhitelist = await prisma.userWhitelist.update({
      where: { id: parseInt(whitelistId) },
      data: {
        status: dbStatus,
        updatedAt: new Date()
      }
    });

    // 返回格式化数据
    const formattedWhitelist = {
      id: updatedWhitelist.id.toString(),
      factory_id: updatedWhitelist.factoryId,
      factory_name: whitelist.factory?.name || '未知工厂',
      identifier: updatedWhitelist.phoneNumber || updatedWhitelist.email || updatedWhitelist.identityCard || '',
      identifier_type: updatedWhitelist.phoneNumber ? 'phone' : (updatedWhitelist.email ? 'email' : 'id_card'),
      name: updatedWhitelist.fullName || '',
      department: updatedWhitelist.department || '',
      position: updatedWhitelist.position || '',
      status: updatedWhitelist.status === 'PENDING' ? 'active' : (updatedWhitelist.status === 'EXPIRED' ? 'expired' : 'suspended'),
      expires_at: updatedWhitelist.expiresAt?.toISOString(),
      created_at: updatedWhitelist.createdAt.toISOString(),
      updated_at: updatedWhitelist.updatedAt.toISOString()
    };

    res.json({
      code: 200,
      message: '白名单状态更新成功',
      data: formattedWhitelist
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 删除白名单记录
 * 平台管理员删除白名单记录
 */
export const deletePlatformWhitelist = async (req, res, next) => {
  try {
    const { whitelistId } = req.params;

    // 验证白名单记录是否存在
    const whitelist = await prisma.userWhitelist.findUnique({
      where: { id: parseInt(whitelistId) }
    });

    if (!whitelist) {
      throw new NotFoundError('白名单记录不存在');
    }

    // 检查是否已被注册用户使用
    if (whitelist.status === 'REGISTERED') {
      throw new BusinessLogicError('已注册的白名单记录无法删除');
    }

    // 删除记录
    await prisma.userWhitelist.delete({
      where: { id: parseInt(whitelistId) }
    });

    res.json({
      code: 200,
      message: '白名单记录删除成功',
      data: null
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 批量删除白名单记录
 * 平台管理员批量删除白名单记录
 */
export const batchDeleteWhitelists = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('请选择要删除的记录');
    }

    // 查找白名单记录
    const whitelists = await prisma.userWhitelist.findMany({
      where: {
        id: {
          in: ids.map(id => parseInt(id))
        }
      }
    });

    if (whitelists.length === 0) {
      throw new NotFoundError('未找到可删除的记录');
    }

    // 检查是否有已注册的记录
    const registeredRecords = whitelists.filter(w => w.status === 'REGISTERED');
    if (registeredRecords.length > 0) {
      throw new BusinessLogicError('存在已注册的白名单记录，无法删除');
    }

    // 批量删除
    const result = await prisma.userWhitelist.deleteMany({
      where: {
        id: {
          in: whitelists.map(w => w.id)
        }
      }
    });

    res.json({
      code: 200,
      message: '批量删除成功',
      data: {
        success_count: result.count,
        failed_count: 0
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 清理过期白名单记录
 * 清理所有过期的白名单记录
 */
export const cleanupExpiredWhitelists = async (req, res, next) => {
  try {
    // 删除过期的白名单记录
    const result = await prisma.userWhitelist.deleteMany({
      where: {
        status: 'EXPIRED'
      }
    });

    // 同时将超过过期时间但状态仍为PENDING的记录标记为过期并删除
    const expiredPendingResult = await prisma.userWhitelist.deleteMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date()
        }
      }
    });

    const totalDeleted = result.count + expiredPendingResult.count;

    res.json({
      code: 200,
      message: '过期记录清理完成',
      data: {
        deleted_count: totalDeleted
      }
    });

  } catch (error) {
    next(error);
  }
};
