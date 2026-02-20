#!/usr/bin/env node

/**
 * v10.0 意图识别系统测试运行器
 * 支持并行执行、详细报告、自学习验证
 */

const https = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    ENDPOINT_PUBLIC: 'http://139.196.165.140:10010/api/public/ai-demo/execute',
    ENDPOINT_AUTH: 'http://139.196.165.140:10010/api/mobile/F001/ai/execute',
    LOGIN_ENDPOINT: 'http://139.196.165.140:10010/api/mobile/auth/unified-login',
    FACTORY_ID: 'F001',
    TIMEOUT: 30000,
    DELAY_BETWEEN_TESTS: 500,
    MAX_CONCURRENT: 5
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(colors[color] || '', ...args, colors.reset);
}

// HTTP 请求函数
async function httpRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: CONFIG.TIMEOUT
        };

        const req = https.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body, parseError: true });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// 获取登录Token
async function getToken(username, password) {
    try {
        const response = await httpRequest(CONFIG.LOGIN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username, password });

        return response?.data?.accessToken || '';
    } catch (e) {
        log('red', `Login failed for ${username}: ${e.message}`);
        return '';
    }
}

// 执行单个测试
async function runTestCase(testCase, token = null) {
    const startTime = Date.now();
    const endpoint = token ? CONFIG.ENDPOINT_AUTH : CONFIG.ENDPOINT_PUBLIC;
    const headers = { 'Content-Type': 'application/json' };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await httpRequest(endpoint, {
            method: 'POST',
            headers
        }, { userInput: testCase.input });

        const duration = Date.now() - startTime;
        const result = analyzeResult(testCase, response, duration);

        // 输出结果
        const icon = result.passed ? '✅' : '❌';
        const color = result.passed ? 'green' : 'red';
        log(color, `${icon} [${testCase.id}] ${result.passed ? 'PASS' : 'FAIL'} - Intent: ${result.actual} (conf: ${result.confidence}) [${duration}ms]`);

        if (!result.passed) {
            log('yellow', `   Input: ${testCase.input.substring(0, 60)}...`);
            log('yellow', `   Expected: ${testCase.expectedIntent || testCase.expectedResult}, Got: ${result.actual}`);
            if (result.reason) {
                log('yellow', `   Reason: ${result.reason}`);
            }
        }

        return result;
    } catch (e) {
        const duration = Date.now() - startTime;
        log('red', `❌ [${testCase.id}] ERROR - ${e.message} [${duration}ms]`);

        return {
            id: testCase.id,
            passed: false,
            expected: testCase.expectedIntent || testCase.expectedResult,
            actual: 'ERROR',
            confidence: 0,
            reason: e.message,
            duration
        };
    }
}

// 分析测试结果
function analyzeResult(testCase, response, duration) {
    const result = {
        id: testCase.id,
        passed: false,
        expected: testCase.expectedIntent || testCase.expectedResult || 'UNKNOWN',
        actual: 'UNKNOWN',
        confidence: 0,
        reason: '',
        duration,
        response: null
    };

    if (!response || response.parseError) {
        result.reason = 'Invalid response';
        return result;
    }

    if (response.success === false) {
        result.reason = response.message || 'API returned failure';
        result.actual = 'API_FAILURE';
        return result;
    }

    const data = response.data || response;
    result.actual = data.intentCode || data.intent || data.type || 'UNKNOWN';
    result.confidence = data.confidence || 0;
    result.response = data.response || data.message || '';

    const expected = testCase.expectedIntent || testCase.expectedResult;
    const minConfidence = testCase.minConfidence || 0.5;

    // 检查是否需要澄清
    if (expected === 'NEED_CLARIFICATION') {
        if (data.needClarification === true || data.clarificationQuestions) {
            result.passed = true;
        } else if (result.actual === 'NEED_MORE_INFO' || result.actual === 'CLARIFICATION') {
            result.passed = true;
        } else {
            result.reason = 'Expected clarification request but did not receive one';
        }
        return result;
    }

    // 检查权限拒绝
    if (expected === 'PERMISSION_DENIED') {
        if (data.permissionDenied === true || result.actual === 'PERMISSION_DENIED' ||
            (result.response && result.response.includes('权限'))) {
            result.passed = true;
        } else {
            result.reason = 'Expected permission denial';
        }
        return result;
    }

    // 检查需要审批
    if (expected === 'APPROVAL_REQUIRED' || expected === 'CONFIRMATION_REQUIRED') {
        if (data.requiresApproval === true || data.requiresConfirmation === true ||
            result.actual === 'APPROVAL_REQUIRED' ||
            (result.response && (result.response.includes('审批') || result.response.includes('确认')))) {
            result.passed = true;
        } else {
            result.reason = 'Expected approval/confirmation requirement';
        }
        return result;
    }

    // 标准意图匹配
    if (result.actual === expected) {
        if (result.confidence >= minConfidence) {
            result.passed = true;
        } else {
            result.reason = `Confidence too low: ${result.confidence} < ${minConfidence}`;
        }
    } else {
        // 检查是否是等效意图
        const equivalentIntents = getEquivalentIntents(expected);
        if (equivalentIntents.includes(result.actual)) {
            result.passed = true;
        } else {
            result.reason = `Intent mismatch: expected ${expected}, got ${result.actual}`;
        }
    }

    // 检查响应格式 (如果指定)
    if (result.passed && testCase.expectedFormat === 'natural_language') {
        if (testCase.mustNotContain) {
            for (const forbidden of testCase.mustNotContain) {
                if (result.response && result.response.includes(forbidden)) {
                    result.passed = false;
                    result.reason = `Response contains forbidden pattern: ${forbidden}`;
                    break;
                }
            }
        }
    }

    return result;
}

