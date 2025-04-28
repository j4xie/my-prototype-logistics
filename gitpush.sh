#!/bin/bash

# gitpush.sh - Git 快捷命令脚本 (macOS/Linux)
# 用法: ./gitpush.sh "提交信息"

# 检查是否提供了提交信息
if [ -z "$1" ]; then
  echo "错误: 请提供提交信息"
  echo "用法: ./gitpush.sh \"提交信息\""
  exit 1
fi

# 获取当前分支名称
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 添加所有更改
echo "添加所有更改..."
git add .

# 提交更改
echo "提交更改: $1"
git commit -m "$1"

# 推送到远程仓库
echo "推送到远程仓库 $BRANCH..."
git push origin $BRANCH

# 检查推送是否成功
if [ $? -eq 0 ]; then
  echo "✅ 成功推送到远程仓库"
else
  echo "❌ 推送失败，请检查错误信息"
  exit 1
fi

exit 0 