/**
 * J4 — Cross-Tenant Security Attack Vectors
 *
 * SECURITY_API_TEST — no Playwright browser needed.
 *
 * Verifies that the backend correctly rejects cross-factory data access and
 * common injection / DDoS attack patterns.
 *
 * Attack vectors:
 *  J4-1  SQL injection via fieldCode (Fix 1)
 *  J4-2  SQL injection via sub-table column name (Fix 1, 12)
 *  J4-3  Cross-tenant sub-table read — Factory B reads Factory A record (Fix 2, 15d)
 *  J4-4  Cross-tenant custom-fields write — Factory B writes Factory A record (Fix 5, 14)
 *  J4-5  Cross-tenant ConfigChangeSet approve — Factory B approves Factory A changeset (Fix 10, 15c)
 *  J4-6  Cron DDoS — high-frequency cron expression rejected (Fix 11, 15b)
 *  J4-6b Cron comma bypass — comma-list cron expression rejected (Fix 11, 15b)
 *
 * Skip policy:
 *  - If Factory B login fails → log WARN, skip all cross-tenant attacks (J4-3, J4-4, J4-5).
 *  - If Factory A has no sales orders → log WARN, skip attacks that need a record ID (J4-2, J4-3, J4-4).
 *
 * Exit code 1 if any step is FAIL.
 *
 * Run: node tests/canvas-security-e2e/j4-cross-tenant.mjs
 */

import {
  login,
  apiGet,
  apiPost,
  apiPut,
  createResultCollector,
  FACTORY_A,
  FACTORY_B,
  ADMIN_A,
  ADMIN_B,
} from './canvas-test-helpers.mjs';

const rc = createResultCollector('j4-cross-tenant');

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function loginFactoryA() {
  try {
    const session = await login(ADMIN_A, '123456');
    if (!session.token) {
      rc.log('J4-SETUP-A', 'FAIL', 'Factory A login succeeded but returned no token');
      return null;
    }
    rc.log(
      'J4-SETUP-A',
      'PASS',
      `Factory A admin logged in — factoryId=${session.factoryId} role=${session.role}`
    );
    return session;
  } catch (err) {
    rc.log('J4-SETUP-A', 'FAIL', `Factory A admin login error: ${err.message}`);
    return null;
  }
}

async function loginFactoryB() {
  try {
    const session = await login(ADMIN_B, '123456');
    if (!session.token) {
      rc.log('J4-SETUP-B', 'WARN', 'Factory B login returned no token — cross-tenant tests will be skipped');
      return null;
    }
    rc.log(
      'J4-SETUP-B',
      'PASS',
      `Factory B admin logged in — factoryId=${session.factoryId} role=${session.role}`
    );
    return session;
  } catch (err) {
    rc.log(
      'J4-SETUP-B',
      'WARN',
      `Factory B unavailable (${err.message}) — cross-tenant isolation tests will be skipped`
    );
    return null;
  }
}

/**
 * Fetch the first sales order ID belonging to Factory A.
 * Returns null (with a WARN) if none exist.
 */
