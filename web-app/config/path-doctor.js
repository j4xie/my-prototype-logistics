/**
 * 食品溯源系统 - 路径诊断工具
 * 版本：1.0.0
 * 
 * 此脚本用于诊断和修复项目中的路径问题。
 * 检测多级嵌套目录、找不到文件等常见问题，并提供解决方案。
 * 
 * 使用方法：
 * node path-doctor.js [--fix] [--verbose]
 * 
 * 参数：
 * --fix      自动修复发现的问题
 * --verbose  显示详细诊断信息
 */

const path = require('path');
const fs = require('fs');
const projectPaths = require('./project-paths');

// 命令行参数
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const verbose = args.includes('--verbose');

/**
 * 诊断问题对象
 */
const diagnostics = {
  issues: [],
  warnings: [],
  infos: []
};

/**
 * 添加诊断问题
 * @param {string} type 问题类型 (issue, warning, info)
 * @param {string} message 问题描述
 * @param {Function} [fixFunction] 修复函数
 */
function addDiagnostic(type, message, fixFunction = null) {
  diagnostics[type + 's'].push({
    message,
    fixFunction,
    fixed: false
  });
}

/**
 * 检查项目结构，诊断路径问题
 */
function diagnoseProjectStructure() {
  const { paths } = projectPaths;
  
  // 检查是否存在workspace.json
  if (!fs.existsSync(path.join(paths.root, 'workspace.json'))) {
    addDiagnostic('issue', 
      '未找到workspace.json标记文件，这可能导致路径解析问题。',
      () => projectPaths.createWorkspaceMarker()
    );
  }
  
  // 检查多级嵌套的web-app目录
  const currentDir = process.cwd();
  const dirParts = currentDir.split(path.sep);
  const webAppOccurrences = dirParts.filter(part => part === 'web-app').length;
  
  if (webAppOccurrences > 1) {
    addDiagnostic('issue',
      `检测到多级嵌套的web-app目录（${webAppOccurrences}层），这会导致路径解析问题。`,
      createSymlinksForNestedDirs
    );
  }
  
  // 检查是否能找到package.json
  if (!fs.existsSync(path.join(paths.webApp, 'package.json'))) {
    addDiagnostic('warning',
      `未在web-app目录(${paths.webApp})找到package.json文件，这可能影响依赖管理。`
    );
  }
  
  // 检查测试目录结构
  if (!fs.existsSync(paths.tests)) {
    addDiagnostic('issue',
      `未找到测试目录(${paths.tests})，这会影响测试执行。`,
      () => projectPaths.ensureDirectoryExists(paths.tests)
    );
  } else {
    // 检查测试子目录
    const testSubdirs = ['unit', 'integration', 'e2e'];
    for (const subdir of testSubdirs) {
      const testDir = path.join(paths.tests, subdir);
      if (!fs.existsSync(testDir)) {
        addDiagnostic('warning',
          `未找到${subdir}测试目录(${testDir})。`,
          () => projectPaths.ensureDirectoryExists(testDir)
        );
      }
    }
  }
  
  // 检查组件目录
  if (!fs.existsSync(paths.components)) {
    addDiagnostic('warning',
      `未找到组件目录(${paths.components})，这可能影响应用功能。`,
      () => projectPaths.ensureDirectoryExists(paths.components)
    );
  }
  
  // 检查端到端测试相关文件
  const e2eScriptPath = path.join(paths.e2eTests, 'run-e2e-tests.js');
  if (fs.existsSync(paths.e2eTests) && fs.existsSync(e2eScriptPath)) {
    const content = fs.readFileSync(e2eScriptPath, 'utf8');
    
    if (!content.includes('project-paths')) {
      addDiagnostic('warning',
        '端到端测试脚本未使用project-paths模块，可能导致路径解析问题。',
        updateE2EScript
      );
    }
  }
}

/**
 * 为多级嵌套目录创建符号链接
 */
function createSymlinksForNestedDirs() {
  const { paths } = projectPaths;
  
  try {
    // 创建从根目录到web-app的符号链接
    const linkPath = path.join(paths.root, 'web-app-link');
    if (!fs.existsSync(linkPath)) {
      fs.symlinkSync(paths.webApp, linkPath, 'junction');
      return true;
    }
  } catch (error) {
    console.error(`创建符号链接失败: ${error.message}`);
    return false;
  }
  
  return false;
}

/**
 * 更新端到端测试脚本，使用project-paths模块
 */
