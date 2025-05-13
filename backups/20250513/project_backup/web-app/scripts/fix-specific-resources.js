/**
 * 资源路径修复脚本
 * 专门针对资源测试中发现的问题
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 配置
const config = {
  baseDir: path.resolve(__dirname, '..'),
  reportPath: path.join(__dirname, '../validation/reports/resource_report.json'),
  logPath: path.join(__dirname, '../validation/reports/fix_specific_resources_log.json'),
  createMissingDirs: true,
  debug: true
};

// 确保目录存在
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`创建目录: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

// 读取验证报告
function readReport() {
  try {
    if (!fs.existsSync(config.reportPath)) {
      console.error(`验证报告不存在: ${config.reportPath}`);
      return null;
    }
    
    const reportData = fs.readFileSync(config.reportPath, 'utf8');
    return JSON.parse(reportData);
  } catch (error) {
    console.error('读取报告失败:', error);
    return null;
  }
}

// 分析失败资源
function analyzeFailedResources(failedResources) {
  // 按失败类型分类资源
  const failuresByType = {
    missingFiles: [],          // 文件不存在
    wrongPaths: [],            // 路径错误
    networkErrors: [],         // 网络错误
    other: []                  // 其他错误
  };
  
  // 按路径模式分类
  const failuresByPattern = {};
  
  failedResources.forEach(resource => {
    // 分析失败类型
    if (resource.failure && resource.failure.includes('ERR_FILE_NOT_FOUND')) {
      failuresByType.missingFiles.push(resource);
    } else if (resource.failure && resource.failure.includes('ERR_FAILED')) {
      failuresByType.networkErrors.push(resource);
    } else {
      failuresByType.other.push(resource);
    }
    
    // 分析路径模式
    const url = resource.url;
    let pattern = 'unknown';
    
    if (url.includes('/C:/components/')) {
      pattern = 'root-components';
    } else if (url.includes('/pages/components/')) {
      pattern = 'pages-components';
    } else if (url.includes('/components/')) {
      pattern = 'components';
    } else if (url.includes('/assets/')) {
      pattern = 'assets';
    }
    
    failuresByPattern[pattern] = failuresByPattern[pattern] || [];
    failuresByPattern[pattern].push(resource);
  });
  
  return { failuresByType, failuresByPattern };
}

// 修复组件路径引用
function fixComponentReferences(pages, failureAnalysis) {
  console.log('\n修复组件引用...');
  const fixedReferences = [];
  
  // 最常见的错误路径模式
  const pathPatterns = [
    { from: /href=["']\/C:\/assets\//g, to: 'href="../../assets/' },
    { from: /src=["']\/C:\/components\//g, to: 'src="../../components/' },
    { from: /src=["']\/components\//g, to: 'src="../../components/' },
    { from: /src=["']\.\.\/components\//g, to: 'src="../../components/' },
    { from: /src=["']\.\.\/pages\/components\//g, to: 'src="../../components/' },
    { from: /src=["']\.\/components\//g, to: 'src="../../components/' },
    { from: /src=["']\/pages\/components\//g, to: 'src="../../components/' }
  ];
  
  // 查找所有HTML文件
  const htmlFiles = [];
  
  function findHtmlFiles(directory) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        findHtmlFiles(fullPath);
      } else if (file.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  
  // 从基础目录开始搜索
  findHtmlFiles(config.baseDir);
  console.log(`找到 ${htmlFiles.length} 个HTML文件`);
  
  // 处理每个HTML文件
  for (const htmlFile of htmlFiles) {
    try {
      const relativePath = path.relative(config.baseDir, htmlFile);
      console.log(`\n处理文件: ${relativePath}`);
      
      // 读取文件内容
      const content = fs.readFileSync(htmlFile, 'utf8');
      const $ = cheerio.load(content);
      let modified = false;
      
      // 修复脚本引用
      $('script').each((i, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        
        // 计算相对于组件目录的深度
        const depth = relativePath.split(path.sep).length - 1;
        const prefix = '../'.repeat(depth - 1);
        
        // 检查是否为错误路径模式
        let newSrc = src;
        let matched = false;
        
        for (const pattern of pathPatterns) {
          if (pattern.from.test(src)) {
            newSrc = src.replace(pattern.from, pattern.to);
            matched = true;
            break;
          }
        }
        
        // 特殊情况处理
        if (src.includes('/pages/components/')) {
          newSrc = src.replace(/\/pages\/components\//, `/${prefix}components/`);
          matched = true;
        }
        
        if (matched && newSrc !== src) {
          $(el).attr('src', newSrc);
          modified = true;
          
          fixedReferences.push({
            file: relativePath,
            originalSrc: src,
            newSrc: newSrc
          });
          
          console.log(`  修复脚本引用: ${src} -> ${newSrc}`);
        }
      });
      
      // 修复样式引用
      $('link[rel="stylesheet"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        // 计算相对于样式目录的深度
        const depth = relativePath.split(path.sep).length - 1;
        const prefix = '../'.repeat(depth - 1);
        
        // 检查是否为错误路径模式
        if (href.includes('/C:/assets/') || href.includes('/assets/')) {
          const newHref = href
            .replace(/\/C:\/assets\//, `/${prefix}assets/`)
            .replace(/^\/assets\//, `/${prefix}assets/`);
          
          if (newHref !== href) {
            $(el).attr('href', newHref);
            modified = true;
            
            fixedReferences.push({
              file: relativePath,
              originalHref: href,
              newHref: newHref
            });
            
            console.log(`  修复样式引用: ${href} -> ${newHref}`);
          }
        }
      });
      
      // 确保引入了常用组件
      const commonComponents = [
        'trace-common.js',
        'trace-error-handler.js',
        'trace-ui.js',
        'trace-nav.js',
        'trace-a11y.js',
        'trace-store.js'
      ];
      
      // 检查页面是否已经包含了这些组件
      const missingComponents = [];
      
      for (const comp of commonComponents) {
        if ($(`script[src*="${comp}"]`).length === 0) {
          missingComponents.push(comp);
        }
      }
      
      // 为页面添加缺失的组件
      if (missingComponents.length > 0) {
        console.log(`  添加缺失组件: ${missingComponents.join(', ')}`);
        
        // 计算相对于组件目录的深度
        const depth = relativePath.split(path.sep).length - 1;
        const prefix = '../'.repeat(depth - 1);
        
        // 将组件添加到head中
        for (const comp of missingComponents) {
          const scriptTag = `<script src="${prefix}components/${comp}"></script>`;
          $('head').append(scriptTag);
          
          fixedReferences.push({
            file: relativePath,
            action: 'added',
            component: comp
          });
        }
        
        modified = true;
      }
      
      // 保存修改后的文件
      if (modified) {
        fs.writeFileSync(htmlFile, $.html());
        console.log(`  已更新文件: ${relativePath}`);
      }
    } catch (error) {
      console.error(`处理文件 ${htmlFile} 失败:`, error);
    }
  }
  
  return fixedReferences;
}

// 创建缺失的组件文件
function createMissingComponents() {
  console.log('\n创建缺失的组件文件...');
  const createdComponents = [];
  
  // 常用组件列表
  const components = [
    { name: 'trace-common.js', exists: true },
    { name: 'trace-ui.js', exists: true },
    { name: 'trace-error-handler.js', exists: true },
    { name: 'trace-nav.js', exists: true },
    { name: 'trace-store.js', exists: true },
    { name: 'trace-a11y.js', exists: true },
    { name: 'trace-ux.js', exists: true },
    { name: 'autoload-button-upgrade.js', exists: false },
    { name: 'trace-form-validation.js', exists: true },
    { name: 'trace-ui-components.js', exists: true }
  ];
  
  const componentsDir = path.join(config.baseDir, 'components');
  ensureDirectoryExists(componentsDir);
  
  // 检查并创建缺失的组件
  for (const component of components) {
    const componentPath = path.join(componentsDir, component.name);
    
    if (!fs.existsSync(componentPath) || !component.exists) {
      // 创建基本组件模板
      let content = '';
      
      if (component.name === 'autoload-button-upgrade.js') {
        content = `/**
 * 按钮自动升级
 * 为按钮添加辅助功能、视觉反馈等
 * 版本: 1.0.0
 */

