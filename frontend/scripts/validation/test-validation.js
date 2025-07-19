console.log('=== 测试验证脚本启动 ===');

const fs = require('fs');
const path = require('path');

console.log('当前工作目录:', process.cwd());

// 检查src/app目录
const srcPath = path.join(process.cwd(), 'src/app');
console.log('检查目录:', srcPath);

if (fs.existsSync(srcPath)) {
  console.log('✅ src/app 目录存在');

  // 简单计数page.tsx文件
  let pageCount = 0;

  function countPages(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          countPages(fullPath);
        } else if (entry.name === 'page.tsx') {
          pageCount++;
          console.log(`发现页面: ${fullPath.replace(srcPath, '')}`);
        }
      }
    } catch (error) {
      console.error('扫描出错:', error.message);
    }
  }

  countPages(srcPath);

  console.log(`\n📊 总计发现 ${pageCount} 个页面文件`);

  if (pageCount === 100) {
    console.log('✅ 页面数量正确 (100个)');
  } else {
    console.log(`⚠️ 页面数量异常: 期望100个，实际${pageCount}个`);
  }

} else {
  console.log('❌ src/app 目录不存在');
}

console.log('=== 测试验证脚本结束 ===');
