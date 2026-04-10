// tests/canvas-v3/run-lifecycle-test.mjs
import { ApiClient } from './lib/api-client.mjs';
import { Report } from './lib/report.mjs';
import { phase0Prereq } from './phases/phase0-prereq.mjs';
import { phase1Config } from './phases/phase1-config.mjs';

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

  // Future phases added here

  report.print();
  report.save(REPORT_PATH);
  console.log(`Report saved to: ${REPORT_PATH}`);
}

main().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
