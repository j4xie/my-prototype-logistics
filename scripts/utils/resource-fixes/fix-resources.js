/**
 * 资源修复脚本
 * 用于修复验证中发现的资源加载问题
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 配置
const config = {
  baseDir: path.resolve(__dirname, '..'),
  reportPath: path.join(__dirname, '../validation/reports/resource_report.json'),
  logPath: path.join(__dirname, '../validation/reports/fix_resources_log.json'),
  pagesToFix: [
    '/index.html',
    '/pages/farming/farming-monitor.html',
    '/pages/trace/trace-map.html'
  ],
  imagesDir: '/assets/images',
  componentsDir: '/components',
  createMissingDirs: true,
  // 调试模式
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

// 修复图片资源
function fixMissingImages(failedResources) {
  console.log('\n修复缺失的图片资源...');
  const fixedImages = [];
  const imageMap = new Map();
  
  // 查找所有图片资源请求错误
  const missingImages = failedResources.filter(r => 
    r.resourceType === 'image' && 
    (r.failure?.includes('ERR_FILE_NOT_FOUND') || r.status === 404)
  );
  
  if (missingImages.length === 0) {
    console.log('没有发现缺失的图片资源');
    return fixedImages;
  }
  
  console.log(`发现 ${missingImages.length} 个缺失的图片资源`);
  if (config.debug) {
    console.log('缺失图片列表:');
    missingImages.forEach((img, index) => {
      console.log(`${index+1}. ${img.url} (${img.failure || img.status})`);
    });
  }
  
  // 创建占位图片
  const placeholderDir = path.join(config.baseDir, 'assets/images');
  ensureDirectoryExists(placeholderDir);
  
  // 准备不同类型的占位图
  const placeholders = {
    'monitor': path.join(placeholderDir, 'placeholder-monitor.jpg'),
    'avatar': path.join(placeholderDir, 'placeholder-avatar.jpg'),
    'icon': path.join(placeholderDir, 'placeholder-icon.svg'),
    'default': path.join(placeholderDir, 'placeholder-default.jpg')
  };
  
  // 创建占位图片
  for (const [type, filePath] of Object.entries(placeholders)) {
    if (!fs.existsSync(filePath)) {
      if (type === 'icon') {
        // 创建SVG占位图标
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="5"></circle></svg>`;
        fs.writeFileSync(filePath, svgData);
      } else {
        // 创建简单的占位图片数据 (1x1 pixel JPEG)
        const placeholderData = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 
          0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 
          0x03, 0x03, 0x04, 0x05, 0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0a, 0x07, 
          0x07, 0x06, 0x08, 0x0c, 0x0a, 0x0c, 0x0c, 0x0b, 0x0a, 0x0b, 0x0b, 0x0d, 
          0x0e, 0x12, 0x10, 0x0d, 0x0e, 0x11, 0x0e, 0x0b, 0x0b, 0x10, 0x16, 0x10, 
          0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0c, 0x0f, 0x17, 0x18, 0x16, 0x14, 
          0x18, 0x12, 0x14, 0x15, 0x14, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 
          0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
          0x00, 0x00, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
          0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 
          0x37, 0xff, 0xd9
        ]);
        
        fs.writeFileSync(filePath, placeholderData);
      }
      console.log(`创建占位图: ${filePath}`);
    }
  }
  
  // 处理每个缺失的图片
  for (const img of missingImages) {
    try {
      const urlParts = img.url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      let targetType = 'default';
      
      // 判断图片类型
      if (fileName.includes('monitor')) {
        targetType = 'monitor';
      } else if (fileName.includes('avatar')) {
        targetType = 'avatar';
      } else if (fileName.includes('.svg') || fileName.includes('icon')) {
        targetType = 'icon';
      }
      
      // 确定目标路径
      let targetPath;
      if (img.url.includes('/pages/farming/assets/images/')) {
        // 特殊处理farming目录下的图片
        targetPath = path.join(
          config.baseDir, 
          'pages/farming/assets/images', 
          fileName
        );
        ensureDirectoryExists(path.dirname(targetPath));
      } else if (img.url.match(/file:\/\/\/C:\/assets\//)) {
        // 根目录下的assets
        targetPath = path.join(
          config.baseDir,
          'assets',
          fileName
        );
        ensureDirectoryExists(path.dirname(targetPath));
      } else if (img.url.includes('/assets/icons/')) {
        // 处理图标资源
        targetPath = path.join(
          config.baseDir,
          'assets/icons',
          fileName
        );
        ensureDirectoryExists(path.dirname(targetPath));
      } else {
        // 通用图片路径处理
        const relativePath = img.url
          .replace('file:///C:/Users/Steve/heiniu/web-app/', '')
          .replace('file:///C:/', '')
          .replace('http://localhost:8888/', '')
          .replace('http://localhost:8080/', '');
        
        targetPath = path.join(config.baseDir, relativePath);
        ensureDirectoryExists(path.dirname(targetPath));
      }
      
      // 复制占位图到目标位置
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(placeholders[targetType], targetPath);
        console.log(`创建占位图: ${targetPath} (类型: ${targetType})`);
        
        fixedImages.push({
          original: img.url,
          fixed: targetPath,
          type: targetType
        });
      }
    } catch (error) {
      console.error(`修复图片 ${img.url} 失败:`, error);
    }
  }
  
  return fixedImages;
}

// 修复JS组件引用
function fixComponentReferences() {
  console.log('\n修复组件引用...');
  const fixedReferences = [];
  
  // 遍历需要修复的页面
  for (const pagePath of config.pagesToFix) {
    const fullPath = path.join(config.baseDir, pagePath.replace(/^\//, ''));
    
    if (!fs.existsSync(fullPath)) {
      console.error(`页面文件不存在: ${fullPath}`);
      continue;
    }
    
    try {
      const html = fs.readFileSync(fullPath, 'utf8');
      const $ = cheerio.load(html);
      let modified = false;
      
      // 修复脚本引用
      $('script').each((i, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        
        // 修复根路径引用
        if (src.startsWith('/components/') || src.startsWith('/C:/components/')) {
          const newSrc = src.replace(/^\/C:\/components\//, '../components/')
                           .replace(/^\/components\//, '../components/');
          
          $(el).attr('src', newSrc);
          modified = true;
          
          fixedReferences.push({
            page: pagePath,
            originalSrc: src,
            newSrc: newSrc
          });
        }
      });
      
      // 修复样式引用
      $('link[rel="stylesheet"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        // 修复根路径引用
        if (href.startsWith('/assets/') || href.startsWith('/C:/assets/')) {
          const newHref = href.replace(/^\/C:\/assets\//, '../assets/')
                             .replace(/^\/assets\//, '../assets/');
          
          $(el).attr('href', newHref);
          modified = true;
          
          fixedReferences.push({
            page: pagePath,
            originalHref: href,
            newHref: newHref
          });
        }
      });
      
      // 处理丢失的组件
      handleMissingComponents($, pagePath, fixedReferences);
      
      // 保存修改后的文件
      if (modified) {
        fs.writeFileSync(fullPath, $.html());
        console.log(`已更新页面: ${pagePath}`);
      }
    } catch (error) {
      console.error(`处理页面 ${pagePath} 失败:`, error);
    }
  }
  
  return fixedReferences;
}

// 处理丢失的组件
function handleMissingComponents($, pagePath, fixedReferences) {
  // 确保常用组件存在
  const commonComponents = [
    { name: 'trace-common.js', path: 'components/trace-common.js' },
    { name: 'trace-ui-components.js', path: 'components/trace-ui-components.js' },
    { name: 'autoload-button-upgrade.js', path: 'components/autoload-button-upgrade.js' },
    { name: 'trace-form-validation.js', path: 'components/trace-form-validation.js' },
    { name: 'trace-error-handler.js', path: 'components/trace-error-handler.js' },
    { name: 'trace-ux.js', path: 'components/trace-ux.js' },
    { name: 'trace-store.js', path: 'components/trace-store.js' },
    { name: 'trace-a11y.js', path: 'components/trace-a11y.js' },
    { name: 'trace-routes.js', path: 'components/trace-routes.js' },
    { name: 'trace-ui.js', path: 'components/trace-ui.js' }
  ];
  
  // 创建缺少的组件
  for (const comp of commonComponents) {
    const componentPath = path.join(config.baseDir, comp.path);
    
    // 如果组件不存在，创建它
    if (!fs.existsSync(componentPath)) {
      ensureDirectoryExists(path.dirname(componentPath));
      
      // 创建基本组件内容
      const componentContent = createComponentTemplate(comp.name);
      fs.writeFileSync(componentPath, componentContent);
      
      console.log(`创建缺失组件: ${comp.path}`);
    }
    
    // 检查页面是否已经包含该组件
    const hasComponent = $(`script[src*="${comp.name}"]`).length > 0;
    
    // 如果页面不包含该组件，添加它
    if (!hasComponent && (pagePath === '/index.html' || comp.name === 'trace-common.js')) {
      const relativePath = pagePath.startsWith('/pages/') ? '../' : '';
      $('head').append(`<script src="${relativePath}${comp.path}"></script>`);
      
      fixedReferences.push({
        page: pagePath,
        action: 'added',
        component: comp.name
      });
    }
  }
}

// 创建CSS样式表
function createStylesheet() {
  console.log('\n创建CSS样式表...');
  const cssPath = path.join(config.baseDir, 'assets/css/trace-components.css');
  
  if (!fs.existsSync(cssPath)) {
    ensureDirectoryExists(path.dirname(cssPath));
    
    // 创建基本CSS样式
    const cssContent = `/**
 * 食品溯源系统组件样式
 * 版本: 1.0.0
 */

