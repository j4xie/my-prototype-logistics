#!/bin/bash

# 检查10010端口服务状态的脚本
# 在宝塔终端执行这些命令

echo "=========================================="
echo "  检查10010端口服务状态"
echo "=========================================="
echo ""

# 1. 检查端口是否被占用
echo "1. 检查端口10010是否被占用:"
netstat -tlnp | grep :10010 || echo "   ❌ 端口10010未被占用"
echo ""

# 2. 检查Java进程（Spring Boot应用）
echo "2. 检查Java进程:"
ps aux | grep java | grep -v grep || echo "   ❌ 未找到Java进程"
echo ""

# 3. 检查具体的Spring Boot应用进程
echo "3. 检查cretas-backend应用进程:"
ps aux | grep cretas-backend | grep -v grep || echo "   ❌ 未找到cretas-backend进程"
echo ""

# 4. 检查进程监听端口
echo "4. 检查监听10010端口的进程:"
lsof -i :10010 2>/dev/null || echo "   ❌ 未找到监听10010端口的进程"
echo ""

# 5. 测试端口连通性
echo "5. 测试端口连通性:"
curl -s -o /dev/null -w "HTTP状态码: %{http_code}\n" http://localhost:10010/api/mobile/health || echo "   ❌ 无法连接到10010端口"
echo ""

# 6. 检查应用日志（如果存在）
echo "6. 检查应用日志（最后20行）:"
if [ -f "/www/wwwroot/cretas/cretas-backend.log" ]; then
    echo "   日志文件存在，最后20行:"
    tail -n 20 /www/wwwroot/cretas/cretas-backend.log
elif [ -f "./cretas-backend.log" ]; then
    echo "   当前目录日志文件，最后20行:"
    tail -n 20 ./cretas-backend.log
else
    echo "   ⚠️  未找到日志文件"
fi
echo ""

# 7. 检查防火墙状态
echo "7. 检查防火墙状态:"
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --list-ports | grep 10010 && echo "   ✅ 防火墙已开放10010端口" || echo "   ⚠️  防火墙可能未开放10010端口"
elif command -v ufw &> /dev/null; then
    ufw status | grep 10010 && echo "   ✅ 防火墙已开放10010端口" || echo "   ⚠️  防火墙可能未开放10010端口"
else
    echo "   ⚠️  无法检查防火墙状态"
fi
echo ""

echo "=========================================="
echo "  检查完成"
echo "=========================================="


