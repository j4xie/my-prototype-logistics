/**
 * 按钮属性自动修复脚本
 * 为不符合标准的按钮添加唯一ID、无障碍属性和视觉反馈
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 添加读写UTF-8文件的帮助函数
function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, { encoding: 'utf-8' });
}

function writeFileUtf8(filePath, content) {
  return fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
}

// 配置项
const config = {
  reportPath: path.join(__dirname, '../../../validation/reports/button_improvements_report.json'),
  visualFeedbackClasses: {
    hover: 'hover:bg-blue-700', // 更新为Tailwind类
    focus: 'focus:ring focus:outline-none', 
    active: 'active:bg-blue-800'
  },
  successLog: true, // 是否输出成功日志
  dryRun: false     // 设置为false，实际执行修复
};

/**
 * 修复按钮属性
 * 根据验证报告自动修复按钮属性
 */
async function fixButtonAttributes() {
  console.log(`\n${colorText('===== 按钮属性自动修复工具 =====', 'bright')}${colorText('blue')}`);

  // 检查报告文件是否存在
  if (!fs.existsSync(config.reportPath)) {
    console.error(colorText(`错误：未找到按钮验证报告文件: ${config.reportPath}`, 'red'));
    console.log(`请先运行按钮验证测试: ${colorText('npm run validate:buttons', 'cyan')}`);
    return false;
  }

  try {
    // 加载按钮验证报告
    console.log(colorText(`正在加载验证报告...`, 'gray'));
    const report = JSON.parse(readFileUtf8(config.reportPath));
    
    console.log(`\n${colorText('验证报告概要:', 'cyan')}`);
    console.log(`总按钮数: ${colorText(report.summary.totalButtons, 'bright')}`);
    console.log(`具有唯一ID的按钮: ${colorText(report.summary.buttonsWithUniqueId, 'bright')} (${colorText(report.summary.percentageWithUniqueId, 'green')})`);
    console.log(`具有无障碍属性的按钮: ${colorText(report.summary.buttonsWithAccessibility, 'bright')} (${colorText(report.summary.percentageWithAccessibility, 'green')})`);
    console.log(`具有视觉反馈的按钮: ${colorText(report.summary.buttonsWithVisualFeedback, 'bright')} (${colorText(report.summary.percentageWithVisualFeedback, 'green')})`);
    
    if (config.dryRun) {
      console.log(`\n${colorText('运行模式: 仅模拟（不修改文件）', 'yellow')}`);
    }
    
    // 修复统计
    const stats = {
      totalPages: 0,
      modifiedPages: 0,
      fixedButtons: {
        uniqueId: 0,
        accessibility: 0,
        visualFeedback: 0
      }
    };

    // 遍历每个页面
    console.log(`\n${colorText('开始修复按钮属性...', 'cyan')}`);
    
    for (const [pagePath, pageData] of Object.entries(report.pageResults)) {
      stats.totalPages++;
      const filePath = path.join(__dirname, '../../../', pagePath);
      
      if (!fs.existsSync(filePath)) {
        console.log(colorText(`警告：找不到文件 ${pagePath}`, 'yellow'));
        continue;
      }
      
      try {
        const html = readFileUtf8(filePath);
        const $ = cheerio.load(html, { decodeEntities: false }); // 不对实体进行解码，保留原始字符
        let modified = false;
        let pageStats = {
          uniqueId: 0,
          accessibility: 0,
          visualFeedback: 0
        };
        
        // 处理每个按钮
        for (const button of pageData.buttons) {
          // 为按钮添加页面URL信息，帮助findButtonInDOM更准确地识别按钮
          button.pageUrl = pagePath;
          
          // 找到对应的按钮元素
          const $buttons = findButtonInDOM($, button);
          
          if ($buttons.length === 0) {
            console.log(colorText(`警告：在 ${pagePath} 中找不到按钮文本"${button.text}"`, 'yellow'));
            continue;
          }
          
          // 为每个匹配的按钮修复属性
          $buttons.each((i, el) => {
            const $button = $(el);
            
            // 修复唯一ID
            if (!button.hasUniqueId) {
              const buttonIdBase = pagePath.replace(/[\/\\\.]/g, '-').substring(1);
              const newId = `btn-${buttonIdBase}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
              $button.attr('id', newId);
              pageStats.uniqueId++;
              modified = true;
            }
            
            // 修复无障碍属性
            if (!button.isAccessible) {
              // 添加aria-label
              if (!$button.attr('aria-label')) {
                const buttonText = $button.text().trim();
                if (buttonText) {
                  $button.attr('aria-label', buttonText);
                } else if ($button.find('i, span[class*="icon"]').length) {
                  // 尝试从图标类猜测标签
                  const iconClass = $button.find('i, span[class*="icon"]').attr('class') || '';
                  const iconName = iconClass.split(' ')
                    .find(cls => cls.includes('icon-') || cls.includes('fa-'))
                    ?.replace('icon-', '')
                    ?.replace('fa-', '')
                    ?.replace(/-/g, ' ');
                    
                  if (iconName) {
                    $button.attr('aria-label', iconName);
                  } else {
                    $button.attr('aria-label', `按钮 ${button.id || ''}`);
                  }
                }
              }
              
              // 添加tabindex
              if (!$button.attr('tabindex')) {
                $button.attr('tabindex', '0');
              }
              
              pageStats.accessibility++;
              modified = true;
            }
            
            // 修复视觉反馈
            if (!button.hasVisualFeedback) {
              // 使用新的addVisualFeedback函数添加标准视觉反馈效果
              addVisualFeedback($button);
              
              pageStats.visualFeedback++;
              modified = true;
            }
          });
        }
        
        // 保存修改后的文件
        if (modified) {
          stats.modifiedPages++;
          stats.fixedButtons.uniqueId += pageStats.uniqueId;
          stats.fixedButtons.accessibility += pageStats.accessibility;
          stats.fixedButtons.visualFeedback += pageStats.visualFeedback;
          
          if (!config.dryRun) {
            writeFileUtf8(filePath, $.html());
          }
          
          if (config.successLog) {
            console.log(`${colorText('✓', 'green')} 修复文件 ${colorText(pagePath, 'bright')} (ID: ${pageStats.uniqueId}, 无障碍: ${pageStats.accessibility}, 视觉反馈: ${pageStats.visualFeedback})`);
          }
        }
      } catch (err) {
        console.error(colorText(`处理文件 ${pagePath} 出错: ${err.message}`, 'red'));
      }
    }
    
    // 显示修复结果
    console.log(`\n${colorText('修复结果汇总:', 'cyan')}`);
    console.log(`修改的页面: ${colorText(stats.modifiedPages, 'bright')}/${colorText(stats.totalPages, 'bright')}`);
    console.log(`补充的唯一ID: ${colorText(stats.fixedButtons.uniqueId, 'bright')}`);
    console.log(`补充的无障碍属性: ${colorText(stats.fixedButtons.accessibility, 'bright')}`);
    console.log(`补充的视觉反馈: ${colorText(stats.fixedButtons.visualFeedback, 'bright')}`);
    
    if (config.dryRun) {
      console.log(`\n${colorText('注意: 这是模拟运行, 实际文件未被修改', 'yellow')}`);
      console.log(`要进行实际修复, 请将脚本中的 dryRun 设置为 false`);
    } else {
      console.log(`\n${colorText('✓ 按钮属性修复完成!', 'green')}`);
    }
    
    return true;
  } catch (err) {
    console.error(colorText(`执行过程出错: ${err.message}`, 'red'));
    return false;
  }
}

/**
 * 在DOM中查找匹配的按钮
 * @param {Object} $ - Cheerio实例
 * @param {Object} button - 按钮信息
 * @returns {Object} - 匹配的Cheerio对象
 */
function findButtonInDOM($, button) {
  // 1. 如果有ID，优先通过ID查找
  if (button.id) {
    const $byId = $(`#${button.id}`);
    if ($byId.length) return $byId;
  }
  
  // 保存按钮属性以供使用
  const tagName = button.tagName.toLowerCase();
  const buttonText = button.text.trim();
  const className = button.className || '';
  const buttonType = button.buttonType || '';
  
  // 结果集合
  let results = $([]);
  
  // 2. 尝试通过精确文本匹配
  if (buttonText) {
    // 2.1 精确文本匹配
    const $byExactText = $(tagName).filter(function() {
      return $(this).text().trim() === buttonText;
    });
    
    if ($byExactText.length) {
      results = $byExactText;
    } else {
      // 2.2 包含文本匹配
      const $byContainsText = $(tagName).filter(function() {
        return $(this).text().trim().includes(buttonText) || 
               buttonText.includes($(this).text().trim());
      });
      
      if ($byContainsText.length) {
        results = $byContainsText;
      }
    }
  }
  
  // 3. 如果通过文本未找到或文本为空，尝试通过类名匹配
  if (results.length === 0 && className) {
    const classes = className.split(' ').filter(Boolean);
    
    if (classes.length) {
      // 构建一个选择器，匹配所有类
      const classSelector = classes.map(cls => `.${cls}`).join('');
      const $byClass = $(tagName + classSelector);
      
      if ($byClass.length) {
        results = $byClass;
      } else {
        // 尝试匹配任何一个类
        for (const cls of classes) {
          const $byPartialClass = $(tagName + '.' + cls);
          if ($byPartialClass.length) {
            results = $byPartialClass;
            break;
          }
        }
      }
    }
  }
  
  // 4. 增强：处理admin-settings.html, admin-system.html和farming下的页面
  // 特别针对无类名或标准类名的按钮
  if (results.length === 0) {
    // 尝试查找所有具有按钮特征的元素
    const buttonSelectors = [
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      '.btn', 
      '.button',
      '[role="button"]',
      '.action-button',
      '.submit-btn',
      '.card-action',
      '.list-action',
      'a.card',
      'a.menu-item',
      '.settings-item',
      '.list-group-item',
      '.action-link',
      '[data-action]',
      '.btn-primary',
      '.btn-secondary',
      '.btn-action',
      '.action-btn',
      '.function-btn',
      '.card-header-action',
      '.tab-btn'
    ];
    
    // 尝试通过更广泛的选择器查找
    const combinedSelector = buttonSelectors.join(', ');
    const $allPossibleButtons = $(combinedSelector);
    
    // 如果找到了多个可能是按钮的元素，尝试通过文本或位置匹配最可能的那个
    if ($allPossibleButtons.length > 0) {
      if (buttonText) {
        // 按照文本相似度排序
        const $sortedByTextSimilarity = $allPossibleButtons.toArray()
          .map(el => $(el))
          .filter($el => $el.text().trim().length > 0)
          .sort(($a, $b) => {
            const textA = $a.text().trim();
            const textB = $b.text().trim();
            const similarityA = calculateTextSimilarity(buttonText, textA);
            const similarityB = calculateTextSimilarity(buttonText, textB);
            return similarityB - similarityA; // 从高到低排序
          });
        
        if ($sortedByTextSimilarity.length > 0) {
          results = $($sortedByTextSimilarity[0]);
        } else {
          // 如果没有文本相似性，就使用第一个元素
          results = $($allPossibleButtons.first());
        }
      } else {
        // 没有文本可比较，使用第一个元素
        results = $($allPossibleButtons.first());
      }
    }
  }
  
  // 5. 如果仍然找不到，特别处理farming目录下的特殊情况
  if (results.length === 0 && button.pageUrl && button.pageUrl.includes('/farming/')) {
    // farming页面中的特定按钮模式
    const farmingButtonSelectors = [
      '.card-body button',
      '.card-footer button',
      '.card-footer a',
      '.control-panel button',
      '.control-panel a',
      '.data-action',
      '.farming-action',
      '.monitoring-control',
      '.card-body a[href]',
      '.action-group button',
      '.action-group a',
      '.data-card button',
      '.data-card a'
    ];
    
    for (const selector of farmingButtonSelectors) {
      const $farmingButtons = $(selector);
      if ($farmingButtons.length) {
        results = $farmingButtons;
        break;
      }
    }
  }
  
  // 如果结果为空，再尝试一次：查找所有按钮，并根据文本内容的相似性选择最匹配的
  if (results.length === 0 && buttonText) {
    const allButtons = $('button, input[type="button"], input[type="submit"], a.btn, a.button, [role="button"]');
    let bestMatch = null;
    let bestScore = -1;
    
    allButtons.each(function() {
      const $btn = $(this);
      const btnText = $btn.text().trim();
      if (btnText) {
        const score = calculateTextSimilarity(buttonText, btnText);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = $btn;
        }
      }
    });
    
    if (bestMatch && bestScore > 0.5) { // 设定一个相似度阈值
      results = $(bestMatch);
    }
  }
  
  return results;
}

/**
 * 计算两个字符串的相似度 (0-1)
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} - 相似度分数 (0-1)
 */
function calculateTextSimilarity(str1, str2) {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // 如果有一个包含另一个，给予较高分数
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8;
  }
  
  // 计算编辑距离
  const dp = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
  
  // 初始化
  for (let i = 0; i <= str1.length; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    dp[0][j] = j;
  }
  
  // 填充矩阵
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,  // 删除
          dp[i][j - 1] + 1,  // 插入
          dp[i - 1][j - 1] + 1 // 替换
        );
      }
    }
  }
  
  // 计算相似度
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0; // 两个空字符串
  
  return 1.0 - dp[str1.length][str2.length] / maxLength;
}

/**
 * 为按钮添加视觉反馈样式
 * @param {Object} $button - Cheerio按钮对象
 */
function addVisualFeedback($button) {
  // 添加悬停效果
  if (!$button.hasClass('hover:bg-blue-700')) {
    $button.addClass('hover:bg-blue-700');
  }
  
  // 添加焦点效果
  if (!$button.hasClass('focus:ring') && !$button.hasClass('focus:outline-none')) {
    $button.addClass('focus:ring focus:outline-none');
  }
  
  // 添加激活效果
  if (!$button.hasClass('active:bg-blue-800')) {
    $button.addClass('active:bg-blue-800');
  }
  
  // 确保有过渡效果
  if (!$button.hasClass('transition')) {
    $button.addClass('transition duration-150 ease-in-out');
  }
}

/**
 * 为控制台输出添加颜色
 * @param {string} text - 文本内容
 * @param {string} color - 颜色名称
 * @returns {string} - 带颜色的文本
 */
function colorText(text, color = '') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underline: '\x1b[4m',
    blink: '\x1b[5m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  return `${colors[color] || ''}${text}${colors.reset}`;
}

// 如果直接运行脚本则执行修复
if (require.main === module) {
  fixButtonAttributes().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = fixButtonAttributes; 