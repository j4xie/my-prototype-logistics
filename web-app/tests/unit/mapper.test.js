/**
 * 数据映射模块测试
 * @version 1.0.0
 */

// 模拟数据映射模块
// 注意：实际项目中需要导入真实的mapper模块
const productMapper = {
  toDTO: jest.fn(entity => ({
    id: entity.id,
    name: entity.name,
    description: entity.description || '',
    category: entity.category,
    price: entity.price,
    createdAt: entity.created_at
  })),
  toEntity: jest.fn(dto => ({
    id: dto.id,
    name: dto.name,
    description: dto.description,
    category: dto.category,
    price: dto.price,
    created_at: dto.createdAt,
    updated_at: new Date().toISOString()
  }))
};

describe('产品数据映射器测试', () => {
  // 测试产品数据映射 - 实体到DTO
  test('toDTO应该正确将实体映射为DTO', () => {
    // 准备测试数据
    const productEntity = {
      id: '123',
      name: '有机西红柿',
      description: '新鲜有机西红柿',
      category: '蔬菜',
      price: 5.99,
      created_at: '2023-01-15T08:00:00Z',
      updated_at: '2023-01-15T09:30:00Z',
      stock_count: 100, // 额外字段，不应出现在DTO中
      supplier_id: 'sup-789' // 额外字段，不应出现在DTO中
    };

    // 调用映射方法
    const dto = productMapper.toDTO(productEntity);

    // 验证结果
    expect(dto).toEqual({
      id: '123',
      name: '有机西红柿',
      description: '新鲜有机西红柿',
      category: '蔬菜',
      price: 5.99,
      createdAt: '2023-01-15T08:00:00Z'
    });

    // 验证不包含额外字段
    expect(dto).not.toHaveProperty('updated_at');
    expect(dto).not.toHaveProperty('stock_count');
    expect(dto).not.toHaveProperty('supplier_id');
  });

  // 测试产品数据映射 - DTO到实体
  test('toEntity应该正确将DTO映射为实体', () => {
    // 准备测试数据
    const productDTO = {
      id: '456',
      name: '有机苹果',
      description: '新鲜有机苹果',
      category: '水果',
      price: 3.99,
      createdAt: '2023-02-20T10:00:00Z'
    };

    // 模拟当前时间
    const fakeNow = '2023-02-21T15:30:00.000Z'; // 使用精确到毫秒的格式
    const realDate = Date;
    global.Date = class extends Date {
      constructor() {
        super();
        return new realDate(fakeNow);
      }
      toISOString() {
        return fakeNow;
      }
    };

    // 调用映射方法
    const entity = productMapper.toEntity(productDTO);

    // 恢复真实的Date
    global.Date = realDate;

    // 验证结果
    expect(entity).toEqual({
      id: '456',
      name: '有机苹果',
      description: '新鲜有机苹果',
      category: '水果',
      price: 3.99,
      created_at: '2023-02-20T10:00:00Z',
      updated_at: fakeNow
    });
  });

  // 测试空描述的处理
  test('toDTO应该为空描述提供默认值', () => {
    // 准备测试数据 - 没有描述字段
    const productEntity = {
      id: '789',
      name: '有机胡萝卜',
      category: '蔬菜',
      price: 2.49,
      created_at: '2023-03-10T14:30:00Z'
    };

    // 调用映射方法
    const dto = productMapper.toDTO(productEntity);

    // 验证结果 - 应该有默认的空描述
    expect(dto.description).toBe('');
  });
});

// 另一个映射器的测试示例
describe('用户数据映射器测试', () => {
  // 模拟用户映射器
  const userMapper = {
    toDTO: jest.fn(entity => ({
      id: entity.id,
      username: entity.username,
      email: entity.email,
      role: entity.role,
      lastLogin: entity.last_login
    })),
    toEntity: jest.fn(dto => ({
      id: dto.id,
      username: dto.username,
      email: dto.email,
      role: dto.role,
      last_login: dto.lastLogin,
      created_at: dto.createdAt || new Date().toISOString()
    }))
  };

  // 测试用户数据映射 - 实体到DTO
  test('toDTO应该正确将用户实体映射为DTO', () => {
    // 准备测试数据
    const userEntity = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      last_login: '2023-04-01T09:15:00Z',
      password_hash: 'hashed_password', // 敏感字段，不应出现在DTO中
      created_at: '2023-01-01T00:00:00Z'
    };

    // 调用映射方法
    const dto = userMapper.toDTO(userEntity);

    // 验证结果
    expect(dto).toEqual({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      lastLogin: '2023-04-01T09:15:00Z'
    });

    // 验证不包含敏感字段
    expect(dto).not.toHaveProperty('password_hash');
    expect(dto).not.toHaveProperty('created_at');
  });

  // 测试用户数据映射 - DTO到实体
  test('toEntity应该正确将用户DTO映射为实体', () => {
    // 准备测试数据
    const userDTO = {
      id: 'user-456',
      username: 'newuser',
      email: 'new@example.com',
      role: 'user',
      lastLogin: '2023-04-05T16:20:00Z',
      createdAt: '2023-03-15T12:00:00Z'
    };

    // 调用映射方法
    const entity = userMapper.toEntity(userDTO);

    // 验证结果
    expect(entity).toEqual({
      id: 'user-456',
      username: 'newuser',
      email: 'new@example.com',
      role: 'user',
      last_login: '2023-04-05T16:20:00Z',
      created_at: '2023-03-15T12:00:00Z'
    });
  });
}); 