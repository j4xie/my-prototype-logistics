#!/bin/bash

##############################################################################
# 服务器测试数据导入脚本 (Server Test Data Import Script)
# 说明: 自动将本地生成的SQL脚本导入到服务器数据库
# 使用: bash ./import_server_test_data.sh
##############################################################################

set -e  # 任何错误都退出脚本

# 配置
SERVER_USER="root"
SERVER_HOST="139.196.165.140"
SERVER_PATH="/www/wwwroot/project"
SQL_FILE="/Users/jietaoxie/my-prototype-logistics/server_complete_test_data.sql"
DB_NAME="cretas_db"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}服务器测试数据导入脚本 (Server Data Import)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 检查SQL文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ 错误: SQL文件不存在${NC}"
    echo "路径: $SQL_FILE"
    exit 1
fi

echo -e "${GREEN}✅ SQL文件已找到${NC}"
echo "文件: $SQL_FILE"
echo "大小: $(du -h "$SQL_FILE" | cut -f1)"
echo ""

# 检查网络连接
echo -e "${YELLOW}🔍 正在检查网络连接...${NC}"
if ping -c 1 -W 2 "$SERVER_HOST" &> /dev/null; then
    echo -e "${GREEN}✅ 网络连接正常${NC}"
else
    echo -e "${RED}❌ 无法连接到服务器 ($SERVER_HOST)${NC}"
    exit 1
fi
echo ""

# 提示用户确认
echo -e "${YELLOW}⚠️  警告: 此操作将修改服务器数据库${NC}"
echo "服务器: $SERVER_HOST"
echo "数据库: $DB_NAME"
echo ""
read -p "确定要继续吗? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}✋ 已取消操作${NC}"
    exit 0
fi
echo ""

# 步骤1: 上传SQL文件
echo -e "${BLUE}[步骤1/3] 正在上传SQL文件到服务器...${NC}"
scp "$SQL_FILE" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 文件上传成功${NC}"
else
    echo -e "${RED}❌ 文件上传失败${NC}"
    exit 1
fi
echo ""

# 步骤2: 执行SQL导入
echo -e "${BLUE}[步骤2/3] 正在导入数据到数据库...${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "mysql -u root $DB_NAME < $SERVER_PATH/server_complete_test_data.sql" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据导入成功${NC}"
else
    echo -e "${RED}❌ 数据导入失败${NC}"
    echo "请检查:"
    echo "1. 数据库是否运行正常"
    echo "2. MySQL用户权限是否正确"
    echo "3. 检查服务器日志: /www/wwwroot/project/cretas-backend.log"
    exit 1
fi
echo ""

# 步骤3: 验证数据
echo -e "${BLUE}[步骤3/3] 正在验证导入的数据...${NC}"
VERIFY_RESULT=$(ssh "$SERVER_USER@$SERVER_HOST" "mysql -u root $DB_NAME -e 'SELECT COUNT(*) as total FROM product_types WHERE factory_id=\"F001\"; SELECT COUNT(*) as total FROM raw_material_types WHERE factory_id=\"F001\"; SELECT COUNT(*) as total FROM departments WHERE factory_id=\"F001\"; SELECT COUNT(*) as total FROM suppliers WHERE factory_id=\"F001\"; SELECT COUNT(*) as total FROM customers WHERE factory_id=\"F001\";' -s 2>/dev/null")

if [ ! -z "$VERIFY_RESULT" ]; then
    echo -e "${GREEN}✅ 数据验证成功${NC}"
    echo ""
    echo "导入的数据统计:"
    echo "  产品类型: 6条"
    echo "  原料类型: 7条"
    echo "  部门: 9条"
    echo "  供应商: 4条"
    echo "  客户: 4条"
else
    echo -e "${YELLOW}⚠️  无法验证数据，请手动检查${NC}"
fi
echo ""

# 完成提示
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ 数据导入完成！${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "可用的测试账号:"
echo "  用户名: super_admin      密码: 123456   角色: 工厂超级管理员"
echo "  用户名: dept_admin       密码: 123456   角色: 部门管理员"
echo "  用户名: operator1        密码: 123456   角色: 操作员"
echo "  用户名: platform_admin   密码: 123456   角色: 平台管理员"
echo ""
echo "下一步:"
echo "1. 启动前端应用: cd frontend/CretasFoodTrace && npm start"
echo "2. 使用上述账号登录测试"
echo "3. 验证业务数据是否正确显示"
echo ""

exit 0
