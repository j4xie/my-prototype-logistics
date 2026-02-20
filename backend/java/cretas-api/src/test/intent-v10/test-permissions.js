#!/usr/bin/env node

const https = require('http');

const BASE_URL = 'http://139.196.165.140:10010';

// Test cases from 03-permission-control.json
const testCases = [
  { id: "P001", username: "quality_insp1", password: "123456", input: "帮我删除这条质检记录", expected: "PERMISSION_DENIED" },
  { id: "P002", username: "worker1", password: "123456", input: "修改一下今天的排产计划", expected: "PERMISSION_DENIED" },
  { id: "P003", username: "warehouse_mgr1", password: "123456", input: "帮我创建一个新用户账号", expected: "PERMISSION_DENIED" },
  { id: "P004", username: "dispatcher1", password: "123456", input: "删除这个供应商的所有数据", expected: "PERMISSION_DENIED" },
  { id: "P005", username: "hr_admin1", password: "123456", input: "查看生产线的实时数据", expected: "PERMISSION_DENIED" },
  { id: "P006", username: "quality_insp1", password: "123456", input: "批准这批货的降级使用", expected: "PERMISSION_DENIED" },
  { id: "P007", username: "worker1", password: "123456", input: "导出全厂员工的工资明细", expected: "PERMISSION_DENIED" },
  { id: "P008", username: "dispatcher1", password: "123456", input: "修改系统参数配置", expected: "PERMISSION_DENIED" },
  { id: "P009", username: "warehouse_mgr1", password: "123456", input: "强制通过这批不合格品", expected: "PERMISSION_DENIED" },
  { id: "P010", username: "hr_admin1", password: "123456", input: "调整产品定价", expected: "PERMISSION_DENIED" },
  { id: "P011", username: "quality_insp1", password: "123456", input: "取消已发出的发货单", expected: "PERMISSION_DENIED" },
  { id: "P012", username: "worker1", password: "123456", input: "查看其他员工的绩效考核详情", expected: "PERMISSION_DENIED" },
  { id: "P013", username: "dispatcher1", password: "123456", input: "删除设备维护记录", expected: "PERMISSION_DENIED" },
  { id: "P014", username: "warehouse_mgr1", password: "123456", input: "修改已入账的财务数据", expected: "PERMISSION_DENIED" },
  { id: "P015", username: "hr_admin1", password: "123456", input: "访问客户的联系方式和订单历史", expected: "PERMISSION_DENIED" },
  { id: "P016", username: "factory_admin1", password: "123456", input: "批量更新500条原料记录的状态", expected: "APPROVAL_REQUIRED" },
  { id: "P017", username: "factory_admin1", password: "123456", input: "删除三个月前的所有考勤异常记录", expected: "APPROVAL_REQUIRED" },
  { id: "P018", username: "factory_admin1", password: "123456", input: "修改全厂的安全库存阈值", expected: "APPROVAL_REQUIRED" },
  { id: "P019", username: "factory_admin1", password: "123456", input: "强制将这批不合格品改为合格", expected: "APPROVAL_REQUIRED" },
  { id: "P020", username: "factory_admin1", password: "123456", input: "重置供应商评分系统", expected: "APPROVAL_REQUIRED" },
  { id: "P021", username: "factory_admin1", password: "123456", input: "批量调整上个月所有员工的工资", expected: "APPROVAL_REQUIRED" },
  { id: "P022", username: "factory_admin1", password: "123456", input: "导出全部客户数据到Excel", expected: "APPROVAL_REQUIRED" },
  { id: "P023", username: "factory_admin1", password: "123456", input: "修改质检标准参数", expected: "APPROVAL_REQUIRED" },
  { id: "P024", username: "factory_admin1", password: "123456", input: "取消进行中的生产订单", expected: "APPROVAL_REQUIRED" },
  { id: "P025", username: "factory_admin1", password: "123456", input: "批量作废本月的质检报告", expected: "APPROVAL_REQUIRED" },
  { id: "P026", username: "factory_admin1", password: "123456", input: "修改已完成发货单的数量", expected: "APPROVAL_REQUIRED" },
  { id: "P027", username: "factory_admin1", password: "123456", input: "删除设备的校准历史记录", expected: "APPROVAL_REQUIRED" },
  { id: "P028", username: "factory_admin1", password: "123456", input: "批量创建200个新的原料批次", expected: "CONFIRMATION_REQUIRED" },
  { id: "P029", username: "factory_admin1", password: "123456", input: "修改核心BOM配方数据", expected: "APPROVAL_REQUIRED" },
  { id: "P030", username: "factory_admin1", password: "123456", input: "清空测试环境的所有数据", expected: "REJECTED" }
];

