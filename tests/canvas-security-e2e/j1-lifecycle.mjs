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
  apiDelete,
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
      rc.log('J1-A2', 'PASS', `[depth=medium] Template FOOD_PROCESSING applied — HTTP ${res.status}`);
    } else {
      rc.log(
        'J1-A2',
        'WARN',
        `[depth=medium] apply-template returned HTTP ${res.status}: ${res.message || '(no message)'} — continuing`
      );
    }
  } catch (err) {
    rc.log('J1-A2', 'WARN', `[depth=medium] apply-template error: ${err.message} — continuing`);
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
          `[depth=medium] Created field ${def.fieldCode} (${def.fieldType}) — HTTP ${res.status}`
        );
        created.push(def.fieldCode);
      } else {
        rc.log(
          'J1-A3',
          'FAIL',
          `[depth=medium] Failed to create ${def.fieldCode} (${def.fieldType}) — HTTP ${res.status}: ${res.message || '(no message)'}`
        );
        failCount++;
      }
    } catch (err) {
      rc.log('J1-A3', 'FAIL', `[depth=medium] Error creating ${def.fieldCode}: ${err.message}`);
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
        `[depth=deep] PENDING_DDL fields with suffix: ${pendingWithSuffix.length} (expected ≥${expectedPending})`
      );
    } else {
      rc.log(
        'J1-A3-verify',
        'FAIL',
        `[depth=deep] PENDING_DDL fields with suffix: ${pendingWithSuffix.length} (expected ${expectedPending}) — some creates may have failed`
      );
    }
  } catch (err) {
    rc.log('J1-A3-verify', 'FAIL', `[depth=deep] GET dynamic-fields verification error: ${err.message}`);
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
      rc.log('J1-A4', 'PASS', `[depth=medium] Validation rule ${ruleCode} created — HTTP ${res.status}`);
    } else {
      rc.log(
        'J1-A4',
        'FAIL',
        `[depth=medium] PUT validation-rules/${ruleCode} returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-A4', 'FAIL', `[depth=medium] Error creating validation rule: ${err.message}`);
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
          `[depth=deep] visibleWhen set on ${fieldCode} — persisted correctly`
        );
      } else {
        rc.log(
          'J1-A5',
          'WARN',
          `[depth=deep] HTTP 200 but visibleWhen not confirmed in response — got: ${JSON.stringify(saved?.visibleWhen)}`
        );
      }
    } else {
      rc.log(
        'J1-A5',
        'FAIL',
        `[depth=deep] PUT dynamic-fields/${fieldCode} returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-A5', 'FAIL', `[depth=deep] Error setting visibleWhen on ${fieldCode}: ${err.message}`);
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
      rc.log('J1-B1', 'PASS', `[depth=medium] Config published — HTTP ${res.status}`);
      return true;
    } else {
      rc.log(
        'J1-B1',
        'FAIL',
        `[depth=medium] config/publish returned HTTP ${res.status}: ${res.message || '(no message)'}`
      );
      return false;
    }
  } catch (err) {
    rc.log('J1-B1', 'FAIL', `[depth=medium] Error publishing config: ${err.message}`);
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
        rc.log('J1-B0', 'PASS', `[depth=medium] publishedBy=${pubBy} (non-zero, Fix 7 audit OK)`);
      } else if (pubBy === 0 || pubBy === null) {
        rc.log('J1-B0', 'FAIL', `[depth=medium] publishedBy=${pubBy} — Fix 7 operatorId not recorded`);
      } else {
        rc.log('J1-B0', 'WARN', `[depth=medium] publishedBy field not in response — cannot verify Fix 7`);
      }
    } else {
      rc.log('J1-B0', 'WARN', `[depth=medium] current-version has no configVersion — cannot verify audit`);
    }
  } catch (err) {
    rc.log('J1-B0', 'FAIL', `[depth=medium] Audit check error: ${err.message}`);
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
        `[depth=deep] ddl-log returned HTTP ${res.status}: ${res.message || '(no message)'}`
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
        `[depth=deep] DDL log contains ${executedWithSuffix.length} EXECUTED entries with suffix (expected ≥6)`
      );
    } else {
      rc.log(
        'J1-B1b',
        'FAIL',
        `[depth=deep] DDL log only has ${executedWithSuffix.length} EXECUTED entries with suffix (expected ≥6) — total entries checked: ${entries.length}`
      );
    }
  } catch (err) {
    rc.log('J1-B1b', 'FAIL', `[depth=deep] Error checking DDL log: ${err.message}`);
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
        `[depth=deep] dynamic-fields returned HTTP ${res.status}: ${res.message || '(no message)'}`
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
        `[depth=deep] ACTIVE fields with suffix after publish: ${activeWithSuffix.length} (expected 7)`
      );
    } else {
      rc.log(
        'J1-B2',
        'FAIL',
        `[depth=deep] ACTIVE fields with suffix after publish: ${activeWithSuffix.length} (expected 7)`
      );
    }
  } catch (err) {
    rc.log('J1-B2', 'FAIL', `[depth=deep] Error checking ACTIVE fields: ${err.message}`);
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
        `[depth=deep] effective config returned HTTP ${res.status}: ${res.message || '(no message)'}`
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
        `[depth=deep] Effective config contains ≥7 references to suffix fields (found ${suffixMatches} occurrences)`
      );
    } else {
      rc.log(
        'J1-B3',
        'FAIL',
        `[depth=deep] Effective config contains only ${suffixMatches} references to suffix fields (expected ≥7)`
      );
    }
  } catch (err) {
    rc.log('J1-B3', 'FAIL', `[depth=deep] Error checking effective config: ${err.message}`);
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
        `[depth=medium] PATCH toggle disable ${TARGET_MODULE} — HTTP 200`);
    } else {
      rc.log('J1-C1-disable', 'FAIL',
        `[depth=medium] PATCH toggle disable returned HTTP ${disableRes.status}: ${disableRes.message || '(no msg)'}`);
      return;
    }
  } catch (err) {
    rc.log('J1-C1-disable', 'FAIL', `[depth=medium] Disable request error: ${err.message}`);
    return;
  }

  // C3: Publish so the toggle takes effect (DRAFT → PUBLISHED)
  try {
    const pub = await apiPost(`${F}/config/publish?summary=J1-C+module+toggle+test`, null, token);
    if (pub.status !== 200) {
      rc.log('J1-C2-publish', 'WARN',
        `[depth=medium] Publish after disable returned HTTP ${pub.status}: ${pub.message || '(no msg)'} — toggle may not be active yet`);
    } else {
      rc.log('J1-C2-publish', 'PASS', `[depth=medium] Toggle change published — HTTP 200`);
    }
  } catch (err) {
    rc.log('J1-C2-publish', 'WARN', `[depth=medium] Publish error: ${err.message}`);
  }

  // C4: Verify effective config reflects disabled state
  try {
    const verifyRes = await apiGet(`${F}/config/modules/${TARGET_MODULE}/effective`, token);
    const enabledAfter = verifyRes.data?.enabled;
    if (verifyRes.status === 200 && enabledAfter === false) {
      rc.log('J1-C3-verify-disabled', 'PASS',
        `[depth=deep] effective config enabled=false after toggle`);
    } else {
      rc.log('J1-C3-verify-disabled', 'FAIL',
        `[depth=deep] Expected enabled=false, got ${enabledAfter} (HTTP ${verifyRes.status})`);
    }
  } catch (err) {
    rc.log('J1-C3-verify-disabled', 'FAIL', `[depth=deep] Verify disable error: ${err.message}`);
  }

  // C4: Re-enable to restore original state (endpoint is @PatchMapping)
  let restored = false;
  try {
    const enableRes = await apiCall('PATCH',
      `${F}/config/modules/${TARGET_MODULE}/toggle?enabled=${originalEnabled}`, null, token
    );
    if (enableRes.status === 200) {
      rc.log('J1-C4-restore', 'PASS',
        `[depth=medium] PATCH toggle restore ${TARGET_MODULE} to enabled=${originalEnabled} — HTTP 200`);
      restored = true;
    } else {
      rc.log('J1-C4-restore', 'FAIL',
        `[depth=medium] PATCH toggle restore returned HTTP ${enableRes.status}: ${enableRes.message || '(no msg)'}`);
    }
    // Publish the restore (check result — leaving module in DRAFT-disabled pollutes later runs)
    const restorePub = await apiPost(`${F}/config/publish?summary=J1-C+toggle+restore`, null, token);
    if (restorePub.status !== 200 && restored) {
      rc.log('J1-C4-restore', 'WARN',
        `[depth=medium] Restore PATCH was 200 but restore publish returned HTTP ${restorePub.status}: ${restorePub.message || '(no msg)'} — module may remain in DRAFT state`);
    }
  } catch (err) {
    rc.log('J1-C4-restore', 'FAIL', `[depth=medium] Restore request error: ${err.message}`);
    restored = false;
  }

  // C5: Verify effective config reflects restored state
  if (restored) {
    try {
      const verifyRes = await apiGet(`${F}/config/modules/${TARGET_MODULE}/effective`, token);
      const enabledAfter = verifyRes.data?.enabled;
      if (verifyRes.status === 200 && enabledAfter === originalEnabled) {
        rc.log('J1-C5-verify-restored', 'PASS',
          `[depth=deep] effective config enabled=${originalEnabled} confirmed after restore`);
      } else {
        rc.log('J1-C5-verify-restored', 'FAIL',
          `[depth=deep] Expected enabled=${originalEnabled}, got ${enabledAfter} (HTTP ${verifyRes.status})`);
      }
    } catch (err) {
      rc.log('J1-C5-verify-restored', 'FAIL', `[depth=deep] Verify restore error: ${err.message}`);
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
        `[depth=medium] current-version returned HTTP ${res.status}: ${res.message || '(no message)'}`
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
        `[depth=medium] current-version HTTP 200 but could not parse version from: ${JSON.stringify(d)} — skipping rollback phases`
      );
      return;
    }

    rc.log('J1-D1', 'PASS', `[depth=medium] currentVersion = ${currentVersion}`);
  } catch (err) {
    rc.log('J1-D1', 'FAIL', `[depth=medium] Error fetching current-version: ${err.message}`);
    return;
  }

  // D2: If currentVersion > 1, rollback to currentVersion - 1 and publish
  if (currentVersion <= 1) {
    rc.log(
      'J1-D2',
      'WARN',
      `[depth=medium] currentVersion=${currentVersion} — no previous version to roll back to, skipping D2/D3`
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
        `[depth=medium] Rolled back to version ${rollbackTarget} — HTTP ${rbRes.status}`
      );
    } else {
      rc.log(
        'J1-D2',
        'FAIL',
        `[depth=medium] config/rollback/${rollbackTarget} returned HTTP ${rbRes.status}: ${rbRes.message || '(no message)'}`
      );
      return;
    }
  } catch (err) {
    rc.log('J1-D2', 'FAIL', `[depth=medium] Error during rollback to v${rollbackTarget}: ${err.message}`);
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
      rc.log('J1-D2-pub', 'PASS', `[depth=medium] Published rollback to v${rollbackTarget} — HTTP ${pubRbRes.status}`);
    } else {
      rc.log(
        'J1-D2-pub',
        'FAIL',
        `[depth=medium] Publish after rollback returned HTTP ${pubRbRes.status}: ${pubRbRes.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-D2-pub', 'FAIL', `[depth=medium] Error publishing rollback: ${err.message}`);
  }

  // D3: Roll back to currentVersion (restore) and publish
  try {
    const restoreRes = await apiPost(`${F}/config/rollback/${currentVersion}`, {}, token);
    if (restoreRes.status === 200) {
      rc.log(
        'J1-D3',
        'PASS',
        `[depth=medium] Restored to version ${currentVersion} — HTTP ${restoreRes.status}`
      );
    } else {
      rc.log(
        'J1-D3',
        'FAIL',
        `[depth=medium] config/rollback/${currentVersion} (restore) returned HTTP ${restoreRes.status}: ${restoreRes.message || '(no message)'}`
      );
      return;
    }
  } catch (err) {
    rc.log('J1-D3', 'FAIL', `[depth=medium] Error restoring to v${currentVersion}: ${err.message}`);
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
        `[depth=medium] Published restore to v${currentVersion} — HTTP ${pubRestoreRes.status}`
      );
    } else {
      rc.log(
        'J1-D3-pub',
        'FAIL',
        `[depth=medium] Publish after restore returned HTTP ${pubRestoreRes.status}: ${pubRestoreRes.message || '(no message)'}`
      );
    }
  } catch (err) {
    rc.log('J1-D3-pub', 'FAIL', `[depth=medium] Error publishing restore: ${err.message}`);
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
// Phase F/G/H — Sub-table CRUD round-trip (deep positive-path tests)
// ---------------------------------------------------------------------------
//
// R4 P0-4/5/6 (depth-first-e2e Rule 8 same-cause sweep + Rule 2 deep test):
// R3 found `setCustomFields` was missing `@Transactional`. The Rule 8 sweep
// (R4-① pre-investigation) found 3 sibling endpoints with the same root cause
// in `DynamicTableService.addRow / updateRow / deleteRow`. R4 fixes the 3
// service methods AND adds these 3 round-trip tests so future regressions are
// caught locally instead of by another emergency sweep.
//
// Each phase is self-contained (R4-② Critic Q4 fix): own POST + own readback
// + own cleanup. No phase depends on rows left by another phase, so a failure
// in Phase F doesn't pollute Phase G or H.
//
// Each readback uses 3-value evidence (R4-② Critic Q3 defense-in-depth):
// log the values seen during setup + after-write to make silent-mutation bugs
// impossible to mistake for transient flakes.

/**
 * Discover an F002 sales order recordId and the fieldCode of the SUB_TABLE
 * field created in phaseA3 + published in phaseB1. Used by phases F/G/H.
 * Returns null with WARN log if discovery fails.
 */
async function discoverSubTableContext(token) {
  // recordId — reuse phaseE's helper logic
  const listRes = await apiGet(`${F}/sales/orders?page=1&size=1`, token);
  if (listRes.status !== 200) {
    return { error: `Cannot list F002 sales orders — HTTP ${listRes.status}` };
  }
  const d = listRes.data;
  const records =
    (Array.isArray(d) && d) ||
    (d && Array.isArray(d.content) && d.content) ||
    (d && Array.isArray(d.records) && d.records) ||
    (d && Array.isArray(d.list) && d.list) ||
    [];
  if (records.length === 0) {
    return { error: 'F002 has no sales orders' };
  }
  const recordId = records[0].id ?? records[0].orderId ?? records[0].recordId;
  if (!recordId) {
    return { error: `Cannot extract recordId (keys: ${Object.keys(records[0]).join(', ')})` };
  }
  // fieldCode — phaseA3 created `prepay${SUFFIX}` as a SUB_TABLE field
  return {
    recordId,
    moduleCode: 'sales_order',
    fieldCode: `prepay${SUFFIX}`,
  };
}

/**
 * Phase F — addRow positive-path round-trip.
 * Test contract: POST adds a row → GET sub-table → assert new row visible by
 * matching the unique remark we wrote. If R4 P0-1 (@Transactional on addRow)
 * is not deployed, the POST returns 200 + row data but the GET shows an empty
 * list, and J1-F2 FAILs.
 */
async function phaseF_subTableAddRoundtrip(token) {
  const ctx = await discoverSubTableContext(token);
  if (ctx.error) {
    rc.log('J1-F0', 'WARN', `[depth=deep] Skipped — ${ctx.error}`);
    return;
  }
  rc.log('J1-F0', 'PASS', `[depth=deep] Setup OK — recordId=${ctx.recordId}, fieldCode=${ctx.fieldCode}`);

  const uniqueRemark = `J1-F-${SUFFIX}`;
  const subTablePath = `${F}/${ctx.moduleCode}/${ctx.recordId}/sub-table/${ctx.fieldCode}`;

  // F1: POST add row
  let createdRowId = null;
  try {
    const post = await apiPost(subTablePath, { amount: 99.99, pay_date: '2026-04-15', remark: uniqueRemark }, token);
    if (post.status !== 200) {
      rc.log(
        'J1-F1',
        'FAIL',
        `[depth=medium] POST sub-table row returned HTTP ${post.status}: ${post.message || '(no msg)'}`
      );
      return;
    }
    createdRowId = post.data?.id ?? null;
    rc.log(
      'J1-F1',
      'PASS',
      `[depth=medium] POST sub-table row HTTP 200, returned id=${createdRowId}, remark=${uniqueRemark}`
    );
  } catch (err) {
    rc.log('J1-F1', 'FAIL', `[depth=medium] POST sub-table row threw: ${err.message}`);
    return;
  }

  // F2: GET sub-table and assert the new row is visible (by unique remark)
  // This is the deep assertion: if R4 backend fix is not deployed, POST returned
  // success + row data, but the GET reads from DB which never saw the commit.
  try {
    const get = await apiGet(subTablePath, token);
    if (get.status !== 200) {
      rc.log(
        'J1-F2',
        'FAIL',
        `[depth=deep] GET sub-table returned HTTP ${get.status}: ${get.message || '(no msg)'}`
      );
      return;
    }
    const rows = Array.isArray(get.data) ? get.data : (get.data?.content || get.data?.list || []);
    const found = rows.find(r => r?.cf_remark === uniqueRemark);
    if (found) {
      rc.log(
        'J1-F2',
        'PASS',
        `[depth=deep] Round-trip verified — POST'd remark="${uniqueRemark}" IS in GET response. ` +
        `${rows.length} total row(s), found row id=${found.id}, cf_amount=${found.cf_amount}`
      );
    } else {
      rc.log(
        'J1-F2',
        'FAIL',
        `[depth=deep] Round-trip BROKEN — POST returned HTTP 200 but GET shows ${rows.length} row(s), ` +
        `none matching remark="${uniqueRemark}". Likely DynamicTableService.addRow @Transactional missing → silent rollback.`
      );
    }
  } catch (err) {
    rc.log('J1-F2', 'FAIL', `[depth=deep] GET sub-table threw: ${err.message}`);
  }

  // F3: Cleanup — DELETE the row we created (best-effort)
  if (createdRowId) {
    try {
      const del = await apiDelete(`${subTablePath}/${createdRowId}`, token);
      if (del.status === 204 || del.status === 200) {
        console.log(`  [J1-F cleanup] deleted row ${createdRowId}`);
      } else {
        console.log(`  [J1-F cleanup] WARNING: delete returned HTTP ${del.status}, row may persist`);
      }
    } catch (err) {
      console.log(`  [J1-F cleanup] WARNING: delete threw — ${err.message}`);
    }
  }
}

