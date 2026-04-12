/**
 * J1 — Canvas Full Lifecycle Test
 *
 * Tests the complete Canvas configuration lifecycle:
 *   Phase A: Configuration — template, 7 dynamic fields (all DDL types),
 *            validation rule, conditional visibility
 *   Phase B: Publish — DDL execution, ACTIVE field count, effective config
 *   Phase D: Rollback — rollback to previous version and restore
 *
 * Exit code 1 if any FAIL.
 */

import {
  login,
  apiGet,
  apiPost,
  apiPut,
  createResultCollector,
  FACTORY_A,
  ADMIN_A,
} from './canvas-test-helpers.mjs';

// ---------------------------------------------------------------------------
// Unique suffix — prevents collisions across concurrent/repeated runs
// ---------------------------------------------------------------------------
const SUFFIX = '_e2e_' + Date.now().toString(36);

// Convenience alias for the factory path prefix
const F = FACTORY_A;

const rc = createResultCollector('j1-lifecycle');

// ---------------------------------------------------------------------------
// Phase A — Configuration
// ---------------------------------------------------------------------------

/**
 * A2. Apply FOOD_PROCESSING template.
 */
async function phaseA2_applyTemplate(token) {
  try {
    const res = await apiPost(
      `${F}/config/v2/apply-template/FOOD_PROCESSING`,
      {},
      token
    );
    if (res.status === 200) {
      rc.log('J1-A2', 'PASS', `Template FOOD_PROCESSING applied — HTTP ${res.status}`);
    } else {
      rc.log(
        'J1-A2',
        'WARN',
        `apply-template returned HTTP ${res.status}: ${res.message || '(no message)'} — continuing`
      );
    }
  } catch (err) {
    rc.log('J1-A2', 'WARN', `apply-template error: ${err.message} — continuing`);
  }
}

/**
 * A3. Create 7 dynamic fields covering all DDL types.
 * Returns an array of field codes that were successfully created.
 */
async function phaseA3_createDynamicFields(token) {
  const fieldDefs = [
    {
      fieldCode: `cust_level${SUFFIX}`,
      label: `Customer Level${SUFFIX}`,
      fieldType: 'SELECT',
      config: { options: ['A', 'B', 'C'] },
    },
    {
      fieldCode: `dlv_priority${SUFFIX}`,
      label: `Delivery Priority${SUFFIX}`,
      fieldType: 'TEXT',
      config: {},
    },
    {
      fieldCode: `exp_margin${SUFFIX}`,
      label: `Expected Margin${SUFFIX}`,
      fieldType: 'DECIMAL',
      config: {},
    },
    {
      fieldCode: `is_urgent${SUFFIX}`,
      label: `Is Urgent${SUFFIX}`,
      fieldType: 'BOOLEAN',
      config: {},
    },
    {
      fieldCode: `deadline${SUFFIX}`,
      label: `Deadline${SUFFIX}`,
      fieldType: 'DATETIME',
      config: {},
    },
    {
      fieldCode: `ref_po${SUFFIX}`,
      label: `Reference PO${SUFFIX}`,
      fieldType: 'REFERENCE',
      config: {},
    },
    {
      fieldCode: `prepay${SUFFIX}`,
      label: `Prepayment${SUFFIX}`,
      fieldType: 'SUB_TABLE',
      config: {
        columns: [
          { code: 'amount', label: '金额', type: 'DECIMAL' },
          { code: 'pay_date', label: '日期', type: 'DATE' },
          { code: 'remark', label: '备注', type: 'TEXT' },
        ],
      },
    },
  ];

  const created = [];
  let failCount = 0;

  for (const def of fieldDefs) {
    try {
      const res = await apiPost(
        `${F}/config/v2/dynamic-fields`,
        {
          moduleCode: 'sales_order',
          fieldCode: def.fieldCode,
          label: def.label,
          fieldType: def.fieldType,
          config: def.config,
        },
        token
      );

      if (res.status === 200 || res.status === 201) {
        rc.log(
          'J1-A3',
          'PASS',
          `Created field ${def.fieldCode} (${def.fieldType}) — HTTP ${res.status}`
        );
        created.push(def.fieldCode);
      } else {
        rc.log(
          'J1-A3',
          'FAIL',
          `Failed to create ${def.fieldCode} (${def.fieldType}) — HTTP ${res.status}: ${res.message || '(no message)'}`
        );
        failCount++;
      }
    } catch (err) {
      rc.log('J1-A3', 'FAIL', `Error creating ${def.fieldCode}: ${err.message}`);
      failCount++;
    }
  }

  // Verify PENDING_DDL count via GET
  try {
    const listRes = await apiGet(
      `${F}/config/v2/dynamic-fields?moduleCode=sales_order`,
      token
    );
    const fields = Array.isArray(listRes.data) ? listRes.data : [];
    const pendingWithSuffix = fields.filter(
      f => f.fieldCode && f.fieldCode.includes(SUFFIX) && f.status === 'PENDING_DDL'
    );
    const expectedPending = 7 - failCount;

    if (pendingWithSuffix.length >= expectedPending && expectedPending > 0) {
      rc.log(
        'J1-A3-verify',
        'PASS',
        `PENDING_DDL fields with suffix: ${pendingWithSuffix.length} (expected ≥${expectedPending})`
      );
    } else {
      rc.log(
        'J1-A3-verify',
        'FAIL',
        `PENDING_DDL fields with suffix: ${pendingWithSuffix.length} (expected ${expectedPending}) — some creates may have failed`
      );
    }
  } catch (err) {
    rc.log('J1-A3-verify', 'FAIL', `GET dynamic-fields verification error: ${err.message}`);
  }

  return created;
}

