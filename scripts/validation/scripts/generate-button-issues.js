/**
 * 生成按钮问题列表
 * 生成按钮属性问题的详细Markdown报告
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  reportPath: path.join(__dirname, '../../../validation/reports/button_improvements_report.json'),
  outputPath: path.join(__dirname, '../../../button_issues.md')
};

/**
 * 生成按钮问题Markdown报告
 */
async function generateButtonIssues() {
  console.log('生成按钮问题报告...');

  // 检查报告文件是否存在
  if (!fs.existsSync(config.reportPath)) {
    console.error(`错误：未找到按钮验证报告文件: ${config.reportPath}`);
    console.log(`请先运行按钮验证测试: npm run validate:buttons`);
    return false;
  }

  try {
    // 加载按钮验证报告
    const report = JSON.parse(fs.readFileSync(config.reportPath, 'utf-8'));
    
    // 生成Markdown报告
    let markdown = `# 按钮问题报告\n\n`;
    markdown += `**生成时间**: ${new Date().toLocaleString()}\n\n`;
    
    // 添加概要信息
    markdown += `## 概要\n\n`;
    markdown += `| 指标 | 值 | 百分比 |\n`;
    markdown += `| ---- | ---- | ---- |\n`;
    markdown += `| 总按钮数 | ${report.summary.totalButtons} | 100% |\n`;
    markdown += `| 具有唯一ID的按钮 | ${report.summary.buttonsWithUniqueId} | ${report.summary.percentageWithUniqueId} |\n`;
    markdown += `| 具有无障碍属性的按钮 | ${report.summary.buttonsWithAccessibility} | ${report.summary.percentageWithAccessibility} |\n`;
    markdown += `| 具有视觉反馈的按钮 | ${report.summary.buttonsWithVisualFeedback} | ${report.summary.percentageWithVisualFeedback} |\n\n`;
    
    // 计算问题按钮
    const issueButtons = {
      noUniqueId: [],
      noAccessibility: [],
      noVisualFeedback: []
    };
    
    // 收集问题按钮
    for (const [pagePath, pageData] of Object.entries(report.pageResults)) {
      pageData.buttons.forEach(button => {
        if (!button.hasUniqueId) {
          issueButtons.noUniqueId.push({ pagePath, button });
        }
        if (!button.isAccessible) {
          issueButtons.noAccessibility.push({ pagePath, button });
        }
        if (!button.hasVisualFeedback) {
          issueButtons.noVisualFeedback.push({ pagePath, button });
        }
      });
    }
    
    // 按优先级排序页面和按钮
    const prioritizedPages = getPrioritizedPages(report.pageResults);
    markdown += `## 优先级页面\n\n`;
    markdown += `以下是按问题按钮数量排序的页面，建议按此顺序修复：\n\n`;
    markdown += `| 优先级 | 页面 | 问题按钮数 | 总按钮数 | 问题比率 |\n`;
    markdown += `| ---- | ---- | ---- | ---- | ---- |\n`;
    
    prioritizedPages.slice(0, 10).forEach((page, index) => {
      markdown += `| ${index + 1} | \`${page.pagePath}\` | ${page.issueCount} | ${page.totalButtons} | ${Math.round(page.issueCount / page.totalButtons * 100)}% |\n`;
    });
    markdown += `\n`;
    
    // 缺少唯一ID的按钮列表
    if (issueButtons.noUniqueId.length > 0) {
      markdown += `## 缺少唯一ID的按钮\n\n`;
      markdown += `共有 **${issueButtons.noUniqueId.length}** 个按钮缺少唯一ID.\n\n`;
      markdown += `| 页面 | 按钮文本 | 按钮类型 | 类名 |\n`;
      markdown += `| ---- | ---- | ---- | ---- |\n`;
      
      issueButtons.noUniqueId.slice(0, 30).forEach(item => {
        markdown += `| \`${item.pagePath}\` | ${truncateText(item.button.text || '(空)', 30)} | ${item.button.buttonType || item.button.tagName.toLowerCase()} | ${truncateText(item.button.className || '', 40)} |\n`;
      });
      
      if (issueButtons.noUniqueId.length > 30) {
        markdown += `\n... 及其他 ${issueButtons.noUniqueId.length - 30} 个按钮\n`;
      }
      
      markdown += `\n`;
    }
    
    // 缺少无障碍属性的按钮列表
    if (issueButtons.noAccessibility.length > 0) {
      markdown += `## 缺少无障碍属性的按钮\n\n`;
      markdown += `共有 **${issueButtons.noAccessibility.length}** 个按钮缺少无障碍属性（aria-label或tabindex）.\n\n`;
      markdown += `| 页面 | 按钮文本 | 按钮类型 | ID |\n`;
      markdown += `| ---- | ---- | ---- | ---- |\n`;
      
      issueButtons.noAccessibility.slice(0, 30).forEach(item => {
        markdown += `| \`${item.pagePath}\` | ${truncateText(item.button.text || '(空)', 30)} | ${item.button.buttonType || item.button.tagName.toLowerCase()} | ${item.button.id || '无ID'} |\n`;
      });
      
      if (issueButtons.noAccessibility.length > 30) {
        markdown += `\n... 及其他 ${issueButtons.noAccessibility.length - 30} 个按钮\n`;
      }
      
      markdown += `\n`;
    }
    
    // 缺少视觉反馈的按钮列表
    if (issueButtons.noVisualFeedback.length > 0) {
      markdown += `## 缺少视觉反馈的按钮\n\n`;
      markdown += `共有 **${issueButtons.noVisualFeedback.length}** 个按钮缺少视觉反馈（hover/focus/active效果）.\n\n`;
      markdown += `| 页面 | 按钮文本 | 按钮类型 | ID |\n`;
      markdown += `| ---- | ---- | ---- | ---- |\n`;
      
      issueButtons.noVisualFeedback.slice(0, 30).forEach(item => {
        markdown += `| \`${item.pagePath}\` | ${truncateText(item.button.text || '(空)', 30)} | ${item.button.buttonType || item.button.tagName.toLowerCase()} | ${item.button.id || '无ID'} |\n`;
      });
      
      if (issueButtons.noVisualFeedback.length > 30) {
        markdown += `\n... 及其他 ${issueButtons.noVisualFeedback.length - 30} 个按钮\n`;
      }
      
      markdown += `\n`;
    }
    
    // 添加解决方案指南
    markdown += `## 解决方案\n\n`;
    markdown += `### 自动修复\n\n`;
    markdown += `可以使用自动修复脚本处理大部分问题：\n\n`;
    markdown += "```bash\n";
    markdown += "# 运行自动修复脚本\n";
    markdown += "npm run fix:buttons\n";
    markdown += "```\n\n";
    
    markdown += `### 手动修复\n\n`;
    markdown += `1. **唯一ID**：每个按钮应该添加一个唯一的ID属性：\n`;
    markdown += "```html\n";
    markdown += '<button id="unique-button-id">按钮文本</button>\n';
    markdown += "```\n\n";
    
    markdown += `2. **无障碍属性**：按钮应包含适当的无障碍属性：\n`;
    markdown += "```html\n";
    markdown += '<button id="submit-btn" aria-label="提交表单" tabindex="0">提交</button>\n';
    markdown += "```\n\n";
    
    markdown += `3. **视觉反馈**：按钮应提供视觉反馈：\n`;
    markdown += "```html\n";
    markdown += '<button class="hover:shadow-md hover:opacity-90 focus:outline-none focus:ring-2 active:transform active:scale-95">按钮</button>\n';
    markdown += "```\n\n";
    
    // 写入报告文件
    fs.writeFileSync(config.outputPath, markdown);
    console.log(`✓ 按钮问题报告已生成: ${config.outputPath}`);
    
    return true;
  } catch (err) {
    console.error(`执行过程出错: ${err.message}`);
    return false;
  }
}

/**
 * 按按钮问题数量对页面进行排序
 * @param {Object} pageResults - 页面结果数据
 * @returns {Array} - 排序后的页面数组
 */
function getPrioritizedPages(pageResults) {
  const pages = [];
  
  for (const [pagePath, pageData] of Object.entries(pageResults)) {
    let issueCount = 0;
    
    pageData.buttons.forEach(button => {
      if (!button.hasUniqueId) issueCount++;
      if (!button.isAccessible) issueCount++;
      if (!button.hasVisualFeedback) issueCount++;
    });
    
    pages.push({
      pagePath,
      issueCount,
      totalButtons: pageData.stats.totalButtons,
      issueRatio: issueCount / (pageData.stats.totalButtons * 3) // 3个可能的问题
    });
  }
  
  // 按问题数量从多到少排序
  return pages.sort((a, b) => b.issueCount - a.issueCount);
}

/**
 * 截断文本到指定长度
 * @param {string} text - 原文本
 * @param {number} maxLength - 最大长度
 * @returns {string} - 截断后的文本
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// 如果直接运行脚本则执行
if (require.main === module) {
  generateButtonIssues().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = generateButtonIssues; 