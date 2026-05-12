// Capture 4th screenshot: admin "添加" (new dept) dialog open
import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'http://139.196.165.140:8097';
const EVID = 'C:/Users/Steve/cretas-r4-department-deep/docs/qa-audits/2026-05-12-r4-department-l4-deep-evidence';

async function loginAPI(username) {
  const r = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username, password: '123456',
      deviceInfo: { deviceId: `e2e-r4-ss4-${Date.now()}`, deviceModel: 'node', platform: 'Node' }
    })
  });
  const j = await r.json();
  return j.data;
}

(async () => {
  const login = await loginAPI('factory_admin1');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(([token, user]) => {
    localStorage.setItem('cretas_access_token', token);
    localStorage.setItem('cretas_user', JSON.stringify(user));
  }, [login.token, {
    id: login.userId, username: login.username, email: '', isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    userType: 'factory', factoryUser: {
      role: login.role, factoryId: login.factoryId, factoryType: 'FACTORY',
      permissions: login.permissions || [],
    }
  }]);

  await page.goto(`${BASE}/hr/departments`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.el-table__row', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Click "添加" / "新建"
  const addBtn = await page.$('.el-button:has-text("添加"), .el-button:has-text("新建"), .el-button:has-text("新增")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(EVID, 'ui1-hr-departments-add-dialog.png'), fullPage: false });
    console.log('Captured add-dialog screenshot');
  } else {
    console.log('No add button found, capturing scrolled-down view instead');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(EVID, 'ui1-hr-departments-scrolled.png'), fullPage: false });
  }

  await ctx.close();
  await browser.close();
})();
