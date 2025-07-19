#!/usr/bin/env node

/**
 * 系统启动检查脚本
 * 检查系统运行所需的各项配置和依赖
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * 检查文件是否存在
 */
function checkFileExists(filePath, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const exists = fs.existsSync(fullPath);
  
  console.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
  
  if (!exists) {
    console.log(`   文件不存在: ${fullPath}`);
  }
  
  return exists;
}

/**
 * 检查目录是否存在
 */
function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(PROJECT_ROOT, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  
  console.log(`${exists ? '✅' : '❌'} ${description}: ${dirPath}/`);
  
  if (!exists) {
    console.log(`   目录不存在: ${fullPath}`);
  }
  
  return exists;
}

/**
 * 检查环境变量配置
 */
function checkEnvironmentConfig() {
  console.log('\n📋 检查环境配置...');
  
  const envFile = checkFileExists('.env', '环境配置文件');
  const envExampleFile = checkFileExists('.env.example', '环境配置示例文件');
  
  if (envFile) {
    try {
      const envContent = fs.readFileSync(path.join(PROJECT_ROOT, '.env'), 'utf8');
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_EXPIRES_IN',
        'PORT',
        'NODE_ENV'
      ];
      
      console.log('\n   检查必需的环境变量:');
      
      for (const varName of requiredVars) {
        const hasVar = envContent.includes(`${varName}=`);
        console.log(`   ${hasVar ? '✅' : '❌'} ${varName}`);
        
        if (!hasVar) {
          console.log(`     缺少环境变量: ${varName}`);
        }
      }
    } catch (error) {
      console.log('❌ 读取 .env 文件失败:', error.message);
    }
  }
  
  return envFile && envExampleFile;
}

/**
 * 检查项目结构
 */
function checkProjectStructure() {
  console.log('\n🏗️  检查项目结构...');
  
  const directories = [
    { path: 'src', desc: '源代码目录' },
    { path: 'src/controllers', desc: '控制器目录' },
    { path: 'src/middleware', desc: '中间件目录' },
    { path: 'src/routes', desc: '路由目录' },
    { path: 'src/utils', desc: '工具类目录' },
    { path: 'scripts', desc: '脚本目录' },
    { path: 'prisma', desc: 'Prisma配置目录' }
  ];
  
  const files = [
    { path: 'src/index.js', desc: '主入口文件' },
    { path: 'package.json', desc: 'NPM配置文件' },
    { path: 'prisma/schema.prisma', desc: 'Prisma Schema文件' }
  ];
  
  let allGood = true;
  
  for (const dir of directories) {
    if (!checkDirectoryExists(dir.path, dir.desc)) {
      allGood = false;
    }
  }
  
  for (const file of files) {
    if (!checkFileExists(file.path, file.desc)) {
      allGood = false;
    }
  }
  
  return allGood;
}

/**
 * 检查核心模块文件
 */
function checkCoreModules() {
  console.log('\n🔧 检查核心模块...');
  
  const coreFiles = [
    // 控制器
    { path: 'src/controllers/authController.js', desc: '认证控制器' },
    { path: 'src/controllers/userController.js', desc: '用户管理控制器' },
    { path: 'src/controllers/whitelistController.js', desc: '白名单控制器' },
    { path: 'src/controllers/platformController.js', desc: '平台管理控制器' },
    
    // 中间件
    { path: 'src/middleware/auth.js', desc: '认证中间件' },
    { path: 'src/middleware/validation.js', desc: '验证中间件' },
    { path: 'src/middleware/errorHandler.js', desc: '错误处理中间件' },
    
    // 路由
    { path: 'src/routes/auth.js', desc: '认证路由' },
    { path: 'src/routes/users.js', desc: '用户管理路由' },
    { path: 'src/routes/whitelist.js', desc: '白名单路由' },
    { path: 'src/routes/platform.js', desc: '平台管理路由' },
    
    // 工具类
    { path: 'src/utils/jwt.js', desc: 'JWT工具类' },
    { path: 'src/utils/password.js', desc: '密码工具类' }
  ];
  
  let allGood = true;
  
  for (const file of coreFiles) {
    if (!checkFileExists(file.path, file.desc)) {
      allGood = false;
    }
  }
  
  return allGood;
}

/**
 * 检查脚本文件
 */
