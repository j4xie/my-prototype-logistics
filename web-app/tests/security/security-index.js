/**
 * 食品溯源系统 - 安全测试框架入口文件
 * 版本: 1.0.0
 * 
 * 此文件是安全测试框架的主入口，用于集成和管理所有类型的安全测试。
 * 提供统一的接口来运行、配置和报告安全测试结果。
 */

const { 
  runAllSecurityTests,
  testXSSVulnerability,
  testCSRFProtection,
  testPermissions,
  testSQLInjection,
  testInputValidation,
  testSessionManagement,
  generateReport
} = require('./security-tests');

/**
 * 安全测试框架 - 提供高级接口管理安全测试
 */
class SecurityTestFramework {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      apiEndpoint: config.apiEndpoint || '/api',
      testUsers: config.testUsers || {
        admin: { username: 'admin', password: 'admin123' },
        operator: { username: 'operator', password: 'operator123' },
        viewer: { username: 'viewer', password: 'viewer123' }
      },
      reportsDir: config.reportsDir || './reports',
      screenshotsDir: config.screenshotsDir || './screenshots',
      verbose: config.verbose || false,
      timeout: config.timeout || 30000,
      retries: config.retries || 2,
      ...config
    };
    
    this.initDirectories();
    this.results = null;
  }
  
  /**
   * 初始化必要的目录
   */
  initDirectories() {
    const fs = require('fs');
    const path = require('path');
    
    [this.config.reportsDir, this.config.screenshotsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * 运行所有安全测试
   * @returns {Promise<Object>} 测试结果
   */
  async runAllTests() {
    console.log('启动所有安全测试...');
    
    try {
      this.results = await runAllSecurityTests();
      return this.results;
    } catch (error) {
      console.error('安全测试运行失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 运行特定类型的安全测试
   * @param {string} testType 测试类型 (xss, csrf, permissions, sql, input, session)
   * @returns {Promise<Object>} 测试结果
   */
  async runTest(testType) {
    console.log(`启动${testType}安全测试...`);
    
    try {
      let testFunction;
      
      switch (testType) {
        case 'xss':
          testFunction = testXSSVulnerability;
          break;
        case 'csrf':
          testFunction = testCSRFProtection;
          break;
        case 'permissions':
          testFunction = testPermissions;
          break;
        case 'sql':
          testFunction = testSQLInjection;
          break;
        case 'input':
          testFunction = testInputValidation;
          break;
        case 'session':
          testFunction = testSessionManagement;
          break;
        default:
          throw new Error(`未知的测试类型: ${testType}`);
      }
      
      await testFunction();
      this.results = await generateReport();
      return this.results;
    } catch (error) {
      console.error(`${testType}安全测试运行失败:`, error.message);
      throw error;
    }
  }
  
  /**
   * 生成安全测试报告
   * @param {boolean} onlyReport 是否只生成报告，不运行测试
   * @returns {Promise<Object>} 报告信息
   */
  async generateReport(onlyReport = false) {
    if (onlyReport) {
      console.log('生成安全测试报告（不运行测试）...');
    } else if (!this.results) {
      console.log('没有测试结果，先运行测试...');
      await this.runAllTests();
    }
    
    try {
      const reportInfo = await generateReport();
      console.log(`安全测试报告已生成: ${reportInfo.htmlReport}`);
      return reportInfo;
    } catch (error) {
      console.error('报告生成失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 获取配置信息
   * @returns {Object} 配置信息
   */
  getConfig() {
    return this.config;
  }
  
  /**
   * 更新配置信息
   * @param {Object} newConfig 新的配置信息
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
  
  /**
   * 获取最新的测试结果
   * @returns {Object} 测试结果
   */
  getResults() {
    return this.results;
  }
}

// 导出安全测试框架和底层测试函数
module.exports = {
  SecurityTestFramework,
  runAllSecurityTests,
  testXSSVulnerability,
  testCSRFProtection,
  testPermissions,
  testSQLInjection,
  testInputValidation,
  testSessionManagement,
  generateReport
}; 