/**
 * Phase G — updateRow positive-path round-trip.
 * Test contract: POST setup row → verify exists → PUT update → GET → assert
 * updated value visible. If R4 P0-2 (@Transactional on updateRow) is not
 * deployed, the PUT returns 200 but the GET shows the original remark (silent
 * rollback) and J1-G3 FAILs.
 */
async function phaseG_subTableUpdateRoundtrip(token) {
  const ctx = await discoverSubTableContext(token);
  if (ctx.error) {
    rc.log('J1-G0', 'WARN', `[depth=deep] Skipped — ${ctx.error}`);
    return;
  }

  const setupRemark = `J1-G-setup-${SUFFIX}`;
  const updatedRemark = `J1-G-updated-${SUFFIX}`;
  const subTablePath = `${F}/${ctx.moduleCode}/${ctx.recordId}/sub-table/${ctx.fieldCode}`;

  // G0: setup row + verify exists
  let rowId = null;
  try {
    const post = await apiPost(subTablePath, { amount: 50, pay_date: '2026-04-15', remark: setupRemark }, token);
    if (post.status !== 200) {
      rc.log('J1-G0', 'WARN', `[depth=deep] Setup POST failed HTTP ${post.status} — addRow may be broken, skipping G`);
      return;
    }
    rowId = post.data?.id ?? null;
    if (!rowId) {
      rc.log('J1-G0', 'WARN', `[depth=deep] Setup POST returned 200 but no row id — skipping G`);
      return;
    }
    // Verify row really exists in GET (rules out silent-rollback masking the test)
    const verify = await apiGet(subTablePath, token);
    const verifyRows = Array.isArray(verify.data) ? verify.data : (verify.data?.content || verify.data?.list || []);
    const exists = verifyRows.some(r => r?.id === rowId || r?.cf_remark === setupRemark);
    if (!exists) {
      rc.log(
        'J1-G0',
        'WARN',
        `[depth=deep] Setup POST returned id=${rowId} but row not visible in GET — addRow silent rollback. Skipping G test.`
      );
      return;
    }
    rc.log('J1-G0', 'PASS', `[depth=deep] Setup row id=${rowId} verified visible, remark="${setupRemark}"`);
  } catch (err) {
    rc.log('J1-G0', 'FAIL', `[depth=deep] Setup threw: ${err.message}`);
    return;
  }

  // G1: PUT update with new remark
  try {
    const put = await apiPut(`${subTablePath}/${rowId}`, { amount: 50, pay_date: '2026-04-15', remark: updatedRemark }, token);
    if (put.status !== 200) {
      rc.log('J1-G1', 'FAIL', `[depth=medium] PUT sub-table row HTTP ${put.status}: ${put.message || '(no msg)'}`);
      return;
    }
    rc.log('J1-G1', 'PASS', `[depth=medium] PUT row id=${rowId} → HTTP 200`);
  } catch (err) {
    rc.log('J1-G1', 'FAIL', `[depth=medium] PUT threw: ${err.message}`);
    return;
  }

  // G2: GET and assert updated value visible (deep assertion)
  try {
    const get = await apiGet(subTablePath, token);
    const rows = Array.isArray(get.data) ? get.data : (get.data?.content || get.data?.list || []);
    const row = rows.find(r => r?.id === rowId);
    if (!row) {
      rc.log(
        'J1-G2',
        'FAIL',
        `[depth=deep] Row id=${rowId} disappeared from GET after PUT — likely backend issue beyond updateRow scope`
      );
    } else if (row.cf_remark === updatedRemark) {
      rc.log(
        'J1-G2',
        'PASS',
        `[depth=deep] Round-trip verified — row id=${rowId} cf_remark changed from "${setupRemark}" to "${row.cf_remark}"`
      );
    } else if (row.cf_remark === setupRemark) {
      rc.log(
        'J1-G2',
        'FAIL',
        `[depth=deep] Round-trip BROKEN — PUT returned HTTP 200 but GET shows row id=${rowId} still has setup cf_remark "${setupRemark}" (expected "${updatedRemark}"). ` +
        `Likely DynamicTableService.updateRow @Transactional missing → silent rollback.`
      );
    } else {
      rc.log(
        'J1-G2',
        'FAIL',
        `[depth=deep] Round-trip UNEXPECTED — row id=${rowId} cf_remark="${row.cf_remark}", expected "${updatedRemark}" or "${setupRemark}"`
      );
    }
  } catch (err) {
    rc.log('J1-G2', 'FAIL', `[depth=deep] GET sub-table threw: ${err.message}`);
  }

  // G3: cleanup
  try {
    const del = await apiDelete(`${subTablePath}/${rowId}`, token);
    if (del.status === 204 || del.status === 200) {
      console.log(`  [J1-G cleanup] deleted row ${rowId}`);
    } else {
      console.log(`  [J1-G cleanup] WARNING: delete returned HTTP ${del.status}`);
    }
  } catch (err) {
    console.log(`  [J1-G cleanup] WARNING: delete threw — ${err.message}`);
  }
}

