const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * 工厂服务层
 * 统一处理工厂相关的业务逻辑，减少控制器层的重复代码
 */
class FactoryService {

  /**
   * 统一工厂信息更新方法
   * 合并原有的 updateFactory 和 updateFactoryInfo 函数
   * @param {string} factoryId - 工厂ID
   * @param {Object} updateData - 更新数据
   * @param {string} operatorId - 操作者ID
   * @param {boolean} isFullUpdate - 是否为完整更新（包含创建操作日志等）
   * @returns {Promise<Object>} 更新结果
   */
  async updateFactoryInfo(factoryId, updateData, operatorId, isFullUpdate = true) {
    try {
      // 验证工厂是否存在
      const existingFactory = await prisma.factory.findUnique({
        where: { id: factoryId },
        include: {
          owner: true,
          users: {
            select: { id: true, username: true, status: true }
          }
        }
      });

      if (!existingFactory) {
        throw new Error('工厂不存在');
      }

      // 验证数据
      const validatedData = await this.validateFactoryUpdateData(updateData, factoryId);

      // 构建更新数据
      const updateFields = {
        updated_at: new Date()
      };

      // 映射字段
      const fieldMapping = {
        name: 'name',
        industry: 'industry',
        contactName: 'owner_name',
        contactEmail: 'owner_email',
        contactPhone: 'owner_phone',
        address: 'contact_address',
        description: 'description',
        subscriptionPlan: 'subscription_plan'
      };

      // 只更新提供的字段
      Object.keys(validatedData).forEach(key => {
        if (fieldMapping[key] && validatedData[key] !== undefined) {
          updateFields[fieldMapping[key]] = validatedData[key];
        }
      });

      // 执行更新
      const updatedFactory = await prisma.factory.update({
        where: { id: factoryId },
        data: updateFields,
        include: {
          owner: true,
          users: {
            select: { id: true, username: true, status: true }
          },
          _count: {
            select: { users: true }
          }
        }
      });

      // 如果是完整更新，记录操作日志
      if (isFullUpdate) {
        await this.createFactoryUpdateLog({
          factoryId,
          operatorId,
          changes: this.getChangedFields(existingFactory, updateFields),
          factoryName: updatedFactory.name
        });
      }

      // 处理相关联系人信息更新
      if (validatedData.contactEmail && validatedData.contactEmail !== existingFactory.owner_email) {
        await this.updateFactoryOwnerContact(factoryId, validatedData);
      }

      logger.info('工厂信息更新成功', {
        factoryId,
        factoryName: updatedFactory.name,
        operatorId,
        changedFields: Object.keys(updateFields)
      });

      return {
        success: true,
        factory: updatedFactory,
        message: '工厂信息更新成功'
      };

    } catch (error) {
      logger.error('工厂信息更新失败', {
        factoryId,
        operatorId,
        error: error.message
      });
      
      throw new Error(`工厂信息更新失败: ${error.message}`);
    }
  }

