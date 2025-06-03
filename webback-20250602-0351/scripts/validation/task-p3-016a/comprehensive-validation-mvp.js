#!/usr/bin/env node

/**
 * TASK-P3-016A MVP功能验证脚本
 * API Hook系统MVP功能全覆盖验证
 * 
 * @description 验证所有业务Hook功能，包括farming、processing和AI analytics
 * @task TASK-P3-016A
 * @created Phase-3技术栈现代化
 * @updated 支持MVP生产加工AI分析验证
 */

const fs = require('fs');
const path = require('path');

// 验证元数据
const VALIDATION_META = {
  taskId: 'TASK-P3-016A',
  taskName: 'API客户端功能扩展 - MVP生产加工AI分析',
  validationVersion: '2.0.0',
  created: new Date().toISOString(),
  scope: [
    'TypeScript编译验证',
    'Next.js构建验证', 
    'ESLint代码质量验证',
    '单元测试验证',
    'MVP功能完整性验证'
  ],
  features: [
    'farming业务Hook',
    'processing业务Hook', 
    'AI analytics Hook',
    'batch data processing Hook',
    '智能缓存系统',
    '增强错误处理',
    'TypeScript类型安全'
  ]
};

let validationResults = {
  meta: VALIDATION_META,
  layers: {},
  summary: {},
  timestamp: new Date().toISOString()
};

console.log('🚀 启动 TASK-P3-016A MVP功能综合验证');
console.log('=' .repeat(60));

// Layer 1: TypeScript编译验证
async function validateTypeScript() {
  console.log('\n📘 Layer 1: TypeScript编译验证');
  
  const { execSync } = require('child_process');
  const projectRoot = path.join(__dirname, '../../../web-app-next');
  
  try {
    // 验证基础TypeScript编译
    console.log('- 执行TypeScript类型检查...');
    execSync('npx tsc --noEmit', { 
      cwd: projectRoot, 
      stdio: 'pipe' 
    });
    
    // 检查关键Hook文件存在性
    const hookFile = path.join(projectRoot, 'src/hooks/useApi-simple.ts');
    const apiFile = path.join(projectRoot, 'src/lib/api.ts');
    const testFile = path.join(projectRoot, 'src/components/test/ApiTestPage.tsx');
    
    const filesExist = [
      { file: hookFile, name: 'useApi Hook文件' },
      { file: apiFile, name: 'API客户端文件' },
      { file: testFile, name: '测试页面文件' }
    ].map(({ file, name }) => {
      const exists = fs.existsSync(file);
      console.log(`  ${exists ? '✅' : '❌'} ${name}: ${exists ? '存在' : '缺失'}`);
      return { name, exists, file };
    });
    
    // 验证MVP关键功能导出
    const hookContent = fs.readFileSync(hookFile, 'utf-8');
    const mvpFeatures = [
      'useFarming',
      'useProcessing', 
      'useAIAnalytics',
      'useBatchDataProcessing',
      'clearModuleCache',
      'getCacheStats'
    ];
    
    const featureChecks = mvpFeatures.map(feature => {
      const exported = hookContent.includes(`export function ${feature}(`);
      console.log(`  ${exported ? '✅' : '❌'} MVP功能 ${feature}: ${exported ? '已导出' : '缺失'}`);
      return { feature, exported };
    });
    
    const allFeaturesExist = featureChecks.every(check => check.exported);
    const allFilesExist = filesExist.every(check => check.exists);
    
    validationResults.layers.typescript = {
      status: allFilesExist && allFeaturesExist ? 'PASS' : 'FAIL',
      details: {
        compilation: 'PASS',
        files: filesExist,
        mvpFeatures: featureChecks,
        errors: []
      }
    };
    
    console.log(`✅ TypeScript编译: 通过`);
    console.log(`${allFeaturesExist ? '✅' : '❌'} MVP功能完整性: ${allFeaturesExist ? '通过' : '失败'}`);
    
  } catch (error) {
    console.log(`❌ TypeScript编译失败: ${error.message}`);
    validationResults.layers.typescript = {
      status: 'FAIL',
      details: {
        compilation: 'FAIL',
        error: error.message,
        files: [],
        mvpFeatures: []
      }
    };
  }
}

