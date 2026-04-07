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

### 双环境 (生产 + 测试)

| 服务 | 生产端口 | 测试端口 | 路径 |
|------|----------|----------|------|
| Java 后端 | 10010 | 10011 | `/www/wwwroot/cretas/` |
| Python 服务 | 8083 | 8084 | `/www/wwwroot/cretas/code/backend/python/` |
| Web 前端 | 8088 | - | `/www/wwwroot/web-admin/` |

| 环境 | 主库 | SmartBI 库 |
|------|------|-----------|
| 生产 | `cretas_prod_db` | `smartbi_prod_db` |
| 测试 | `cretas_db` | `smartbi_db` |

两套环境**共享同一份 JAR**, 通过环境变量区分数据库. 但**进程独立** — 默认 `--env prod` 不会重启 test, **test 容易长期落后甚至宕机不被察觉** (Apr 7 教训).

**推荐工作流**:
```bash
./scripts/deploy/deploy-backend.sh --env test       # 先部 test
# smoke test 验证
./scripts/deploy/deploy-backend.sh --env prod       # 满意后部 prod
```

紧急 hotfix: `--env all` 一次部两套. v4.2 已加防御 ping (部 prod 后顺便 ping test, 反之亦然).

---

## Phase 1: Java 后端部署

### 方式 A: 一键脚本 (推荐, ~2 分钟)

```bash
./scripts/deploy/deploy-backend.sh                  # 部署到生产 (默认)
./scripts/deploy/deploy-backend.sh --env test       # 部署到测试
./scripts/deploy/deploy-backend.sh --env all        # 部署后重启两套
```

脚本 v4.2 自动完成: Maven 打包 → 检测 private repo / rsync / OSS / R2 通道可用性 → 并行上传 → 服务器备份 → 部署 → 重启 → 健康检查 (30次重试) + **防御 ping 另一环境**.

可选参数:
```bash
./scripts/deploy/deploy-backend.sh --jar v1.2             # 指定版本号
./scripts/deploy/deploy-backend.sh --git                  # Git 部署 (服务器端编译, 用于本地无 mvn 时)
./scripts/deploy/deploy-backend.sh --rollback             # 回滚到上一个备份
```

### 环境变量 (deploy script 启动时自动 source ~/.bashrc)

| 变量 | 作用 |
|---|---|
| `SKIP_RSYNC=1` | 永久禁用 rsync 通道 (本地 SSH 双向 stream 被 RST) |
| `SKIP_BUILD=1` | 跳过 Maven 打包 (用 target/ 已有 jar) |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/PUBLIC_URL` | 启用 R2 备份通道 |

R2 凭证存在 `~/.r2-env` (NTFS ACL chmod 600), `~/.bashrc` source 它.

### 方式 B: 服务器自编译 (本地 mvn 不可用 / target 锁定时)

```bash
# 1. 把 patch 推到服务器
git diff backend/java/cretas-api/ | ssh root@47.100.235.168 \
  "cat > /tmp/p.patch && cd /www/wwwroot/cretas/code && git apply /tmp/p.patch"

# 2. 服务器编译 (注意 JAVA_HOME 必须是 21, 默认 javac 是 17!)
ssh root@47.100.235.168 "
  export JAVA_HOME=/usr/lib/jvm/java-21-alibaba-dragonwell-21.0.5.0.5-1.1.al8.x86_64
  export PATH=\$JAVA_HOME/bin:\$PATH
  cd /www/wwwroot/cretas/code/backend/java/cretas-api
  mvn clean package -Dmaven.test.skip=true -q
"

# 3. 替换 jar + 重启 + cleanup patch
ssh root@47.100.235.168 "
  cd /www/wwwroot/cretas
  cp aims-0.0.1-SNAPSHOT.jar aims-0.0.1-SNAPSHOT.jar.bak.\$(date +%Y%m%d_%H%M%S)
  cp code/backend/java/cretas-api/target/cretas-backend-system-1.0.0.jar aims-0.0.1-SNAPSHOT.jar
  systemctl restart cretas-backend
  cd code && git checkout -- backend/java/cretas-api/
