const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// 获取HTML报告
const reportPath = path.join(__dirname, '..', 'reports', 'html_structure_report.json');
let reportData;
try {
  reportData = require(reportPath);
} catch (err) {
  console.error(`无法读取报告文件: ${reportPath}`);
  console.error('请先运行 npm run test:html 生成报告');
  process.exit(1);
}

/**
 * 修复HTML文件结构
 * @param {string} filePath HTML文件路径
 * @param {object} issueData 问题数据
 */
async function fixHtmlFile(filePath, issueData) {
  try {
    console.log(`正在修复文件: ${path.relative(process.cwd(), filePath)}`);
    
    // 读取文件内容
    const content = await readFile(filePath, 'utf8');
    
    // 检查是否为组件文件
    if (filePath.includes('components') && path.basename(filePath) !== 'page-template.html') {
      console.log('这是组件文件，不需要修复。');
      return false;
    }
    
    // 如果已经有效，跳过
    if (issueData.isValid) {
      console.log('此文件结构已完整，无需修复。');
      return false;
    }
    
    // 包装HTML内容
    let fixedContent = content;
    
    // 如果缺少DOCTYPE
    if (!issueData.hasDoctype) {
      fixedContent = `<!DOCTYPE html>\n${fixedContent}`;
    }
    
    // 如果缺少html标签
    if (!issueData.hasHtmlTag) {
      if (!issueData.hasHeadTag && !issueData.hasBodyTag) {
        // 如果既没有head也没有body，则完全包装内容
        fixedContent = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${path.basename(filePath, '.html')}</title>\n</head>\n<body>\n${fixedContent}\n</body>\n</html>`;
      } else {
        // 如果有head或body，则只包装html
        fixedContent = `<!DOCTYPE html>\n<html lang="zh-CN">\n${fixedContent}\n</html>`;
      }
    } else {
      // 有html标签，但可能缺少head或body
      if (!issueData.hasHeadTag) {
        // 在<html>后插入head
        fixedContent = fixedContent.replace(/<html[^>]*>/i, 
          `$&\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${path.basename(filePath, '.html')}</title>\n</head>`);
      }
      
      if (!issueData.hasBodyTag) {
        // 在</html>前插入body开始和结束标签
        if (fixedContent.includes('</html>')) {
          const htmlContentBeforeClosing = fixedContent.substring(0, fixedContent.lastIndexOf('</html>'));
          const closingHtml = fixedContent.substring(fixedContent.lastIndexOf('</html>'));
          
          // 寻找head标签后的所有内容
          let contentAfterHead = htmlContentBeforeClosing;
          if (htmlContentBeforeClosing.includes('</head>')) {
            contentAfterHead = htmlContentBeforeClosing.substring(htmlContentBeforeClosing.lastIndexOf('</head>') + 7);
          }
          
          // 重建文件内容
          fixedContent = fixedContent.substring(0, fixedContent.lastIndexOf(contentAfterHead)) + 
            `<body>\n${contentAfterHead.trim()}\n</body>\n` + closingHtml;
        } else {
          // 没有</html>标签，直接在内容的末尾添加</body></html>
          fixedContent = `${fixedContent}\n</body>\n</html>`;
        }
      }
    }
    
    // 保存修复后的文件
    await writeFile(filePath, fixedContent, 'utf8');
    console.log(`文件已修复: ${path.relative(process.cwd(), filePath)}`);
    return true;
  } catch (err) {
    console.error(`修复文件时出错 ${filePath}:`, err.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('开始修复HTML文件结构...');
  
  const issues = reportData.issues;
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const issue of issues) {
    // 跳过组件文件
    if (issue.isComponent) {
      console.log(`跳过组件文件: ${path.relative(process.cwd(), issue.file)}`);
      skippedCount++;
      continue;
    }
    
    // 跳过已经有效的文件
    if (issue.isValid) {
      console.log(`跳过已有效文件: ${path.relative(process.cwd(), issue.file)}`);
      skippedCount++;
      continue;
    }
    
    // 修复文件
    const fixed = await fixHtmlFile(issue.file, issue);
    if (fixed) {
      fixedCount++;
    } else {
      skippedCount++;
    }
  }
  
  console.log('\nHTML结构修复完成');
  console.log(`已修复: ${fixedCount} 文件`);
  console.log(`已跳过: ${skippedCount} 文件`);
  
  // 建议用户重新运行测试
  if (fixedCount > 0) {
    console.log('\n修复已完成，请运行以下命令验证修复效果:');
    console.log('npm run test:html');
  }
}

// 执行主函数
main().catch(err => {
  console.error('修复过程中出错:', err);
  process.exit(1);
}); 