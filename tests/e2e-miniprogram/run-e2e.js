const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

// Monkey-patch: skip version check that fails with newer DevTools
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;
MiniProgram.prototype.checkVersion = async function() {
  try {
    const info = await this.send('Tool.getInfo');
    console.log('  DevTools info:', JSON.stringify(info));
  } catch (e) {
    console.log('  [WARN] Tool.getInfo failed, skipping version check');
  }
};

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const SUITES = {
  core: [
    { id: '1.1', name: '首页加载', suite: 'core' },
    { id: '1.2', name: '登录页', suite: 'core' },
    { id: '1.3', name: '跳过登录', suite: 'core' },
    { id: '1.4', name: 'Tab导航-分类', suite: 'core' },
    { id: '1.5', name: 'Tab导航-购物车', suite: 'core' },
    { id: '1.6', name: 'Tab导航-我的', suite: 'core' },
  ],
  shopping: [
    { id: '2.1', name: '商品分类页', suite: 'shopping' },
    { id: '2.2', name: '商品列表页', suite: 'shopping' },
    { id: '2.3', name: '购物车页', suite: 'shopping' },
  ],
  user: [
    { id: '3.1', name: '个人中心', suite: 'user' },
    { id: '3.2', name: '设置页', suite: 'user' },
  ],
  merchant: [
    { id: '4.1', name: '商家中心首页', suite: 'merchant' },
    { id: '4.2', name: '商品管理', suite: 'merchant' },
  ],
  ai: [
    { id: '5.1', name: 'AI RAG对话', suite: 'ai' },
    { id: '5.2', name: '产品分析', suite: 'ai' },
  ],
  trace: [
    { id: '6.1', name: '扫码溯源页', suite: 'trace' },
  ],
};

const results = [];

async function screenshot(miniProgram, name) {
  try {
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '_');
    await miniProgram.screenshot({ path: path.join(SCREENSHOTS_DIR, `${safeName}.png`) });
  } catch (e) {
    console.log(`  [WARN] Screenshot failed: ${e.message}`);
  }
}

