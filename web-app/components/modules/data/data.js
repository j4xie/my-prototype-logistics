/**
 * 食品溯源系统 - 数据访问模块
 * 版本: 1.0.0
 * 
 * 此模块负责处理前端与后端API之间的数据交互，
 * 包括数据获取、发送和缓存等功能。
 */

import { traceRecordMapper } from './mappers';

/**
 * 溯源数据访问模块
 */
export const traceData = (function() {
  // 内部状态
  const state = {
    apiBaseUrl: '/api/v1',
    cache: new Map(),
    lastFetch: new Map()
  };

  /**
   * 初始化模块
   * @param {Object} options - 配置选项
   */
  function init(options = {}) {
    if (options.apiBaseUrl) {
      state.apiBaseUrl = options.apiBaseUrl;
    }
    
    return {
      getTraceRecords,
      getTraceRecordById,
      createTraceRecord,
      updateTraceRecord,
      deleteTraceRecord
    };
  }

  /**
   * 获取溯源记录列表
   * @param {boolean} forceRefresh - 是否强制从服务器刷新数据
   * @returns {Promise<Array>} 溯源记录数组
   */
  async function getTraceRecords(forceRefresh = false) {
    const cacheKey = 'traceRecords';
    
    // 如果不强制刷新且缓存中有数据，则使用缓存
    if (!forceRefresh && state.cache.has(cacheKey)) {
      return state.cache.get(cacheKey);
    }
    
    try {
      // 从API获取数据
      const response = await fetch(`${state.apiBaseUrl}/trace-records`);
      
      if (!response.ok) {
        throw new Error(`获取溯源记录失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 使用mapper转换数据格式
      const records = data.map(record => traceRecordMapper.mapToFrontend(record));
      
      // 缓存数据
      state.cache.set(cacheKey, records);
      state.lastFetch.set(cacheKey, Date.now());
      
      return records;
    } catch (error) {
      console.error('获取溯源记录错误:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取单个溯源记录
   * @param {string} recordId - 记录ID
   * @returns {Promise<Object>} 溯源记录对象
   */
  async function getTraceRecordById(recordId) {
    if (!recordId) {
      throw new Error('记录ID不能为空');
    }
    
    try {
      const response = await fetch(`${state.apiBaseUrl}/trace-records/${recordId}`);
      
      if (!response.ok) {
        throw new Error(`获取溯源记录失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 使用mapper转换数据格式
      return traceRecordMapper.mapToFrontend(data);
    } catch (error) {
      console.error(`获取溯源记录(ID: ${recordId})错误:`, error);
      throw error;
    }
  }

  /**
   * 创建新的溯源记录
   * @param {Object} record - 溯源记录对象
   * @returns {Promise<Object>} 创建的溯源记录
   */
  async function createTraceRecord(record) {
    if (!record) {
      throw new Error('记录数据不能为空');
    }
    
    try {
      // 转换为后端格式
      const backendRecord = traceRecordMapper.mapToBackend(record);
      
      const response = await fetch(`${state.apiBaseUrl}/trace-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backendRecord)
      });
      
      if (!response.ok) {
        throw new Error(`创建溯源记录失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 清除缓存
      state.cache.delete('traceRecords');
      
      // 转换为前端格式并返回
      return traceRecordMapper.mapToFrontend(data);
    } catch (error) {
      console.error('创建溯源记录错误:', error);
      throw error;
    }
  }

  /**
   * 更新溯源记录
   * @param {string} recordId - 记录ID
   * @param {Object} record - 更新的记录数据
   * @returns {Promise<Object>} 更新后的溯源记录
   */
  async function updateTraceRecord(recordId, record) {
    if (!recordId) {
      throw new Error('记录ID不能为空');
    }
    
    if (!record) {
      throw new Error('记录数据不能为空');
    }
    
    try {
      // 转换为后端格式
      const backendRecord = traceRecordMapper.mapToBackend(record);
      
      const response = await fetch(`${state.apiBaseUrl}/trace-records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backendRecord)
      });
      
      if (!response.ok) {
        throw new Error(`更新溯源记录失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 清除缓存
      state.cache.delete('traceRecords');
      
      // 转换为前端格式并返回
      return traceRecordMapper.mapToFrontend(data);
    } catch (error) {
      console.error(`更新溯源记录(ID: ${recordId})错误:`, error);
      throw error;
    }
  }

  /**
   * 删除溯源记录
   * @param {string} recordId - 记录ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async function deleteTraceRecord(recordId) {
    if (!recordId) {
      throw new Error('记录ID不能为空');
    }
    
    try {
      const response = await fetch(`${state.apiBaseUrl}/trace-records/${recordId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`删除溯源记录失败: ${response.status} ${response.statusText}`);
      }
      
      // 清除缓存
      state.cache.delete('traceRecords');
      
      return true;
    } catch (error) {
      console.error(`删除溯源记录(ID: ${recordId})错误:`, error);
      throw error;
    }
  }

  // 返回公共API
  return {
    init,
    getTraceRecords,
    getTraceRecordById,
    createTraceRecord,
    updateTraceRecord,
    deleteTraceRecord
  };
})(); 