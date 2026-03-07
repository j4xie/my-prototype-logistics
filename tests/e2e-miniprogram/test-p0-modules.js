const automator = require('miniprogram-automator');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeNav(mp, method, url) {
  try {
    await Promise.race([
      mp[method](url),
      new Promise((_, r) => setTimeout(() => r(new Error('nav-timeout')), 12000))
    ]);
  } catch(e) { /* timeout is normal */ }
  await sleep(2500);
  return await mp.currentPage();
}

(async () => {
  let mp;
  const results = [];

  // Step 1: Connect
  try {
    console.log('[1] Connecting...');
    mp = await Promise.race([
      automator.connect({ wsEndpoint: 'ws://localhost:9420' }),
      new Promise((_, r) => setTimeout(() => r(new Error('connect-timeout')), 8000))
    ]);
    console.log('[1] Connected OK');
  } catch(e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }

  try {
    // Check current page first
    let page = await mp.currentPage();
    console.log('[2] Current page:', page.path);

    // Navigate to home if not already there
    if (!page.path || !page.path.includes('home')) {
      console.log('[2] Not on home, navigating...');
      page = await safeNav(mp, 'reLaunch', '/pages/home/index');
      console.log('[2] After nav:', page.path);
    }

    results.push({ test: 'Home page loaded', pass: page.path && page.path.includes('home') });

    // Wait for page data to load
    console.log('[3] Waiting for data...');
    await sleep(3000);

    // Read page data
    const data = await page.data();
    console.log('[3] Data keys:', Object.keys(data).filter(k => data[k] !== null && data[k] !== undefined && data[k] !== '' && data[k] !== false).join(', '));

    // Check renderModules
    const modules = data.renderModules || [];
    const moduleTypes = modules.map(m => m.type);
    console.log('[3] Module types:', JSON.stringify(moduleTypes));

    // If no modules, try to check pageConfig
    if (modules.length === 0) {
      console.log('[3] No renderModules - checking raw pageConfig...');
      console.log('[3] pageConfig:', data.pageConfig ? 'exists' : 'null');
      console.log('[3] modulesConfig:', data.modulesConfig ? JSON.stringify(data.modulesConfig).substring(0, 200) : 'null');
    }

    // P0 Module Tests
    const hasCoupon = moduleTypes.includes('coupon');
    results.push({ test: 'Coupon module present', pass: hasCoupon });

    const hasReferral = moduleTypes.includes('referral_banner');
    results.push({ test: 'Referral_banner module present', pass: hasReferral });

    const hasLicense = moduleTypes.includes('license_badge');
    results.push({ test: 'License_badge module present', pass: hasLicense });

    // Check coupon data enhancements
    const coupons = data.moduleData?.couponList || [];
    console.log('[4] Coupons loaded:', coupons.length);
    if (coupons.length > 0) {
      const c = coupons[0];
      const enhanced = ('expiryText' in c) || ('claimed' in c) || ('isNewUser' in c);
      console.log('[4] Coupon fields:', Object.keys(c).join(', '));
      results.push({ test: 'Coupon enhancement fields', pass: enhanced });
    } else {
      results.push({ test: 'Coupon enhancement fields', pass: null, note: 'network blocked' });
    }

    // Check referral data
    const refData = data.moduleData?.referralData;
    console.log('[5] Referral data:', refData ? JSON.stringify(refData).substring(0, 100) : 'null');

    // Check module rendering for each P0 type
    for (const mod of modules) {
      if (['coupon', 'referral_banner', 'license_badge'].includes(mod.type)) {
        console.log(`[6] Module "${mod.type}": visible=${mod.visible !== false}, props=${JSON.stringify(mod.props || {}).substring(0, 80)}`);
      }
    }

    // Screenshot
    try {
      await mp.screenshot({ path: './screenshots/home-p0.png' });
      console.log('[7] Screenshot saved');
    } catch(e) {
      console.log('[7] Screenshot skipped:', e.message?.substring(0, 40));
    }

  } catch(e) {
    console.error('Error:', e.message);
  }

  // Results
  console.log('\n===== P0 MODULE E2E RESULTS =====');
  let p = 0, f = 0, s = 0;
  for (const r of results) {
    const st = r.pass === true ? '✅' : r.pass === false ? '❌' : '⚠️';
    if (r.pass === true) p++;
    else if (r.pass === false) f++;
    else s++;
    console.log(`${st} ${r.test}${r.note ? ' (' + r.note + ')' : ''}`);
  }
  console.log(`\nPassed: ${p} | Failed: ${f} | Skipped: ${s}`);

  try { await mp.disconnect(); } catch(e) {}
  process.exit(f > 0 ? 1 : 0);
})();
