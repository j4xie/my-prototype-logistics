/**
 * 食品溯源系统 - Jest测试配置
 */

export default {
  // 测试环境，使用jsdom模拟浏览器环境
  testEnvironment: 'jsdom',
  
  // 转换器配置，使用babel处理ES6+语法
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'jsx', 'json'],
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // 收集测试覆盖率
  collectCoverage: true,
  
  // 覆盖率报告目录
  coverageDirectory: 'coverage',
  
  // 需要收集覆盖率的文件
  collectCoverageFrom: [
    'components/**/*.js'
  ],
  
  // 忽略的文件
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // 测试覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // 模拟文件
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/mocks/fileMock.js'
  },
  
  // 设置测试超时时间（毫秒）
  testTimeout: 30000,
  
  // 每个测试文件运行前的设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
}; 