/**
 * 测试数据生成器
 * 用于生成产品、用户和类别测试数据
 */

// 生成随机字符串
const generateRandomString = (length = 8) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 生成随机整数
const generateRandomNumber = (min = 1, max = 1000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 生成随机价格
const generateRandomPrice = (min = 10, max = 1000) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
};

// 生成随机日期
const generateRandomDate = (start = new Date(2020, 0, 1), end = new Date()) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// 从数组中随机选择一项
const pickRandom = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// 产品类别
const categories = ['电子产品', '服装', '食品', '家居', '书籍', '运动', '玩具', '美容', '健康', '办公'];

// 产品来源
const origins = ['中国', '美国', '日本', '德国', '韩国', '英国', '法国', '意大利', '西班牙', '澳大利亚'];

// 生成单个产品
const generateProduct = (id) => {
  const productId = id || generateRandomString(10);
  const category = pickRandom(categories);
  const origin = pickRandom(origins);
  
  return {
    id: productId,
    name: `产品 ${productId.substring(0, 5)}`,
    description: `这是一个来自${origin}的${category}产品，品质优良，价格合理。`,
    price: generateRandomPrice(),
    stock: generateRandomNumber(0, 100),
    category,
    origin,
    createdAt: generateRandomDate(),
    updatedAt: new Date(),
    rating: parseFloat((Math.random() * 5).toFixed(1)),
    reviews: generateRandomNumber(0, 200)
  };
};

// 生成多个产品
const generateProducts = (count = 10) => {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push(generateProduct());
  }
  return products;
};

// 用户角色
const userRoles = ['admin', 'user', 'guest', 'manager'];

// 生成单个用户
const generateUser = (id) => {
  const userId = id || generateRandomString(8);
  const role = pickRandom(userRoles);
  
  return {
    id: userId,
    username: `user_${userId}`,
    email: `user_${userId}@example.com`,
    password: `password_${userId}`, // 注意：实际应用中密码应当加密存储
    name: `用户 ${userId.substring(0, 4)}`,
    role,
    createdAt: generateRandomDate(),
    lastLogin: generateRandomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    active: Math.random() > 0.2, // 80%的用户是活跃的
    preferences: {
      theme: pickRandom(['light', 'dark', 'system']),
      notifications: Math.random() > 0.3, // 70%的用户开启通知
      language: pickRandom(['zh-CN', 'en-US', 'ja-JP'])
    }
  };
};

// 生成多个用户
const generateUsers = (count = 10) => {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(generateUser());
  }
  return users;
};

// 生成分页数据
const generatePaginatedData = (items, page = 1, pageSize = 10, total = null) => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);
  
  return {
    data: paginatedItems,
    pagination: {
      page,
      pageSize,
      totalItems: total || items.length,
      totalPages: Math.ceil((total || items.length) / pageSize)
    }
  };
};

// 生成错误响应
const generateErrorResponse = (message, statusCode = 400) => {
  return {
    error: {
      message,
      code: statusCode
    },
    success: false,
    timestamp: new Date().toISOString()
  };
};

// 生成成功响应
const generateSuccessResponse = (data) => {
  return {
    data,
    success: true,
    timestamp: new Date().toISOString()
  };
};

// 导出所有函数和数据
module.exports = {
  generateRandomString,
  generateRandomNumber,
  generateRandomPrice,
  generateRandomDate,
  pickRandom,
  generateProduct,
  generateProducts,
  generateUser,
  generateUsers,
  generatePaginatedData,
  generateErrorResponse,
  generateSuccessResponse,
  categories,
  origins,
  userRoles
}; 