const automator = require('miniprogram-automator');

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  console.log('=== 小程序 E2E 验证 ===\n');
  const results = [];

  function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
  }

  // 1. 首页
  await mp.reLaunch('/pages/home/index');
  await new Promise(r => setTimeout(r, 3000));
  const home = await mp.currentPage();
  const hd = await home.data();
  check('首页渲染', home.path === 'pages/home/index', 'path=' + home.path);
  check('轮播图加载', (hd.bannerList || []).length > 0, (hd.bannerList || []).length + '张');
  check('分类加载', (hd.categoryList || []).length > 0, (hd.categoryList || []).length + '个');

  // 全局 API 检查
  const apiCheck = await mp.evaluate(() => {
    const app = getApp();
    return {
      apiType: typeof app.api,
      hasLogin: app.api && typeof app.api.login === 'function',
      hasRequest: app.api && typeof app.api.request === 'function',
      hasSession: Boolean(app.globalData && app.globalData.thirdSession)
    };
  });
  check('api 模块加载', apiCheck.apiType === 'object', apiCheck.apiType);
  check('api.login 可用', apiCheck.hasLogin === true);
  check('api.request 可用', apiCheck.hasRequest === true);
  check('用户 session', apiCheck.hasSession === true);

  // 2. 分类页
  await mp.switchTab('/pages/goods/goods-category/index');
  await new Promise(r => setTimeout(r, 2000));
  const catPage = await mp.currentPage();
  check('分类页加载', catPage.path === 'pages/goods/goods-category/index');

  // 3. 购物车
  await mp.switchTab('/pages/shopping-cart/index');
  await new Promise(r => setTimeout(r, 2000));
  const cartPage = await mp.currentPage();
  check('购物车页加载', cartPage.path === 'pages/shopping-cart/index');

  // 4. 订单列表
  await mp.switchTab('/pages/order/order-list/index');
  await new Promise(r => setTimeout(r, 2000));
  const orderPage = await mp.currentPage();
  check('订单列表页加载', orderPage.path === 'pages/order/order-list/index');

  // 5. 用户中心
  await mp.switchTab('/pages/user/user-center/index');
  await new Promise(r => setTimeout(r, 2000));
  const userPage = await mp.currentPage();
  check('用户中心页加载', userPage.path === 'pages/user/user-center/index');

  // 6. 商品详情 (先 reLaunch 到首页避免 tabBar navigateTo 限制)
  await mp.reLaunch('/pages/goods/goods-detail/index?id=2');
  await new Promise(r => setTimeout(r, 3000));
  const detailPage = await mp.currentPage();
  check('商品详情页加载', detailPage.path === 'pages/goods/goods-detail/index');

  // 7. 扫码溯源
  await mp.reLaunch('/pages/traceability/scan/index');
  await new Promise(r => setTimeout(r, 2000));
  const scanPage = await mp.currentPage();
  check('扫码溯源页加载', scanPage.path === 'pages/traceability/scan/index');

  // 8. 我的推荐
  await mp.reLaunch('/pages/referral/my-referrals/index');
  await new Promise(r => setTimeout(r, 2000));
  const refPage = await mp.currentPage();
  check('我的推荐页加载', refPage.path === 'pages/referral/my-referrals/index');

  // Summary
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('\n=== 结果: ' + passed + '/' + total + ' PASS ===');

  await mp.disconnect();
  process.exit(passed === total ? 0 : 1);
})().catch(e => {
  console.error('致命错误:', e.message);
  process.exit(1);
});
