import fs from 'fs';
import path from 'path';

const setupLocalEnvironment = () => {
  console.log('🔧 设置前端本地开发环境...');

  const envContent = `# 前端本地开发环境配置

# API配置 - 指向本地后端
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_REAL_API_BASE="http://localhost:3001"

# 应用配置
NEXT_PUBLIC_APP_ENV="development"
NODE_ENV="development"

# Mock配置
NEXT_PUBLIC_MOCK_ENABLED="false"
NEXT_PUBLIC_USE_REAL_AUTH_API="true"

# 调试配置
NEXT_PUBLIC_DEBUG="true"
`;

  const envPath = path.join(process.cwd(), '.env.local');

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local 文件创建成功');
    console.log('📋 前端配置:');
    console.log('  - API地址: http://localhost:3001');
    console.log('  - 模式: development');
    console.log('  - Mock: 禁用 (使用真实API)');
    console.log('  - 调试: 启用');

    console.log('\n🚀 前端启动:');
    console.log('1. 确保后端已启动 (localhost:3001)');
    console.log('2. 运行: npm run dev');
    console.log('3. 访问: http://localhost:3000');

  } catch (error) {
    console.error('❌ 创建 .env.local 文件失败:', error.message);
  }
};

setupLocalEnvironment();
