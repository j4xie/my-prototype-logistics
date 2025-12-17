/*
 * Mock API - 溯源商城高保真原型系统
 * 模拟所有API调用
 */

class MockAPI {
  // ==================== 通用请求处理 ====================
  static async request(endpoint, options = {}) {
    // 模拟网络延迟
    const delay = options.delay || (500 + Math.random() * 500);
    await new Promise(resolve => setTimeout(resolve, delay));

    // 10%概率返回错误（用于测试错误处理，可通过skipError关闭）
    if (!options.skipError && Math.random() < 0.1) {
      throw new Error('网络请求失败，请稍后重试');
    }

    return this.handleEndpoint(endpoint, options);
  }

  static async handleEndpoint(endpoint, options) {
    // 路由处理
    const routes = {
      // C端API
      'products.list': () => this.getProducts(options),
      'products.detail': () => this.getProductDetail(options),
      'traceability.scan': () => this.scanQRCode(options),
      'traceability.batch': () => this.getBatchInfo(options),
      'ai.chat': () => this.aiChat(options),
      'ai.analysis': () => this.getAIAnalysis(options),
      'orders.create': () => this.createOrder(options),
      'orders.list': () => this.getOrders(options),
      'referrals.list': () => this.getReferrals(options),
      'referrals.share': () => this.generateShareCode(options),

      // Web端API
      'merchants.list': () => this.getMerchants(options),
      'merchants.review': () => this.reviewMerchant(options),
      'admin.products.list': () => this.getAdminProducts(options),
      'admin.products.create': () => this.createProduct(options),
      'admin.products.update': () => this.updateProduct(options),
      'admin.knowledge.list': () => this.getKnowledge(options),
      'admin.knowledge.upload': () => this.uploadDocument(options),
      'admin.statistics': () => this.getStatistics(options)
    };

    const handler = routes[endpoint];
    if (!handler) {
      throw new Error(`未知的API端点: ${endpoint}`);
    }

    return handler();
  }

  // ==================== C端API ====================

