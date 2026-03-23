#!/bin/bash

# 宝塔上 AI 服务检查脚本 - 已修正路径
# 正确路径: /www/wwwroot/project/backend-ai-chat
# 在宝塔终端运行此脚本来验证 AI 服务状态和路径配置

echo "=========================================="
echo "白垩纪 AI 服务检查脚本"
echo "=========================================="
echo ""

# 正确的 AI 服务目录
AI_DIR="/www/wwwroot/project/backend-ai-chat"

# 1. 检查 AI 服务进程
echo "【1】检查 AI 服务是否运行..."
echo "---"
ps aux | grep -E 'python.*main|uvicorn' | grep -v grep

if [ $? -eq 0 ]; then
    echo "✅ AI 服务正在运行"
else
    echo "❌ AI 服务未运行"
fi
echo ""

# 2. 检查 8085 端口
echo "【2】检查 8085 端口状态..."
echo "---"
lsof -i :8085 2>/dev/null || netstat -tuln | grep 8085 2>/dev/null || echo "❌ 8085端口未被占用"
echo ""

# 3. 检查目录结构
echo "【3】检查 AI 服务目录结构..."
echo "---"

if [ -d "$AI_DIR" ]; then
    echo "✅ 目录存在: $AI_DIR"
    echo ""
    echo "目录内容："
    ls -la "$AI_DIR" | head -20
else
    echo "❌ 目录不存在: $AI_DIR"
    echo "期望位置: $AI_DIR"
fi
echo ""

# 4. 检查关键文件
echo "【4】检查关键文件..."
echo "---"
echo "检查 main.py:"
[ -f "$AI_DIR/scripts/main.py" ] && echo "✅ $AI_DIR/scripts/main.py 存在" || echo "❌ $AI_DIR/scripts/main.py 不存在"

echo "检查 requirements.txt:"
[ -f "$AI_DIR/requirements.txt" ] && echo "✅ $AI_DIR/requirements.txt 存在" || echo "❌ $AI_DIR/requirements.txt 不存在"

echo "检查 .env 文件:"
[ -f "$AI_DIR/.env" ] && echo "✅ $AI_DIR/.env 存在" || echo "❌ $AI_DIR/.env 不存在"

echo "检查虚拟环境:"
[ -d "$AI_DIR/venv" ] && echo "✅ $AI_DIR/venv 存在" || echo "❌ $AI_DIR/venv 不存在"
echo ""

# 5. 检查虚拟环境中的 Python
echo "【5】检查 Python 环境..."
echo "---"
if [ -f "$AI_DIR/venv/bin/python" ]; then
    echo "✅ 虚拟环境 Python 存在"
    echo "Python 版本:"
    "$AI_DIR/venv/bin/python" --version
else
    echo "❌ 虚拟环境 Python 不存在"
fi
echo ""

# 6. 检查依赖安装
echo "【6】检查依赖安装状态..."
echo "---"
if [ -d "$AI_DIR/venv/lib/python"* ]; then
    echo "✅ 虚拟环境库目录存在"
    echo "已安装的主要包:"
    "$AI_DIR/venv/bin/pip" list 2>/dev/null | grep -E 'fastapi|uvicorn|redis|pydantic' || echo "⚠️ 部分依赖未安装"
else
    echo "❌ 虚拟环境未初始化"
fi
echo ""

# 7. 检查日志文件
echo "【7】检查日志文件..."
echo "---"
LOGS_DIR="/www/wwwroot/project/logs"
if [ -d "$LOGS_DIR" ]; then
    echo "✅ logs 目录存在: $LOGS_DIR"
    echo "最近的日志文件:"
    ls -lrt "$LOGS_DIR" | tail -5
else
    echo "❌ logs 目录不存在: $LOGS_DIR"
fi
echo ""

# 8. 测试 API 连接
echo "【8】测试 API 连通性..."
echo "---"
if command -v curl &> /dev/null; then
    echo "测试 http://localhost:8085/"
    curl -s -m 5 http://localhost:8085/ || echo "❌ 无法连接 8085 端口"
else
    echo "⚠️ curl 命令不可用，跳过连接测试"
fi
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "AI 服务目录: $AI_DIR"
echo "日志目录: $LOGS_DIR"