  /**
   * 统一工厂状态更新方法
   * @param {string} factoryId - 工厂ID
   * @param {string} status - 新状态 ('active', 'suspended', 'deleted')
   * @param {string} operatorId - 操作者ID
   * @param {string} reason - 操作原因
   * @returns {Promise<Object>} 更新结果
   */
  async updateFactoryStatus(factoryId, status, operatorId, reason = '') {
    try {
      // 验证状态值
      const validStatuses = ['active', 'suspended', 'deleted'];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的状态值: ${status}`);
      }

      // 获取工厂信息
      const factory = await prisma.factory.findUnique({
        where: { id: factoryId },
        include: {
          users: {
            select: { id: true, username: true, status: true }
          },
          owner: true
        }
      });

      if (!factory) {
        throw new Error('工厂不存在');
      }

      // 更新工厂状态
      const updatedFactory = await prisma.factory.update({
        where: { id: factoryId },
        data: {
          status: status,
          isActive: status === 'active',
          updated_at: new Date(),
          ...(status === 'suspended' && { suspended_at: new Date(), suspended_reason: reason }),
          ...(status === 'active' && { suspended_at: null, suspended_reason: null })
        },
        include: {
          owner: true,
          users: {
            select: { id: true, username: true, status: true }
          },
          _count: {
            select: { users: true }
          }
        }
      });

      // 记录操作日志
      await this.createFactoryStatusLog({
        factoryId,
        fromStatus: factory.status,
        toStatus: status,
        operatorId,
        reason,
        factoryInfo: {
          name: factory.name,
          ownerEmail: factory.owner_email,
          userCount: factory.users.length
        }
      });

      // 处理状态变更的附加效果
      await this.handleFactoryStatusChangeEffects(factory, status, reason);

      logger.info('工厂状态更新成功', {
        factoryId,
        factoryName: factory.name,
        fromStatus: factory.status,
        toStatus: status,
        operatorId,
        reason
      });

      return {
        success: true,
        factory: updatedFactory,
        message: this.getFactoryStatusChangeMessage(status),
        affectedUsers: factory.users.length
      };

    } catch (error) {
      logger.error('工厂状态更新失败', {
        factoryId,
        status,
        operatorId,
        error: error.message
      });
      
      throw new Error(`工厂状态更新失败: ${error.message}`);
    }
  }

  /**
   * 批量更新工厂状态
   */
  async batchUpdateFactoryStatus(factoryIds, status, operatorId, reason = '') {
    try {
      const results = {
        successful: [],
        failed: [],
        total: factoryIds.length
      };

      for (const factoryId of factoryIds) {
        try {
          const result = await this.updateFactoryStatus(factoryId, status, operatorId, reason);
          results.successful.push({
            factoryId,
            factoryName: result.factory.name,
            status: result.factory.status,
            affectedUsers: result.affectedUsers
          });
        } catch (error) {
          results.failed.push({
            factoryId,
            error: error.message
          });
        }
      }

      logger.info('批量工厂状态更新完成', {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        operatorId
      });

      return {
        success: true,
        results,
        message: `批量操作完成：成功 ${results.successful.length} 个，失败 ${results.failed.length} 个`
      };

    } catch (error) {
      logger.error('批量工厂状态更新失败', {
        factoryIds,
        status,
        operatorId,
        error: error.message
      });
      
      throw new Error(`批量工厂状态更新失败: ${error.message}`);
    }
  }

  /**
   * 验证工厂更新数据
   */
  async validateFactoryUpdateData(updateData, factoryId) {
    const validatedData = {};

    // 验证工厂名称
    if (updateData.name !== undefined) {
      if (!updateData.name || updateData.name.trim().length === 0) {
        throw new Error('工厂名称不能为空');
      }
      
      // 检查名称是否重复
      const existingFactory = await prisma.factory.findFirst({
        where: {
          name: updateData.name.trim(),
          id: { not: factoryId }
        }
      });
      
      if (existingFactory) {
        throw new Error('工厂名称已存在');
      }
      
      validatedData.name = updateData.name.trim();
    }

    // 验证邮箱
    if (updateData.contactEmail !== undefined) {
      if (updateData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.contactEmail)) {
        throw new Error('请输入有效的邮箱地址');
      }
      validatedData.contactEmail = updateData.contactEmail;
    }

    // 验证手机号
    if (updateData.contactPhone !== undefined) {
      if (updateData.contactPhone && !/^1[3-9]\d{9}$/.test(updateData.contactPhone)) {
        throw new Error('请输入有效的手机号码');
      }
      validatedData.contactPhone = updateData.contactPhone;
    }

    // 其他字段直接赋值
    ['industry', 'contactName', 'address', 'description', 'subscriptionPlan'].forEach(field => {
      if (updateData[field] !== undefined) {
        validatedData[field] = updateData[field];
      }
    });

    return validatedData;
  }

  /**
   * 处理工厂状态变更的附加效果
   */
  async handleFactoryStatusChangeEffects(factory, newStatus, reason) {
    try {
      switch (newStatus) {
        case 'suspended':
          // 暂停工厂时，暂停所有员工
          await this.suspendAllFactoryUsers(factory.id, reason);
          await this.sendFactoryStatusNotification(factory, 'suspended', reason);
          break;
          
        case 'active':
          // 激活工厂时，可以选择性激活员工
          await this.sendFactoryStatusNotification(factory, 'activated', reason);
          break;
          
        case 'deleted':
          // 删除工厂时，处理相关数据
          await this.handleFactoryDeletion(factory.id);
          break;
          
        default:
          break;
      }
    } catch (error) {
      logger.warn('处理工厂状态变更附加效果时出现警告', {
        factoryId: factory.id,
        newStatus,
        error: error.message
      });
    }
  }

  /**
   * 暂停工厂所有用户
   */
  async suspendAllFactoryUsers(factoryId, reason) {
    try {
      await prisma.user.updateMany({
        where: {
          factory_id: factoryId,
          status: 'active'
        },
        data: {
          status: 'suspended',
          updated_at: new Date()
        }
      });

      logger.info('工厂用户批量暂停完成', { factoryId, reason });
    } catch (error) {
      logger.error('工厂用户批量暂停失败', {
        factoryId,
        error: error.message
      });
    }
  }

  /**
   * 更新工厂联系人信息
   */
  async updateFactoryOwnerContact(factoryId, contactData) {
    try {
      // 这里可以实现更新工厂所有者联系信息的逻辑
      // 比如同步更新用户表中的联系信息等
      logger.info('工厂联系人信息更新', { factoryId, contactData });
    } catch (error) {
      logger.warn('更新工厂联系人信息失败', {
        factoryId,
        error: error.message
      });
    }
  }

  /**
   * 发送工厂状态变更通知
   */
  async sendFactoryStatusNotification(factory, action, reason) {
    logger.info('发送工厂状态变更通知', {
      factoryId: factory.id,
      factoryName: factory.name,
      ownerEmail: factory.owner_email,
      action,
      reason
    });
  }

  /**
   * 处理工厂删除
   */
  async handleFactoryDeletion(factoryId) {
    try {
      // 软删除相关数据
      await prisma.factoryStatusLog.updateMany({
        where: { factory_id: factoryId },
        data: { deleted_at: new Date() }
      });
      
      logger.info('工厂删除数据清理完成', { factoryId });
    } catch (error) {
      logger.error('工厂删除数据清理失败', {
        factoryId,
        error: error.message
      });
    }
  }

  /**
   * 创建工厂更新日志
   */
  async createFactoryUpdateLog(logData) {
    try {
      await prisma.factoryUpdateLog.create({
        data: {
          factory_id: logData.factoryId,
          operator_id: logData.operatorId,
          changes: JSON.stringify(logData.changes),
          factory_name: logData.factoryName,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.warn('创建工厂更新日志失败', {
        factoryId: logData.factoryId,
        error: error.message
      });
    }
  }

  /**
   * 创建工厂状态日志
   */
  async createFactoryStatusLog(logData) {
    try {
      await prisma.factoryStatusLog.create({
        data: {
          factory_id: logData.factoryId,
          from_status: logData.fromStatus,
          to_status: logData.toStatus,
          operator_id: logData.operatorId,
          reason: logData.reason,
          factory_info: JSON.stringify(logData.factoryInfo),
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.warn('创建工厂状态日志失败', {
        factoryId: logData.factoryId,
        error: error.message
      });
    }
  }

  /**
   * 获取变更字段
   */
  getChangedFields(originalData, updateFields) {
    const changes = {};
    Object.keys(updateFields).forEach(key => {
      if (key !== 'updated_at' && originalData[key] !== updateFields[key]) {
        changes[key] = {
          from: originalData[key],
          to: updateFields[key]
        };
      }
    });
    return changes;
  }

  /**
   * 获取工厂状态变更消息
   */
  getFactoryStatusChangeMessage(status) {
    const messages = {
      'active': '工厂已激活',
      'suspended': '工厂已暂停',
      'deleted': '工厂已删除'
    };
    return messages[status] || '工厂状态已更新';
  }

  /**
   * 获取工厂状态统计
   */
  async getFactoryStatusStats() {
    try {
      const stats = await prisma.factory.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const result = {
        total: 0,
        active: 0,
        suspended: 0,
        deleted: 0
      };

      stats.forEach(stat => {
        result[stat.status] = stat._count.id;
        result.total += stat._count.id;
      });

      return result;
    } catch (error) {
      logger.error('获取工厂状态统计失败', {
        error: error.message
      });
      throw new Error('获取工厂状态统计失败');
    }
  }
}

module.exports = new FactoryService();