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

echo "=== 停止旧进程 ==="
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2

echo "=== 启动新进程 (生产模式) ==="
nohup java -jar cretas-backend-system-1.0.0.jar \
  --spring.datasource.url=jdbc:mysql://localhost:3306/creats-test?useUnicode=true\&characterEncoding=utf8\&useSSL=false\&serverTimezone=Asia/Shanghai \
  --spring.datasource.username=creats-test \
  --spring.datasource.password=R8mwtyFEDMDPBwC8 \
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