"
```

### Java 部署注意事项

- **JAR 命名**: 本地构建 `cretas-backend-system-1.0.0.jar`, 服务器运行名 `aims-0.0.1-SNAPSHOT.jar`
- **JAVA_HOME**: 本地 Zulu 21 (`C:/Program Files/Zulu/zulu-21`), 服务器 Dragonwell 21 (默认 javac 是 17, 必须显式 export)
- **Test 编译会失败**: `ProcessWorkReportingServiceImplTest` 方法签名不匹配, 必须用 `-Dmaven.test.skip=true` (不能用 `-DskipTests`, 后者只跳执行不跳编译)
- **Profile**: 生产 `pg-prod`, 测试 `pg`
- **环境变量**: `DB_PASSWORD`, `SMARTBI_DB_PASSWORD`, `JWT_SECRET` 在服务器 `.env.prod` (systemd EnvironmentFile)
- **启动时间**: prod ~20s, test ~75s (768MB 堆 GC 频繁)
- **回滚**: `--rollback` 自动恢复最近 timestamp 备份

### ⚠️ 本地 Java 启动方式 (CRITICAL)

**用 `mvn spring-boot:run` 启动本地后端, 不要用 `java -jar`**!

`java -jar fat-jar` 会 mmap 锁定 jar 文件 → mvn package 的 repackage 阶段无法 rename → **deploy 必失败**.

```bash
cd backend/java/cretas-api && \
DB_PASSWORD=cretas_pass POSTGRES_SMARTBI_PASSWORD=smartbi_pass \
JAVA_HOME="C:/Program Files/Zulu/zulu-21" \
SPRING_PROFILES_ACTIVE=pg,dev SPRING_JPA_HIBERNATE_DDL_AUTO=none \
SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/cretas_db?sslmode=disable" \
SERVER_PORT=10010 \
./mvnw.cmd spring-boot:run -Dmaven.test.skip=true \
  -Dspring-boot.run.jvmArguments="-Xms512m -Xmx1280m"
```

代价: 内存 ~3.2GB (vs java -jar 1.3GB), 启动 ~75s (vs 15s). 但 JVM 加载完类后不持有 .class file handle, mvn clean package 可同时跑.

---

## Phase 2: Python 服务部署

```bash
# 方式 A: 使用脚本
./scripts/deploy/deploy-smartbi-python.sh                # 部署到生产 (默认)
./scripts/deploy/deploy-smartbi-python.sh --env test     # 部署到测试
./scripts/deploy/deploy-smartbi-python.sh --env all      # 部署后重启两套
```

### Python 部署验证

```bash
curl -s http://47.100.235.168:8083/health    # 生产
curl -s http://47.100.235.168:8084/health    # 测试
```

### Python 注意事项

- **两套 Python 共享代码目录**: rsync 一次，通过环境变量区分数据库
- **虚拟环境**: 服务器使用 `/www/wwwroot/cretas/code/backend/python/venv38/`
- **依赖更新**: 脚本自动 `pip install -r requirements.txt`
- **.env 不要覆盖**: 服务器有自己的 `.env` (含 LLM API Key)

---

## Phase 3: Web 前端部署

```bash
# 1. 本地构建
cd web-admin
npm run build

# 2. 上传到服务器
rsync -az --delete dist/ root@47.100.235.168:/www/wwwroot/web-admin/

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
# 重启全部 (生产+测试, Java+Python)
ssh root@47.100.235.168 "cd /www/wwwroot/cretas && bash restart.sh all"

# 仅重启生产
ssh root@47.100.235.168 "cd /www/wwwroot/cretas && bash restart.sh prod"

# 仅重启测试
ssh root@47.100.235.168 "cd /www/wwwroot/cretas && bash restart.sh test"