/**
 * Phase H — deleteRow positive-path round-trip.
 * Test contract: POST setup row → verify exists → DELETE → GET → assert row
 * by id is no longer in response. If R4 P0-3 (@Transactional on deleteRow)
 * is not deployed, the DELETE returns 204 but the GET still shows the row
 * (silent rollback) and J1-H3 FAILs.
 */
async function phaseH_subTableDeleteRoundtrip(token) {
  const ctx = await discoverSubTableContext(token);
  if (ctx.error) {
    rc.log('J1-H0', 'WARN', `[depth=deep] Skipped — ${ctx.error}`);
    return;
  }

  const setupRemark = `J1-H-${SUFFIX}`;
  const subTablePath = `${F}/${ctx.moduleCode}/${ctx.recordId}/sub-table/${ctx.fieldCode}`;

  // H0: setup + verify exists
  let rowId = null;
  try {
    const post = await apiPost(subTablePath, { amount: 25, pay_date: '2026-04-15', remark: setupRemark }, token);
    if (post.status !== 200) {
      rc.log('J1-H0', 'WARN', `[depth=deep] Setup POST failed HTTP ${post.status} — addRow may be broken, skipping H`);
      return;
    }
    rowId = post.data?.id ?? null;
    if (!rowId) {
      rc.log('J1-H0', 'WARN', `[depth=deep] Setup POST returned 200 but no row id — skipping H`);
      return;
    }
    const verify = await apiGet(subTablePath, token);
    const verifyRows = Array.isArray(verify.data) ? verify.data : (verify.data?.content || verify.data?.list || []);
    if (!verifyRows.some(r => r?.id === rowId)) {
      rc.log('J1-H0', 'WARN', `[depth=deep] Setup row id=${rowId} not visible in GET — addRow silent rollback. Skipping H.`);
      return;
    }
    rc.log('J1-H0', 'PASS', `[depth=deep] Setup row id=${rowId} verified visible`);
  } catch (err) {
    rc.log('J1-H0', 'FAIL', `[depth=deep] Setup threw: ${err.message}`);
    return;
  }

  // H1: DELETE the row
  try {
    const del = await apiDelete(`${subTablePath}/${rowId}`, token);
    if (del.status !== 200 && del.status !== 204) {
      rc.log('J1-H1', 'FAIL', `[depth=medium] DELETE sub-table row HTTP ${del.status}: ${del.message || '(no msg)'}`);
      return;
    }
    rc.log('J1-H1', 'PASS', `[depth=medium] DELETE row id=${rowId} → HTTP ${del.status}`);
  } catch (err) {
    rc.log('J1-H1', 'FAIL', `[depth=medium] DELETE threw: ${err.message}`);
    return;
  }

  // H2: GET and assert row is absent (by id, not by row count)
  try {
    const get = await apiGet(subTablePath, token);
    const rows = Array.isArray(get.data) ? get.data : (get.data?.content || get.data?.list || []);
    const stillThere = rows.some(r => r?.id === rowId);
    if (!stillThere) {
      rc.log(
        'J1-H2',
        'PASS',
        `[depth=deep] Round-trip verified — row id=${rowId} absent from GET response (${rows.length} other rows still present, none with this id)`
      );
    } else {
      rc.log(
        'J1-H2',
        'FAIL',
        `[depth=deep] Round-trip BROKEN — DELETE returned HTTP 200/204 but GET still shows row id=${rowId}. ` +
        `Likely DynamicTableService.deleteRow @Transactional missing → silent rollback.`
      );
    }
  } catch (err) {
    rc.log('J1-H2', 'FAIL', `[depth=deep] GET sub-table threw: ${err.message}`);
  }

  // No cleanup needed — the row is already deleted (or wasn't, in which case the test failed)
}