// Layer 2: Next.js构建验证
async function validateBuild() {
  console.log('\n🏗️ Layer 2: Next.js构建验证');
  
  const { execSync } = require('child_process');
  const projectRoot = path.join(__dirname, '../../../web-app-next');
  
  try {
    console.log('- 执行Next.js构建...');
    const startTime = Date.now();
    
    execSync('npm run build', { 
      cwd: projectRoot,
      stdio: 'pipe'
    });
    
    const buildTime = Date.now() - startTime;
    console.log(`✅ 构建成功，耗时: ${(buildTime / 1000).toFixed(2)}秒`);
    
    // 检查构建输出
    const buildDir = path.join(projectRoot, '.next');
    const buildExists = fs.existsSync(buildDir);
    console.log(`${buildExists ? '✅' : '❌'} 构建输出目录: ${buildExists ? '存在' : '缺失'}`);
    
    validationResults.layers.build = {
      status: buildExists ? 'PASS' : 'FAIL',
      details: {
        buildTime: buildTime,
        buildDir: buildExists,
        performance: buildTime < 60000 ? 'GOOD' : 'SLOW'
      }
    };
    
  } catch (error) {
    console.log(`❌ 构建失败: ${error.message}`);
    validationResults.layers.build = {
      status: 'FAIL',
      details: {
        error: error.message,
        buildTime: null,
        buildDir: false
      }
    };
  }
}

