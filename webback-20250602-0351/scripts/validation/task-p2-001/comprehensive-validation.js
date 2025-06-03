#!/usr/bin/env node

/**
 * TASK-P2-001 移动端UI适配问题修复 - 综合验证
 * 
 * @task TASK-P2-001
 * @module 移动端UI适配问题修复
 * @validation-type comprehensive
 * @description 统筹执行TASK-P2-001的所有验证脚本，生成综合验证报告和任务完成评估
 * @reports-to refactor/phase-2/progress-reports/
 * @created 2025-05-27
 * @updated 2025-05-27
 */

const path = require('path');
const fs = require('fs');

// 验证脚本元数据
const VALIDATION_META = {
  taskId: 'TASK-P2-001',
  validationType: 'comprehensive',
  module: '移动端UI适配问题修复',
  reportPath: 'refactor/phase-2/progress-reports/',
  version: '1.0.0'
};

// 验证模块配置
const VALIDATION_MODULES = [
  {
    name: 'mobile-adaptation',
    script: './mobile-adaptation-validation.js',
    weight: 0.4,
    required: true,
    description: '移动端适配功能验证'
  },
  {
    name: 'performance',
    script: './performance-validation.js',
    weight: 0.3,
    required: true,
    description: '性能指标验证'
  },
  {
    name: 'accessibility',
    script: './accessibility-validation.js',
    weight: 0.3,
    required: true,
    description: '可访问性验证'
  }
];

// 综合验证配置
const COMPREHENSIVE_CONFIG = {
  name: 'TASK-P2-001-综合验证',
  taskId: VALIDATION_META.taskId,
  requiredPassRate: 95, // 任务验收要求95%通过率
  criticalModulesThreshold: 90, // 关键模块至少90%
  modules: VALIDATION_MODULES
};

console.log(`🎯 开始执行 ${COMPREHENSIVE_CONFIG.name}...\n`);
console.log(`📋 任务ID: ${VALIDATION_META.taskId}`);
console.log(`📁 模块: ${VALIDATION_META.module}`);
console.log(`🔧 验证模块: ${VALIDATION_MODULES.length}个\n`);

/**
 * 执行综合验证
 */
