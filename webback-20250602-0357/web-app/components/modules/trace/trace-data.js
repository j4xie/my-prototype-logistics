/**
 * 溯源记录数据操作模块
 * 提供溯源记录的增删改查基本操作
 */

const { db } = require('../../../core/database');
const { logger } = require('../../../core/logger');
const { validateTraceRecord } = require('./trace-validation');

/**
 * 溯源记录数据操作类
 */
class TraceData {
  /**
   * 创建单条溯源记录
   * @param {Object} recordData - 溯源记录数据
   * @returns {Promise<Object>} 创建的溯源记录
   * @throws {Error} 创建失败时抛出错误
   */
  async createTraceRecord(recordData) {
    try {
      // 验证记录数据
      const validationResult = validateTraceRecord(recordData);
      if (!validationResult.valid) {
        throw new Error(`溯源记录数据无效: ${validationResult.errors.join(', ')}`);
      }

      // 添加创建时间
      const data = {
        ...recordData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 插入记录到数据库
      const result = await db.collection('traceRecords').insertOne(data);
      
      if (!result.insertedId) {
        throw new Error('创建溯源记录失败');
      }

      // 返回创建的记录（包含ID）
      return {
        id: result.insertedId.toString(),
        ...data
      };
    } catch (error) {
      logger.error(`创建溯源记录失败: ${error.message}`, { recordData });
      throw error;
    }
  }

  /**
   * 更新溯源记录
   * @param {string} recordId - 溯源记录ID
   * @param {Object} updateData - 更新的数据
   * @returns {Promise<Object>} 更新结果
   * @throws {Error} 更新失败时抛出错误
   */
  async updateTraceRecord(recordId, updateData) {
    try {
      if (!recordId) {
        throw new Error('记录ID不能为空');
      }

      if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
        throw new Error('更新数据不能为空');
      }

      // 添加更新时间
      const data = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      // 更新记录
      const result = await db.collection('traceRecords').updateOne(
        { _id: db.ObjectId(recordId) },
        { $set: data }
      );

      if (result.matchedCount === 0) {
        throw new Error(`未找到ID为${recordId}的溯源记录`);
      }

      return {
        success: true,
        id: recordId,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      logger.error(`更新溯源记录失败: ${error.message}`, { recordId, updateData });
      throw error;
    }
  }

  /**
   * 删除溯源记录
   * @param {string} recordId - 溯源记录ID
   * @returns {Promise<Object>} 删除结果
   * @throws {Error} 删除失败时抛出错误
   */
  async deleteTraceRecord(recordId) {
    try {
      if (!recordId) {
        throw new Error('记录ID不能为空');
      }

      // 删除记录
      const result = await db.collection('traceRecords').deleteOne({
        _id: db.ObjectId(recordId)
      });

      if (result.deletedCount === 0) {
        throw new Error(`未找到ID为${recordId}的溯源记录`);
      }

      return {
        success: true,
        id: recordId,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      logger.error(`删除溯源记录失败: ${error.message}`, { recordId });
      throw error;
    }
  }

  /**
   * 获取单条溯源记录
   * @param {string} recordId - 溯源记录ID
   * @returns {Promise<Object>} 溯源记录
   * @throws {Error} 获取失败时抛出错误
   */
  async getTraceRecord(recordId) {
    try {
      if (!recordId) {
        throw new Error('记录ID不能为空');
      }

      // 查询记录
      const record = await db.collection('traceRecords').findOne({
        _id: db.ObjectId(recordId)
      });

      if (!record) {
        throw new Error(`未找到ID为${recordId}的溯源记录`);
      }

      // 转换ID格式
      return {
        id: record._id.toString(),
        ...record
      };
    } catch (error) {
      logger.error(`获取溯源记录失败: ${error.message}`, { recordId });
      throw error;
    }
  }

  /**
   * 查询溯源记录
   * @param {Object} queryParams - 查询参数
   * @returns {Promise<Array>} 溯源记录列表
   * @throws {Error} 查询失败时抛出错误
   */
  async getTraceRecords(queryParams = {}) {
    try {
      // 构建查询条件
      const query = {};
      
      // 产品ID筛选
      if (queryParams.productId) {
        query.productId = queryParams.productId;
      }
      
      // 多个产品ID筛选
      if (queryParams.productIds && Array.isArray(queryParams.productIds)) {
        query.productId = { $in: queryParams.productIds };
      }
      
      // 状态筛选
      if (queryParams.status) {
        query.status = queryParams.status;
      }
      
      // 日期范围筛选
      if (queryParams.startDate || queryParams.endDate) {
        query.timestamp = {};
        
        if (queryParams.startDate) {
          query.timestamp.$gte = queryParams.startDate;
        }
        
        if (queryParams.endDate) {
          query.timestamp.$lte = queryParams.endDate;
        }
      }
      
      // 位置筛选
      if (queryParams.location) {
        query.location = { $regex: queryParams.location, $options: 'i' };
      }

      // 高级筛选：模糊搜索
      if (queryParams.search) {
        const searchRegex = { $regex: queryParams.search, $options: 'i' };
        query.$or = [
          { productName: searchRegex },
          { productId: searchRegex },
          { location: searchRegex },
          { 'details.batchNumber': searchRegex }
        ];
      }

      // 分页参数
      const limit = parseInt(queryParams.limit) || 50;
      const skip = parseInt(queryParams.skip) || 0;
      
      // 排序参数
      const sort = {};
      if (queryParams.sortBy) {
        sort[queryParams.sortBy] = queryParams.sortDirection === 'desc' ? -1 : 1;
      } else {
        // 默认按时间戳倒序
        sort.timestamp = -1;
      }

      // 执行查询
      const records = await db.collection('traceRecords')
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // 转换ID格式
      return records.map(record => ({
        id: record._id.toString(),
        ...record,
        _id: undefined
      }));
    } catch (error) {
      logger.error(`查询溯源记录失败: ${error.message}`, { queryParams });
      throw error;
    }
  }

  /**
   * 统计溯源记录数量
   * @param {Object} queryParams - 查询参数
   * @returns {Promise<number>} 记录数量
   * @throws {Error} 统计失败时抛出错误
   */
  async countTraceRecords(queryParams = {}) {
    try {
      // 构建查询条件（与getTraceRecords函数中的逻辑相同）
      const query = {};
      
      if (queryParams.productId) {
        query.productId = queryParams.productId;
      }
      
      if (queryParams.productIds && Array.isArray(queryParams.productIds)) {
        query.productId = { $in: queryParams.productIds };
      }
      
      if (queryParams.status) {
        query.status = queryParams.status;
      }
      
      if (queryParams.startDate || queryParams.endDate) {
        query.timestamp = {};
        
        if (queryParams.startDate) {
          query.timestamp.$gte = queryParams.startDate;
        }
        
        if (queryParams.endDate) {
          query.timestamp.$lte = queryParams.endDate;
        }
      }
      
      if (queryParams.location) {
        query.location = { $regex: queryParams.location, $options: 'i' };
      }

      if (queryParams.search) {
        const searchRegex = { $regex: queryParams.search, $options: 'i' };
        query.$or = [
          { productName: searchRegex },
          { productId: searchRegex },
          { location: searchRegex },
          { 'details.batchNumber': searchRegex }
        ];
      }

      // 执行统计
      return await db.collection('traceRecords').countDocuments(query);
    } catch (error) {
      logger.error(`统计溯源记录失败: ${error.message}`, { queryParams });
      throw error;
    }
  }
}

// 创建并导出实例
const traceData = new TraceData();

module.exports = {
  traceData
}; 