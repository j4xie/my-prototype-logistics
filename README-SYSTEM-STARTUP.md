# 海牛食品溯源系统 - 一键启动指南

## 🚀 快速启动

### 方法1：使用别名 (推荐)

1. **设置别名** (只需运行一次)
   ```bash
   ./setup-alias.sh
   ```

2. **启动系统** (在任何目录)
   ```bash
   run system
   ```

### 方法2：直接运行脚本

#### Linux/Mac/WSL:
```bash
./run-system.sh
```

#### Windows:
```cmd
run-system.bat
```

## 📋 系统要求

### 必需环境
- ✅ **Node.js** (v18+)
- ✅ **npm** (v8+)
- ✅ **MySQL** (v8.0+)

### 系统支持
- ✅ **Windows** (Command Prompt, PowerShell, WSL)
- ✅ **Linux** (Ubuntu, CentOS, etc.)
- ✅ **macOS**

## 🔧 启动脚本功能

### 自动检查和处理
1. **环境检查**
   - Node.js 和 npm 版本
   - MySQL 服务状态
   - 项目目录完整性

2. **依赖管理**
   - 自动安装缺失的 npm 依赖
   - 后端和前端依赖同时处理

3. **数据库管理**
   - 自动运行 Prisma 迁移
   - 生成数据库客户端
   - 同步数据库结构

4. **智能端口管理**
   - 检查端口占用情况
   - 自动释放被占用的端口
   - 默认端口: 后端 3001, 前端 3000
   - **动态端口检测**: 自动识别实际运行的端口
   - **端口变化适应**: 实时监控端口变化

5. **服务启动**
   - 后台启动后端服务
   - 后台启动前端服务
   - 健康检查确认启动成功
   - **实时状态监控**: 持续监控服务状态

## 🌐 系统访问

### 访问地址 (动态检测)
- **前端应用**: http://localhost:3000 (实际端口会自动检测)
- **后端API**: http://localhost:3001 (实际端口会自动检测)
- **健康检查**: http://localhost:3001/health (实际端口会自动检测)

> 💡 **智能端口检测**: 系统会自动检测实际运行的端口，无需担心端口变化问题

### 默认账户
- **用户名**: platform_admin
- **密码**: Admin@123456

## 🏭 智能工厂ID生成功能

### 功能位置
访问路径: **平台管理 → 工厂管理 → 新建工厂**

### 功能特性
- 🧠 **智能推断**: 基于工厂名称、地址、电话等信息自动推断行业和地区
- 📊 **标准化**: 符合 GB/T 4754-2017 行业分类标准
- 🆔 **新格式**: `144-GD-2025-001` (行业代码-地区代码-年份-序号)
- 📝 **兼容性**: 同时保存老格式 `FCT_2025_001`
- 🎯 **置信度**: 提供推断置信度评分
- ⚡ **自动化**: 无需人工输入行业和地区信息

### 支持范围
- **行业分类**: 20+ 食品加工相关行业
- **地理覆盖**: 全国 34 个省级行政区
- **推断方法**: 工厂名称、地址解析、手机号归属地、邮箱域名

## 🔍 动态端口检测功能

### 特性说明
- **自适应端口检测**: 无论服务运行在哪个端口，系统都能自动识别
- **多重检测方法**: 
  - 健康检查接口验证 (后端)
  - React/Next.js 特征识别 (前端)
  - 进程端口分析
  - 配置文件解析
- **实时监控**: 持续监控端口变化，及时更新访问地址
- **跨平台兼容**: Linux、macOS、Windows 全平台支持
- **故障恢复**: 服务异常时自动重新检测

### 使用场景
1. **端口冲突处理**: 默认端口被占用时自动适应新端口
2. **多环境部署**: 不同环境使用不同端口配置
3. **动态端口分配**: 容器化部署中的随机端口
4. **开发调试**: 避免端口变化导致的访问问题

### 工具脚本
- `./check-ports.sh`: 快速检查当前端口状态
- `./detect-ports.sh`: 高级端口检测和监控
- `./test-port-detection.sh`: 端口检测功能测试

## 🛠️ 管理命令

### 启动和停止
```bash
# 启动系统
run system

# 停止系统
./stop-system.sh
```

