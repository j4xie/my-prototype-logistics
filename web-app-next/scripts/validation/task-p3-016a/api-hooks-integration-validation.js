/**
 * @task TASK-P3-016A
 * @module API Hook系统集成验证
 * @validation-type api-hooks-integration
 * @description 深入验证API Hook与现有项目代码的集成问题，重点发现原本代码问题
 * @reports-to scripts/validation/task-p3-016a/reports/
 */

const VALIDATION_META = {
  taskId: 'TASK-P3-016A',
  validationType: 'api-hooks-integration',
  module: 'API Hook系统集成验证',
  reportPath: 'scripts/validation/task-p3-016a/reports/'
};

const fs = require('fs');
const path = require('path');

/**
 * 验证结果收集器
 */
class ValidationCollector {
  constructor() {
    this.results = {
      meta: VALIDATION_META,
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      tests: [],
      codeProblems: [],
      recommendations: []
    };
  }

  addTest(name, status, details = null, codeProblems = []) {
    this.results.tests.push({
      name,
      status,
      details,
      codeProblems
    });
    
    this.results.summary.total++;
    if (status === 'PASS') this.results.summary.passed++;
    else if (status === 'FAIL') this.results.summary.failed++;
    else if (status === 'WARN') this.results.summary.warnings++;

    // 收集发现的代码问题
    if (codeProblems.length > 0) {
      this.results.codeProblems.push(...codeProblems);
    }
  }

  addRecommendation(category, issue, solution) {
    this.results.recommendations.push({
      category,
      issue,
      solution
    });
  }