  /**
   * 获取产品列表
   */
  static async getProducts({ category, keyword, page = 1, pageSize = 10, sortBy = 'createTime', order = 'desc' } = {}) {
    let data = [...MockDB.products];

    // 筛选
    if (category && category !== 'all') {
      data = data.filter(p => p.category === category);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      data = data.filter(p =>
        p.name.toLowerCase().includes(lowerKeyword) ||
        p.description.toLowerCase().includes(lowerKeyword)
      );
    }

    // 只返回上线的产品
    data = data.filter(p => p.status === 'online');

    // 排序
    data.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      success: true,
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    };
  }

  /**
   * 获取产品详情
   */
  static async getProductDetail({ productId }) {
    const product = MockDB.products.find(p => p.id === productId);

    if (!product) {
      throw new Error('产品不存在');
    }

    return {
      success: true,
      data: product
    };
  }

  /**
   * 扫描二维码
   */
  static async scanQRCode({ qrCode }) {
    // 模拟扫码延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 解析批次号（简单模拟）
    const batchId = qrCode || 'FAC001-20250105-001';
    const batch = MockDB.batches.find(b => b.id === batchId);

    if (!batch) {
      throw new Error('未找到批次信息，请检查二维码是否正确');
    }

    return {
      success: true,
      data: {
        batchId: batch.id,
        redirectUrl: `traceability/batch-info.html?batchId=${batch.id}`
      }
    };
  }

  /**
   * 获取批次溯源信息
   */
  static async getBatchInfo({ batchId }) {
    const batch = MockDB.batches.find(b => b.id === batchId);

    if (!batch) {
      throw new Error('批次信息不存在');
    }

    return {
      success: true,
      data: batch
    };
  }

  /**
   * AI智能问答
   */
  static async aiChat({ question, userId }) {
    // 模拟AI思考延迟
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // 简单的规则匹配（实际可接入真实AI）
    const answerMap = {
      '溯源': {
        answer: '您可以在产品详情页点击"查看溯源"按钮，或使用扫码功能扫描产品二维码查看完整的溯源信息，包括批次详情、质检报告、原料供应商等。每个批次都有完整的生产时间线，从原料入厂到成品入库，全程可追溯。',
        sources: ['产品FAQ', '溯源指南']
      },
      '价格': {
        answer: '我们的价格采用阶梯定价模式，订购数量越多，单价越优惠。具体价格请在产品详情页查看价格阶梯表。例如速冻鱼排：1-99kg为28元/kg，100-499kg为26元/kg，500-999kg为24元/kg，1000kg以上为22元/kg。价格为出库价，不含物流费用。',
        sources: ['价格说明', '阶梯定价规则']
      },
      '质检': {
        answer: '所有产品都经过严格的质检流程：1）原料入厂检验 - 检查新鲜度和合格证；2）生产过程质检 - 温度、卫生监控；3）成品出厂检验 - 外观、重量、包装检查。每个批次都有详细的质检报告，您可以在溯源信息中查看，确保产品质量。',
        sources: ['质检流程', '质量标准']
      },
      '冷链': {
        answer: '我们严格遵守冷链标准，全程保持-18℃或更低温度。冷库、运输车辆均配备温度监控系统，实时记录温度数据。您可以在溯源信息的时间线中查看每个环节的温度记录，确保食品安全。',
        sources: ['冷链标准', '温度监控']
      },
      '推荐': {
        answer: '分享推荐功能让您可以将优质产品分享给其他商家。当被推荐人成功注册并完成首单后，您将获得推荐奖励。您可以在"我的推荐"页面查看推荐记录和奖励详情。',
        sources: ['推荐规则', '奖励说明']
      }
    };

    // 查找匹配的回答
    for (const [key, value] of Object.entries(answerMap)) {
      if (question.includes(key)) {
        return {
          success: true,
          data: {
            answer: value.answer,
            sources: value.sources,
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    // 默认回答
    return {
      success: true,
      data: {
        answer: '很抱歉，我暂时无法回答这个问题。您可以尝试问我关于溯源、价格、质检、冷链或推荐等方面的问题，或联系客服获取帮助。',
        sources: [],
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 获取AI分析报告
   */
  static async getAIAnalysis({ type, targetId }) {
    // 模拟AI分析延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    const analysisData = {
      factory: {
        title: '工厂稳定性分析',
        summary: '该工厂生产稳定，质检合格率达95%以上，溯源覆盖完整。',
        metrics: [
          { label: '生产一致性', value: 92, unit: '%' },
          { label: '质检合格率', value: 95, unit: '%' },
          { label: '溯源覆盖率', value: 94, unit: '%' },
          { label: '客户满意度', value: 88, unit: '%' }
        ],
        insights: [
          '近3个月生产批次稳定，无重大质量问题',
          '溯源记录完整，符合食品安全标准',
          '客户反馈良好，复购率较高'
        ]
      },
      industry: {
        title: '行业成本分析',
        summary: '该产品价格处于行业中等水平，性价比较高。',
        metrics: [
          { label: '行业平均价格', value: 25, unit: '元/kg' },
          { label: '行业最低价格', value: 20, unit: '元/kg' },
          { label: '行业最高价格', value: 35, unit: '元/kg' },
          { label: '价格竞争力', value: 78, unit: '%' }
        ],
        insights: [
          '当前价格低于行业平均水平10%',
          '质量和价格平衡良好',
          '适合批量采购'
        ]
      },
      product: {
        title: '产品综合分析',
        summary: '该产品质量稳定，溯源完整，价格合理，推荐采购。',
        metrics: [
          { label: '质量评分', value: 92, unit: '/100' },
          { label: '溯源完整度', value: 95, unit: '%' },
          { label: '价格优势', value: 85, unit: '%' },
          { label: '综合评分', value: 90, unit: '/100' }
        ],
        insights: [
          '产品质量稳定，质检记录完整',
          '溯源信息详细，可追溯至原料供应商',
          '阶梯定价合理，批量采购更优惠',
          '客户评价良好，值得信赖'
        ]
      }
    };

    const data = analysisData[type] || analysisData.product;

    return {
      success: true,
      data
    };
  }

  /**
   * 创建订单
   */
  static async createOrder({ userId, items }) {
    // 验证库存
    for (const item of items) {
      const product = MockDB.products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`产品不存在: ${item.productId}`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`${product.name} 库存不足`);
      }
    }

    // 计算总金额
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const product = MockDB.products.find(p => p.id === item.productId);
      // 根据数量计算阶梯价格
      let price = product.price.base;
      for (const tier of product.price.tiers) {
        if (item.quantity >= tier.minQty && (!tier.maxQty || item.quantity <= tier.maxQty)) {
          price = tier.price;
          break;
        }
      }
      const amount = price * item.quantity;
      totalAmount += amount;

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unit: product.price.unit,
        price,
        amount
      };
    });

    // 生成订单
    const order = {
      id: generateOrderNumber(),
      userId,
      userName: MockDB.users.find(u => u.id === userId)?.name || '未知用户',
      company: MockDB.users.find(u => u.id === userId)?.company || '',
      status: 'pending',
      createTime: new Date().toISOString(),
      totalAmount,
      items: orderItems
    };

    // 模拟保存订单
    MockDB.orders.push(order);

    return {
      success: true,
      data: order,
      message: '订单创建成功'
    };
  }

  /**
   * 获取订单列表
   */
  static async getOrders({ userId, status, page = 1, pageSize = 10 }) {
    let data = [...MockDB.orders];

    // 筛选
    if (userId) {
      data = data.filter(o => o.userId === userId);
    }
    if (status) {
      data = data.filter(o => o.status === status);
    }

    // 排序（最新的在前）
    data.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      success: true,
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    };
  }

  /**
   * 获取推荐列表
   */
  static async getReferrals({ referrerId, page = 1, pageSize = 10 }) {
    let data = MockDB.referrals.filter(r => r.referrerId === referrerId);

    // 排序（最新的在前）
    data.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    // 计算总奖励
    const totalReward = data.reduce((sum, r) => sum + (r.reward || 0), 0);

    return {
      success: true,
      data: {
        list: data.slice(start, end),
        summary: {
          totalReferrals: total,
          totalReward,
          completedCount: data.filter(r => r.status === 'completed').length
        }
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    };
  }

  /**
   * 生成分享码
   */
  static async generateShareCode({ userId, productId }) {
    const shareCode = `SHARE-${userId}-${productId || 'ALL'}-${Date.now()}`;
    const shareUrl = `https://cretas.com/share?code=${shareCode}`;

    return {
      success: true,
      data: {
        shareCode,
        shareUrl,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`
      }
    };
  }

  // ==================== Web端API ====================

  /**
   * 获取商户列表
   */
  static async getMerchants({ status, keyword, page = 1, pageSize = 20 }) {
    let data = [...MockDB.merchants];

    // 筛选
    if (status) {
      data = data.filter(m => m.reviewStatus === status);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      data = data.filter(m =>
        m.name.toLowerCase().includes(lowerKeyword) ||
        m.contact.toLowerCase().includes(lowerKeyword)
      );
    }

    // 排序（最新的在前）
    data.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      success: true,
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * 审核商户
   */
  static async reviewMerchant({ merchantId, action, reason = '' }) {
    const merchant = MockDB.merchants.find(m => m.id === merchantId);

    if (!merchant) {
      throw new Error('商户不存在');
    }

    merchant.reviewStatus = action; // 'approved' or 'rejected'
    merchant.reviewReason = reason;
    merchant.approveTime = new Date().toISOString();

    if (action === 'approved') {
      merchant.status = 'active';
    } else {
      merchant.status = 'rejected';
    }

    return {
      success: true,
      data: merchant,
      message: action === 'approved' ? '审核通过' : '审核拒绝'
    };
  }

  /**
   * 获取后台产品列表
   */
  static async getAdminProducts({ status, category, keyword, page = 1, pageSize = 20 }) {
    let data = [...MockDB.products];

    // 筛选
    if (status) {
      data = data.filter(p => p.status === status);
    }
    if (category) {
      data = data.filter(p => p.category === category);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      data = data.filter(p =>
        p.name.toLowerCase().includes(lowerKeyword) ||
        p.description.toLowerCase().includes(lowerKeyword)
      );
    }

    // 排序（最新的在前）
    data.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      success: true,
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * 创建产品
   */
  static async createProduct(productData) {
    const newProduct = {
      id: MockDB.products.length + 1,
      ...productData,
      status: 'pending',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    };

    MockDB.products.push(newProduct);

    return {
      success: true,
      data: newProduct,
      message: '产品创建成功'
    };
  }

  /**
   * 更新产品
   */
  static async updateProduct({ productId, ...updates }) {
    const product = MockDB.products.find(p => p.id === productId);

    if (!product) {
      throw new Error('产品不存在');
    }

    Object.assign(product, updates, {
      updateTime: new Date().toISOString()
    });

    return {
      success: true,
      data: product,
      message: '产品更新成功'
    };
  }

  /**
   * 获取知识库列表
   */
  static async getKnowledge({ category, keyword, page = 1, pageSize = 20 }) {
    let data = [...MockDB.knowledgeBase];

    // 筛选
    if (category) {
      data = data.filter(k => k.category === category);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      data = data.filter(k =>
        k.question.toLowerCase().includes(lowerKeyword) ||
        k.answer.toLowerCase().includes(lowerKeyword)
      );
    }

    // 排序（最新的在前）
    data.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));

    // 分页
    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      success: true,
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * 上传文档
   */
  static async uploadDocument({ file, category }) {
    // 模拟文件上传延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    const doc = {
      id: MockDB.knowledgeBase.length + 1,
      category,
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      status: 'processing'
    };

    // 模拟处理完成
    setTimeout(() => {
      doc.status = 'completed';
    }, 3000);

    return {
      success: true,
      data: doc,
      message: '文档上传成功，正在处理中'
    };
  }

  /**
   * 获取统计数据
   */
  static async getStatistics({ type = 'overview' }) {
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      success: true,
      data: MockDB.statistics[type] || MockDB.statistics.overview
    };
  }
}

// 导出（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockAPI;
}
