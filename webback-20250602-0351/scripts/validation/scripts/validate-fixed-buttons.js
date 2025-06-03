/**
 * 按钮修复验证脚本
 * 验证按钮修复后是否符合标准
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  beforeReportPath: path.join(__dirname, '../../../validation/reports/button_improvements_report.json'),
  afterReportPath: path.join(__dirname, '../../../validation/reports/button_validation_after_fix.json'),
  outputPath: path.join(__dirname, '../../../validation/reports/button_fix_report.html')
};

/**
 * 验证修复结果
 * 比较修复前后的报告并生成对比报告
 */
async function validateFixedButtons() {
  console.log('验证按钮修复结果...');

  // 检查报告文件是否存在
  if (!fs.existsSync(config.beforeReportPath)) {
    console.error(`错误：未找到修复前的按钮验证报告文件: ${config.beforeReportPath}`);
    return false;
  }

  if (!fs.existsSync(config.afterReportPath)) {
    console.error(`错误：未找到修复后的按钮验证报告文件: ${config.afterReportPath}`);
    console.log(`请先运行：npm run validate:buttons:after-fix`);
    return false;
  }

  try {
    // 加载按钮验证报告
    const beforeReport = JSON.parse(fs.readFileSync(config.beforeReportPath, 'utf-8'));
    const afterReport = JSON.parse(fs.readFileSync(config.afterReportPath, 'utf-8'));
    
    // 计算改进情况
    const improvement = {
      uniqueId: {
        before: beforeReport.summary.buttonsWithUniqueId,
        after: afterReport.summary.buttonsWithUniqueId,
        improved: afterReport.summary.buttonsWithUniqueId - beforeReport.summary.buttonsWithUniqueId,
        percentageBefore: parseFloat(beforeReport.summary.percentageWithUniqueId),
        percentageAfter: parseFloat(afterReport.summary.percentageWithUniqueId),
        percentageImproved: parseFloat(afterReport.summary.percentageWithUniqueId) - parseFloat(beforeReport.summary.percentageWithUniqueId)
      },
      accessibility: {
        before: beforeReport.summary.buttonsWithAccessibility,
        after: afterReport.summary.buttonsWithAccessibility,
        improved: afterReport.summary.buttonsWithAccessibility - beforeReport.summary.buttonsWithAccessibility,
        percentageBefore: parseFloat(beforeReport.summary.percentageWithAccessibility),
        percentageAfter: parseFloat(afterReport.summary.percentageWithAccessibility),
        percentageImproved: parseFloat(afterReport.summary.percentageWithAccessibility) - parseFloat(beforeReport.summary.percentageWithAccessibility)
      },
      visualFeedback: {
        before: beforeReport.summary.buttonsWithVisualFeedback,
        after: afterReport.summary.buttonsWithVisualFeedback,
        improved: afterReport.summary.buttonsWithVisualFeedback - beforeReport.summary.buttonsWithVisualFeedback,
        percentageBefore: parseFloat(beforeReport.summary.percentageWithVisualFeedback),
        percentageAfter: parseFloat(afterReport.summary.percentageWithVisualFeedback),
        percentageImproved: parseFloat(afterReport.summary.percentageWithVisualFeedback) - parseFloat(beforeReport.summary.percentageWithVisualFeedback)
      },
      totalButtons: beforeReport.summary.totalButtons
    };
    
    // 计算剩余问题
    const remainingIssues = {
      uniqueId: afterReport.summary.totalButtons - afterReport.summary.buttonsWithUniqueId,
      accessibility: afterReport.summary.totalButtons - afterReport.summary.buttonsWithAccessibility,
      visualFeedback: afterReport.summary.totalButtons - afterReport.summary.buttonsWithVisualFeedback
    };
    
    // 生成HTML报告
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>按钮修复验证报告</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    .summary {
      background-color: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin: 20px 0;
    }
    .improvement {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
    }
    .improvement-card {
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 15px;
      width: 30%;
    }
    .improvement-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .progress-container {
      background-color: #e9ecef;
      border-radius: 4px;
      height: 20px;
      margin-bottom: 10px;
      position: relative;
    }
    .progress-before {
      background-color: #6c757d;
      height: 100%;
      border-radius: 4px 0 0 4px;
      position: absolute;
      left: 0;
      top: 0;
    }
    .progress-after {
      background-color: #28a745;
      height: 100%;
      border-radius: 4px;
      position: absolute;
      left: 0;
      top: 0;
    }
    .percentage {
      position: absolute;
      width: 100%;
      text-align: center;
      color: #fff;
      font-weight: bold;
      text-shadow: 1px 1px 1px rgba(0,0,0,0.3);
      line-height: 20px;
    }
    .stats {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 10px;
      border: 1px solid #ddd;
      text-align: left;
    }
    th {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>按钮修复验证报告</h1>
    
    <div class="summary">
      <p>生成时间: ${new Date().toLocaleString()}</p>
      <p>总按钮数: ${improvement.totalButtons}</p>
      <p>测试对比时间范围: ${new Date(beforeReport.timestamp).toLocaleString()} 至 ${new Date(afterReport.timestamp).toLocaleString()}</p>
    </div>
    
    <h2>改进概览</h2>
    
    <div class="improvement">
      <div class="improvement-card">
        <div class="improvement-title">唯一ID</div>
        <div class="progress-container">
          <div class="progress-before" style="width: ${improvement.uniqueId.percentageBefore}%;"></div>
          <div class="progress-after" style="width: ${improvement.uniqueId.percentageAfter}%;"></div>
          <div class="percentage">${improvement.uniqueId.percentageAfter.toFixed(1)}%</div>
        </div>
        <div class="stats">
          <div>修复前: ${improvement.uniqueId.percentageBefore.toFixed(1)}%</div>
          <div>提升: +${improvement.uniqueId.percentageImproved.toFixed(1)}%</div>
        </div>
      </div>
      
      <div class="improvement-card">
        <div class="improvement-title">无障碍属性</div>
        <div class="progress-container">
          <div class="progress-before" style="width: ${improvement.accessibility.percentageBefore}%;"></div>
          <div class="progress-after" style="width: ${improvement.accessibility.percentageAfter}%;"></div>
          <div class="percentage">${improvement.accessibility.percentageAfter.toFixed(1)}%</div>
        </div>
        <div class="stats">
          <div>修复前: ${improvement.accessibility.percentageBefore.toFixed(1)}%</div>
          <div>提升: +${improvement.accessibility.percentageImproved.toFixed(1)}%</div>
        </div>
      </div>
      
      <div class="improvement-card">
        <div class="improvement-title">视觉反馈</div>
        <div class="progress-container">
          <div class="progress-before" style="width: ${improvement.visualFeedback.percentageBefore}%;"></div>
          <div class="progress-after" style="width: ${improvement.visualFeedback.percentageAfter}%;"></div>
          <div class="percentage">${improvement.visualFeedback.percentageAfter.toFixed(1)}%</div>
        </div>
        <div class="stats">
          <div>修复前: ${improvement.visualFeedback.percentageBefore.toFixed(1)}%</div>
          <div>提升: +${improvement.visualFeedback.percentageImproved.toFixed(1)}%</div>
        </div>
      </div>
    </div>
    
    <h2>详细改进数据</h2>
    
    <table>
      <tr>
        <th>属性</th>
        <th>修复前数量</th>
        <th>修复后数量</th>
        <th>改进数量</th>
        <th>修复前百分比</th>
        <th>修复后百分比</th>
        <th>百分比提升</th>
      </tr>
      <tr>
        <td>唯一ID</td>
        <td>${improvement.uniqueId.before}</td>
        <td>${improvement.uniqueId.after}</td>
        <td>${improvement.uniqueId.improved}</td>
        <td>${improvement.uniqueId.percentageBefore.toFixed(2)}%</td>
        <td>${improvement.uniqueId.percentageAfter.toFixed(2)}%</td>
        <td>+${improvement.uniqueId.percentageImproved.toFixed(2)}%</td>
      </tr>
      <tr>
        <td>无障碍属性</td>
        <td>${improvement.accessibility.before}</td>
        <td>${improvement.accessibility.after}</td>
        <td>${improvement.accessibility.improved}</td>
        <td>${improvement.accessibility.percentageBefore.toFixed(2)}%</td>
        <td>${improvement.accessibility.percentageAfter.toFixed(2)}%</td>
        <td>+${improvement.accessibility.percentageImproved.toFixed(2)}%</td>
      </tr>
      <tr>
        <td>视觉反馈</td>
        <td>${improvement.visualFeedback.before}</td>
        <td>${improvement.visualFeedback.after}</td>
        <td>${improvement.visualFeedback.improved}</td>
        <td>${improvement.visualFeedback.percentageBefore.toFixed(2)}%</td>
        <td>${improvement.visualFeedback.percentageAfter.toFixed(2)}%</td>
        <td>+${improvement.visualFeedback.percentageImproved.toFixed(2)}%</td>
      </tr>
    </table>
    
    ${remainingIssues.uniqueId > 0 || remainingIssues.accessibility > 0 || remainingIssues.visualFeedback > 0 ? `
    <div class="warning">
      <h3>剩余问题</h3>
      <p>尽管有所改进，但仍有一些按钮需要修复：</p>
      <ul>
        ${remainingIssues.uniqueId > 0 ? `<li><strong>${remainingIssues.uniqueId}</strong> 个按钮仍然缺少唯一ID</li>` : ''}
        ${remainingIssues.accessibility > 0 ? `<li><strong>${remainingIssues.accessibility}</strong> 个按钮仍然缺少无障碍属性</li>` : ''}
        ${remainingIssues.visualFeedback > 0 ? `<li><strong>${remainingIssues.visualFeedback}</strong> 个按钮仍然缺少视觉反馈</li>` : ''}
      </ul>
      <p>请查看 <code>button_issues.md</code> 文件了解详情。</p>
    </div>
    ` : `
    <div class="success">
      <h3>所有问题已修复</h3>
      <p>恭喜！所有按钮现在都符合标准要求。</p>
    </div>
    `}
    
    <h2>后续步骤</h2>
    
    <p>建议采取以下步骤确保按钮质量：</p>
    <ol>
      <li>使用 <code>npm run validate:buttons</code> 定期验证按钮标准合规性</li>
      <li>将按钮验证添加到持续集成流程中</li>
      <li>查阅开发文档中的按钮标准规范，确保新添加的按钮符合要求</li>
      <li>对于特殊情况，可以考虑手动修复而不是使用自动修复脚本</li>
    </ol>
    
    <p>查看详细报告：</p>
    <ul>
      <li><a href="${path.relative(path.dirname(config.outputPath), config.beforeReportPath)}">修复前报告</a></li>
      <li><a href="${path.relative(path.dirname(config.outputPath), config.afterReportPath)}">修复后报告</a></li>
    </ul>
  </div>
</body>
</html>
    `;
    
    // 写入报告文件
    fs.writeFileSync(config.outputPath, html);
    console.log(`✓ 按钮修复验证报告已生成: ${config.outputPath}`);
    
    // 输出摘要
    console.log('\n===== 按钮修复验证摘要 =====');
    console.log(`总按钮数: ${improvement.totalButtons}`);
    console.log(`唯一ID: ${improvement.uniqueId.percentageBefore.toFixed(2)}% → ${improvement.uniqueId.percentageAfter.toFixed(2)}% (提升 ${improvement.uniqueId.percentageImproved.toFixed(2)}%)`);
    console.log(`无障碍属性: ${improvement.accessibility.percentageBefore.toFixed(2)}% → ${improvement.accessibility.percentageAfter.toFixed(2)}% (提升 ${improvement.accessibility.percentageImproved.toFixed(2)}%)`);
    console.log(`视觉反馈: ${improvement.visualFeedback.percentageBefore.toFixed(2)}% → ${improvement.visualFeedback.percentageAfter.toFixed(2)}% (提升 ${improvement.visualFeedback.percentageImproved.toFixed(2)}%)`);
    
    // 根据最低百分比返回验证结果
    const threshold = 90; // 最低通过百分比
    const lowestPercentage = Math.min(
      improvement.uniqueId.percentageAfter,
      improvement.accessibility.percentageAfter,
      improvement.visualFeedback.percentageAfter
    );
    
    const passed = lowestPercentage >= threshold;
    console.log(`\n验证结果: ${passed ? '通过' : '未通过'} (阈值: ${threshold}%, 最低值: ${lowestPercentage.toFixed(2)}%)`);
    
    return {
      passed,
      improvement,
      remainingIssues,
      lowestPercentage,
      threshold
    };
  } catch (err) {
    console.error(`执行过程出错: ${err.message}`);
    return {
      passed: false,
      error: err.message
    };
  }
}

// 如果直接运行脚本则执行
if (require.main === module) {
  validateFixedButtons().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

module.exports = validateFixedButtons; 