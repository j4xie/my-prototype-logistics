// 自动启动设置脚本
// 该脚本创建一个Windows计划任务，使MCP服务在系统启动时自动运行

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 获取当前脚本目录的绝对路径
const currentDir = __dirname;
const startupScriptPath = path.join(currentDir, 'start-mcp-services.bat');
const taskName = 'MCPServicesAutoStart';

// 确保启动脚本存在
if (!fs.existsSync(startupScriptPath)) {
  console.error(`启动脚本不存在: ${startupScriptPath}`);
  process.exit(1);
}

try {
  // 检查任务是否已存在
  try {
    const checkResult = execSync(`schtasks /query /tn "${taskName}"`, { stdio: 'pipe' }).toString();
    console.log(`任务 "${taskName}" 已存在，正在删除...`);
    execSync(`schtasks /delete /tn "${taskName}" /f`);
  } catch (error) {
    // 任务不存在，继续创建
    console.log(`任务 "${taskName}" 不存在，将创建新任务。`);
  }

  // 创建计划任务
  const command = `schtasks /create /tn "${taskName}" /tr "${startupScriptPath}" /sc onlogon /ru "%USERNAME%" /rl highest`;
  
  console.log('正在创建自动启动任务...');
  console.log(`执行命令: ${command}`);
  
  execSync(command);
  
  console.log('✅ 自动启动任务创建成功！');
  console.log(`MCP服务将在用户登录时自动启动。`);
  console.log(`任务名称: ${taskName}`);
  console.log(`启动脚本: ${startupScriptPath}`);
  
} catch (error) {
  console.error('❌ 创建自动启动任务失败:');
  console.error(error.message);
  console.error('\n可能需要以管理员权限运行此脚本。');
  process.exit(1);
} 