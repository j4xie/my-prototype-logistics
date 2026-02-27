# 服务器运维规范

**最后更新**: 2026-02-28

## 服务器架构

| 服务器 | IP | 配置 | 用途 | 状态 |
|--------|-----|------|------|------|
| **新服务器 (主)** | `47.100.235.168` | 8C/16GB/100GB | Java + Python + DB | 运行中 |
| **旧服务器 (网关)** | `139.196.165.140` | 4C/8GB/40GB | Nginx 网关 + Web-Admin + Showcase 静态站 | 运行中 |

### 内容分布 — 禁止搞混

| 内容 | 所在服务器 | 路径 | 域名 |
|------|-----------|------|------|
| Java 后端 | **47** (新) | `/www/wwwroot/cretas/` | `47.100.235.168:10010` |
| Python 服务 | **47** (新) | `/www/wwwroot/cretas/code/backend/python/` | `47.100.235.168:8083` |
| PostgreSQL / Redis | **47** (新) | systemd 管理 | localhost only |
| **Web-Admin 前端** | **139** (网关) | `/www/wwwroot/web-admin/` | `139.196.165.140:8086` |
| **Showcase 展示站** | **139** (网关) | `/www/wwwroot/showcase/cretaceousfuture/` | `www.cretaceousfuture.com` |
| Nginx 网关 | **139** (网关) | 宝塔 Nginx | API→47, Python→47 |

**关键规则**: Showcase 相关文件（HTML、截图、CSS）只部署到 **139**，不要传到 47。

### 本地目录 → 服务器路径映射

| 本地目录 | 部署目标 | 服务器路径 |
|---------|---------|-----------|
| `platform/` | **139** (旧) | `/www/wwwroot/showcase/cretaceousfuture/` |
| `backend/java/cretas-api/` | **47** (新) | `/www/wwwroot/cretas/` |
| `backend/python/` | **47** (新) | `/www/wwwroot/cretas/code/backend/python/` |
| `web-admin/` | **139** (网关) | `/www/wwwroot/web-admin/` |

**`platform/` 目录说明**: 包含 www.cretaceousfuture.com 网站的全部内容 — 主站页面 + showcase 演示子页 (factorybi-example, client-request-example, restaurantbi-example)。

---

## 双环境 (生产 + 测试)

同一台服务器运行两套独立环境，共享 JAR 和 Python 代码，通过环境变量区分数据库。

| 服务 | 生产端口 | 测试端口 |
|------|----------|----------|
| Java 后端 | **10010** | **10011** |
| Python 服务 | **8083** | **8084** |
| PostgreSQL | 5432 (共享) | 5432 (共享) |

| 环境 | 主库 | SmartBI 库 | 启动脚本 |
|------|------|-----------|----------|
| 生产 | `cretas_prod_db` | `smartbi_prod_db` | `restart-prod.sh` |
| 测试 | `cretas_db` | `smartbi_db` | `restart-test.sh` |

### 启动命令

```bash
bash restart.sh           # 启动两套 (默认)
bash restart.sh prod      # 仅生产
bash restart.sh test      # 仅测试
```

### 日志文件

| 环境 | Java 日志 | Python 日志 |
|------|-----------|-------------|
| 生产 | `cretas-prod.log` | `python-prod.log` |
| 测试 | `cretas-test.log` | `python-test.log` |

---

## 新服务器目录结构 (47.100.235.168)

```
/www/wwwroot/
├── cretas/                          # Cretas 食品溯源 (主项目)
│   ├── aims-0.0.1-SNAPSHOT.jar      # Java 后端 JAR (两套共享)
│   ├── .env.prod                    # 生产环境变量 (DB密码/JWT/LLM Key)
│   ├── restart.sh                   # 入口: 调用 prod + test
│   ├── restart-prod.sh              # 生产环境启动 (systemd 版)
│   ├── restart-test.sh              # 测试环境启动 (10011+8084)
│   ├── cretas-prod.log              # 生产 Java 日志
│   ├── cretas-test.log              # 测试 Java 日志
│   ├── embedding-service/           # gRPC 向量嵌入服务
│   │   ├── embedding-service-1.0.0.jar
│   │   └── embedding-service.log
│   ├── models/                      # ONNX 模型文件
│   │   └── gte-base-zh-finetuned-onnx-fixed/
│   └── code/backend/python/         # Python 服务代码 (两套共享)
├── web-admin/                       # Web 前端 (Vue dist)
└── python-services/                 # Python 独立服务 (food_kb)
```

---

## 服务管理 (systemd)

**生产环境所有服务均由 systemd 管理，开机自启 + 崩溃自动重启。**