# 仅检查状态
ssh root@47.100.235.168 "ps aux | grep -E 'java|uvicorn' | grep -v grep"
```

---

## Phase 5: 部署后验证

**每次部署后必须执行的健康检查：**

```bash
# 生产环境
curl -s http://47.100.235.168:10010/api/mobile/health   # Java 生产
curl -s http://47.100.235.168:8083/health                # Python 生产

# 测试环境
curl -s http://47.100.235.168:10011/api/mobile/health   # Java 测试
curl -s http://47.100.235.168:8084/health                # Python 测试

# Web 前端
curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8088/

# 全部一起检查
echo "=== Health Check ===" && \
echo -n "Java Prod:   " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:10010/api/mobile/health && echo "" && \
echo -n "Java Test:   " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:10011/api/mobile/health && echo "" && \
echo -n "Python Prod: " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8083/health && echo "" && \
echo -n "Python Test: " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8084/health && echo "" && \
echo -n "Web:         " && curl -s -o /dev/null -w "%{http_code}" http://47.100.235.168:8088/
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

## 上传策略详情 (deploy-backend.sh v4.2)

### 实测速度 (Apr 7 2026)

| 通道 | 实测速度 | 启用条件 | 当前状态 |
|---|---|---|---|
| OSS 加速 | **6 MB/s (并行竞争时)** | `~/.ossutilconfig` 有效 (账号 B) | ✅ 主力 |
| OSS 加速 (单连接) | 1.7 MB/s | 同上 | |
| Cloudflare R2 | 1.5 MB/s | `R2_*` 环境变量 (`~/.r2-env`) | ✅ 备份 |
| ~~rsync~~ | 60 KB/s + 经常 RST | `SKIP_RSYNC=1` | ❌ 永久禁用 |
| ~~GitHub 镜像~~ | 永远失败 (9 字节 "Not Found") | private repo | ❌ 自动跳过 |

### 关键事实

**`cretas-media` bucket 属于阿里云账号 B** (LTAI5tGjGs6...), 不是账号 A. 账号 A key 报 `AccessDenied`.

**Private repo 让 GitHub 镜像全失效**: ghproxy.cc / ghfast.top / cf.ghproxy.cc 等都是公共代理, curl 无 token, GitHub 对 release asset 返回 9 字节 `Not Found` 文本 (HTTP 200, 不是 404), 三个镜像 MD5 完全一致 = `9d1ead73e678fa2f51a70a933b0bf017`. v4.2 用 `gh api repos/$REPO --jq .private` 检测自动跳过.

### 阶段流程

**阶段 1**: GitHub 并行 (private repo 自动跳过, public repo 时直连+5镜像 60s 超时)

**阶段 2**: Fallback (按 HAS_xxx 检测启动)
- OSS 加速 (有 ossutil) → 上传到 oss-accelerate.aliyuncs.com → 服务器走内网 oss-cn-shanghai-internal 下载 (~100 MB/s)
- R2 (有 aws CLI + R2_*) → 上传到 R2 → 服务器走 r2.dev public URL 下载

**阶段 3**: 服务器 MD5 验证 + 备份 + 替换 + systemctl restart + 健康检查

**阶段 4**: 防御性 ping 另一环境 (DEPLOY_ENV=prod 时 ping test, 反之亦然)

### 健康检查 + 防御 ping

部署完显示:
```
🔍 [4/4] 验证部署...
   [生产] 检查 10010...
   ✓ 服务正常 (HTTP 200, 等待 16s)
   ✓ [防御检查] test 10011 同步运行
```

如果另一环境挂了:
```
   ⚠️  [防御检查] test 10011 异常 (HTTP 000)
      恢复: ssh root@47.100.235.168 'cd /www/wwwroot/cretas && bash restart.sh test'
      或下次用: ./scripts/deploy/deploy-backend.sh --env all
```

详见 memory `feedback_deploy_pipeline.md`.