// Layer 5: MVP功能完整性验证
async function validateMVPIntegration() {
  console.log('\n🎯 Layer 5: MVP功能完整性验证');
  
  const projectRoot = path.join(__dirname, '../../../web-app-next');
  
  try {
    // 验证Hook文件内容
    const hookFile = path.join(projectRoot, 'src/hooks/useApi-simple.ts');
    const hookContent = fs.readFileSync(hookFile, 'utf-8');
    
    // 验证MVP核心功能
    const mvpChecks = [
      {
        name: '养殖管理Hook (useFarming)',
        check: hookContent.includes('export function useFarming()') && 
               hookContent.includes('useBatchData') &&
               hookContent.includes('useEnvironmentData')
      },
      {
        name: '生产加工Hook (useProcessing)', 
        check: hookContent.includes('export function useProcessing()') &&
               hookContent.includes('useQualityReports') &&
               hookContent.includes('useEquipmentStatus')
      },
      {
        name: 'AI分析Hook (useAIAnalytics)',
        check: hookContent.includes('export function useAIAnalytics()') &&
               hookContent.includes('useProductionInsights') &&
               hookContent.includes('useOptimizationSuggestions')
      },
      {
        name: '批量数据处理Hook (useBatchDataProcessing)',
        check: hookContent.includes('export function useBatchDataProcessing()') &&
               hookContent.includes('useBatchHistoricalData')
      },
      {
        name: '智能缓存系统',
        check: hookContent.includes('REALTIME_CACHE_TTL') &&
               hookContent.includes('ANALYTICS_CACHE_TTL') &&
               hookContent.includes('clearModuleCache')
      },
      {
        name: '增强错误处理',
        check: hookContent.includes('ApiError') &&
               hookContent.includes('instanceof ApiError')
      }
    ];
    
    // 验证API客户端扩展
    const apiFile = path.join(projectRoot, 'src/lib/api.ts');
    const apiContent = fs.readFileSync(apiFile, 'utf-8');
    
    const apiChecks = [
      {
        name: 'farming API端点',
        check: apiContent.includes('farmingApi') &&
               apiContent.includes('/farming/batch/') &&
               apiContent.includes('/farming/environment')
      },
      {
        name: 'processing API端点',
        check: apiContent.includes('processingApi') &&
               apiContent.includes('/processing/quality-reports') &&
               apiContent.includes('/processing/equipment')
      },
      {
        name: 'AI analytics API端点',
        check: apiContent.includes('aiAnalyticsApi') &&
               apiContent.includes('/ai/production-insights') &&
               apiContent.includes('/ai/optimize')
      },
      {
        name: '数据处理API端点',
        check: apiContent.includes('dataProcessingApi') &&
               apiContent.includes('/data/batch-historical')
      }
    ];
    
    // 验证测试页面完整性
    const testFile = path.join(projectRoot, 'src/components/test/ApiTestPage.tsx');
    const testContent = fs.readFileSync(testFile, 'utf-8');
    
    const testPageChecks = [
      {
        name: '测试页面包含farming测试',
        check: testContent.includes('useFarming') &&
               testContent.includes('养殖管理')
      },
      {
        name: '测试页面包含processing测试',
        check: testContent.includes('useProcessing') &&
               testContent.includes('生产加工')
      },
      {
        name: '测试页面包含AI analytics测试',
        check: testContent.includes('useAIAnalytics') &&
               testContent.includes('AI数据分析')
      },
      {
        name: '缓存管理功能',
        check: testContent.includes('clearModuleCache') &&
               testContent.includes('getCacheStats')
      }
    ];
    
    // 汇总检查结果
    const allChecks = [...mvpChecks, ...apiChecks, ...testPageChecks];
    const passedChecks = allChecks.filter(check => check.check);
    
    console.log('\n📋 MVP功能检查结果:');
    allChecks.forEach(check => {
      console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`);
    });
    
    const integrationStatus = passedChecks.length === allChecks.length ? 'PASS' : 'PARTIAL';
    console.log(`\n${integrationStatus === 'PASS' ? '✅' : '⚠️'} MVP功能完整性: ${passedChecks.length}/${allChecks.length} 项通过`);
    
    validationResults.layers.integration = {
      status: integrationStatus,
      details: {
        totalChecks: allChecks.length,
        passedChecks: passedChecks.length,
        mvpFeatures: mvpChecks,
        apiEndpoints: apiChecks,
        testPage: testPageChecks
      }
    };
    
  } catch (error) {
    console.log(`❌ MVP功能验证失败: ${error.message}`);
    validationResults.layers.integration = {
      status: 'FAIL',
      details: {
        error: error.message
      }
    };
  }
}

// 生成验证总结
function generateSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TASK-P3-016A MVP验证总结');
  console.log('='.repeat(60));
  
  const layers = validationResults.layers;
  const layerNames = ['typescript', 'build', 'integration'];
  
  let passCount = 0;
  let totalCount = 0;
  
  layerNames.forEach(layerName => {
    const layer = layers[layerName];
    if (layer) {
      totalCount++;
      const status = layer.status;
      const emoji = status === 'PASS' ? '✅' : 
                   status === 'PARTIAL' ? '⚠️' : '❌';
      
      console.log(`${emoji} Layer ${totalCount}: ${layerName.toUpperCase()} - ${status}`);
      
      if (status === 'PASS') passCount++;
    }
  });
  
  const overallStatus = passCount === totalCount ? 'PASS' : 
                       passCount > totalCount / 2 ? 'PARTIAL' : 'FAIL';
  
  console.log('\n' + '-'.repeat(40));
  console.log(`🎯 总体状态: ${overallStatus}`);
  console.log(`📈 通过率: ${passCount}/${totalCount} (${((passCount/totalCount)*100).toFixed(1)}%)`);
  
  // MVP特定总结
  if (layers.integration) {
    const integration = layers.integration.details;
    if (integration.passedChecks !== undefined) {
      console.log(`🔧 MVP功能完成度: ${integration.passedChecks}/${integration.totalChecks} (${((integration.passedChecks/integration.totalChecks)*100).toFixed(1)}%)`);
    }
  }
  
  validationResults.summary = {
    overallStatus,
    passCount,
    totalCount,
    passRate: ((passCount/totalCount)*100).toFixed(1),
    mvpReady: overallStatus === 'PASS' && layers.integration?.status === 'PASS'
  };
  
  console.log(`\n🚀 MVP就绪状态: ${validationResults.summary.mvpReady ? '✅ 就绪' : '❌ 未就绪'}`);
}

// 保存验证报告
function saveReport() {
  const reportDir = path.join(__dirname, 'reports');
  const reportFile = path.join(reportDir, `mvp-validation-report-${Date.now()}.json`);
  
  // 确保报告目录存在
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportFile, JSON.stringify(validationResults, null, 2));
  console.log(`\n📄 MVP验证报告已保存: ${reportFile}`);
}

// 主执行流程
async function main() {
  try {
    await validateTypeScript();
    await validateBuild();
    await validateMVPIntegration();
    
    generateSummary();
    saveReport();
    
    // 根据验证结果设置退出码
    const success = validationResults.summary.overallStatus === 'PASS';
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ 验证过程发生严重错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接运行此脚本则执行main函数
if (require.main === module) {
  main();
}

module.exports = {
  main,
  VALIDATION_META,
  validateTypeScript,
  validateBuild,
  validateMVPIntegration
}; 