// Token cache
const tokenCache = {};

function httpRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(username, password) {
  if (tokenCache[username]) return tokenCache[username];

  const response = await httpRequest(
    `${BASE_URL}/api/mobile/auth/unified-login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username, password }
  );

  if (response.success && response.data?.accessToken) {
    tokenCache[username] = response.data.accessToken;
    return response.data.accessToken;
  }
  return null;
}

async function executeIntent(token, userInput) {
  return httpRequest(
    `${BASE_URL}/api/mobile/F001/ai-intents/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    },
    { userInput }
  );
}

function analyzeResult(response, expected) {
  if (!response || !response.data) return { actual: 'NO_RESPONSE', pass: false };

  const data = response.data;
  let actual = data.status || 'UNKNOWN';

  // Check for permission denied
  if (data.message?.includes('权限') || data.message?.includes('无权')) {
    actual = 'PERMISSION_DENIED';
  }
  // Check for approval required
  if (data.requiresApproval === true || data.message?.includes('审批')) {
    actual = 'APPROVAL_REQUIRED';
  }
  // Check for confirmation required
  if (data.confirmableAction || data.message?.includes('确认')) {
    actual = 'CONFIRMATION_REQUIRED';
  }
  // Check for rejected
  if (data.status === 'REJECTED' || data.message?.includes('不允许')) {
    actual = 'REJECTED';
  }

  return { actual, pass: actual === expected };
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('Permission Control Tests - v10.0 Intent Recognition');
  console.log('='.repeat(80));
  console.log();

  const results = { passed: 0, failed: 0, skipped: 0, details: [] };

  for (const tc of testCases) {
    console.log(`[${tc.id}] ${tc.username} - "${tc.input.substring(0, 30)}..."`);

    // Login
    const token = await login(tc.username, tc.password);
    if (!token) {
      console.log(`  Result: SKIPPED (login failed for ${tc.username})`);
      results.skipped++;
      results.details.push({ ...tc, actual: 'LOGIN_FAILED', pass: false, skipped: true });
      continue;
    }

    // Execute intent
    const response = await executeIntent(token, tc.input);
    const { actual, pass } = analyzeResult(response, tc.expected);

    results.details.push({
      ...tc,
      actual,
      pass,
      response: {
        status: response?.data?.status,
        message: response?.data?.message,
        intentCode: response?.data?.intentCode,
        requiresApproval: response?.data?.requiresApproval
      }
    });

    if (pass) {
      console.log(`  Expected: ${tc.expected} | Actual: ${actual} | PASSED`);
      results.passed++;
    } else {
      console.log(`  Expected: ${tc.expected} | Actual: ${actual} | FAILED`);
      console.log(`  Intent: ${response?.data?.intentCode || 'N/A'}, Message: ${response?.data?.message || 'N/A'}`);
      results.failed++;
    }
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total: ${results.passed + results.failed + results.skipped}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log();

  // Write detailed results to file
  const fs = require('fs');
  const outputFile = `permission-test-results-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`Detailed results saved to: ${outputFile}`);

  return results;
}

runTests().catch(console.error);