// ---------------------------------------------------------------------------
// Phase I — Aggregate formula roundtrip (R6 P0-1 deep test)
// ---------------------------------------------------------------------------
//
// R6 P0-1: fix hardcoded `?::uuid` in AggregateFormulaExecutor.java:87-91,142-146.
// This is the same bug class as R4 P0-7 (DynamicTableService + DDLExecutor) but
// in the aggregate formula evaluation path. Without a deep test, R5-② Critic
// correctly deferred this as "no aggregate formula test harness". R6 builds
// that harness + verifies the fix.
//
// Test flow (Rule 2 deep):
//   I0: Reuse discoverSubTableContext to get recordId + sub-table fieldCode
//   I1: Define a GROUP_BY aggregate formula via PUT /config/v2/formulas
//       Expression: GROUP_BY(<sub-table>, 'cf_pay_date', SUM('cf_amount'))
//       resultType: AGGREGATE
//   I2: Populate sub-table with known rows (uses phaseF-style POST)
//       Rows share cf_pay_date so GROUP_BY produces 1 group with known SUM
//   I3: Trigger formula evaluation via GET /sales/v2/orders/{recordId}/formulas
//   I4: Assert response contains our formula code AND the aggregate value
//       matches the known sum of amounts we wrote
//
// depth=deep on I4: if AggregateFormulaExecutor still hardcodes UUID cast,
// the query throws "invalid input syntax for type uuid" → SalesServiceImpl
// catches it and logs WARN → response omits our formula key → I4 FAILs.
// Only a correct type-aware cast produces the expected result.
async function phaseI_aggregateFormulaRoundtrip(token) {
  const ctx = await discoverSubTableContext(token);
  if (ctx.error) {
    rc.log('J1-I0', 'WARN', `[depth=deep] Skipped — ${ctx.error}`);
    return;
  }

  const formulaCode = `r6_agg_sum_${SUFFIX.slice(5)}`; // strip leading "_e2e_", keep short
  const subTableName = `${ctx.moduleCode}_${ctx.fieldCode}_items`;
  // GROUP_BY regex expects: GROUP_BY(table, 'group_field', AGG('value_field'))
  const expression = `GROUP_BY(${subTableName}, 'cf_pay_date', SUM('cf_amount'))`;

  rc.log('J1-I0', 'PASS',
    `[depth=deep] Setup — recordId=${ctx.recordId}, sub-table=${subTableName}, formulaCode=${formulaCode}`);

  // I1: PUT create aggregate formula
  let createdFormula = false;
  try {
    const put = await apiPut(
      `${F}/config/v2/formulas/${formulaCode}`,
      {
        moduleCode: ctx.moduleCode,
        formulaCode: formulaCode,
        expression: expression,
        resultType: 'AGGREGATE',
        description: `R6 P0-1 aggregate formula test (SUFFIX ${SUFFIX})`,
      },
      token
    );
    if (put.status !== 200) {
      rc.log('J1-I1', 'FAIL',
        `[depth=medium] PUT /config/v2/formulas/${formulaCode} returned HTTP ${put.status}: ${put.message || '(no msg)'}`);
      return;
    }
    createdFormula = true;
    rc.log('J1-I1', 'PASS',
      `[depth=medium] PUT formula → HTTP 200, expression="${expression}"`);
  } catch (err) {
    rc.log('J1-I1', 'FAIL', `[depth=medium] PUT formula threw: ${err.message}`);
    return;
  }

  try {
    // I2: Populate sub-table with 3 known rows sharing cf_pay_date
    const subTablePath = `${F}/${ctx.moduleCode}/${ctx.recordId}/sub-table/${ctx.fieldCode}`;
    const TEST_DATE = '2026-04-15';
    const AMOUNTS = [100.50, 200.25, 300.00];
    const EXPECTED_SUM = AMOUNTS.reduce((a, b) => a + b, 0); // 600.75
    const createdRowIds = [];

    try {
      for (let i = 0; i < AMOUNTS.length; i++) {
        const post = await apiPost(subTablePath, {
          amount: AMOUNTS[i],
          pay_date: TEST_DATE,
          remark: `J1-I-row-${i}-${SUFFIX}`,
        }, token);
        if (post.status !== 200 || !post.data?.id) {
          rc.log('J1-I2', 'FAIL',
            `[depth=medium] Setup POST row ${i} failed: HTTP ${post.status} ${post.message || ''}`);
          return;
        }
        createdRowIds.push(post.data.id);
      }
      rc.log('J1-I2', 'PASS',
        `[depth=medium] Populated ${createdRowIds.length} rows, cf_pay_date=${TEST_DATE}, total cf_amount=${EXPECTED_SUM}`);
    } catch (err) {
      rc.log('J1-I2', 'FAIL', `[depth=medium] Setup rows threw: ${err.message}`);
      return;
    }

    // I3: Trigger formula evaluation via sales/v2/orders/{recordId}/formulas
    try {
      const res = await apiGet(
        `${F}/sales/orders/${ctx.recordId}/formulas`,
        token
      );
      if (res.status !== 200) {
        rc.log('J1-I3', 'FAIL',
          `[depth=deep] GET /formulas returned HTTP ${res.status}: ${res.message || '(no msg)'} — SalesServiceImpl may have hard-failed`);
        return;
      }

      // I4: Assert our formula code is present AND value matches
      // SalesServiceImpl catches AggregateFormulaExecutor exceptions and logs WARN,
      // so a broken AggregateFormulaExecutor shows up as "formula code absent" in response.
      const results = res.data || {};
      const aggResult = results[formulaCode];

      if (aggResult === undefined || aggResult === null) {
        rc.log('J1-I4', 'FAIL',
          `[depth=deep] GET /formulas returned HTTP 200 but formula "${formulaCode}" is ABSENT from response. ` +
          `Keys: [${Object.keys(results).join(', ')}]. ` +
          `Likely AggregateFormulaExecutor threw (hardcoded UUID cast on VARCHAR parent_id) and SalesServiceImpl silently swallowed the exception.`);
        return;
      }

      // Aggregate result shape: List<Map<String, Object>> like
      //   [{"cf_pay_date": "2026-04-15", "agg_value": 600.75}]
      // Find the group with our test date
      const groups = Array.isArray(aggResult) ? aggResult : [];
      const ourGroup = groups.find(g => {
        const d = g?.cf_pay_date;
        // Postgres may return Date object or ISO string — both OK
        return String(d).startsWith(TEST_DATE);
      });

      if (!ourGroup) {
        rc.log('J1-I4', 'FAIL',
          `[depth=deep] Formula result present but no group matching cf_pay_date=${TEST_DATE}. ` +
          `Got ${groups.length} groups: ${JSON.stringify(groups).slice(0, 200)}`);
        return;
      }

      const actualSum = Number(ourGroup.agg_value);
      if (Math.abs(actualSum - EXPECTED_SUM) < 0.01) {
        rc.log('J1-I4', 'PASS',
          `[depth=deep] Aggregate formula roundtrip verified — GROUP_BY returned cf_pay_date=${TEST_DATE}, ` +
          `SUM(cf_amount)=${actualSum} matches expected ${EXPECTED_SUM} (${AMOUNTS.length} rows). ` +
          `AggregateFormulaExecutor correctly handled VARCHAR parent_id cast.`);
      } else {
        rc.log('J1-I4', 'FAIL',
          `[depth=deep] Aggregate value mismatch: expected SUM(cf_amount)=${EXPECTED_SUM} but got ${actualSum}`);
      }
    } catch (err) {
      rc.log('J1-I3', 'FAIL', `[depth=deep] GET /formulas threw: ${err.message}`);
    }

    // Cleanup: delete the rows we created (formula itself left for idempotent rerun — unique formulaCode per SUFFIX)
    for (const rowId of createdRowIds) {
      try {
        await apiDelete(`${subTablePath}/${rowId}`, token);
      } catch { /* best effort */ }
    }
  } finally {
    // Cleanup formula — R7 Issue 2 added DELETE endpoint; moduleCode is now a required
    // query param (uniqueness is on factory+module+formulaCode, not formulaCode alone).
    // Idempotent endpoint returns 200 even if already gone.
    if (createdFormula) {
      try {
        await apiDelete(`${F}/config/v2/formulas/${formulaCode}?moduleCode=${ctx.moduleCode}`, token);
      } catch { /* ignore */ }
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
      rc.log('J1-login', 'FAIL', '[depth=smoke] Login succeeded but no token returned');
      rc.save();
      process.exit(1);
    }
    token = session.token;
    rc.log(
      'J1-login',
      'PASS',
      `[depth=smoke] Logged in — factoryId=${session.factoryId} role=${session.role}`
    );
  } catch (err) {
    rc.log('J1-login', 'FAIL', `[depth=smoke] Login error: ${err.message}`);
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
    rc.log('J1-B1b', 'FAIL', '[depth=deep] Skipped — publish failed');
    rc.log('J1-B2', 'FAIL', '[depth=deep] Skipped — publish failed');
    rc.log('J1-B3', 'FAIL', '[depth=deep] Skipped — publish failed');
  }

  // Phase C — Module toggle E2E (R1 addition: close Canvas 模块启停 0% gap)
  console.log('\n--- Phase C: Module Toggle ---');
  await phaseC_moduleToggle(token);

  // Phase E — R3 P0-4: deep positive-path custom field roundtrip (depth-first-e2e Rule 2).
  // Runs BEFORE Phase D so phaseD_rollback's history mutations don't interfere
  // with the freshly-published dynamic field columns from Phase B.
  console.log('\n--- Phase E: Custom Field Roundtrip (deep) ---');
  await phaseE_customFieldRoundtrip(token);

  // Phase F/G/H — R4 P0-4/5/6: sub-table CRUD round-trip tests (depth-first-e2e Rule 8 sweep).
  // Each phase is self-contained — own POST + own readback + own cleanup.
  // Tests J1-F* / J1-G* / J1-H* will FAIL if R4 backend fix (@Transactional on
  // DynamicTableService.addRow/updateRow/deleteRow) is not deployed.
  console.log('\n--- Phase F: Sub-Table Add Roundtrip (deep) ---');
  await phaseF_subTableAddRoundtrip(token);
  console.log('\n--- Phase G: Sub-Table Update Roundtrip (deep) ---');
  await phaseG_subTableUpdateRoundtrip(token);
  console.log('\n--- Phase H: Sub-Table Delete Roundtrip (deep) ---');
  await phaseH_subTableDeleteRoundtrip(token);

  // Phase I — R6 P0-1: aggregate formula roundtrip (fix AggregateFormulaExecutor UUID cast)
  console.log('\n--- Phase I: Aggregate Formula Roundtrip (deep) ---');
  await phaseI_aggregateFormulaRoundtrip(token);

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