// 获取等效意图 (处理命名差异)
function getEquivalentIntents(intent) {
    const equivalents = {
        'MATERIAL_BATCH_QUERY': ['MATERIAL_QUERY', 'INVENTORY_QUERY', 'MATERIAL_STOCK_QUERY'],
        'MATERIAL_INVENTORY_QUERY': ['MATERIAL_BATCH_QUERY', 'INVENTORY_QUERY', 'MATERIAL_STOCK_QUERY'],
        'QUALITY_CHECK_QUERY': ['QUALITY_QUERY', 'QC_QUERY', 'INSPECTION_QUERY'],
        'QUALITY_STATS': ['QUALITY_STATISTICS', 'QUALITY_REPORT', 'QUALITY_ANALYSIS'],
        'SHIPMENT_QUERY': ['DELIVERY_QUERY', 'SHIPPING_QUERY', 'ORDER_QUERY'],
        'SHIPMENT_STATS': ['DELIVERY_STATS', 'SHIPPING_STATISTICS'],
        'EQUIPMENT_STATUS_QUERY': ['EQUIPMENT_QUERY', 'DEVICE_STATUS', 'MACHINE_QUERY'],
        'EQUIPMENT_MAINTENANCE_QUERY': ['MAINTENANCE_QUERY', 'REPAIR_HISTORY'],
        'ATTENDANCE_ANOMALY': ['ATTENDANCE_EXCEPTION', 'ATTENDANCE_ALERT'],
        'ATTENDANCE_HISTORY': ['ATTENDANCE_QUERY', 'ATTENDANCE_RECORD'],
        'SCHEDULE_QUERY': ['PRODUCTION_PLAN_QUERY', 'PLANNING_QUERY'],
        'RAG_QUERY': ['KNOWLEDGE_QUERY', 'FAQ_QUERY', 'CONSULTATION'],
        'WEB_SEARCH': ['EXTERNAL_SEARCH', 'SEARCH_QUERY'],
        'PRODUCTION_STATS': ['PRODUCTION_REPORT', 'OUTPUT_STATS']
    };

    return equivalents[intent] || [intent];
}

// 运行测试类别
async function runCategory(categoryFile, parallel = false) {
    const categoryName = path.basename(categoryFile, '.json');
    log('blue', `\n${'='.repeat(50)}`);
    log('blue', `Running: ${categoryName}`);
    log('blue', `${'='.repeat(50)}\n`);

    const data = JSON.parse(fs.readFileSync(categoryFile, 'utf8'));
    const testCases = data.testCases || [];

    const results = [];
    let tokenCache = {};

    if (parallel) {
        // 并行执行 (限制并发数)
        const chunks = [];
        for (let i = 0; i < testCases.length; i += CONFIG.MAX_CONCURRENT) {
            chunks.push(testCases.slice(i, i + CONFIG.MAX_CONCURRENT));
        }

        for (const chunk of chunks) {
            const promises = chunk.map(async (tc) => {
                let token = null;
                if (tc.username) {
                    if (!tokenCache[tc.username]) {
                        tokenCache[tc.username] = await getToken(tc.username, tc.password);
                    }
                    token = tokenCache[tc.username];
                }
                return runTestCase(tc, token);
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults);
        }
    } else {
        // 串行执行
        for (const tc of testCases) {
            let token = null;
            if (tc.username) {
                if (!tokenCache[tc.username]) {
                    tokenCache[tc.username] = await getToken(tc.username, tc.password);
                }
                token = tokenCache[tc.username];
            }

            const result = await runTestCase(tc, token);
            results.push(result);

            // 添加延迟
            await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_TESTS));
        }
    }

    // 统计
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const rate = ((passed / results.length) * 100).toFixed(1);

    log('yellow', `\nCategory Summary: ${categoryName}`);
    log('cyan', `  Passed: ${passed} / ${results.length} (${rate}%)`);

    return {
        category: categoryName,
        description: data.description,
        passed,
        failed,
        total: results.length,
        rate: parseFloat(rate),
        results
    };
}

