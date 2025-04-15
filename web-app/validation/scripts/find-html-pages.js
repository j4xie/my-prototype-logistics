/**
 * HTML页面查找工具
 * 用于扫描并筛选需要进行按钮测试的页面
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  pagesDir: path.join(__dirname, '..', '..', 'pages'),
  excludePatterns: [
    // 排除目录索引页
    'index.html',
    // 排除测试页面
    'test-',
    // 排除演示页面
    'demo-'
  ]
};

/**
 * 判断页面是否需要包含在测试中
 * @param {string} filename - 文件名
 * @returns {boolean} 是否包含该页面
 */
function shouldIncludePage(filename) {
  return !config.excludePatterns.some(pattern => filename.includes(pattern));
}

/**
 * 递归查找所有HTML页面
 * @param {string} dir - 要搜索的目录
 * @param {Array<string>} result - 存储找到的页面路径
 * @param {string} basePath - 基础路径，用于构建相对URL
 * @returns {Array<string>} HTML页面路径数组
 */
function findAllHtmlPages(dir, result = [], basePath = '') {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // 递归遍历子目录
          const relativePath = basePath ? `${basePath}/${file}` : file;
          findAllHtmlPages(filePath, result, relativePath);
        } else if (file.endsWith('.html')) {
          // 过滤需要排除的页面
          if (shouldIncludePage(file)) {
            const relativePath = basePath ? `${basePath}/${file}` : file;
            result.push(`/pages/${relativePath}`);
          }
        }
      } catch (err) {
        console.error(`处理文件时出错 ${filePath}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`读取目录时出错 ${dir}: ${err.message}`);
  }
  
  return result;
}

// 执行扫描
try {
  console.log(`正在扫描目录: ${config.pagesDir}`);
  const pages = findAllHtmlPages(config.pagesDir);
  console.log(`找到 ${pages.length} 个HTML页面:`);
  
  // 按目录分组显示
  const groupedPages = pages.reduce((groups, page) => {
    const parts = page.split('/');
    const category = parts.length > 3 ? parts[2] : '根目录';
    
    if (!groups[category]) {
      groups[category] = [];
    }
    
    groups[category].push(page);
    return groups;
  }, {});
  
  // 输出分组结果
  Object.keys(groupedPages).sort().forEach(category => {
    console.log(`\n分类: ${category} (${groupedPages[category].length} 个页面)`);
    groupedPages[category].forEach(page => console.log(`  ${page}`));
  });
  
  // 将结果保存到文件
  const resultPath = path.join(__dirname, '..', 'temp', 'htmlPages.json');
  const resultDir = path.dirname(resultPath);
  
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  
  fs.writeFileSync(resultPath, JSON.stringify(pages, null, 2));
  console.log(`\n页面列表已保存到: ${resultPath}`);
} catch (error) {
  console.error('扫描HTML页面时出错:', error);
} 