/**
 * 食品溯源系统 - 创建工作区标记文件
 * 版本：1.0.0
 * 
 * 此脚本用于创建workspace.json标记文件，帮助项目脚本正确识别项目结构。
 * 解决多级嵌套目录和路径解析问题。
 * 
 * 使用方法：
 * node create-workspace.js
 */

const projectPaths = require('./project-paths');
const path = require('path');
const fs = require('fs');

/**
 * 在项目根目录创建workspace.json文件
 */
function createWorkspaceFile() {
  // 创建工作区标记文件
  projectPaths.createWorkspaceMarker();
  
  // 确保关键目录存在
  const { paths } = projectPaths;
  projectPaths.ensureDirectoryExists(paths.components);
  projectPaths.ensureDirectoryExists(paths.tests);
  projectPaths.ensureDirectoryExists(paths.scripts);
  projectPaths.ensureDirectoryExists(paths.unitTests);
  projectPaths.ensureDirectoryExists(paths.integrationTests);
  projectPaths.ensureDirectoryExists(paths.e2eTests);
  
  console.log('项目工作区设置完成！');
  console.log('以下目录结构已确认：');
  console.log(`- 项目根目录: ${paths.root}`);
  console.log(`- Web应用目录: ${paths.webApp}`);
  console.log(`- 组件目录: ${paths.components}`);
  console.log(`- 测试目录: ${paths.tests}`);
  console.log(`- 单元测试: ${paths.unitTests}`);
  console.log(`- 集成测试: ${paths.integrationTests}`);
  console.log(`- 端到端测试: ${paths.e2eTests}`);
}

/**
 * 创建符号链接，解决多级嵌套目录问题
 */
function createSymlinks() {
  const { paths } = projectPaths;
  
  // 只有在存在多级嵌套时才创建符号链接
  if (paths.root !== paths.webApp && !paths.webApp.startsWith(paths.root)) {
    try {
      // 在根目录创建指向web-app的符号链接
      const linkPath = path.join(paths.root, 'web-app-link');
      if (!fs.existsSync(linkPath)) {
        fs.symlinkSync(paths.webApp, linkPath, 'junction');
        console.log(`创建符号链接: ${linkPath} -> ${paths.webApp}`);
      }
    } catch (error) {
      console.warn(`无法创建符号链接，可能需要管理员权限: ${error.message}`);
      console.log('请手动设置正确的路径或以管理员权限运行此脚本。');
    }
  }
}

/**
 * 更新测试脚本，使用project-paths模块
 */
function updateTestScripts() {
  const { paths } = projectPaths;
  
  try {
    // 更新端到端测试运行脚本
    const e2eScriptPath = path.join(paths.e2eTests, 'run-e2e-tests.js');
    if (fs.existsSync(e2eScriptPath)) {
      console.log(`更新端到端测试脚本: ${e2eScriptPath}`);
      
      let content = fs.readFileSync(e2eScriptPath, 'utf8');
      
      // 检查是否已经使用了project-paths模块
      if (!content.includes('project-paths')) {
        // 在顶部添加导入语句
        const importStatement = 
          "const projectPaths = require('../../config/project-paths');\n";
        content = content.replace(
          "const path = require('path');", 
          "const path = require('path');\n" + importStatement
        );
        
        // 将content写回文件
        fs.writeFileSync(e2eScriptPath, content, 'utf8');
        console.log('端到端测试脚本已更新，添加了项目路径支持。');
      } else {
        console.log('端到端测试脚本已经使用了项目路径模块，无需更新。');
      }
    }
  } catch (error) {
    console.warn(`更新测试脚本时发生错误: ${error.message}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('========================================');
  console.log('   食品溯源系统 - 创建项目工作区标记   ');
  console.log('========================================');
  
  createWorkspaceFile();
  createSymlinks();
  updateTestScripts();
  
  console.log('');
  console.log('工作区设置完成。现在所有脚本都能正确识别项目结构了！');
  console.log('========================================');
}

// 执行主函数
main(); 