/**
 * 溯源记录批量操作模块
 * 提供对溯源记录的批量创建、更新、删除和查询功能
 */

const { traceData } = require('./trace-data');

/**
 * 溯源记录批量操作类
 */
class TraceBatch {
  /**
   * 批量创建溯源记录
   * @param {Array} records - 要创建的溯源记录数组
   * @returns {Promise<Array>} - 创建的记录结果数组
   */
  async createRecords(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('记录必须是非空数组');
    }

    const results = [];
    
    // 并行处理所有创建请求
    const createPromises = records.map(record => 
      traceData.createTraceRecord(record)
        .then(result => {
          results.push(result);
          return result;
        })
        .catch(error => {
          console.error(`创建记录失败: ${error.message}`, record);
          throw error;
        })
    );
    
    await Promise.all(createPromises);
    return results;
  }

  /**
   * 批量更新溯源记录
   * @param {Array<string>} recordIds - 要更新的记录ID数组
   * @param {Object} updateData - 要更新的数据
   * @returns {Promise<Object>} - 包含更新结果的对象
   */
  async updateRecords(recordIds, updateData) {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      throw new Error('记录ID必须是非空数组');
    }

    if (!updateData || typeof updateData !== 'object') {
      throw new Error('更新数据必须是有效对象');
    }

    const results = {
      success: true,
      count: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    // 并行处理所有更新请求
    const updatePromises = recordIds.map(id => 
      traceData.updateTraceRecord(id, updateData)
        .then(() => {
          results.successCount++;
          results.count++;
          return true;
        })
        .catch(error => {
          results.errorCount++;
          results.count++;
          results.success = false;
          results.errors.push({
            id,
            error: error.message
          });
          return false;
        })
    );
    
    await Promise.all(updatePromises);
    return results;
  }

  /**
   * 批量删除溯源记录
   * @param {Array<string>} recordIds - 要删除的记录ID数组
   * @returns {Promise<Object>} - 包含删除结果的对象
   */
  async deleteRecords(recordIds) {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      throw new Error('记录ID必须是非空数组');
    }

    const results = {
      success: true,
      count: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    // 并行处理所有删除请求
    const deletePromises = recordIds.map(id => 
      traceData.deleteTraceRecord(id)
        .then(() => {
          results.successCount++;
          results.count++;
          return true;
        })
        .catch(error => {
          results.errorCount++;
          results.count++;
          results.success = false;
          results.errors.push({
            id,
            error: error.message
          });
          return false;
        })
    );
    
    await Promise.all(deletePromises);
    return results;
  }

  /**
   * 批量查询溯源记录
   * @param {Object} queryParams - 查询参数
   * @returns {Promise<Array>} - 查询结果数组
   */
  async queryRecords(queryParams) {
    if (!queryParams || typeof queryParams !== 'object') {
      throw new Error('查询参数必须是有效对象');
    }

    return await traceData.getTraceRecords(queryParams);
  }

  /**
   * 按批次处理大量记录
   * @param {Array} items - 要处理的项目数组
   * @param {Function} processFn - 处理每个批次的函数
   * @param {number} batchSize - 每批处理的项目数量，默认为50
   * @returns {Promise<Array>} - 所有批次处理的结果
   */
  async processBatches(items, processFn, batchSize = 50) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('项目必须是非空数组');
    }

    if (typeof processFn !== 'function') {
      throw new Error('处理函数必须是有效函数');
    }

    const results = [];
    
    // 分割数组为批次
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      try {
        const batchResults = await processFn(batch);
        results.push(...(Array.isArray(batchResults) ? batchResults : [batchResults]));
      } catch (error) {
        console.error(`批处理失败: ${error.message}`, { batchStart: i, batchSize });
        throw error;
      }
    }
    
    return results;
  }
}

// 导出批量操作实例
const traceBatch = new TraceBatch();

module.exports = {
  traceBatch
}; 