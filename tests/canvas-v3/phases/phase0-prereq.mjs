// tests/canvas-v3/phases/phase0-prereq.mjs
import { execSync } from 'child_process';

export async function phase0Prereq() {
  console.log('=== Phase 0: Prerequisites ===');
  const results = [];

  // Check 1: Backend health
  try {
    const health = execSync('curl -s http://139.196.165.140:8086/api/mobile/health', { encoding: 'utf8' });
    const parsed = JSON.parse(health);
    results.push({ check: 'backend_health', pass: parsed.status === 'UP', data: parsed });
  } catch (e) {
    results.push({ check: 'backend_health', pass: false, error: e.message });
  }

  // Check 2: Canvas tables exist
  try {
    const tables = execSync(
      `ssh root@47.100.235.168 "PGPASSWORD=cretas123 psql -h localhost -U cretas_user -d cretas_prod_db -t -A -c \\"SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'canvas%';\\""`,
      { encoding: 'utf8' }
    );
    const hasField = tables.includes('canvas_dynamic_field');
    const hasLog = tables.includes('canvas_ddl_log');
    results.push({ check: 'canvas_tables', pass: hasField && hasLog, data: tables.trim() });
  } catch (e) {
    results.push({ check: 'canvas_tables', pass: false, error: e.message });
  }

  const allPassed = results.every(r => r.pass);
  console.log(`Phase 0: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  results.forEach(r => console.log(`  ${r.pass ? '✅' : '❌'} ${r.check}${r.error ? ': ' + r.error : ''}`));
  return { phase: 'phase0', pass: allPassed, results };
}
