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

  printCoverageMatrix() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Canvas V3 Capability Coverage Matrix');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const capabilities = [
      { name: '1. 动态字段 (DDL)', checks: ['P1-4', 'P1-4b', 'P1-8e', 'P1-8f', 'P2-2', 'P2-14C'] },
      { name: '2. 子表', checks: ['P1-4', 'P3-3', 'P4-4'] },
      { name: '3. 用户级权限', checks: ['P2-19'] },
      { name: '4. 文件上传', checks: ['P3-1'] },
      { name: '5. 条件渲染 visibleWhen', checks: ['P1-6'] },
      { name: '   条件渲染 computedWhen', checks: ['P1-7d'] },
      { name: '6. 聚合公式', checks: ['P1-7b'] },
      { name: '7. Tab 布局', checks: [] },
      { name: '验证规则存储', checks: ['P1-5', 'P3-2', 'P4-6'] },
      { name: '验证规则执行 ⚠️', checks: ['P2-5', 'P4-3', 'P2-14B', 'P2-14D'] },
      { name: '触发链存储', checks: ['P1-7'] },
      { name: '触发链执行 ⚠️', checks: ['P2-11'] },
      { name: '变更集流程', checks: ['P1-8a', 'P1-8b', 'P1-8c', 'P3-4a', 'P3-4b', 'P3-4c'] },
      { name: '发布 + DDL 执行', checks: ['P1-8d', 'P1-8e', 'P3-4d', 'P3-4e'] },
      { name: '多租户隔离 (正向)', checks: ['P2-16'] },
      { name: '多租户隔离 (拦截)', checks: ['P2-17'] },
      { name: 'DDL 类型冲突 (GAP)', checks: ['P2-18'] },
      { name: '配置变更传播', checks: ['P2-14A', 'P4-3', 'P4-6'] },
      { name: '旧数据完整性', checks: ['P4-1'] },
      { name: '全量一致性', checks: ['P4-5'] },
    ];

    capabilities.forEach(cap => {
      const relevant = this.checkpoints.filter(c => cap.checks.includes(c.id));
      const pass = relevant.filter(c => c.result === 'PASS').length;
      const fail = relevant.filter(c => c.result === 'FAIL').length;
      const gap = relevant.filter(c => c.result === 'KNOWN_GAP' || c.result === 'KNOWN_BUG').length;
      const warn = relevant.filter(c => c.result === 'WARN').length;
      const total = relevant.length;

      let status;
      if (total === 0) status = '⚪ 未测试';
      else if (fail > 0) status = '❌';
      else if (gap > 0 && pass === 0) status = '🐛';
      else if (pass === total) status = '✅';
      else if (pass > 0) status = '🟡';
      else status = '⚠️';

      const ratio = total > 0 ? `${pass}/${total}` : 'N/A';
      console.log(`${status} ${cap.name.padEnd(30)} ${ratio}${gap > 0 ? ` (${gap} GAP)` : ''}${warn > 0 ? ` (${warn} WARN)` : ''}`);
    });
    console.log();
  }
}
