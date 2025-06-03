/**
 * 食品溯源系统 - 数据映射工具
 * 版本: 1.0.0
 * 
 * 此文件包含数据转换映射的功能，用于将后端数据转换为前端使用的格式，以及相反的过程
 */

/**
 * 产品数据映射器
 */
const productMapper = {
  /**
   * 将后端产品数据转换为前端格式
   * @param {Object} product - 后端产品数据
   * @returns {Object} - 前端产品数据
   */
  toFrontend: function(product) {
    if (!product) return null;
    
    return {
      id: product.id || '',
      name: product.name || '',
      description: product.description || '',
      category: {
        id: product.categoryId || '',
        name: product.categoryName || ''
      },
      price: product.price || 0,
      stock: product.stock || 0,
      images: Array.isArray(product.images) ? product.images : [],
      created: product.createdAt || new Date().toISOString(),
      updated: product.updatedAt || new Date().toISOString(),
      // 溯源相关字段
      origin: {
        id: product.originId || '',
        name: product.originName || '',
        location: product.originLocation || ''
      },
      batchNumber: product.batchNumber || '',
      productionDate: product.productionDate || '',
      expiryDate: product.expiryDate || ''
    };
  },
  
  /**
   * 将前端产品数据转换为后端格式
   * @param {Object} product - 前端产品数据
   * @returns {Object} - 后端产品数据
   */
  toBackend: function(product) {
    if (!product) return null;
    
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.category ? product.category.id : '',
      price: product.price,
      stock: product.stock,
      images: product.images,
      // 溯源相关字段
      originId: product.origin ? product.origin.id : '',
      batchNumber: product.batchNumber,
      productionDate: product.productionDate,
      expiryDate: product.expiryDate
    };
  },
  
  /**
   * 将产品实体转换为DTO (Data Transfer Object)
   * 兼容测试需求的方法
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
   * 兼容测试需求的方法
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
 * 用户数据映射器
 */
const userMapper = {
  /**
   * 将后端用户数据转换为前端格式
   * @param {Object} user - 后端用户数据
   * @returns {Object} - 前端用户数据
   */
  toFrontend: function(user) {
    if (!user) return null;
    
    return {
      id: user.id || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'user',
      name: user.name || '',
      avatar: user.avatar || null,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      created: user.createdAt || new Date().toISOString(),
      lastLogin: user.lastLoginAt || null
    };
  },
  
  /**
   * 将前端用户数据转换为后端格式
   * @param {Object} user - 前端用户数据
   * @returns {Object} - 后端用户数据
   */
  toBackend: function(user) {
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      avatar: user.avatar
    };
  },
  
  /**
   * 将用户实体转换为DTO
   * 兼容测试需求的方法
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
      name: entity.name || entity.displayName,
      createdAt: entity.created_at
    };
  },
  
  /**
   * 将用户DTO转换为实体
   * 兼容测试需求的方法
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
      name: dto.name,
      displayName: dto.name,
      created_at: dto.createdAt,
      updated_at: new Date().toISOString()
    };
  }
};

/**
 * 溯源记录映射器
 */
const traceRecordMapper = {
  /**
   * 将后端溯源记录转换为前端格式
   * @param {Object} record - 后端溯源记录
   * @returns {Object} - 前端溯源记录
   */
  toFrontend: function(record) {
    if (!record) return null;
    
    return {
      id: record.id || '',
      productId: record.productId || '',
      productName: record.productName || '',
      stage: record.stage || '',
      location: record.location || '',
      handler: {
        id: record.handlerId || '',
        name: record.handlerName || '',
        role: record.handlerRole || ''
      },
      timestamp: record.createdAt || new Date().toISOString(),
      details: record.details || {},
      verified: !!record.verified,
      blockchainHash: record.blockchainHash || null
    };
  },
  
  /**
   * 将前端溯源记录转换为后端格式
   * @param {Object} record - 前端溯源记录
   * @returns {Object} - 后端溯源记录
   */
  toBackend: function(record) {
    if (!record) return null;
    
    return {
      id: record.id,
      productId: record.productId,
      stage: record.stage,
      location: record.location,
      handlerId: record.handler ? record.handler.id : '',
      details: record.details,
      verified: record.verified
    };
  },
  
  /**
   * 将溯源记录实体转换为DTO
   * 兼容测试需求的方法
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
   * 兼容测试需求的方法
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
 * 通用DTO转换函数
 * @param {Object} entity - 实体对象
 * @param {Object} mapper - 映射器
 * @returns {Object} - DTO对象
 */
function mapToDTO(entity, mapper) {
  if (!entity || !mapper || typeof mapper.toFrontend !== 'function') {
    return entity;
  }
  
  if (Array.isArray(entity)) {
    return entity.map(item => mapper.toFrontend(item));
  }
  
  return mapper.toFrontend(entity);
}

/**
 * 通用实体转换函数
 * @param {Object} dto - DTO对象
 * @param {Object} mapper - 映射器
 * @returns {Object} - 实体对象
 */
function mapToEntity(dto, mapper) {
  if (!dto || !mapper || typeof mapper.toBackend !== 'function') {
    return dto;
  }
  
  if (Array.isArray(dto)) {
    return dto.map(item => mapper.toBackend(item));
  }
  
  return mapper.toBackend(dto);
}

// 导出所有映射器和通用函数
module.exports = {
  productMapper,
  userMapper,
  traceRecordMapper,
  mapToDTO,
  mapToEntity
};
