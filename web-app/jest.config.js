/**
 * 食品溯源系统 - Jest测试配置文件
 * 版本: 1.0.0
 */

module.exports = {
  // 测试环境
  testEnvironment: "jsdom",
  
  // 转换配置
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  
  // 测试文件匹配模式
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/tests/**/*.spec.js"
  ],
  
  // 模块解析配置
  moduleNameMapper: {
    "^components/(.*)$": "<rootDir>/components/$1",
    "^tests/(.*)$": "<rootDir>/tests/$1",
    "^utils/(.*)$": "<rootDir>/utils/$1"
  },
  
  // 安装文件
  setupFiles: [
    "<rootDir>/tests/setup.js"
  ],
  
  // 覆盖率收集配置
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "components/modules/**/*.js",
    "api-router.js",
    "test-data.js",
    "server-config.js",
    "local-server.js",
    "api-test.js"
  ],
  coverageReporters: [
    "text",
    "lcov",
    "html"
  ],
  
  // 详细输出
  verbose: true,
  
  // 忽略路径
  testPathIgnorePatterns: [
    "/node_modules/",
    "/validation/"
  ]
}; 