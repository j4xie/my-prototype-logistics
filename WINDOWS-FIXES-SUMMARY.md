# Windows 启动脚本修复总结

## 🚨 问题分析

你遇到的问题主要有两个：

1. **字符编码问题**: Unicode 特殊字符（如 ╔ ╗ ║ ╚ ╝）在 Windows 命令提示符中显示异常
2. **MySQL 服务问题**: MySQL 服务未安装或未启动

## ✅ 已完成的修复

### 1. 字符编码修复

**修复内容**:
- 移除所有 Unicode 特殊字符（框线字符）
- 替换为标准 ASCII 字符（等号 `=`）
- 移除 emoji 表情符号
- 使用标准日志格式：`[INFO]`, `[OK]`, `[WARN]`, `[ERROR]`

**修复前**:
```batch
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    海牛食品溯源系统                              ║
echo 🔍 检查Node.js...
echo ✅ Node.js版本: %NODE_VERSION%
```

**修复后**:
```batch
echo ================================================================
echo                    海牛食品溯源系统
echo [INFO] 检查Node.js...
echo [OK] Node.js版本: %NODE_VERSION%
```

### 2. 创建的修复文件

- ✅ `run-system.bat` - 修复了编码问题的主启动脚本
- ✅ `check-ports.bat` - Windows 端口检查工具
- ✅ `setup-mysql-windows.bat` - MySQL 安装向导

## 🔧 MySQL 解决方案

### 方法1: 使用官方安装程序（推荐）

1. 访问 https://dev.mysql.com/downloads/installer/
2. 下载 "MySQL Installer for Windows"
3. 运行安装程序，选择 "Developer Default"
4. 设置 root 用户密码
5. 完成安装

### 方法2: 使用 Chocolatey

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装 MySQL
choco install mysql
```

### 方法3: 使用 XAMPP（开发环境）

1. 访问 https://www.apachefriends.org/
2. 下载 XAMPP for Windows
3. 安装并启动 MySQL 服务

## 🚀 现在可以使用的脚本

### 1. 主启动脚本
```batch
run-system.bat
```

### 2. 端口检查
```batch
check-ports.bat
```

### 3. MySQL 安装向导
```batch
setup-mysql-windows.bat
```

## 📋 启动步骤

1. **安装 MySQL**:
   ```batch
   setup-mysql-windows.bat
   ```

2. **启动系统**:
   ```batch
   run-system.bat
   ```

3. **检查端口**:
   ```batch
   check-ports.bat
   ```

## 🎯 预期输出

修复后的脚本应该显示：

```
================================================================
                    海牛食品溯源系统
                  Windows 一键启动脚本
               (包含智能工厂ID生成功能)
================================================================

[INFO] 检查项目目录...
[OK] 项目目录检查完成

[INFO] 检查Node.js...
[OK] Node.js版本: v22.14.0

[INFO] 检查MySQL服务...
[OK] MySQL服务运行正常
```

## 🔍 故障排除

如果仍然遇到问题：

1. **字符显示问题**:
   ```batch
   chcp 65001
   ```

2. **MySQL 连接问题**:
   ```batch
   net start mysql
   ```

3. **端口检查**:
   ```batch
   netstat -an | findstr ":3001"
   ```

## 📞 技术支持

如果问题仍然存在，请提供以下信息：
- Windows 版本
- 命令提示符类型（CMD/PowerShell）
- 错误信息截图
- MySQL 安装状态