const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 配置
const config = {
  // 基础目录
  baseDir: path.resolve(__dirname, '..'),
  
  // 要检查的页面列表
  pages: [
    'pages/admin/admin-system.html',
    'pages/profile/settings.html',
    'pages/profile/profile.html',
    'pages/home/home-selector.html',
    'pages/farming/farming-monitor.html',
    'pages/trace/trace-list.html'
  ],
  
  // 按钮导航修复配置
  buttonFixes: [
    // 系统管理页面返回按钮
    {
      file: 'pages/admin/admin-system.html',
      selector: '.sidebar-item:contains("系统设置")',
      attributes: {
        'href': '../../pages/admin/admin-settings.html',
        'data-target': 'admin-settings'
      }
    },
    {
      file: 'pages/admin/admin-system.html',
      selector: '.menu-item:contains("系统设置")',
      attributes: {
        'href': '../../pages/admin/admin-settings.html',
        'data-target': 'admin-settings'
      }
    },
    {
      file: 'pages/admin/admin-system.html',
      selector: '.menu-item:contains("返回")',
      attributes: {
        'href': '../../pages/home/home-selector.html',
        'data-target': 'home'
      },
      ensureExists: true,
      template: '<a class="menu-item" href="../../pages/home/home-selector.html" data-target="home"><i class="fas fa-arrow-left"></i> 返回</a>'
    },
    
    // 高级修复：farming-monitor.html页面上的按钮点击问题
    {
      file: 'pages/farming/farming-monitor.html',
      selector: 'header.top-nav',
      attributes: {
        'style': 'pointer-events: none;'
      },
      cssAdditions: [
        '.top-nav * { pointer-events: auto; }',
        '.header-actions, .header-buttons { z-index: 10; }',
        '.action-btn, .control-btn, .monitor-action, .farming-action { position: relative; z-index: 15; }',
        // 增加更强的 z-index 和可见性规则
        '.monitoring-card, .control-panel, .data-container { z-index: 5 !important; }',
        '.monitoring-action button, .control-panel button { z-index: 20 !important; }',
        // 确保所有按钮都可点击
        'button, .btn, a.button, [role="button"] { pointer-events: auto !important; }',
        // 修复隐藏按钮问题
        '.hidden-action, [data-visibility="hidden"] { opacity: 0.5; pointer-events: auto !important; }'
      ],
      // 添加 JavaScript 修复
      jsAdditions: [
        // 为无法点击的按钮添加事件委托
        `document.addEventListener('DOMContentLoaded', function() {
          // 获取所有操作容器
          const actionContainers = document.querySelectorAll('.monitoring-card, .control-panel, .data-container');
          
          // 为每个容器添加点击事件委托
          actionContainers.forEach(container => {
            container.addEventListener('click', function(e) {
              // 检查点击的是否是按钮或其子元素
              let target = e.target;
              let buttonFound = false;
              
              // 向上查找最近的按钮
              while (target !== container && !buttonFound) {
                if (
                  target.tagName === 'BUTTON' || 
                  target.classList.contains('btn') ||
                  target.classList.contains('action-btn') ||
                  target.classList.contains('control-btn') ||
                  target.hasAttribute('role') && target.getAttribute('role') === 'button'
                ) {
                  buttonFound = true;
                  
                  // 如果按钮是隐藏的或被阻止点击
                  const rect = target.getBoundingClientRect();
                  const isOffscreen = (rect.bottom < 0 || rect.top > window.innerHeight);
                  
                  // 如果按钮有href属性，模拟导航
                  if (target.hasAttribute('href')) {
                    window.location.href = target.getAttribute('href');
                    e.preventDefault();
                  }
                  
                  // 如果按钮有onclick属性但被阻止了，手动执行
                  if (target.hasAttribute('onclick') && (target.style.pointerEvents === 'none' || isOffscreen)) {
                    const onclickCode = target.getAttribute('onclick');
                    try {
                      eval(onclickCode);
                      e.preventDefault();
                    } catch(err) {
                      console.error('执行按钮点击失败:', err);
                    }
                  }
                  
                  // 如果按钮有data-href属性，模拟导航
                  if (target.hasAttribute('data-href')) {
                    window.location.href = target.getAttribute('data-href');
                    e.preventDefault();
                  }
                  
                  // 如果按钮有data-action属性，触发自定义事件
                  if (target.hasAttribute('data-action')) {
                    const actionEvent = new CustomEvent('trace-action', {
                      detail: { action: target.getAttribute('data-action'), element: target }
                    });
                    document.dispatchEvent(actionEvent);
                    e.preventDefault();
                  }
                }
                
                target = target.parentElement;
                if (!target) break;
              }
            }, true); // 使用捕获模式，确保这个处理程序最先运行
          });
          
          // 特别处理 "查看历史" 和 "调整投喂量" 按钮
          const specialButtons = [
            { selector: 'button:contains("查看历史")', action: function() { 
              console.log('触发查看历史功能');
              // 通常是打开一个历史数据视图
              window.openHistoryView && window.openHistoryView(); 
            }},
            { selector: 'button:contains("调整投喂量")', action: function() { 
              console.log('触发调整投喂量功能');
              // 通常是打开调整饲料量的对话框
              window.openFeedingAdjustment && window.openFeedingAdjustment(); 
            }}
          ];
          
          // 通过DOM查找或创建这些按钮
          specialButtons.forEach(btn => {
            let button = document.querySelector(btn.selector);
            if (!button) {
              console.log('未找到按钮，尝试查找类似按钮');
              // 尝试通过部分文本匹配查找
              const allButtons = document.querySelectorAll('button');
              for (const b of allButtons) {
                if (b.textContent && b.textContent.includes(btn.selector.match(/:contains\\("(.+)"\\)/)[1])) {
                  button = b;
                  break;
                }
              }
            }
            
            if (button) {
              // 确保按钮可见且可交互
              button.style.zIndex = '100';
              button.style.position = 'relative';
              button.style.pointerEvents = 'auto';
              
              // 替换现有的点击处理程序
              button.onclick = btn.action;
              
              console.log('已修复特殊按钮:', btn.selector);
            } else {
              console.log('找不到按钮，无法修复:', btn.selector);
            }
          });
        });`
      ]
    },
    
    // 高级修复：trace-list.html页面上的按钮点击问题
    {
      file: 'pages/trace/trace-list.html',
      selector: '.trace-top-nav, .trace-more-menu',
      attributes: {
        'style': 'pointer-events: none;'
      },
      cssAdditions: [
        '.trace-top-nav *, .trace-more-menu * { pointer-events: auto; }',
        '.trace-top-nav-container, .trace-top-nav-button { z-index: 10; }',
        '.filter-btn, .period-filter button, .record-status button { position: relative; z-index: 25 !important; }',
        // 增加更强的选择器，确保所有过滤按钮都有较高的z-index
        '.period-filter, .record-status, .filter-group { position: relative; z-index: 20 !important; }',
        // 确保弹出菜单不会挡住按钮
        '.trace-more-menu.visible { z-index: 5 !important; pointer-events: none !important; }',
        '.trace-more-menu.visible * { pointer-events: auto; }',
        // 修复日期过滤器按钮
        'button:contains("今日"), button:contains("近7天"), button:contains("近30天") { z-index: 30 !important; }'
      ],
      // 添加 JavaScript 修复
      jsAdditions: [
        `document.addEventListener('DOMContentLoaded', function() {
          // 修复菜单冲突
          const menu = document.querySelector('.trace-more-menu');
          if (menu) {
            const closeMenuHandler = function(e) {
              if (!menu.contains(e.target) && menu.classList.contains('visible')) {
                menu.classList.remove('visible');
              }
            };
            
            document.addEventListener('click', closeMenuHandler);
          }
          
          // 修复日期筛选按钮
          const dateFilters = [
            { text: '今日', value: 'today' },
            { text: '近7天', value: '7days' },
            { text: '近30天', value: '30days' }
          ];
          
          dateFilters.forEach(filter => {
            const button = Array.from(document.querySelectorAll('button')).find(
              btn => btn.textContent.trim() === filter.text
            );
            
            if (button) {
              // 移除现有的事件并添加新的
              const newButton = button.cloneNode(true);
              button.parentNode.replaceChild(newButton, button);
              
              // 添加新的点击处理
              newButton.onclick = function(e) {
                e.stopPropagation();
                console.log('筛选记录：', filter.value);
                
                // 移除所有已选中状态
                document.querySelectorAll('.period-filter button').forEach(btn => {
                  btn.classList.remove('active');
                });
                
                // 添加选中状态
                newButton.classList.add('active');
                
                // 触发筛选功能
                if (window.filterTraceRecords) {
                  window.filterTraceRecords(filter.value);
                } else {
                  // 备用方法：刷新页面并添加参数
                  window.location.search = '?period=' + filter.value;
                }
              };
              
              // 修正样式
              newButton.style.position = 'relative';
              newButton.style.zIndex = '50';
              newButton.style.pointerEvents = 'auto';
              
              console.log('已修复日期筛选按钮:', filter.text);
            }
          });
          
          // 修复状态筛选按钮
          const statusFilters = [
            { text: '全部', value: 'all' },
            { text: '已完成', value: 'completed' },
            { text: '待审核', value: 'pending' },
            { text: '异常', value: 'error' },
            { text: '草稿', value: 'draft' }
          ];
          
          statusFilters.forEach(filter => {
            const button = Array.from(document.querySelectorAll('button')).find(
              btn => btn.textContent.trim() === filter.text
            );
            
            if (button) {
              // 移除现有的事件并添加新的
              const newButton = button.cloneNode(true);
              button.parentNode.replaceChild(newButton, button);
              
              // 添加新的点击处理
              newButton.onclick = function(e) {
                e.stopPropagation();
                console.log('筛选状态：', filter.value);
                
                // 移除所有已选中状态
                document.querySelectorAll('.record-status button').forEach(btn => {
                  btn.classList.remove('active');
                });
                
                // 添加选中状态
                newButton.classList.add('active');
                
                // 触发筛选功能
                if (window.filterRecordStatus) {
                  window.filterRecordStatus(filter.value);
                } else {
                  // 备用方法：刷新页面并添加参数
                  window.location.search = '?status=' + filter.value;
                }
              };
              
              // 修正样式
              newButton.style.position = 'relative';
              newButton.style.zIndex = '50';
              newButton.style.pointerEvents = 'auto';
              
              console.log('已修复状态筛选按钮:', filter.text);
            }
          });
        });`
      ]
    }
  ],
  
  // 报告输出路径
  reportPath: path.resolve(__dirname, '../validation/reports/button_navigation_fixes.json')
};

