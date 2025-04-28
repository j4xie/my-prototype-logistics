/**
 * 按钮导航修复脚本
 * 解决按钮点击和导航问题
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 配置信息
const config = {
  problemPages: [
    {
      path: '/pages/farming/farming-monitor.html',
      buttons: [
        { selector: '.view-history-btn', label: '查看历史', action: 'javascript' },
        { selector: '.adjust-feeding-btn', label: '调整投喂量', action: 'javascript' },
        { selector: '.back-btn, .return-btn', label: '返回', action: 'add' }
      ]
    },
    {
      path: '/pages/trace/trace-list.html',
      buttons: [
        { selector: '.filter-btn', label: '筛选', action: 'fix-pointer' },
        { selector: '.menu-btn', label: '菜单', action: 'fix-pointer' }
      ]
    },
    {
      path: '/pages/admin/admin-system.html',
      buttons: [
        { selector: '.back-btn, .return-btn', label: '返回', action: 'add' }
      ]
    }
  ],
  basePath: path.resolve(process.cwd()),
  cssFixTemplate: `
    /* 按钮导航修复样式 */
    .clickable-fix {
      position: relative;
      z-index: 1000 !important;
      pointer-events: auto !important;
    }
    .btn-wrapper {
      position: relative;
    }
    .btn-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1001;
      cursor: pointer;
    }
  `,
  jsFixTemplate: `
    // 按钮导航修复脚本
    document.addEventListener('DOMContentLoaded', function() {
      // 处理被拦截的按钮点击
      document.querySelectorAll('.btn-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
          const targetBtn = this.closest('.btn-wrapper').querySelector('button, a, .btn');
          if (targetBtn) {
            if (targetBtn.tagName === 'A' && targetBtn.href) {
              window.location.href = targetBtn.href;
            } else {
              targetBtn.click();
            }
          }
        });
      });
      
      // 处理特殊按钮
      const viewHistoryBtns = document.querySelectorAll('.view-history-btn');
      if (viewHistoryBtns.length > 0) {
        viewHistoryBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            const farmId = this.dataset.farmId || '1';
            window.location.href = '/pages/farming/farming-history.html?id=' + farmId;
          });
        });
      }
      
      const adjustFeedingBtns = document.querySelectorAll('.adjust-feeding-btn');
      if (adjustFeedingBtns.length > 0) {
        adjustFeedingBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            const farmId = this.dataset.farmId || '1';
            window.location.href = '/pages/farming/farming-adjust.html?id=' + farmId;
          });
        });
      }
    });
  `
};

// 高级修复选项
const advancedFixes = {
  'farming-monitor.html': `
    /* 养殖监控页面特殊修复 */
    .farming-monitor .data-card {
      z-index: 10;
    }
    .farming-monitor .data-card button,
    .farming-monitor .data-card .btn {
      z-index: 100;
      position: relative;
    }
    .farming-monitor .chart-container {
      z-index: 5;
    }
    .view-history-btn, .adjust-feeding-btn {
      visibility: visible !important;
      opacity: 1 !important;
      display: inline-block !important;
    }
  `,
  'trace-list.html': `
    /* 溯源列表页面特殊修复 */
    .trace-list .filter-section {
      z-index: 50;
    }
    .trace-list .filter-btn,
    .trace-list .menu-btn {
      z-index: 100;
      position: relative;
      pointer-events: auto !important;
    }
    .trace-list .overlay {
      pointer-events: none !important;
    }
    .filter-btn, .menu-btn {
      visibility: visible !important;
      opacity: 1 !important;
      display: inline-block !important;
    }
  `
};

/**
 * 修复HTML文件的按钮导航问题
 * @param {string} filePath - 文件路径
 * @param {object} pageConfig - 页面配置
 * @param {boolean} isAdvanced - 是否使用高级修复
 * @returns {object} - 修复结果
 */
function fixButtonNavigation(filePath, pageConfig, isAdvanced = false) {
  try {
    // 读取HTML文件
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    
    // 检查是否已存在修复样式
    let cssFixAdded = $('style.button-nav-fix').length > 0;
    let jsFixAdded = $('script.button-nav-fix').length > 0;
    
    // 添加CSS修复
    if (!cssFixAdded) {
      let cssToAdd = config.cssFixTemplate;
      
      // 如果是高级修复，添加特定页面的样式
      if (isAdvanced) {
        const fileName = path.basename(filePath);
        if (advancedFixes[fileName]) {
          cssToAdd += advancedFixes[fileName];
        }
      }
      
      $('head').append(`<style class="button-nav-fix">${cssToAdd}</style>`);
      cssFixAdded = true;
    }
    
    // 添加JS修复
    if (!jsFixAdded) {
      $('body').append(`<script class="button-nav-fix">${config.jsFixTemplate}</script>`);
      jsFixAdded = true;
    }
    
    // 修复特定按钮
    let fixedButtons = 0;
    if (pageConfig && pageConfig.buttons) {
      pageConfig.buttons.forEach(buttonConfig => {
        const { selector, label, action } = buttonConfig;
        const buttons = $(selector);
        
        if (buttons.length === 0 && action === 'add') {
          // 添加缺失的按钮
          $('body').append(`
            <a href="javascript:history.back()" class="return-btn" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
              <button class="btn back-btn">返回</button>
            </a>
          `);
          fixedButtons++;
        } else {
          buttons.each((index, button) => {
            const $button = $(button);
            
            if (action === 'fix-pointer') {
              // 修复指针事件问题
              $button.addClass('clickable-fix');
              
              // 如果按钮还没有包装器，添加包装器和覆盖层
              if (!$button.parent().hasClass('btn-wrapper')) {
                $button.wrap('<div class="btn-wrapper"></div>');
                $button.after('<div class="btn-overlay"></div>');
              }
            } else if (action === 'javascript') {
              // 添加数据属性以供JavaScript使用
              $button.addClass('clickable-fix');
              $button.attr('data-farm-id', '1'); // 默认ID
            }
            
            fixedButtons++;
          });
        }
      });
    }
    
    // 保存修改后的HTML
    fs.writeFileSync(filePath, $.html());
    
    return {
      path: filePath,
      fixed: fixedButtons,
      cssAdded: cssFixAdded,
      jsAdded: jsFixAdded
    };
  } catch (error) {
    console.error(`修复文件 ${filePath} 时出错:`, error);
    return {
      path: filePath,
      error: error.message
    };
  }
}

/**
 * 主函数
 */
function main() {
  console.log('开始修复按钮导航问题...');
  
  // 检查是否使用高级修复选项
  const useAdvanced = process.argv.includes('--advanced');
  if (useAdvanced) {
    console.log('使用高级修复模式');
  }
  
  // 处理所有问题页面
  const results = [];
  config.problemPages.forEach(pageConfig => {
    const filePath = path.join(config.basePath, pageConfig.path.replace(/^\//, ''));
    
    if (fs.existsSync(filePath)) {
      const result = fixButtonNavigation(filePath, pageConfig, useAdvanced);
      results.push(result);
    } else {
      console.warn(`文件不存在: ${filePath}`);
      results.push({
        path: filePath,
        error: '文件不存在'
      });
    }
  });
  
  // 生成报告
  console.log('\n按钮导航修复报告:');
  console.log('---------------------');
  
  let totalFixed = 0;
  let totalErrors = 0;
  
  results.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.path}: ${result.error}`);
      totalErrors++;
    } else {
      console.log(`✅ ${result.path}: 修复了 ${result.fixed} 个按钮`);
      if (result.cssAdded) console.log(`   添加了CSS修复`);
      if (result.jsAdded) console.log(`   添加了JavaScript修复`);
      totalFixed += result.fixed;
    }
  });
  
  console.log('\n总结:');
  console.log(`- 修复了 ${totalFixed} 个按钮`);
  console.log(`- 处理了 ${results.length - totalErrors} 个文件`);
  if (totalErrors > 0) {
    console.log(`- ${totalErrors} 个文件处理失败`);
  }
  
  // 保存报告到文件
  const reportPath = path.join(config.basePath, 'validation/reports/button_navigation_fix_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: useAdvanced ? 'advanced' : 'standard',
      results,
      summary: {
        totalFixed,
        totalFiles: results.length,
        totalErrors
      }
    }, null, 2)
  );
  console.log(`\n报告已保存至: ${reportPath}`);
}

// 执行主函数
main(); 