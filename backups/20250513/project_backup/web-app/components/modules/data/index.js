/**
 * 食品溯源系统 - 数据映射模块索引
 * 版本: 1.0.0
 * 
 * 此文件为数据映射模块的主入口，导出所有数据转换相关功能
 */

// 导入映射器
const { 
  productMapper, 
  userMapper, 
  traceRecordMapper,
  mapToDTO,
  mapToEntity 
} = require('./mappers');

// 创建数据模块对象
const dataModule = {
  productMapper,
  userMapper,
  traceRecordMapper,
  mapToDTO,
  mapToEntity
};

// CommonJS导出
module.exports = dataModule;
