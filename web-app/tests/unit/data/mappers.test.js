/**
 * 食品溯源系统 - 数据映射器测试
 * 测试所有数据转换映射功能
 */

// 导入被测试模块
const { productMapper, userMapper, traceRecordMapper, mapToDTO, mapToEntity } = require('../../../components/modules/data/mappers');

describe('数据映射器测试', () => {
  describe('产品数据映射器 (productMapper)', () => {
    const mockBackendProduct = {
      id: 'prod-123',
      name: '有机苹果',
      description: '新鲜有机苹果，产自云南高原',
      categoryId: 'cat-001',
      categoryName: '水果',
      price: 15.99,
      stock: 100,
      images: ['apple1.jpg', 'apple2.jpg'],
      createdAt: '2025-04-15T10:30:00Z',
      updatedAt: '2025-04-16T08:15:30Z',
      originId: 'org-001',
      originName: '云南高原',
      originLocation: '云南省昆明市',
      batchNumber: 'B2025041500',
      productionDate: '2025-04-10',
      expiryDate: '2025-05-10'
    };
    
    const mockFrontendProduct = {
      id: 'prod-123',
      name: '有机苹果',
      description: '新鲜有机苹果，产自云南高原',
      category: {
        id: 'cat-001',
        name: '水果'
      },
      price: 15.99,
      stock: 100,
      images: ['apple1.jpg', 'apple2.jpg'],
      created: '2025-04-15T10:30:00Z',
      updated: '2025-04-16T08:15:30Z',
      origin: {
        id: 'org-001',
        name: '云南高原',
        location: '云南省昆明市'
      },
      batchNumber: 'B2025041500',
      productionDate: '2025-04-10',
      expiryDate: '2025-05-10'
    };
    
    test('toFrontend方法应将后端产品数据转换为前端格式', () => {
      const result = productMapper.toFrontend(mockBackendProduct);
      expect(result).toEqual(mockFrontendProduct);
    });
    
    test('toBackend方法应将前端产品数据转换为后端格式', () => {
      const result = productMapper.toBackend(mockFrontendProduct);
      expect(result).toEqual({
        id: 'prod-123',
        name: '有机苹果',
        description: '新鲜有机苹果，产自云南高原',
        categoryId: 'cat-001',
        price: 15.99,
        stock: 100,
        images: ['apple1.jpg', 'apple2.jpg'],
        originId: 'org-001',
        batchNumber: 'B2025041500',
        productionDate: '2025-04-10',
        expiryDate: '2025-05-10'
      });
    });
    
    test('toFrontend方法应处理缺失字段并使用默认值', () => {
      const incompleteProduct = {
        id: 'prod-456',
        name: '有机橙子'
        // 其他字段缺失
      };
      
      const result = productMapper.toFrontend(incompleteProduct);
      
      expect(result.id).toBe('prod-456');
      expect(result.name).toBe('有机橙子');
      expect(result.description).toBe('');
      expect(result.category).toEqual({ id: '', name: '' });
      expect(result.price).toBe(0);
      expect(result.stock).toBe(0);
      expect(result.images).toEqual([]);
      expect(result.created).toBeDefined();
      expect(result.origin).toEqual({ id: '', name: '', location: '' });
      expect(result.batchNumber).toBe('');
    });
    
    test('toFrontend方法应处理null输入', () => {
      expect(productMapper.toFrontend(null)).toBeNull();
      expect(productMapper.toFrontend(undefined)).toBeNull();
    });
    
    test('toBackend方法应处理null输入', () => {
      expect(productMapper.toBackend(null)).toBeNull();
      expect(productMapper.toBackend(undefined)).toBeNull();
    });
  });
  
  describe('用户数据映射器 (userMapper)', () => {
    const mockBackendUser = {
      id: 'user-123',
      username: 'zhang.san',
      email: 'zhang.san@example.com',
      role: 'admin',
      name: '张三',
      avatar: 'avatar.jpg',
      permissions: ['read', 'write', 'delete'],
      createdAt: '2025-01-15T08:30:00Z',
      lastLoginAt: '2025-04-16T10:45:00Z'
    };
    
    const mockFrontendUser = {
      id: 'user-123',
      username: 'zhang.san',
      email: 'zhang.san@example.com',
      role: 'admin',
      name: '张三',
      avatar: 'avatar.jpg',
      permissions: ['read', 'write', 'delete'],
      created: '2025-01-15T08:30:00Z',
      lastLogin: '2025-04-16T10:45:00Z'
    };
    
    test('toFrontend方法应将后端用户数据转换为前端格式', () => {
      const result = userMapper.toFrontend(mockBackendUser);
      expect(result).toEqual(mockFrontendUser);
    });
    
    test('toBackend方法应将前端用户数据转换为后端格式', () => {
      const result = userMapper.toBackend(mockFrontendUser);
      expect(result).toEqual({
        id: 'user-123',
        username: 'zhang.san',
        email: 'zhang.san@example.com',
        role: 'admin',
        name: '张三',
        avatar: 'avatar.jpg'
      });
    });
    
    test('toFrontend方法应处理缺失字段并使用默认值', () => {
      const incompleteUser = {
        id: 'user-456',
        username: 'li.si'
        // 其他字段缺失
      };
      
      const result = userMapper.toFrontend(incompleteUser);
      
      expect(result.id).toBe('user-456');
      expect(result.username).toBe('li.si');
      expect(result.email).toBe('');
      expect(result.role).toBe('user'); // 默认角色
      expect(result.name).toBe('');
      expect(result.avatar).toBeNull();
      expect(result.permissions).toEqual([]);
      expect(result.created).toBeDefined();
      expect(result.lastLogin).toBeNull();
    });
    
    test('toFrontend方法应处理permissions不是数组的情况', () => {
      const userWithInvalidPermissions = {
        id: 'user-789',
        username: 'wang.wu',
        permissions: 'read,write' // 不是数组而是字符串
      };
      
      const result = userMapper.toFrontend(userWithInvalidPermissions);
      expect(result.permissions).toEqual([]);
    });
    
    test('toFrontend和toBackend方法应处理null输入', () => {
      expect(userMapper.toFrontend(null)).toBeNull();
      expect(userMapper.toBackend(null)).toBeNull();
    });
  });
  
  describe('溯源记录映射器 (traceRecordMapper)', () => {
    const mockBackendTraceRecord = {
      id: 'trace-123',
      productId: 'prod-123',
      productName: '有机苹果',
      stage: '收获',
      location: '云南省昆明市',
      handlerId: 'user-123',
      handlerName: '张三',
      handlerRole: '农场主',
      createdAt: '2025-04-10T09:15:00Z',
      details: {
        temperature: '25°C',
        humidity: '70%',
        notes: '阳光充足，品质优良'
      },
      verified: true,
      blockchainHash: '0x1a2b3c4d5e6f'
    };
    
    const mockFrontendTraceRecord = {
      id: 'trace-123',
      productId: 'prod-123',
      productName: '有机苹果',
      stage: '收获',
      location: '云南省昆明市',
      handler: {
        id: 'user-123',
        name: '张三',
        role: '农场主'
      },
      timestamp: '2025-04-10T09:15:00Z',
      details: {
        temperature: '25°C',
        humidity: '70%',
        notes: '阳光充足，品质优良'
      },
      verified: true,
      blockchainHash: '0x1a2b3c4d5e6f'
    };
    
    test('toFrontend方法应将后端溯源记录转换为前端格式', () => {
      const result = traceRecordMapper.toFrontend(mockBackendTraceRecord);
      expect(result).toEqual(mockFrontendTraceRecord);
    });
    
    test('toBackend方法应将前端溯源记录转换为后端格式', () => {
      const result = traceRecordMapper.toBackend(mockFrontendTraceRecord);
      expect(result).toEqual({
        id: 'trace-123',
        productId: 'prod-123',
        stage: '收获',
        location: '云南省昆明市',
        handlerId: 'user-123',
        details: {
          temperature: '25°C',
          humidity: '70%',
          notes: '阳光充足，品质优良'
        },
        verified: true
      });
    });
    
    test('toFrontend方法应处理缺失字段并使用默认值', () => {
      const incompleteRecord = {
        id: 'trace-456',
        productId: 'prod-456'
        // 其他字段缺失
      };
      
      const result = traceRecordMapper.toFrontend(incompleteRecord);
      
      expect(result.id).toBe('trace-456');
      expect(result.productId).toBe('prod-456');
      expect(result.productName).toBe('');
      expect(result.stage).toBe('');
      expect(result.location).toBe('');
      expect(result.handler).toEqual({ id: '', name: '', role: '' });
      expect(result.timestamp).toBeDefined();
      expect(result.details).toEqual({});
      expect(result.verified).toBe(false);
      expect(result.blockchainHash).toBeNull();
    });
    
    test('toFrontend方法应正确转换verified字段', () => {
      // 测试不同的verified值
      expect(traceRecordMapper.toFrontend({ verified: true }).verified).toBe(true);
      expect(traceRecordMapper.toFrontend({ verified: false }).verified).toBe(false);
      expect(traceRecordMapper.toFrontend({ verified: 1 }).verified).toBe(true);
      expect(traceRecordMapper.toFrontend({ verified: 0 }).verified).toBe(false);
      expect(traceRecordMapper.toFrontend({ verified: null }).verified).toBe(false);
      expect(traceRecordMapper.toFrontend({ verified: undefined }).verified).toBe(false);
    });
    
    test('toFrontend和toBackend方法应处理null输入', () => {
      expect(traceRecordMapper.toFrontend(null)).toBeNull();
      expect(traceRecordMapper.toBackend(null)).toBeNull();
    });
  });
  
  describe('通用映射函数 (mapToDTO 和 mapToEntity)', () => {
    test('mapToDTO应将单个实体转换为DTO', () => {
      const mockEntity = { id: 'prod-123', name: '有机苹果', categoryId: 'cat-001' };
      const mockMapper = {
        toFrontend: jest.fn(entity => ({ 
          id: entity.id,
          name: entity.name,
          category: { id: entity.categoryId }
        }))
      };
      
      const result = mapToDTO(mockEntity, mockMapper);
      
      expect(mockMapper.toFrontend).toHaveBeenCalledWith(mockEntity);
      expect(result).toEqual({
        id: 'prod-123',
        name: '有机苹果',
        category: { id: 'cat-001' }
      });
    });
    
    test('mapToDTO应将实体数组转换为DTO数组', () => {
      const mockEntities = [
        { id: 'prod-123', name: '有机苹果', categoryId: 'cat-001' },
        { id: 'prod-456', name: '有机橙子', categoryId: 'cat-001' }
      ];
      const mockMapper = {
        toFrontend: jest.fn(entity => ({ 
          id: entity.id,
          name: entity.name,
          category: { id: entity.categoryId }
        }))
      };
      
      const result = mapToDTO(mockEntities, mockMapper);
      
      expect(mockMapper.toFrontend).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { id: 'prod-123', name: '有机苹果', category: { id: 'cat-001' } },
        { id: 'prod-456', name: '有机橙子', category: { id: 'cat-001' } }
      ]);
    });
    
    test('mapToEntity应将单个DTO转换为实体', () => {
      const mockDTO = { 
        id: 'prod-123',
        name: '有机苹果',
        category: { id: 'cat-001' }
      };
      const mockMapper = {
        toBackend: jest.fn(dto => ({
          id: dto.id,
          name: dto.name,
          categoryId: dto.category.id
        }))
      };
      
      const result = mapToEntity(mockDTO, mockMapper);
      
      expect(mockMapper.toBackend).toHaveBeenCalledWith(mockDTO);
      expect(result).toEqual({
        id: 'prod-123',
        name: '有机苹果',
        categoryId: 'cat-001'
      });
    });
    
    test('mapToEntity应将DTO数组转换为实体数组', () => {
      const mockDTOs = [
        { id: 'prod-123', name: '有机苹果', category: { id: 'cat-001' } },
        { id: 'prod-456', name: '有机橙子', category: { id: 'cat-001' } }
      ];
      const mockMapper = {
        toBackend: jest.fn(dto => ({
          id: dto.id,
          name: dto.name,
          categoryId: dto.category.id
        }))
      };
      
      const result = mapToEntity(mockDTOs, mockMapper);
      
      expect(mockMapper.toBackend).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { id: 'prod-123', name: '有机苹果', categoryId: 'cat-001' },
        { id: 'prod-456', name: '有机橙子', categoryId: 'cat-001' }
      ]);
    });
    
    test('通用映射函数应处理缺失的映射器', () => {
      const entity = { id: 'test' };
      
      expect(mapToDTO(entity)).toEqual(entity);
      expect(mapToDTO(entity, null)).toEqual(entity);
      expect(mapToDTO(entity, {})).toEqual(entity);
      expect(mapToDTO(entity, { noToFrontend: () => {} })).toEqual(entity);
      
      expect(mapToEntity(entity)).toEqual(entity);
      expect(mapToEntity(entity, null)).toEqual(entity);
      expect(mapToEntity(entity, {})).toEqual(entity);
      expect(mapToEntity(entity, { noToBackend: () => {} })).toEqual(entity);
    });
    
    test('通用映射函数应处理null或undefined输入', () => {
      const mockMapper = {
        toFrontend: jest.fn(),
        toBackend: jest.fn()
      };
      
      expect(mapToDTO(null, mockMapper)).toBeNull();
      expect(mapToDTO(undefined, mockMapper)).toBeUndefined();
      expect(mapToEntity(null, mockMapper)).toBeNull();
      expect(mapToEntity(undefined, mockMapper)).toBeUndefined();
      
      expect(mockMapper.toFrontend).not.toHaveBeenCalled();
      expect(mockMapper.toBackend).not.toHaveBeenCalled();
    });
  });
}); 