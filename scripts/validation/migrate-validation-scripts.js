/**
 * 验证脚本迁移工具
 * 
 * 此脚本用于将验证脚本迁移到标准化的验证目录结构。
 * 它将检查根目录中的检查脚本，并将它们迁移到validation/scripts目录，
 * 同时添加统一的配置对象和错误处理。
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// 使用Promise版本的文件系统操作
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const stat = util.promisify(fs.stat);

// 迁移配置
const config = {
  sourcePattern: /^check-.*\.js$/,
  targetDir: 'validation/scripts',
  configTemplate: `
  // 标准化配置对象
  const config = {
    baseUrl: 'http://localhost:3000',
    screenshotsDir: 'validation/screenshots',
    reportPath: 'validation/reports',
    timeout: 30000,
    viewport: { width: 1280, height: 800 }
  };
  `
};

// 迁移脚本的主函数
async function migrateScripts() {
  console.log('开始迁移验证脚本...');
  
  // 确保目标目录存在
  try {
    await mkdir(config.targetDir, { recursive: true });
    console.log(`已创建目标目录: ${config.targetDir}`);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error(`创建目录失败: ${err.message}`);
      process.exit(1);
    }
  }
  
  // 获取根目录中的文件
  const files = fs.readdirSync('.');
  const scriptFiles = files.filter(file => config.sourcePattern.test(file));
  
  console.log(`找到 ${scriptFiles.length} 个验证脚本需要迁移`);
  
  // 用于跟踪迁移结果
  const results = {
    migrated: [],
    skipped: []
  };
  
  // 处理每个脚本
  for (const file of scriptFiles) {
    try {
      const migrated = await migrateScript(file);
      if (migrated) {
        results.migrated.push(file);
      } else {
        results.skipped.push(file);
      }
    } catch (err) {
      console.error(`迁移 ${file} 时出错: ${err.message}`);
      results.skipped.push(file);
    }
  }
  
  // 打印结果摘要
  console.log('\n迁移完成!');
  console.log(`已成功迁移: ${results.migrated.length} 个脚本`);
  console.log(`已跳过: ${results.skipped.length} 个脚本`);
  
  if (results.migrated.length > 0) {
    console.log('\n已迁移的脚本:');
    results.migrated.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file} -> ${path.join(config.targetDir, file)}`);
    });
  }
  
  if (results.skipped.length > 0) {
    console.log('\n已跳过的脚本:');
    results.skipped.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
  }
}

// 迁移单个脚本
async function migrateScript(filename) {
  console.log(`正在处理: ${filename}`);
  
  // 读取源文件
  const sourceContent = await readFile(filename, 'utf8');
  
  // 检查目标文件是否已存在
  const targetPath = path.join(config.targetDir, filename);
  try {
    await stat(targetPath);
    console.log(`目标文件已存在: ${targetPath}, 跳过`);
    return false;
  } catch (err) {
    // 文件不存在，继续处理
  }
  
  // 转换文件内容
  const transformedContent = transformScript(sourceContent, filename);
  
  // 写入目标文件
  await writeFile(targetPath, transformedContent, 'utf8');
  console.log(`已写入: ${targetPath}`);
  
  return true;
}

// 转换脚本内容
function transformScript(content, filename) {
  // 提取脚本名称（不带扩展名）
  const scriptName = path.basename(filename, '.js');
  
  // 检查是否已经有module.exports
  const hasExports = /module\.exports\s*=/.test(content);
  
  // 检查是否已经有标准配置对象
  const hasConfig = /const\s+config\s*=/.test(content);
  
  // 标准化错误处理
  const errorHandlingCode = `
  // 标准化错误处理
  process.on('unhandledRejection', (error) => {
    console.error('未处理的Promise拒绝:', error);
    process.exit(1);
  });
  `;
  
  // 构建转换后的内容
  let transformedContent = '';
  
  // 添加文件头注释
  transformedContent += `/**
 * ${scriptName}
 * 
 * 此脚本是验证系统的一部分，用于检查应用程序的特定方面。
 * 已被迁移到标准化的验证结构中。
 */
`;
  
  // 添加配置对象（如果尚未存在）
  if (!hasConfig) {
    transformedContent += config.configTemplate;
  }
  
  // 添加原始内容
  transformedContent += content;
  
  // 添加错误处理（避免重复）
  if (!content.includes('unhandledRejection')) {
    transformedContent += errorHandlingCode;
  }
  
  // 添加模块导出（如果尚未存在）
  if (!hasExports) {
    // 假设原始脚本中有一个主要函数，通常是异步的
    // 我们尝试找到这个函数并将其导出
    const mainFunctionMatch = content.match(/async\s+function\s+(\w+)/);
    const mainFunction = mainFunctionMatch ? mainFunctionMatch[1] : 'run';
    
    transformedContent += `
// 导出主要函数供其他模块使用
module.exports = {
  run: ${mainFunction}
};
`;
  }
  
  return transformedContent;
}

// 执行迁移
migrateScripts().catch(err => {
  console.error('迁移过程中发生错误:', err);
  process.exit(1);
}); 