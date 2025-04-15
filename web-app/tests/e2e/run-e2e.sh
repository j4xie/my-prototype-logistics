#!/bin/bash

echo "食品溯源系统 - 端到端测试启动脚本"
echo "--------------------------------------"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 运行测试脚本
node "$SCRIPT_DIR/run-e2e-tests.js" "$@"

# 显示结束信息
echo "--------------------------------------"
echo "测试运行结束" 