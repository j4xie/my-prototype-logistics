/**
 * 农业相关页面按钮属性修复脚本
 * 专门用于直接处理farming目录下所有页面的按钮
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 配置项
const config = {
  farmingPagesPath: path.join(__dirname, '../../../pages/farming'),
  reportPath: path.join(__dirname, '../../../validation/reports/farming_buttons_fix_report.json'),
  visualFeedbackClasses: {
    hover: 'trace-button-hover',
    focus: 'trace-button-focus',
    active: 'trace-button-active'
  },
  successLog: true, // 是否输出成功日志
  dryRun: false     // 是否只模拟而不实际修改文件
};

/**
 * 直接修复农业相关页面按钮属性
 */
async function fixFarmingButtons() {
  console.log(`\n===== 农业相关页面按钮属性直接修复工具 =====`);

  try {
    // 获取farming目录下的所有HTML文件
    const farmingPages = await getFarmingPages();
    console.log(`找到 ${farmingPages.length} 个农业相关页面需要处理`);
    
    // 修复统计
    const stats = {
      totalPages: farmingPages.length,
      modifiedPages: 0,
      fixedButtons: {
        uniqueId: 0,
        accessibility: 0,
        visualFeedback: 0
      }
    };

    // 处理每个页面
    for (const pagePath of farmingPages) {
      const filePath = path.join(config.farmingPagesPath, pagePath);
      
      console.log(`\n处理页面: ${pagePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`警告：找不到文件 ${pagePath}`);
        continue;
      }
      
      try {
        // 读取文件内容
        const html = fs.readFileSync(filePath, { encoding: 'utf-8' });
        
        // 添加视觉反馈样式类
        const modifiedHtml = addVisualFeedbackStyles(html);
        
        // 处理按钮属性
        const { html: processedHtml, stats: pageStats } = processButtonAttributes(modifiedHtml, pagePath);
        
        // 如果有修改，保存文件
        if (html !== processedHtml) {
          stats.modifiedPages++;
          stats.fixedButtons.uniqueId += pageStats.uniqueId;
          stats.fixedButtons.accessibility += pageStats.accessibility;
          stats.fixedButtons.visualFeedback += pageStats.visualFeedback;
          
          if (!config.dryRun) {
            fs.writeFileSync(filePath, processedHtml, { encoding: 'utf-8' });
          }
          
          if (config.successLog) {
            console.log(`✓ 修复文件 ${pagePath} (ID: ${pageStats.uniqueId}, 无障碍: ${pageStats.accessibility}, 视觉反馈: ${pageStats.visualFeedback})`);
          }
        }
      } catch (err) {
        console.error(`处理文件 ${pagePath} 出错: ${err.message}`);
      }
    }
    
    // 显示修复结果
    console.log(`\n修复结果汇总:`);
    console.log(`修改的页面: ${stats.modifiedPages}/${stats.totalPages}`);
    console.log(`补充的唯一ID: ${stats.fixedButtons.uniqueId}`);
    console.log(`补充的无障碍属性: ${stats.fixedButtons.accessibility}`);
    console.log(`补充的视觉反馈: ${stats.fixedButtons.visualFeedback}`);
    
    if (config.dryRun) {
      console.log(`\n注意: 这是模拟运行, 实际文件未被修改`);
    } else {
      console.log(`\n✓ 按钮属性修复完成!`);
    }
    
    return true;
  } catch (err) {
    console.error(`执行过程出错: ${err.message}`);
    return false;
  }
}

/**
 * 获取farming目录下的所有HTML文件
 * @returns {Promise<string[]>} HTML文件路径数组
 */
async function getFarmingPages() {
  try {
    const files = fs.readdirSync(config.farmingPagesPath);
    return files.filter(file => file.endsWith('.html'));
  } catch (err) {
    console.error(`获取farming页面失败: ${err.message}`);
    return [];
  }
}

/**
 * 添加视觉反馈样式类
 * @param {string} html - HTML内容
 * @returns {string} - 修改后的HTML内容
 */
function addVisualFeedbackStyles(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // 检查是否已有视觉反馈样式类
  const hasStyles = $('style').text().includes('.trace-button-hover');
  
  if (!hasStyles) {
    // 添加视觉反馈样式类
    const styles = `
/* 按钮视觉反馈样式 */
.trace-button-hover:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  opacity: 0.9;
}

.trace-button-focus:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
}

.trace-button-active:active {
  transform: scale(0.97);
}`;
    
    // 添加样式到head中
    const headStyle = $('head style').first();
    if (headStyle.length) {
      headStyle.append(styles);
    } else {
      $('head').append(`<style>${styles}</style>`);
    }
  }
  
  return $.html();
}

/**
 * 处理按钮属性
 * @param {string} html - HTML内容
 * @param {string} pagePath - 页面路径
 * @returns {Object} - 处理结果和统计
 */
function processButtonAttributes(html, pagePath) {
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // 查找所有按钮元素
  const buttons = [
    ...$.root().find('button').toArray(),
    ...$.root().find('a[role="button"]').toArray(),
    ...$.root().find('[role="button"]').toArray(),
    ...$.root().find('input[type="button"]').toArray(),
    ...$.root().find('input[type="submit"]').toArray()
  ];
  
  // 统计
  const stats = {
    uniqueId: 0,
    accessibility: 0,
    visualFeedback: 0
  };
  
  // 处理每个按钮
  buttons.forEach((button, index) => {
    const $button = $(button);
    
    // 修复唯一ID
    if (!$button.attr('id') || $button.attr('id').trim() === '') {
      const buttonIdBase = pagePath.replace(/[\/\\\.]/g, '-');
      const newId = `btn-${buttonIdBase}-${Date.now()}-${index}`;
      $button.attr('id', newId);
      stats.uniqueId++;
    }
    
    // 修复无障碍属性
    const ariaLabel = $button.attr('aria-label');
    const role = $button.attr('role');
    const tabindex = $button.attr('tabindex');
    
    if (!ariaLabel && !role && !tabindex) {
      // 添加aria-label
      const buttonText = $button.text().trim();
      if (buttonText) {
        $button.attr('aria-label', buttonText);
      } else if ($button.find('i, span[class*="icon"]').length) {
        // 尝试从图标类猜测标签
        const $icon = $button.find('i, span[class*="icon"]').first();
        const iconClass = $icon.attr('class') || '';
        const iconNameMatch = iconClass.match(/(fa-|icon-)([a-z-]+)/);
        const iconName = iconNameMatch ? iconNameMatch[2].replace(/-/g, ' ') : '';
        
        if (iconName) {
          $button.attr('aria-label', iconName);
        } else {
          $button.attr('aria-label', `Button ${$button.attr('id') || ''}`);
        }
      }
      
      // 添加tabindex
      if (!tabindex) {
        $button.attr('tabindex', '0');
      }
      
      stats.accessibility++;
    }
    
    // 修复视觉反馈
    const classList = ($button.attr('class') || '').split(' ');
    const hasVisualFeedback = 
      classList.includes('trace-button-hover') && 
      classList.includes('trace-button-focus') && 
      classList.includes('trace-button-active');
    
    if (!hasVisualFeedback) {
      // 移除可能存在的传统反馈样式
      const newClassList = classList.filter(cls => 
        !cls.includes('hover:') && 
        !cls.includes('focus:') && 
        !cls.includes('active:')
      );
      
      // 添加新的视觉反馈样式
      newClassList.push(config.visualFeedbackClasses.hover);
      newClassList.push(config.visualFeedbackClasses.focus);
      newClassList.push(config.visualFeedbackClasses.active);
      
      $button.attr('class', newClassList.join(' '));
      stats.visualFeedback++;
    }
  });
  
  return {
    html: $.html(),
    stats
  };
}

// 如果直接运行脚本则执行修复
if (require.main === module) {
  fixFarmingButtons().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = fixFarmingButtons; 