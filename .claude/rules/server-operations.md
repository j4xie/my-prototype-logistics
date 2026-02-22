# 服务器运维规范

**最后更新**: 2026-02-19

## 服务器架构

| 服务器 | IP | 配置 | 用途 | 状态 |
|--------|-----|------|------|------|
| **新服务器 (主)** | `47.100.235.168` | 8C/16GB/100GB | Java + Python + Web + DB | 运行中 |
| **旧服务器** | `139.196.165.140` | 4C/8GB/40GB | Nginx 反代 + web-admin 静态 | 仅代理 |

---

## 新服务器目录结构 (47.100.235.168)

```
/www/wwwroot/
├── cretas/                          # Cretas 食品溯源 (主项目)
│   ├── aims-0.0.1-SNAPSHOT.jar      # Java 后端 JAR
│   ├── restart.sh                   # 重启 Java + Python
│   ├── cretas-backend.log           # Java 日志
│   └── code/backend/python/         # Python 服务代码
├── web-admin/                       # Web 前端 (Vue dist)
└── python-services/                 # Python 独立服务 (food_kb)
```

---

## 服务管理

| 服务 | 端口 | 服务器 | 管理方式 | 命令 |
|------|------|--------|----------|------|
| Java 后端 | 10010 | 47.100.235.168 | 脚本 | `bash /www/wwwroot/cretas/restart.sh` |
| Python 服务 | 8083 | 47.100.235.168 | restart.sh 同时管理 | (同上) |
| PostgreSQL | 5432 | 47.100.235.168 | systemd | `systemctl restart postgresql` |
| Redis | 6379 | 47.100.235.168 | systemd | `systemctl restart redis` |
| Nginx | 8088 | 47.100.235.168 | systemd | `systemctl restart nginx` |

---

## 常用运维命令

```bash
# 健康检查
curl -s http://47.100.235.168:10010/api/mobile/health   # Java
curl -s http://47.100.235.168:8083/health                # Python

# 查看进程
ssh root@47.100.235.168 "ps aux | grep -E 'java|uvicorn' | grep -v grep"

# 端口监听
ssh root@47.100.235.168 "ss -tlnp | grep -E '10010|8083|5432|6379'"

# 磁盘和内存
ssh root@47.100.235.168 "df -h && echo '---' && free -h"

# 查看日志
ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/cretas-backend.log"
ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/code/backend/python/python-services.log"
```

---

## 部署规范

**部署必须使用项目内的部署脚本，禁止手动 rsync/ssh 拼命令：**

| 部署目标 | 脚本 | 说明 |
|----------|------|------|
| Java 后端 | `./deploy-backend.sh` | Maven 打包 → 并行上传 → 备份 → 部署 → 健康检查 |
| Python 服务 | `./deploy-smartbi-python.sh` | rsync 增量同步 → 安装依赖 → 重启 → 健康检查 |
| 全栈部署 | 使用 `/deploy-backend` skill | 根据指令自动选择部署范围 |

详见 `.claude/skills/deploy-backend/SKILL.md`。

---

## 注意事项

1. **不要直接删除** `/www/wwwroot` 下的目录，先确认内容
2. **备份 jar 包**会自动生成 `.bak.*` 文件，保留最近 3 份，定期清理旧的
3. **日志文件**在 `logs/` 目录，会持续增长，需定期清理
4. **数据库**: 已迁移到 PostgreSQL，不再使用 MySQL
5. **旧服务器**: 后端已停用，仅保留 Nginx 反代到新服务器
6. **文件传输使用 `rsync`，不用 `scp`** — rsync 支持增量传输、断点续传，效率更高
