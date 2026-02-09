#!/bin/bash
# =============================================
# 首次部署脚本 (或数据库结构同步)
# =============================================
# 使用场景:
#   1. 首次部署到新服务器
#   2. Entity 有重大变更，需要同步表结构
#
# 注意: 执行前务必备份数据库！
#   mysqldump -u root -p cretas_db > backup_$(date +%Y%m%d).sql
# =============================================

set -e

cd /www/wwwroot/project

echo "============================================="
echo "  首次部署 / 数据库同步脚本"
echo "============================================="
echo ""

# 检查备份
read -p "是否已备份数据库? (y/n): " backup_confirmed
if [ "$backup_confirmed" != "y" ]; then
    echo "请先备份数据库:"
    echo "  mysqldump -u root -p cretas_db > backup_$(date +%Y%m%d).sql"
    exit 1
fi

echo ""
echo "=== 步骤 1: 停止旧进程 ==="
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9 || true
sleep 2

echo ""
echo "=== 步骤 2: 启动服务 (ddl-auto=update) ==="
echo "这会自动同步数据库表结构..."
echo ""

nohup java -jar cretas-backend-system-1.0.0.jar \
  --spring.datasource.url=jdbc:mysql://localhost:3306/creats-test?useUnicode=true\&characterEncoding=utf8\&useSSL=false\&serverTimezone=Asia/Shanghai \
  --spring.datasource.username=creats-test \
  --spring.datasource.password=R8mwtyFEDMDPBwC8 \
  --spring.jpa.hibernate.ddl-auto=update \
  --spring.sql.init.mode=never \
  --server.port=10010 \
  > cretas-backend.log 2>&1 &

NEW_PID=$!
echo "进程已启动，PID: $NEW_PID"
echo ""

echo "=== 步骤 3: 等待启动完成 ==="
sleep 5

# 检查进程是否还在运行
if ps -p $NEW_PID > /dev/null; then
    echo "进程运行中..."
else
    echo "错误: 进程已退出，请检查日志:"
    echo "  tail -100 cretas-backend.log"
    exit 1
fi

echo ""
echo "=== 步骤 4: 验证服务 ==="
for i in {1..30}; do
    if curl -s http://localhost:10010/api/mobile/health > /dev/null 2>&1; then
        echo "服务启动成功!"
        echo ""
        echo "============================================="
        echo "  同步完成!"
        echo "============================================="
        echo ""
        echo "下一步:"
        echo "  1. 验证数据库表结构: mysql -u root -p cretas_db -e 'SHOW TABLES;'"
        echo "  2. 测试 API 功能"
        echo "  3. 确认无误后，停止服务并使用生产模式重启:"
        echo "     bash restart-prod.sh"
        echo ""
        exit 0
    fi
    echo "等待服务启动... ($i/30)"
    sleep 2
done

echo ""
echo "警告: 服务启动超时，请检查日志:"
echo "  tail -100 cretas-backend.log"
exit 1
