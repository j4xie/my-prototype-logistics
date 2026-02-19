#!/bin/bash
# =============================================
# 生产环境重启脚本 (宝塔服务器)
# =============================================
# 使用方法: bash restart-prod.sh
#
# 注意: 此脚本使用 --spring.profiles.active=prod
# 这会加载 application-prod.properties 配置
# 不会修改数据库表结构 (ddl-auto=validate)
# 不会执行 data.sql (sql.init.mode=never)
# =============================================

cd /www/wwwroot/project

# 从环境变量读取数据库密码
DB_PASS="${DB_PASSWORD:?请设置环境变量 DB_PASSWORD}"

echo "=== 停止旧进程 ==="
PID=$(pgrep -f "cretas-backend-system" || true)
if [ -n "$PID" ]; then
    kill "$PID"
    for i in {1..10}; do
        kill -0 "$PID" 2>/dev/null || break
        sleep 1
    done
    kill -9 "$PID" 2>/dev/null || true
fi
sleep 1

echo "=== 启动新进程 (生产模式) ==="
nohup java -jar cretas-backend-system-1.0.0.jar \
  --spring.datasource.url=jdbc:mysql://localhost:3306/creats-test?useUnicode=true\&characterEncoding=utf8\&useSSL=false\&serverTimezone=Asia/Shanghai \
  --spring.datasource.username=creats-test \
  --spring.datasource.password="$DB_PASS" \
  --spring.jpa.hibernate.ddl-auto=validate \
  --spring.sql.init.mode=never \
  --server.port=10010 \
  > cretas-backend.log 2>&1 &

echo "Started with PID: $!"
echo ""
echo "=== 生产环境配置 ==="
echo "- ddl-auto: validate (不修改表结构)"
echo "- sql.init.mode: never (不执行data.sql)"
echo "- logging: INFO/WARN 级别"
echo ""
echo "查看日志: tail -f cretas-backend.log"
