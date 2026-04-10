// tests/canvas-v3/run-lifecycle-test.mjs
import { ApiClient } from './lib/api-client.mjs';
import { Report } from './lib/report.mjs';
import { phase0Prereq } from './phases/phase0-prereq.mjs';
import { phase1Config } from './phases/phase1-config.mjs';
import { phase2Verify } from './phases/phase2-verify.mjs';
import { phase3Change } from './phases/phase3-change.mjs';
import { phase4Reverify } from './phases/phase4-reverify.mjs';

const REPORT_PATH = './tests/canvas-v3/test-canvas-v3-lifecycle-results.json';

async function main() {
  const api = new ApiClient();
  const report = new Report();

  console.log('🚀 Canvas V3 Lifecycle Test Starting...\n');

  // Phase 0
  const p0 = await phase0Prereq();
  report.addPhase(p0);
  p0.results.forEach(r => {
    report.addCheckpoint(`P0-${r.check}`, r.check, r.pass ? 'PASS' : 'FAIL', r.data || r.error);
  });

  if (!p0.pass) {
    console.error('❌ Phase 0 failed, aborting.');
    report.print();
    report.save(REPORT_PATH);
    process.exit(1);
  }

  // Phase 1
  let state;
  try {
    state = await phase1Config(api, report);
    console.log(`\nPhase 1 state: factoryId=${state.factoryId}`);
  } catch (e) {
    console.error('Phase 1 error:', e.message);
    report.print();
    report.save(REPORT_PATH);
    process.exit(1);
  }

  // Phase 2
  let browserHandle = null;
  try {
    const p2 = await phase2Verify(state, api, report);
    browserHandle = p2?.browser ?? null;
  } catch (e) {
    console.error('Phase 2 error:', e.message);
    report.addCheckpoint('P2-ERR', 'Phase 2 执行错误', 'FAIL', { error: e.message });
  }

  // Close browser if still open
  if (browserHandle) {
    try {
      await browserHandle.close();
    } catch (_) {}
  }

  // Phase 3
  try {
    await phase3Change(state, api, report);
  } catch (e) {
    console.error('Phase 3 error:', e.message);
  }

  // Phase 4
  try {
    await phase4Reverify(state, api, report);
  } catch (e) {
    console.error('Phase 4 error:', e.message);
  }

  report.print();
  report.save(REPORT_PATH);
  console.log(`Report saved to: ${REPORT_PATH}`);

  // Print coverage matrix
  report.printCoverageMatrix();

  // Determine exit code based on P0 checks
  const P0_CHECKS = [
    'P0-backend_health',
    'P0-canvas_tables',
    'P1-1', 'P1-2', 'P1-4', 'P1-4b',
    'P1-8d', 'P1-8e', 'P1-8f',
    'P2-1', 'P2-14B', 'P2-14C', 'P2-14D', 'P2-14E', 'P2-16', 'P2-17', 'P2-19',
    'P3-1', 'P3-2', 'P3-3', 'P3-4d', 'P3-4e', 'P3-4f',
    'P4-4', 'P4-5', 'P4-6',
  ];

  const p0Results = report.checkpoints.filter(c => P0_CHECKS.includes(c.id));
  const p0Failed = p0Results.filter(c => c.result === 'FAIL').length;
  const p0Passed = p0Results.filter(c => c.result === 'PASS').length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`P0 Critical Checks: ${p0Passed}/${p0Results.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (p0Failed > 0) {
    console.log(`❌ ${p0Failed} P0 checks failed — test FAILED`);
    const failed = p0Results.filter(c => c.result === 'FAIL');
    failed.forEach(c => console.log(`   ❌ ${c.id}: ${c.description}`));
    process.exit(1);
  } else {
    console.log('✅ All P0 checks passed');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
