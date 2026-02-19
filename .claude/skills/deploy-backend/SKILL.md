---
name: deploy-backend
description: 全栈部署工作流。当用户说"部署"、"deploy"、"发布"、"上线"时触发。支持 Java 后端、Python 服务、Web 前端的独立或组合部署。
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# 全栈部署 Skill

## Trigger

用户说 `/deploy-backend` 或 "部署后端"、"deploy"、"发布"、"上线"。

---

## Phase 0: 解析部署目标

根据用户输入判断部署范围：

| 用户说的 | 部署目标 |
|----------|---------|
| "部署后端"、"deploy backend"、"上传JAR" | Java 后端 |
| "部署Python"、"deploy python"、"更新Python服务" | Python 服务 |
| "部署前端"、"deploy frontend"、"发布前端" | Web 前端 |
| "全部部署"、"deploy all"、"全量发布" | Java + Python + 前端 |
| "重启服务"、"restart" | 仅重启 (不构建) |
| 仅说 "部署" | 默认 Java 后端 |

如果判断不了，用 AskUserQuestion 确认：
- Java 后端 (构建+部署 JAR)
- Python 服务 (同步代码+重启)
- Web 前端 (构建+上传 dist)
- 全部

---

## 服务器信息

| 项目 | 值 |
|------|-----|
| **生产服务器** | `47.100.235.168` (8C/16GB) |
| **SSH** | `root@47.100.235.168` |
| **旧服务器** | `139.196.165.140` — 仅 Nginx 反代 + 静态文件 |

| 服务 | 端口 | 服务器 | 路径 |
|------|------|--------|------|
| Java 后端 | 10010 | 47.100.235.168 | `/www/wwwroot/cretas/` |
| Python 服务 | 8083 | 47.100.235.168 | `/www/wwwroot/cretas/code/backend/python/` |
| Web 前端 | 8088 | 47.100.235.168 | `/www/wwwroot/web-admin/` |

---

## Phase 1: Java 后端部署

### 方式 A: 一键脚本 (推荐)

```bash
./deploy-backend.sh
```

脚本自动完成：Maven 打包 → 并行上传 (GitHub 6路竞争 / SCP / OSS / R2) → 服务器备份 → 部署 → 重启 → 健康检查 (30次重试)

可选参数：
```bash
./deploy-backend.sh --jar v1.2     # 指定版本号
./deploy-backend.sh --git          # Git 部署模式 (服务器端编译)
```

### 方式 B: 手动步骤 (脚本失败时使用)

```bash
# 1. 本地构建
cd backend-java
JAVA_HOME="C:/Program Files/Java/jdk-17" ./mvnw.cmd clean package -DskipTests
cd ..

# 2. 上传 JAR
scp backend-java/target/cretas-backend-system-1.0.0.jar root@47.100.235.168:/www/wwwroot/cretas/aims-0.0.1-SNAPSHOT.jar.new

# 3. 服务器部署 (备份+替换+重启)
ssh root@47.100.235.168 << 'EOF'
cd /www/wwwroot/cretas
cp aims-0.0.1-SNAPSHOT.jar "aims-0.0.1-SNAPSHOT.jar.bak.$(date +%Y%m%d_%H%M%S)"
mv aims-0.0.1-SNAPSHOT.jar.new aims-0.0.1-SNAPSHOT.jar
bash restart.sh
EOF

# 4. 健康检查 (等待启动)
for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:10010/api/mobile/health)
  [ "$STATUS" = "200" ] && echo "OK after ${i}x2s" && break
  sleep 2
done
```

### Java 部署注意事项

- **JAR 命名**: 本地构建 `cretas-backend-system-1.0.0.jar`，服务器运行名 `aims-0.0.1-SNAPSHOT.jar`
- **Profile**: 生产环境 `--spring.profiles.active=pg-prod`
- **环境变量**: `DB_PASSWORD`, `SMARTBI_DB_PASSWORD`, `JWT_SECRET` 必须已设置在服务器上
- **启动时间**: 约 20-40 秒，健康检查需等待
- **回滚**: 备份文件 `aims-0.0.1-SNAPSHOT.jar.bak.*`，保留最近 3 份

---

## Phase 2: Python 服务部署

```bash
# 方式 A: 使用脚本
./deploy-smartbi-python.sh

# 方式 B: 手动同步
cd backend/python
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='.env' \
    --exclude='smartbi.log' --exclude='*.xlsx' --exclude='*.png' \
    -czf /tmp/python-services.tar.gz .
scp /tmp/python-services.tar.gz root@47.100.235.168:/www/wwwroot/cretas/code/backend/python/
ssh root@47.100.235.168 << 'EOF'
cd /www/wwwroot/cretas/code/backend/python
tar -xzf python-services.tar.gz && rm python-services.tar.gz
# restart.sh 会同时重启 Python
cd /www/wwwroot/cretas && bash restart.sh
EOF
rm /tmp/python-services.tar.gz
```

