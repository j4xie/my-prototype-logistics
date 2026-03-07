const automator = require('miniprogram-automator');

function timeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, r) => setTimeout(() => r(new Error(label + ' timeout after ' + ms + 'ms')), ms))
  ]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  let mp;

  try {
    console.log('Connecting...');
    mp = await timeout(
      automator.connect({ wsEndpoint: 'ws://localhost:9420' }),
      8000, 'connect'
    );
    console.log('Connected');
  } catch(e) {
    console.error('FATAL connect:', e.message);
    process.exit(1);
  }

  try {
    console.log('Getting current page...');
    const page = await timeout(mp.currentPage(), 10000, 'currentPage');
    console.log('Page:', page.path);

    console.log('Getting data...');
    const data = await timeout(page.data(), 10000, 'data');

    // Output key data
    const modules = data.renderModules || [];
    console.log('renderModules count:', modules.length);
    console.log('renderModules types:', modules.map(m => m.type));

    const moduleDataKeys = Object.keys(data.moduleData || {});
    console.log('moduleData keys:', moduleDataKeys);

    // Check P0 modules
    const types = modules.map(m => m.type);
    console.log('\n--- P0 Check ---');
    console.log('coupon:', types.includes('coupon') ? 'FOUND' : 'MISSING');
    console.log('referral_banner:', types.includes('referral_banner') ? 'FOUND' : 'MISSING');
    console.log('license_badge:', types.includes('license_badge') ? 'FOUND' : 'MISSING');

    // Screenshot
    try {
      await timeout(mp.screenshot({ path: './screenshots/p0.png' }), 5000, 'screenshot');
      console.log('Screenshot: OK');
    } catch(e) { console.log('Screenshot: skip'); }

  } catch(e) {
    console.error('Error:', e.message);
  }

  try { mp.disconnect(); } catch(e) {}
  setTimeout(() => process.exit(0), 1000);
})();
