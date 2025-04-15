#!/bin/bash

echo "===== 一键Git提交工具 ====="

# 检查是否提供了提交信息
if [ -z "$1" ]; then
    echo "错误：请提供提交信息！"
    echo "用法：./git-push.sh \"你的提交信息\""
    exit 1
fi

# 保存提交信息
commit_msg="$1"

# 显示当前状态
echo
echo "当前Git状态:"
git status
echo

# 添加所有更改
echo "正在添加所有更改..."
git add .

# 提交更改
echo "正在提交更改..."
git commit -m "$commit_msg"

# 推送到远程仓库
echo "正在推送到远程仓库..."
git push

# 完成
echo
if [ $? -eq 0 ]; then
    echo "√ 成功完成所有操作！"
else
    echo "× 操作过程中出现错误，请检查上方信息。"
fi 