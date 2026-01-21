#!/bin/bash
# 一键部署后端到服务器
# 用法: ./deploy-backend.sh [branch]

BRANCH="${1:-steven}"

echo "🚀 推送代码到 GitHub..."
git push origin $BRANCH

echo "🔧 触发服务器部署..."
ssh root@139.196.165.140 "cd /www/wwwroot/cretas && ./deploy.sh $BRANCH"

echo "✅ 完成！"
