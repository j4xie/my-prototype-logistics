/*
 * Mock数据库 - 溯源商城高保真原型系统
 * 包含所有模拟数据
 */

const MockDB = {
  // ==================== C端用户数据 ====================
  users: [
    {
      id: 1,
      name: '张三',
      phone: '138****1234',
      company: '上海餐饮有限公司',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
      level: 'VIP',
      registerDate: '2024-01-15',
      referrerId: null
    },
    {
      id: 2,
      name: '李四',
      phone: '139****5678',
      company: '杭州美食连锁',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li',
      level: '普通',
      registerDate: '2024-02-10',
      referrerId: 1
    },
    {
      id: 3,
      name: '王五',
      phone: '136****9012',
      company: '北京食品批发',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wang',
      level: '普通',
      registerDate: '2024-03-05',
      referrerId: 1
    }
  ],

  // ==================== 分类数据 (新增) ====================
  categories: [
    {
      id: 'beef_mutton',
      name: '牛羊肉类',
      icon: '🥩',
      subCategories: ['肥牛卷', '羊肉卷', '牛排', '羊排']
    },
    {
      id: 'poultry_egg',
      name: '家禽蛋副',
      icon: '🍗',
      subCategories: ['鸡胸肉', '鸭腿', '鸡蛋', '鸭蛋']
    },
    {
      id: 'prepared_food',
      name: '调理肉类',
      icon: '🍖',
      subCategories: ['腌制牛排', '奥尔良鸡翅', '肉串']
    },
    {
      id: 'sausage_canned',
      name: '肉肠罐头',
      icon: '🥫',
      subCategories: ['午餐肉', '香肠', '腊肠']
    },
    {
      id: 'seafood',
      name: '海鲜水产',
      icon: '🦐',
      subCategories: ['鱼类', '虾类', '贝类', '海鲜礼包']
    },
    {
      id: 'vegetables',
      name: '蔬菜菌菇',
      icon: '🥬',
      subCategories: ['叶菜', '根茎', '菌菇', '净菜']
    },
    {
      id: 'rice_noodle',
      name: '米面制品',
      icon: '🍜',
      subCategories: ['大米', '面条', '速冻水饺', '汤圆']
    },
    {
      id: 'dim_sum',
      name: '小吃点心',
      icon: '🥟',
      subCategories: ['春卷', '烧麦', '包子', '糕点']
    },
    {
      id: 'aquatic_products',
      name: '水发产品',
      icon: '🦑',
      subCategories: ['海带', '木耳', '鱿鱼']
    },
    {
      id: 'all_categories',
      name: '所有分类',
      icon: '📂',
      subCategories: []
    }
  ],

  // ==================== 产品数据 ====================
  products: [
    {
      id: 1,
      name: '流沙黄金麻球咸蛋黄',
      spec: '15*30克/包*20包/箱',
      category: 'dim_sum',
      factory: '白垩纪食品厂 - 上海',
      factoryId: 'CRETAS_2024_001',
      price: {
        base: 294.00,
        unit: '箱',
        tiers: []
      },
      wholesalePrice: 294.00,
      retailPrice: 316.00,
      stock: 5000,
      sales: 600,
      images: [
        'https://images.unsplash.com/photo-1580959375944-0c6e99abbb86?w=400',
        'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400'
      ],
      description: '外酥里嫩，咸蛋黄流沙满溢。',
      traceability: { hasBatch: true, coverage: 0.95, latestBatchId: 'FAC001-20250105-001' },
      tags: ['热销新品', '大牌同款'],
      status: 'online',
      createTime: '2024-01-10',
      updateTime: '2025-01-05'
    },
    {
      id: 2,
      name: '流沙黄金麻球荠菜馅',
      spec: '15*30克/包*20包/箱',
      category: 'dim_sum',
      factory: '白垩纪食品厂 - 上海',
      factoryId: 'CRETAS_2024_001',
      price: {
        base: 294.00,
        unit: '箱',
        tiers: []
      },
      wholesalePrice: 294.00,
      retailPrice: 316.00,
      stock: 5000,
      sales: 360,
      images: [
        'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400'
      ],
      description: '清新荠菜，口感丰富。',
      traceability: { hasBatch: true, coverage: 0.92, latestBatchId: 'FAC001-20250103-002' },
      tags: ['热销新品'],
      status: 'online',
      createTime: '2024-01-12',
      updateTime: '2025-01-03'
    },
    {
      id: 3,
      name: '尚品好蔡原味牛肉片',
      spec: '500克/包*20包/件',
      category: 'beef_mutton',
      factory: '白垩纪食品厂 - 上海',
      factoryId: 'CRETAS_2024_001',
      price: {
        base: 560.00,
        unit: '件',
        tiers: []
      },
      wholesalePrice: 560.00,
      retailPrice: 580.00,
      stock: 5000,
      sales: 1756,
      images: [
        'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400'
      ],
      description: '原切牛肉，肉质鲜嫩。',
      traceability: { hasBatch: true, coverage: 0.98, latestBatchId: 'FAC001-20250104-003' },
      tags: ['热销新品', '爆款推荐'],
      status: 'online',
      createTime: '2024-01-15',
      updateTime: '2025-01-04'
    },
    {
      id: 4,
      name: '冷冻猪肉丸',
      spec: '500克/包',
      category: 'prepared_food',
      factory: '白垩纪食品厂 - 杭州',
      factoryId: 'CRETAS_2024_002',
      price: {
        base: 22.00,
        unit: 'kg',
        tiers: []
      },
      wholesalePrice: 22.00,
      retailPrice: 28.00,
      stock: 4500,
      sales: 890,
      images: [
        'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400'
      ],
      description: '精选猪肉，手工制作，Q弹美味。',
      traceability: { hasBatch: true, coverage: 0.90, latestBatchId: 'FAC002-20250102-001' },
      tags: ['可溯源'],
      status: 'online',
      createTime: '2024-02-01',
      updateTime: '2025-01-02'
    },
    // 新增商品
    {
      id: 5,
      name: '农家散养土鸡蛋',
      spec: '30枚/箱',
      category: 'poultry_egg',
      factory: '绿野生态农场',
      factoryId: 'CRETAS_2024_003',
      price: { base: 45.00, unit: '箱', tiers: [] },
      wholesalePrice: 45.00,
      retailPrice: 58.00,
      stock: 2000,
      sales: 1200,
      images: ['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400'],
      description: '林间散养，谷物喂养，蛋黄橙红。',
      traceability: { hasBatch: true, coverage: 1.0 },
      tags: ['绿色食品', '散养'],
      status: 'online',
      createTime: '2024-03-01',
      updateTime: '2024-03-01'
    },
    {
      id: 6,
      name: '冷冻鸡胸肉',
      spec: '1kg/袋',
      category: 'poultry_egg',
      factory: '白垩纪食品厂 - 山东',
      factoryId: 'CRETAS_2024_004',
      price: { base: 12.00, unit: '袋', tiers: [] },
      wholesalePrice: 12.00,
      retailPrice: 18.00,
      stock: 8000,
      sales: 3000,
      images: ['https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400'], // 使用类似肉类的图
      description: '高蛋白低脂肪，健身首选。',
      traceability: { hasBatch: true, coverage: 0.95 },
      tags: ['热销'],
      status: 'online',
      createTime: '2024-03-02',
      updateTime: '2024-03-02'
    },
    {
      id: 7,
      name: '经典午餐肉罐头',
      spec: '340g/罐',
      category: 'sausage_canned',
      factory: '梅林食品',
      factoryId: 'CRETAS_2024_005',
      price: { base: 15.00, unit: '罐', tiers: [] },
      wholesalePrice: 15.00,
      retailPrice: 22.00,
      stock: 6000,
      sales: 1500,
      images: ['https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=400'], // 罐头图
      description: '肉质紧实，火锅伴侣。',
      traceability: { hasBatch: false },
      tags: ['经典口味'],
      status: 'online',
      createTime: '2024-03-03',
      updateTime: '2024-03-03'
    },
    {
      id: 8,
      name: '广式腊肠',
      spec: '500g/包',
      category: 'sausage_canned',
      factory: '皇上皇',
      factoryId: 'CRETAS_2024_006',
      price: { base: 35.00, unit: '包', tiers: [] },
      wholesalePrice: 35.00,
      retailPrice: 48.00,
      stock: 3000,
      sales: 800,
      images: ['https://images.unsplash.com/photo-1594221708776-9ca8a0d4052d?w=400'],
      description: '酒香浓郁，肥瘦适中。',
      traceability: { hasBatch: true, coverage: 0.9 },
      tags: ['特产'],
      status: 'online',
      createTime: '2024-03-04',
      updateTime: '2024-03-04'
    },
    {
      id: 9,
      name: '鲜活大闸蟹',
      spec: '3.5两/只',
      category: 'seafood',
      factory: '阳澄湖养殖基地',
      factoryId: 'CRETAS_2024_007',
      price: { base: 58.00, unit: '只', tiers: [] },
      wholesalePrice: 58.00,
      retailPrice: 88.00,
      stock: 1000,
      sales: 500,
      images: ['https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400'], // 蟹图(占位)
      description: '蟹黄饱满，肉质鲜美。',
      traceability: { hasBatch: true, coverage: 1.0 },
      tags: ['时令'],
      status: 'online',
      createTime: '2024-03-05',
      updateTime: '2024-03-05'
    },
    {
      id: 10,
      name: '冷冻南美白对虾',
      spec: '1.5kg/盒',
      category: 'seafood',
      factory: '海洋渔业',
      factoryId: 'CRETAS_2024_008',
      price: { base: 88.00, unit: '盒', tiers: [] },
      wholesalePrice: 88.00,
      retailPrice: 108.00,
      stock: 4000,
      sales: 2000,
      images: ['https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400'], // 虾图(占位)
      description: '个大饱满，鲜甜可口。',
      traceability: { hasBatch: true, coverage: 0.98 },
      tags: ['进口'],
      status: 'online',
      createTime: '2024-03-06',
      updateTime: '2024-03-06'
    },
    {
      id: 11,
      name: '有机菠菜',
      spec: '250g/包',
      category: 'vegetables',
      factory: '绿色田园',
      factoryId: 'CRETAS_2024_009',
      price: { base: 8.00, unit: '包', tiers: [] },
      wholesalePrice: 8.00,
      retailPrice: 12.00,
      stock: 5000,
      sales: 1000,
      images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400'],
      description: '无农药残留，健康蔬菜。',
      traceability: { hasBatch: true, coverage: 1.0 },
      tags: ['有机'],
      status: 'online',
      createTime: '2024-03-07',
      updateTime: '2024-03-07'
    },
    {
      id: 12,
      name: '金针菇',
      spec: '500g/包',
      category: 'vegetables',
      factory: '菌菇培育中心',
      factoryId: 'CRETAS_2024_010',
      price: { base: 5.00, unit: '包', tiers: [] },
      wholesalePrice: 5.00,
      retailPrice: 8.00,
      stock: 8000,
      sales: 2500,
      images: ['https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400'], // 菌菇图(占位)
      description: '鲜嫩爽口，火锅必备。',
      traceability: { hasBatch: false },
      tags: [],
      status: 'online',
      createTime: '2024-03-08',
      updateTime: '2024-03-08'
    },
    {
      id: 13,
      name: '东北五常大米',
      spec: '5kg/袋',
      category: 'rice_noodle',
      factory: '五常米业',
      factoryId: 'CRETAS_2024_011',
      price: { base: 68.00, unit: '袋', tiers: [] },
      wholesalePrice: 68.00,
      retailPrice: 88.00,
      stock: 3000,
      sales: 1500,
      images: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'],
      description: '米粒饱满，香气扑鼻。',
      traceability: { hasBatch: true, coverage: 1.0 },
      tags: ['地理标志'],
      status: 'online',
      createTime: '2024-03-09',
      updateTime: '2024-03-09'
    },
    {
      id: 14,
      name: '手工挂面',
      spec: '1kg/把',
      category: 'rice_noodle',
      factory: '老面坊',
      factoryId: 'CRETAS_2024_012',
      price: { base: 10.00, unit: '把', tiers: [] },
      wholesalePrice: 10.00,
      retailPrice: 15.00,
      stock: 5000,
      sales: 1000,
      images: ['https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400'],
      description: '劲道爽滑，易煮不烂。',
      traceability: { hasBatch: false },
      tags: [],
      status: 'online',
      createTime: '2024-03-10',
      updateTime: '2024-03-10'
    },
    {
      id: 15,
      name: '干海带结',
      spec: '250g/包',
      category: 'aquatic_products',
      factory: '海洋食品',
      factoryId: 'CRETAS_2024_013',
      price: { base: 8.00, unit: '包', tiers: [] },
      wholesalePrice: 8.00,
      retailPrice: 12.00,
      stock: 4000,
      sales: 800,
      images: ['https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400'], // 海产占位
      description: '肉质厚实，泡发率高。',
      traceability: { hasBatch: true, coverage: 0.9 },
      tags: [],
      status: 'online',
      createTime: '2024-03-11',
      updateTime: '2024-03-11'
    },
    {
      id: 16,
      name: '压缩黑木耳',
      spec: '100g/盒',
      category: 'aquatic_products',
      factory: '山珍行',
      factoryId: 'CRETAS_2024_014',
      price: { base: 18.00, unit: '盒', tiers: [] },
      wholesalePrice: 18.00,
      retailPrice: 25.00,
      stock: 3000,
      sales: 1200,
      images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400'], // 菌菇占位
      description: '小碗耳，口感脆嫩。',
      traceability: { hasBatch: true, coverage: 0.95 },
      tags: ['山珍'],
      status: 'online',
      createTime: '2024-03-12',
      updateTime: '2024-03-12'
    }
  ],

  // ==================== 批次溯源数据 ====================
  batches: [
    {
      id: 'FAC001-20250105-001',
      productId: 1,
      productName: '流沙黄金麻球咸蛋黄',
      factoryId: 'CRETAS_2024_001',
      factoryName: '白垩纪食品厂 - 上海',
      batchNumber: 'BATCH-20250105-001',
      productionDate: '2025-01-05',
      expiryDate: '2025-07-05',
      quantity: 1000,
      unit: 'kg',
      status: 'completed',
      timeline: [
        {
          stage: '原料入库',
          status: 'completed',
          timestamp: '2025-01-04T08:00:00',
          description: '咸蛋黄、糯米粉等原料验收合格入库',
          icon: '📥',
          details: { '检验员': '张三', '环境温度': '4℃' }
        },
        {
          stage: '生产加工',
          status: 'completed',
          timestamp: '2025-01-05T09:30:00',
          description: '按照标准工艺进行和面、包馅、速冻',
          icon: '⚙️',
          details: { '班次': '早班', '产线': 'Line-01' }
        },
        {
          stage: '成品检测',
          status: 'completed',
          timestamp: '2025-01-05T14:00:00',
          description: '感官、理化、微生物指标检测通过',
          icon: '🔬',
          details: { '检测员': '李四', '检测结果': '合格' }
        },
        {
          stage: '入库发货',
          status: 'completed',
          timestamp: '2025-01-05T16:00:00',
          description: '打包完成，进入成品冷库',
          icon: '📦',
          details: { '库位': 'Cold-A-02' }
        }
      ],
      rawMaterials: [
        { 
            name: '咸蛋黄', 
            supplier: '高邮湖蛋品厂', 
            origin: '江苏省高邮市',
            batchId: 'RM-20250103-01', 
            productionDate: '2025-01-03',
            expiryDate: '2025-02-03',
            quantity: 200, 
            unit: 'kg' 
        },
        { 
            name: '优质糯米粉', 
            supplier: '五常米业有限公司', 
            origin: '黑龙江省哈尔滨市五常市',
            batchId: 'RM-20250102-05', 
            productionDate: '2025-01-02',
            expiryDate: '2025-07-02',
            quantity: 500, 
            unit: 'kg' 
        },
        { 
            name: '精炼植物油', 
            supplier: '益海嘉里', 
            origin: '上海市浦东新区',
            batchId: 'RM-20250101-03', 
            productionDate: '2025-01-01',
            expiryDate: '2025-12-31',
            quantity: 100, 
            unit: 'kg' 
        }
      ],
      qualityReports: [
        {
          stage: '出厂检验报告',
          result: '合格',
          certificateImage: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=200', 
          tests: { '菌落总数': '<10 CFU/g', '大肠菌群': '未检出', '过氧化值': '0.1 g/100g', '感官指标': '色泽金黄，无异味' }
        }
      ]
    }
  ],

  // ==================== 订单数据 ====================
  orders: [],

  // ==================== Web端商户数据 ====================
  merchants: [
    { id: 1, name: '上海鲜优食品有限公司', contact: '张三', phone: '13800138001', status: 'active', reviewStatus: 'approved', createTime: '2024-12-01T08:00:00Z', approveTime: '2024-12-02T10:00:00Z', businessLicense: 'BL20241201001', address: '上海市浦东新区张江高科技园区', productCount: 25 },
    { id: 2, name: '广州海鲜批发中心', contact: '李四', phone: '13800138002', status: 'active', reviewStatus: 'approved', createTime: '2024-11-15T08:00:00Z', approveTime: '2024-11-16T14:00:00Z', businessLicense: 'BL20241115002', address: '广州市白云区江高镇', productCount: 42 },
    { id: 3, name: '深圳冷链物流有限公司', contact: '王五', phone: '13800138003', status: 'pending', reviewStatus: 'pending', createTime: '2024-12-15T08:00:00Z', businessLicense: 'BL20241215003', address: '深圳市龙岗区坪山街道', productCount: 0 },
    { id: 4, name: '北京农产品配送中心', contact: '赵六', phone: '13800138004', status: 'active', reviewStatus: 'approved', createTime: '2024-10-20T08:00:00Z', approveTime: '2024-10-21T09:00:00Z', businessLicense: 'BL20241020004', address: '北京市通州区张家湾镇', productCount: 18 },
    { id: 5, name: '杭州西湖食品厂', contact: '钱七', phone: '13800138005', status: 'rejected', reviewStatus: 'rejected', createTime: '2024-12-10T08:00:00Z', reviewReason: '资质材料不完整', businessLicense: 'BL20241210005', address: '杭州市西湖区转塘街道', productCount: 0 },
    { id: 6, name: '成都蜀味源食品', contact: '孙八', phone: '13800138006', status: 'active', reviewStatus: 'approved', createTime: '2024-09-05T08:00:00Z', approveTime: '2024-09-06T11:00:00Z', businessLicense: 'BL20240905006', address: '成都市锦江区春熙路街道', productCount: 35 },
    { id: 7, name: '武汉楚天食材', contact: '周九', phone: '13800138007', status: 'active', reviewStatus: 'approved', createTime: '2024-08-18T08:00:00Z', approveTime: '2024-08-19T16:00:00Z', businessLicense: 'BL20240818007', address: '武汉市江汉区汉正街', productCount: 28 },
    { id: 8, name: '南京秦淮水产', contact: '吴十', phone: '13800138008', status: 'pending', reviewStatus: 'pending', createTime: '2024-12-14T08:00:00Z', businessLicense: 'BL20241214008', address: '南京市秦淮区夫子庙街道', productCount: 0 },
    { id: 9, name: '重庆火锅食材批发', contact: '郑十一', phone: '13800138009', status: 'active', reviewStatus: 'approved', createTime: '2024-07-22T08:00:00Z', approveTime: '2024-07-23T10:00:00Z', businessLicense: 'BL20240722009', address: '重庆市渝中区解放碑街道', productCount: 52 },
    { id: 10, name: '青岛海洋食品集团', contact: '冯十二', phone: '13800138010', status: 'active', reviewStatus: 'approved', createTime: '2024-06-10T08:00:00Z', approveTime: '2024-06-11T13:00:00Z', businessLicense: 'BL20240610010', address: '青岛市市南区香港中路', productCount: 67 }
  ],

  // ==================== AI知识库数据 ====================
  knowledgeBase: [],

  // ==================== AI聊天历史 ====================
  chatHistory: [],

  // ==================== 推荐数据 ====================
  referrals: [],

  // ==================== 广告位数据（固定配置） ====================
  adSlots: [
    { id: 1, name: '首页顶部Banner', position: 'home_top', size: '750x300', maxAds: 5, description: '首页轮播Banner，最显眼的广告位' },
    { id: 2, name: '列表页右侧', position: 'list_right', size: '300x250', maxAds: 3, description: '商品列表页右侧推荐位' },
    { id: 3, name: '详情页底部', position: 'detail_bottom', size: '728x90', maxAds: 2, description: '商品详情页底部横幅' },
    { id: 4, name: '搜索结果顶部', position: 'search_top', size: '750x150', maxAds: 2, description: '搜索结果页顶部推广位' },
    { id: 5, name: '分类页Banner', position: 'category_banner', size: '750x200', maxAds: 3, description: '分类页面顶部Banner' }
  ],

  // ==================== 广告内容数据 ====================
  ads: [
    {
      id: 1,
      slotId: 1,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=750&h=300&fit=crop',
      merchantId: 1,
      merchantName: '上海鲜优食品有限公司',
      productId: 1,
      productName: '流沙黄金麻球咸蛋黄',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 8920,
      impressions: 125680,
      createTime: '2024-12-01T08:00:00Z'
    },
    {
      id: 2,
      slotId: 1,
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=750&h=300&fit=crop',
      merchantId: 2,
      merchantName: '广州海鲜批发中心',
      productId: 3,
      productName: '尚品好蔡原味牛肉片',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 5430,
      impressions: 89200,
      createTime: '2024-12-15T10:00:00Z'
    },
    {
      id: 3,
      slotId: 1,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=750&h=300&fit=crop',
      merchantId: 6,
      merchantName: '成都蜀味源食品',
      productId: 4,
      productName: '冷冻猪肉丸',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 12350,
      impressions: 156000,
      createTime: '2024-11-01T09:00:00Z'
    },
    {
      id: 4,
      slotId: 2,
      image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=300&h=250&fit=crop',
      merchantId: 9,
      merchantName: '重庆火锅食材批发',
      productId: 5,
      productName: '火锅底料套装',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 3560,
      impressions: 68520,
      createTime: '2024-12-01T14:00:00Z'
    },
    {
      id: 5,
      slotId: 2,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=250&fit=crop',
      merchantId: 10,
      merchantName: '青岛海洋食品集团',
      productId: 15,
      productName: '干海带结',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 2100,
      impressions: 42100,
      createTime: '2024-12-10T11:00:00Z'
    },
    {
      id: 6,
      slotId: 3,
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=728&h=90&fit=crop',
      merchantId: 4,
      merchantName: '北京农产品配送中心',
      productId: 14,
      productName: '手工挂面',
      startTime: '2025-01-01',
      endTime: '2026-12-31',
      status: 'active',
      clicks: 1890,
      impressions: 42100,
      createTime: '2024-12-05T16:00:00Z'
    }
  ],

  // ==================== 统计数据 ====================
  statistics: {
    overview: {
      merchants: { total: 156, growth: 0.12 },
      products: { total: 2341, growth: 0.08 },
      orders: { total: 8567, gmv: 1200000, growth: -0.05 },
      chartData: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [120, 150, 180, 220, 200, 250, 300]
      }
    }
  }
};

// 工具函数：生成批次号
function generateBatchNumber() {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BATCH-${dateStr}-${random}`;
}

// 工具函数：生成订单号
function generateOrderNumber() {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
  return `ORD${dateStr}${random}`;
}

// 导出（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockDB, generateBatchNumber, generateOrderNumber };
}
