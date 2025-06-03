/**
 * @file test-data.js
 * @description 测试数据生成和管理模块，提供模拟API数据
 * @version 1.0.0
 * @module test-data
 */

// 模拟用户数据
const users = [
  {
    id: 'user1',
    username: 'admin',
    password: 'password123',
    name: '管理员',
    role: 'admin',
    permissions: ['read', 'write', 'admin']
  },
  {
    id: 'user2',
    username: 'user',
    password: 'user123',
    name: '普通用户',
    role: 'user',
    permissions: ['read']
  }
];

// 活跃的认证令牌
const activeTokens = new Map();

// 产品类别
const productCategories = [
  { id: 'cat1', name: '蔬菜', description: '新鲜蔬菜类食品' },
  { id: 'cat2', name: '水果', description: '新鲜水果类食品' },
  { id: 'cat3', name: '肉类', description: '各类肉制品' },
  { id: 'cat4', name: '海鲜', description: '各类海产品' },
  { id: 'cat5', name: '谷物', description: '稻米、小麦等谷物类食品' },
  { id: 'cat6', name: '乳制品', description: '牛奶、奶酪等乳制品' },
  { id: 'cat7', name: '饮料', description: '各类饮料产品' }
];

// 产品产地
const productOrigins = [
  { id: 'origin1', name: '北京', region: '华北' },
  { id: 'origin2', name: '上海', region: '华东' },
  { id: 'origin3', name: '广州', region: '华南' },
  { id: 'origin4', name: '成都', region: '西南' },
  { id: 'origin5', name: '西安', region: '西北' },
  { id: 'origin6', name: '武汉', region: '华中' },
  { id: 'origin7', name: '哈尔滨', region: '东北' }
];