### Python 部署验证

```bash
curl -s http://47.100.235.168:8083/health
curl -s http://47.100.235.168:8083/docs   # FastAPI 自动文档
```

### Python 注意事项

- **restart.sh 同时管理 Java + Python**: 不需要单独重启 Python
- **虚拟环境**: 服务器使用 `/www/wwwroot/cretas/code/backend/python/venv38/`
- **依赖更新**: 如果改了 `requirements.txt`，需 SSH 进去手动 `pip install -r requirements.txt`
- **.env 不要覆盖**: 服务器有自己的 `.env` (含 LLM API Key)

---

## Phase 3: Web 前端部署

```bash
# 1. 本地构建
cd web-admin
npm run build

# 2. 上传到服务器
scp -r dist/* root@47.100.235.168:/www/wwwroot/web-admin/

# 3. 验证
curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8088/
```

### 前端注意事项

- **环境变量**: `.env.production` 中 `VITE_SMARTBI_URL=/smartbi-api` (代理路径，不是直连)
- **Nginx**: 47.100.235.168 上的 Nginx 代理 `/api/mobile/` → `localhost:10010`，`/smartbi-api/` → `localhost:8083`
- **无需重启**: 上传 dist 后 Nginx 自动生效

---

## Phase 4: 仅重启 (不构建)

```bash
# 重启全部 (Java + Python)
ssh root@47.100.235.168 "cd /www/wwwroot/cretas && bash restart.sh"

# 仅检查状态
ssh root@47.100.235.168 "ps aux | grep -E 'java|uvicorn' | grep -v grep"
```

---

## Phase 5: 部署后验证

**每次部署后必须执行的健康检查：**

```bash
# Java 后端
curl -s http://47.100.235.168:10010/api/mobile/health

# Python 服务
curl -s http://47.100.235.168:8083/health

# Web 前端
curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8088/

# 全部一起检查
echo "=== Health Check ===" && \
echo -n "Java:   " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:10010/api/mobile/health && \
echo -n "Python: " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8083/health && \
echo -n "Web:    " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8088/
```

向用户报告部署结果，包括：
1. 部署的组件
2. 健康检查状态
3. 如有失败，提供日志查看命令

---

## 故障排查

| 症状 | 排查命令 | 常见原因 |
|------|----------|---------|
| Java 启动后立即退出 | `ssh ... "tail -50 /www/wwwroot/cretas/cretas-backend.log"` | DB 密码错误、端口占用 |
| Python 500 错误 | `ssh ... "tail -50 /www/wwwroot/cretas/code/backend/python/python-services.log"` | 依赖缺失、.env 配置 |
| 前端白屏 | 浏览器 F12 Console | API 地址错误、CORS |
| 健康检查超时 | 等待 60s 后重试 | Spring Boot 冷启动慢 |
| JAR 上传 MD5 不匹配 | 重新运行 deploy-backend.sh | 网络不稳定 |

### 回滚

```bash
# Java 回滚到最近备份
ssh root@47.100.235.168 << 'EOF'
cd /www/wwwroot/cretas
LATEST_BAK=$(ls -t aims-0.0.1-SNAPSHOT.jar.bak.* 2>/dev/null | head -1)
if [ -n "$LATEST_BAK" ]; then
    cp "$LATEST_BAK" aims-0.0.1-SNAPSHOT.jar
    bash restart.sh
    echo "已回滚到: $LATEST_BAK"
fi
EOF
```

---

## 上传策略详情 (deploy-backend.sh)

**阶段1: GitHub 并行 (6路竞争，超时60秒)**

创建 GitHub Release 后，服务器同时从直连 + 5个镜像竞争下载，先到先得 + MD5 校验。

镜像: `ghproxy.cc`, `mirror.ghproxy.com`, `ghfast.top`, `gh-proxy.com`, `cf.ghproxy.cc`

**阶段2: Fallback (GitHub 超时后启动)**

| 方式 | 速度 | 依赖 |
|------|------|------|
| SCP 直传 | ~2-5 MB/s | SSH |
| SCP+gzip | ~3-8 MB/s | SSH |
| OSS 全球加速 | ~10 MB/s | ossutil |
| Cloudflare R2 | ~5-10 MB/s | aws CLI + R2 环境变量 |
