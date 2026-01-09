#!/bin/bash
# MallCenter 后端重启脚本
# 部署目录: /www/wwwroot/project/mall_center/

cd /www/wwwroot/project/mall_center

# 停止旧进程
ps aux | grep logistics-admin | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2

# 启动新进程 (使用服务器上的 JDK 17)
nohup /www/server/java/jdk-17.0.8/bin/java -jar -Xmx1024M -Xms256M logistics-admin.jar --server.port=8083 > mall.log 2>&1 &

echo "Started with PID: $!"
echo "查看日志: tail -f /www/wwwroot/project/mall_center/mall.log"