function checkScripts() {
  console.log('\n📜 检查脚本文件...');
  
  const scripts = [
    { path: 'scripts/init-platform-admin.js', desc: '平台管理员初始化脚本' },
    { path: 'scripts/seed-database.js', desc: '数据库种子数据脚本' },
    { path: 'scripts/test-api-endpoints.js', desc: 'API接口测试脚本' }
  ];
  
  let allGood = true;
  
  for (const script of scripts) {
    if (!checkFileExists(script.path, script.desc)) {
      allGood = false;
    }
  }
  
  return allGood;
}

/**
 * 检查package.json配置
 */
function checkPackageConfig() {
  console.log('\n📦 检查Package配置...');
  
  try {
    const packagePath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 检查必需的脚本
    const requiredScripts = ['dev', 'start', 'migrate', 'generate'];
    console.log('\n   检查NPM脚本:');
    
    for (const script of requiredScripts) {
      const hasScript = packageJson.scripts && packageJson.scripts[script];
      console.log(`   ${hasScript ? '✅' : '❌'} ${script}`);
    }
    
    // 检查必需的依赖
    const requiredDeps = [
      'express', 'cors', 'helmet', 'bcrypt', 'jsonwebtoken', 
      'zod', 'mysql2', 'prisma', '@prisma/client', 'dotenv'
    ];
    
    console.log('\n   检查必需依赖:');
    
    for (const dep of requiredDeps) {
      const hasDep = (packageJson.dependencies && packageJson.dependencies[dep]) ||
                     (packageJson.devDependencies && packageJson.devDependencies[dep]);
      console.log(`   ${hasDep ? '✅' : '❌'} ${dep}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ 读取package.json失败:', error.message);
    return false;
  }
}

/**
 * 生成启动建议
 */
function generateStartupInstructions(checks) {
  console.log('\n🚀 启动建议:');
  console.log('');
  
  if (!checks.projectStructure) {
    console.log('❌ 项目结构不完整，请检查缺失的文件和目录');
    return;
  }
  
  if (!checks.environment) {
    console.log('1️⃣  创建环境配置文件:');
    console.log('   cp .env.example .env');
    console.log('   然后编辑 .env 文件，配置数据库连接等信息');
    console.log('');
  }
  
  console.log('2️⃣  安装依赖:');
  console.log('   npm install');
  console.log('');
  
  console.log('3️⃣  初始化数据库:');
  console.log('   npm run generate  # 生成Prisma客户端');
  console.log('   npm run migrate   # 运行数据库迁移');
  console.log('');
  
  console.log('4️⃣  初始化基础数据:');
  console.log('   node scripts/init-platform-admin.js  # 创建平台管理员');
  console.log('   node scripts/seed-database.js        # 创建测试数据');
  console.log('');
  
  console.log('5️⃣  启动开发服务器:');
  console.log('   npm run dev');
  console.log('');
  
  console.log('6️⃣  测试API接口:');
  console.log('   node scripts/test-api-endpoints.js  # 运行完整性测试');
  console.log('');
  
  if (checks.allPassed) {
    console.log('🎉 所有检查通过！系统已准备就绪！');
  } else {
    console.log('⚠️  部分检查未通过，请根据上述错误信息进行修复');
  }
}

/**
 * 主检查函数
 */
function runStartupCheck() {
  console.log('🔍 黑牛食品溯源系统 - 启动检查');
  console.log('==================================');
  console.log(`📁 项目目录: ${PROJECT_ROOT}`);
  
  const checks = {
    environment: checkEnvironmentConfig(),
    projectStructure: checkProjectStructure(),
    coreModules: checkCoreModules(),
    scripts: checkScripts(),
    packageConfig: checkPackageConfig()
  };
  
  checks.allPassed = Object.values(checks).every(check => check);
  
  console.log('\n📊 检查结果总览:');
  console.log(`   环境配置: ${checks.environment ? '✅' : '❌'}`);
  console.log(`   项目结构: ${checks.projectStructure ? '✅' : '❌'}`);
  console.log(`   核心模块: ${checks.coreModules ? '✅' : '❌'}`);
  console.log(`   脚本文件: ${checks.scripts ? '✅' : '❌'}`);
  console.log(`   包配置: ${checks.packageConfig ? '✅' : '❌'}`);
  
  generateStartupInstructions(checks);
  
  return checks.allPassed;
}

// 运行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runStartupCheck();
  process.exit(success ? 0 : 1);
}