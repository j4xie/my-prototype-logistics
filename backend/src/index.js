import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// 导入路由
import authRoutes from './routes/auth.js';
import whitelistRoutes from './routes/whitelist.js';
import usersRoutes from './routes/users.js';
import platformRoutes from './routes/platform.js';

// 导入中间件
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// 配置环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 基础中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/platform', platformRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '黑牛食品溯源系统后端API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      whitelist: '/api/whitelist',
      users: '/api/users',
      platform: '/api/platform',
      health: '/health',
    },
  });
});

// 静态资源拦截 - 直接返回404避免进入API路由
app.get('/favicon.ico', (req, res) => {
  res.status(404).send('Not Found');
});

app.get('/favicon.png', (req, res) => {
  res.status(404).send('Not Found');
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API信息
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API服务正常运行',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      multiTenant: true,
      whitelistRegistration: true,
      roleBasedAuth: true,
      jwtAuth: true,
    },
  });
});

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 全局异常处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 ===================================');
  console.log(`🚀 黑牛食品溯源系统后端服务启动成功`);
  console.log(`🚀 服务地址: http://localhost:${PORT}`);
  console.log(`🚀 API文档: http://localhost:${PORT}/api`);
  console.log(`🚀 健康检查: http://localhost:${PORT}/health`);
  console.log(`🚀 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ===================================');
  console.log('');
  console.log('📋 可用的API端点:');
  console.log('   🔐 认证模块: /api/auth');
  console.log('   👥 白名单管理: /api/whitelist');
  console.log('   👤 用户管理: /api/users');
  console.log('   🏭 平台管理: /api/platform');
  console.log('');
  console.log('🔧 特性支持:');
  console.log('   ✅ 多租户架构');
  console.log('   ✅ 白名单注册');
  console.log('   ✅ 角色权限管理');
  console.log('   ✅ JWT认证');
  console.log('   ✅ 数据验证');
  console.log('   ✅ 错误处理');
  console.log('');
});