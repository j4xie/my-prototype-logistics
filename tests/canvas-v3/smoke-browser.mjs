// tests/canvas-v3/smoke-browser.mjs
import { BrowserClient } from './lib/browser-client.mjs';

(async () => {
  console.log('Playwright smoke test...');
  const browser = new BrowserClient({ headless: true });
  try {
    await browser.launch();
    console.log('  Browser launched');

    const loggedIn = await browser.login('factory_admin1', '123456');
    console.log(`  Login: ${loggedIn ? '✅' : '❌'}`);

    const shot = await browser.screenshot('smoke-test');
    console.log(`  Screenshot: ${shot}`);

    await browser.close();
    console.log('  Browser closed');
    process.exit(loggedIn ? 0 : 1);
  } catch (e) {
    console.error('Smoke test error:', e.message);
    await browser.close();
    process.exit(1);
  }
})();
