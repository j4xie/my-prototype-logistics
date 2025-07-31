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
 * 分页获取所有工厂
 */
export const getFactories = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, isActive, industry, search } = req.query;
    const { admin } = req;

    // 构建查询条件
    const where = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (industry) {
      where.industry = industry;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactEmail: { contains: search } },
        { address: { contains: search } },
      ];
    }

    // 获取总数
    const total = await prisma.factory.count({ where });

    // 分页查询
    const skip = (page - 1) * pageSize;
    const factories = await prisma.factory.findMany({
      where,
      include: {
        createdByAdmin: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            users: true,
            userWhitelist: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    res.json(createSuccessResponse({
      items: factories.map(factory => ({
        id: factory.id,
        name: factory.name,
        industry: factory.industry,
        contactEmail: factory.contactEmail,
        contactPhone: factory.contactPhone,
        address: factory.address,
        description: factory.description,
        isActive: factory.isActive,
        createdAt: factory.createdAt,
        createdByAdmin: factory.createdByAdmin,
        stats: {
          totalUsers: factory._count.users,
          totalWhitelist: factory._count.userWhitelist,
        },
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      },
    }, '获取工厂列表成功'));
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
    const { isActive } = req.body;
    const { admin } = req;

    // 查找工厂
    const factory = await prisma.factory.findUnique({
      where: { id },
    });

    if (!factory) {
      throw new NotFoundError('工厂不存在');
    }

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

    res.json(createSuccessResponse({
      factory: {
        id: updatedFactory.id,
        name: updatedFactory.name,
        isActive: updatedFactory.isActive,
      },
    }, `工厂${isActive ? '启用' : '停用'}成功`));
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
