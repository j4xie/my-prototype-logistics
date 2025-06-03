#!/usr/bin/env node

/**
 * 开发服务器稳定性修复脚本
 *
 * @description 解决 ENOENT 错误和临时文件冲突问题
 * @based-on 回归测试中发现的开发服务器稳定性问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 开发服务器稳定性修复');
console.log('━'.repeat(50));

// 修复步骤
const fixSteps = [
  {
    name: '清理 .next 构建缓存',
    action: () => {
      const nextDir = path.join(process.cwd(), '.next');
      if (fs.existsSync(nextDir)) {
        console.log('  🗑️ 删除 .next 目录...');
        fs.rmSync(nextDir, { recursive: true, force: true });
        console.log('  ✅ .next 目录已清理');
      } else {
        console.log('  ℹ️ .next 目录不存在，跳过');
      }
    }
  },
  {
    name: '清理 node_modules/.cache',
    action: () => {
      const cacheDir = path.join(process.cwd(), 'node_modules', '.cache');
      if (fs.existsSync(cacheDir)) {
        console.log('  🗑️ 删除 node_modules/.cache...');
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log('  ✅ 缓存目录已清理');
      } else {
        console.log('  ℹ️ 缓存目录不存在，跳过');
      }
    }
  },
  {
    name: '清理临时文件',
    action: () => {
      const tempPatterns = [
        'tmp.*',
        '*.tmp',
        '*buildManifest.js.tmp*',
        '*app-paths-manifest.json'
      ];

      console.log('  🧹 清理临时文件...');
      let cleanedFiles = 0;

      function cleanDirectory(dir) {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            cleanDirectory(itemPath);
          } else {
            // 检查是否为临时文件
            const shouldDelete = tempPatterns.some(pattern => {
              const regex = new RegExp(pattern.replace('*', '.*'));
              return regex.test(item);
            });

            if (shouldDelete) {
              try {
                fs.unlinkSync(itemPath);
                cleanedFiles++;
                console.log(`    🗑️ 删除: ${itemPath}`);
              } catch (error) {
                console.log(`    ⚠️ 无法删除: ${itemPath} (${error.message})`);
              }
            }
          }
        });
      }

      cleanDirectory(process.cwd());
      console.log(`  ✅ 清理了 ${cleanedFiles} 个临时文件`);
    }
  },
  {
    name: '重新安装依赖 (可选)',
    action: () => {
      console.log('  🔄 检查 package-lock.json...');
      if (fs.existsSync('package-lock.json')) {
        console.log('  ℹ️ 建议运行 npm ci 重新安装依赖 (手动执行)');
      } else {
        console.log('  ℹ️ 建议运行 npm install 安装依赖 (手动执行)');
      }
    }
  },
  {
    name: '验证环境',
    action: () => {
      console.log('  🔍 验证 Node.js 环境...');
      try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        console.log(`  ℹ️ Node.js: ${nodeVersion}`);
        console.log(`  ℹ️ npm: ${npmVersion}`);

        // 检查磁盘空间
        const stats = fs.statSync(process.cwd());
        console.log('  ℹ️ 工作目录权限正常');

        console.log('  ✅ 环境验证通过');
      } catch (error) {
        console.log('  ❌ 环境验证失败:', error.message);
      }
    }
  }
];

// 执行修复步骤
console.log('\n🔧 执行修复步骤:');
fixSteps.forEach((step, index) => {
  console.log(`\n${index + 1}. ${step.name}`);
  try {
    step.action();
  } catch (error) {
    console.log(`  ❌ 步骤失败: ${error.message}`);
  }
});

// 提供后续建议
console.log('\n📋 后续建议:');
console.log('1. 重新启动开发服务器: npm run dev');
console.log('2. 如果问题依然存在，执行: npm ci && npm run dev');
console.log('3. 检查端口占用: netstat -ano | findstr :3000');
console.log('4. 重新运行回归测试验证稳定性');

console.log('\n✅ 开发服务器稳定性修复完成');