async function runComprehensiveValidation() {
  const comprehensiveResults = {
    timestamp: new Date().toISOString(),
    taskId: VALIDATION_META.taskId,
    module: VALIDATION_META.module,
    config: COMPREHENSIVE_CONFIG.name,
    meta: VALIDATION_META,
    modules: {},
    summary: {
      totalModules: VALIDATION_MODULES.length,
      passedModules: 0,
      failedModules: 0,
      overallScore: 0,
      weightedScore: 0,
      taskStatus: 'PENDING',
      recommendations: [],
      criticalIssues: []
    },
    taskAcceptance: {
      criteria: {
        overallScore: { required: 95, actual: 0, passed: false },
        allCriticalModules: { required: true, actual: false, passed: false },
        noBlockingIssues: { required: true, actual: false, passed: false }
      },
      ready: false,
      blockers: []
    }
  };
  
  let weightedScore = 0;
  let allCriticalPassed = true;
  
  console.log('🔍 执行各验证模块...\n');
  
  for (const module of VALIDATION_MODULES) {
    try {
      console.log(`📋 执行 ${module.description}...`);
      console.log(`   脚本: ${module.script}`);
      console.log(`   权重: ${Math.round(module.weight * 100)}%`);
      console.log(`   必需: ${module.required ? 'YES' : 'NO'}\n`);
      
      // 动态加载验证模块
      const moduleScript = require(path.resolve(__dirname, module.script));
      const result = await moduleScript.runValidation();
      
      const moduleScore = result.summary.score;
      const passed = moduleScore >= (module.required ? COMPREHENSIVE_CONFIG.criticalModulesThreshold : 80);
      
      comprehensiveResults.modules[module.name] = {
        description: module.description,
        script: module.script,
        weight: module.weight,
        required: module.required,
        score: moduleScore,
        status: passed ? 'PASSED' : 'FAILED',
        summary: result.summary,
        details: result.details,
        recommendations: result.recommendations || []
      };
      
      if (passed) {
        comprehensiveResults.summary.passedModules++;
        console.log(`✅ ${module.description} - 通过 (${moduleScore}%)\n`);
      } else {
        comprehensiveResults.summary.failedModules++;
        console.log(`❌ ${module.description} - 失败 (${moduleScore}%)\n`);
        
        if (module.required) {
          allCriticalPassed = false;
          comprehensiveResults.taskAcceptance.blockers.push(
            `关键模块失败: ${module.description} (${moduleScore}% < ${COMPREHENSIVE_CONFIG.criticalModulesThreshold}%)`
          );
        }
        
        // 收集建议
        if (result.recommendations && result.recommendations.length > 0) {
          comprehensiveResults.summary.recommendations.push(
            ...result.recommendations.map(rec => `[${module.name}] ${rec}`)
          );
        }
      }
      
      // 计算加权分数
      weightedScore += moduleScore * module.weight;
      
    } catch (error) {
      console.error(`❌ ${module.description} 执行失败:`, error.message);
      
      comprehensiveResults.modules[module.name] = {
        description: module.description,
        script: module.script,
        weight: module.weight,
        required: module.required,
        score: 0,
        status: 'ERROR',
        error: error.message
      };
      
      comprehensiveResults.summary.failedModules++;
      allCriticalPassed = false;
      
      if (module.required) {
        comprehensiveResults.taskAcceptance.blockers.push(
          `关键模块错误: ${module.description} - ${error.message}`
        );
      }
    }
  }
  
  // 计算综合得分
  comprehensiveResults.summary.overallScore = Math.round(
    (comprehensiveResults.summary.passedModules / comprehensiveResults.summary.totalModules) * 100
  );
  comprehensiveResults.summary.weightedScore = Math.round(weightedScore);
  
  // 任务验收评估
  const overallScorePassed = comprehensiveResults.summary.weightedScore >= COMPREHENSIVE_CONFIG.requiredPassRate;
  const noCriticalIssues = comprehensiveResults.taskAcceptance.blockers.length === 0;
  
  comprehensiveResults.taskAcceptance.criteria.overallScore.actual = comprehensiveResults.summary.weightedScore;
  comprehensiveResults.taskAcceptance.criteria.overallScore.passed = overallScorePassed;
  comprehensiveResults.taskAcceptance.criteria.allCriticalModules.actual = allCriticalPassed;
  comprehensiveResults.taskAcceptance.criteria.allCriticalModules.passed = allCriticalPassed;
  comprehensiveResults.taskAcceptance.criteria.noBlockingIssues.actual = noCriticalIssues;
  comprehensiveResults.taskAcceptance.criteria.noBlockingIssues.passed = noCriticalIssues;
  
  // 确定任务状态
  if (overallScorePassed && allCriticalPassed && noCriticalIssues) {
    comprehensiveResults.summary.taskStatus = 'COMPLETED';
    comprehensiveResults.taskAcceptance.ready = true;
  } else if (comprehensiveResults.summary.weightedScore >= 80) {
    comprehensiveResults.summary.taskStatus = 'NEARLY_COMPLETE';
    comprehensiveResults.taskAcceptance.ready = false;
  } else {
    comprehensiveResults.summary.taskStatus = 'IN_PROGRESS';
    comprehensiveResults.taskAcceptance.ready = false;
  }
  
  // 生成总体建议
  if (!overallScorePassed) {
    comprehensiveResults.summary.recommendations.push(
      `提升整体得分: 当前${comprehensiveResults.summary.weightedScore}%, 需要≥${COMPREHENSIVE_CONFIG.requiredPassRate}%`
    );
  }
  
  console.log('📊 综合验证结果汇总...');
  console.log('=====================================');
  console.log(`任务ID: ${comprehensiveResults.taskId}`);
  console.log(`验证模块: ${comprehensiveResults.summary.totalModules}个`);
  console.log(`通过模块: ${comprehensiveResults.summary.passedModules}个`);
  console.log(`失败模块: ${comprehensiveResults.summary.failedModules}个`);
  console.log(`整体通过率: ${comprehensiveResults.summary.overallScore}%`);
  console.log(`加权得分: ${comprehensiveResults.summary.weightedScore}%`);
  console.log(`任务状态: ${comprehensiveResults.summary.taskStatus}`);
  console.log(`验收就绪: ${comprehensiveResults.taskAcceptance.ready ? 'YES' : 'NO'}`);
  
  // 显示各模块详情
  console.log('\n📋 各模块验证详情:');
  console.log('=====================================');
  for (const [moduleName, moduleResult] of Object.entries(comprehensiveResults.modules)) {
    const statusIcon = moduleResult.status === 'PASSED' ? '✅' : 
                      moduleResult.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${moduleResult.description}: ${moduleResult.score}% (权重: ${Math.round(moduleResult.weight * 100)}%)`);
  }
  
  // 显示阻塞问题
  if (comprehensiveResults.taskAcceptance.blockers.length > 0) {
    console.log('\n🚫 验收阻塞问题:');
    comprehensiveResults.taskAcceptance.blockers.forEach((blocker, index) => {
      console.log(`${index + 1}. ${blocker}`);
    });
  }
  
  // 显示改进建议
  if (comprehensiveResults.summary.recommendations.length > 0) {
    console.log('\n💡 改进建议:');
    comprehensiveResults.summary.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
  
  // 生成综合报告
  await generateComprehensiveReport(comprehensiveResults);
  
  return comprehensiveResults;
}

/**
 * 生成综合验证报告
 */
async function generateComprehensiveReport(results) {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(reportDir, `task-p2-001-comprehensive-report.json`);
  
  // 生成详细报告
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 综合验证报告已生成: ${reportFile}`);
  
  // 生成任务状态摘要
  const summaryFile = path.join(reportDir, `task-p2-001-status-summary.md`);
  const summaryContent = generateTaskSummary(results);
  fs.writeFileSync(summaryFile, summaryContent);
  console.log(`📋 任务状态摘要已生成: ${summaryFile}`);
}

