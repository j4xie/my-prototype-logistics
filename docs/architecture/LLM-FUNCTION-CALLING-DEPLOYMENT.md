# LLM Function Calling 部署指南

## 文档信息

| 属性 | 值 |
|------|-----|
| 文档版本 | v1.0.0 |
| 创建日期 | 2026-01-06 |
| 目标读者 | 运维人员、DevOps 工程师 |
| 环境 | 生产环境、测试环境 |

---

## 目录

1. [环境要求](#1-环境要求)
2. [配置项说明](#2-配置项说明)
3. [部署步骤](#3-部署步骤)
4. [性能优化](#4-性能优化)
5. [监控配置](#5-监控配置)
6. [故障排查](#6-故障排查)
7. [回滚方案](#7-回滚方案)

---

## 1. 环境要求

### 1.1 基础环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Java | 11+ | 推荐使用 JDK 11 或 17 |
| Spring Boot | 2.7.15+ | 当前项目版本 |
| MySQL | 8.0+ | 数据库 |
| Redis | 6.0+ | 缓存（可选） |
| 内存 | 2GB+ | 推荐 4GB |
| CPU | 2核+ | 推荐 4核 |

### 1.2 依赖服务

| 服务 | 用途 | 是否必需 |
|------|------|----------|
| LLM API | AI 推理服务 | ✅ 必需 |
| MySQL | 数据存储 | ✅ 必需 |
| Redis | 缓存加速 | ❌ 可选 |
| 日志服务 | 日志聚合 | ❌ 推荐 |
| 监控服务 | 性能监控 | ❌ 推荐 |

### 1.3 网络要求

- **出站**: 需要访问 LLM API 服务
- **端口**: 默认 10010（可配置）
- **防火墙**: 确保 LLM API 域名可访问

---

## 2. 配置项说明

### 2.1 核心配置

**application.properties**:

```properties
# ===================================
# LLM Function Calling 配置
# ===================================

# Tool 执行超时（毫秒）
tool.execution.timeout=30000

# 是否启用 Tool Calling 功能
tool.calling.enabled=true

# Tool 执行线程池配置
tool.executor.thread.pool.core-size=5
tool.executor.thread.pool.max-size=20
tool.executor.thread.pool.queue-capacity=100

# Tool 执行结果缓存（秒，0=禁用）
tool.execution.cache.ttl=300
```

### 2.2 LLM API 配置

```properties
# ===================================
# LLM API 配置
# ===================================

# LLM API 配置
llm.api.key=${AI_API_KEY}
llm.api.url=${LLM_API_URL}
llm.api.timeout=60000
llm.api.model=llm-chat

# LLM Function Calling 模式
llm.function.calling.mode=auto
# 可选值:
# - auto: LLM 自动决定是否调用工具
# - required: 强制 LLM 调用工具
# - none: 禁用工具调用
```

### 2.3 权限配置

```properties
# ===================================
# Tool 权限配置
# ===================================

# 是否启用全局权限检查
tool.permission.enabled=true

# 超级管理员角色列表（逗号分隔）
tool.permission.super-admin-roles=super_admin,platform_admin

# 工具白名单（逗号分隔工具名称，空=允许所有）
tool.whitelist=

# 工具黑名单（逗号分隔工具名称）
tool.blacklist=
```

### 2.4 日志配置

```properties
# ===================================
# 日志配置
# ===================================

# Tool 执行日志级别
logging.level.com.cretas.aims.ai.tool=INFO

# Tool Registry 日志级别
logging.level.com.cretas.aims.ai.tool.ToolRegistry=INFO

# 详细调试日志（开发环境）
# logging.level.com.cretas.aims.ai.tool=DEBUG
```

### 2.5 性能配置

```properties
# ===================================
# 性能优化配置
# ===================================

# JPA 批量操作大小
spring.jpa.properties.hibernate.jdbc.batch_size=20

# 数据库连接池配置
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000

# Redis 连接池配置（如启用）
spring.redis.lettuce.pool.max-active=10
spring.redis.lettuce.pool.max-idle=5
spring.redis.lettuce.pool.min-idle=2
```

---

## 3. 部署步骤

### 3.1 环境准备

#### Step 1: 检查环境

```bash
# 检查 Java 版本
java -version
# 输出: openjdk version "11.0.x" 或更高

# 检查 MySQL 连接
mysql -h localhost -u root -p -e "SELECT VERSION();"

# 检查端口可用性
lsof -i :10010
# 应该无输出（端口未被占用）
```

#### Step 2: 创建数据库

```sql
-- 如果数据库不存在，创建数据库
CREATE DATABASE IF NOT EXISTS cretas_aims
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 验证字符集
SHOW CREATE DATABASE cretas_aims;
```

#### Step 3: 配置环境变量

**Linux/macOS**:
```bash
# 编辑 ~/.bashrc 或 ~/.zshrc
export AI_API_KEY="sk-your-llm-api-key"
export JWT_SECRET="your-jwt-secret-key"
export ALIBABA_ACCESSKEY_ID="your-aliyun-access-key"
export ALIBABA_SECRET_KEY="your-aliyun-secret-key"

# 应用配置
source ~/.bashrc
```

**宝塔面板**:
```
启动参数添加:
-DJAI_API_KEY=sk-xxx
-DJWT_SECRET=xxx
-DALIBABA_ACCESSKEY_ID=xxx
-DALIBABA_SECRET_KEY=xxx
```

### 3.2 构建应用

#### Step 1: 拉取代码

```bash
cd /www/wwwroot/cretas
git pull origin main
```

#### Step 2: 构建 JAR 包

```bash
cd backend-java
mvn clean package -DskipTests

# 验证 JAR 包
ls -lh target/*.jar
# 输出: cretas-aims-1.0.0.jar (约 80MB)
```

### 3.3 部署到服务器

#### 方式一: 本地构建 + SCP 上传

```bash
# 本地构建
cd backend-java
mvn clean package -DskipTests

# 上传到服务器
scp target/cretas-aims-1.0.0.jar root@139.196.165.140:/www/wwwroot/cretas/

# SSH 到服务器重启
ssh root@139.196.165.140 "bash /www/wwwroot/cretas/restart.sh"
```

#### 方式二: 服务器端构建

```bash
# SSH 到服务器
ssh root@139.196.165.140

# 进入项目目录
cd /www/wwwroot/cretas/backend-java

# 拉取代码
git pull origin main

# 构建
mvn clean package -DskipTests

# 重启服务
bash /www/wwwroot/cretas/restart.sh
```

### 3.4 启动服务

#### 使用 restart.sh 脚本

```bash
#!/bin/bash
# /www/wwwroot/cretas/restart.sh

APP_NAME="cretas-aims"
JAR_FILE="/www/wwwroot/cretas/cretas-aims-1.0.0.jar"
LOG_FILE="/www/wwwroot/cretas/logs/app.log"

# 停止旧进程
PID=$(ps -ef | grep $APP_NAME | grep -v grep | awk '{print $2}')
if [ -n "$PID" ]; then
    echo "Stopping $APP_NAME (PID: $PID)..."
    kill -15 $PID
    sleep 5
fi

# 启动新进程
echo "Starting $APP_NAME..."
nohup java -jar \
  -Xms1024m -Xmx2048m \
  -Dspring.profiles.active=prod \
  -DAI_API_KEY=$AI_API_KEY \
  -DJWT_SECRET=$JWT_SECRET \
  $JAR_FILE \
  > $LOG_FILE 2>&1 &

# 等待启动
sleep 10

# 检查启动状态
if ps -ef | grep $APP_NAME | grep -v grep > /dev/null; then
    echo "$APP_NAME started successfully"
    tail -n 20 $LOG_FILE
else
    echo "$APP_NAME failed to start"
    exit 1
fi
```

### 3.5 验证部署

#### Step 1: 检查服务状态

```bash
# 检查进程
ps -ef | grep cretas-aims | grep -v grep

# 检查端口
lsof -i :10010
# 输出: java ... *:10010 (LISTEN)
```

#### Step 2: 健康检查

```bash
# 调用健康检查接口
curl http://localhost:10010/api/mobile/health

# 预期输出:
# {
#   "status": "UP",
#   "version": "1.0.0",
#   "timestamp": "2026-01-06T12:00:00Z"
# }
```

#### Step 3: 检查 Tool 注册

```bash
# 查看启动日志
tail -n 100 /www/wwwroot/cretas/logs/app.log | grep "Tool Registry"

# 预期输出:
# ✅ 注册工具: name=create_new_intent, class=CreateIntentTool
# ✅ 注册工具: name=query_entity_schema, class=QueryEntitySchemaTool
# 🔧 Tool Registry 初始化完成，共注册 2 个工具
```

#### Step 4: 功能测试

```bash
# 测试 AI 意图执行（触发 Tool Calling）
curl -X POST http://localhost:10010/api/mobile/F001/ai-intents/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userInput": "查询 MaterialBatch 的字段结构"
  }'

# 预期包含:
# - "status": "COMPLETED"
# - "message": 包含实体字段信息
```

---

## 4. 性能优化

### 4.1 JVM 优化

**推荐 JVM 参数**:
```bash
java -jar \
  -Xms1024m \
  -Xmx2048m \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:ParallelGCThreads=4 \
  -XX:ConcGCThreads=1 \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/www/wwwroot/cretas/logs/heapdump.hprof \
  cretas-aims-1.0.0.jar
```

**参数说明**:
- `-Xms1024m`: 初始堆内存 1GB
- `-Xmx2048m`: 最大堆内存 2GB
- `-XX:+UseG1GC`: 使用 G1 垃圾回收器
- `-XX:MaxGCPauseMillis=200`: 最大 GC 暂停时间 200ms
- `-XX:+HeapDumpOnOutOfMemoryError`: OOM 时生成堆转储

### 4.2 数据库优化

**索引优化**:
```sql
-- ai_intent_config 表索引
CREATE INDEX idx_factory_active ON ai_intent_config(factory_id, active);
CREATE INDEX idx_intent_code ON ai_intent_config(intent_code);
CREATE INDEX idx_category ON ai_intent_config(intent_category);

-- 验证索引
SHOW INDEX FROM ai_intent_config;
```

**连接池配置**:
```properties
# HikariCP 配置
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.connection-test-query=SELECT 1
```

### 4.3 缓存配置

**启用 Redis 缓存** (可选):

```properties
# Redis 配置
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=
spring.redis.database=0
spring.redis.timeout=5000

# 缓存配置
spring.cache.type=redis
spring.cache.redis.time-to-live=300000
spring.cache.redis.cache-null-values=false
```

**启用本地缓存** (默认):
```properties
spring.cache.type=caffeine
spring.cache.caffeine.spec=maximumSize=1000,expireAfterWrite=300s
```

### 4.4 线程池优化

```properties
# Tool 执行线程池
tool.executor.thread.pool.core-size=5
tool.executor.thread.pool.max-size=20
tool.executor.thread.pool.queue-capacity=100
tool.executor.thread.pool.keep-alive-seconds=60

# Tomcat 线程池
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=10
server.tomcat.accept-count=100
server.tomcat.max-connections=8192
```

---

## 5. 监控配置

### 5.1 日志监控

**日志文件位置**:
```
/www/wwwroot/cretas/logs/
├── app.log              # 应用主日志
├── error.log            # 错误日志
├── tool-execution.log   # Tool 执行日志
└── access.log           # 访问日志
```

**日志配置** (logback-spring.xml):
```xml
<configuration>
    <!-- Tool 执行日志 -->
    <appender name="TOOL_EXECUTION" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>/www/wwwroot/cretas/logs/tool-execution.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>/www/wwwroot/cretas/logs/tool-execution.%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <logger name="com.cretas.aims.ai.tool" level="INFO" additivity="false">
        <appender-ref ref="TOOL_EXECUTION"/>
    </logger>
</configuration>
```

### 5.2 性能监控

**关键监控指标**:

| 指标名称 | 类型 | 说明 | 告警阈值 |
|----------|------|------|----------|
| `tool.execution.count` | Counter | Tool 执行次数 | - |
| `tool.execution.success.rate` | Gauge | 成功率 | < 95% |
| `tool.execution.duration` | Histogram | 执行耗时 | P99 > 1s |
| `tool.permission.denied.count` | Counter | 权限拒绝次数 | > 10/min |
| `tool.registry.size` | Gauge | 已注册工具数 | < 2 |
| `jvm.memory.used` | Gauge | JVM 内存使用 | > 80% |
| `http.requests.duration` | Histogram | HTTP 请求耗时 | P99 > 3s |

**使用 Micrometer + Prometheus**:

```xml
<!-- pom.xml -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```properties
# application.properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.metrics.export.prometheus.enabled=true
```

**Prometheus 抓取配置**:
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cretas-aims'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:10010']
```

### 5.3 告警配置

**Prometheus 告警规则** (alerts.yml):
```yaml
groups:
  - name: cretas_tools
    rules:
      # Tool 执行成功率低于 95%
      - alert: ToolExecutionLowSuccessRate
        expr: rate(tool_execution_success_total[5m]) / rate(tool_execution_count_total[5m]) < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tool 执行成功率过低"
          description: "Tool 执行成功率: {{ $value | humanizePercentage }}"

      # Tool 执行耗时 P99 超过 1 秒
      - alert: ToolExecutionHighLatency
        expr: histogram_quantile(0.99, rate(tool_execution_duration_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tool 执行耗时过高"
          description: "P99 耗时: {{ $value }}s"

      # JVM 内存使用率超过 80%
      - alert: HighMemoryUsage
        expr: jvm_memory_used_bytes / jvm_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "JVM 内存使用率过高"
          description: "内存使用率: {{ $value | humanizePercentage }}"
```

---

## 6. 故障排查

### 6.1 常见问题

#### 问题 1: Tool 未注册

**症状**:
```
⚠️  未找到任何 ToolExecutor 实现，Tool Calling 功能将不可用
```

**排查步骤**:
1. 检查 Tool 类是否有 `@Component` 注解
2. 检查 Tool 类是否在扫描路径下
3. 检查 `isEnabled()` 是否返回 `true`

**解决方法**:
```java
@Component  // ← 确保有此注解
public class MyTool extends AbstractTool {
    @Override
    public boolean isEnabled() {
        return true;  // ← 确保返回 true
    }
}
```

#### 问题 2: LLM API 调用失败

**症状**:
```
❌ LLM API 调用失败: Connection refused
```

**排查步骤**:
```bash
# 1. 测试网络连通性
curl -I ${LLM_API_URL}

# 2. 检查 API Key
echo $AI_API_KEY

# 3. 检查防火墙规则
iptables -L -n | grep 443

# 4. 查看详细错误日志
tail -f /www/wwwroot/cretas/logs/error.log | grep "LLM API"
```

**解决方法**:
- 确保 API Key 正确配置
- 确保服务器能访问外网
- 检查 API 服务商是否有故障

#### 问题 3: Tool 执行超时

**症状**:
```
❌ 工具执行失败: Execution timeout after 30000ms
```

**排查步骤**:
```bash
# 查看慢查询日志
tail -f /www/wwwroot/cretas/logs/tool-execution.log | grep "duration"

# 检查数据库性能
mysql -e "SHOW PROCESSLIST;"
```

**解决方法**:
1. 增加超时时间:
   ```properties
   tool.execution.timeout=60000
   ```

2. 优化 Tool 逻辑（添加索引、减少查询）

3. 使用异步执行（未来特性）

#### 问题 4: 内存溢出 (OOM)

**症状**:
```
java.lang.OutOfMemoryError: Java heap space
```

**排查步骤**:
```bash
# 分析堆转储文件
jmap -dump:format=b,file=heapdump.hprof <PID>

# 使用 MAT 分析内存泄漏
# https://www.eclipse.org/mat/
```

**解决方法**:
1. 增加堆内存:
   ```bash
   -Xms2048m -Xmx4096m
   ```

2. 检查是否有内存泄漏（大对象、缓存未清理）

3. 启用 GC 日志分析:
   ```bash
   -XX:+PrintGCDetails -XX:+PrintGCTimeStamps -Xloggc:/www/wwwroot/cretas/logs/gc.log
   ```

### 6.2 日志分析

**关键日志关键词**:

| 关键词 | 说明 | 日志示例 |
|--------|------|----------|
| `✅ 注册工具` | Tool 注册成功 | `✅ 注册工具: name=create_new_intent` |
| `🔧 开始执行工具` | Tool 开始执行 | `🔧 开始执行工具: toolName=query_entity_schema` |
| `✅ 工具执行成功` | Tool 执行成功 | `✅ 工具执行成功: toolName=..., resultLength=256` |
| `❌ 工具执行失败` | Tool 执行失败 | `❌ 工具执行失败: toolName=..., error=...` |
| `⚠️  跳过注册` | Tool 未注册 | `⚠️  跳过注册：工具名称为空` |

**日志分析脚本**:
```bash
#!/bin/bash
# analyze_tool_logs.sh

LOG_FILE="/www/wwwroot/cretas/logs/tool-execution.log"

echo "===== Tool 执行统计 ====="
echo "总执行次数: $(grep "开始执行工具" $LOG_FILE | wc -l)"
echo "成功次数: $(grep "工具执行成功" $LOG_FILE | wc -l)"
echo "失败次数: $(grep "工具执行失败" $LOG_FILE | wc -l)"

echo ""
echo "===== 最近失败的 Tool ====="
grep "工具执行失败" $LOG_FILE | tail -n 5

echo ""
echo "===== 执行耗时最长的 Tool ====="
grep "resultLength" $LOG_FILE | grep -oP "resultLength=\K\d+" | sort -rn | head -n 5
```

---

## 7. 回滚方案

### 7.1 快速回滚

**场景**: 新版本有严重 Bug，需要立即回滚

**步骤**:
```bash
# 1. 停止当前服务
kill -15 $(ps -ef | grep cretas-aims | grep -v grep | awk '{print $2}')

# 2. 恢复旧版本 JAR 包
cp /www/wwwroot/cretas/backup/cretas-aims-1.0.0-backup.jar \
   /www/wwwroot/cretas/cretas-aims-1.0.0.jar

# 3. 启动服务
bash /www/wwwroot/cretas/restart.sh

# 4. 验证服务
curl http://localhost:10010/api/mobile/health
```

### 7.2 数据库回滚

**场景**: 数据库 schema 变更导致问题

**步骤**:
```sql
-- 1. 查看最近的 migration
SELECT * FROM flyway_schema_history ORDER BY installed_on DESC LIMIT 5;

-- 2. 回滚到指定版本（手动编写回滚脚本）
-- 示例: 删除新增的列
ALTER TABLE ai_intent_config DROP COLUMN new_column;

-- 3. 验证数据完整性
SELECT COUNT(*) FROM ai_intent_config;
```

### 7.3 配置回滚

**场景**: 配置变更导致服务异常

**步骤**:
```bash
# 1. 恢复配置文件
cp /www/wwwroot/cretas/config/application.properties.backup \
   /www/wwwroot/cretas/config/application.properties

# 2. 重启服务
bash /www/wwwroot/cretas/restart.sh
```

---

## 8. 部署检查清单

### 8.1 部署前检查

- [ ] 代码审查通过
- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试通过（如适用）
- [ ] 配置文件已更新
- [ ] 环境变量已配置
- [ ] 数据库 migration 已准备
- [ ] 备份当前版本 JAR 包
- [ ] 备份数据库
- [ ] 回滚方案已准备

### 8.2 部署中检查

- [ ] 服务正常停止
- [ ] JAR 包上传成功
- [ ] 服务正常启动
- [ ] 健康检查通过
- [ ] Tool Registry 初始化成功
- [ ] 数据库连接正常
- [ ] LLM API 连接正常

### 8.3 部署后检查

- [ ] 健康检查接口正常
- [ ] Tool 注册数量正确
- [ ] 功能测试通过
- [ ] 日志输出正常
- [ ] 监控指标正常
- [ ] 告警规则生效
- [ ] 用户访问正常
- [ ] 性能指标正常

---

## 9. 生产环境最佳实践

### 9.1 安全配置

1. **使用 HTTPS**:
   ```properties
   server.ssl.enabled=true
   server.ssl.key-store=/path/to/keystore.p12
   server.ssl.key-store-password=${SSL_PASSWORD}
   server.ssl.key-store-type=PKCS12
   ```

2. **限制 API 访问**:
   ```properties
   # 启用 CORS
   cors.allowed-origins=https://your-frontend.com
   cors.allowed-methods=GET,POST,PUT,DELETE
   ```

3. **使用密钥管理服务**:
   - 不在代码中硬编码密钥
   - 使用环境变量或密钥管理服务（如 AWS Secrets Manager）

### 9.2 高可用配置

1. **负载均衡**:
   ```nginx
   upstream cretas_backend {
       server 192.168.1.10:10010 weight=1;
       server 192.168.1.11:10010 weight=1;
       server 192.168.1.12:10010 weight=1 backup;
   }

   server {
       listen 80;
       server_name api.cretas.com;

       location / {
           proxy_pass http://cretas_backend;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **数据库主从**:
   ```properties
   # 主数据库
   spring.datasource.master.url=jdbc:mysql://master:3306/cretas_aims

   # 从数据库（读）
   spring.datasource.slave.url=jdbc:mysql://slave:3306/cretas_aims
   ```

3. **Redis 哨兵**:
   ```properties
   spring.redis.sentinel.master=mymaster
   spring.redis.sentinel.nodes=sentinel1:26379,sentinel2:26379,sentinel3:26379
   ```

### 9.3 容量规划

**预估并发**:
| 指标 | 估算 | 说明 |
|------|------|------|
| 日活用户 | 1000 | 每天使用系统的用户数 |
| 每用户请求 | 50 | 每用户每天平均请求数 |
| 总请求量 | 50,000 | 1000 × 50 |
| QPS (均值) | 0.6 | 50000 / (24 × 3600) |
| QPS (峰值) | 10 | 按 20x 峰值系数计算 |

**资源配置**:
| 资源 | 最低配置 | 推荐配置 | 说明 |
|------|----------|----------|------|
| CPU | 2核 | 4核 | 支持 10 QPS |
| 内存 | 2GB | 4GB | JVM Heap 2GB |
| 磁盘 | 20GB | 50GB | 日志 + 数据 |
| 带宽 | 1Mbps | 10Mbps | API 调用 |

---

## 10. 参考资源

- [架构文档](./LLM-FUNCTION-CALLING-ARCHITECTURE.md)
- [用户指南](./LLM-FUNCTION-CALLING-USER-GUIDE.md)
- [API 参考](./LLM-FUNCTION-CALLING-API-REFERENCE.md)
- [迁移指南](./MIGRATION-GUIDE.md)
- [Spring Boot 部署指南](https://docs.spring.io/spring-boot/docs/current/reference/html/deployment.html)
- [HikariCP 配置](https://github.com/brettwooldridge/HikariCP#configuration-knobs-baby)

---

**文档所有者**: Cretas DevOps Team
**最后更新**: 2026-01-06
**状态**: 生产环境已验证
