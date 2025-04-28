module.exports = {
  // 测试环境为jsdom（浏览器环境）
  testEnvironment: 'jsdom',
  
  // 指定测试文件匹配模式
  testMatch: ['**/*.test.js'],
  
  // 设置超时时间（毫秒）
  testTimeout: 15000,
  
  // 设置模块目录
  moduleDirectories: ['node_modules', 'src'],
  
  // 忽略的目录
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // 在每次测试前执行的脚本
  setupFilesAfterEnv: ['./jest.setup.js'],
  
  // 模拟浏览器API
  globals: {
    'window': {},
    'document': {},
    'navigator': {
      'userAgent': 'node.js',
      'onLine': true
    },
    'performance': {
      now: () => Date.now(),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 10000000,
        jsHeapSizeLimit: 100000000
      }
    }
  },
  
  // 收集覆盖率信息
  collectCoverage: false,
  
  // 覆盖率报告输出目录
  coverageDirectory: '../../reports/coverage',
  
  // 覆盖率报告格式
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  
  // 声明某些被模拟的模块
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}; 