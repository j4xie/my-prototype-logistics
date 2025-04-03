const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080',
  pages: [
    // 主要入口页面
    { name: '首页', path: '/' },
    
    // 养殖模块页面
    { name: '养殖主页', path: '/pages/farming/' },
    { name: '养殖-繁育信息', path: '/pages/farming/farming-breeding.html' },
    { name: '养殖-饲养管理', path: '/pages/farming/farming-feeding.html' },
    { name: '养殖-健康管理', path: '/pages/farming/farming-health.html' },
    { name: '养殖-环境监控', path: '/pages/farming/farming-environment.html' },
    { name: '养殖-数据统计', path: '/pages/farming/farming-statistics.html' },
    { name: '养殖-场地监控', path: '/pages/farming/farming-monitor.html' },
    { name: '养殖-疫苗接种', path: '/pages/farming/farming-vaccine.html' },
    { name: '养殖-创建溯源', path: '/pages/farming/create-trace.html' },
    
    // 加工模块页面
    { name: '加工主页', path: '/pages/processing/' },
    { name: '加工-屠宰处理', path: '/pages/processing/processing-slaughter.html' },
    { name: '加工-质量检验', path: '/pages/processing/processing-quality.html' },
    { name: '加工-环境监控', path: '/pages/processing/processing-environment.html' },
    { name: '加工-报告管理', path: '/pages/processing/processing-reports.html' },
    
    // 物流模块页面
    { name: '物流主页', path: '/pages/logistics/' },
    { name: '物流-创建运单', path: '/pages/logistics/logistics-create.html' },
    { name: '物流-运单列表', path: '/pages/logistics/logistics-list.html' },
    { name: '物流-运单详情', path: '/pages/logistics/logistics-detail.html' },
    { name: '物流-车辆监控', path: '/pages/logistics/vehicle-monitor.html' },
    { name: '物流-客户管理', path: '/pages/logistics/client-management.html' },
    
    // 溯源模块页面
    { name: '溯源主页', path: '/pages/trace/' },
    { name: '溯源-地图', path: '/pages/trace/trace-map.html' },
    { name: '溯源-列表', path: '/pages/trace/trace-list.html' },
    { name: '溯源-详情', path: '/pages/trace/trace-detail.html' },
    { name: '溯源-证书', path: '/pages/trace/trace-certificate.html' },
    { name: '溯源-编辑', path: '/pages/trace/trace-edit.html' },
    
    // 个人档案页面
    { name: '个人档案', path: '/pages/profile/' },
    { name: '个人档案-主页', path: '/pages/profile/profile.html' },
    { name: '个人档案-通知', path: '/pages/profile/notifications.html' },
    { name: '个人档案-设置', path: '/pages/profile/settings.html' },
    
    // 系统管理页面
    { name: '系统管理', path: '/pages/admin/' },
    { name: '系统管理-控制台', path: '/pages/admin/admin-dashboard.html' },
    { name: '系统管理-系统设置', path: '/pages/admin/admin-system.html' },
    { name: '系统管理-用户管理', path: '/pages/admin/admin-users.html' },
    
    // 首页选择器和认证页面
    { name: '首页选择器', path: '/pages/home/home-selector.html' },
    { name: '首页-养殖', path: '/pages/home/home-farming.html' },
    { name: '首页-加工', path: '/pages/home/home-processing.html' },
    { name: '首页-物流', path: '/pages/home/home-logistics.html' },
    { name: '首页-管理', path: '/pages/home/home-admin.html' },
    { name: '登录', path: '/pages/auth/login.html' },
    { name: '注册', path: '/pages/auth/register.html' },
    { name: '忘记密码', path: '/pages/auth/forgot-password.html' },
    { name: '重置密码', path: '/pages/auth/reset-password.html' },
    
    // 产品溯源页面
    { name: '产品溯源', path: '/pages/product-trace.html' }
  ],
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/navigation_report.json')
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// 确保reports目录存在
const reportsDir = path.dirname(config.reportPath);
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

async function run() {
  console.log('启动页面导航验证...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const navigationResults = [];
    
    // 遍历每个导航路径并验证
    for (const pageConfig of config.pages) {
      const url = config.baseUrl + pageConfig.path;
      console.log(`导航至${pageConfig.name}: ${url}`);
      
      try {
        const response = await page.goto(url, { timeout: 10000, waitUntil: 'networkidle' });
        const status = response.status();
        const title = await page.title();
        
        // 截取页面截图
        const screenshotPath = path.join(config.screenshotsDir, `${pageConfig.name}_page.png`);
        await page.screenshot({ path: screenshotPath });
        
        navigationResults.push({
          name: pageConfig.name,
          url,
          status,
          title,
          screenshot: screenshotPath,
          success: status >= 200 && status < 400,
          errorMessage: status >= 400 ? `HTTP错误: ${status}` : null
        });
        
      } catch (error) {
        // 处理导航错误
        navigationResults.push({
          name: pageConfig.name,
          url,
          status: 0,
          title: null,
          screenshot: null,
          success: false,
          errorMessage: `导航错误: ${error.message}`
        });
        console.error(`导航到${pageConfig.name}失败:`, error.message);
      }
      
      // 等待一会儿，确保页面加载完成
      await page.waitForTimeout(2000);
    }
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      totalPages: config.pages.length,
      successCount: navigationResults.filter(r => r.success).length,
      failCount: navigationResults.filter(r => !r.success).length,
      results: navigationResults,
      status: 'success'
    };
    
    // 保存导航验证报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    console.log('页面导航验证完成');
    return report;
    
  } catch (error) {
    console.error('验证过程中出错:', error);
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'failed'
    };
  } finally {
    await browser.close();
  }
}

module.exports = { run };