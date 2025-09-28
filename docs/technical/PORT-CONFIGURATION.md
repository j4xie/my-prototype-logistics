# 端口配置说明

## 🔧 系统端口分配

### 前端服务
- **React Native (Expo) 开发服务器**: `3010`
  - Metro bundler: 3010
  - Expo DevTools: 3010
  - 配置位置: `frontend/HainiuFoodTrace/package.json`

### 后端服务
- **Node.js Express API服务器**: `3001`
  - API基础路径: `http://localhost:3001/api`
  - 移动端API: `http://localhost:3001/api/mobile`
  - 配置位置: `backend/.env` 中的 `PORT=3001`

### 数据库服务
- **MySQL 8.0**: `3306` (默认端口，保持不变)
  - 服务名: MySQL80
  - 连接字符串: `mysql://user:password@localhost:3306/database`

## 📱 React Native 客户端配置

### 开发环境
```javascript
// frontend/HainiuFoodTrace/src/constants/config.ts
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3001/api'  // Android模拟器访问后端3001端口
  : 'https://your-production-api.com/api';
```

**注意**: Android模拟器使用 `10.0.2.2` 来访问主机的 `localhost`

### 启动命令
```bash
# 启动React Native开发服务器 (端口3010)
cd frontend/HainiuFoodTrace
npm start  # 自动使用3010端口

# 启动后端API服务器 (端口3001)
cd backend
npm run dev  # 使用3001端口
```

## 🚀 快速启动脚本

使用项目根目录的快速启动脚本:
```bash
# Windows
start-backend-rn.cmd  # 同时启动MySQL、后端(3001)、React Native(3010)
```

## ⚠️ 重要说明

1. **端口不冲突**: 前端3010和后端3001使用不同端口，避免冲突
2. **API请求路径**: React Native应用始终向后端3001端口发送API请求
3. **开发服务器**: Expo/Metro开发服务器运行在3010，仅用于提供React Native代码热更新

## 📋 端口占用检查

### Windows
```cmd
# 检查3010端口 (React Native)
netstat -ano | findstr :3010

# 检查3001端口 (后端API)
netstat -ano | findstr :3001

# 检查3306端口 (MySQL)
netstat -ano | findstr :3306
```

### 如果端口被占用
1. 找到占用进程的PID
2. 结束进程: `taskkill /PID <进程ID> /F`
3. 或修改对应服务的端口配置

---

**最后更新**: 2025-08-07
**配置版本**: 1.0