// 生成随机产品数据
const generateProducts = (count = 200) => {
  const products = [];
  const foodPrefixes = ['有机', '绿色', '天然', '精选', '优质', '生态', '传统'];
  const foodSuffixes = ['特产', '珍品', '美味', '佳品', '食品'];
  
  for (let i = 1; i <= count; i++) {
    const categoryIndex = Math.floor(Math.random() * productCategories.length);
    const originIndex = Math.floor(Math.random() * productOrigins.length);
    const category = productCategories[categoryIndex];
    const origin = productOrigins[originIndex];
    
    // 生成随机产品名称
    const prefix = foodPrefixes[Math.floor(Math.random() * foodPrefixes.length)];
    const suffix = foodSuffixes[Math.floor(Math.random() * foodSuffixes.length)];
    
    let name = '';
    if (category.id === 'cat1') { // 蔬菜
      const vegetables = ['白菜', '西红柿', '黄瓜', '土豆', '萝卜', '茄子', '青椒', '西兰花', '菠菜', '生菜'];
      name = `${prefix}${vegetables[Math.floor(Math.random() * vegetables.length)]}`;
    } else if (category.id === 'cat2') { // 水果
      const fruits = ['苹果', '香蕉', '橙子', '葡萄', '梨', '桃子', '西瓜', '草莓', '芒果', '猕猴桃'];
      name = `${prefix}${fruits[Math.floor(Math.random() * fruits.length)]}`;
    } else if (category.id === 'cat3') { // 肉类
      const meats = ['猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '兔肉', '鹅肉'];
      name = `${prefix}${meats[Math.floor(Math.random() * meats.length)]}`;
    } else if (category.id === 'cat4') { // 海鲜
      const seafoods = ['鱼', '虾', '蟹', '贝类', '鱿鱼', '海参', '螺', '海带', '紫菜'];
      name = `${prefix}${seafoods[Math.floor(Math.random() * seafoods.length)]}`;
    } else if (category.id === 'cat5') { // 谷物
      const grains = ['大米', '小麦', '玉米', '高粱', '小米', '燕麦', '荞麦', '糙米'];
      name = `${prefix}${grains[Math.floor(Math.random() * grains.length)]}`;
    } else if (category.id === 'cat6') { // 乳制品
      const dairy = ['牛奶', '酸奶', '奶酪', '黄油', '奶油', '冰淇淋', '酪乳'];
      name = `${prefix}${dairy[Math.floor(Math.random() * dairy.length)]}`;
    } else if (category.id === 'cat7') { // 饮料
      const drinks = ['茶', '咖啡', '果汁', '矿泉水', '碳酸饮料', '能量饮料', '豆浆'];
      name = `${prefix}${drinks[Math.floor(Math.random() * drinks.length)]}`;
    } else {
      name = `${prefix}食品${i}号`;
    }
    
    name = `${origin.name}${name}${suffix}`;
    
    // 生成随机价格和库存
    const price = Math.floor(Math.random() * 9951) / 100 + 5; // 5.00 - 99.50
    const stock = Math.floor(Math.random() * 1000) + 1; // 1-1000
    
    // 生成产品图片URL (使用随机占位图服务)
    const imgSize = 300;
    const imgId = Math.floor(Math.random() * 100) + 1;
    const imageUrl = `https://picsum.photos/id/${imgId}/${imgSize}`;
    
    // 生成二维码URL (使用占位)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=product-${i}`;
    
    // 生成追溯数据
    const traceData = {
      farmInfo: {
        name: `${origin.name}${Math.floor(Math.random() * 5) + 1}号农场`,
        location: `${origin.name}市${['东', '西', '南', '北'][Math.floor(Math.random() * 4)]}郊`,
        contact: `1391234${i.toString().padStart(4, '0')}`
      },
      harvest: {
        date: new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        batchNumber: `BATCH-${i.toString().padStart(6, '0')}`
      },
      processing: {
        facility: `${origin.name}食品加工厂`,
        date: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        certifications: Math.random() > 0.5 ? ['ISO9001', 'HACCP'] : ['ISO9001']
      },
      distribution: {
        company: `${origin.name}配送公司`,
        date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      inspections: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, index) => ({
        date: new Date(Date.now() - Math.floor(Math.random() * (120 - index * 30)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        inspector: `检验员${Math.floor(Math.random() * 10) + 1}`,
        result: Math.random() > 0.1 ? '合格' : '需复检',
        notes: Math.random() > 0.8 ? '产品质量良好' : ''
      }))
    };
    
    // 创建产品对象
    products.push({
      id: `prod-${i.toString().padStart(6, '0')}`,
      name,
      description: `${name}是一款来自${origin.name}的${category.name}${suffix}，品质优良，口感极佳。`,
      price,
      categoryId: category.id,
      category: category.name,
      originId: origin.id,
      origin: origin.name,
      imageUrl,
      qrCodeUrl,
      stock,
      rating: Math.floor(Math.random() * 50) / 10 + 1, // 1.0 - 5.0
      createDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString(),
      updateDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      traceData
    });
  }
  
  return products;
};

// 模拟产品数据 (延迟初始化以提高性能)
let productData = null;

/**
 * 获取产品数据
 * @returns {Array} 产品数据数组
 */
function getProductData() {
  if (productData === null) {
    productData = generateProducts(200);
  }
  return productData;
}

/**
 * 获取产品列表 (支持分页和筛选)
 * @param {Object} options - 分页和筛选选项
 * @returns {Object} 包含分页信息和产品列表的对象
 */
function getProducts(options = {}) {
  const {
    page = 1,
    limit = 10,
    category = '',
    origin = '',
    search = ''
  } = options;
  
  // 获取产品数据
  const allProducts = getProductData();
  
  // 筛选产品
  let filteredProducts = [...allProducts];
  
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.categoryId === category);
  }
  
  if (origin) {
    filteredProducts = filteredProducts.filter(p => p.originId === origin);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.description.toLowerCase().includes(searchLower)
    );
  }
  
  // 计算分页
  const total = filteredProducts.length;
  const totalPages = Math.ceil(total / limit);
  const startIdx = (page - 1) * limit;
  const endIdx = Math.min(startIdx + limit, total);
  const paginatedProducts = filteredProducts.slice(startIdx, endIdx);
  
  return {
    products: paginatedProducts,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

/**
 * 根据ID获取产品详情
 * @param {string} productId - 产品ID
 * @returns {Object|null} 产品对象或null
 */
function getProductById(productId) {
  const products = getProductData();
  return products.find(p => p.id === productId) || null;
}

/**
 * 获取产品类别列表
 * @returns {Array} 产品类别数组
 */
function getProductCategories() {
  return {
    categories: productCategories
  };
}

/**
 * 获取产品产地列表
 * @returns {Array} 产品产地数组
 */
function getProductOrigins() {
  return {
    origins: productOrigins
  };
}

/**
 * 生成随机Token
 * @returns {string} 随机生成的Token
 */
function generateToken() {
  return 'token_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 验证用户凭证
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Object} 认证结果，成功时包含token和用户信息
 */
function authenticateUser(username, password) {
  // 查找用户
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return { success: false };
  }
  
  // 生成令牌
  const token = generateToken();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时后过期
  
  // 存储令牌
  const userInfo = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions
  };
  
  activeTokens.set(token, {
    user: userInfo,
    expiresAt
  });
  
  return {
    success: true,
    token,
    user: userInfo,
    expiresAt
  };
}

/**
 * 验证令牌是否有效
 * @param {string} token - 认证令牌
 * @returns {Object} 验证结果
 */
function validateToken(token) {
  if (!activeTokens.has(token)) {
    return { valid: false, error: '无效的令牌' };
  }
  
  const tokenData = activeTokens.get(token);
  
  // 检查令牌是否过期
  if (tokenData.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return { valid: false, error: '令牌已过期' };
  }
  
  return { valid: true, user: tokenData.user };
}

/**
 * 使令牌失效 (登出)
 * @param {string} token - 认证令牌
 * @returns {Object} 操作结果
 */
function invalidateToken(token) {
  if (!activeTokens.has(token)) {
    return { success: false };
  }
  
  activeTokens.delete(token);
  return { success: true };
}

// 公开API
module.exports = {
  getProducts,
  getProductById,
  getProductCategories,
  getProductOrigins,
  authenticateUser,
  validateToken,
  invalidateToken
}; 