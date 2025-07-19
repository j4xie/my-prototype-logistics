#!/bin/bash

# MySQL配置脚本 - 设置root密码和创建数据库

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 配置MySQL数据库${NC}"
echo "=================================="

# 1. 设置root密码
echo -e "${YELLOW}[步骤 1] 设置root密码${NC}"
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"
sudo mysql -e "FLUSH PRIVILEGES;"
echo -e "${GREEN}✅ root密码设置完成${NC}"

# 2. 测试连接
echo -e "${YELLOW}[步骤 2] 测试MySQL连接${NC}"
mysql -u root -ppassword -e "SELECT VERSION();"
echo -e "${GREEN}✅ MySQL连接测试成功${NC}"

# 3. 创建数据库
echo -e "${YELLOW}[步骤 3] 创建数据库${NC}"
mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS heiniu_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo -e "${GREEN}✅ 数据库 heiniu_db 创建成功${NC}"

# 4. 显示数据库列表
echo -e "${YELLOW}[步骤 4] 显示数据库列表${NC}"
mysql -u root -ppassword -e "SHOW DATABASES;"

echo -e "${GREEN}=================================="
echo -e "✅ MySQL配置完成！${NC}"
echo -e "${GREEN}=================================="

echo -e "${BLUE}接下来可以运行：${NC}"
echo "• 数据库迁移: node scripts/setup-database.js"
echo "• 启动后端: npm run dev"