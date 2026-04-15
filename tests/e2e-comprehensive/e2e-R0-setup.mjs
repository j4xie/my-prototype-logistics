/**
 * Round 0 Setup: Create FACTORY type test factory + 16 accounts
 *
 * Factory creation uses SSH → backend:10010 (nginx doesn't proxy /api/platform)
 * Account creation uses SSH → backend:10010 (platform_admin can create users)
 * Login verification uses direct HTTP to 139:8086
 *
 * Usage: node tests/e2e-comprehensive/e2e-R0-setup.mjs [--skip-factory] [--factory-id FOOD_xxx]
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const BASE_API = 'http://139.196.165.140:8086';
const BACKEND_SSH = 'root@47.100.235.168';
const BACKEND_LOCAL = 'http://localhost:10010';
const PASSWORD = process.env.E2E_PASSWORD || '123456';
const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';

const ACCOUNTS = [
  { username: 'e2e_factory_admin', roleCode: 'factory_super_admin', fullName: 'E2E Factory Admin', web: true },
  { username: 'e2e_hr_admin', roleCode: 'hr_admin', fullName: 'E2E HR Admin', web: true },
  { username: 'e2e_procurement_mgr', roleCode: 'procurement_manager', fullName: 'E2E Procurement Mgr', web: true },
  { username: 'e2e_sales_mgr', roleCode: 'sales_manager', fullName: 'E2E Sales Mgr', web: true },
  { username: 'e2e_dispatcher', roleCode: 'dispatcher', fullName: 'E2E Dispatcher', web: true },
  { username: 'e2e_warehouse_mgr', roleCode: 'warehouse_manager', fullName: 'E2E Warehouse Mgr', web: true },
  { username: 'e2e_equipment_admin', roleCode: 'equipment_admin', fullName: 'E2E Equipment Admin', web: true },
  { username: 'e2e_quality_mgr', roleCode: 'quality_manager', fullName: 'E2E Quality Mgr', web: true },
  { username: 'e2e_finance_mgr', roleCode: 'finance_manager', fullName: 'E2E Finance Mgr', web: true },
  { username: 'e2e_restaurant_mgr', roleCode: 'restaurant_manager', fullName: 'E2E Restaurant Mgr', web: true },
  { username: 'e2e_workshop_sup', roleCode: 'workshop_supervisor', fullName: 'E2E Workshop Sup', web: true },
  { username: 'e2e_viewer', roleCode: 'viewer', fullName: 'E2E Viewer', web: true },
  { username: 'e2e_production_mgr', roleCode: 'production_manager', fullName: 'E2E Production Mgr', web: true },
  { username: 'e2e_quality_insp', roleCode: 'quality_inspector', fullName: 'E2E Quality Insp', web: false },
  { username: 'e2e_operator', roleCode: 'operator', fullName: 'E2E Operator', web: false },
  { username: 'e2e_warehouse_worker', roleCode: 'warehouse_worker', fullName: 'E2E Warehouse Worker', web: false },
];

async function httpPost(url, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
    return await resp.json();
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function httpGet(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    return await resp.json();
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function sshCurl(path, method, data, token) {
  const escaped = JSON.stringify(data).replace(/"/g, '\\"');
  const authHeader = token ? `-H "Authorization: Bearer ${token}"` : '';
  const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${BACKEND_SSH} ` +
    `"curl -s -m 15 -X ${method} ${BACKEND_LOCAL}${path} -H \\"Content-Type: application/json\\" ${authHeader} -d \\"${escaped}\\""`;
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return JSON.parse(out);
  } catch (e) {
    return { success: false, message: e.message?.substring(0, 200) };
  }
}

async function run() {
  const skipFactory = process.argv.includes('--skip-factory');
  const factoryIdArg = process.argv.includes('--factory-id')
    ? process.argv[process.argv.indexOf('--factory-id') + 1]
    : null;
  const results = { timestamp: new Date().toISOString(), factoryId: null, accounts: [], errors: [] };

  console.log('='.repeat(70));
  console.log('ROUND 0: E2E Test Factory + Account Setup');
  console.log('='.repeat(70));

  // Step 1: Get platform_admin token
  console.log('\n[Step 1] Login as platform_admin...');
  const loginResp = await httpPost(`${BASE_API}/api/mobile/auth/unified-login`,
    { username: 'platform_admin', password: PASSWORD });

  if (!loginResp.success || !loginResp.data?.accessToken) {
    console.error('FATAL: platform_admin login failed:', loginResp.message || loginResp.code);
    // Retry once in case of rate limit
    if (loginResp.code === 429) {
      console.log('  Rate limited, waiting 5s...');
      await new Promise(r => setTimeout(r, 5000));
      const retry = await httpPost(`${BASE_API}/api/mobile/auth/unified-login`,
        { username: 'platform_admin', password: PASSWORD });
      if (!retry.success) {
        console.error('  Retry failed:', retry.message);
        process.exit(1);
      }
      loginResp.data = retry.data;
    } else {
      process.exit(1);
    }
  }
  const TOKEN = loginResp.data.accessToken;
  console.log('  ✓ platform_admin token obtained');

  // Step 2: Factory
  let factoryId = factoryIdArg;

  if (skipFactory && !factoryId && existsSync(SETUP_FILE)) {
    const prev = JSON.parse(readFileSync(SETUP_FILE, 'utf8'));
    factoryId = prev.factoryId;
  }

  if (!factoryId) {
    console.log('\n[Step 2] Creating FACTORY type test factory via SSH→backend...');
    const factoryResp = sshCurl('/api/platform/factories', 'POST',
      { name: 'E2E综合测试食品厂', industryCode: 'FOOD', regionCode: '3101', subscriptionPlan: 'BASIC' },
      TOKEN);

    if (!factoryResp.success || !factoryResp.data?.id) {
      console.error('FATAL: Factory creation failed:', factoryResp.message);
      process.exit(1);
    }
    factoryId = factoryResp.data.id;
    console.log(`  ✓ Factory created: ${factoryId} (type=${factoryResp.data.type})`);
  } else {
    console.log(`\n[Step 2] Using factory: ${factoryId}`);
  }
  results.factoryId = factoryId;

  // Step 3: Create accounts via SSH (bypasses hr:read_write permission requirement)
  console.log(`\n[Step 3] Creating ${ACCOUNTS.length} accounts for ${factoryId}...`);

  for (const acct of ACCOUNTS) {
    const userResp = sshCurl(
      `/api/mobile/${factoryId}/users`, 'POST',
      { username: acct.username, password: PASSWORD, fullName: acct.fullName, roleCode: acct.roleCode },
      TOKEN
    );

    const ok = userResp.success && userResp.data;
    const isDuplicate = !ok && (userResp.message || '').includes('已存在');
    const icon = ok ? '✓' : isDuplicate ? '~' : '✗';
    const msg = ok ? `id=${userResp.data.id || userResp.data.userId}` : (userResp.message || 'unknown error');
    console.log(`  [${icon}] ${acct.username.padEnd(25)} (${acct.roleCode.padEnd(22)}) ${msg}`);

    results.accounts.push({
      ...acct,
      created: ok || isDuplicate,
      userId: ok ? (userResp.data.id || userResp.data.userId) : null,
      error: ok ? null : userResp.message,
    });
  }

  // Step 4: Verify login for all accounts
  console.log('\n[Step 4] Verify login for all accounts...');
  for (const acct of results.accounts.filter(a => a.created)) {
    const verifyResp = await httpPost(`${BASE_API}/api/mobile/auth/unified-login`,
      { username: acct.username, password: PASSWORD });
    const loginOk = verifyResp.success && verifyResp.data?.accessToken;
    acct.loginVerified = loginOk;
    acct.factoryType = verifyResp.data?.factoryType || 'N/A';
    acct.factoryId = verifyResp.data?.factoryId || 'N/A';
    const icon = loginOk ? '✓' : '✗';
    console.log(`  [${icon}] ${acct.username.padEnd(25)} factoryType=${acct.factoryType} factoryId=${acct.factoryId}`);
  }

  // Summary
  const created = results.accounts.filter(a => a.created).length;
  const verified = results.accounts.filter(a => a.loginVerified).length;
  console.log('\n' + '='.repeat(70));
  console.log(`SETUP COMPLETE: factory=${factoryId}`);
  console.log(`Accounts: ${created}/${ACCOUNTS.length} created, ${verified} login verified`);
  console.log('='.repeat(70));

  writeFileSync(SETUP_FILE, JSON.stringify(results, null, 2));
  console.log(`\nResults → ${SETUP_FILE}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