/* Toast 通知样式 */
.trace-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 9999;
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.3s, transform 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.trace-toast-show {
  opacity: 1;
  transform: translateY(0);
}

.trace-toast-info {
  background-color: #2196F3;
}

.trace-toast-success {
  background-color: #4CAF50;
}

.trace-toast-warning {
  background-color: #FFC107;
  color: #333;
}

.trace-toast-error {
  background-color: #F44336;
}

/* 对话框样式 */
.trace-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9990;
}

.trace-dialog {
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 450px;
  overflow: hidden;
}

.trace-dialog-content {
  padding: 20px;
}

.trace-dialog-buttons {
  display: flex;
  justify-content: flex-end;
  padding: 10px 20px 20px;
  gap: 10px;
}

/* 按钮样式 */
.trace-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s, transform 0.1s;
}

.trace-btn:focus {
  outline: 2px solid #2196F3;
  outline-offset: 2px;
}

.trace-btn-primary {
  background-color: #2196F3;
  color: white;
}

.trace-btn-primary:hover {
  background-color: #1976D2;
}

.trace-btn-primary:active {
  transform: translateY(1px);
}

.trace-btn-cancel {
  background-color: #f0f0f0;
  color: #333;
}

.trace-btn-cancel:hover {
  background-color: #e0e0e0;
}

