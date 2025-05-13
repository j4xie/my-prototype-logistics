/**
 * @module config/test/jest.config
 * @description Jest测试框架配置
 */

/**
 * Jest配置
 * @type {Object}
 */
module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    "**/web-app/tests/unit/**/*.test.js",
    "**/web-app/tests/integration/**/*.test.js",
    "**/web-app/src/**/*.test.js"
  ],
  
  // 覆盖率收集配置
  collectCoverage: true,
  collectCoverageFrom: [
    "web-app/src/**/*.js",
    "web-app/components/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**"
  ],
  coverageDirectory: "web-app/coverage",
  
  // 模块名称映射
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/tests/utils/styleMock.js",
    "\\.(gif|ttf|eot|svg|png)$": "<rootDir>/tests/utils/fileMock.js"
  },
  
  // 测试设置文件
  setupFilesAfterEnv: [
    "<rootDir>/tests/setup.js"
  ],
  
  // 转换器配置
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  
  // 转换忽略模式
  transformIgnorePatterns: [
    "/node_modules/"
  ],
  
  // 模拟函数自动清理
  clearMocks: true,
  
  // 测试超时设置
  testTimeout: 10000,
  
  // 模块文件扩展名
  moduleFileExtensions: [
    "js",
    "json",
    "jsx",
    "node"
  ],
  
  // 根目录
  rootDir: '../..',
  
  // 测试环境变量
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
}; 