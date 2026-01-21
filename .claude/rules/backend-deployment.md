# 后端自动化部署规范

## 部署命令

```bash
# 本地一键部署（推荐）
./deploy-backend.sh steven

# 服务器直接部署
ssh root@139.196.165.140 "cd /www/wwwroot/cretas && ./deploy.sh steven"
```

## 部署流程

```
git push → 服务器 git pull → mvn package → 重启服务
```

## 关键配置

| 项目 | 值 |
|------|-----|
| 仓库 | github.com/j4xie/my-prototype-logistics |
| 分支 | steven |
| 服务端口 | 10010 |
| Java 版本 | 17 |
| 代码目录 | /www/wwwroot/cretas/code |
| JAR 目录 | /www/wwwroot/cretas/ |
| 日志 | /www/wwwroot/cretas/cretas-backend.log |

## 注意事项

- 数据库迁移需手动执行，不会自动运行
- 新增 Entity 字段需先执行 SQL 再部署
- 旧 JAR 自动备份为 `.bak`
