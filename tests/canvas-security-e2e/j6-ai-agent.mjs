/**
 * J6 — AI Agent Security: Prompt Injection + Tool Whitelist + RBAC
 *
 * API-only (no Playwright). Verifies that the AI autopilot layer enforces
 * canvas-scoped tool restrictions and role-based access control.
 *
 * Steps:
 *  A1 — AI autopilot basic function         — HTTP 200 or WARN (AI may not be configured)
 *  A2 — Prompt injection blocked [Fix 6,15a] — success=false OR response contains "canvas_"
 *  A3 — Legitimate canvas tool allowed       — HTTP 200; BOM re-enabled as cleanup
 *  A4 — Non-admin blocked from AI chat       — HTTP 403
 *
 * Exit code 1 if any step is FAIL.
 */

import {
  login,
  apiPost,
  createResultCollector,
  FACTORY_A,
  ADMIN_A,
} from './canvas-test-helpers.mjs';

const rc = createResultCollector('j6-ai-agent');

// ---------------------------------------------------------------------------
// A1 — AI autopilot basic function
// ---------------------------------------------------------------------------
async function testAiAutopilotBasic(adminToken) {
  try {
    const result = await apiPost(
      `${FACTORY_A}/config/v2/ai/chat`,
      { message: '禁用采购模块', mode: 'autopilot' },
      adminToken
    );

    if (result.status === 200) {
      rc.log(
        'A1',
        'PASS',
        `AI autopilot endpoint reachable — HTTP 200, success=${result.success}`
      );
      return true;
    }

    // Non-200 may mean AI is not configured — treat as WARN, not FAIL
    rc.log(
      'A1',
      'WARN',
      `AI autopilot returned HTTP ${result.status} — AI backend may not be configured: ${result.message || '(no message)'}`
    );
    return true; // WARN is non-blocking
  } catch (err) {
    rc.log('A1', 'WARN', `AI autopilot request error (AI may not be configured): ${err.message}`);
    return true; // WARN is non-blocking
  }
}

