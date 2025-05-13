/**
 * 食品溯源系统 - 项目路径配置
 * 版本：1.0.0
 * 
 * 此文件用于标准化项目路径和解决目录嵌套问题。
 * 提供统一的路径解析功能，供所有脚本使用。
 */

const path = require('path');
const fs = require('fs');

/**
 * 项目路径配置对象
 */
const projectPaths = {};

/**
 * 查找项目根目录
 * 解决嵌套的web-app目录结构问题
 * @returns {string} 项目根目录的绝对路径
 */
function findProjectRoot() {
  // 从当前目录开始
  let currentDir = process.cwd();
  console.log(`当前工作目录: ${currentDir}`);
  
  // 检查是否存在workspace.json (最高优先级)
  let tempDir = currentDir;
  while (tempDir !== path.parse(tempDir).root) {
    if (fs.existsSync(path.join(tempDir, 'workspace.json'))) {
      return tempDir;
    }
    tempDir = path.dirname(tempDir);
  }
  
  // 识别嵌套的web-app目录结构
  const dirParts = currentDir.split(path.sep);
  const webAppIndices = [];
  
  // 找出路径中所有的web-app位置
  for (let i = 0; i < dirParts.length; i++) {
    if (dirParts[i] === 'web-app') {
      webAppIndices.push(i);
    }
  }
  
  // 找到最外层的web-app目录
  if (webAppIndices.length > 0) {
    // 最外层的web-app目录索引
    const outerMostIndex = webAppIndices[0];
    // 构建路径到最外层web-app的父目录
    return dirParts.slice(0, outerMostIndex).join(path.sep);
  }
  
  // 基于package.json内容查找项目根目录
  tempDir = currentDir;
  while (tempDir !== path.parse(tempDir).root) {
    if (fs.existsSync(path.join(tempDir, 'package.json'))) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
        if (packageJson.name && packageJson.name.includes('trace')) {
          return tempDir;
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    tempDir = path.dirname(tempDir);
  }
  
  // 如果找不到有效的根目录，返回当前工作目录
  return currentDir;
}

/**
 * 初始化项目路径
 * 设置所有标准路径
 */
function initProjectPaths() {
  // 查找项目根目录
  const projectRoot = findProjectRoot();
  
  // 设置项目根目录
  projectPaths.root = projectRoot;
  
  // 设置web-app目录
  if (fs.existsSync(path.join(projectRoot, 'web-app'))) {
    projectPaths.webApp = path.join(projectRoot, 'web-app');
  } else {
    projectPaths.webApp = projectRoot;
  }
  
  // 设置其他常用目录
  projectPaths.components = path.join(projectPaths.webApp, 'components');
  projectPaths.tests = path.join(projectPaths.webApp, 'tests');
  projectPaths.scripts = path.join(projectPaths.webApp, 'scripts');
  projectPaths.config = path.join(projectPaths.webApp, 'config');
  projectPaths.coverage = path.join(projectPaths.webApp, 'coverage');
  
  // 设置测试相关目录
  projectPaths.unitTests = path.join(projectPaths.tests, 'unit');
  projectPaths.e2eTests = path.join(projectPaths.tests, 'e2e');
  projectPaths.integrationTests = path.join(projectPaths.tests, 'integration');
  
  console.log(`项目根目录: ${projectPaths.root}`);
  console.log(`Web应用目录: ${projectPaths.webApp}`);
  
  return projectPaths;
}

/**
 * 检查路径是否存在，如果不存在则创建
 * @param {string} dirPath 目录路径
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`创建目录: ${dirPath}`);
  }
}

/**
 * 创建工作区标记文件
 * 在项目根目录创建workspace.json文件
 */
function createWorkspaceMarker() {
  const workspaceFilePath = path.join(projectPaths.root, 'workspace.json');
  
  if (!fs.existsSync(workspaceFilePath)) {
    const workspaceData = {
      name: "food-traceability-system",
      version: "1.0.0",
      description: "食品溯源系统工作区配置",
      rootDir: projectPaths.root,
      webAppDir: projectPaths.webApp,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
      workspaceFilePath, 
      JSON.stringify(workspaceData, null, 2), 
      'utf8'
    );
    
    console.log(`创建工作区标记文件: ${workspaceFilePath}`);
  }
}

/**
 * 获取相对于项目根目录的路径
 * @param {string} absolutePath 绝对路径
 * @returns {string} 相对于项目根目录的路径
 */
function getRelativePath(absolutePath) {
  return path.relative(projectPaths.root, absolutePath);
}

/**
 * 解析相对路径为绝对路径
 * @param {string} relativePath 相对路径
 * @returns {string} 绝对路径
 */
function resolveProjectPath(relativePath) {
  return path.resolve(projectPaths.root, relativePath);
}

// 初始化项目路径
initProjectPaths();

// 导出所有功能
module.exports = {
  paths: projectPaths,
  findProjectRoot,
  ensureDirectoryExists,
  createWorkspaceMarker,
  getRelativePath,
  resolveProjectPath
}; 