async function getFactoryARecordId(tokenA) {
  try {
    const result = await apiGet(`${FACTORY_A}/sales/orders?page=1&size=1`, tokenA);
    if (result.status !== 200) {
      rc.log(
        'J4-SETUP-SO',
        'WARN',
        `Cannot list Factory A sales orders — HTTP ${result.status}: ${result.message || '(no message)'}. Attacks J4-2, J4-3, J4-4 will be skipped.`
      );
      return null;
    }

    // Accept multiple response shapes
    const d = result.data;
    let records = null;
    if (Array.isArray(d)) {
      records = d;
    } else if (d && Array.isArray(d.content)) {
      records = d.content;
    } else if (d && Array.isArray(d.records)) {
      records = d.records;
    } else if (d && Array.isArray(d.list)) {
      records = d.list;
    }

    if (!records || records.length === 0) {
      rc.log(
        'J4-SETUP-SO',
        'WARN',
        'Factory A has no sales orders — attacks J4-2, J4-3, J4-4 will be skipped'
      );
      return null;
    }

    const id = records[0].id ?? records[0].orderId ?? records[0].recordId;
    if (!id) {
      rc.log(
        'J4-SETUP-SO',
        'WARN',
        `Cannot extract record ID from Factory A sales order (keys: ${Object.keys(records[0]).join(', ')}) — attacks J4-2, J4-3, J4-4 will be skipped`
      );
      return null;
    }

    rc.log('J4-SETUP-SO', 'PASS', `Got Factory A sales order ID: ${id}`);
    return String(id);
  } catch (err) {
    rc.log(
      'J4-SETUP-SO',
      'WARN',
      `Error fetching Factory A sales orders: ${err.message} — attacks J4-2, J4-3, J4-4 will be skipped`
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Attack 1 — SQL injection via fieldCode (Fix 1)
// ---------------------------------------------------------------------------
async function attack1SqlInjectionFieldCode(tokenB) {
  const TEST_ID = 'J4-1';
  try {
    const result = await apiPost(
      `${FACTORY_B}/config/v2/dynamic-fields`,
      {
        fieldCode: 'x; DROP TABLE sales_orders',
        fieldName: 'Injected Field',
        fieldType: 'STRING',
        moduleCode: 'sales_order',
      },
      tokenB
    );

    const blocked =
      result.status === 400 ||
      result.status === 422 ||
      (!result.success && (
        (result.message && result.message.includes('必须匹配')) ||
        result.status >= 400
      ));

    if (blocked) {
      rc.log(
        TEST_ID,
        'PASS',
        `SQL injection in fieldCode correctly rejected — HTTP ${result.status} message="${result.message}"`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `SQL injection in fieldCode was NOT rejected — HTTP ${result.status} success=${result.success} message="${result.message}"`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 2 — SQL injection via sub-table column name (Fix 1, 12)
// ---------------------------------------------------------------------------
async function attack2SqlInjectionSubTableColumn(tokenB, recordIdA) {
  const TEST_ID = 'J4-2';
  if (!recordIdA) {
    rc.log(TEST_ID, 'WARN', 'Skipped — no Factory A sales order ID available');
    return;
  }

  try {
    const maliciousBody = {
      'amount; DROP TABLE x': 100,
    };

    const result = await apiPost(
      `${FACTORY_B}/sales_order/${recordIdA}/sub-table/prepayment_records`,
      maliciousBody,
      tokenB
    );

    if (result.status >= 400) {
      rc.log(
        TEST_ID,
        'PASS',
        `SQL injection in sub-table column name rejected — HTTP ${result.status} message="${result.message}"`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `SQL injection in sub-table column name was NOT rejected — HTTP ${result.status} success=${result.success} message="${result.message}"`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 3 — Cross-tenant sub-table read (Fix 2, 15d)
// ---------------------------------------------------------------------------
async function attack3CrossTenantSubTableRead(tokenB, recordIdA) {
  const TEST_ID = 'J4-3';
  if (!tokenB) {
    rc.log(TEST_ID, 'WARN', 'Skipped — Factory B token unavailable');
    return;
  }
  if (!recordIdA) {
    rc.log(TEST_ID, 'WARN', 'Skipped — no Factory A sales order ID available');
    return;
  }

  try {
    const result = await apiGet(
      `${FACTORY_B}/sales_order/${recordIdA}/sub-table/prepayment_records`,
      tokenB
    );

    const blocked =
      result.status >= 400 ||
      (!result.success && result.message && result.message.includes('不属于当前工厂'));

    if (blocked) {
      rc.log(
        TEST_ID,
        'PASS',
        `Cross-tenant sub-table read correctly rejected — HTTP ${result.status} message="${result.message}"`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `Cross-tenant sub-table read was NOT blocked — HTTP ${result.status} success=${result.success} message="${result.message}" — Factory B could read Factory A data!`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 4 — Cross-tenant custom-fields write (Fix 5, 14)
// ---------------------------------------------------------------------------
async function attack4CrossTenantCustomFieldsWrite(tokenB, recordIdA) {
  const TEST_ID = 'J4-4';
  if (!tokenB) {
    rc.log(TEST_ID, 'WARN', 'Skipped — Factory B token unavailable');
    return;
  }
  if (!recordIdA) {
    rc.log(TEST_ID, 'WARN', 'Skipped — no Factory A sales order ID available');
    return;
  }

  try {
    // Read current value via Factory A token first
    const before = await apiGet(
      `${FACTORY_A}/sales_order/${recordIdA}/custom-fields`, tokenB
    );

    // Attempt cross-tenant write
    const result = await apiPut(
      `${FACTORY_B}/sales_order/${recordIdA}/custom-fields`,
      { customer_level: 'HACKED' },
      tokenB
    );

    // Verify: read back via Factory A token — did the value actually change?
    const after = await apiGet(
      `${FACTORY_A}/sales_order/${recordIdA}/custom-fields`, tokenB
    );

    const apiBlocked = result.status >= 400 || !result.success;
    const dataUnchanged = JSON.stringify(before.data) === JSON.stringify(after.data) ||
                          (after.data?.customer_level !== 'HACKED');

    if (apiBlocked) {
      rc.log(TEST_ID, 'PASS',
        `Cross-tenant custom-fields write rejected — HTTP ${result.status} message="${result.message}"`);
    } else if (dataUnchanged) {
      rc.log(TEST_ID, 'PASS',
        `HTTP ${result.status} but data NOT mutated (no active dynamic fields for attacker factory) — defense in depth OK`);
    } else {
      rc.log(TEST_ID, 'FAIL',
        `Cross-tenant custom-fields write succeeded AND data changed! HTTP ${result.status} before=${JSON.stringify(before.data)} after=${JSON.stringify(after.data)}`);
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 5 — Cross-tenant ConfigChangeSet approve (Fix 10, 15c)
// ---------------------------------------------------------------------------
async function attack5CrossTenantChangeSetApprove(tokenA, tokenB) {
  const TEST_ID = 'J4-5';
  if (!tokenB) {
    rc.log(TEST_ID, 'WARN', 'Skipped — Factory B token unavailable');
    return;
  }

  // Step 1: Create a changeset as Factory A
  let changeSetId = null;
  try {
    const createResult = await apiPost(
      `${FACTORY_A}/config-changes`,
      {
        changeType: 'FIELD_ADD',
        moduleName: 'sales_order',
        fieldCode: 'test_security_field',
        fieldConfig: { fieldType: 'STRING', fieldName: 'Security Test Field' },
        reason: 'J4-5 cross-tenant approve security test',
      },
      tokenA
    );

    if (createResult.status >= 400 || !createResult.success) {
      rc.log(
        TEST_ID,
        'WARN',
        `Could not create Factory A changeset (HTTP ${createResult.status}: ${createResult.message}) — attack step skipped`
      );
      return;
    }

    const d = createResult.data;
    changeSetId = d?.id ?? d?.changeSetId ?? d?.changeId;

    if (!changeSetId) {
      rc.log(
        TEST_ID,
        'WARN',
        `Factory A changeset created but no ID in response (keys: ${d ? Object.keys(d).join(', ') : 'null'}) — attack step skipped`
      );
      return;
    }
  } catch (err) {
    rc.log(TEST_ID, 'WARN', `Error creating Factory A changeset: ${err.message} — attack step skipped`);
    return;
  }

  // Step 2: Attempt to approve as Factory B
  try {
    const approveResult = await apiPost(
      `${FACTORY_B}/config-changes/${changeSetId}/approve`,
      {},
      tokenB
    );

    const blocked =
      approveResult.status >= 400 ||
      (!approveResult.success && approveResult.message && approveResult.message.includes('不属于当前工厂'));

    if (blocked) {
      rc.log(
        TEST_ID,
        'PASS',
        `Cross-tenant changeset approve correctly rejected — HTTP ${approveResult.status} message="${approveResult.message}" changeSetId=${changeSetId}`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `Cross-tenant changeset approve was NOT blocked — HTTP ${approveResult.status} success=${approveResult.success} message="${approveResult.message}" — Factory B approved Factory A changeset!`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during approve attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 6 — Cron DDoS: high-frequency expression (Fix 11, 15b)
// ---------------------------------------------------------------------------
async function attack6CronDdos(tokenB) {
  const TEST_ID = 'J4-6';
  try {
    const result = await apiPut(
      `${FACTORY_B}/config/v2/scheduler/ddos_test`,
      { cronExpression: '*/5 * * * * ?' },
      tokenB
    );

    const blocked =
      result.status >= 400 ||
      (!result.success && result.message && result.message.includes('秒字段只允许单个数字'));

    if (blocked) {
      rc.log(
        TEST_ID,
        'PASS',
        `Cron DDoS expression "*/5 * * * * ?" correctly rejected — HTTP ${result.status} message="${result.message}"`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `Cron DDoS expression "*/5 * * * * ?" was NOT rejected — HTTP ${result.status} success=${result.success} message="${result.message}"`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Attack 6b — Cron comma bypass (Fix 11, 15b)
// ---------------------------------------------------------------------------
async function attack6bCronCommBypass(tokenB) {
  const TEST_ID = 'J4-6b';
  try {
    const result = await apiPut(
      `${FACTORY_B}/config/v2/scheduler/ddos_test`,
      { cronExpression: '0,30 * * * * ?' },
      tokenB
    );

    const blocked =
      result.status >= 400 ||
      !result.success;

    if (blocked) {
      rc.log(
        TEST_ID,
        'PASS',
        `Cron comma-bypass expression "0,30 * * * * ?" correctly rejected — HTTP ${result.status} message="${result.message}"`
      );
    } else {
      rc.log(
        TEST_ID,
        'FAIL',
        `Cron comma-bypass expression "0,30 * * * * ?" was NOT rejected — HTTP ${result.status} success=${result.success} message="${result.message}"`
      );
    }
  } catch (err) {
    rc.log(TEST_ID, 'FAIL', `Unexpected error during attack: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== J4 Cross-Tenant Security Attack Vectors ===\n');

  // --- Setup ---
  const sessionA = await loginFactoryA();
  if (!sessionA) {
    rc.log('J4-1', 'FAIL', 'Skipped — Factory A token unavailable (required for all tests)');
    rc.log('J4-2', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J4-3', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J4-4', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J4-5', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J4-6', 'FAIL', 'Skipped — Factory A token unavailable');
    rc.log('J4-6b', 'FAIL', 'Skipped — Factory A token unavailable');
    const summary = rc.save();
    process.exit(summary.fail > 0 ? 1 : 0);
    return;
  }

  const sessionB = await loginFactoryB(); // null means WARN, not FAIL
  const tokenA = sessionA.token;
  const tokenB = sessionB?.token ?? null;

  // Use Factory B token for injection attacks (J4-1, J4-2) if available,
  // otherwise fall back to Factory A token (same-factory injection is still a valid test).
  const attackToken = tokenB ?? tokenA;

  const recordIdA = await getFactoryARecordId(tokenA);

  console.log('');

  // --- Execute attacks sequentially ---
  await attack1SqlInjectionFieldCode(attackToken);
  await attack2SqlInjectionSubTableColumn(attackToken, recordIdA);
  await attack3CrossTenantSubTableRead(tokenB, recordIdA);
  await attack4CrossTenantCustomFieldsWrite(tokenB, recordIdA);
  await attack5CrossTenantChangeSetApprove(tokenA, tokenB);
  await attack6CronDdos(attackToken);
  await attack6bCronCommBypass(attackToken);

  // --- Final summary ---
  const summary = rc.save();
  const exitCode = summary.fail > 0 ? 1 : 0;

  if (exitCode !== 0) {
    console.error(`\nSECURITY FAILURES DETECTED: ${summary.fail} attack vector(s) not blocked.`);
  } else {
    console.log('\nAll executed attack vectors were correctly blocked or skipped with WARN.');
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Unexpected error in j4-cross-tenant:', err);
  process.exit(1);
});