  report() {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportFile = path.join(reportDir, `api-hooks-integration-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
    
    console.log('\n📊 TASK-P3-016A API Hook集成验证报告');
    console.log('='.repeat(50));
    console.log(`✅ 通过: ${this.results.summary.passed}`);
    console.log(`❌ 失败: ${this.results.summary.failed}`);
    console.log(`⚠️  警告: ${this.results.summary.warnings}`);
    console.log(`📁 报告: ${reportFile}`);
    
    if (this.results.codeProblems.length > 0) {
      console.log('\n🔍 发现的代码问题:');
      this.results.codeProblems.forEach((problem, i) => {
        console.log(`${i + 1}. ${problem.type}: ${problem.description}`);
        if (problem.location) console.log(`   位置: ${problem.location}`);
        if (problem.impact) console.log(`   影响: ${problem.impact}`);
      });
    }

    return this.results;
  }
}

/**
 * 验证API客户端基础功能
 */
async function validateApiClientIntegration(collector) {
  console.log('\n🔍 验证API客户端基础集成...');
  
  try {
    // 检查API客户端文件
    const apiClientPath = path.join(__dirname, '../../../src/lib/api.ts');
    if (!fs.existsSync(apiClientPath)) {
      collector.addTest('API客户端文件存在性', 'FAIL', 'api.ts文件不存在', [
        {
          type: 'Missing File',
          description: 'API客户端文件缺失',
          location: 'src/lib/api.ts',
          impact: '阻塞所有API调用功能'
        }
      ]);
      return;
    }

    // 读取并分析API客户端代码
    const apiContent = fs.readFileSync(apiClientPath, 'utf8');
    
    // 检查关键功能
    const checks = [
      {
        name: '错误处理机制',
        pattern: /class ApiError|class NetworkError/g,
        required: true
      },
      {
        name: '认证Token管理',
        pattern: /setAuthToken|getAuthToken/g,
        required: true
      },
      {
        name: '重试机制',
        pattern: /retryAttempts|requestWithRetry/g,
        required: true
      },
      {
        name: '超时处理',
        pattern: /timeout|AbortController/g,
        required: true
      },
      {
        name: '文件上传功能',
        pattern: /uploadFile|FormData/g,
        required: false
      }
    ];

    let codeProblems = [];

    checks.forEach(check => {
      const matches = apiContent.match(check.pattern);
      if (check.required && !matches) {
        collector.addTest(`API客户端-${check.name}`, 'FAIL', '必需功能缺失', [
          {
            type: 'Missing Feature',
            description: `API客户端缺少${check.name}功能`,
            location: 'src/lib/api.ts',
            impact: '可能导致API调用不稳定'
          }
        ]);
        codeProblems.push({
          type: 'Architecture Issue',
          description: `API客户端缺少${check.name}`,
          location: 'src/lib/api.ts',
          impact: 'API调用可靠性受影响'
        });
      } else {
        collector.addTest(`API客户端-${check.name}`, 'PASS', matches ? `发现${matches.length}处实现` : '可选功能');
      }
    });

    // 检查配置灵活性
    if (!apiContent.includes('baseURL') || !apiContent.includes('NEXT_PUBLIC_API_BASE_URL')) {
      codeProblems.push({
        type: 'Configuration Issue',
        description: 'API基础URL配置不灵活',
        location: 'src/lib/api.ts',
        impact: '部署时需要修改代码'
      });
    }

    if (codeProblems.length === 0) {
      collector.addTest('API客户端架构质量', 'PASS', 'API客户端架构设计合理');
    } else {
      collector.addTest('API客户端架构质量', 'WARN', `发现${codeProblems.length}个潜在问题`, codeProblems);
    }

  } catch (error) {
    collector.addTest('API客户端集成验证', 'FAIL', error.message, [
      {
        type: 'Validation Error',
        description: '验证过程异常',
        location: 'api-client integration',
        impact: '无法确定API客户端状态'
      }
    ]);
  }
}

/**
 * 验证Hook架构设计
 */
async function validateHookArchitecture(collector) {
  console.log('\n🔍 验证Hook架构设计...');
  
  try {
    const hookPath = path.join(__dirname, '../../../src/hooks/useApi-simple.ts');
    if (!fs.existsSync(hookPath)) {
      collector.addTest('Hook文件存在性', 'FAIL', 'useApi-simple.ts文件不存在');
      return;
    }

    const hookContent = fs.readFileSync(hookPath, 'utf8');
    let architectureProblems = [];

    // 检查Hook设计原则
    const hookChecks = [
      {
        name: 'React Hook规范',
        pattern: /^function use[A-Z]/gm,
        validator: (content) => {
          // 检查是否所有导出的函数都遵循Hook命名规范
          const exportedFunctions = content.match(/export function (\w+)/g) || [];
          const nonHookFunctions = exportedFunctions.filter(func => 
            !func.includes('use') && !func.includes('login') && !func.includes('clearCache')
          );
          return nonHookFunctions.length === 0;
        }
      },
      {
        name: '状态管理一致性',
        pattern: /useState.*ApiStatus|loading|error|data/g,
        validator: (content) => content.includes('useState') && content.includes('UseApiResult')
      },
      {
        name: '缓存机制实现',
        pattern: /cache.*Map|TTL|timestamp/g,
        validator: (content) => content.includes('new Map') && content.includes('timestamp')
      },
      {
        name: '错误处理统一性',
        pattern: /catch.*error|Error/g,
        validator: (content) => content.includes('catch') && content.includes('error as Error')
      }
    ];

    hookChecks.forEach(check => {
      const isValid = check.validator ? check.validator(hookContent) : hookContent.match(check.pattern);
      
      if (!isValid) {
        architectureProblems.push({
          type: 'Hook Design Issue',
          description: `Hook架构不符合${check.name}标准`,
          location: 'src/hooks/useApi-simple.ts',
          impact: 'Hook可能存在性能或稳定性问题'
        });
        collector.addTest(`Hook架构-${check.name}`, 'FAIL', '不符合标准', [architectureProblems[architectureProblems.length - 1]]);
      } else {
        collector.addTest(`Hook架构-${check.name}`, 'PASS', '符合标准');
      }
    });

    // 检查业务Hook的完整性
    const businessHooks = ['useAuth', 'useTrace', 'useProduct', 'useUser'];
    businessHooks.forEach(hookName => {
      if (!hookContent.includes(`export function ${hookName}`)) {
        architectureProblems.push({
          type: 'Missing Business Hook',
          description: `缺少业务Hook: ${hookName}`,
          location: 'src/hooks/useApi-simple.ts',
          impact: '业务功能不完整'
        });
        collector.addTest(`业务Hook-${hookName}`, 'FAIL', 'Hook缺失', [architectureProblems[architectureProblems.length - 1]]);
      } else {
        collector.addTest(`业务Hook-${hookName}`, 'PASS', 'Hook已实现');
      }
    });

  } catch (error) {
    collector.addTest('Hook架构验证', 'FAIL', error.message);
  }
}

/**
 * 验证Mock API兼容性
 */
async function validateMockApiCompatibility(collector) {
  console.log('\n🔍 验证Mock API兼容性...');
  
  try {
    // 检查API路由配置
    const apiRoutesPath = path.join(__dirname, '../../../src/app/api');
    if (!fs.existsSync(apiRoutesPath)) {
      collector.addTest('Mock API路由存在性', 'FAIL', 'API路由目录不存在', [
        {
          type: 'Missing API Routes',
          description: 'Mock API路由目录缺失',
          location: 'src/app/api',
          impact: 'API Hook无法与Mock API集成'
        }
      ]);
      return;
    }

    // 检查关键API端点
    const requiredEndpoints = [
      'auth/login',
      'auth/status',
      'auth/logout',
      'trace',
      'products',
      'users/profile'
    ];

    let missingEndpoints = [];
    requiredEndpoints.forEach(endpoint => {
      const endpointPath = path.join(apiRoutesPath, endpoint);
      if (!fs.existsSync(endpointPath) && !fs.existsSync(endpointPath + '/route.ts') && !fs.existsSync(endpointPath + '.ts')) {
        missingEndpoints.push(endpoint);
      }
    });

    if (missingEndpoints.length > 0) {
      collector.addTest('Mock API端点完整性', 'FAIL', `缺少${missingEndpoints.length}个端点`, [
        {
          type: 'Missing API Endpoints',
          description: `缺少API端点: ${missingEndpoints.join(', ')}`,
          location: 'src/app/api',
          impact: 'Hook调用将失败'
        }
      ]);
    } else {
      collector.addTest('Mock API端点完整性', 'PASS', '所有必需端点已实现');
    }

    // 验证API响应格式一致性
    collector.addRecommendation(
      'API Design',
      'Mock API响应格式需要与真实API保持一致',
      '建立API响应格式规范，确保Mock和真实API的兼容性'
    );

  } catch (error) {
    collector.addTest('Mock API兼容性验证', 'FAIL', error.message);
  }
}

/**
 * 验证测试页面实用性
 */
async function validateTestPageUtility(collector) {
  console.log('\n🔍 验证测试页面实用性...');
  
  try {
    const testPagePath = path.join(__dirname, '../../../src/components/test/ApiTestPage.tsx');
    if (!fs.existsSync(testPagePath)) {
      collector.addTest('测试页面存在性', 'FAIL', 'ApiTestPage.tsx文件不存在');
      return;
    }

    const pageContent = fs.readFileSync(testPagePath, 'utf8');
    let usabilityProblems = [];

    // 检查测试页面功能完整性
    const requiredFeatures = [
      { name: '登录功能测试', pattern: /login.*form|handleLogin/gi },
      { name: 'Hook状态显示', pattern: /loading.*error.*data/gi },
      { name: '手动刷新功能', pattern: /refetch|refresh/gi },
      { name: '错误状态展示', pattern: /error.*message|text-red/gi },
      { name: '测试说明文档', pattern: /测试说明|使用说明/gi }
    ];

    requiredFeatures.forEach(feature => {
      if (!pageContent.match(feature.pattern)) {
        usabilityProblems.push({
          type: 'Missing Test Feature',
          description: `测试页面缺少${feature.name}`,
          location: 'src/components/test/ApiTestPage.tsx',
          impact: '测试体验不完整'
        });
        collector.addTest(`测试页面-${feature.name}`, 'FAIL', '功能缺失', [usabilityProblems[usabilityProblems.length - 1]]);
      } else {
        collector.addTest(`测试页面-${feature.name}`, 'PASS', '功能已实现');
      }
    });

    // 检查UI/UX设计质量
    if (!pageContent.includes('Tailwind') && !pageContent.includes('className')) {
      usabilityProblems.push({
        type: 'UI Design Issue',
        description: '测试页面缺少样式设计',
        location: 'src/components/test/ApiTestPage.tsx',
        impact: '测试体验较差'
      });
    }

    if (usabilityProblems.length === 0) {
      collector.addTest('测试页面整体质量', 'PASS', '测试页面设计合理');
    } else {
      collector.addTest('测试页面整体质量', 'WARN', `发现${usabilityProblems.length}个改进点`, usabilityProblems);
    }

  } catch (error) {
    collector.addTest('测试页面验证', 'FAIL', error.message);
  }
}

/**
 * 主验证流程
 */
async function runValidation() {
  const collector = new ValidationCollector();
  
  console.log('🚀 启动TASK-P3-016A API Hook集成深度验证');
  console.log('📋 验证重点: 发现原本项目代码问题，而非修改测试');
  
  await validateApiClientIntegration(collector);
  await validateHookArchitecture(collector);
  await validateMockApiCompatibility(collector);
  await validateTestPageUtility(collector);
  
  // 生成改进建议
  if (collector.results.codeProblems.length > 0) {
    collector.addRecommendation(
      'Architecture',
      '发现多个代码架构问题',
      '建议按优先级逐步修复发现的问题，重点关注P0级别的阻塞性问题'
    );
  }
  
  collector.addRecommendation(
    'Integration',
    'Hook与现有API的集成需要更深入测试',
    '建议创建端到端测试场景，验证完整的用户交互流程'
  );

  const results = collector.report();
  
  // 返回验证结果
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// 执行验证
if (require.main === module) {
  runValidation().catch(error => {
    console.error('❌ 验证过程发生错误:', error);
    process.exit(1);
  });
}

module.exports = { runValidation, VALIDATION_META }; 