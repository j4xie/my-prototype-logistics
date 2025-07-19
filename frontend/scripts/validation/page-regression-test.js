const http = require('http');
const https = require('https');

class PageRegressionTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.results = {
      tested: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async testPage(path) {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}${path}`;

      const req = http.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const isSuccess = res.statusCode === 200 &&
                          !data.includes('404') &&
                          !data.includes('Not Found') &&
                          data.includes('<html');

          if (isSuccess) {
            console.log(`✅ ${path} - 状态码: ${res.statusCode}`);
            this.results.passed++;
          } else {
            console.log(`❌ ${path} - 状态码: ${res.statusCode}`);
            this.results.failed++;
            this.results.errors.push({ path, status: res.statusCode, issue: '404或内容异常' });
          }

          this.results.tested++;
          resolve(isSuccess);
        });
      });

      req.on('error', (error) => {
        console.log(`❌ ${path} - 网络错误: ${error.message}`);
        this.results.failed++;
        this.results.tested++;
        this.results.errors.push({ path, error: error.message });
        resolve(false);
      });

      req.setTimeout(10000, () => {
        console.log(`❌ ${path} - 超时`);
        this.results.failed++;
        this.results.tested++;
        this.results.errors.push({ path, error: '请求超时' });
        req.destroy();
        resolve(false);
      });
    });
  }

  async runTest() {
    console.log('🚀 开始页面回归测试...\n');

    // 重要页面列表
    const testPages = [
      // 核心页面
      '/',
      '/dashboard',
      '/preview',

      // 认证相关
      '/login',
      '/register',
      '/reset-password',

      // 农业模块
      '/farming',
      '/farming/crops',
      '/farming/fields',
      '/farming/planting-plans',
      '/farming/harvest-records',

      // 加工模块
      '/processing',
      '/processing/production',
      '/processing/quality',
      '/processing/storage',
      '/processing/raw-materials',
      '/processing/finished-products',

      // 物流模块
      '/logistics',
      '/logistics/transport-orders',
      '/logistics/delivery-management',

      // 溯源功能
      '/query',
      '/list',
      '/tracking',

      // 管理功能
      '/admin/dashboard',
      '/admin/users',
      '/admin/roles',
      '/admin/audit',
      '/admin/reports',

      // 用户相关
      '/profile',
      '/profile/edit',
      '/profile/security',
      '/profile/notifications',

      // 其他重要页面
      '/components',
      '/settings',
      '/help-center',
      '/reports'
    ];

    console.log(`📋 计划测试 ${testPages.length} 个重要页面...\n`);

    // 批量测试页面
    for (const page of testPages) {
      await this.testPage(page);
      // 短暂延迟避免过载
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 测试结果汇总:');
    console.log('================');
    console.log(`总计: ${this.results.tested} 个页面`);
    console.log(`通过: ${this.results.passed} 个页面`);
    console.log(`失败: ${this.results.failed} 个页面`);
    console.log(`成功率: ${((this.results.passed / this.results.tested) * 100).toFixed(1)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ 失败页面详情:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.path} - ${error.issue || error.error}`);
      });
    }

    console.log(`\n${this.results.failed === 0 ? '🎉' : '⚠️'} 页面回归测试${this.results.failed === 0 ? '完全通过' : '发现问题'}!`);

    return this.results;
  }
}

// 运行测试
async function main() {
  const tester = new PageRegressionTester();

  try {
    const results = await tester.runTest();
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PageRegressionTester;
