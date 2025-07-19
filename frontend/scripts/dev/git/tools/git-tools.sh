#!/bin/bash
# Git工具脚本 - 简化Git操作的Shell版本

# 显示帮助信息
function show_help {
  echo "Git工具脚本 - 简化Git操作"
  echo "用法: git-tools <命令> [参数]"
  echo ""
  echo "可用命令:"
  echo "  push <message>    - 添加所有更改、提交并推送"
  echo "  s                 - 查看简洁状态"
  echo "  a                 - 添加所有更改"
  echo "  c <message>       - 提交更改"
  echo "  p                 - 推送到远程仓库"
  echo "  b                 - 列出分支"
  echo "  co <branch>       - 切换分支"
  echo "  l [count]         - 查看最近提交记录"
  echo "  help              - 显示此帮助信息"
}

# 快速提交并推送
function push_changes {
  if [ -z "$1" ]; then
    echo "错误: 提交信息不能为空"
    return 1
  fi
  
  echo "添加所有更改..."
  git add .
  
  echo "提交更改: $1"
  git commit -m "$1"
  
  echo "推送到远程仓库..."
  git push
  
  echo "操作完成!"
}

# 查看简洁状态
function get_status {
  echo "当前Git状态:"
  git status -s
}

# 添加所有更改
function add_all {
  echo "添加所有更改..."
  git add .
  git status -s
}

# 提交更改
function commit_changes {
  if [ -z "$1" ]; then
    echo "错误: 提交信息不能为空"
    return 1
  fi
  
  echo "提交更改: $1"
  git commit -m "$1"
}

# 推送到远程仓库
function push_to_remote {
  echo "推送到远程仓库..."
  git push
}

# 列出分支
function list_branches {
  echo "分支列表:"
  git branch -a
}

# 切换分支
function switch_branch {
  if [ -z "$1" ]; then
    echo "错误: 分支名不能为空"
    return 1
  fi
  
  echo "切换到分支: $1"
  git checkout "$1"
}

# 查看最近提交记录
function get_log {
  local count=${1:-5}
  
  echo "最近 $count 条提交记录:"
  git log --oneline -n "$count"
}

# 主逻辑
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

command="$1"
shift
args="$*"

case "$command" in
  push)
    push_changes "$args"
    ;;
  s)
    get_status
    ;;
  a)
    add_all
    ;;
  c)
    commit_changes "$args"
    ;;
  p)
    push_to_remote
    ;;
  b)
    list_branches
    ;;
  co)
    switch_branch "$args"
    ;;
  l)
    get_log "$args"
    ;;
  help|*)
    show_help
    ;;
esac 