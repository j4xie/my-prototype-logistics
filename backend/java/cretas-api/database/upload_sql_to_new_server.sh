#!/bin/bash

# 上传SQL文件到新服务器并执行
# 服务器: 47.100.235.168

echo "======================================"
echo "新服务器数据库初始化脚本"
echo "服务器: 47.100.235.168"
echo "======================================"
echo ""

# SQL文件路径
SQL_FILE=~/Downloads/cretas-backend-system-main/fix-document/init-final-users.sql

# 检查文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL文件不存在: $SQL_FILE"
    exit 1
fi

echo "✅ 找到SQL文件: $SQL_FILE"
echo "文件大小: $(ls -lh "$SQL_FILE" | awk '{print $5}')"
echo ""

# 上传SQL文件
echo "### 步骤1: 上传SQL文件到服务器"
echo "执行命令: scp $SQL_FILE root@47.100.235.168:/www/wwwroot/cretas/"
echo ""
echo "请手动执行以下命令上传文件:"
echo ""
echo "scp $SQL_FILE root@47.100.235.168:/www/wwwroot/cretas/"
echo ""
echo "======================================"
echo ""

# 执行SQL的命令
echo "### 步骤2: SSH登录服务器并执行SQL"
echo ""
echo "请手动执行以下命令:"
echo ""
echo "# 1. SSH登录服务器"
echo "ssh root@47.100.235.168"
echo ""
echo "# 2. 登录MySQL"
echo "mysql -u root -p"
echo ""
echo "# 3. 执行SQL (在MySQL提示符下)"
echo "USE cretas;"
echo "SOURCE /www/wwwroot/cretas/init-final-users.sql;"
echo "SELECT id, username, factory_id, role_code FROM users;"
echo "EXIT;"
echo ""
echo "======================================"
echo ""

# 验证步骤
echo "### 步骤3: 验证初始化结果"
echo ""
echo "执行以下命令测试登录:"
echo ""
echo "cd /Users/jietaoxie/my-prototype-logistics"
echo "bash test_server_106.sh"
echo ""
echo "======================================"
echo ""

echo "📋 测试账户信息:"
echo ""
echo "工厂用户 (推荐测试):"
echo "  用户名: proc_admin"
echo "  密码: 123456"
echo "  工厂ID: F001"
echo "  角色: department_admin (加工部主管)"
echo ""
echo "平台用户:"
echo "  用户名: admin"
echo "  密码: 123456"
echo "  角色: platform_super_admin"
echo ""
echo "======================================"
echo ""
echo "✅ 准备完成！请按照上述步骤手动执行。"
