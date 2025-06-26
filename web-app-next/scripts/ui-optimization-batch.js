#!/usr/bin/env node

/**
 * UI标准化批量优化脚本
 * 自动为页面添加响应式设计和无障碍支持
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 优化规则
const OPTIMIZATION_RULES = [
  {
    name: '响应式设计优化',
    pattern: /className="([^"]*container[^"]*max-w-(?!390px)[^"]*)/g,
    replacement: (match, classes) => {
      // 将max-w-*替换为max-w-[390px]
      const optimized = classes.replace(/max-w-\[[^\]]+\]|max-w-\w+/g, 'max-w-[390px]');
      return `className="${optimized}`;
    }
  },
  {
    name: '添加移动端优先布局',
    pattern: /className="([^"]*min-h-screen[^"]*(?!max-w-\[390px\])[^"]*)"/g,
    replacement: (match, classes) => {
      if (!classes.includes('max-w-[390px]')) {
        return `className="${classes} max-w-[390px] mx-auto"`;
      }
      return match;
    }
  }
];

// 无障碍优化规则
const ACCESSIBILITY_RULES = [
  {
    name: '按钮无障碍标签',
    pattern: /<Button([^>]*onClick[^>]*)((?![^>]*aria-label)[^>]*)>/g,
    replacement: (match, beforeProps, afterProps) => {
      // 提取onClick处理函数名来生成合适的aria-label
      const onClickMatch = beforeProps.match(/onClick=\{([^}]+)\}/);
      if (onClickMatch) {
        const handlerName = onClickMatch[1];
        let ariaLabel = '';

        if (handlerName.includes('login') || handlerName.includes('Login')) {
          ariaLabel = 'aria-label="登录"';
        } else if (handlerName.includes('submit') || handlerName.includes('Submit')) {
          ariaLabel = 'aria-label="提交"';
        } else if (handlerName.includes('back') || handlerName.includes('Back')) {
          ariaLabel = 'aria-label="返回"';
        } else if (handlerName.includes('save') || handlerName.includes('Save')) {
          ariaLabel = 'aria-label="保存"';
        } else {
          ariaLabel = 'aria-label="执行操作"';
        }

        return `<Button${beforeProps} ${ariaLabel}${afterProps}>`;
      }
      return match;
    }
  }
];

// 获取所有页面文件
function getPageFiles() {
  const pattern = path.join(__dirname, '../src/app/**/page.tsx');
  return glob.sync(pattern);
}

// 应用优化规则
function applyOptimizations(filePath) {
  const originalContent = fs.readFileSync(filePath, 'utf8');
  let optimizedContent = originalContent;
  const appliedRules = [];

  // 应用响应式设计优化
  OPTIMIZATION_RULES.forEach(rule => {
    const matches = optimizedContent.match(rule.pattern);
    if (matches && matches.length > 0) {
      optimizedContent = optimizedContent.replace(rule.pattern, rule.replacement);
      appliedRules.push(rule.name);
    }
  });

  // 应用无障碍优化
  ACCESSIBILITY_RULES.forEach(rule => {
    const matches = optimizedContent.match(rule.pattern);
    if (matches && matches.length > 0) {
      optimizedContent = optimizedContent.replace(rule.pattern, rule.replacement);
      appliedRules.push(rule.name);
    }
  });

  // 如果有变化则写入文件
  if (optimizedContent !== originalContent) {
    fs.writeFileSync(filePath, optimizedContent);
    return appliedRules;
  }

  return [];
}

// 生成优化报告
function generateReport(results) {
  const totalFiles = results.length;
  const optimizedFiles = results.filter(r => r.appliedRules.length > 0).length;
  const totalOptimizations = results.reduce((sum, r) => sum + r.appliedRules.length, 0);

  console.log('\n📊 UI标准化优化报告');
  console.log('=' .repeat(50));
  console.log(`总页面数: ${totalFiles}`);
  console.log(`已优化页面数: ${optimizedFiles}`);
  console.log(`总优化项目数: ${totalOptimizations}`);
  console.log('\n优化详情:');

  results.forEach(result => {
    if (result.appliedRules.length > 0) {
      console.log(`\n✅ ${result.file}`);
      result.appliedRules.forEach(rule => {
        console.log(`   - ${rule}`);
      });
    }
  });

  console.log('\n🎯 优化完成！');
}

// 主执行函数
function main() {
  console.log('🚀 开始UI标准化批量优化...\n');

  const pageFiles = getPageFiles();
  console.log(`发现 ${pageFiles.length} 个页面文件`);

  const results = pageFiles.map(filePath => {
    const relativePath = path.relative(path.join(__dirname, '../src/app'), filePath);
    console.log(`处理: ${relativePath}`);

    try {
      const appliedRules = applyOptimizations(filePath);
      return {
        file: relativePath,
        appliedRules,
        success: true
      };
    } catch (error) {
      console.error(`❌ 处理失败: ${relativePath} - ${error.message}`);
      return {
        file: relativePath,
        appliedRules: [],
        success: false,
        error: error.message
      };
    }
  });

  generateReport(results);
}

// 检查是否直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  applyOptimizations,
  getPageFiles,
  OPTIMIZATION_RULES,
  ACCESSIBILITY_RULES
};