(function() {
  // 在DOM加载完成后执行
  document.addEventListener('DOMContentLoaded', function() {
    upgradeButtons();
  });
  
  /**
   * 升级页面中的所有按钮
   */
  function upgradeButtons() {
    // 查找所有按钮
    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
    
    buttons.forEach(function(button, index) {
      // 添加唯一ID
      if (!button.id) {
        button.id = \`btn_\${Date.now()}_\${index}\`;
      }
      
      // 确保有aria角色
      if (!button.hasAttribute('role')) {
        button.setAttribute('role', 'button');
      }
      
      // 添加视觉反馈
      addVisualFeedback(button);
      
      // 添加键盘支持
      addKeyboardSupport(button);
    });
    
    console.log(\`自动升级了 \${buttons.length} 个按钮\`);
  }
  
  /**
   * 添加视觉反馈
   * @param {HTMLElement} button - 按钮元素
   */
  function addVisualFeedback(button) {
    // 添加悬停效果
    button.addEventListener('mouseenter', function() {
      button.classList.add('hover-effect');
    });
    
    button.addEventListener('mouseleave', function() {
      button.classList.remove('hover-effect');
    });
    
    // 添加点击效果
    button.addEventListener('mousedown', function() {
      button.classList.add('active-effect');
    });
    
    button.addEventListener('mouseup', function() {
      button.classList.remove('active-effect');
    });
  }
  
  /**
   * 添加键盘支持
   * @param {HTMLElement} button - 按钮元素
   */
  function addKeyboardSupport(button) {
    // 确保可聚焦
    if (!button.hasAttribute('tabindex')) {
      button.setAttribute('tabindex', '0');
    }
    
    // 添加键盘事件
    button.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        button.click();
      }
    });
  }
  
  // 导出模块
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { upgradeButtons };
  } else {
    window.buttonUpgrade = { upgradeButtons };
  }
})();`;
      } else if (component.name === 'trace-ui-components.js') {
        content = `/**
 * UI组件库
 * 版本: 1.0.0
 */

const traceUIComponents = {
  /**
   * 显示toast消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (info|success|warning|error)
   * @param {number} duration - 显示持续时间(ms)
   */
  showToast: function(message, type = 'info', duration = 3000) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = \`trace-toast trace-toast-\${type}\`;
    toast.innerHTML = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
      toast.classList.add('trace-toast-show');
    }, 10);
    
    // 自动移除
    setTimeout(() => {
      toast.classList.remove('trace-toast-show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  },
  
  /**
   * 显示确认对话框
   * @param {string} message - 确认信息
   * @param {Function} onConfirm - 确认回调
   * @param {Function} onCancel - 取消回调
   */
  showConfirm: function(message, onConfirm, onCancel) {
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'trace-overlay';
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'trace-dialog';
    dialog.innerHTML = \`
      <div class="trace-dialog-content">
        <p>\${message}</p>
        <div class="trace-dialog-buttons">
          <button class="trace-btn trace-btn-cancel">取消</button>
          <button class="trace-btn trace-btn-primary trace-btn-confirm">确认</button>
        </div>
      </div>
    \`;
    
    // 添加到页面
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 注册事件
    dialog.querySelector('.trace-btn-confirm').addEventListener('click', () => {
      document.body.removeChild(overlay);
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
    
    dialog.querySelector('.trace-btn-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      if (typeof onCancel === 'function') {
        onCancel();
      }
    });
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceUIComponents;
} else {
  window.traceUIComponents = traceUIComponents;
}`;
      } else {
        // 通用组件模板
        const componentName = component.name.replace('.js', '').replace(/-/g, '_');
        content = `/**
 * ${component.name.replace('.js', '')}
 * 版本: 1.0.0
 */

const ${componentName} = {
  // 基本功能占位
  init: function() {
    console.log('${component.name.replace('.js', '')} 初始化');
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ${componentName};
} else {
  window.${componentName} = ${componentName};
}`;
      }
      
      // 写入文件
      fs.writeFileSync(componentPath, content);
      console.log(`创建组件: ${component.name}`);
      
      createdComponents.push({
        name: component.name,
        path: componentPath
      });
    }
  }
  
  return createdComponents;
}

// 修复路径问题
async function run() {
  console.log('开始修复资源问题...');
  
  // 读取验证报告
  const report = readReport();
  if (!report) {
    console.error('无法读取验证报告，终止修复');
    return;
  }
  
  console.log(`验证报告时间: ${report.timestamp}`);
  console.log(`总页面: ${report.totalPages}, 成功: ${report.successPages}, 失败: ${report.failedPages}`);
  console.log(`总资源请求: ${report.totalRequests}, 失败请求: ${report.failedRequests}, 失败率: ${report.failureRate}`);
  
  // 分析失败资源
  const analysis = analyzeFailedResources(report.failedResourceDetails);
  
  console.log('\n分析失败资源:');
  console.log(`文件不存在: ${analysis.failuresByType.missingFiles.length}`);
  console.log(`网络错误: ${analysis.failuresByType.networkErrors.length}`);
  console.log(`其他错误: ${analysis.failuresByType.other.length}`);
  
  Object.keys(analysis.failuresByPattern).forEach(pattern => {
    console.log(`${pattern}: ${analysis.failuresByPattern[pattern].length}`);
  });
  
  // 创建缺失的组件
  const createdComponents = createMissingComponents();
  
  // 修复引用路径
  const fixedReferences = fixComponentReferences(report.pageResults, analysis);
  
  // 生成修复报告
  const fixReport = {
    timestamp: new Date().toISOString(),
    originalReport: report.timestamp,
    createdComponents: createdComponents,
    fixedReferences: fixedReferences,
    summary: {
      totalComponentsCreated: createdComponents.length,
      totalReferencesFixed: fixedReferences.length
    }
  };
  
  // 保存修复报告
  fs.writeFileSync(config.logPath, JSON.stringify(fixReport, null, 2));
  
  console.log('\n修复完成!');
  console.log(`创建了 ${createdComponents.length} 个组件`);
  console.log(`修复了 ${fixedReferences.length} 个引用`);
  console.log(`修复报告已保存至: ${config.logPath}`);
  
  return fixReport;
}

// 导出模块
module.exports = { run };

// 如果直接运行这个文件
if (require.main === module) {
  run().catch(error => {
    console.error('修复过程发生错误:', error);
    process.exit(1);
  });
} 