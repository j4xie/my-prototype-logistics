// tests/canvas-v3/lib/browser-client.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const WEB_ADMIN_URL = 'http://139.196.165.140:8086';
const SCREENSHOT_DIR = './tests/canvas-v3/screenshots';

export class BrowserClient {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch() {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'zh-CN',
    });

    // Block Google Fonts (fails in China, blocks Vue rendering)
    await this.context.route('**/fonts.googleapis.com/**', route =>
      route.fulfill({ status: 200, body: '' })
    );
    await this.context.route('**/fonts.gstatic.com/**', route =>
      route.fulfill({ status: 200, body: '' })
    );

    this.page = await this.context.newPage();
    return this;
  }

  async login(username, password) {
    await this.page.goto(WEB_ADMIN_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for login form to appear
    try {
      await this.page.waitForSelector(
        'input[placeholder*="用户名"], input[placeholder*="账号"], input[type="text"]',
        { timeout: 10000 }
      );
    } catch (e) {
      // Maybe already logged in — check URL
      if (!this.page.url().includes('login')) {
        return true;
      }
      throw e;
    }

    // Fill username
    const userInput = await this.page.$(
      'input[placeholder*="用户名"], input[placeholder*="账号"], input[type="text"]'
    );
    if (userInput) {
      await userInput.fill(username);
    }

    // Fill password
    await this.page.fill('input[type="password"]', password);

    // Click login button
    const loginBtn = await this.page.$(
      'button:has-text("登录"), button:has-text("登 录"), button[type="submit"]'
    );
    if (loginBtn) {
      await loginBtn.click();
    }

    // Wait for navigation away from login
    await this.page.waitForTimeout(3000);

    const url = this.page.url();
    return !url.includes('login');
  }

  async screenshot(name) {
    const filename = path.join(SCREENSHOT_DIR, `${name}.png`);
    await this.page.screenshot({ path: filename, fullPage: true });
    return filename;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getPage() {
    return this.page;
  }
}
