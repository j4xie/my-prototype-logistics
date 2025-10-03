/**
 * 测试环境启动脚本
 * 自动启动后端和前端服务，确保测试环境就绪
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';
import testConfig from './test-config.js';

const execAsync = promisify(exec);

class TestEnvironmentManager {
  constructor() {
    this.processes = [];
    this.isRunning = false;
    this.logs = [];
  }

  // 检查端口是否被占用
  async checkPort(port) {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  // 等待服务就绪
  async waitForService(url, name, maxRetries = 30) {
    const spinner = ora(`等待 ${name} 服务启动...`).start();
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          spinner.succeed(chalk.green(`✓ ${name} 服务已就绪`));
          return true;
        }
      } catch (error) {
        // 继续等待
      }
      await this.sleep(2000);
    }
    
    spinner.fail(chalk.red(`✗ ${name} 服务启动超时`));
    return false;
  }

  // 延迟函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 启动MySQL服务
  async startMySQL() {
    console.log(chalk.blue('🔧 检查MySQL服务状态...'));
    
    try {
      const { stdout } = await execAsync('sc query MySQL80');
      if (!stdout.includes('RUNNING')) {
        console.log(chalk.yellow('⚡ 启动MySQL服务...'));
        await execAsync('net start MySQL80');
        await this.sleep(3000);
      }
      console.log(chalk.green('✓ MySQL服务运行中'));
      return true;
    } catch (error) {
      console.error(chalk.red('✗ MySQL服务启动失败:'), error.message);
      return false;
    }
  }

  // 启动后端服务
  async startBackend() {
    console.log(chalk.blue('🚀 启动后端API服务...'));
    
    // 检查端口
    if (await this.checkPort(testConfig.services.backend.port)) {
      console.log(chalk.yellow(`⚠️  端口 ${testConfig.services.backend.port} 已被占用，尝试终止现有进程...`));
      try {
        await execAsync(`npx kill-port ${testConfig.services.backend.port}`);
        await this.sleep(2000);
      } catch (error) {
        console.error(chalk.red('无法终止端口占用进程'));
      }
    }

    return new Promise((resolve, reject) => {
      const backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: './backend',
        shell: true,
        env: { ...process.env, NODE_ENV: 'test' }
      });

      backendProcess.stdout.on('data', (data) => {
        const message = data.toString();
        this.logs.push({ service: 'backend', message, timestamp: new Date() });
        
        if (message.includes('Server running on port')) {
          console.log(chalk.green('✓ 后端服务已启动'));
          resolve(true);
        }
      });

      backendProcess.stderr.on('data', (data) => {
        console.error(chalk.red('后端错误:'), data.toString());
      });

      backendProcess.on('error', (error) => {
        console.error(chalk.red('后端进程错误:'), error);
        reject(error);
      });

      this.processes.push(backendProcess);

      // 设置超时
      setTimeout(() => {
        if (!this.isRunning) {
          reject(new Error('后端服务启动超时'));
        }
      }, testConfig.services.backend.startupTimeout);
    });
  }

  // 启动前端服务
  async startFrontend() {
    console.log(chalk.blue('📱 启动React Native开发服务...'));
    
    // 检查端口
    if (await this.checkPort(testConfig.services.frontend.port)) {
      console.log(chalk.yellow(`⚠️  端口 ${testConfig.services.frontend.port} 已被占用，尝试终止现有进程...`));
      try {
        await execAsync(`npx kill-port ${testConfig.services.frontend.port}`);
        await this.sleep(2000);
      } catch (error) {
        console.error(chalk.red('无法终止端口占用进程'));
      }
    }

    return new Promise((resolve, reject) => {
      const frontendProcess = spawn('npx', ['expo', 'start', '--port', testConfig.services.frontend.port], {
        cwd: './frontend/CretasFoodTrace',
        shell: true,
        env: { ...process.env, NODE_ENV: 'test' }
      });

      frontendProcess.stdout.on('data', (data) => {
        const message = data.toString();
        this.logs.push({ service: 'frontend', message, timestamp: new Date() });
        
        if (message.includes('Metro waiting on') || message.includes('Expo DevTools')) {
          console.log(chalk.green('✓ React Native服务已启动'));
          resolve(true);
        }
      });

      frontendProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // Expo有时会在stderr输出正常信息
        if (!message.includes('warning')) {
          console.error(chalk.red('前端错误:'), message);
        }
      });

      frontendProcess.on('error', (error) => {
        console.error(chalk.red('前端进程错误:'), error);
        reject(error);
      });

      this.processes.push(frontendProcess);

      // 设置超时
      setTimeout(() => {
        resolve(true); // Expo启动可能较慢，默认成功
      }, 30000);
    });
  }

  // 健康检查
  async performHealthChecks() {
    console.log(chalk.blue('\n🏥 执行健康检查...'));
    
    const checks = [
      {
        name: '后端API',
        url: `${testConfig.services.backend.url}${testConfig.services.backend.healthCheckEndpoint}`,
        critical: true
      },
      {
        name: '前端服务',
        url: testConfig.services.frontend.url,
        critical: false
      }
    ];

    let allHealthy = true;

    for (const check of checks) {
      const spinner = ora(`检查 ${check.name}...`).start();
      
      try {
        const response = await fetch(check.url, { timeout: 5000 });
        if (response.ok) {
          spinner.succeed(chalk.green(`✓ ${check.name} 正常`));
        } else {
          spinner.fail(chalk.red(`✗ ${check.name} 异常 (状态码: ${response.status})`));
          if (check.critical) allHealthy = false;
        }
      } catch (error) {
        spinner.fail(chalk.red(`✗ ${check.name} 无法访问`));
        if (check.critical) allHealthy = false;
      }
    }

    return allHealthy;
  }

  // 启动所有服务
  async startAll() {
    console.log(chalk.cyan.bold('\n🚀 白垩纪食品溯源系统 - 集成测试环境启动\n'));
    console.log(chalk.gray('═'.repeat(50)));

    try {
      // 1. 启动MySQL
      const mysqlStarted = await this.startMySQL();
      if (!mysqlStarted) {
        throw new Error('MySQL服务启动失败');
      }

      // 2. 启动后端
      await this.startBackend();
      await this.sleep(5000); // 等待后端完全启动

      // 3. 启动前端
      await this.startFrontend();
      await this.sleep(5000); // 等待前端完全启动

      // 4. 健康检查
      const isHealthy = await this.performHealthChecks();
      
      if (isHealthy) {
        this.isRunning = true;
        console.log(chalk.gray('═'.repeat(50)));
        console.log(chalk.green.bold('\n✅ 测试环境启动成功！\n'));
        console.log(chalk.cyan('📍 服务地址：'));
        console.log(chalk.white(`   后端API: ${testConfig.services.backend.url}`));
        console.log(chalk.white(`   前端服务: ${testConfig.services.frontend.url}`));
        console.log(chalk.gray('\n按 Ctrl+C 停止所有服务\n'));
        return true;
      } else {
        throw new Error('健康检查失败');
      }
    } catch (error) {
      console.error(chalk.red.bold('\n❌ 测试环境启动失败:'), error.message);
      await this.stopAll();
      return false;
    }
  }

  // 停止所有服务
  async stopAll() {
    console.log(chalk.yellow('\n🛑 停止所有服务...'));
    
    for (const process of this.processes) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        console.error(chalk.red('停止进程失败:'), error);
      }
    }

    // 清理端口
    try {
      await execAsync(`npx kill-port ${testConfig.services.backend.port}`);
      await execAsync(`npx kill-port ${testConfig.services.frontend.port}`);
    } catch (error) {
      // 忽略错误
    }

    this.processes = [];
    this.isRunning = false;
    console.log(chalk.green('✓ 所有服务已停止'));
  }

  // 保存日志
  async saveLogs() {
    const logFile = `./integration-tests/reports/environment-logs-${Date.now()}.json`;
    const fs = await import('fs').then(m => m.promises);
    
    try {
      await fs.writeFile(logFile, JSON.stringify(this.logs, null, 2));
      console.log(chalk.gray(`日志已保存到: ${logFile}`));
    } catch (error) {
      console.error(chalk.red('保存日志失败:'), error);
    }
  }
}

// 主函数
async function main() {
  const manager = new TestEnvironmentManager();
  
  // 处理退出信号
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n接收到中断信号...'));
    await manager.stopAll();
    await manager.saveLogs();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await manager.stopAll();
    await manager.saveLogs();
    process.exit(0);
  });

  // 启动环境
  const success = await manager.startAll();
  
  if (success) {
    // 保持进程运行
    process.stdin.resume();
  } else {
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('致命错误:'), error);
    process.exit(1);
  });
}

export default TestEnvironmentManager;