#!/bin/bash
# SmartBI Ralph Loop 启动脚本 (Linux/Mac)

echo "========================================"
echo " SmartBI Ralph Loop E2E 测试"
echo "========================================"
echo

# 检查是否安装依赖
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    npx playwright install chromium
fi

# 设置环境变量
export HEADED=true
export SLOW_MO=100

echo "Starting Ralph Loop with browser visible..."
echo "Press Ctrl+C to stop"
echo

npx ts-node ralph-loop.ts