| 服务 | 端口 | systemd 服务名 | 状态 |
|------|------|---------------|------|
| gRPC Embedding | 9090 | `cretas-embedding` | enabled |
| Java 后端 | 10010 | `cretas-backend` | enabled |
| Python 服务 | 8083 | `cretas-python` | enabled |
| Redis | 6379 | `redis` | enabled |
| PostgreSQL | 5432 | `postgresql` | enabled |

### 启动依赖链

```
redis(6379) ─┐
postgresql ──┤
              ├─ cretas-embedding(9090) ─→ cretas-backend(10010)
              └─ cretas-python(8083)
```

Java 后端依赖 Embedding 服务 (`After=cretas-embedding.service`)。

### systemd 配置文件

| 文件 | 位置 |
|------|------|
| `cretas-embedding.service` | `/etc/systemd/system/` |
| `cretas-backend.service` | `/etc/systemd/system/` — 使用 `EnvironmentFile=/www/wwwroot/cretas/.env.prod` |
| `cretas-python.service` | `/etc/systemd/system/` — 环境变量内联 |

### 常用管理命令

```bash
# 查看状态
systemctl status cretas-backend cretas-python cretas-embedding

# 重启单个服务
systemctl restart cretas-backend

# 重启全部生产服务 (按依赖顺序)
bash /www/wwwroot/cretas/restart.sh prod

# 实时日志
journalctl -u cretas-backend -f

# 测试环境 (仍使用脚本管理)
bash /www/wwwroot/cretas/restart.sh test
```

### 环境变量管理

- 生产环境变量集中在 `/www/wwwroot/cretas/.env.prod` (权限 600)
- Java 服务通过 `EnvironmentFile` 引用
- Python 服务通过 `Environment=` 内联（含 LLM 模型分配）
- **修改模型配置后**需同时更新 systemd service 文件和 `.env.prod`，然后 `systemctl daemon-reload`

---

## 常用运维命令

```bash
# 健康检查
curl -s http://47.100.235.168:10010/api/mobile/health   # 生产 Java
curl -s http://47.100.235.168:10011/api/mobile/health   # 测试 Java
curl -s http://47.100.235.168:8083/health                # 生产 Python
curl -s http://47.100.235.168:8084/health                # 测试 Python

# systemd 状态
ssh root@47.100.235.168 "systemctl status cretas-backend cretas-python cretas-embedding --no-pager"

# 端口监听 (含 9090 Embedding)
ssh root@47.100.235.168 "ss -tlnp | grep -E '10010|10011|8083|8084|9090|6379'"

# 磁盘和内存
ssh root@47.100.235.168 "df -h && echo '---' && free -h"

# 查看日志
ssh root@47.100.235.168 "tail -100 /www/wwwroot/cretas/cretas-prod.log"
ssh root@47.100.235.168 "journalctl -u cretas-backend --since '5 min ago' --no-pager"
```

---

## 部署规范

**部署必须使用项目内的部署脚本，禁止手动 rsync/ssh 拼命令：**

| 部署目标 | 脚本 | 说明 |
|----------|------|------|
| Java 后端 | `./deploy-backend.sh [--env prod\|test\|all]` | Maven 打包 → 并行上传 → 备份 → 部署 → 健康检查 |
| Python 服务 | `./deploy-smartbi-python.sh [--env prod\|test\|all]` | rsync 增量同步 → 安装依赖 → 重启 → 健康检查 |
| 全栈部署 | 使用 `/deploy-backend` skill | 根据指令自动选择部署范围 |

`--env` 默认 `prod`，只更新生产环境。

详见 `.claude/skills/deploy-backend/SKILL.md`。

---

## 注意事项

1. **不要直接删除** `/www/wwwroot` 下的目录，先确认内容
2. **备份 jar 包**会自动生成 `.bak.*` 文件，保留最近 3 份，定期清理旧的
3. **日志文件**在 `logs/` 目录，会持续增长，需定期清理
4. **数据库**: 已迁移到 PostgreSQL，不再使用 MySQL
5. **旧服务器 (139)**: 后端已停用，仅保留 Nginx 反代 + **Showcase 静态站** (www.cretaceousfuture.com)
6. **Showcase 只部署到 139**: 不要向 47 传 showcase 文件，47 是纯后端服务器
7. **文件传输使用 `rsync`，不用 `scp`** — rsync 支持增量传输、断点续传，效率更高
8. **两套环境共享 JAR + Python 代码**: 部署一次代码后按需重启对应环境
9. **修改 systemd 服务文件后**: 必须 `systemctl daemon-reload` 再 `systemctl restart <service>`
10. **生产环境变量**: 集中在 `.env.prod`，修改后需重启对应服务才生效
