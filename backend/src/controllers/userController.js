import { PrismaClient } from '@prisma/client';
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  BusinessLogicError,
  createSuccessResponse 
} from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

/**
 * 激活用户
 * 管理员激活用户并分配角色权限
 */
export const activateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleCode, roleLevel, department, position, permissions } = req.body;
    const { user: currentUser } = req;

    // 查找要激活的用户
    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        factoryId: currentUser.factoryId,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('用户不存在');
    }

    // 检查用户是否已激活
    if (targetUser.isActive) {
      throw new BusinessLogicError('用户已激活');
    }

    // 验证角色权限（只有super_admin可以创建permission_admin）
    if (roleCode === 'permission_admin' && currentUser.roleCode !== 'factory_super_admin') {
      throw new BusinessLogicError('只有超级管理员可以创建权限管理员');
    }

    // 验证部门权限
    if (department && !validateDepartmentPermissions(department, permissions)) {
      throw new ValidationError('权限与部门不匹配');
    }

    // 激活用户
    const activatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        isActive: true,
        roleCode,
        roleLevel,
        department,
        position,
        permissions: permissions || [],
      },
    });

    res.json(createSuccessResponse({
      user: {
        id: activatedUser.id,
        username: activatedUser.username,
        email: activatedUser.email,
        fullName: activatedUser.fullName,
        isActive: activatedUser.isActive,
        roleCode: activatedUser.roleCode,
        roleLevel: activatedUser.roleLevel,
        department: activatedUser.department,
        position: activatedUser.position,
        permissions: activatedUser.permissions,
      },
    }, '用户激活成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户列表
 * 分页获取工厂的用户列表
 */
export const getUsers = async (req, res, next) => {
  try {
    const { page, pageSize, isActive, roleCode, department, search } = req.query;
    const { user } = req;

    // 构建查询条件
    const where = {
      factoryId: user.factoryId,
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (roleCode) {
      where.roleCode = roleCode;
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // 获取总数
    const total = await prisma.user.count({ where });

    // 分页查询
    const skip = (page - 1) * pageSize;
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
        roleCode: true,
        roleLevel: true,
        department: true,
        position: true,
        permissions: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { roleLevel: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: pageSize,
    });

    res.json(createSuccessResponse({
      items: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      },
    }, '获取用户列表成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取待激活用户列表
 * 获取所有未激活的用户
 */
export const getPendingUsers = async (req, res, next) => {
  try {
    const { user } = req;

    const pendingUsers = await prisma.user.findMany({
      where: {
        factoryId: user.factoryId,
        isActive: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(createSuccessResponse({
      items: pendingUsers,
      count: pendingUsers.length,
    }, '获取待激活用户成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户信息
 * 管理员更新用户信息
 */
export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { fullName, email, phone, department, position, permissions } = req.body;
    const { user: currentUser } = req;

    // 查找要更新的用户
    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        factoryId: currentUser.factoryId,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('用户不存在');
    }

    // 检查邮箱是否已被其他用户使用
    if (email && email !== targetUser.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          factoryId: currentUser.factoryId,
          email,
          id: {
            not: targetUser.id,
          },
        },
      });

      if (existingUser) {
        throw new ConflictError('邮箱已被其他用户使用');
      }
    }

    // 构建更新数据
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (department) updateData.department = department;
    if (position) updateData.position = position;
    if (permissions) updateData.permissions = permissions;

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: updateData,
    });

    res.json(createSuccessResponse({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        department: updatedUser.department,
        position: updatedUser.position,
        permissions: updatedUser.permissions,
      },
    }, '用户信息更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 停用/启用用户
 * 管理员停用或启用用户
 */
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const { user: currentUser } = req;

    // 查找要操作的用户
    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        factoryId: currentUser.factoryId,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('用户不存在');
    }

    // 防止超级管理员被停用
    if (targetUser.roleCode === 'factory_super_admin' && !isActive) {
      throw new BusinessLogicError('超级管理员不能被停用');
    }

    // 防止自己停用自己
    if (targetUser.id === currentUser.id && !isActive) {
      throw new BusinessLogicError('不能停用自己');
    }

    // 更新用户状态
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: { isActive },
    });

    // 如果停用用户，撤销其所有会话
    if (!isActive) {
      await prisma.session.updateMany({
        where: {
          userId: targetUser.id,
          factoryId: currentUser.factoryId,
        },
        data: {
          isRevoked: true,
        },
      });
    }

    res.json(createSuccessResponse({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isActive: updatedUser.isActive,
      },
    }, `用户${isActive ? '启用' : '停用'}成功`));
  } catch (error) {
    next(error);
  }
};

/**
 * 重置用户密码
 * 管理员重置用户密码
 */
export const resetUserPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { user: currentUser } = req;

    // 查找要重置密码的用户
    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        factoryId: currentUser.factoryId,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('用户不存在');
    }

    // 生成临时密码
    const tempPassword = generateRandomPassword();
    const passwordHash = await hashPassword(tempPassword);

    // 更新用户密码
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { passwordHash },
    });

    // 撤销用户所有会话
    await prisma.session.updateMany({
      where: {
        userId: targetUser.id,
        factoryId: currentUser.factoryId,
      },
      data: {
        isRevoked: true,
      },
    });

    res.json(createSuccessResponse({
      tempPassword,
      message: '密码重置成功，请将临时密码告知用户',
    }, '密码重置成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户统计信息
 * 获取工厂用户的统计数据
 */
export const getUserStats = async (req, res, next) => {
  try {
    const { user } = req;

    // 统计各种状态的用户数量
    const activeUsers = await prisma.user.count({
      where: {
        factoryId: user.factoryId,
        isActive: true,
      },
    });

    const pendingUsers = await prisma.user.count({
      where: {
        factoryId: user.factoryId,
        isActive: false,
      },
    });

    // 按角色统计
    const roleStats = await prisma.user.groupBy({
      by: ['roleCode'],
      where: {
        factoryId: user.factoryId,
        isActive: true,
      },
      _count: {
        id: true,
      },
    });

    // 按部门统计
    const departmentStats = await prisma.user.groupBy({
      by: ['department'],
      where: {
        factoryId: user.factoryId,
        isActive: true,
        department: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    // 统计最近登录的用户
    const recentLoginUsers = await prisma.user.count({
      where: {
        factoryId: user.factoryId,
        isActive: true,
        lastLogin: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天内
        },
      },
    });

    res.json(createSuccessResponse({
      activeUsers,
      pendingUsers,
      totalUsers: activeUsers + pendingUsers,
      roleStats: roleStats.reduce((acc, stat) => {
        acc[stat.roleCode] = stat._count.id;
        return acc;
      }, {}),
      departmentStats: departmentStats.reduce((acc, stat) => {
        acc[stat.department] = stat._count.id;
        return acc;
      }, {}),
      recentLoginUsers,
    }, '获取用户统计成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 验证部门权限
 * 验证权限是否与部门匹配
 */
function validateDepartmentPermissions(department, permissions) {
  if (!permissions || permissions.length === 0) {
    return true;
  }

  const departmentPermissions = {
    'farming': ['farming:read', 'farming:write', 'farming:delete'],
    'processing': ['processing:read', 'processing:write', 'processing:delete'],
    'logistics': ['logistics:read', 'logistics:write', 'logistics:delete'],
    'quality': ['quality:read', 'quality:write', 'quality:delete'],
    'admin': ['admin:read', 'admin:write', 'admin:delete'],
  };

  const validPermissions = departmentPermissions[department] || [];
  
  return permissions.every(permission => 
    validPermissions.includes(permission) || 
    permission.startsWith('common:')
  );
}

// 导入密码生成函数
import { generateRandomPassword, hashPassword } from '../utils/password.js';