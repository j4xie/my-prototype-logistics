#!/bin/bash
# MallCenter 后端重启脚本
# 上传到服务器 /www/wwwroot/mall_admin/ 目录

cd /www/wwwroot/mall_admin

# 停止旧进程
ps aux | grep logistics-admin | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2

# 启动新进程
nohup java -jar logistics-admin.jar --server.port=8080 > mall-admin.log 2>&1 &

echo "Started with PID: $!"
echo "查看日志: tail -f /www/wwwroot/mall_admin/mall-admin.log"
