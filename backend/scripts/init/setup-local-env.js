import fs from 'fs';
import path from 'path';

const setupLocalEnvironment = () => {
  console.log('🔧 设置本地开发环境...');

  const envContent = `# 数据库配置 - 本地开发环境
DATABASE_URL="mysql://root:password@localhost:3306/cretas_db"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# CORS配置 - 本地前端
CORS_ORIGIN="http://localhost:3000"

# 应用配置
PORT=3001
NODE_ENV="development"
`;

  const envPath = path.join(process.cwd(), '.env');

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env 文件创建成功');
    console.log('📋 环境配置:');
    console.log('  - 数据库: MySQL (localhost:3306)');
    console.log('  - 后端端口: 3001');
    console.log('  - 前端CORS: http://localhost:3000');
    console.log('  - 模式: development');

    console.log('\n🚀 下一步:');
    console.log('1. 确保MySQL数据库运行在 localhost:3306');
    console.log('2. 创建数据库: cretas_db');
    console.log('3. 运行: npm run dev 启动后端');
    console.log('4. 在前端目录运行: npm run dev 启动前端');

  } catch (error) {
    console.error('❌ 创建 .env 文件失败:', error.message);
  }
};

setupLocalEnvironment();
