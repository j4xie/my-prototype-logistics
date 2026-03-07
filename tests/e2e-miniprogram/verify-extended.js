const automator = require('miniprogram-automator');

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  console.log('=== 扩展 E2E 验证 (分包页面 + 错误检查) ===\n');
  const results = [];

  function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
  }

  // 收集 JS 错误
  const errors = [];
  mp.on('error', e => errors.push(e));

  // === 分包页面测试 ===

  // 1. 商户中心-店铺装修 (之前 @babel/runtime 出错的页面)
  await mp.reLaunch('/pages/merchant-center/shop-design/index');
  await new Promise(r => setTimeout(r, 3000));
  const shopPage = await mp.currentPage();
  check('店铺装修页加载', shopPage.path === 'pages/merchant-center/shop-design/index');

  // 2. 商户中心-商品列表
  await mp.reLaunch('/pages/merchant-center/product-list/index');
  await new Promise(r => setTimeout(r, 2000));
  const prodPage = await mp.currentPage();
  check('商品列表页加载', prodPage.path === 'pages/merchant-center/product-list/index');

  // 3. AI 分析-工厂
  await mp.reLaunch('/pages/ai-analysis/factory/index');
  await new Promise(r => setTimeout(r, 2000));
  const aiPage = await mp.currentPage();
  check('AI 分析-工厂页加载', aiPage.path.includes('ai-analysis'));

  // 4. 溯源详情
  await mp.reLaunch('/pages/traceability/detail/index?id=test');
  await new Promise(r => setTimeout(r, 2000));
  const tracePage = await mp.currentPage();
  check('溯源详情页加载', tracePage.path === 'pages/traceability/detail/index');

  // 5. 用户地址
  await mp.reLaunch('/pages/user/user-address/list/index');
  await new Promise(r => setTimeout(r, 2000));
  const addrPage = await mp.currentPage();
  check('用户地址页加载', addrPage.path === 'pages/user/user-address/list/index');

  // 6. 订单确认
  await mp.reLaunch('/pages/order/order-confirm/index');
  await new Promise(r => setTimeout(r, 2000));
  const confirmPage = await mp.currentPage();
  check('订单确认页加载', confirmPage.path === 'pages/order/order-confirm/index');

  // 7. 订单详情
  await mp.reLaunch('/pages/order/order-detail/index?id=test');
  await new Promise(r => setTimeout(r, 2000));
  const odPage = await mp.currentPage();
  check('订单详情页加载', odPage.path === 'pages/order/order-detail/index');

  // 8. 结算页
  await mp.reLaunch('/pages/orders/checkout/index');
  await new Promise(r => setTimeout(r, 2000));
  const checkoutPage = await mp.currentPage();
  check('结算页加载', checkoutPage.path === 'pages/orders/checkout/index');

  // === 核心模块验证 ===

  // 9. validate.js 模块
  const validateOk = await mp.evaluate(() => {
    try {
      const v = require('utils/validate.js');
      return typeof v.isEmail === 'function' && typeof v.isMobile === 'function' && typeof v.validatenull === 'function';
    } catch(e) { return false; }
  });
  check('validate.js 模块', validateOk === true);

  // 10. base64src.js 模块
  const b64Ok = await mp.evaluate(() => {
    try {
      const b = require('utils/base64src.js');
      return typeof b.base64src === 'function';
    } catch(e) { return false; }
  });
  check('base64src.js 模块', b64Ok === true);

  // 11. oss.js 模块
  const ossOk = await mp.evaluate(() => {
    try {
      const o = require('utils/oss.js');
      return typeof o === 'object' && o !== null;
    } catch(e) { return false; }
  });
  check('oss.js 模块', ossOk === true);

  // 12. config/env.js
  const envOk = await mp.evaluate(() => {
    try {
      const c = require('config/env.js');
      return typeof c.basePath === 'string' && c.basePath.includes('http');
    } catch(e) { return false; }
  });
  check('config/env.js 模块', envOk === true);

  // 13. tracker 模块
  const trackerOk = await mp.evaluate(() => {
    try {
      const t = require('utils/tracker.js');
      return typeof t === 'object';
    } catch(e) { return false; }
  });
  check('tracker.js 模块', trackerOk === true);

  // JS 错误汇总
  console.log('\n收集到的 JS 错误:', errors.length, '个');
  errors.forEach((e, i) => console.log('  ' + (i+1) + '. ' + String(e).substring(0, 100)));

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
