#!/bin/bash

# MySQL Ubuntu 安装脚本
# 适用于 Ubuntu 22.04.5 LTS

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始MySQL安装流程${NC}"
echo "=================================="

# 1. 更新包索引
echo -e "${YELLOW}[步骤 1] 更新包索引${NC}"
sudo apt update

# 2. 安装MySQL服务器
echo -e "${YELLOW}[步骤 2] 安装MySQL服务器${NC}"
sudo apt install mysql-server -y

# 3. 启动MySQL服务
echo -e "${YELLOW}[步骤 3] 启动MySQL服务${NC}"
sudo systemctl start mysql
sudo systemctl enable mysql

# 4. 检查MySQL服务状态
echo -e "${YELLOW}[步骤 4] 检查MySQL服务状态${NC}"
sudo systemctl status mysql --no-pager

# 5. 设置root密码
echo -e "${YELLOW}[步骤 5] 设置MySQL root密码${NC}"
echo "设置root密码为: password"
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 6. 创建数据库
echo -e "${YELLOW}[步骤 6] 创建数据库${NC}"
sudo mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS heiniu_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 7. 验证安装
echo -e "${YELLOW}[步骤 7] 验证安装${NC}"
mysql --version
echo -e "${GREEN}✅ MySQL版本信息${NC}"

# 8. 测试连接
echo -e "${YELLOW}[步骤 8] 测试MySQL连接${NC}"
mysql -u root -ppassword -e "SELECT VERSION();"
echo -e "${GREEN}✅ MySQL连接测试成功${NC}"

# 9. 显示数据库列表
echo -e "${YELLOW}[步骤 9] 显示数据库列表${NC}"
mysql -u root -ppassword -e "SHOW DATABASES;"

echo -e "${GREEN}=================================="
echo -e "✅ MySQL安装完成！${NC}"
echo -e "${GREEN}=================================="

echo -e "${BLUE}下一步操作：${NC}"
echo "1. 进入项目目录: cd /mnt/c/Users/Steve/heiniu/backend"
echo "2. 运行数据库设置脚本: node scripts/setup-database.js"
echo "3. 启动后端服务: npm run dev"

echo -e "${BLUE}MySQL连接信息：${NC}"
echo "• 主机: localhost"
echo "• 端口: 3306"
echo "• 用户: root"
echo "• 密码: password"
echo "• 数据库: heiniu_db"