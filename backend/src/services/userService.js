const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * 用户状态服务层
 * 统一处理用户状态相关的业务逻辑，减少控制器层的重复代码
 */
class UserService {
  
  /**
   * 统一用户状态更新方法
   * @param {string} userId - 用户ID
   * @param {string} status - 新状态 ('active', 'inactive', 'suspended', 'deleted')
   * @param {string} operatorId - 操作者ID
   * @param {string} reason - 操作原因
   * @returns {Promise<Object>} 更新结果
   */
  async updateUserStatus(userId, status, operatorId, reason = '') {
    try {
      // 验证状态值
      const validStatuses = ['active', 'inactive', 'suspended', 'deleted'];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的状态值: ${status}`);
      }

      // 获取用户信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          factory: true
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查权限（可根据需要扩展）
      if (user.role === 'platform_super_admin' && status === 'deleted') {
        throw new Error('不能删除超级管理员账户');
      }

      // 更新用户状态
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          status: status,
          is_active: status === 'active',
          updated_at: new Date()
        },
        include: {
          factory: true
        }
      });

      // 记录操作日志
      await this.createUserStatusLog({
        userId: userId,
        fromStatus: user.status,
        toStatus: status,
        operatorId: operatorId,
        reason: reason,
        userInfo: {
          username: user.username,
          email: user.email,
          factoryName: user.factory?.name || null
        }
      });

      // 根据状态执行额外操作
      await this.handleStatusChangeEffects(user, status, reason);

      logger.info('用户状态更新成功', {
        userId,
        username: user.username,
        fromStatus: user.status,
        toStatus: status,
        operatorId,
        reason
      });

      return {
        success: true,
        user: updatedUser,
        message: this.getStatusChangeMessage(status)
      };

    } catch (error) {
      logger.error('用户状态更新失败', {
        userId,
        status,
        operatorId,
        error: error.message
      });
      
      throw new Error(`用户状态更新失败: ${error.message}`);
    }
  }

  /**
   * 批量更新用户状态
   * @param {Array<string>} userIds - 用户ID数组
   * @param {string} status - 新状态
   * @param {string} operatorId - 操作者ID
   * @param {string} reason - 操作原因
   * @returns {Promise<Object>} 批量更新结果
   */
  async batchUpdateUserStatus(userIds, status, operatorId, reason = '') {
    try {
      const results = {
        successful: [],
        failed: [],
        total: userIds.length
      };

      // 并发处理，但限制并发数量
      const concurrencyLimit = 5;
      const chunks = [];
      for (let i = 0; i < userIds.length; i += concurrencyLimit) {
        chunks.push(userIds.slice(i, i + concurrencyLimit));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async (userId) => {
          try {
            const result = await this.updateUserStatus(userId, status, operatorId, reason);
            results.successful.push({
              userId,
              username: result.user.username,
              status: result.user.status
            });
          } catch (error) {
            results.failed.push({
              userId,
              error: error.message
            });
          }
        });

        await Promise.all(promises);
      }

      logger.info('批量用户状态更新完成', {
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
      logger.error('批量用户状态更新失败', {
        userIds,
        status,
        operatorId,
        error: error.message
      });
      
      throw new Error(`批量用户状态更新失败: ${error.message}`);
    }
  }

  /**
   * 处理状态变更的附加效果
   * @param {Object} user - 用户对象
   * @param {string} newStatus - 新状态
   * @param {string} reason - 操作原因
   */
  async handleStatusChangeEffects(user, newStatus, reason) {
    try {
      switch (newStatus) {
        case 'suspended':
          // 暂停用户时，可能需要清除会话、发送通知等
          await this.clearUserSessions(user.id);
          await this.sendStatusChangeNotification(user, 'suspended', reason);
          break;
          
        case 'active':
          // 激活用户时，可能需要发送欢迎邮件等
          await this.sendStatusChangeNotification(user, 'activated', reason);
          break;
          
        case 'deleted':
          // 删除用户时，需要清理相关数据
          await this.cleanupUserData(user.id);
          break;
          
        default:
          break;
      }
    } catch (error) {
      logger.warn('处理状态变更附加效果时出现警告', {
        userId: user.id,
        newStatus,
        error: error.message
      });
      // 不抛出错误，避免影响主要的状态更新操作
    }
  }

  /**
   * 创建用户状态操作日志
   */
  async createUserStatusLog(logData) {
    try {
      await prisma.userStatusLog.create({
        data: {
          user_id: logData.userId,
          from_status: logData.fromStatus,
          to_status: logData.toStatus,
          operator_id: logData.operatorId,
          reason: logData.reason,
          user_info: JSON.stringify(logData.userInfo),
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.warn('创建用户状态日志失败', {
        userId: logData.userId,
        error: error.message
      });
      // 不抛出错误，避免影响主要操作
    }
  }

  /**
   * 清除用户会话
   */
  async clearUserSessions(userId) {
    // 这里可以实现清除Redis中的用户会话
    // 或者将用户的JWT token加入黑名单等逻辑
    logger.info('清除用户会话', { userId });
  }

  /**
   * 发送状态变更通知
   */
  async sendStatusChangeNotification(user, action, reason) {
    // 这里可以实现发送邮件、短信或系统通知的逻辑
    logger.info('发送状态变更通知', {
      userId: user.id,
      email: user.email,
      action,
      reason
    });
  }

  /**
   * 清理用户数据
   */
  async cleanupUserData(userId) {
    try {
      // 软删除相关数据，而不是物理删除
      await prisma.userStatusLog.updateMany({
        where: { user_id: userId },
        data: { deleted_at: new Date() }
      });
      
      logger.info('用户数据清理完成', { userId });
    } catch (error) {
      logger.error('用户数据清理失败', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * 获取状态变更消息
   */
  getStatusChangeMessage(status) {
    const messages = {
      'active': '用户已激活',
      'inactive': '用户已设为非活跃',
      'suspended': '用户已暂停',
      'deleted': '用户已删除'
    };
    return messages[status] || '用户状态已更新';
  }

  /**
   * 获取用户状态统计
   */
  async getUserStatusStats(factoryId = null) {
    try {
      const whereClause = factoryId ? { factory_id: factoryId } : {};
      
      const stats = await prisma.user.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
          id: true
        }
      });

      const result = {
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        deleted: 0
      };

      stats.forEach(stat => {
        result[stat.status] = stat._count.id;
        result.total += stat._count.id;
      });

      return result;
    } catch (error) {
      logger.error('获取用户状态统计失败', {
        factoryId,
        error: error.message
      });
      throw new Error('获取用户状态统计失败');
    }
  }

  /**
   * 验证用户状态操作权限
   */
  async validateStatusChangePermission(operatorId, targetUserId, targetStatus) {
    try {
      const operator = await prisma.user.findUnique({
        where: { id: operatorId }
      });

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
      });

      if (!operator || !targetUser) {
        throw new Error('操作者或目标用户不存在');
      }

      // 权限验证逻辑
      if (operator.role === 'platform_super_admin') {
        return true; // 超级管理员有所有权限
      }

      if (operator.role === 'platform_admin') {
        // 平台管理员不能操作超级管理员
        if (targetUser.role === 'platform_super_admin') {
          throw new Error('无权限操作超级管理员账户');
        }
        return true;
      }

      if (operator.role === 'factory_admin') {
        // 工厂管理员只能操作同工厂的普通用户
        if (operator.factory_id !== targetUser.factory_id) {
          throw new Error('只能操作同工厂的用户');
        }
        if (targetUser.role.includes('admin')) {
          throw new Error('无权限操作管理员账户');
        }
        return true;
      }

      throw new Error('无权限执行此操作');
    } catch (error) {
      logger.error('权限验证失败', {
        operatorId,
        targetUserId,
        targetStatus,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new UserService();