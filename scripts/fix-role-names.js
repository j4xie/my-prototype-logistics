#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = path.join(__dirname, '..', 'backend');

// 需要修改的文件列表
const filesToFix = [
  'scripts/check-accounts.js',
  'scripts/seed-database.js',
  'scripts/seed-initial-data.js',
  'scripts/unified-seed.js',
  'src/controllers/authController.js',
  'src/controllers/platformController.js',
  'src/controllers/userController.js',
  'src/middleware/validation.js',
  'src/middleware/auth.js'
];

console.log('🔧 修复角色名称不匹配问题...\n');

let totalFixed = 0;

filesToFix.forEach(file => {
  const filePath = path.join(backendDir, file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // 替换所有的 'super_admin' 为 'factory_super_admin'
    // 但要排除 'platform_super_admin' 的情况
    content = content.replace(/(?<!platform_)'super_admin'/g, "'factory_super_admin'");
    content = content.replace(/(?<!platform_)"super_admin"/g, '"factory_super_admin"');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 已修复: ${file}`);
      totalFixed++;
    } else {
      console.log(`⏭️  跳过: ${file} (无需修改)`);
    }
  } catch (error) {
    console.error(`❌ 错误: ${file} - ${error.message}`);
  }
});

console.log(`\n✨ 修复完成！共修改了 ${totalFixed} 个文件。`);
console.log('\n下一步：');
console.log('1. 重新生成 Prisma 客户端: npm run generate');
console.log('2. 重新运行数据库迁移: npm run migrate');
console.log('3. 重新启动服务: npm run dev');