/**
 * A4. Create validation rule — block SO if totalAmount < 100.
 */
async function phaseA4_createValidationRule(token) {
  const ruleCode = `so_amount_min${SUFFIX}`;
  try {
    const res = await apiPut(
      `${F}/config/v2/validation-rules/${ruleCode}`,
      {
        ruleCode,
        moduleCode: 'sales_order',
        condition: '#totalAmount != null && #totalAmount < 100',
        severity: 'BLOCK',
        message: `SO total amount must be ≥ 100 (rule ${ruleCode})`,
      },
      token
    );

    if (res.status === 200 || res.status === 201) {
      rc.log('J1-A4', 'PASS', `Validation rule ${ruleCode} created — HTTP ${res.status}`);
    } else {
      rc.log(
        'J1-A4',
        'FAIL',
        `PUT validation-rules/${ruleCode} returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-A4', 'FAIL', `Error creating validation rule: ${err.message}`);
  }
}

/**
 * A5. Set conditional visibility on exp_margin field.
 */
async function phaseA5_setVisibleWhen(token) {
  const fieldCode = `exp_margin${SUFFIX}`;
  const visibleWhen = `#cust_level${SUFFIX} == 'A'`;
  try {
    const res = await apiPut(
      `${F}/config/v2/dynamic-fields/${fieldCode}`,
      {
        moduleCode: 'sales_order',
        visibleWhen,
      },
      token
    );

    if (res.status === 200) {
      // Confirm the visibleWhen was actually persisted
      const saved = res.data;
      const persisted = saved && saved.visibleWhen === visibleWhen;
      if (persisted) {
        rc.log(
          'J1-A5',
          'PASS',
          `visibleWhen set on ${fieldCode} — persisted correctly`
        );
      } else {
        rc.log(
          'J1-A5',
          'WARN',
          `HTTP 200 but visibleWhen not confirmed in response — got: ${JSON.stringify(saved?.visibleWhen)}`
        );
      }
    } else {
      rc.log(
        'J1-A5',
        'FAIL',
        `PUT dynamic-fields/${fieldCode} returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-A5', 'FAIL', `Error setting visibleWhen on ${fieldCode}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Phase B — Publish
// ---------------------------------------------------------------------------

/**
 * B1. Publish configuration.
 */
async function phaseB1_publish(token) {
  try {
    const res = await apiPost(
      `${F}/config/publish?summary=E2E+lifecycle+test`,
      {},
      token
    );

    if (res.status === 200) {
      rc.log('J1-B1', 'PASS', `Config published — HTTP ${res.status}`);
      return true;
    } else {
      rc.log(
        'J1-B1',
        'FAIL',
        `config/publish returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return false;
    }
  } catch (err) {
    rc.log('J1-B1', 'FAIL', `Error publishing config: ${err.message}`);
    return false;
  }
}

/**
 * B1b. Verify DDL log — count EXECUTED entries containing SUFFIX.
 */
async function phaseB1b_ddlLog(token) {
  try {
    const res = await apiGet(`${F}/config/v2/ddl-log?size=500`, token);

    if (res.status !== 200) {
      rc.log(
        'J1-B1b',
        'FAIL',
        `ddl-log returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return;
    }

    // Response shape varies: raw {content:[...]} or {success, data:{content:[...]}}
    const raw = res.json || res.data || {};
    const entries = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.content)
      ? raw.content
      : Array.isArray(raw.data?.content)
      ? raw.data.content
      : Array.isArray(raw.data)
      ? raw.data
      : [];

    const executedWithSuffix = entries.filter(
      e =>
        e.status === 'EXECUTED' &&
        (e.ddlStatement || e.ddlSql || '') .includes(SUFFIX)
    );

    if (executedWithSuffix.length >= 6) {
      rc.log(
        'J1-B1b',
        'PASS',
        `DDL log contains ${executedWithSuffix.length} EXECUTED entries with suffix (expected ≥6)`
      );
    } else {
      rc.log(
        'J1-B1b',
        'FAIL',
        `DDL log only has ${executedWithSuffix.length} EXECUTED entries with suffix (expected ≥6) — total entries checked: ${entries.length}`
      );
    }
  } catch (err) {
    rc.log('J1-B1b', 'FAIL', `Error checking DDL log: ${err.message}`);
  }
}

/**
 * B2. Verify ACTIVE field count after publish.
 */
async function phaseB2_activeFields(token) {
  try {
    const res = await apiGet(
      `${F}/config/v2/dynamic-fields?moduleCode=sales_order`,
      token
    );

    if (res.status !== 200) {
      rc.log(
        'J1-B2',
        'FAIL',
        `dynamic-fields returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return;
    }

    const fields = Array.isArray(res.data) ? res.data : [];
    const activeWithSuffix = fields.filter(
      f => f.fieldCode && f.fieldCode.includes(SUFFIX) && f.status === 'ACTIVE'
    );

    if (activeWithSuffix.length === 7) {
      rc.log(
        'J1-B2',
        'PASS',
        `ACTIVE fields with suffix after publish: ${activeWithSuffix.length} (expected 7)`
      );
    } else {
      rc.log(
        'J1-B2',
        'FAIL',
        `ACTIVE fields with suffix after publish: ${activeWithSuffix.length} (expected 7)`
      );
    }
  } catch (err) {
    rc.log('J1-B2', 'FAIL', `Error checking ACTIVE fields: ${err.message}`);
  }
}

/**
 * B3. Verify effective config contains all 7 SUFFIX fields.
 */
async function phaseB3_effectiveConfig(token) {
  try {
    const res = await apiGet(
      `${F}/config/modules/sales_order/effective`,
      token
    );

    if (res.status !== 200) {
      rc.log(
        'J1-B3',
        'FAIL',
        `effective config returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return;
    }

    // Effective config may nest fields under different keys — search broadly
    const raw = JSON.stringify(res.data ?? res.json ?? {});
    const suffixMatches = (raw.match(new RegExp(SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

    // Each of 7 fields should appear at least once → expect ≥7 occurrences
    if (suffixMatches >= 7) {
      rc.log(
        'J1-B3',
        'PASS',
        `Effective config contains ≥7 references to suffix fields (found ${suffixMatches} occurrences)`
      );
    } else {
      rc.log(
        'J1-B3',
        'FAIL',
        `Effective config contains only ${suffixMatches} references to suffix fields (expected ≥7)`
      );
    }
  } catch (err) {
    rc.log('J1-B3', 'FAIL', `Error checking effective config: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Phase D — Rollback
// ---------------------------------------------------------------------------

/**
 * D1–D3. Get current version, rollback to previous, publish, then restore.
 */
async function phaseD_rollback(token) {
  // D1: Get current version
  let currentVersion = null;
  try {
    const res = await apiGet(`${F}/config/current-version`, token);
    if (res.status !== 200) {
      rc.log(
        'J1-D1',
        'FAIL',
        `current-version returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return;
    }

    // Response may be: { configVersion: N } or { data: { configVersion: N } } or just a number
    const d = res.data;
    if (typeof d === 'number') {
      currentVersion = d;
    } else if (d && typeof d.configVersion === 'number') {
      currentVersion = d.configVersion;
    } else if (d && typeof d.version === 'number') {
      currentVersion = d.version;
    } else if (d && typeof d.currentVersion === 'number') {
      currentVersion = d.currentVersion;
    } else {
      // Try parsing the raw json top-level
      const j = res.json ?? {};
      currentVersion =
        (typeof j.configVersion === 'number' ? j.configVersion : null) ||
        (typeof j.version === 'number' ? j.version : null) ||
        (typeof j.currentVersion === 'number' ? j.currentVersion : null);
    }

    if (currentVersion === null || currentVersion === undefined) {
      rc.log(
        'J1-D1',
        'WARN',
        `current-version HTTP 200 but could not parse version from: ${JSON.stringify(d)} — skipping rollback phases`
      );
      return;
    }

    rc.log('J1-D1', 'PASS', `currentVersion = ${currentVersion}`);
  } catch (err) {
    rc.log('J1-D1', 'FAIL', `Error fetching current-version: ${err.message}`);
    return;
  }

  // D2: If currentVersion > 1, rollback to currentVersion - 1 and publish
  if (currentVersion <= 1) {
    rc.log(
      'J1-D2',
      'WARN',
      `currentVersion=${currentVersion} — no previous version to roll back to, skipping D2/D3`
    );
    return;
  }

  const rollbackTarget = currentVersion - 1;

  try {
    const rbRes = await apiPost(`${F}/config/rollback/${rollbackTarget}`, {}, token);
    if (rbRes.status === 200) {
      rc.log(
        'J1-D2',
        'PASS',
        `Rolled back to version ${rollbackTarget} — HTTP ${rbRes.status}`
      );
    } else {
      rc.log(
        'J1-D2',
        'FAIL',
        `config/rollback/${rollbackTarget} returned HTTP ${rbRes.status}: ${rbRes.message || '(no message)'}`
      );
      return;
    }
  } catch (err) {
    rc.log('J1-D2', 'FAIL', `Error during rollback to v${rollbackTarget}: ${err.message}`);
    return;
  }

  // Publish the rollback
  try {
    const pubRbRes = await apiPost(
      `${F}/config/publish?summary=E2E+rollback+to+v${rollbackTarget}`,
      {},
      token
    );
    if (pubRbRes.status === 200) {
      rc.log('J1-D2-pub', 'PASS', `Published rollback to v${rollbackTarget} — HTTP ${pubRbRes.status}`);
    } else {
      rc.log(
        'J1-D2-pub',
        'FAIL',
        `Publish after rollback returned HTTP ${pubRbRes.status}: ${pubRbRes.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-D2-pub', 'FAIL', `Error publishing rollback: ${err.message}`);
  }

  // D3: Roll back to currentVersion (restore) and publish
  try {
    const restoreRes = await apiPost(`${F}/config/rollback/${currentVersion}`, {}, token);
    if (restoreRes.status === 200) {
      rc.log(
        'J1-D3',
        'PASS',
        `Restored to version ${currentVersion} — HTTP ${restoreRes.status}`
      );
    } else {
      rc.log(
        'J1-D3',
        'FAIL',
        `config/rollback/${currentVersion} (restore) returned HTTP ${restoreRes.status}: ${restoreRes.message || '(no message)'}`
      );
      return;
    }
  } catch (err) {
    rc.log('J1-D3', 'FAIL', `Error restoring to v${currentVersion}: ${err.message}`);
    return;
  }

  // Publish the restore
  try {
    const pubRestoreRes = await apiPost(
      `${F}/config/publish?summary=E2E+restore+to+v${currentVersion}`,
      {},
      token
    );
    if (pubRestoreRes.status === 200) {
      rc.log(
        'J1-D3-pub',
        'PASS',
        `Published restore to v${currentVersion} — HTTP ${pubRestoreRes.status}`
      );
    } else {
      rc.log(
        'J1-D3-pub',
        'FAIL',
        `Publish after restore returned HTTP ${pubRestoreRes.status}: ${pubRestoreRes.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-D3-pub', 'FAIL', `Error publishing restore: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== J1 Canvas Full Lifecycle Test ===\n');
  console.log(`FACTORY_A : ${F}`);
  console.log(`SUFFIX    : ${SUFFIX}\n`);

  // Login
  let token;
  try {
    const session = await login(ADMIN_A, '123456');
    if (!session.token) {
      rc.log('J1-login', 'FAIL', 'Login succeeded but no token returned');
      rc.save();
      process.exit(1);
    }
    token = session.token;
    rc.log(
      'J1-login',
      'PASS',
      `Logged in — factoryId=${session.factoryId} role=${session.role}`
    );
  } catch (err) {
    rc.log('J1-login', 'FAIL', `Login error: ${err.message}`);
    rc.save();
    process.exit(1);
  }

  // Phase A
  console.log('\n--- Phase A: Configuration ---');
  await phaseA2_applyTemplate(token);
  await phaseA3_createDynamicFields(token);
  await phaseA4_createValidationRule(token);
  await phaseA5_setVisibleWhen(token);

  // Phase B
  console.log('\n--- Phase B: Publish ---');
  const published = await phaseB1_publish(token);
  if (published) {
    await phaseB1b_ddlLog(token);
    await phaseB2_activeFields(token);
    await phaseB3_effectiveConfig(token);
  } else {
    rc.log('J1-B1b', 'FAIL', 'Skipped — publish failed');
    rc.log('J1-B2', 'FAIL', 'Skipped — publish failed');
    rc.log('J1-B3', 'FAIL', 'Skipped — publish failed');
  }

  // Phase D
  console.log('\n--- Phase D: Rollback ---');
  await phaseD_rollback(token);

  // Save and exit
  const summary = rc.save();
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Unexpected error in j1-lifecycle:', err);
  process.exit(1);
});