function updateE2EScript() {
  const { paths } = projectPaths;
  const e2eScriptPath = path.join(paths.e2eTests, 'run-e2e-tests.js');
  
  try {
    if (fs.existsSync(e2eScriptPath)) {
      let content = fs.readFileSync(e2eScriptPath, 'utf8');
      
      // 检查是否已经使用了project-paths模块
      if (!content.includes('project-paths')) {
        // 添加导入语句
        const importStatement = 
          "const projectPaths = require('../../config/project-paths');\n";
        content = content.replace(
          "const path = require('path');", 
          "const path = require('path');\n" + importStatement
        );
        
        // 更新findWebAppDir函数
        const findWebAppDirRegex = /function\s+findWebAppDir\s*\(\s*\)\s*\{[\s\S]*?\}/;
        const newFindWebAppDir = 
          "function findWebAppDir() {\n" +
          "  // 使用project-paths模块查找web-app目录\n" +
          "  return projectPaths.paths.webApp;\n" +
          "}";
        
        if (findWebAppDirRegex.test(content)) {
          content = content.replace(findWebAppDirRegex, newFindWebAppDir);
        }
        
        // 将更新后的内容写回文件
        fs.writeFileSync(e2eScriptPath, content, 'utf8');
        return true;
      }
    }
  } catch (error) {
    console.error(`更新端到端测试脚本失败: ${error.message}`);
    return false;
  }
  
  return false;
}

/**
 * 尝试修复诊断问题
 */
function fixIssues() {
  let fixedCount = 0;
  
  // 处理严重问题
  for (const issue of diagnostics.issues) {
    if (issue.fixFunction) {
      console.log(`修复问题: ${issue.message}`);
      issue.fixed = issue.fixFunction();
      if (issue.fixed) fixedCount++;
    }
  }
  
  // 处理警告
  for (const warning of diagnostics.warnings) {
    if (warning.fixFunction) {
      console.log(`修复警告: ${warning.message}`);
      warning.fixed = warning.fixFunction();
      if (warning.fixed) fixedCount++;
    }
  }
  
  return fixedCount;
}

/**
 * 显示诊断结果
 */
function displayDiagnostics() {
  console.log('\n===== 路径诊断结果 =====');
  
  const { issues, warnings, infos } = diagnostics;
  
  // 显示严重问题
  if (issues.length > 0) {
    console.log('\n严重问题:');
    issues.forEach((issue, i) => {
      console.log(`${i+1}. ${issue.message}`);
      if (verbose) {
        console.log(`   ${issue.fixed ? '✓ 已修复' : '✗ 未修复'}`);
      }
    });
  } else {
    console.log('\n✓ 未发现严重问题');
  }
  
  // 显示警告
  if (warnings.length > 0) {
    console.log('\n警告:');
    warnings.forEach((warning, i) => {
      console.log(`${i+1}. ${warning.message}`);
      if (verbose) {
        console.log(`   ${warning.fixed ? '✓ 已修复' : '✗ 未修复'}`);
      }
    });
  } else {
    console.log('\n✓ 未发现警告');
  }
  
  // 显示信息
  if (verbose && infos.length > 0) {
    console.log('\n信息:');
    infos.forEach((info, i) => {
      console.log(`${i+1}. ${info.message}`);
    });
  }
  
  // 当前路径信息
  if (verbose) {
    console.log('\n当前路径信息:');
    console.log(`- 当前工作目录: ${process.cwd()}`);
    console.log(`- 项目根目录: ${projectPaths.paths.root}`);
    console.log(`- Web应用目录: ${projectPaths.paths.webApp}`);
    console.log(`- 测试目录: ${projectPaths.paths.tests}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('========================================');
  console.log('   食品溯源系统 - 路径诊断工具  ');
  console.log('========================================');
  console.log('正在检查项目路径和目录结构...');
  
  // 添加基本信息
  addDiagnostic('info', `当前工作目录: ${process.cwd()}`);
  addDiagnostic('info', `项目根目录: ${projectPaths.paths.root}`);
  addDiagnostic('info', `Web应用目录: ${projectPaths.paths.webApp}`);
  
  // 诊断项目结构
  diagnoseProjectStructure();
  
  // 如果指定了修复选项，尝试修复问题
  let fixedCount = 0;
  if (shouldFix) {
    console.log('\n正在修复发现的问题...');
    fixedCount = fixIssues();
  }
  
  // 显示诊断结果
  displayDiagnostics();
  
  // 总结
  console.log('\n===== 诊断摘要 =====');
  console.log(`发现的问题: ${diagnostics.issues.length}`);
  console.log(`警告: ${diagnostics.warnings.length}`);
  if (shouldFix) {
    console.log(`已修复的问题: ${fixedCount}`);
  }
  
  console.log('\n如需修复问题，请运行：node path-doctor.js --fix');
  console.log('如需查看详细诊断信息，请运行：node path-doctor.js --verbose');
  console.log('========================================');
}

// 执行主函数
main(); 