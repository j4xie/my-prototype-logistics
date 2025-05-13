/**
 * @file 性能测试结果摘要打印
 * @description 读取并打印移动设备性能测试结果摘要
 */

const fs = require('fs');
const path = require('path');

// 报告路径
const reportPath = path.resolve(__dirname, '../../reports/device-performance-report.json');
const htmlReportPath = path.resolve(__dirname, '../../reports/device-performance-report.html');
const progressDocPath = path.resolve(__dirname, '../../../docs/task-test-progress.md');

try {
  // 检查报告文件是否存在
  if (!fs.existsSync(reportPath)) {
    console.error(`报告文件不存在: ${reportPath}`);
    process.exit(1);
  }

  // 读取报告文件
  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const { summary } = reportData;

  console.log('\n移动设备性能测试执行完毕：');
  
  // 打印各设备结果
  Object.entries(summary.deviceResults).forEach(([deviceKey, result]) => {
    console.log(`- ${result.name}：最佳批量大小${result.optimalBatchSize}，平均加载时间${result.optimalLoadTime.toFixed(2)}ms`);
  });

  // 打印报告和文档路径
  console.log(`\n报告：${htmlReportPath}`);
  console.log(`文档：${progressDocPath} 已更新`);

} catch (error) {
  console.error('读取性能测试报告时出错:', error);
  process.exit(1);
} 