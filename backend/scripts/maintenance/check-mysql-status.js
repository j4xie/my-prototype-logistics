#!/usr/bin/env node

/**
 * MySQL状态检查脚本
 * 检查MySQL安装状态并提供安装指导
 */

import { spawn } from 'child_process';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

/**
 * 检查MySQL命令是否可用
 */
async function checkMySQLCommand() {
  log('1. 检查MySQL命令可用性', 'cyan');
  
  return new Promise((resolve) => {
    const mysql = spawn('mysql', ['--version'], { stdio: 'pipe' });
    
    mysql.on('close', (code) => {
      if (code === 0) {
        logSuccess('MySQL命令可用');
        resolve(true);
      } else {
        logError('MySQL命令不可用');
        resolve(false);
      }
    });
    
    mysql.on('error', (error) => {
      logError(`MySQL命令不可用: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * 检查MySQL服务状态
 */
async function checkMySQLService() {
  log('2. 检查MySQL服务状态', 'cyan');
  
  return new Promise((resolve) => {
    const systemctl = spawn('systemctl', ['status', 'mysql'], { stdio: 'pipe' });
    
    systemctl.on('close', (code) => {
      if (code === 0) {
        logSuccess('MySQL服务正在运行');
        resolve(true);
      } else {
        logError('MySQL服务未运行');
        resolve(false);
      }
    });
    
    systemctl.on('error', (error) => {
      logError(`无法检查MySQL服务状态: ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * 检查MySQL连接
 */
async function checkMySQLConnection() {
  log('3. 检查MySQL连接', 'cyan');
  
  const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    port: 3306
  };
  
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    await connection.ping();
    await connection.end();
    
    logSuccess('MySQL连接成功');
    return true;
  } catch (error) {
    logError(`MySQL连接失败: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      logWarning('MySQL服务未启动');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      logWarning('MySQL认证失败，请检查用户名和密码');
    }
    
    return false;
  }
}

/**
 * 检查数据库是否存在
 */
async function checkDatabase() {
  log('4. 检查数据库', 'cyan');
  
  const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    port: 3306
  };
  
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    
    const [rows] = await connection.execute(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      ['cretas_db']
    );
    
    await connection.end();
    
    if (rows.length > 0) {
      logSuccess('数据库 cretas_db 存在');
      return true;
    } else {
      logWarning('数据库 cretas_db 不存在');
      return false;
    }
  } catch (error) {
    logError(`检查数据库失败: ${error.message}`);
    return false;
  }
}

/**
 * 检查.env配置
 */
function checkEnvConfig() {
  log('5. 检查.env配置', 'cyan');
  
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    logError('.env文件不存在');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('DATABASE_URL')) {
    logSuccess('.env文件包含DATABASE_URL配置');
    return true;
  } else {
    logError('.env文件缺少DATABASE_URL配置');
    return false;
  }
}

/**
 * 提供安装指导
 */
function provideInstallationGuide() {
  log('\\n=== MySQL 安装指导 ===', 'magenta');
  
  log('\\n由于MySQL未安装，请按照以下步骤进行：', 'yellow');
  
  log('\\n1. 更新包索引：', 'cyan');
  log('   sudo apt update', 'white');
  
  log('\\n2. 安装MySQL服务器：', 'cyan');
  log('   sudo apt install mysql-server', 'white');
  
  log('\\n3. 启动MySQL服务：', 'cyan');
  log('   sudo systemctl start mysql', 'white');
  log('   sudo systemctl enable mysql', 'white');
  
  log('\\n4. 配置MySQL安全设置：', 'cyan');
  log('   sudo mysql_secure_installation', 'white');
  log('   • 设置root密码为: password', 'yellow');
  log('   • 其他选项选择: Yes', 'yellow');
  
  log('\\n5. 验证安装：', 'cyan');
  log('   mysql --version', 'white');
  log('   systemctl status mysql', 'white');
  
  log('\\n6. 重新运行此脚本验证：', 'cyan');
  log('   node scripts/check-mysql-status.js', 'white');
  
  log('\\n7. 如果MySQL安装成功，运行数据库设置：', 'cyan');
  log('   node scripts/setup-database.js', 'white');
  
  log('\\n详细指导请参考：MYSQL_INSTALLATION_STEPS.md', 'blue');
}

/**
 * 提供下一步操作建议
 */
function provideNextSteps(mysqlReady, dbExists) {
  log('\\n=== 下一步操作 ===', 'magenta');
  
  if (mysqlReady && dbExists) {
    logSuccess('MySQL已就绪，可以开始后端开发');
    log('\\n建议执行：', 'cyan');
    log('1. 启动后端服务: npm run dev', 'white');
    log('2. 测试API端点: npm run test-api', 'white');
  } else if (mysqlReady && !dbExists) {
    logWarning('MySQL已安装但数据库未创建');
    log('\\n建议执行：', 'cyan');
    log('1. 运行数据库设置脚本: node scripts/setup-database.js', 'white');
    log('2. 启动后端服务: npm run dev', 'white');
  } else {
    logError('MySQL未就绪，请先完成MySQL安装');
    log('\\n请参考上面的安装指导完成MySQL安装', 'yellow');
  }
}

/**
 * 主函数
 */
async function main() {
  log('🔍 MySQL状态检查开始', 'magenta');
  log('='.repeat(50), 'magenta');
  
  try {
    // 检查各项状态
    const commandAvailable = await checkMySQLCommand();
    const serviceRunning = await checkMySQLService();
    const connectionWorking = await checkMySQLConnection();
    const envConfigured = checkEnvConfig();
    
    let dbExists = false;
    if (connectionWorking) {
      dbExists = await checkDatabase();
    }
    
    // 汇总检查结果
    log('\\n=== 检查结果汇总 ===', 'magenta');
    log(`MySQL命令可用: ${commandAvailable ? '✅' : '❌'}`, commandAvailable ? 'green' : 'red');
    log(`MySQL服务运行: ${serviceRunning ? '✅' : '❌'}`, serviceRunning ? 'green' : 'red');
    log(`MySQL连接正常: ${connectionWorking ? '✅' : '❌'}`, connectionWorking ? 'green' : 'red');
    log(`数据库存在: ${dbExists ? '✅' : '❌'}`, dbExists ? 'green' : 'red');
    log(`环境配置完整: ${envConfigured ? '✅' : '❌'}`, envConfigured ? 'green' : 'red');
    
    const mysqlReady = commandAvailable && serviceRunning && connectionWorking;
    
    if (!mysqlReady) {
      provideInstallationGuide();
    } else {
      provideNextSteps(mysqlReady, dbExists);
    }
    
    log('\\n=== 状态检查完成 ===', 'magenta');
    
  } catch (error) {
    logError(`状态检查失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
main().catch(console.error);