### 端口管理
```bash
# 快速检查当前端口
./check-ports.sh

# 实时监控端口变化
./detect-ports.sh monitor

# 测试端口检测功能
./test-port-detection.sh
```

### 日志管理
```bash
# 查看日志
./view-logs.sh

# 手动查看日志文件
tail -f backend/logs/backend.log
tail -f frontend/web-app-next/logs/frontend.log
```

### 别名管理
```bash
# 设置别名
./setup-alias.sh

# 重新加载别名
source ~/.bashrc  # 或 ~/.zshrc
```

## 📊 系统功能模块

### 核心功能
- 🏭 **工厂管理**: 智能工厂ID生成、工厂信息管理
- 🌾 **养殖管理**: 畜禽养殖数据录入、追溯管理
- 🏪 **加工管理**: 食品加工流程、质量控制
- 🚚 **物流管理**: 运输追溯、配送管理
- 🔍 **溯源查询**: 产品追溯、消费者查询
- 👥 **用户管理**: 多租户权限、角色管理

### 技术特性
- 🔐 **多租户架构**: 工厂级数据隔离
- 🎨 **响应式设计**: 支持多设备访问
- 🛡️ **权限控制**: 细粒度权限管理
- 📱 **移动友好**: 适配手机和平板
- 🚀 **高性能**: 优化的数据库查询
- 🔄 **实时同步**: 数据实时更新

## 🚨 故障排除

### 常见问题

1. **端口占用**
   ```bash
   # 查看端口占用
   netstat -tlnp | grep :3000
   netstat -tlnp | grep :3001
   
   # 手动释放端口
   sudo lsof -ti:3000 | xargs kill -9
   sudo lsof -ti:3001 | xargs kill -9
   ```

2. **MySQL连接失败**
   ```bash
   # 检查MySQL服务
   sudo service mysql status
   
   # 启动MySQL
   sudo service mysql start
   
   # Windows
   net start mysql
   ```

3. **依赖安装失败**
   ```bash
   # 清理缓存
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

4. **数据库迁移失败**
   ```bash
   # 重置数据库
   npx prisma migrate reset
   
   # 重新生成客户端
   npx prisma generate
   ```

### 日志查看
```bash
# 后端日志
tail -f backend/logs/backend.log

# 前端日志
tail -f frontend/web-app-next/logs/frontend.log

# 系统日志
journalctl -u mysql
```

## 🔧 手动启动 (备用方案)

如果自动脚本失败，可以手动启动：

### 1. 启动MySQL
```bash
# Linux/Mac
sudo service mysql start

# Windows
net start mysql
```

### 2. 启动后端
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### 3. 启动前端
```bash
cd frontend/web-app-next
npm install
npm run dev
```

## 📁 项目结构

```
heiniu/
├── run-system.sh          # Linux/Mac 启动脚本
├── run-system.bat         # Windows 启动脚本
├── setup-alias.sh         # 别名设置脚本
├── stop-system.sh         # 停止脚本
├── view-logs.sh           # 日志查看脚本
├── backend/               # 后端应用
│   ├── logs/             # 后端日志
│   └── src/
│       └── utils/
│           └── factory-id-generator.js  # 智能工厂ID生成器
└── frontend/
    └── web-app-next/      # 前端应用
        └── logs/          # 前端日志
```

## 🎯 开发提示

### 修改配置
- **端口配置**: 修改启动脚本中的 `BACKEND_PORT` 和 `FRONTEND_PORT`
- **数据库配置**: 修改 `backend/.env` 文件
- **前端API地址**: 修改 `frontend/web-app-next/src/lib/api.ts`

### 扩展功能
- **新增行业分类**: 修改 `backend/src/config/industry-keywords.js`
- **新增地区支持**: 修改 `backend/src/config/region-keywords.js`
- **自定义推断逻辑**: 修改 `backend/src/utils/factory-id-generator.js`

## 🎉 总结

通过这个一键启动系统，你可以：
- ⚡ **快速启动**: 一个命令启动整个系统
- 🛠️ **自动化管理**: 自动处理依赖、数据库、端口等
- 📊 **智能功能**: 使用集成的智能工厂ID生成功能
- 🔧 **便捷管理**: 简单的日志查看和系统管理

**现在就试试吧！运行 `run system` 开始使用海牛食品溯源系统！** 🚀