// 生成测试报告
function generateReport(categoryResults, outputFile) {
    const totalPassed = categoryResults.reduce((sum, c) => sum + c.passed, 0);
    const totalFailed = categoryResults.reduce((sum, c) => sum + c.failed, 0);
    const total = totalPassed + totalFailed;
    const overallRate = ((totalPassed / total) * 100).toFixed(1);

    const report = {
        timestamp: new Date().toISOString(),
        environment: {
            endpoint: CONFIG.ENDPOINT_PUBLIC,
            factoryId: CONFIG.FACTORY_ID
        },
        summary: {
            totalCases: total,
            passed: totalPassed,
            failed: totalFailed,
            passRate: parseFloat(overallRate)
        },
        categories: categoryResults.map(c => ({
            name: c.category,
            description: c.description,
            passed: c.passed,
            failed: c.failed,
            total: c.total,
            rate: c.rate
        })),
        failedTests: categoryResults.flatMap(c =>
            c.results.filter(r => !r.passed).map(r => ({
                category: c.category,
                id: r.id,
                expected: r.expected,
                actual: r.actual,
                reason: r.reason
            }))
        )
    };

    // 保存JSON报告
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));

    // 生成Markdown报告
    const mdReport = generateMarkdownReport(report);
    fs.writeFileSync(outputFile.replace('.json', '.md'), mdReport);

    return report;
}

// 生成Markdown报告
function generateMarkdownReport(report) {
    let md = `# v10.0 意图识别系统测试报告

**测试日期**: ${new Date(report.timestamp).toLocaleString('zh-CN')}
**测试环境**: ${report.environment.endpoint}
**工厂ID**: ${report.environment.factoryId}

## 执行摘要

| 指标 | 结果 |
|------|------|
| 总用例数 | ${report.summary.totalCases} |
| 通过数 | ${report.summary.passed} |
| 失败数 | ${report.summary.failed} |
| 通过率 | ${report.summary.passRate}% |

## 分类统计

| 类别 | 描述 | 通过/总数 | 通过率 |
|------|------|-----------|--------|
`;

    for (const cat of report.categories) {
        md += `| ${cat.name} | ${cat.description || '-'} | ${cat.passed}/${cat.total} | ${cat.rate}% |\n`;
    }

    if (report.failedTests.length > 0) {
        md += `\n## 失败用例详情\n\n`;
        md += `| 类别 | 用例ID | 预期 | 实际 | 原因 |\n`;
        md += `|------|--------|------|------|------|\n`;

        for (const test of report.failedTests) {
            md += `| ${test.category} | ${test.id} | ${test.expected} | ${test.actual} | ${test.reason} |\n`;
        }
    }

    md += `\n---\n*报告生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;

    return md;
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const casesDir = path.join(__dirname, '..', 'cases');
    const resultsDir = path.join(__dirname, '..', 'results');

    // 确保结果目录存在
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputFile = path.join(resultsDir, `test_results_${timestamp}.json`);

    let categories = [];

    if (args[0] === 'parallel' || args.includes('--parallel')) {
        // 并行运行所有类别
        log('blue', 'Running all test categories in parallel mode...\n');

        const caseFiles = fs.readdirSync(casesDir).filter(f => f.endsWith('.json'));
        const promises = caseFiles.map(f => runCategory(path.join(casesDir, f), true));
        categories = await Promise.all(promises);

    } else if (args[0] && args[0] !== 'all') {
        // 运行指定类别
        const categoryFile = path.join(casesDir, args[0] + '.json');
        if (!fs.existsSync(categoryFile)) {
            log('red', `Category file not found: ${categoryFile}`);
            process.exit(1);
        }
        categories = [await runCategory(categoryFile, args.includes('--parallel'))];

    } else {
        // 串行运行所有类别
        log('blue', 'Running all test categories...\n');

        const caseFiles = fs.readdirSync(casesDir).filter(f => f.endsWith('.json')).sort();
        for (const f of caseFiles) {
            const result = await runCategory(path.join(casesDir, f));
            categories.push(result);
        }
    }

    // 生成报告
    const report = generateReport(categories, outputFile);

    // 打印最终摘要
    log('blue', `\n${'='.repeat(50)}`);
    log('blue', 'FINAL SUMMARY');
    log('blue', `${'='.repeat(50)}`);
    log('cyan', `  Total Passed: ${report.summary.passed}`);
    log('cyan', `  Total Failed: ${report.summary.failed}`);
    log('cyan', `  Total Cases: ${report.summary.totalCases}`);
    log('cyan', `  Pass Rate: ${report.summary.passRate}%`);
    log('cyan', `\n  Report saved to: ${outputFile}`);
    log('cyan', `  Markdown report: ${outputFile.replace('.json', '.md')}`);

    // 返回退出码
    process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Test runner failed:', e);
    process.exit(1);
});
