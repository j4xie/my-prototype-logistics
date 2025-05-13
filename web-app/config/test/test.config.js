/**
 * @module config/test/test.config
 * @description 通用测试配置
 */

const path = require('path');

/**
 * 通用测试配置
 * @type {Object}
 */
const testConfig = {
  // 基础配置
  baseUrl: 'http://localhost:8080',
  timeout: 30000,
  
  // 目录配置
  paths: {
    reports: path.join(__dirname, '../../reports'),
    screenshots: path.join(__dirname, '../../reports/screenshots'),
    coverage: path.join(__dirname, '../../coverage'),
    testData: path.join(__dirname, '../../test/data')
  },
  
  // 测试文件配置
  testFiles: {
    unit: ['test/unit/**/*.test.js'],
    integration: ['test/integration/**/*.test.js'],
    e2e: ['test/e2e/**/*.test.js'],
    functionality: ['validation/scripts/**/*.js']
  },
  
  // 浏览器配置
  browser: {
    headless: process.env.CI === 'true',
    slowMo: process.env.DEBUG ? 100 : 0,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  
  // 覆盖率配置
  coverage: {
    enabled: true,
    threshold: {
      global: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  },
  
  // 报告配置
  reports: {
    json: true,
    html: true,
    console: true,
    junitXml: process.env.CI === 'true'
  }
};

// 确保所有必要的目录存在
const fs = require('fs');
Object.values(testConfig.paths).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = testConfig; 