# MySQL 数据库设置指南

## 概述

本指南将帮助您在不同操作系统上安装和配置MySQL数据库，以支持黑牛食品溯源系统的后端服务。

## 系统要求

- MySQL 8.0+ 或 MariaDB 10.5+
- Node.js 18+
- 至少 1GB 可用存储空间

## 安装步骤

### Windows 系统

#### 方法1: 使用MySQL官方安装器 (推荐)

1. **下载MySQL**
   ```
   访问: https://dev.mysql.com/downloads/mysql/
   下载: MySQL Community Server (Windows)
   ```

2. **安装MySQL**
   - 运行下载的安装程序
   - 选择"Developer Default"安装类型
   - 设置root用户密码: `password` (或自定义密码)
   - 完成安装

3. **启动MySQL服务**
   ```cmd
   # 以管理员身份运行命令提示符
   net start mysql
   ```

#### 方法2: 使用Chocolatey

```powershell
# 以管理员身份运行PowerShell
choco install mysql
```

### macOS 系统

#### 方法1: 使用Homebrew (推荐)

```bash
# 安装Homebrew (如果未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装MySQL
brew install mysql

# 启动MySQL服务
brew services start mysql

# 设置root密码
mysql_secure_installation
```

#### 方法2: 使用MySQL官方安装器

1. 访问: https://dev.mysql.com/downloads/mysql/
2. 下载MySQL Community Server (macOS)
3. 运行.dmg文件并按照向导安装

### Linux 系统

#### Ubuntu/Debian

```bash
# 更新包索引
sudo apt update

# 安装MySQL
sudo apt install mysql-server

# 启动MySQL服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 配置MySQL安全设置
sudo mysql_secure_installation
```

#### CentOS/RHEL

```bash
# 安装MySQL
sudo yum install mysql-server

# 启动MySQL服务
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 获取临时密码
sudo grep 'temporary password' /var/log/mysqld.log

# 配置MySQL
sudo mysql_secure_installation
```

## 数据库配置

### 1. 登录MySQL

```bash
# 使用root用户登录
mysql -u root -p
```

### 2. 创建数据库用户 (可选)

```sql
-- 创建专用用户
CREATE USER 'heiniu_user'@'localhost' IDENTIFIED BY 'heiniu_password';

-- 授予权限
GRANT ALL PRIVILEGES ON heiniu_db.* TO 'heiniu_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;
```

### 3. 验证安装

```sql
-- 显示数据库版本
SELECT VERSION();

-- 显示当前用户
SELECT USER();

-- 退出MySQL
EXIT;
```

## 环境配置

### 1. 检查.env文件

确保后端项目的`.env`文件包含正确的数据库连接信息：

```env
# 数据库配置
DATABASE_URL="mysql://root:password@localhost:3306/heiniu_db"

# 如果使用自定义用户
# DATABASE_URL="mysql://heiniu_user:heiniu_password@localhost:3306/heiniu_db"
```

### 2. 修改数据库密码

如果您的MySQL root密码不是`password`，请修改以下位置：

1. **后端 .env 文件**
   ```env
   DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/heiniu_db"
   ```

2. **数据库设置脚本**
   ```javascript
   // backend/scripts/setup-database.js
   const DB_CONFIG = {
     host: 'localhost',
     user: 'root',
     password: 'YOUR_PASSWORD', // 修改这里
     database: 'heiniu_db',
     port: 3306
   };
   ```

## 自动化设置

### 1. 运行数据库设置脚本

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 运行数据库设置脚本
node scripts/setup-database.js
```

### 2. 脚本执行流程

数据库设置脚本将自动完成以下步骤：

1. ✅ 检查MySQL服务状态
2. ✅ 创建数据库 (`heiniu_db`)
3. ✅ 运行Prisma数据库迁移
4. ✅ 生成Prisma客户端
5. ✅ 填充种子数据
6. ✅ 初始化平台管理员
7. ✅ 验证数据库设置

## 常见问题解决

### 1. "MySQL服务未启动"

**Windows:**
```cmd
net start mysql
```

**macOS:**
```bash
brew services start mysql
```

**Linux:**
```bash
sudo systemctl start mysql
```

### 2. "认证失败"

- 确认用户名和密码正确
- 检查MySQL是否允许root用户本地登录
- 尝试重置root密码

### 3. "连接被拒绝"

- 检查MySQL是否运行在3306端口
- 确认防火墙设置
- 检查MySQL配置文件

### 4. "数据库不存在"

运行数据库设置脚本将自动创建数据库：
```bash
node scripts/setup-database.js
```

## 验证设置

### 1. 检查数据库

```bash
# 登录MySQL
mysql -u root -p

# 查看数据库
SHOW DATABASES;

# 使用数据库
USE heiniu_db;

# 查看表
SHOW TABLES;
```

### 2. 测试API连接

```bash
# 启动后端服务
npm run dev

# 在另一个终端测试API
curl http://localhost:3001/api/auth/status
```

## 下一步

数据库设置完成后，您可以：

1. **启动后端服务**
   ```bash
   npm run dev
   ```

2. **启动前端服务**
   ```bash
   cd ../frontend/web-app-next
   npm run dev
   ```

3. **访问应用**
   - 前端: http://localhost:3000
   - 后端API: http://localhost:3001

4. **登录测试**
   - 平台管理员: `platform_admin` / `admin123`
   - 工厂超级管理员: `super_admin` / `admin123`

## 技术支持

如果遇到问题，请检查：

1. MySQL服务是否正常运行
2. .env文件配置是否正确
3. 防火墙设置是否允许3306端口
4. 用户权限是否正确配置

更多详细信息，请参考：
- [MySQL官方文档](https://dev.mysql.com/doc/)
- [Prisma文档](https://www.prisma.io/docs/)
- 项目README.md文件