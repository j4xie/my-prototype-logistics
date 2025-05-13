/**
 * 食品溯源系统 - 资源路径修复脚本
 * 此脚本用于修复HTML文件中的资源路径引用问题
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const glob = require('glob');

// 根目录路径
const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'components');

// 修复计数器
const stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  totalFixes: 0,
  scriptFixes: 0,
  stylesheetFixes: 0,
  imageFixes: 0
};

/**
 * 修复HTML文件中的资源路径
 * @param {string} filePath HTML文件路径
 */
function fixResourcePaths(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(content);
    let modified = false;
    
    // 修复脚本路径
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      
      // 修复绝对路径引用 /components/ -> ../components/
      if (src.startsWith('/components/') || src.startsWith('/C:/components/')) {
        const newSrc = src.replace(/^\/(C:\/)?components\//, '../components/');
        $(el).attr('src', newSrc);
        stats.scriptFixes++;
        modified = true;
      }
      
      // 修复pages/components/路径
      if (src.includes('/pages/components/')) {
        const newSrc = src.replace(/\/pages\/components\//, '/components/');
        $(el).attr('src', newSrc);
        stats.scriptFixes++;
        modified = true;
      }
    });
    
    // 修复样式表路径
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      
      // 修复绝对路径引用
      if (href.startsWith('/assets/') || href.startsWith('/C:/assets/')) {
        const newHref = href.replace(/^\/(C:\/)?assets\//, '../assets/');
        $(el).attr('href', newHref);
        stats.stylesheetFixes++;
        modified = true;
      }
    });
    
    // 修复图片路径
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      
      // 替换placeholder图片为本地图片
      if (src.includes('via.placeholder.com')) {
        const newSrc = '../assets/images/logo.png';
        $(el).attr('src', newSrc);
        stats.imageFixes++;
        modified = true;
      }
      
      // 修复绝对路径引用
      if (src.startsWith('/assets/') || src.startsWith('/C:/assets/')) {
        const newSrc = src.replace(/^\/(C:\/)?assets\//, '../assets/');
        $(el).attr('src', newSrc);
        stats.imageFixes++;
        modified = true;
      }
    });
    
    // 如果有修改，保存文件
    if (modified) {
      fs.writeFileSync(filePath, $.html());
      stats.modifiedFiles++;
      stats.totalFixes += stats.scriptFixes + stats.stylesheetFixes + stats.imageFixes;
      console.log(`已修复文件: ${path.relative(ROOT_DIR, filePath)}`);
    }
    
    stats.totalFiles++;
  } catch (error) {
    console.error(`处理文件 ${filePath} 时出错:`, error);
  }
}

/**
 * 创建缺失的autoload-button-upgrade.js文件
 */
function createMissingFiles() {
  const autoloadPath = path.join(COMPONENTS_DIR, 'autoload-button-upgrade.js');
  
  // 如果autoload-button-upgrade.js不存在，创建它
  if (!fs.existsSync(autoloadPath)) {
    const autoloadContent = `/**
 * 按钮自动升级脚本
 * 此脚本用于自动升级页面上的按钮，添加可访问性和视觉反馈
 */

document.addEventListener('DOMContentLoaded', function() {
  // 查找所有按钮元素
  const buttons = document.querySelectorAll('button, .btn, [role="button"]');
  
  buttons.forEach((button, index) => {
    // 添加ID如果没有
    if (!button.id) {
      const pageName = window.location.pathname.split('/').pop().replace('.html', '');
      button.id = \`btn-\${pageName}-\${index}\`;
    }
    
    // 添加aria属性
    if (!button.getAttribute('aria-label') && button.textContent.trim()) {
      button.setAttribute('aria-label', button.textContent.trim());
    }
    
    // 添加视觉反馈类
    if (!button.classList.contains('btn-feedback')) {
      button.classList.add('btn-feedback');
    }
    
    // 添加点击事件监听器
    button.addEventListener('click', function(event) {
      // 添加点击动画
      this.classList.add('btn-clicked');
      setTimeout(() => {
        this.classList.remove('btn-clicked');
      }, 200);
    });
  });
  
  console.log('按钮自动升级完成 ✓');
});
`;
    fs.writeFileSync(autoloadPath, autoloadContent);
    console.log(`已创建缺失文件: components/autoload-button-upgrade.js`);
  }
  
  // 创建一个基本的按钮样式CSS文件
  const cssPath = path.join(ROOT_DIR, 'assets', 'css');
  if (!fs.existsSync(cssPath)) {
    fs.mkdirSync(cssPath, { recursive: true });
  }
  
  const componentsCssPath = path.join(cssPath, 'trace-components.css');
  if (!fs.existsSync(componentsCssPath)) {
    const cssContent = `/**
 * 食品溯源系统 - 组件样式
 */

/* 按钮反馈样式 */
.btn-feedback {
  transition: all 0.2s ease;
}

.btn-feedback:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-feedback:active,
.btn-clicked {
  transform: translateY(1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 图标按钮 */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 0.375rem;
}
`;
    fs.writeFileSync(componentsCssPath, cssContent);
    console.log(`已创建缺失文件: assets/css/trace-components.css`);
  }
}

/**
 * 修复所有HTML文件
 */
function fixAllHtmlFiles() {
  // 确保组件目录存在
  if (!fs.existsSync(COMPONENTS_DIR)) {
    fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  }
  
  // 创建缺失的文件
  createMissingFiles();
  
  // 查找所有HTML文件
  const htmlFiles = glob.sync('**/*.html', {
    cwd: ROOT_DIR,
    ignore: ['node_modules/**', 'validation/reports/**']
  });
  
  // 处理每个HTML文件
  htmlFiles.forEach(file => {
    const filePath = path.join(ROOT_DIR, file);
    fixResourcePaths(filePath);
  });
  
  // 打印结果
  console.log('\n资源路径修复完成:');
  console.log(`总文件数: ${stats.totalFiles}`);
  console.log(`修改的文件数: ${stats.modifiedFiles}`);
  console.log(`总修复数: ${stats.totalFixes}`);
  console.log(`- 脚本路径修复: ${stats.scriptFixes}`);
  console.log(`- 样式表路径修复: ${stats.stylesheetFixes}`);
  console.log(`- 图片路径修复: ${stats.imageFixes}`);
}

// 运行修复
fixAllHtmlFiles(); 