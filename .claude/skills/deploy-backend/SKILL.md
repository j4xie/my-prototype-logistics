---
name: deploy-backend
description: 一键部署后端到服务器。执行 git push、远程构建、重启服务。使用 /deploy-backend 快速部署。
allowed-tools:
  - Bash
---

# 部署后端

## 一键部署

```bash
./deploy-backend.sh steven
```

## 仅触发服务器部署（代码已推送）

```bash
ssh root@139.196.165.140 "cd /www/wwwroot/cretas && ./deploy.sh steven"
```

## 查看日志

```bash
ssh root@139.196.165.140 "tail -50 /www/wwwroot/cretas/cretas-backend.log"
```

## 检查服务状态

```bash
curl -s http://139.196.165.140:10010/api/mobile/auth/unified-login -X POST -H "Content-Type: application/json" -d '{"username":"factory_admin1","password":"123456"}' | head -1
```

## 配置

| 项目 | 值 |
|------|-----|
| 分支 | steven |
| 端口 | 10010 |
| 日志 | /www/wwwroot/cretas/cretas-backend.log |