function record(test, status, duration, note = '') {
  results.push({ ...test, status, duration, note });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} ${test.id} ${test.name} (${duration}ms) ${note}`);
}

async function runTest(miniProgram, test, fn) {
  const start = Date.now();
  try {
    await fn();
    record(test, 'PASS', Date.now() - start);
  } catch (e) {
    record(test, 'FAIL', Date.now() - start, e.message.slice(0, 100));
    await screenshot(miniProgram, `FAIL_${test.id}_${test.name}`);
  }
}

async function runCoreSuite(miniProgram) {
  console.log('\n=== Suite 1: Core ===');

  // 1.1 首页加载
  await runTest(miniProgram, SUITES.core[0], async () => {
    await miniProgram.reLaunch('/pages/home/index');
    await delay(2000);
    const page = miniProgram.currentPage();
    const data = await page.data();
    await screenshot(miniProgram, '1.1_首页');
    if (!data) throw new Error('Page data is null');
  });

  // 1.2 登录页
  await runTest(miniProgram, SUITES.core[1], async () => {
    await miniProgram.navigateTo('/pages/auth/login/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    const pagePath = await page.path;
    await screenshot(miniProgram, '1.2_登录页');
    if (!pagePath.includes('auth/login')) throw new Error(`Wrong page: ${pagePath}`);
  });

  // 1.3 跳过登录
  await runTest(miniProgram, SUITES.core[2], async () => {
    const page = miniProgram.currentPage();
    const skipBtn = await page.$('.skip-login');
    if (skipBtn) {
      await skipBtn.tap();
      await delay(1500);
    }
    await screenshot(miniProgram, '1.3_跳过登录后');
  });

  // 1.4 Tab-分类
  await runTest(miniProgram, SUITES.core[3], async () => {
    await miniProgram.switchTab('/pages/goods/goods-category/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    await screenshot(miniProgram, '1.4_分类Tab');
    const pagePath = await page.path;
    if (!pagePath.includes('goods-category')) throw new Error(`Wrong page: ${pagePath}`);
  });

  // 1.5 Tab-购物车
  await runTest(miniProgram, SUITES.core[4], async () => {
    await miniProgram.switchTab('/pages/shopping-cart/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    await screenshot(miniProgram, '1.5_购物车Tab');
    const pagePath = await page.path;
    if (!pagePath.includes('shopping-cart')) throw new Error(`Wrong page: ${pagePath}`);
  });

  // 1.6 Tab-我的
  await runTest(miniProgram, SUITES.core[5], async () => {
    await miniProgram.switchTab('/pages/user/user-center/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    await screenshot(miniProgram, '1.6_我的Tab');
    const pagePath = await page.path;
    if (!pagePath.includes('user-center')) throw new Error(`Wrong page: ${pagePath}`);
  });
}

async function runShoppingSuite(miniProgram) {
  console.log('\n=== Suite 2: Shopping ===');

  // 2.1 商品分类
  await runTest(miniProgram, SUITES.shopping[0], async () => {
    await miniProgram.switchTab('/pages/goods/goods-category/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    const data = await page.data();
    await screenshot(miniProgram, '2.1_商品分类');
  });

  // 2.2 商品列表
  await runTest(miniProgram, SUITES.shopping[1], async () => {
    await miniProgram.navigateTo('/pages/goods/goods-list/index');
    await delay(2000);
    const page = miniProgram.currentPage();
    await screenshot(miniProgram, '2.2_商品列表');
    const pagePath = await page.path;
    if (!pagePath.includes('goods-list')) throw new Error(`Wrong page: ${pagePath}`);
  });

  // 2.3 购物车
  await runTest(miniProgram, SUITES.shopping[2], async () => {
    await miniProgram.switchTab('/pages/shopping-cart/index');
    await delay(1500);
    await screenshot(miniProgram, '2.3_购物车');
  });
}

async function runUserSuite(miniProgram) {
  console.log('\n=== Suite 3: User ===');

  // 3.1 个人中心
  await runTest(miniProgram, SUITES.user[0], async () => {
    await miniProgram.switchTab('/pages/user/user-center/index');
    await delay(1500);
    const page = miniProgram.currentPage();
    await screenshot(miniProgram, '3.1_个人中心');
    const data = await page.data();
  });

  // 3.2 设置页
  await runTest(miniProgram, SUITES.user[1], async () => {
    await miniProgram.navigateTo('/pages/user/settings/index');
    await delay(1500);
    await screenshot(miniProgram, '3.2_设置');
  });
}

async function runMerchantSuite(miniProgram) {
  console.log('\n=== Suite 4: Merchant ===');

  // 4.1 商家首页
  await runTest(miniProgram, SUITES.merchant[0], async () => {
    await miniProgram.navigateTo('/pages/merchant-center/index/index');
    await delay(2000);
    await screenshot(miniProgram, '4.1_商家中心');
  });

  // 4.2 商品管理
  await runTest(miniProgram, SUITES.merchant[1], async () => {
    await miniProgram.navigateTo('/pages/merchant-center/product-list/index');
    await delay(1500);
    await screenshot(miniProgram, '4.2_商品管理');
  });
}

async function runAISuite(miniProgram) {
  console.log('\n=== Suite 5: AI ===');

  // 5.1 AI RAG
  await runTest(miniProgram, SUITES.ai[0], async () => {
    await miniProgram.navigateTo('/pages/ai-rag/chat/index');
    await delay(2000);
    await screenshot(miniProgram, '5.1_AI对话');
  });

  // 5.2 产品分析
  await runTest(miniProgram, SUITES.ai[1], async () => {
    await miniProgram.navigateTo('/pages/ai-analysis/product/index');
    await delay(2000);
    await screenshot(miniProgram, '5.2_产品分析');
  });
}

async function runTraceSuite(miniProgram) {
  console.log('\n=== Suite 6: Trace ===');

  // 6.1 扫码溯源
  await runTest(miniProgram, SUITES.trace[0], async () => {
    await miniProgram.navigateTo('/pages/traceability/scan/index');
    await delay(1500);
    await screenshot(miniProgram, '6.1_扫码溯源');
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printReport() {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log('## 小程序 E2E 测试结果');
  console.log('='.repeat(70));
  console.log(`\n| # | 测试 | 套件 | 状态 | 耗时 | 备注 |`);
  console.log(`|---|------|------|------|------|------|`);
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`| ${r.id} | ${r.name} | ${r.suite} | ${icon} ${r.status} | ${r.duration}ms | ${r.note} |`);
  }
  console.log(`\n**总计**: ${passed}/${total} Passed, ${failed} Failed`);
  console.log(`**截图**: tests/e2e-miniprogram/screenshots/`);

  // Save JSON results
  fs.writeFileSync(
    path.join(__dirname, 'results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results, summary: { total, passed, failed } }, null, 2)
  );
}

async function main() {
  const suite = process.argv[2] || 'all';
  console.log(`\n🚀 小程序 E2E 测试 — suite: ${suite}`);
  console.log(`连接 ws://localhost:9420 ...\n`);

  let miniProgram;
  try {
    miniProgram = await automator.connect({
      wsEndpoint: 'ws://localhost:9420',
    });
    console.log('✅ 已连接到微信开发者工具\n');
  } catch (e) {
    console.error(`❌ 连接失败: ${e.message}`);
    console.error('请确保开发者工具已启动且自动化端口 9420 已开启');
    process.exit(1);
  }

  try {
    if (suite === 'all' || suite === 'core') await runCoreSuite(miniProgram);
    if (suite === 'all' || suite === 'shopping') await runShoppingSuite(miniProgram);
    if (suite === 'all' || suite === 'user') await runUserSuite(miniProgram);
    if (suite === 'all' || suite === 'merchant') await runMerchantSuite(miniProgram);
    if (suite === 'all' || suite === 'ai') await runAISuite(miniProgram);
    if (suite === 'all' || suite === 'trace') await runTraceSuite(miniProgram);
  } catch (e) {
    console.error(`\n❌ 套件执行异常: ${e.message}`);
  }

  printReport();

  await miniProgram.disconnect();
  console.log('\n🏁 测试完成，已断开连接');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