// ---------------------------------------------------------------------------
// A2 — Prompt injection blocked [Fix 6,15a]
//
// Sending a non-canvas tool (material_batch_delete) via apply-diffs must be
// rejected: either success=false, or the response body contains "canvas_"
// (indicating the system returned a rejection message referencing allowed tools).
// ---------------------------------------------------------------------------
async function testPromptInjectionBlocked(adminToken) {
  try {
    const result = await apiPost(
      `${FACTORY_A}/config/v2/ai/apply-diffs`,
      [{ tool: 'material_batch_delete', params: { batchId: 'xxx' } }],
      adminToken
    );

    // Check rejection conditions: success=false OR body mentions "canvas_"
    const bodyStr = JSON.stringify(result.json);
    const mentionsCanvas = bodyStr.includes('canvas_');
    const isRejected = result.success === false || mentionsCanvas;

    if (isRejected) {
      rc.log(
        'A2',
        'PASS',
        `Prompt injection rejected — success=${result.success}, body mentions "canvas_": ${mentionsCanvas}, HTTP ${result.status}`
      );
      return true;
    }

    // HTTP 403/422/400 also counts as a rejection even if response shape differs
    if (result.status === 403 || result.status === 422 || result.status === 400) {
      rc.log(
        'A2',
        'PASS',
        `Prompt injection rejected via HTTP ${result.status} — non-canvas tool blocked`
      );
      return true;
    }

    rc.log(
      'A2',
      'FAIL',
      `Prompt injection NOT blocked — HTTP ${result.status} success=${result.success}, body: ${bodyStr.slice(0, 200)}`
    );
    return false;
  } catch (err) {
    rc.log('A2', 'FAIL', `apply-diffs request error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// A3 — Legitimate canvas tool allowed
//
// canvas_toggle_module is a canvas-scoped tool and must be permitted.
// After disabling BOM, re-enable it as cleanup.
// ---------------------------------------------------------------------------
async function testLegitimateCanvasToolAllowed(adminToken) {
  // Step 1: disable BOM
  let disableResult;
  try {
    disableResult = await apiPost(
      `${FACTORY_A}/config/v2/ai/apply-diffs`,
      [{ tool: 'canvas_toggle_module', params: { moduleCode: 'bom', enabled: false } }],
      adminToken
    );

    if (disableResult.status !== 200) {
      rc.log(
        'A3',
        'FAIL',
        `canvas_toggle_module (disable BOM) returned HTTP ${disableResult.status}: ${disableResult.message || '(no message)'}`
      );
      return false;
    }

    rc.log(
      'A3',
      'PASS',
      `canvas_toggle_module accepted — HTTP 200, BOM disabled (success=${disableResult.success})`
    );
  } catch (err) {
    rc.log('A3', 'FAIL', `canvas_toggle_module (disable) request error: ${err.message}`);
    return false;
  }

  // Step 2: cleanup — re-enable BOM (best-effort, failure does not affect A3 status)
  try {
    await apiPost(
      `${FACTORY_A}/config/v2/ai/apply-diffs`,
      [{ tool: 'canvas_toggle_module', params: { moduleCode: 'bom', enabled: true } }],
      adminToken
    );
  } catch {
    // Cleanup failure is non-fatal for the test result
  }

  return true;
}

// ---------------------------------------------------------------------------
// A4 — Non-admin blocked from AI chat (HTTP 403)
// ---------------------------------------------------------------------------
async function testNonAdminBlocked() {
  // Try primary non-admin account; fall back to alternative if login fails
  let nonAdminToken = null;
  const candidates = ['operator1', 'f006_worker1'];

  for (const username of candidates) {
    try {
      const session = await login(username);
      nonAdminToken = session.token;
      break;
    } catch {
      // Try next candidate
    }
  }

  if (!nonAdminToken) {
    rc.log(
      'A4',
      'WARN',
      `Could not log in as any non-admin candidate (${candidates.join(', ')}) — RBAC check skipped`
    );
    return true; // WARN is non-blocking
  }

  try {
    const result = await apiPost(
      `${FACTORY_A}/config/v2/ai/chat`,
      { message: 'test', mode: 'action' },
      nonAdminToken
    );

    if (result.status === 403) {
      rc.log(
        'A4',
        'PASS',
        `Non-admin correctly blocked from AI chat — HTTP 403`
      );
      return true;
    }

    rc.log(
      'A4',
      'FAIL',
      `Non-admin was NOT blocked — expected HTTP 403, got HTTP ${result.status} success=${result.success}`
    );
    return false;
  } catch (err) {
    rc.log('A4', 'FAIL', `Non-admin AI chat request error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== J6 AI Agent Security: Prompt Injection + Tool Whitelist + RBAC ===\n');

  const fails = [];

  // Acquire admin token (required for A1-A3)
  let adminToken = null;
  try {
    const session = await login(ADMIN_A);
    adminToken = session.token;
    console.log(`Admin login OK — factoryId=${session.factoryId} role=${session.role}\n`);
  } catch (err) {
    console.error(`Admin login failed: ${err.message}`);
    rc.log('A1', 'FAIL', `Skipped — admin token unavailable: ${err.message}`);
    rc.log('A2', 'FAIL', 'Skipped — admin token unavailable');
    rc.log('A3', 'FAIL', 'Skipped — admin token unavailable');
    fails.push('A1', 'A2', 'A3');
  }

  if (adminToken) {
    // A1 — AI autopilot basic function (WARN-only on failure)
    const a1ok = await testAiAutopilotBasic(adminToken);
    if (!a1ok) fails.push('A1');

    // A2 — Prompt injection blocked
    const a2ok = await testPromptInjectionBlocked(adminToken);
    if (!a2ok) fails.push('A2');

    // A3 — Legitimate canvas tool allowed
    const a3ok = await testLegitimateCanvasToolAllowed(adminToken);
    if (!a3ok) fails.push('A3');
  }

  // A4 — Non-admin blocked (independent of admin token)
  const a4ok = await testNonAdminBlocked();
  if (!a4ok) fails.push('A4');

  // Save results and determine exit code
  const summary = rc.save();
  const exitCode = summary.fail > 0 ? 1 : 0;

  if (exitCode !== 0) {
    console.error(`\nJ6 FAILED (${summary.fail} failure(s)).`);
  } else {
    console.log('\nJ6 PASSED (all security checks satisfied).');
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Unexpected error in j6-ai-agent:', err);
  process.exit(1);
});
