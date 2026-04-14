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
  apiCall,
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
 * B0. Verify audit trail — applyTemplate records operatorId != 0 [Fix 7].
 */
async function phaseB0_auditCheck(token) {
  try {
    // config_change_log stores all config operations including template apply
    const res = await apiGet(`${F}/config/current-version`, token);
    const version = res.data?.configVersion ?? res.json?.configVersion;
    if (version) {
      // The publish we just did should have a non-null publishedBy
      const pubBy = res.data?.publishedBy ?? res.json?.publishedBy;
      if (pubBy && pubBy !== 0) {
        rc.log('J1-B0', 'PASS', `publishedBy=${pubBy} (non-zero, Fix 7 audit OK)`);
      } else if (pubBy === 0 || pubBy === null) {
        rc.log('J1-B0', 'FAIL', `publishedBy=${pubBy} — Fix 7 operatorId not recorded`);
      } else {
        rc.log('J1-B0', 'WARN', `publishedBy field not in response — cannot verify Fix 7`);
      }
    } else {
      rc.log('J1-B0', 'WARN', `current-version has no configVersion — cannot verify audit`);
    }
  } catch (err) {
    rc.log('J1-B0', 'FAIL', `Audit check error: ${err.message}`);
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
/**
 * Phase C — Canvas module toggle E2E (R1 addition from agent-team audit).
 *
 * Verifies the PATCH /config/modules/{moduleCode}/toggle endpoint lifecycle.
 * Actual testIds logged (matching implementation):
 *   J1-C1-disable         — PATCH toggle enabled=false → HTTP 200
 *   J1-C2-publish         — Publish the DRAFT that contains the toggle change
 *   J1-C3-verify-disabled — GET /effective → data.enabled === false
 *   J1-C4-restore         — PATCH toggle enabled=true (restore original state)
 *   J1-C5-verify-restored — GET /effective → data.enabled === true
 *
 * This closes the "Canvas 模块启停 0% E2E 覆盖" gap identified by
 * the agent-team audit (2026-04-13_canvas-e2e-r1-audit.md).
 */
async function phaseC_moduleToggle(token) {
  // Must be a module registered in module_schemas table.
  // Verified seed list (V20260410_08+): sales_order, purchase_order, bom,
  // production_plan, production_report, quality_inspection, inventory,
  // equipment, customer, supplier, transfer, invoice_record, material_batch,
  // hr_employee, product, traceability, finance_ar, finance_ap.
  // Pick `traceability` — low dependency, unlikely to conflict with J1 Phase A/B test data.
  const TARGET_MODULE = 'traceability';

  // C1: Get current state so we can restore correctly
  let originalEnabled = true;
  try {
    const res = await apiGet(`${F}/config/modules/${TARGET_MODULE}/effective`, token);
    if (res.status === 200 && res.data) {
      originalEnabled = res.data.enabled !== false;
    }
  } catch { /* proceed with default */ }

  // C2: Disable module (endpoint is @PatchMapping)
  try {
    const disableRes = await apiCall('PATCH',
      `${F}/config/modules/${TARGET_MODULE}/toggle?enabled=false`, null, token
    );
    if (disableRes.status === 200) {
      rc.log('J1-C1-disable', 'PASS',
        `PATCH toggle disable ${TARGET_MODULE} — HTTP 200`);
    } else {
      rc.log('J1-C1-disable', 'FAIL',
        `PATCH toggle disable returned HTTP ${disableRes.status}: ${disableRes.message || '(no msg)'}`);
      return;
    }
  } catch (err) {
    rc.log('J1-C1-disable', 'FAIL', `Disable request error: ${err.message}`);
    return;
  }

  // C3: Publish so the toggle takes effect (DRAFT → PUBLISHED)
  try {
    const pub = await apiPost(`${F}/config/publish?summary=J1-C+module+toggle+test`, null, token);
    if (pub.status !== 200) {
      rc.log('J1-C2-publish', 'WARN',
        `Publish after disable returned HTTP ${pub.status}: ${pub.message || '(no msg)'} — toggle may not be active yet`);
    } else {
      rc.log('J1-C2-publish', 'PASS', `Toggle change published — HTTP 200`);
    }
  } catch (err) {
    rc.log('J1-C2-publish', 'WARN', `Publish error: ${err.message}`);
  }

  // C4: Verify effective config reflects disabled state
  try {
    const verifyRes = await apiGet(`${F}/config/modules/${TARGET_MODULE}/effective`, token);
    const enabledAfter = verifyRes.data?.enabled;
    if (verifyRes.status === 200 && enabledAfter === false) {
      rc.log('J1-C3-verify-disabled', 'PASS',
        `effective config enabled=false after toggle`);
    } else {
      rc.log('J1-C3-verify-disabled', 'FAIL',
        `Expected enabled=false, got ${enabledAfter} (HTTP ${verifyRes.status})`);
    }
  } catch (err) {
    rc.log('J1-C3-verify-disabled', 'FAIL', `Verify disable error: ${err.message}`);
  }

  // C4: Re-enable to restore original state (endpoint is @PatchMapping)
  let restored = false;
  try {
    const enableRes = await apiCall('PATCH',
      `${F}/config/modules/${TARGET_MODULE}/toggle?enabled=${originalEnabled}`, null, token
    );
    if (enableRes.status === 200) {
      rc.log('J1-C4-restore', 'PASS',
        `PATCH toggle restore ${TARGET_MODULE} to enabled=${originalEnabled} — HTTP 200`);
      restored = true;
    } else {
      rc.log('J1-C4-restore', 'FAIL',
        `PATCH toggle restore returned HTTP ${enableRes.status}: ${enableRes.message || '(no msg)'}`);
    }
    // Publish the restore (check result — leaving module in DRAFT-disabled pollutes later runs)
    const restorePub = await apiPost(`${F}/config/publish?summary=J1-C+toggle+restore`, null, token);
    if (restorePub.status !== 200 && restored) {
      rc.log('J1-C4-restore', 'WARN',
        `Restore PATCH was 200 but restore publish returned HTTP ${restorePub.status}: ${restorePub.message || '(no msg)'} — module may remain in DRAFT state`);
    }
  } catch (err) {
    rc.log('J1-C4-restore', 'FAIL', `Restore request error: ${err.message}`);
    restored = false;
  }

  // C5: Verify effective config reflects restored state
  if (restored) {
    try {
      const verifyRes = await apiGet(`${F}/config/modules/${TARGET_MODULE}/effective`, token);
      const enabledAfter = verifyRes.data?.enabled;
      if (verifyRes.status === 200 && enabledAfter === originalEnabled) {
        rc.log('J1-C5-verify-restored', 'PASS',
          `effective config enabled=${originalEnabled} confirmed after restore`);
      } else {
        rc.log('J1-C5-verify-restored', 'FAIL',
          `Expected enabled=${originalEnabled}, got ${enabledAfter} (HTTP ${verifyRes.status})`);
      }
    } catch (err) {
      rc.log('J1-C5-verify-restored', 'FAIL', `Verify restore error: ${err.message}`);
    }
  }
}

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
// Phase E — Custom field roundtrip (deep positive-path test)
// ---------------------------------------------------------------------------
//
// R3 P0-4 (depth-first-e2e skill Rule 2): this round MUST include at least
// one `depth: deep` test. Prior rounds only tested the negative path (J4-4
// cross-tenant rejection), never the positive path (same-factory legit write
// roundtrip). That gap meant R3's backend fix (verifyParentOwnership on
// setCustomFields/getCustomFields) could have silently broken legitimate
// writes and no test would catch it.
//
// This phase is a deep positive-path test satisfying all 5 deep criteria:
//   1. Real API write (PUT) with real field value
//   2. Real API read (GET) before AND after the write
//   3. Response status check (not just try/catch)
//   4. State mutation verification (before != after, new value present)
//   5. Cleanup (restore original value to avoid polluting subsequent runs)
//
// depth: deep — if backend returns 500 or data doesn't mutate, test FAILs.
async function phaseE_customFieldRoundtrip(token) {
  // Discover a sales order record in Factory A
  let recordId = null;
  try {
    const listRes = await apiGet(`${F}/sales/orders?page=1&size=1`, token);
    if (listRes.status !== 200) {
      rc.log(
        'J1-E0',
        'WARN',
        `[depth=deep] Cannot list Factory A sales orders — HTTP ${listRes.status}. Skipping Phase E.`
      );
      return;
    }
    const d = listRes.data;
    const records =
      (Array.isArray(d) && d) ||
      (d && Array.isArray(d.content) && d.content) ||
      (d && Array.isArray(d.records) && d.records) ||
      (d && Array.isArray(d.list) && d.list) ||
      [];
    if (records.length === 0) {
      rc.log(
        'J1-E0',
        'WARN',
        '[depth=deep] Factory A has no sales orders to test against — skipping Phase E'
      );
      return;
    }
    recordId = records[0].id ?? records[0].orderId ?? records[0].recordId;
    if (!recordId) {
      rc.log(
        'J1-E0',
        'WARN',
        `[depth=deep] Cannot extract record ID (keys: ${Object.keys(records[0]).join(', ')}) — skipping`
      );
      return;
    }
    rc.log('J1-E0', 'PASS', `[depth=deep] Located Factory A record ${recordId} for roundtrip`);
  } catch (err) {
    rc.log('J1-E0', 'FAIL', `[depth=deep] Setup error: ${err.message}`);
    return;
  }

  // Pick a unique test value so we can detect mutation unambiguously.
  // Use the TEXT field that phaseA3_createDynamicFields just created in this run
  // (same SUFFIX guarantees the field exists + is published in Phase B).
  // Do NOT use a hardcoded name like 'customer_level' — F002 has no such field,
  // and setDynamicFields silently drops unmatched fields at L237 (setClauses.isEmpty).
  const TEST_VALUE = `E2E_ROUNDTRIP_${SUFFIX}`;
  const FIELD_CODE = `dlv_priority${SUFFIX}`;

  // E1: Read original value (before)
  let originalValue = null;
  try {
    const before = await apiGet(
      `${F}/sales_order/${recordId}/custom-fields`,
      token
    );
    if (before.status !== 200) {
      rc.log(
        'J1-E1',
        'FAIL',
        `[depth=deep] GET custom-fields before write returned HTTP ${before.status}: ${before.message || '(no msg)'}`
      );
      return;
    }
    originalValue = before.data?.[FIELD_CODE] ?? null;
    rc.log(
      'J1-E1',
      'PASS',
      `[depth=deep] Pre-write GET HTTP 200, ${FIELD_CODE}=${JSON.stringify(originalValue)}`
    );
  } catch (err) {
    rc.log('J1-E1', 'FAIL', `[depth=deep] Pre-write GET error: ${err.message}`);
    return;
  }

  // E2+E3 wrapped in try/finally so cleanup is guaranteed to run on any path
  // that successfully mutated the DB, even if E3 fails or throws.
  let dbMutated = false;
  try {
    // E2: PUT the new value
    try {
      const put = await apiPut(
        `${F}/sales_order/${recordId}/custom-fields`,
        { [FIELD_CODE]: TEST_VALUE },
        token
      );
      if (put.status !== 200) {
        rc.log(
          'J1-E2',
          'FAIL',
          `[depth=deep] PUT returned HTTP ${put.status}: ${put.message || '(no msg)'} — ` +
          `R3 backend fix (verifyParentOwnership) may have incorrectly rejected a legitimate same-factory write`
        );
        return;
      }
      dbMutated = true; // write succeeded — cleanup is required
      rc.log(
        'J1-E2',
        'PASS',
        `[depth=deep] PUT custom-fields { ${FIELD_CODE}: ${TEST_VALUE} } → HTTP 200 success=${put.success}`
      );
    } catch (err) {
      rc.log('J1-E2', 'FAIL', `[depth=deep] PUT error: ${err.message}`);
      return;
    }

    // E3: Read back after write and verify mutation is visible
    try {
      const after = await apiGet(
        `${F}/sales_order/${recordId}/custom-fields`,
        token
      );
      if (after.status !== 200) {
        rc.log(
          'J1-E3',
          'FAIL',
          `[depth=deep] Post-write GET returned HTTP ${after.status}: ${after.message || '(no msg)'}`
        );
        return;
      }
      const actualValue = after.data?.[FIELD_CODE];
      if (actualValue === TEST_VALUE) {
        rc.log(
          'J1-E3',
          'PASS',
          `[depth=deep] Roundtrip verified — ${FIELD_CODE}=${actualValue} matches write. ` +
          `before=${JSON.stringify(originalValue)} after=${JSON.stringify(actualValue)}`
        );
      } else {
        rc.log(
          'J1-E3',
          'FAIL',
          `[depth=deep] Post-write read shows ${FIELD_CODE}=${JSON.stringify(actualValue)} ` +
          `but expected "${TEST_VALUE}" — write silently dropped or filtered`
        );
      }
    } catch (err) {
      rc.log('J1-E3', 'FAIL', `[depth=deep] Post-write GET error: ${err.message}`);
    }
  } finally {
    // E4: Cleanup — restore original value, always runs if the write mutated DB.
    // Best effort: failures are logged to stdout but don't affect test result.
    if (dbMutated) {
      try {
        const cleanup = await apiPut(
          `${F}/sales_order/${recordId}/custom-fields`,
          { [FIELD_CODE]: originalValue },
          token
        );
        if (cleanup.status === 200) {
          console.log(`  [J1-E cleanup] restored ${FIELD_CODE} to original value`);
        } else {
          console.log(`  [J1-E cleanup] WARNING: restore returned HTTP ${cleanup.status}, test record may be dirty`);
        }
      } catch (err) {
        console.log(`  [J1-E cleanup] WARNING: restore threw — ${err.message}, test record may be dirty`);
      }
    }
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
    await phaseB0_auditCheck(token);
    await phaseB1b_ddlLog(token);
    await phaseB2_activeFields(token);
    await phaseB3_effectiveConfig(token);
  } else {
    rc.log('J1-B1b', 'FAIL', 'Skipped — publish failed');
    rc.log('J1-B2', 'FAIL', 'Skipped — publish failed');
    rc.log('J1-B3', 'FAIL', 'Skipped — publish failed');
  }

  // Phase C — Module toggle E2E (R1 addition: close Canvas 模块启停 0% gap)
  console.log('\n--- Phase C: Module Toggle ---');
  await phaseC_moduleToggle(token);

  // Phase E — R3 P0-4: deep positive-path custom field roundtrip (depth-first-e2e Rule 2).
  // Runs BEFORE Phase D so phaseD_rollback's history mutations don't interfere
  // with the freshly-published dynamic field columns from Phase B.
  console.log('\n--- Phase E: Custom Field Roundtrip (deep) ---');
  await phaseE_customFieldRoundtrip(token);

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