// 创建目录
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExists(dirname);
  fs.mkdirSync(dirname);
  return true;
}

// 修复按钮导航
async function fixButtonNavigation() {
  console.log('开始修复按钮导航问题...');
  
  const results = {
    timestamp: new Date().toISOString(),
    totalFiles: config.pages.length,
    fixedFiles: 0,
    fixedButtons: 0,
    addedButtons: 0,
    jsFixesAdded: 0,
    details: []
  };
  
  for (const page of config.pages) {
    const filePath = path.resolve(config.baseDir, page);
    
    if (!fs.existsSync(filePath)) {
      console.log(`文件不存在: ${page}`);
      continue;
    }
    
    console.log(`检查文件: ${page}`);
    let fileContent = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(fileContent);
    
    const fileResult = {
      file: page,
      fixes: []
    };
    
    let fileModified = false;
    
    // 应用修复
    for (const fix of config.buttonFixes) {
      if (fix.file === page) {
        // 查找并修复现有按钮
        if (fix.selector) {
          const elements = $(fix.selector);
          
          if (elements.length > 0) {
            elements.each((i, el) => {
              const element = $(el);
              let modified = false;
              
              // 应用属性
              if (fix.attributes) {
                for (const [attr, value] of Object.entries(fix.attributes)) {
                  // 如果是style属性，我们需要追加而不是替换
                  if (attr === 'style') {
                    const currentStyle = element.attr(attr) || '';
                    if (!currentStyle.includes(value)) {
                      element.attr(attr, `${currentStyle}${currentStyle ? '; ' : ''}${value}`);
                      modified = true;
                    }
                  } else if (element.attr(attr) !== value) {
                    element.attr(attr, value);
                    modified = true;
                  }
                }
              }
              
              if (modified) {
                console.log(`  修复了元素样式: ${element.prop('tagName').toLowerCase()}.${element.attr('class')}`);
                fileResult.fixes.push({
                  element: element.prop('tagName').toLowerCase() + (element.attr('class') ? '.' + element.attr('class') : ''),
                  selector: fix.selector,
                  attributes: fix.attributes
                });
                results.fixedButtons++;
                fileModified = true;
              }
            });
            
            // 添加CSS修复
            if (fix.cssAdditions && fix.cssAdditions.length > 0) {
              let styleTag = $('head style.button-navigation-fix');
              
              if (styleTag.length === 0) {
                styleTag = $('<style class="button-navigation-fix"></style>');
                $('head').append(styleTag);
              }
              
              const cssContent = fix.cssAdditions.join('\n');
              const currentContent = styleTag.html();
              
              if (!currentContent.includes(cssContent)) {
                styleTag.append(cssContent);
                console.log(`  添加了CSS修复`);
                fileResult.fixes.push({
                  type: 'css',
                  additions: fix.cssAdditions
                });
                fileModified = true;
              }
            }
            
            // 添加JavaScript修复
            if (fix.jsAdditions && fix.jsAdditions.length > 0) {
              // 查找<script>标签或在</body>前添加新的
              let jsContent = fix.jsAdditions.join('\n\n');
              
              // 检查是否已添加过这些修复
              let jsAlreadyAdded = false;
              $('script').each((i, el) => {
                const scriptContent = $(el).html();
                // 检查前100个字符是否匹配，作为简单的判断依据
                if (scriptContent && scriptContent.substring(0, 100) === jsContent.substring(0, 100)) {
                  jsAlreadyAdded = true;
                  return false; // 跳出循环
                }
              });
              
              if (!jsAlreadyAdded) {
                // 创建新的script标签
                const scriptTag = $('<script type="text/javascript" class="button-fix-script"></script>');
                scriptTag.html('\n' + jsContent + '\n');
                
                // 添加到</body>之前
                $('body').append(scriptTag);
                
                console.log(`  添加了JavaScript修复`);
                fileResult.fixes.push({
                  type: 'javascript',
                  additions: fix.jsAdditions
                });
                results.jsFixesAdded++;
                fileModified = true;
              }
            }
          } else if (fix.ensureExists && fix.template) {
            // 如果按钮不存在，但需要确保存在，则添加按钮
            console.log(`  添加按钮: ${fix.selector}`);
            
            // 根据不同类型的页面添加到适当的位置
            if (page.includes('admin-system.html')) {
              $('.sidebar-nav').append(fix.template);
            } else if (page.includes('settings.html')) {
              $('.settings-container').append(fix.template);
            } else {
              $('body').append(fix.template);
            }
            
            fileResult.fixes.push({
              button: "新增按钮",
              selector: fix.selector,
              template: fix.template,
              added: true
            });
            
            results.addedButtons++;
            fileModified = true;
          }
        }
      }
    }
    
    // 如果文件被修改，保存更改
    if (fileModified) {
      fs.writeFileSync(filePath, $.html());
      console.log(`  保存修改: ${page}`);
      results.fixedFiles++;
      results.details.push(fileResult);
    }
  }
  
  // 保存报告
  ensureDirectoryExists(config.reportPath);
  fs.writeFileSync(config.reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n修复完成:');
  console.log(`- 检查了 ${results.totalFiles} 个文件`);
  console.log(`- 修复了 ${results.fixedFiles} 个文件`);
  console.log(`- 修复了 ${results.fixedButtons} 个按钮/元素`);
  console.log(`- 添加了 ${results.addedButtons} 个按钮`);
  console.log(`- 添加了 ${results.jsFixesAdded} 个JavaScript修复`);
  console.log(`报告已保存至: ${config.reportPath}`);
  
  console.log('\n建议执行以下命令验证修复效果:');
  console.log('npm run test:button-navigation');
  
  return results;
}

// 如果作为脚本直接运行，执行修复
if (require.main === module) {
  fixButtonNavigation().catch(console.error);
}

module.exports = { fixButtonNavigation }; 