/**
 * 生成任务状态摘要
 */
function generateTaskSummary(results) {
  const { taskAcceptance, summary, modules } = results;
  
  return `# TASK-P2-001 移动端UI适配问题修复 - 验证状态摘要

## 任务状态: ${summary.taskStatus}
- **验收就绪**: ${taskAcceptance.ready ? '✅ YES' : '❌ NO'}
- **整体得分**: ${summary.weightedScore}% (要求: ≥95%)
- **验证时间**: ${new Date(results.timestamp).toLocaleString('zh-CN')}

## 验证模块结果
${Object.entries(modules).map(([name, module]) => {
  const icon = module.status === 'PASSED' ? '✅' : module.status === 'FAILED' ? '❌' : '⚠️';
  return `- ${icon} **${module.description}**: ${module.score}% (权重: ${Math.round(module.weight * 100)}%)`;
}).join('\n')}

## 验收标准检查
- **整体得分≥95%**: ${taskAcceptance.criteria.overallScore.passed ? '✅' : '❌'} (实际: ${taskAcceptance.criteria.overallScore.actual}%)
- **关键模块全通过**: ${taskAcceptance.criteria.allCriticalModules.passed ? '✅' : '❌'}
- **无阻塞问题**: ${taskAcceptance.criteria.noBlockingIssues.passed ? '✅' : '❌'}

${taskAcceptance.blockers.length > 0 ? `## 🚫 验收阻塞问题
${taskAcceptance.blockers.map((blocker, i) => `${i + 1}. ${blocker}`).join('\n')}` : ''}

${summary.recommendations.length > 0 ? `## 💡 改进建议
${summary.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}` : ''}

---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
}

// 执行综合验证
if (require.main === module) {
  runComprehensiveValidation()
    .then(results => {
      const success = results.taskAcceptance.ready;
      const statusEmoji = success ? '🎉' : results.summary.taskStatus === 'NEARLY_COMPLETE' ? '⚠️' : '❌';
      
      console.log(`\n${statusEmoji} TASK-P2-001综合验证完成!`);
      console.log(`状态: ${results.summary.taskStatus}`);
      console.log(`得分: ${results.summary.weightedScore}%`);
      console.log(`验收就绪: ${results.taskAcceptance.ready ? 'YES' : 'NO'}`);
      
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 综合验证失败:', error.message);
      process.exit(1);
    });
}

module.exports = { 
  runComprehensiveValidation, 
  VALIDATION_META, 
  COMPREHENSIVE_CONFIG,
  VALIDATION_MODULES 
}; 