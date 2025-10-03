/**
 * 集成测试配置文件
 * 白垩纪食品溯源系统 - 前后端集成测试
 */

export const testConfig = {
  // 服务配置
  services: {
    backend: {
      url: 'http://localhost:3001',
      apiBase: 'http://localhost:3001/api',
      healthCheckEndpoint: '/api/mobile/health',
      startupTimeout: 30000, // 30秒启动超时
      port: 3001
    },
    frontend: {
      url: 'http://localhost:3010',
      port: 3010,
      platform: 'android', // 测试平台
      deviceUrl: 'http://10.0.2.2:3001/api' // Android模拟器访问本地后端
    },
    database: {
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'heiniu_test',
      user: 'root',
      password: 'Admin@1234567890'
    }
  },

  // 测试账号
  testAccounts: {
    systemDeveloper: {
      username: 'developer',
      password: 'Developer@123',
      phoneNumber: '+86138000000001',
      role: 'system_developer',
      userType: 'platform'
    },
    platformAdmin: {
      username: 'platform_admin',
      password: 'Admin@123456',
      phoneNumber: '+86138000000002',
      role: 'platform_super_admin',
      userType: 'platform'
    },
    factoryAdmin: {
      username: 'factory_admin',
      password: 'SuperAdmin@123',
      phoneNumber: '+86138000000003',
      role: 'factory_super_admin',
      userType: 'factory',
      factoryId: 'TEST_2024_001',
      department: '管理部'
    },
    processOperator: {
      username: 'process_op001',
      password: 'Process@123456',
      phoneNumber: '+86138000000004',
      role: 'operator',
      userType: 'factory',
      factoryId: 'TEST_2024_001',
      department: '加工部'
    },
    viewer: {
      username: 'viewer_001',
      password: 'Viewer@123456',
      phoneNumber: '+86138000000005',
      role: 'viewer',
      userType: 'factory',
      factoryId: 'TEST_2024_001',
      department: '质检部'
    }
  },

  // 测试工厂数据
  testFactory: {
    factoryId: 'TEST_2024_001',
    factoryName: '海牛食品加工厂',
    address: '山东省青岛市黄岛区工业园区',
    contactPhone: '+86532-12345678',
    industryType: '食品加工',
    regionCode: 'SD-QD-HD',
    status: 'active',
    departments: ['管理部', '加工部', '质检部', '仓储部', '物流部']
  },

  // 激活码配置
  activationCodes: [
    'DEV_TEST_2025_001',
    'DEV_TEST_2025_002',
    'HEINIU_MOBILE_001',
    'FACTORY_001_DEVICE'
  ],

  // 测试设备信息
  testDevices: [
    {
      deviceId: 'TEST_ANDROID_001',
      deviceModel: 'Android Test Device',
      platform: 'android',
      osVersion: '13.0',
      appVersion: '1.0.0'
    },
    {
      deviceId: 'TEST_ANDROID_002',
      deviceModel: 'Samsung Galaxy Test',
      platform: 'android',
      osVersion: '12.0',
      appVersion: '1.0.0'
    }
  ],

  // 性能测试指标
  performanceTargets: {
    appStartupTime: 3000,        // 应用启动时间 < 3秒
    pageTransitionTime: 500,     // 页面切换时间 < 500ms
    loginResponseTime: 2000,      // 登录响应时间 < 2秒
    apiResponseTime: 2000,        // API响应时间 < 2秒
    imageUploadTime: 5000,        // 图片上传时间 < 5秒
    memoryUsage: 200 * 1024 * 1024, // 内存使用 < 200MB
    offlineSyncTime: 30000        // 离线数据同步 < 30秒
  },

  // 测试选项
  testOptions: {
    skipDeepSeek: true,           // 跳过DeepSeek AI测试
    enableScreenshots: true,      // 启用错误截图
    enablePerformanceMonitoring: true, // 启用性能监控
    maxRetries: 3,                // 失败重试次数
    retryDelay: 2000,             // 重试延迟(ms)
    parallelTests: false,         // 是否并行执行测试
    cleanupAfterTest: true,       // 测试后清理数据
    verbose: true                 // 详细日志输出
  },

  // 加工业务测试数据
  processingTestData: {
    materials: [
      {
        code: 'MAT001',
        name: '新鲜牛肉',
        batch: 'B20250109001',
        quantity: 100,
        unit: 'kg'
      },
      {
        code: 'MAT002',
        name: '蔬菜包',
        batch: 'B20250109002',
        quantity: 50,
        unit: 'kg'
      }
    ],
    processingTemplates: [
      {
        name: '牛肉加工标准流程',
        steps: ['解冻', '切割', '调味', '包装'],
        parameters: {
          temperature: { min: -2, max: 4, unit: '°C' },
          humidity: { min: 60, max: 80, unit: '%' },
          duration: 120, // 分钟
          operators: 2
        }
      }
    ],
    qrCodes: [
      'QR_MAT_001_B20250109001',
      'QR_MAT_002_B20250109002',
      'QR_PRODUCT_001_20250109',
      'QR_PRODUCT_002_20250109'
    ]
  },

  // 网络模拟配置
  networkSimulation: {
    offline: {
      enabled: true,
      duration: 10000 // 离线持续时间
    },
    slowNetwork: {
      enabled: true,
      latency: 3000,  // 延迟3秒
      bandwidth: '2G' // 模拟2G网络
    },
    packetLoss: {
      enabled: false,
      rate: 0.1 // 10%丢包率
    }
  },

  // 测试报告配置
  reporting: {
    outputDir: './integration-tests/reports',
    formats: ['html', 'json', 'console'],
    includeScreenshots: true,
    includePerformanceMetrics: true,
    includeLogs: true,
    summaryOnly: false
  },

  // 超时配置
  timeouts: {
    test: 60000,          // 单个测试超时 60秒
    suite: 600000,        // 测试套件超时 10分钟
    request: 10000,       // API请求超时 10秒
    element: 5000,        // 元素查找超时 5秒
    navigation: 10000     // 页面导航超时 10秒
  }
};

// 测试环境检查点
export const healthChecks = {
  backend: async () => {
    try {
      const response = await fetch(`${testConfig.services.backend.url}${testConfig.services.backend.healthCheckEndpoint}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  },
  
  database: async () => {
    // 数据库连接检查逻辑
    return true; // 实际实现需要连接数据库
  },
  
  frontend: async () => {
    try {
      const response = await fetch(`${testConfig.services.frontend.url}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};

export default testConfig;