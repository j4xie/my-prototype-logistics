#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 检查端口占用
async function checkPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -aon | findstr :${port}`);
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        pids.add(pid);
      }
    });
    
    return Array.from(pids);
  } catch (error) {
    return [];
  }
}

// 获取进程信息
async function getProcessInfo(pid) {
  try {
    const { stdout } = await execAsync(`wmic process where ProcessId=${pid} get Name,CommandLine /format:list`);
    const info = {};
    stdout.split('\n').forEach(line => {
      if (line.includes('=')) {
        const [key, value] = line.split('=');
        info[key.trim()] = value.trim();
      }
    });
    return info;
  } catch (error) {
    return null;
  }
}

// 杀死进程
async function killProcess(pid) {
  try {
    await execAsync(`taskkill //PID ${pid} //F`);
    return true;
  } catch (error) {
    console.error(`无法杀死进程 ${pid}: ${error.message}`);
    return false;
  }
}

// 主函数
async function main() {
  const command = process.argv[2];
  const port = process.argv[3];
  
  if (!command || !port) {
    console.log('用法:');
    console.log('  node port-manager.js check <端口号>   - 检查端口占用');
    console.log('  node port-manager.js kill <端口号>    - 杀死占用端口的进程');
    console.log('  node port-manager.js list             - 列出常用端口占用情况');
    return;
  }
  
  switch (command) {
    case 'check':
      const pids = await checkPort(port);
      if (pids.length === 0) {
        console.log(`端口 ${port} 未被占用`);
      } else {
        console.log(`端口 ${port} 被以下进程占用:`);
        for (const pid of pids) {
          const info = await getProcessInfo(pid);
          console.log(`  PID: ${pid}`);
          if (info) {
            console.log(`    进程名: ${info.Name || '未知'}`);
            console.log(`    命令行: ${info.CommandLine || '未知'}`);
          }
        }
      }
      break;
      
    case 'kill':
      const occupiedPids = await checkPort(port);
      if (occupiedPids.length === 0) {
        console.log(`端口 ${port} 未被占用`);
      } else {
        console.log(`正在杀死占用端口 ${port} 的进程...`);
        for (const pid of occupiedPids) {
          const success = await killProcess(pid);
          if (success) {
            console.log(`  成功杀死进程 ${pid}`);
          }
        }
      }
      break;
      
    case 'list':
      const commonPorts = [3000, 3001, 8080, 5000, 4000];
      console.log('常用端口占用情况:');
      for (const p of commonPorts) {
        const pids = await checkPort(p);
        if (pids.length > 0) {
          console.log(`  端口 ${p}: 被占用 (PID: ${pids.join(', ')})`);
        } else {
          console.log(`  端口 ${p}: 空闲`);
        }
      }
      break;
      
    default:
      console.log('未知命令:', command);
  }
}

main().catch(console.error);