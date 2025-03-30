// MCP服务启动脚本
// 该脚本可以一键启动所有必要的MCP服务

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 日志目录
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 创建日志文件流
const createLogStream = (serviceName) => {
  const logFile = path.join(logsDir, `${serviceName}.log`);
  return fs.createWriteStream(logFile, { flags: 'a' });
};

// 启动服务函数
const startService = (command, args, serviceName, env = {}) => {
  console.log(`启动 ${serviceName} 服务...`);
  
  const logStream = createLogStream(serviceName);
  const timestamp = new Date().toISOString();
  logStream.write(`\n[${timestamp}] 启动 ${serviceName} 服务\n`);
  
  // 合并环境变量
  const processEnv = { ...process.env, ...env };
  
  const process = spawn(command, args, { 
    shell: true,
    env: processEnv
  });
  
  process.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${serviceName}] ${output}`);
    logStream.write(`[STDOUT] ${output}`);
  });
  
  process.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`[${serviceName} ERROR] ${output}`);
    logStream.write(`[STDERR] ${output}`);
  });
  
  process.on('close', (code) => {
    const closeMessage = `[${serviceName}] 进程退出，退出码 ${code}`;
    console.log(closeMessage);
    logStream.write(`${closeMessage}\n`);
    
    // 如果异常退出，尝试重启
    if (code !== 0) {
      console.log(`[${serviceName}] 服务异常退出，正在尝试重启...`);
      logStream.write(`服务异常退出，正在尝试重启...\n`);
      
      // 5秒后重启
      setTimeout(() => {
        startService(command, args, serviceName, env);
      }, 5000);
    }
  });
  
  return process;
};

// 获取API密钥
const NEON_API_KEY = process.env.NEON_API_KEY || 'napi_88x8jzryt6fewwb8ts6owfi2ov23xptlb1798ynl3mlfymv17lzifduyr1t3ly88';
const MAGIC_API_KEY = process.env.MAGIC_API_KEY || '72b532ab1fcdcfcb7f4556d0743434f10fb61dd929c12795d25565aca347ad3a';

// 启动所有服务
console.log('正在启动所有MCP服务...');

// 1. Browser Tools MCP
const browserToolsProcess = startService(
  'npx',
  ['-y', '@agentdeskai/browser-tools-mcp@1.2.0'],
  'browser-tools'
);

// 2. Magic MCP - 在Windows中需要特殊处理，使用环境变量方式
const magicMcpProcess = startService(
  'cmd',
  ['/c', 'npx', '-y', '@smithery/cli@latest', 'run', '@21st-dev/magic-mcp'],
  'magic-mcp',
  { TWENTY_FIRST_API_KEY: MAGIC_API_KEY }
);

// 3. Neon MCP
const neonMcpProcess = startService(
  'npx',
  ['-y', '@neondatabase/mcp-server-neon', 'start', NEON_API_KEY],
  'neon-mcp'
);

// 进程退出处理
process.on('SIGINT', () => {
  console.log('接收到退出信号，正在关闭所有MCP服务...');
  
  browserToolsProcess.kill();
  magicMcpProcess.kill();
  neonMcpProcess.kill();
  
  process.exit(0);
});

console.log('所有MCP服务已启动！');
console.log('按 Ctrl+C 退出所有服务'); 