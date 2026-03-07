const automator = require('miniprogram-automator');

// Monkey-patch: skip version check
const MiniProgram = require('miniprogram-automator/out/MiniProgram').default;
MiniProgram.prototype.checkVersion = async function() {
  try {
    const info = await this.send('Tool.getInfo');
    console.log('DevTools version:', info.version);
  } catch (e) {
    console.log('[WARN] version check skipped');
  }
};

async function main() {
  console.log('Connecting to ws://localhost:9420...');
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  console.log('Connected!\n');

  // Test 1: Get current page
  console.log('--- Test 1: currentPage ---');
  try {
    const page = await mp.currentPage();
    console.log('Current page path:', page.path);
    console.log('Current page query:', page.query);
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 2: Get system info
  console.log('\n--- Test 2: systemInfo ---');
  try {
    const info = await mp.systemInfo();
    console.log('Platform:', info.platform);
    console.log('Model:', info.model);
    console.log('SDKVersion:', info.SDKVersion);
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 3: Get page data
  console.log('\n--- Test 3: page.data() ---');
  try {
    const page = await mp.currentPage();
    const data = await page.data();
    const keys = Object.keys(data || {});
    console.log('Data keys (' + keys.length + '):', keys.slice(0, 15).join(', '));
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 4: Screenshot
  console.log('\n--- Test 4: screenshot ---');
  try {
    const path = require('path');
    const screenshotPath = path.join(__dirname, 'screenshots', 'quick-test.png');
    require('fs').mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    await mp.screenshot({ path: screenshotPath });
    const stats = require('fs').statSync(screenshotPath);
    console.log('Screenshot saved:', screenshotPath, '(' + Math.round(stats.size / 1024) + 'KB)');
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 5: Navigate (with timeout)
  console.log('\n--- Test 5: switchTab ---');
  try {
    const result = await Promise.race([
      mp.switchTab('/pages/goods/goods-category/index'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 10s')), 10000))
    ]);
    console.log('Switched to:', result ? result.path : 'unknown');
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 6: Screenshot after navigate
  console.log('\n--- Test 6: screenshot after navigate ---');
  try {
    const path = require('path');
    const screenshotPath = path.join(__dirname, 'screenshots', 'after-navigate.png');
    await mp.screenshot({ path: screenshotPath });
    const stats = require('fs').statSync(screenshotPath);
    console.log('Screenshot saved:', screenshotPath, '(' + Math.round(stats.size / 1024) + 'KB)');
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // Test 7: Get page elements
  console.log('\n--- Test 7: page elements ---');
  try {
    const page = await mp.currentPage();
    const els = await page.$$('.cu-bar');
    console.log('.cu-bar elements found:', els.length);
    const allViews = await page.$$('view');
    console.log('view elements found:', allViews.length);
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  console.log('\n✅ Quick test complete!');
  mp.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
