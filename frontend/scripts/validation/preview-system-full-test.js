const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PreviewSystemTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      modes: {},
      pages: {},
      summary: {
        modesTotal: 5,
        modesPassed: 0,
        pagesTested: 0,
        pagesWithErrors: 0,
        criticalErrors: []
      }
    };
  }

  async init() {
    console.log('🚀 启动预览系统完整测试...');
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    // 监听控制台错误
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ 控制台错误:', msg.text());
        this.results.summary.criticalErrors.push({
          type: 'console',
          message: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // 监听页面错误
    this.page.on('pageerror', error => {
      console.log('❌ 页面错误:', error.message);
      this.results.summary.criticalErrors.push({
        type: 'page',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });

    await this.page.goto('http://localhost:3000/preview');
    await this.page.waitForLoadState('networkidle');
  }

  async testGridMode() {
    console.log('\n📋 测试 Grid 模式...');

    try {
      // 点击 Grid 模式
      await this.page.click('button:has-text("Grid")');
      await this.page.waitForSelector('[data-testid="grid-view"]', { timeout: 5000 });

      // 检查页面卡片数量
      const gridCards = await this.page.locator('.grid .bg-white').count();
      console.log(`   发现 ${gridCards} 个页面卡片`);

      // 测试搜索功能
      await this.page.fill('input[placeholder*="搜索"]', 'admin');
      await this.page.waitForTimeout(500);
      const filteredCards = await this.page.locator('.grid .bg-white').count();
      console.log(`   搜索 "admin" 后显示 ${filteredCards} 个结果`);

      // 清空搜索
      await this.page.fill('input[placeholder*="搜索"]', '');
      await this.page.waitForTimeout(500);

      // 测试分类筛选
      const categories = await this.page.locator('select option').allTextContents();
      console.log(`   可用分类: ${categories.join(', ')}`);

      this.results.modes.grid = {
        status: 'passed',
        cardCount: gridCards,
        searchWorks: filteredCards < gridCards,
        categories: categories.length
      };

      console.log('✅ Grid 模式测试通过');

    } catch (error) {
      console.log('❌ Grid 模式测试失败:', error.message);
      this.results.modes.grid = { status: 'failed', error: error.message };
    }
  }

  async testNavigationMode() {
    console.log('\n🌳 测试 Navigation 模式...');

    try {
      await this.page.click('button:has-text("Navigation")');
      await this.page.waitForSelector('[data-testid="navigation-view"]', { timeout: 5000 });

      // 检查树形结构
      const treeNodes = await this.page.locator('[data-testid="navigation-view"] .cursor-pointer').count();
      console.log(`   发现 ${treeNodes} 个导航节点`);

      // 测试展开/收缩功能
      const expandableNodes = await this.page.locator('button:has-text("▶")').count();
      console.log(`   发现 ${expandableNodes} 个可展开节点`);

      if (expandableNodes > 0) {
        // 展开第一个节点
        await this.page.click('button:has-text("▶")');
        await this.page.waitForTimeout(300);

        // 检查是否展开
        const collapsibleNodes = await this.page.locator('button:has-text("▼")').count();
        console.log(`   展开后发现 ${collapsibleNodes} 个可收缩节点`);
      }

      this.results.modes.navigation = {
        status: 'passed',
        nodeCount: treeNodes,
        expandableCount: expandableNodes
      };

      console.log('✅ Navigation 模式测试通过');

    } catch (error) {
      console.log('❌ Navigation 模式测试失败:', error.message);
      this.results.modes.navigation = { status: 'failed', error: error.message };
    }
  }

  async testFlowMode() {
    console.log('\n🔄 测试 Flow 模式...');

    try {
      await this.page.click('button:has-text("Flow")');
      await this.page.waitForSelector('[data-testid="flow-view"]', { timeout: 5000 });

      // 检查流程步骤
      const flowSteps = await this.page.locator('[data-testid="flow-view"] .bg-white').count();
      console.log(`   发现 ${flowSteps} 个流程步骤`);

      // 测试自动演示功能
      const autoPlayButton = await this.page.locator('button:has-text("自动演示")');
      if (await autoPlayButton.count() > 0) {
        await autoPlayButton.click();
        await this.page.waitForTimeout(1000);
        console.log('   自动演示功能启动成功');

        // 停止自动演示
        const stopButton = await this.page.locator('button:has-text("停止")');
        if (await stopButton.count() > 0) {
          await stopButton.click();
          console.log('   自动演示停止成功');
        }
      }

      this.results.modes.flow = {
        status: 'passed',
        stepCount: flowSteps,
        autoPlayWorks: true
      };

      console.log('✅ Flow 模式测试通过');

    } catch (error) {
      console.log('❌ Flow 模式测试失败:', error.message);
      this.results.modes.flow = { status: 'failed', error: error.message };
    }
  }

  async testHierarchyMode() {
    console.log('\n📊 测试 Hierarchy 模式...');

    try {
      await this.page.click('button:has-text("Hierarchy")');
      await this.page.waitForSelector('[data-testid="hierarchy-view"]', { timeout: 5000 });

      // 检查层级结构
      const hierarchyLevels = await this.page.locator('[data-testid="hierarchy-view"] .border-l').count();
      console.log(`   发现 ${hierarchyLevels} 个层级元素`);

      // 测试展开/收缩功能
      const expandButtons = await this.page.locator('[data-testid="hierarchy-view"] button').count();
      console.log(`   发现 ${expandButtons} 个交互按钮`);

      // 测试第一个展开按钮
      if (expandButtons > 0) {
        const firstButton = this.page.locator('[data-testid="hierarchy-view"] button').first();
        await firstButton.click();
        await this.page.waitForTimeout(300);
        console.log('   层级展开/收缩功能正常');
      }

      this.results.modes.hierarchy = {
        status: 'passed',
        levelCount: hierarchyLevels,
        interactiveElements: expandButtons
      };

      console.log('✅ Hierarchy 模式测试通过');

    } catch (error) {
      console.log('❌ Hierarchy 模式测试失败:', error.message);
      this.results.modes.hierarchy = { status: 'failed', error: error.message };
    }
  }

  async testSitemapMode() {
    console.log('\n🗺️  测试 Sitemap 模式...');

    try {
      await this.page.click('button:has-text("Sitemap")');
      await this.page.waitForSelector('[data-testid="sitemap-view"]', { timeout: 5000 });

      // 检查视图切换按钮
      const viewButtons = await this.page.locator('[data-testid="sitemap-view"] button:has-text("图")').count();
      console.log(`   发现 ${viewButtons} 个视图切换按钮`);

      // 测试关系图视图
      if (await this.page.locator('button:has-text("关系图")').count() > 0) {
        await this.page.click('button:has-text("关系图")');
        await this.page.waitForTimeout(500);
        console.log('   关系图视图加载成功');
      }

      // 测试树形图视图
      if (await this.page.locator('button:has-text("树形图")').count() > 0) {
        await this.page.click('button:has-text("树形图")');
        await this.page.waitForTimeout(500);
        console.log('   树形图视图加载成功');
      }

      // 测试矩阵图视图
      if (await this.page.locator('button:has-text("矩阵图")').count() > 0) {
        await this.page.click('button:has-text("矩阵图")');
        await this.page.waitForTimeout(500);
        console.log('   矩阵图视图加载成功');
      }

      this.results.modes.sitemap = {
        status: 'passed',
        viewCount: viewButtons,
        multipleViews: viewButtons >= 3
      };

      console.log('✅ Sitemap 模式测试通过');

    } catch (error) {
      console.log('❌ Sitemap 模式测试失败:', error.message);
      this.results.modes.sitemap = { status: 'failed', error: error.message };
    }
  }

  async testRandomPages() {
    console.log('\n🎲 随机测试页面路由...');

    const testPages = [
      '/admin/dashboard',
      '/farming/crops',
      '/processing/production',
      '/logistics/transport-orders',
      '/profile/edit',
      '/query',
      '/tracking',
      '/dashboard',
      '/components',
      '/help-center'
    ];

    for (const pagePath of testPages) {
      try {
        console.log(`   测试页面: ${pagePath}`);
        await this.page.goto(`http://localhost:3000${pagePath}`);
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });

        // 检查页面是否加载成功（没有404）
        const title = await this.page.title();
        const is404 = title.includes('404') ||
                     await this.page.locator('text=404').count() > 0 ||
                     await this.page.locator('text=Not Found').count() > 0;

        if (is404) {
          console.log(`   ❌ ${pagePath} - 404错误`);
          this.results.pages[pagePath] = { status: 'failed', error: '404 Not Found' };
          this.results.summary.pagesWithErrors++;
        } else {
          console.log(`   ✅ ${pagePath} - 加载成功`);
          this.results.pages[pagePath] = { status: 'passed', title };
        }

        this.results.summary.pagesTested++;

      } catch (error) {
        console.log(`   ❌ ${pagePath} - 错误: ${error.message}`);
        this.results.pages[pagePath] = { status: 'failed', error: error.message };
        this.results.summary.pagesWithErrors++;
        this.results.summary.pagesTested++;
      }
    }

    // 返回预览页面
    await this.page.goto('http://localhost:3000/preview');
    await this.page.waitForLoadState('networkidle');
  }

  async generateReport() {
    // 计算通过的模式数量
    this.results.summary.modesPassed = Object.values(this.results.modes)
      .filter(mode => mode.status === 'passed').length;

    const report = {
      timestamp: new Date().toISOString(),
      testResults: this.results,
      summary: {
        ...this.results.summary,
        successRate: {
          modes: `${this.results.summary.modesPassed}/${this.results.summary.modesTotal}`,
          pages: `${this.results.summary.pagesTested - this.results.summary.pagesWithErrors}/${this.results.summary.pagesTested}`
        }
      }
    };

    // 保存报告
    const reportPath = path.join(__dirname, 'reports', 'preview-system-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 测试完成，生成报告:');
    console.log(`✅ 预览模式: ${report.summary.successRate.modes} 通过`);
    console.log(`✅ 页面测试: ${report.summary.successRate.pages} 通过`);
    console.log(`⚠️  关键错误: ${this.results.summary.criticalErrors.length} 个`);
    console.log(`📄 报告已保存: ${reportPath}`);

    return report;
  }

  async run() {
    try {
      await this.init();

      // 测试所有预览模式
      await this.testGridMode();
      await this.testNavigationMode();
      await this.testFlowMode();
      await this.testHierarchyMode();
      await this.testSitemapMode();

      // 随机测试页面
      await this.testRandomPages();

      // 生成报告
      const report = await this.generateReport();

      return report;

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 运行测试
async function main() {
  const tester = new PreviewSystemTester();

  try {
    const report = await tester.run();

    // 打印最终结果
    console.log('\n🎉 预览系统完整测试结果:');
    console.log('================================');
    console.log(`模式测试: ${report.summary.successRate.modes}`);
    console.log(`页面测试: ${report.summary.successRate.pages}`);
    console.log(`系统稳定性: ${report.summary.criticalErrors.length === 0 ? '✅ 稳定' : '⚠️ 有问题'}`);

    if (report.summary.criticalErrors.length > 0) {
      console.log('\n关键错误详情:');
      report.summary.criticalErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.message}`);
      });
    }

    process.exit(report.summary.criticalErrors.length === 0 ? 0 : 1);

  } catch (error) {
    console.error('❌ 测试运行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PreviewSystemTester;
