/**
 * @file Jest配置文件
 * @description 食品溯源系统测试配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    "**/tests/**/*.test.js",
    "**/src/**/*.test.js"
  ],
  
  // 覆盖率收集配置
  collectCoverage: true,
  collectCoverageFrom: [
    "components/**/*.js",
    "!components/lib/**",
    "!**/node_modules/**"
  ],
  coverageDirectory: "coverage",
  
  // 模块名称映射
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/tests/mocks/styleMock.js",
    "\\.(gif|ttf|eot|svg|png)$": "<rootDir>/tests/mocks/fileMock.js"
  },
  
  // 测试设置文件
  setupFilesAfterEnv: [
    "<rootDir>/tests/setupTests.js"
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
  ]
}; 