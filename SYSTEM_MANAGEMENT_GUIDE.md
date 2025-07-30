# 🛠️ 黑牛食品溯源系统 - 完整管理指南

## 📋 目录
- [管理员账户信息](#管理员账户信息)
- [系统启动流程](#系统启动流程)
- [系统重启流程](#系统重启流程)
- [前端登录验证](#前端登录验证)
- [故障排除](#故障排除)
- [日常使用建议](#日常使用建议)

---

## 🔐 管理员账户信息

### **1. 平台管理员（最高权限）**
```
用户名：platform_admin
密码：Admin@123456
登录接口：/api/auth/platform-login
权限级别：0 (最高)
管理范围：全平台所有工厂
跳转页面：/platform
描述：平台最高权限，可管理所有工厂租户和平台运营
```

### **2. 工厂超级管理员**
```
用户名：factory_admin
密码：SuperAdmin@123
工厂ID：TEST_2024_001
登录接口：/api/auth/login
权限级别：0 (工厂内最高)
管理范围：单个工厂内所有功能
跳转页面：/admin/dashboard
描述：工厂内部最高权限账号，具有完整管理权限
```

### **3. 部门管理员**

#### 养殖部门管理员
```
用户名：farming_admin
密码：DeptAdmin@123
工厂ID：TEST_2024_001
登录接口：/api/auth/login
权限级别：10
管理范围：养殖部门
```

#### 加工部门管理员
```
用户名：processing_admin
密码：DeptAdmin@123
工厂ID：TEST_2024_001
登录接口：/api/auth/login
权限级别：10
管理范围：加工部门
```

#### 物流部门管理员
```
用户名：logistics_admin
密码：DeptAdmin@123
工厂ID：TEST_2024_001
登录接口：/api/auth/login
权限级别：10
管理范围：物流部门
```

### **4. 前端兼容的Mock账户（备用）**
```
超级管理员：super_admin / super123
权限管理员：admin / admin123
部门管理员：dept_admin / dept123
普通员工：worker / worker123
测试用户：user / user123
```

---

## 🚀 系统启动流程

### **第一步：MySQL数据库启动**

#### 启动MySQL服务
```bash
# macOS (Homebrew)
brew services start mysql

# Windows
net start mysql

# Linux
sudo systemctl start mysql
```

#### 验证MySQL状态
```bash
# 检查服务状态
brew services list | grep mysql

# 连接测试
mysql -u root -ppassword -e "SELECT VERSION();"

# 检查数据库
mysql -u root -ppassword -e "SHOW DATABASES;"
```

### **第二步：后端服务启动**

#### 1. 进入后端目录
```bash
cd backend
```

#### 2. 安装依赖（首次启动）
```bash
npm install
```

#### 3. 环境检查
```bash
# 检查MySQL状态
node scripts/check-mysql-status.js

# 检查系统状态
npm run check
```

#### 4. 启动后端服务
```bash
# 开发环境（推荐）
npm run dev

# 生产环境
npm start
```

#### 5. 验证后端启动
```bash
# 健康检查
curl http://localhost:3001/health

# API状态检查
curl http://localhost:3001/api/auth/status

# 测试平台管理员登录
curl -X POST http://localhost:3001/api/auth/platform-login \
  -H "Content-Type: application/json" \
  -d '{"username":"platform_admin","password":"Admin@123456"}'
```

### **第三步：前端服务启动**

#### 1. 进入前端目录
```bash
cd frontend/web-app-next
```

#### 2. 安装依赖（首次启动）
```bash
npm install
```

#### 3. 启动前端服务
```bash
npm run dev
```

#### 4. 访问前端
```
前端地址：http://localhost:3000
后端地址：http://localhost:3001
```

---

## 🔄 系统重启流程

### **完全重启（包括MySQL）**

#### 1. 停止所有服务
```bash
# 前端：在前端终端按 Ctrl+C
# 后端：在后端终端按 Ctrl+C

# 停止MySQL（如果需要重启MySQL）
brew services stop mysql
```

#### 2. 重新启动（按顺序）
```bash
# 1. 启动MySQL
brew services start mysql

# 2. 启动后端
cd backend
npm run dev

# 3. 启动前端（新终端窗口）
cd frontend/web-app-next
npm run dev
```

### **快速重启（不重启MySQL）**

#### 1. 重启后端
```bash
cd backend
# 按 Ctrl+C 停止当前进程
npm run dev
```

#### 2. 重启前端
```bash
cd frontend/web-app-next
# 按 Ctrl+C 停止当前进程
npm run dev
```

### **单独重启MySQL**
```bash
# 重启MySQL服务
brew services restart mysql

# 验证重启成功
mysql -u root -ppassword -e "SELECT VERSION();"
```

---

## ✅ 前端登录验证

### **登录页面访问**
```
登录地址：http://localhost:3000/login
```

### **快速登录测试**

#### 方式1：使用快速填充按钮
1. 访问登录页面
2. 点击"平台管理员"快速填充按钮
3. 点击登录按钮
4. 验证跳转到 `/platform` 页面

#### 方式2：手动输入
```
平台管理员登录：
用户名：platform_admin
密码：Admin@123456

工厂管理员登录：
用户名：factory_admin
密码：SuperAdmin@123
```

### **登录后验证**
- **平台管理员** → 跳转到 `/platform`
- **工厂管理员** → 跳转到 `/admin/dashboard`
- **部门管理员** → 跳转到 `/admin/dashboard`

---

## 🔧 故障排除

### **常见问题及解决方案**

#### 1. MySQL连接失败
```bash
# 问题：MySQL服务未启动
# 解决：启动MySQL服务
brew services start mysql

# 问题：密码错误
# 解决：重置root密码
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'password';"
```

#### 2. 后端启动失败
```bash
# 问题：端口被占用
# 检查：
lsof -i :3001

# 解决：杀死占用进程
kill -9 <PID>

# 问题：数据库连接失败
# 解决：检查.env文件配置
cat backend/.env
```

#### 3. 前端启动失败
```bash
# 问题：端口被占用
# 检查：
lsof -i :3000

# 问题：依赖缺失
# 解决：重新安装依赖
cd frontend/web-app-next
rm -rf node_modules
npm install
```

#### 4. 登录失败
```bash
# 检查后端服务状态
curl http://localhost:3001/health

# 检查API端点
curl http://localhost:3001/api/auth/status

# 重置平台管理员
cd backend
node scripts/init-platform-admin.js --force
```

#### 5. 数据库问题
```bash
# 重置数据库
cd backend
mysql -u root -ppassword -e "DROP DATABASE IF EXISTS heiniu_db; CREATE DATABASE heiniu_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 重新应用数据库结构
npx prisma db push

# 重新创建管理员
node scripts/init-platform-admin.js
```

### **端口检查命令**
```bash
# 检查所有相关端口
lsof -i :3000  # 前端端口
lsof -i :3001  # 后端端口
lsof -i :3306  # MySQL端口
```

### **日志查看**
```bash
# 查看MySQL日志
brew services info mysql

# 查看后端日志
# 在后端运行终端查看实时日志

# 查看前端日志
# 在前端运行终端查看实时日志
# 同时查看浏览器控制台
```

---

## 📋 日常使用建议

### **标准开发启动顺序**
1. **确认MySQL运行状态**
   ```bash
   brew services start mysql
   ```

2. **启动后端服务**
   ```bash
   cd backend
   npm run dev
   ```

3. **启动前端服务**
   ```bash
   cd frontend/web-app-next
   npm run dev
   ```

4. **访问系统**
   ```
   http://localhost:3000
   ```

### **测试流程建议**
1. **登录测试**
   - 使用前端登录页面的快速填充功能
   - 验证不同权限用户的跳转是否正确
   - 确认用户界面显示正常

2. **API测试**
   ```bash
   # 健康检查
   curl http://localhost:3001/health
   
   # 认证测试
   curl -X POST http://localhost:3001/api/auth/platform-login \
     -H "Content-Type: application/json" \
     -d '{"username":"platform_admin","password":"Admin@123456"}'
   ```

3. **功能验证**
   - 权限系统工作正常
   - 页面跳转逻辑正确
   - API响应正常

### **开发环境维护**
```bash
# 定期更新依赖
cd backend && npm update
cd frontend/web-app-next && npm update

# 定期重启MySQL
brew services restart mysql

# 清理日志（如果需要）
# 查看系统日志文件大小，必要时清理
```

### **备份建议**
```bash
# 数据库备份
mysqldump -u root -ppassword heiniu_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u root -ppassword heiniu_db < backup_20250719.sql
```

---

## 🎯 快速参考

### **关键端口**
- 前端：`http://localhost:3000`
- 后端：`http://localhost:3001`
- MySQL：`localhost:3306`

### **管理员快速登录**
- 平台管理员：`platform_admin` / `Admin@123456`
- 工厂管理员：`factory_admin` / `SuperAdmin@123`

### **重要命令**
```bash
# MySQL状态
brew services list | grep mysql

# 启动所有服务
brew services start mysql
cd backend && npm run dev &
cd frontend/web-app-next && npm run dev

# 健康检查
curl http://localhost:3001/health
```

---

## 📞 技术支持

如遇到问题，请按以下顺序检查：

1. **MySQL服务是否运行**
2. **后端服务是否启动成功**
3. **前端服务是否运行正常**
4. **网络端口是否被占用**
5. **查看相关错误日志**

**联系方式：**
- 查看控制台日志
- 检查浏览器开发者工具
- 参考本文档故障排除部分

---

*最后更新时间：2025年7月19日* 