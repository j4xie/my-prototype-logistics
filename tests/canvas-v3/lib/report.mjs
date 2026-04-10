// tests/canvas-v3/lib/report.mjs
import fs from 'fs';
import path from 'path';

export class Report {
  constructor() {
    this.phases = [];
    this.startTime = new Date();
    this.factoryId = null;
    this.checkpoints = [];
  }

  addPhase(phase) {
    this.phases.push(phase);
  }

  addCheckpoint(id, description, result, evidence = null, warning = null) {
    this.checkpoints.push({ id, description, result, evidence, warning });
  }

  summarize() {
    const total = this.checkpoints.length;
    const passed = this.checkpoints.filter(c => c.result === 'PASS').length;
    const failed = this.checkpoints.filter(c => c.result === 'FAIL').length;
    const warnings = this.checkpoints.filter(c => c.result === 'WARN').length;
    const knownBugs = this.checkpoints.filter(c => c.result === 'KNOWN_BUG' || c.result === 'KNOWN_GAP').length;
    const skipped = this.checkpoints.filter(c => c.result === 'SKIP').length;
    const executed = total - skipped;

    return {
      total,
      passed,
      failed,
      warnings,
      knownBugs,
      skipped,
      passRate: executed > 0 ? `${((passed / executed) * 100).toFixed(1)}%` : 'N/A',
      duration: `${((new Date() - this.startTime) / 1000).toFixed(1)}s`,
    };
  }

  save(outputPath) {
    const report = {
      startTime: this.startTime.toISOString(),
      endTime: new Date().toISOString(),
      factoryId: this.factoryId,
      summary: this.summarize(),
      phases: this.phases,
      checkpoints: this.checkpoints,
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return report;
  }

  print() {
    const s = this.summarize();
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Canvas V3 Lifecycle Test Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total: ${s.total} | PASS: ${s.passed} | FAIL: ${s.failed} | WARN: ${s.warnings}`);
    console.log(`KNOWN_BUG/GAP: ${s.knownBugs} | SKIP: ${s.skipped}`);
    console.log(`Pass Rate: ${s.passRate} | Duration: ${s.duration}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    this.checkpoints.forEach(c => {
      const icon =
        c.result === 'PASS' ? '✅' :
        c.result === 'FAIL' ? '❌' :
        c.result === 'WARN' ? '⚠️' :
        c.result === 'KNOWN_BUG' || c.result === 'KNOWN_GAP' ? '🐛' : '⏭️';
      console.log(`${icon} ${c.id}: ${c.description}`);
      if (c.warning) console.log(`   ⚠️  ${c.warning}`);
    });
    console.log();
  }
}
