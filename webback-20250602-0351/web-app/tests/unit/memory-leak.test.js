/**
 * @file tests/unit/memory-leak.test.js
 * @description 内存泄漏报告测试
 * 
 * 验证内存泄漏检测报告是否通过阈值检查
 */

describe('内存泄漏报告', () => {
  let report;

  beforeAll(() => {
    try {
      // 尝试加载报告
      report = require('../../../reports/memory-leak-report.json');
    } catch (e) {
      console.warn('无法加载内存泄漏报告，测试可能会失败:', e.message);
    }
  });

  test('内存泄漏报告应该存在', () => {
    expect(report).toBeDefined();
  });

  test('内存泄漏报告应该通过阈值检查', () => {
    expect(report.conclusion.passed).toBe(true);
    
    // 打印关键内存泄漏指标供分析
    if (report) {
      console.log('内存泄漏报告结果:');
      console.log(`- 总增长: ${report.memoryGrowth.totalGrowthMB.toFixed(2)} MB`);
      console.log(`- 每分钟增长率: ${report.memoryGrowth.growthRatePerMinuteMB.toFixed(4)} MB/分钟`);
      console.log(`- 测试结果: ${report.conclusion.status}`);
      console.log(`- 阈值: ${report.conclusion.threshold}, 实际值: ${report.conclusion.actual}`);
    }
  });

  test('内存泄漏增长率应在可接受范围内', () => {
    // 确保内存增长率在接受范围内
    const growthRatePerMinuteMB = report.memoryGrowth.growthRatePerMinuteMB;
    expect(growthRatePerMinuteMB).toBeLessThanOrEqual(0.2); // 每分钟不超过0.2MB
    
    // 检查总内存增长
    const totalGrowthMB = report.memoryGrowth.totalGrowthMB;
    expect(totalGrowthMB).toBeLessThanOrEqual(5.0); // 总体增长不超过5MB
  });
}); 