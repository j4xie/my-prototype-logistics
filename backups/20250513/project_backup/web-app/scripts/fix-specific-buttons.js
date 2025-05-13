/**
 * 专门修复按钮问题的脚本
 * 重点处理admin-settings.html，admin-system.html和farming目录下的页面
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 读写文件辅助函数
function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, { encoding: 'utf-8' });
}

function writeFileUtf8(filePath, content) {
  return fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
}

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorText(text, color) {
  return colors[color] + text + colors.reset;
}

/**
 * 添加视觉反馈样式
 * @param {Object} $ - Cheerio实例
 * @param {Object} $button - Cheerio按钮对象
 */
function addVisualFeedback($, $button) {
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
 * 添加唯一ID
 * @param {Object} $ - Cheerio实例
 * @param {Object} $button - Cheerio按钮对象
 * @param {string} pagePath - 页面路径
 * @param {number} index - 按钮索引
 */
function addUniqueId($, $button, pagePath, index) {
  if (!$button.attr('id')) {
    const pageId = pagePath.replace(/[\/\\\.]/g, '-').substring(1);
    const buttonId = `btn-${pageId}-${index}-${Date.now()}`;
    $button.attr('id', buttonId);
    return true;
  }
  return false;
}

/**
 * 添加无障碍属性
 * @param {Object} $ - Cheerio实例
 * @param {Object} $button - Cheerio按钮对象
 */
function addAccessibility($, $button) {
  let modified = false;
  
  // 添加aria-label
  if (!$button.attr('aria-label')) {
    const buttonText = $button.text().trim();
    if (buttonText) {
      $button.attr('aria-label', buttonText);
      modified = true;
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
        modified = true;
      } else {
        $button.attr('aria-label', `按钮 ${$button.attr('id') || ''}`);
        modified = true;
      }
    }
  }
  
  // 添加tabindex
  if (!$button.attr('tabindex')) {
    $button.attr('tabindex', '0');
    modified = true;
  }
  
  return modified;
}

/**
 * 修复特定页面中的按钮
 * @param {string} pagePath - 页面路径
 */
