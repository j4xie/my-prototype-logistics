/**
 * 修复页面跳转问题的脚本
 * 主要功能：
 * 1. 检查所有HTML文件中的链接
 * 2. 特别关注系统配置页面的链接
 * 3. 修复可能导致"Cannot GET"错误的链接
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  rootDir: path.resolve(__dirname, '..'),
  pagesDir: path.resolve(__dirname, '../pages'),
  reportDir: path.resolve(__dirname, '../validation/reports'),
  problematicPaths: {
    // 已知的问题路径映射 (错误路径 => 正确路径)
    '../admin/admin-system.html': '../../pages/admin/admin-system.html',
    'admin/admin-system.html': '../admin/admin-system.html',
    '/admin/admin-system.html': '/pages/admin/admin-system.html',
    '/pages/admin-system.html': '/pages/admin/admin-system.html',
  }
};

// 确保报告目录存在
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

/**
 * 搜索目录下的所有HTML文件
 * @param {string} dir 要搜索的目录
 * @param {Array} fileList 文件列表数组
 * @returns {Array} HTML文件路径列表
 */
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * 检查HTML文件中的链接
 * @param {string} filePath HTML文件路径
 * @returns {Object} 问题链接列表
 */
function checkFileLinks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const problemLinks = [];
  
  // 相对于项目根目录的路径
  const relativePath = path.relative(config.rootDir, filePath);
  
  // 使用正则表达式查找所有链接
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  
  while ((match = hrefRegex.exec(content)) !== null) {
    const href = match[1];
    
    // 跳过不需要检查的链接
    if (href.startsWith('#') || 
        href.startsWith('http://') || 
        href.startsWith('https://') || 
        href.startsWith('mailto:') || 
        href.startsWith('tel:') ||
        href.startsWith('javascript:')) {
      continue;
    }
    
    // 检查链接是否为已知的问题路径
    for (const [problemPath, correctPath] of Object.entries(config.problematicPaths)) {
      if (href === problemPath) {
        problemLinks.push({
          href,
          lineNumber: getLineNumber(content, match.index),
          correctPath,
          fullMatch: match[0]
        });
        break;
      }
    }
    
    // 特别检查系统配置页面链接
    if (href.includes('admin-system.html') || href.includes('系统配置')) {
      // 只添加尚未添加的链接
      if (!problemLinks.some(link => link.href === href)) {
        // 尝试确定正确的路径
        let correctPath = '../../pages/admin/admin-system.html';
        
        // 根据文件位置调整路径
        if (filePath.includes('/pages/admin/')) {
          correctPath = 'admin-system.html';
        } else if (filePath.includes('/pages/')) {
          correctPath = '../admin/admin-system.html';
        }
        
        problemLinks.push({
          href,
          lineNumber: getLineNumber(content, match.index),
          correctPath,
          fullMatch: match[0],
          needsVerification: true // 标记为需要验证的修复
        });
      }
    }
  }
  
  return {
    file: relativePath,
    problems: problemLinks
  };
}

/**
 * 获取内容中位置的行号
 * @param {string} content 文件内容
 * @param {number} position 位置索引
 * @returns {number} 行号
 */
function getLineNumber(content, position) {
  const lines = content.slice(0, position).split('\n');
  return lines.length;
}

/**
 * 修复文件中的链接问题
 * @param {string} filePath 文件路径
 * @param {Array} problems 问题列表
 * @returns {boolean} 是否进行了修复
 */
function fixFileLinks(filePath, problems) {
  if (problems.length === 0) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixed = false;
  
  for (const problem of problems) {
    const newHref = `href="${problem.correctPath}"`;
    const regex = new RegExp(problem.fullMatch, 'g');
    
    if (content.match(regex)) {
      content = content.replace(regex, newHref);
      fixed = true;
      console.log(`  - 修复 ${problem.href} -> ${problem.correctPath}`);
    }
  }
  
  if (fixed) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  
  return fixed;
}

/**
 * 主函数
 */
async function main() {
  console.log('开始检查页面跳转问题...');
  
  // 查找所有HTML文件
  const htmlFiles = findHtmlFiles(config.pagesDir);
  console.log(`找到 ${htmlFiles.length} 个HTML文件`);
  
  // 检查所有文件中的链接
  const allProblems = [];
  let totalProblems = 0;
  
  for (const file of htmlFiles) {
    const result = checkFileLinks(file);
    if (result.problems.length > 0) {
      allProblems.push(result);
      totalProblems += result.problems.length;
    }
  }
  
  console.log(`发现 ${totalProblems} 个潜在问题链接，涉及 ${allProblems.length} 个文件`);
  
  // 修复问题
  let fixedFiles = 0;
  let fixedProblems = 0;
  
  for (const fileResult of allProblems) {
    const filePath = path.join(config.rootDir, fileResult.file);
    console.log(`\n处理文件: ${fileResult.file}`);
    
    if (fixFileLinks(filePath, fileResult.problems)) {
      fixedFiles++;
      fixedProblems += fileResult.problems.length;
    }
  }
  
  console.log(`\n修复完成，修复了 ${fixedFiles} 个文件中的 ${fixedProblems} 个问题链接`);
  
  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: htmlFiles.length,
    problemFiles: allProblems.length,
    totalProblems,
    fixedFiles,
    fixedProblems,
    details: allProblems
  };
  
  const reportPath = path.join(config.reportDir, 'page_transition_fixes.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`报告已保存至: ${reportPath}`);
  
  // 建议执行验证
  console.log('\n建议执行以下命令验证修复效果:');
  console.log('npm run validate:navigation');
}

// 执行主函数
main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
}); 