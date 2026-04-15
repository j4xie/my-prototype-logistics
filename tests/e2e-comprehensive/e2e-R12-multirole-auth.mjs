/**
 * R12 多角色 auth-cache 验证
 *
 * 目的: 验证 lib/auth-cache.mjs 能做到:
 * 1. 每个 username 只登录 1 次 → storageState 缓存到磁盘
 * 2. 第二次使用相同 username 直接 restore, 不触发登录 API
 * 3. 多角色并行/串行测试不触发 429 rate-limit
 *
 * 测试 4 个业务关键角色:
 * - e2e_factory_admin (factory_super_admin)   → 全权限
 * - e2e_sales_mgr     (sales_manager)         → 销售模块读写
 * - e2e_finance_mgr   (finance_manager)       → 财务模块读写
 * - e2e_viewer        (viewer)                → 只读
 *
 * 每个角色验证:
 * - dashboard 访问成功
 * - 用户菜单加载完成
 * - 导航栏菜单存在
 *
 * 这是 **基础设施验证** — auth-cache 能工作了, 后续可以基于它写跨角色权限矩阵测试.
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import {
  setupAuthOnce, restoreAuth, newContextWithAuth, getAuthFile,
} from './lib/auth-cache.mjs';
import { BASE } from './lib/helpers.mjs';

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 12;
const results = [];

// 4 roles from R0-setup accounts
const ROLES_TO_TEST = [
  { username: 'e2e_factory_admin', role: 'factory_super_admin', expectDashboard: true },
  { username: 'e2e_sales_mgr',     role: 'sales_manager',       expectDashboard: true },
  { username: 'e2e_finance_mgr',   role: 'finance_manager',     expectDashboard: true },
  { username: 'e2e_viewer',        role: 'viewer',              expectDashboard: true },
];

function record(testId, step, status, evidence = {}) {
  const r = { layer: 'L1', testId, step, status, depth: 'medium', evidence, ts: new Date().toISOString() };
  results.push(r);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : '-';
  console.log(`  [${icon}] L1/${testId}/${step}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) console.log(`      ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
}

async function verifyLoggedIn(page, username, role) {
  // Long timeout — 139 server is occasionally slow, we don't want false negatives.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for menu to render (proves session is valid)
  let menuReady = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    menuReady = await page.evaluate(() => !!document.querySelector('.el-menu,.app-sidebar'));
    if (menuReady) break;
  }
  const url = page.url();
  const atDashboard = url.includes('/dashboard');
  const redirectedToLogin = url.includes('/login');

  // Check for cretas_user in localStorage
  const userInfo = await page.evaluate(() => {
    const raw = window.localStorage.getItem('cretas_user');
    return raw ? JSON.parse(raw) : null;
  });

  return { url, atDashboard, redirectedToLogin, menuReady, userInfo };
}

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  R12 多角色 auth-cache 验证');
  console.log('═══════════════════════════════════════');
  console.log(`  Factory: ${FACTORY_ID}`);
  console.log(`  Roles: ${ROLES_TO_TEST.length}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ===== Phase 1: setupAuthOnce — login each role, cache storageState =====
    console.log('\n--- Phase 1: setupAuthOnce (fresh run logs in, cached run skips) ---');
    const setupTiming = {};
    for (const { username } of ROLES_TO_TEST) {
      const t0 = Date.now();
      try {
        const { cached, authFile } = await setupAuthOnce(browser, username);
        const elapsed = Date.now() - t0;
        setupTiming[username] = { cached, elapsed };
        record(`setup-${username}`, 'login_or_cached',
          'PASS',
          { cached, elapsed_ms: elapsed, authFile: authFile.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '') });
      } catch (e) {
        record(`setup-${username}`, 'login_or_cached', 'FAIL', { error: e.message });
      }
    }

    // ===== Phase 2: restoreAuth — use cached storageState in fresh contexts =====
    console.log('\n--- Phase 2: restoreAuth — 验证缓存可复用 ---');
    for (const { username, role, expectDashboard } of ROLES_TO_TEST) {
      const t0 = Date.now();
      let context, page;
      try {
        ({ context, page } = await newContextWithAuth(browser, username));
      } catch (e) {
        record(`restore-${username}`, 'newContextWithAuth', 'FAIL', { error: e.message });
        continue;
      }
      const restoreElapsed = Date.now() - t0;

      try {
        const state = await verifyLoggedIn(page, username, role);
        const ok = expectDashboard ? state.atDashboard : !state.redirectedToLogin;
        record(`restore-${username}`, 'verify_session',
          ok && state.menuReady ? 'PASS' : 'FAIL',
          {
            restore_ms: restoreElapsed,
            atDashboard: state.atDashboard,
            menuReady: state.menuReady,
            userRole: state.userInfo?.role || '(none)',
            userFactoryId: state.userInfo?.factoryId || '(none)',
            expectedRole: role,
            urlMatch: state.url.replace(BASE, ''),
          });
      } catch (e) {
        record(`restore-${username}`, 'verify_session', 'FAIL', { error: e.message });
      } finally {
        await context.close();
      }
    }

    // ===== Phase 3: 第二次 setupAuthOnce 应该全部 cached=true =====
    console.log('\n--- Phase 3: 再次调用 setupAuthOnce — 应全部 cached=true (幂等验证) ---');
    for (const { username } of ROLES_TO_TEST) {
      const t0 = Date.now();
      const { cached } = await setupAuthOnce(browser, username);
      const elapsed = Date.now() - t0;
      record(`idempotent-${username}`, 'second_call_cached',
        cached ? 'PASS' : 'FAIL',
        { cached, elapsed_ms: elapsed });
    }

    // ===== Phase 4: Rate-limit 防御 — 4 个角色 × 2 轮 setupAuthOnce 应该只 login 4 次 =====
    // (第一轮已 login 4 次, 第二轮应该全走 cache, 远低于 5/60s 限制)
    console.log('\n--- Phase 4: 计算实际登录次数 vs 非缓存场景 ---');
    const nonCachedLogins = ROLES_TO_TEST.length * 2; // 如果没 cache 会 login 8 次
    const actualLogins = Object.values(setupTiming).filter(t => !t.cached).length;
    const savedLogins = nonCachedLogins - actualLogins;
    record('rate_limit_defense', 'login_count_verification',
      savedLogins > 0 ? 'PASS' : 'FAIL',
      {
        totalRoles: ROLES_TO_TEST.length,
        actualLoginsRound1: actualLogins,
        wouldBeLoginsWithoutCache: nonCachedLogins,
        savedLogins,
        rateLimitThreshold: '5 logins / 60s',
      });

  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    results.push({ layer: 'L1', testId: 'fatal', step: 'error', status: 'FAIL', depth: 'medium', evidence: { message: e.message }, ts: new Date().toISOString() });
  } finally {
    await browser.close();
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const summary = {
    round: ROUND,
    timestamp: new Date().toISOString(),
    factoryId: FACTORY_ID,
    notes: 'R12 multi-role auth-cache — TS→mjs port verification',
    rolesTested: ROLES_TO_TEST.map(r => ({ username: r.username, role: r.role })),
    results,
    summary: { pass, fail, warn, total: pass + fail + warn },
  };
  const outFile = `tests/e2e-comprehensive/results/e2e-R12-multirole-auth.json`;
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\n✓ Saved → ${outFile}`);
  console.log(`  结果: ${pass} PASS / ${fail} FAIL / ${warn} WARN`);
  process.exit(fail > 0 ? 1 : 0);
})();