function fixButtonsInPage(pagePath) {
  const filePath = path.join(__dirname, '../', pagePath);
  
  if (!fs.existsSync(filePath)) {
    console.log(colorText(`警告：找不到文件 ${pagePath}`, 'yellow'));
    return { fixed: false };
  }
  
  try {
    const html = readFileUtf8(filePath);
    const $ = cheerio.load(html, { decodeEntities: false });
    
    // 查找所有可能的按钮
    const buttonSelectors = [
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      'a.btn',
      'a[role="button"]',
      '[role="button"]',
      '.btn',
      '.button',
      '.trace-button',
      '.action-btn',
      '.function-btn',
      '.card-action',
      '.control-btn',
      '.submit-btn',
      '.filter-btn',
      '.panel-action',
      '.data-action',
      'a[class*="btn"]',
      'a[class*="action"]',
      '.nav-action',
      '.pagination-button',
      '.menu-item[data-action]',
      'a[href="#"][class*="nav"]'
    ];
    
    const $buttons = $(buttonSelectors.join(', '));
    
    let stats = {
      totalButtons: $buttons.length,
      addedIds: 0,
      addedAccessibility: 0,
      addedVisualFeedback: 0,
      modified: false
    };
    
    // 处理每个按钮
    $buttons.each((index, element) => {
      const $button = $(element);
      
      // 添加唯一ID
      if (addUniqueId($, $button, pagePath, index)) {
        stats.addedIds++;
        stats.modified = true;
      }
      
      // 添加无障碍属性
      if (addAccessibility($, $button)) {
        stats.addedAccessibility++;
        stats.modified = true;
      }
      
      // 添加视觉反馈
      const hasHover = $button.attr('class')?.includes('hover:');
      const hasFocus = $button.attr('class')?.includes('focus:');
      const hasActive = $button.attr('class')?.includes('active:');
      
      if (!hasHover || !hasFocus || !hasActive) {
        addVisualFeedback($, $button);
        stats.addedVisualFeedback++;
        stats.modified = true;
      }
    });
    
    // 如果有修改，保存文件
    if (stats.modified) {
      writeFileUtf8(filePath, $.html());
    }
    
    return {
      fixed: stats.modified,
      stats: stats
    };
  } catch (err) {
    console.error(colorText(`处理文件 ${pagePath} 出错: ${err.message}`, 'red'));
    return { fixed: false, error: err.message };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n${colorText('===== 特定按钮问题修复工具 =====', 'bright')}${colorText('blue')}`);
  
  // 要处理的页面列表
  const pagesToFix = [
    '/pages/admin/admin-settings.html',
    '/pages/admin/admin-system.html',
    '/pages/coming-soon.html'
  ];
  
  // 要处理的目录
  const directoriesToScan = [
    '/pages/farming'
  ];
  
  // 发现的页面
  const allPages = [...pagesToFix];
  
  // 扫描目录中的HTML文件
  for (const dir of directoriesToScan) {
    const dirPath = path.join(__dirname, '..', dir);
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file.endsWith('.html')) {
            allPages.push(`${dir}/${file}`);
          }
        }
      } catch (err) {
        console.error(colorText(`无法读取目录 ${dir}: ${err.message}`, 'red'));
      }
    } else {
      console.log(colorText(`警告：目录不存在 ${dir}`, 'yellow'));
    }
  }
  
  console.log(`发现 ${colorText(allPages.length, 'bright')} 个页面需要处理`);
  
  // 修复统计
  const stats = {
    total: allPages.length,
    fixed: 0,
    failed: 0,
    skipped: 0,
    buttons: {
      total: 0,
      addedIds: 0,
      addedAccessibility: 0,
      addedVisualFeedback: 0
    }
  };
  
  // 处理每个页面
  for (const pagePath of allPages) {
    console.log(`处理文件: ${colorText(pagePath, 'cyan')}`);
    
    const result = fixButtonsInPage(pagePath);
    
    if (result.fixed) {
      stats.fixed++;
      stats.buttons.total += result.stats.totalButtons;
      stats.buttons.addedIds += result.stats.addedIds;
      stats.buttons.addedAccessibility += result.stats.addedAccessibility;
      stats.buttons.addedVisualFeedback += result.stats.addedVisualFeedback;
      
      console.log(`  ${colorText('✓', 'green')} 修复了 ${result.stats.totalButtons} 个按钮 (ID: ${result.stats.addedIds}, 无障碍: ${result.stats.addedAccessibility}, 视觉反馈: ${result.stats.addedVisualFeedback})`);
    } else if (result.error) {
      stats.failed++;
      console.log(`  ${colorText('✗', 'red')} 修复失败: ${result.error}`);
    } else {
      stats.skipped++;
      console.log(`  ${colorText('-', 'yellow')} 无需修复或文件不存在`);
    }
  }
  
  // 总结
  console.log(`\n${colorText('修复结果汇总:', 'cyan')}`);
  console.log(`修复页面: ${colorText(stats.fixed, 'bright')}/${colorText(stats.total, 'bright')}`);
  console.log(`跳过页面: ${colorText(stats.skipped, 'yellow')}`);
  console.log(`失败页面: ${colorText(stats.failed, 'red')}`);
  console.log(`处理按钮总数: ${colorText(stats.buttons.total, 'bright')}`);
  console.log(`添加ID数量: ${colorText(stats.buttons.addedIds, 'bright')}`);
  console.log(`添加无障碍属性数量: ${colorText(stats.buttons.addedAccessibility, 'bright')}`);
  console.log(`添加视觉反馈数量: ${colorText(stats.buttons.addedVisualFeedback, 'bright')}`);
  
  console.log(`\n${colorText('✓ 特定按钮问题修复完成!', 'green')}`);
}

// 执行主函数
main().catch(err => {
  console.error(colorText(`执行过程出错: ${err.message}`, 'red'));
}); 