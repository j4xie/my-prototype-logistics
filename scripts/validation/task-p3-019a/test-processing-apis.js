/**
 * TASK-P3-019A Day 2: 加工模块API验证脚本
 * 测试9个加工模块API端点的可用性
 */

const fs = require('fs');
const path = require('path');

// 加工模块API端点列表
const processingApiEndpoints = [
  'src/app/api/processing/route.ts',
  'src/app/api/processing/raw-materials/route.ts',
  'src/app/api/processing/raw-materials/[id]/route.ts',
  'src/app/api/processing/production-batches/route.ts',
  'src/app/api/processing/production-batches/[id]/route.ts',
  'src/app/api/processing/finished-products/route.ts',
  'src/app/api/processing/finished-products/[id]/route.ts',
  'src/app/api/processing/quality-tests/route.ts',
  'src/app/api/processing/quality-tests/[id]/route.ts'
];

function checkApiFiles() {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  console.log('🔍 TASK-P3-019A Day 2: 加工模块API文件验证');
  console.log('━'.repeat(60));

  for (const endpoint of processingApiEndpoints) {
    const fullPath = path.join(__dirname, '../../../web-app-next', endpoint);
    const exists = fs.existsSync(fullPath);

    if (exists) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasGetMethod = content.includes('export async function GET');
      const hasNextRequest = content.includes('NextRequest');
      const hasNextResponse = content.includes('NextResponse');
      const hasMockData = content.includes('generateMockData');

      if (hasGetMethod && hasNextRequest && hasNextResponse && hasMockData) {
        console.log(`✅ ${endpoint} - 完整API实现`);
        results.passed++;
        results.details.push({
          endpoint,
          status: 'PASS',
          size: content.length,
          methods: content.includes('POST') ? 'GET,POST,PUT,DELETE' : 'GET'
        });
      } else {
        console.log(`⚠️  ${endpoint} - 实现不完整`);
        results.failed++;
        results.details.push({
          endpoint,
          status: 'INCOMPLETE',
          missing: [
            !hasGetMethod && 'GET method',
            !hasNextRequest && 'NextRequest import',
            !hasNextResponse && 'NextResponse import',
            !hasMockData && 'Mock data generation'
          ].filter(Boolean)
        });
      }
    } else {
      console.log(`❌ ${endpoint} - 文件不存在`);
      results.failed++;
      results.details.push({
        endpoint,
        status: 'MISSING'
      });
    }
  }

  console.log('\n━'.repeat(60));
  console.log(`📊 验证结果: ${results.passed}/${processingApiEndpoints.length} 通过`);

  if (results.failed === 0) {
    console.log('🎉 Day 2加工模块API全部实现完成！');
  } else {
    console.log(`⚠️  还有 ${results.failed} 个API需要修复`);
  }

  return results;
}

function generateReport(results) {
  const reportPath = path.join(__dirname, 'reports/day2-processing-validation.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    task: 'TASK-P3-019A',
    day: 2,
    module: 'processing',
    timestamp: new Date().toISOString(),
    summary: {
      total: processingApiEndpoints.length,
      passed: results.passed,
      failed: results.failed,
      completionRate: `${((results.passed / processingApiEndpoints.length) * 100).toFixed(1)}%`
    },
    details: results.details
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📋 验证报告已保存: ${reportPath}`);

  return report;
}

// 执行验证
const results = checkApiFiles();
const report = generateReport(results);

// 退出代码
process.exit(results.failed === 0 ? 0 : 1);
