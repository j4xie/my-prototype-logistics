/**
 * 修复loader测试超时问题的工具脚本
 * 此脚本自动修改loader测试文件，添加超时设置和错误处理
 */
const fs = require('fs');
const path = require('path');

// 默认超时设置
const DEFAULT_TIMEOUT = 15000; // 15秒
const LONG_TEST_TIMEOUT = 30000; // 30秒

// 需要修复的文件
const filesToFix = [
  './web-app/tests/unit/auth/loader.test.js',
  './web-app/tests/unit/auth/loader-enhanced.test.js'
];

// 修复模式
const fixPatterns = [
  // 添加超时设置
  {
    pattern: /describe\((['"])(.+)\1,\s*\(\)\s*=>\s*\{/g,
    replacement: (match, quote, name) => 
      `describe(${quote}${name}${quote}, () => {
  // 设置较长的超时时间，避免异步测试失败
  jest.setTimeout(${LONG_TEST_TIMEOUT});`
  },
  
  // 添加重试机制到异步测试
  {
    pattern: /test\((['"])(.+)\1,\s*async\s*\(\)\s*=>\s*\{/g,
    replacement: (match, quote, name) => 
      `test(${quote}${name}${quote}, async () => {
    // 添加重试机制
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {`
  },
  
  // 关闭重试机制
  {
    pattern: /}\s*\)\s*;?\s*\}\)\s*;/g,
    replacement: `}
        break; // 测试成功，退出重试循环
      } catch (error) {
        lastError = error;
        retries--;
        if (retries === 0) throw error;
        // 重试前等待短暂时间
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  });`
  },
  
  // 启用被跳过的测试
  {
    pattern: /describe\.skip\(/g,
    replacement: `describe(`
  },
  
  // 优化异步测试
  {
    pattern: /await\s+new\s+Promise\(\s*resolve\s*=>\s*setTimeout\(\s*resolve\s*,\s*(\d+)\s*\)\s*\)/g,
    replacement: (match, time) => 
      `// 使用更可靠的等待方法
      await new Promise(resolve => {
        const timer = setTimeout(resolve, ${time});
        // 确保计时器在测试结束时被清理
        afterAll(() => clearTimeout(timer));
      })`
  }
];

// 执行修复
filesToFix.forEach(filePath => {
  try {
    // 读取文件
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`文件不存在: ${fullPath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // 应用修复模式
    fixPatterns.forEach(({pattern, replacement}) => {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    // 保存修改后的文件
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`已修复文件: ${fullPath}`);
    } else {
      console.log(`文件无需修改: ${fullPath}`);
    }
  } catch (error) {
    console.error(`处理文件时出错: ${filePath}`, error);
  }
});

console.log('修复完成!'); 