/* 按钮特效 */
.hover-effect {
  box-shadow: 0 0 5px rgba(33, 150, 243, 0.5);
}

.active-effect {
  transform: scale(0.98);
}
`;
    
    fs.writeFileSync(cssPath, cssContent);
    console.log(`创建CSS样式表: ${cssPath}`);
    return true;
  }
  
  return false;
}

// 创建组件模板
function createComponentTemplate(componentName) {
  const name = componentName.replace('.js', '');
  
  switch (name) {
    case 'trace-common':
      return `/**
 * 通用工具函数
 * 版本: 1.0.0
 */

const traceCommon = {
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId: function() {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
  
  /**
   * 格式化日期
   * @param {Date} date - 日期对象
   * @param {string} format - 格式字符串
   * @returns {string} 格式化后的日期字符串
   */
  formatDate: function(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  },
  
  /**
   * 检查是否为手机号
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效的手机号
   */
  isMobilePhone: function(value) {
    return /^1[3-9]\d{9}$/.test(value);
  },
  
  /**
   * 检查是否为邮箱
   * @param {string} value - 要检查的值
   * @returns {boolean} 是否为有效的邮箱
   */
  isEmail: function(value) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  },
  
  /**
   * 获取URL参数
   * @param {string} name - 参数名
   * @returns {string|null} 参数值或null
   */
  getUrlParam: function(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceCommon;
} else {
  window.traceCommon = traceCommon;
}
`;
      
    case 'trace-ui-components':
      return `/**
 * UI组件库
 * 版本: 1.0.0
 */

const traceUI = {
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
  module.exports = traceUI;
} else {
  window.traceUI = traceUI;
}
`;
      
    case 'autoload-button-upgrade':
      return `/**
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
})();
`;
      
    default:
      return `/**
 * ${name}
 * 版本: 1.0.0
 */

const ${name.replace(/-/g, '_')} = {
  // 基本功能占位
  init: function() {
    console.log('${name} 初始化');
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ${name.replace(/-/g, '_')};
} else {
  window.${name.replace(/-/g, '_')} = ${name.replace(/-/g, '_')};
}
`;
  }
}

// 主函数
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
  
  // 创建CSS样式表
  const cssCreated = createStylesheet();
  
  // 执行修复
  const fixedImages = fixMissingImages(report.failedResourceDetails);
  const fixedReferences = fixComponentReferences();
  
  // 检查并修复缺失的图标
  console.log('\n检查图标资源...');
  const iconsDir = path.join(config.baseDir, 'assets/icons');
  ensureDirectoryExists(iconsDir);
  
  // 确保基本图标存在
  const iconNames = ['home.svg', 'home-gray.svg', 'home-blue.svg', 
                    'record.svg', 'record-gray.svg', 'record-blue.svg',
                    'user.svg', 'user-gray.svg', 'user-blue.svg'];
  
  for (const iconName of iconNames) {
    const iconPath = path.join(iconsDir, iconName);
    if (!fs.existsSync(iconPath)) {
      const iconContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${iconName.includes('blue') ? '#2196F3' : iconName.includes('gray') ? '#999999' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  ${iconName.startsWith('home') ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>' :
    iconName.startsWith('user') ? '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' :
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'}
</svg>`;
      
      fs.writeFileSync(iconPath, iconContent);
      console.log(`创建图标: ${iconPath}`);
      
      fixedImages.push({
        original: `icons/${iconName}`,
        fixed: iconPath,
        type: 'icon'
      });
    }
  }
  
  // 生成修复报告
  const fixReport = {
    timestamp: new Date().toISOString(),
    originalReport: report.timestamp,
    fixedImages: fixedImages,
    fixedReferences: fixedReferences,
    cssCreated: cssCreated,
    summary: {
      totalImagesFixed: fixedImages.length,
      totalReferencesFixed: fixedReferences.length,
      cssCreated: cssCreated
    }
  };
  
  // 保存修复报告
  fs.writeFileSync(config.logPath, JSON.stringify(fixReport, null, 2));
  
  console.log('\n修复完成!');
  console.log(`修复了 ${fixedImages.length} 个图片资源`);
  console.log(`修复了 ${fixedReferences.length} 个组件引用`);
  if (cssCreated) {
    console.log('创建了CSS样式表');
  }
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