/**
 * 数据映射器模块 - 处理数据层与视图层之间的数据转换
 * @version 1.0.0
 * @module components/modules/data/mappers
 */

/**
 * 产品数据映射器 - 处理产品数据实体与DTO之间的转换
 */
const productMapper = {
  /**
   * 将产品实体转换为DTO (Data Transfer Object)
   * @param {Object} entity - 产品实体对象
   * @returns {Object} 产品DTO对象
   */
  toDTO: function(entity) {
    if (!entity) return null;
    
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || '',
      category: entity.category,
      price: entity.price,
      createdAt: entity.created_at
    };
  },
  
  /**
   * 将产品DTO转换为实体
   * @param {Object} dto - 产品DTO对象
   * @returns {Object} 产品实体对象
   */
  toEntity: function(dto) {
    if (!dto) return null;
    
    return {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      price: dto.price,
      created_at: dto.createdAt,
      updated_at: new Date().toISOString()
    };
  }
};

/**
 * 用户数据映射器 - 处理用户数据实体与DTO之间的转换
 */
const userMapper = {
  /**
   * 将用户实体转换为DTO
   * @param {Object} entity - 用户实体对象
   * @returns {Object} 用户DTO对象
   */
  toDTO: function(entity) {
    if (!entity) return null;
    
    return {
      id: entity.id,
      username: entity.username,
      email: entity.email,
      role: entity.role,
      lastLogin: entity.last_login
    };
  },
  
  /**
   * 将用户DTO转换为实体
   * @param {Object} dto - 用户DTO对象
   * @returns {Object} 用户实体对象
   */
  toEntity: function(dto) {
    if (!dto) return null;
    
    return {
      id: dto.id,
      username: dto.username,
      email: dto.email,
      role: dto.role,
      last_login: dto.lastLogin,
      created_at: dto.createdAt || new Date().toISOString()
    };
  }
};

/**
 * 溯源记录数据映射器 - 处理溯源记录数据实体与DTO之间的转换
 */
const traceRecordMapper = {
  /**
   * 将溯源记录实体转换为DTO
   * @param {Object} entity - 溯源记录实体对象
   * @returns {Object} 溯源记录DTO对象
   */
  toDTO: function(entity) {
    if (!entity) return null;
    
    return {
      id: entity.id,
      productId: entity.product_id,
      timestamp: entity.timestamp,
      location: entity.location ? {
        latitude: entity.location.lat || entity.location.latitude,
        longitude: entity.location.lng || entity.location.longitude,
        address: entity.location.address
      } : null,
      operation: entity.operation,
      operatorId: entity.operator_id,
      operatorName: entity.operator_name,
      details: entity.details || {},
      verificationStatus: entity.verification_status
    };
  },
  
  /**
   * 将溯源记录DTO转换为实体
   * @param {Object} dto - 溯源记录DTO对象
   * @returns {Object} 溯源记录实体对象
   */
  toEntity: function(dto) {
    if (!dto) return null;
    
    return {
      id: dto.id,
      product_id: dto.productId,
      timestamp: dto.timestamp,
      location: dto.location ? {
        lat: dto.location.latitude,
        lng: dto.location.longitude,
        address: dto.location.address
      } : null,
      operation: dto.operation,
      operator_id: dto.operatorId,
      operator_name: dto.operatorName,
      details: dto.details || {},
      verification_status: dto.verificationStatus,
      created_at: new Date().toISOString()
    };
  }
};

/**
 * 将对象数组映射为DTO数组
 * @param {Function} mapperFn - 映射函数
 * @param {Array} entities - 实体对象数组
 * @returns {Array} DTO对象数组
 */
function mapToDTO(mapperFn, entities) {
  if (!Array.isArray(entities)) return [];
  return entities.map(entity => mapperFn(entity)).filter(dto => dto !== null);
}

/**
 * 将DTO数组映射为实体数组
 * @param {Function} mapperFn - 映射函数
 * @param {Array} dtos - DTO对象数组
 * @returns {Array} 实体对象数组
 */
function mapToEntity(mapperFn, dtos) {
  if (!Array.isArray(dtos)) return [];
  return dtos.map(dto => mapperFn(dto)).filter(entity => entity !== null);
}

// 导出映射器
export {
  productMapper,
  userMapper,
  traceRecordMapper,
  mapToDTO,
  mapToEntity
};

// 为了向后兼容，同时支持CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    productMapper,
    userMapper,
    traceRecordMapper,
    mapToDTO,
    mapToEntity
  };
} 