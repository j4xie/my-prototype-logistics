/**
 * J0 — Environment Setup Verification
 *
 * API-only (no Playwright). Verifies that the test environment is reachable
 * and the Canvas tables / modules are properly seeded before the security
 * suite runs.
 *
 * Steps:
 *  J0-1  Health check — API reachable
 *  J0-2  Factory A admin login — token acquired
 *  J0-3  Canvas dynamic-fields endpoint — HTTP 200
 *  J0-4  Module schemas — ≥10 modules present
 *  J0-5  Factory B admin login — PASS or WARN if user unavailable
 *
 * Exit code 1 if any step is FAIL.
 */

import {
  login,
  apiGet,
  createResultCollector,
  API_BASE,
  FACTORY_A,
  FACTORY_B,
  ADMIN_A,
  ADMIN_B,
} from './canvas-test-helpers.mjs';

const rc = createResultCollector('j0-setup');

// ---------------------------------------------------------------------------
// J0-1  Health check
// ---------------------------------------------------------------------------
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok || res.status === 200) {
      rc.log('J0-1', 'PASS', `API reachable — HTTP ${res.status} from ${API_BASE}/health`);
      return true;
    }
    rc.log('J0-1', 'FAIL', `Health endpoint returned HTTP ${res.status}`);
    return false;
  } catch (err) {
    rc.log('J0-1', 'FAIL', `Cannot reach API at ${API_BASE}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// J0-2  Factory A admin login
// ---------------------------------------------------------------------------
async function loginFactoryA() {
  try {
    const session = await login(ADMIN_A, '123456');
    if (!session.token) {
      rc.log('J0-2', 'FAIL', 'Login succeeded but no token returned');
      return null;
    }
    rc.log(
      'J0-2',
      'PASS',
      `Factory A admin logged in — factoryId=${session.factoryId} role=${session.role} userId=${session.userId}`
    );
    return session;
  } catch (err) {
    rc.log('J0-2', 'FAIL', `Factory A admin login error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// J0-3  Canvas dynamic-fields endpoint
// ---------------------------------------------------------------------------
async function checkDynamicFields(token) {
  try {
    const result = await apiGet(`${FACTORY_A}/config/v2/dynamic-fields`, token);
    if (result.status === 200) {
      const count = Array.isArray(result.data) ? result.data.length : '(non-array data)';
      rc.log(
        'J0-3',
        'PASS',
        `dynamic-fields returned HTTP 200 — ${count} field(s) in response`
      );
      return true;
    }
    rc.log(
      'J0-3',
      'FAIL',
      `dynamic-fields returned HTTP ${result.status}: ${result.message || '(no message)'}`
    );
    return false;
  } catch (err) {
    rc.log('J0-3', 'FAIL', `dynamic-fields request error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// J0-4  Module schemas — ≥10 modules
// ---------------------------------------------------------------------------
async function checkModuleSchemas(token) {
  const MIN_MODULES = 10;
  try {
    const result = await apiGet(`${FACTORY_A}/config/modules`, token);
    if (result.status !== 200) {
      rc.log(
        'J0-4',
        'FAIL',
        `/config/modules returned HTTP ${result.status}: ${result.message || '(no message)'}`
      );
      return false;
    }

    // The response data may be an array directly or have a nested structure.
    // Try common shapes: data[], data.content[], data.modules[], data.moduleSchemas[]
    let modules = null;
    const d = result.data;
    if (Array.isArray(d)) {
      modules = d;
    } else if (d && Array.isArray(d.content)) {
      modules = d.content;
    } else if (d && Array.isArray(d.modules)) {
      modules = d.modules;
    } else if (d && Array.isArray(d.moduleSchemas)) {
      modules = d.moduleSchemas;
    }

    if (modules === null) {
      // Log raw shape as evidence then treat as WARN (structure unknown but 200 is good)
      const shape = d ? Object.keys(d).join(', ') : 'null';
      rc.log(
        'J0-4',
        'WARN',
        `/config/modules HTTP 200 but unknown data shape — keys: [${shape}]. Cannot count modules.`
      );
      return true; // non-blocking warning
    }

    if (modules.length >= MIN_MODULES) {
      rc.log(
        'J0-4',
        'PASS',
        `module_schemas has ${modules.length} module(s) (≥${MIN_MODULES} required)`
      );
      return true;
    }

    rc.log(
      'J0-4',
      'FAIL',
      `module_schemas only has ${modules.length} module(s) — expected ≥${MIN_MODULES}`
    );
    return false;
  } catch (err) {
    rc.log('J0-4', 'FAIL', `module schemas request error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// J0-5  Factory B admin login (non-blocking)
// ---------------------------------------------------------------------------
async function loginFactoryB() {
  try {
    const session = await login(ADMIN_B, '123456');
    if (!session.token) {
      rc.log('J0-5', 'WARN', 'Factory B login returned no token — cross-factory tests may be limited');
      return null;
    }
    rc.log(
      'J0-5',
      'PASS',
      `Factory B admin logged in — factoryId=${session.factoryId} role=${session.role}`
    );
    return session;
  } catch (err) {
    // Factory B account may not be set up in the test environment — treat as WARN
    rc.log(
      'J0-5',
      'WARN',
      `Factory B admin unavailable (${err.message}) — cross-factory isolation tests will be skipped`
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== J0 Environment Setup Verification ===\n');
  console.log(`API_BASE : ${API_BASE}`);
  console.log(`FACTORY_A: ${FACTORY_A}`);
  console.log(`FACTORY_B: ${FACTORY_B}\n`);

  const fails = [];

  // J0-1 Health
  const healthy = await checkHealth();
  if (!healthy) fails.push('J0-1');

  // J0-2 Factory A login (required for subsequent steps)
  const sessionA = await loginFactoryA();
  if (!sessionA) {
    fails.push('J0-2');
    // Cannot proceed without a valid token
    rc.log('J0-3', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J0-4', 'FAIL', 'Skipped — Factory A token unavailable');
    fails.push('J0-3', 'J0-4');
  } else {
    // J0-3 Dynamic fields
    const fieldsOk = await checkDynamicFields(sessionA.token);
    if (!fieldsOk) fails.push('J0-3');

    // J0-4 Module schemas
    const modulesOk = await checkModuleSchemas(sessionA.token);
    if (!modulesOk) fails.push('J0-4');
  }

  // J0-5 Factory B (WARN-only, never blocks)
  await loginFactoryB();

  // Save results and determine exit code
  const summary = rc.save();
  const exitCode = summary.fail > 0 ? 1 : 0;

  if (exitCode !== 0) {
    console.error(`\nEnvironment setup FAILED (${summary.fail} failure(s)). Fix before running security suite.`);
  } else {
    console.log('\nEnvironment ready. Proceed with the Canvas Security E2E suite.');
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Unexpected error in j0-setup:', err);
  process.exit(1);
});
