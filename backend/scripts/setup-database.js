#!/usr/bin/env node

/**
 * 数据库设置脚本
 * 自动化MySQL数据库的创建和初始化
 */

import mysql from 'mysql2/promise';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库配置
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '1585785322@Qq', // 需要根据实际情况修改
  database: 'heiniu_db',
  port: 3306
};

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

/**
 * 检查MySQL服务是否运行
 */
async function checkMySQLService() {
  logStep(1, '检查MySQL服务状态');
  
  try {
    const connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      port: DB_CONFIG.port
    });
    
    await connection.ping();
    await connection.end();
    
    logSuccess('MySQL服务正在运行');
    return true;
  } catch (error) {
    logError(`MySQL服务连接失败: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      logWarning('MySQL服务未启动，请先启动MySQL服务');
      log('Windows: net start mysql', 'yellow');
      log('macOS: brew services start mysql', 'yellow');
      log('Linux: sudo systemctl start mysql', 'yellow');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      logWarning('MySQL认证失败，请检查用户名和密码');
      log('默认用户名: root', 'yellow');
      log('如果是全新安装，密码可能为空', 'yellow');
    }
    
    return false;
  }
}

/**
 * 创建数据库
 */
async function createDatabase() {
  logStep(2, '创建数据库');
  
  try {
    const connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      port: DB_CONFIG.port
    });
    
    // 检查数据库是否存在
    const [rows] = await connection.execute(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [DB_CONFIG.database]
    );
    
    if (rows.length > 0) {
      logWarning(`数据库 ${DB_CONFIG.database} 已存在`);
    } else {
      await connection.execute(`CREATE DATABASE ${DB_CONFIG.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      logSuccess(`数据库 ${DB_CONFIG.database} 创建成功`);
    }
    
    await connection.end();
    return true;
  } catch (error) {
    logError(`创建数据库失败: ${error.message}`);
    return false;
  }
}

/**
 * 运行Prisma迁移
 */
async function runPrismaMigration() {
  logStep(3, '运行Prisma数据库迁移');
  
  return new Promise((resolve, reject) => {
    const prisma = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'init'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    prisma.on('close', (code) => {
      if (code === 0) {
        logSuccess('Prisma迁移完成');
        resolve(true);
      } else {
        logError(`Prisma迁移失败，退出码: ${code}`);
        reject(false);
      }
    });
    
    prisma.on('error', (error) => {
      logError(`Prisma迁移错误: ${error.message}`);
      reject(false);
    });
  });
}

/**
 * 生成Prisma客户端
 */
async function generatePrismaClient() {
  logStep(4, '生成Prisma客户端');
  
  return new Promise((resolve, reject) => {
    const prisma = spawn('npx', ['prisma', 'generate'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    prisma.on('close', (code) => {
      if (code === 0) {
        logSuccess('Prisma客户端生成完成');
        resolve(true);
      } else {
        logError(`Prisma客户端生成失败，退出码: ${code}`);
        reject(false);
      }
    });
    
    prisma.on('error', (error) => {
      logError(`Prisma客户端生成错误: ${error.message}`);
      reject(false);
    });
  });
}

/**
 * 种子数据填充
 */
async function seedDatabase() {
  logStep(5, '填充种子数据');
  
  return new Promise((resolve, reject) => {
    const seed = spawn('node', ['scripts/seed-database.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    seed.on('close', (code) => {
      if (code === 0) {
        logSuccess('种子数据填充完成');
        resolve(true);
      } else {
        logError(`种子数据填充失败，退出码: ${code}`);
        reject(false);
      }
    });
    
    seed.on('error', (error) => {
      logError(`种子数据填充错误: ${error.message}`);
      reject(false);
    });
  });
}

/**
 * 初始化平台管理员
 */
async function initPlatformAdmin() {
  logStep(6, '初始化平台管理员');
  
  return new Promise((resolve, reject) => {
    const init = spawn('node', ['scripts/init-platform-admin.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    init.on('close', (code) => {
      if (code === 0) {
        logSuccess('平台管理员初始化完成');
        resolve(true);
      } else {
        logError(`平台管理员初始化失败，退出码: ${code}`);
        reject(false);
      }
    });
    
    init.on('error', (error) => {
      logError(`平台管理员初始化错误: ${error.message}`);
      reject(false);
    });
  });
}

/**
 * 验证数据库设置
 */
async function verifyDatabaseSetup() {
  logStep(7, '验证数据库设置');
  
  try {
    const connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
      port: DB_CONFIG.port
    });
    
    // 检查表是否存在
    const [tables] = await connection.execute('SHOW TABLES');
    log(`发现 ${tables.length} 个数据表:`, 'blue');
    tables.forEach(table => {
      log(`  - ${Object.values(table)[0]}`, 'blue');
    });
    
    // 检查平台管理员
    const [admins] = await connection.execute('SELECT COUNT(*) as count FROM platform_admins');
    log(`平台管理员数量: ${admins[0].count}`, 'blue');
    
    // 检查工厂数量
    const [factories] = await connection.execute('SELECT COUNT(*) as count FROM factories');
    log(`工厂数量: ${factories[0].count}`, 'blue');
    
    await connection.end();
    
    logSuccess('数据库设置验证完成');
    return true;
  } catch (error) {
    logError(`数据库验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  log('🚀 开始数据库设置流程', 'magenta');
  log('='.repeat(50), 'magenta');
  
  try {
    // 检查.env文件
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      logError('.env文件不存在，请创建.env文件');
      process.exit(1);
    }
    
    // 步骤1: 检查MySQL服务
    const mysqlRunning = await checkMySQLService();
    if (!mysqlRunning) {
      logError('请先启动MySQL服务后再运行此脚本');
      process.exit(1);
    }
    
    // 步骤2: 创建数据库
    const dbCreated = await createDatabase();
    if (!dbCreated) {
      process.exit(1);
    }
    
    // 步骤3: 运行Prisma迁移
    await runPrismaMigration();
    
    // 步骤4: 生成Prisma客户端
    await generatePrismaClient();
    
    // 步骤5: 填充种子数据
    await seedDatabase();
    
    // 步骤6: 初始化平台管理员
    await initPlatformAdmin();
    
    // 步骤7: 验证设置
    await verifyDatabaseSetup();
    
    log('='.repeat(50), 'green');
    logSuccess('数据库设置完成！');
    log('='.repeat(50), 'green');
    
    log('下一步:', 'cyan');
    log('1. 启动后端服务: npm run dev', 'white');
    log('2. 启动前端服务: cd ../frontend/web-app-next && npm run dev', 'white');
    log('3. 访问 http://localhost:3000 开始测试', 'white');
    
  } catch (error) {
    logError(`数据库设置失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
main().catch(console.error);