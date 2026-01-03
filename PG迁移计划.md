# MySQL → PostgreSQL 渐进迁移计划

> 总工期: 9 周 | 迁移策略: pgloader | 前置条件: N+1 问题修复完成

---

## 项目现状

| 维度 | 数据 |
|------|------|
| Entity 数量 | 57 个 |
| 迁移脚本 | 45+ 个 |
| JSON 字段 | 40+ 个 |
| ENUM 类型 | 15+ 个 |
| UUID 主键 | 30+ 个 |
| 数据库版本 | MySQL 8.0 |
| 目标版本 | PostgreSQL 14+ |

---

## 推荐工具

基于业界最佳实践：
- [Skyvia - MySQL to PostgreSQL Guide](https://blog.skyvia.com/mysql-to-postgresql/)
- [Estuary - Postgres Migration Tools](https://estuary.dev/blog/postgres-migration-tools/)
- [PostgreSQL Wiki - Converting from MySQL](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL)

| 工具 | 类型 | 说明 | 选择 |
|------|------|------|------|
| **pgloader** | 开源 | 快速迁移，支持数据转换 | ✅ 已选 |
| pg_chameleon | 开源 | 实时同步，低停机 | - |
| AWS DMS | 商业 | 云托管，零停机 | - |
| Debezium | 开源 | CDC 实时同步 | - |

---

## 兼容性问题清单

### 数据类型转换

| MySQL | PostgreSQL | 影响范围 | 自动转换 |
|-------|------------|----------|----------|
| TINYINT(1) | BOOLEAN | 5+ 表 | ✅ pgloader 支持 |
| DATETIME | TIMESTAMP WITH TIME ZONE | 200+ 字段 | ✅ pgloader 支持 |
| INT AUTO_INCREMENT | SERIAL | 15+ 表 | ✅ pgloader 支持 |
| BIGINT AUTO_INCREMENT | BIGSERIAL | 25+ 表 | ✅ pgloader 支持 |
| JSON | JSONB | 40+ 字段 | ✅ 建议手动改为 JSONB |
| ENUM(...) | CREATE TYPE ... AS ENUM | 15+ 字段 | ⚠️ 需手动处理 |
| VARCHAR(36) UUID | UUID | 30+ 字段 | ⚠️ 建议手动优化 |

### MySQL 特有语法

| 语法 | 问题 | 解决方案 | 工作量 |
|------|------|----------|--------|
| ON UPDATE CURRENT_TIMESTAMP | PG 不支持 | 创建触发器 | 57 个表 |
| COMMENT '...' | 语法不同 | COMMENT ON ... | 低 |
| ENUM(...) 内联定义 | PG 需预定义类型 | CREATE TYPE ... | 15+ 类型 |
| @@auto_increment | 语法不同 | SERIAL/SEQUENCE | 自动 |

---

## 迁移路线图

### 阶段 0: 评估与准备（1 周）

#### 0.1 环境准备

```bash
# 安装 PostgreSQL 14+
brew install postgresql@14

# 安装 pgloader
brew install pgloader

# 创建测试数据库
createdb cretas_test
```

#### 0.2 迁移评估

```bash
# 使用 pgloader 评估
pgloader --dry-run mysql://user:pass@localhost/cretas_db \
         postgresql://user:pass@localhost/cretas_test
```

#### 0.3 备份现有数据

```bash
# 完整备份
mysqldump -u root -p cretas_db > cretas_db_backup_$(date +%Y%m%d).sql
```

---

### 阶段 1: 代码兼容层（2 周）

#### 1.1 Maven 依赖修改

```xml
<!-- pom.xml -->
<!-- 移除 MySQL -->
<!--
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.0.33</version>
</dependency>
-->

<!-- 添加 PostgreSQL -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <version>42.7.2</version>
</dependency>
```

#### 1.2 配置文件修改

```properties
# application.properties

# 数据源
spring.datasource.driver-class-name=org.postgresql.Driver
spring.datasource.url=jdbc:postgresql://localhost:5432/cretas_db

# Hibernate 方言
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQL13Dialect
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQL13Dialect

# 连接池优化
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
```

#### 1.3 BaseEntity 修改

```java
// BaseEntity.java
// 更新 @SQLDelete 语法（PostgreSQL 兼容）
@MappedSuperclass
@SQLDelete(sql = "UPDATE ${table} SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public abstract class BaseEntity {
    // ...
}
```

#### 1.4 创建 PostgreSQL ENUM 类型

```sql
-- V0001__create_enum_types.sql

-- 生产计划状态
CREATE TYPE production_plan_status AS ENUM (
    'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'
);

-- 调度计划状态
CREATE TYPE scheduling_plan_status AS ENUM (
    'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'
);

-- 告警严重程度
CREATE TYPE alert_severity AS ENUM (
    'info', 'warning', 'critical'
);

-- 工人分配状态
CREATE TYPE worker_assignment_status AS ENUM (
    'assigned', 'checked_in', 'working', 'checked_out', 'absent'
);

-- ... 其他 11+ ENUM 类型
```

#### 1.5 创建触发器（替代 ON UPDATE CURRENT_TIMESTAMP）

```sql
-- V0002__create_update_triggers.sql

-- 通用更新时间触发器函数
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为每个表创建触发器（示例）
CREATE TRIGGER users_update_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER factories_update_timestamp
    BEFORE UPDATE ON factories
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ... 其他 55 个表
```

---

### 阶段 2: 迁移脚本转换（2 周）

#### 2.1 创建转换脚本

```bash
#!/bin/bash
# convert-mysql-to-pg.sh

for file in backend-java/src/main/resources/db/migration/*.sql; do
    echo "Converting: $file"

    # 数据类型转换
    sed -i '' \
        -e 's/DATETIME/TIMESTAMP WITH TIME ZONE/g' \
        -e 's/TINYINT(1)/BOOLEAN/g' \
        -e 's/INT AUTO_INCREMENT/SERIAL/g' \
        -e 's/BIGINT AUTO_INCREMENT/BIGSERIAL/g' \
        -e 's/INT NOT NULL AUTO_INCREMENT/SERIAL/g' \
        -e 's/BIGINT NOT NULL AUTO_INCREMENT/BIGSERIAL/g' \
        "$file"

    # 移除 ON UPDATE CURRENT_TIMESTAMP
    sed -i '' 's/ON UPDATE CURRENT_TIMESTAMP//g' "$file"

    # 转换 COMMENT 语法（需要手动处理）
    echo "⚠️  Check COMMENT syntax in: $file"
done
```

#### 2.2 关键迁移脚本清单

| 脚本 | MySQL 特有语法 | 需要手动处理 |
|------|---------------|-------------|
| V2025_12_27_4__scheduling_module.sql | ENUM(7), AUTO_INCREMENT(3) | ✅ |
| V2025_12_30_10__config_change_sets.sql | JSON(3) | ✅ JSONB |
| V2025_12_27__role_hierarchy.sql | ENUM(1), AUTO_INCREMENT | ✅ |
| V2025_12_30_4__factory_capacity.sql | TINYINT(1)(3) | 自动 |
| 其他 41 个脚本 | DATETIME, JSON, TEXT | 部分自动 |

---

### 阶段 3: pgloader 数据迁移（1 周）

#### 3.1 pgloader 配置文件

```lisp
-- migrate.load

LOAD DATABASE
    FROM mysql://cretas_user:password@localhost:3306/cretas_db
    INTO postgresql://cretas_user:password@localhost:5432/cretas_db

WITH include drop,
     create tables,
     create indexes,
     reset sequences,
     foreign keys,
     uniquify index names

SET maintenance_work_mem to '512MB',
    work_mem to '64MB',
    search_path to 'public'

-- 数据类型转换规则
CAST type datetime to timestamp with time zone,
     type tinyint to boolean using tinyint-to-boolean,
     type json to jsonb

-- 表名映射（如需要）
-- ALTER SCHEMA 'cretas_db' RENAME TO 'public'

BEFORE LOAD DO
$$ CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; $$,
$$ CREATE EXTENSION IF NOT EXISTS "pg_trgm"; $$;
```

#### 3.2 执行迁移

```bash
# 1. 停止应用
ssh root@139.196.165.140 "systemctl stop cretas-backend"

# 2. 执行迁移
pgloader migrate.load

# 3. 验证数据
psql -h localhost -U cretas_user -d cretas_db -c "SELECT COUNT(*) FROM users;"

# 4. 重建序列
psql -h localhost -U cretas_user -d cretas_db -f fix-sequences.sql

# 5. 启动应用
ssh root@139.196.165.140 "systemctl start cretas-backend"
```

#### 3.3 序列修复脚本

```sql
-- fix-sequences.sql

-- 修复所有 SERIAL 列的序列值
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = 'id'
    ) LOOP
        EXECUTE format(
            'SELECT setval(pg_get_serial_sequence(''%I'', ''id''), COALESCE(MAX(id), 1)) FROM %I',
            r.table_name, r.table_name
        );
    END LOOP;
END $$;
```

---

### 阶段 4: 验证测试（2 周）

#### 4.1 数据完整性验证

```sql
-- 对比 MySQL 和 PostgreSQL 的行数
-- MySQL
SELECT 'users' as tbl, COUNT(*) FROM users
UNION ALL
SELECT 'factories', COUNT(*) FROM factories
UNION ALL
SELECT 'production_batches', COUNT(*) FROM production_batches
-- ... 其他表

-- PostgreSQL (相同查询，验证结果一致)
```

#### 4.2 功能测试

```bash
# 运行所有 API 测试
cd backend-java
mvn test -Dspring.profiles.active=pg-test

# 运行集成测试
./tests/api/run-all-tests.sh
```

#### 4.3 性能基准测试

```bash
# 关键 API 响应时间对比
for endpoint in \
    "/api/mobile/F001/processing/batches" \
    "/api/mobile/trace/BATCH-001" \
    "/api/mobile/F001/reports/dashboard/overview"
do
    echo "Testing: $endpoint"

    # MySQL
    curl -s -o /dev/null -w "MySQL: %{time_total}s\n" \
        "http://mysql-server:10010$endpoint"

    # PostgreSQL
    curl -s -o /dev/null -w "PostgreSQL: %{time_total}s\n" \
        "http://pg-server:10010$endpoint"
done
```

---

### 阶段 5: 灰度切换（1 周）

#### 5.1 切换策略

| 阶段 | 流量比例 | 时间 | 回滚条件 |
|------|----------|------|----------|
| Day 1-2 | 10% → PostgreSQL | 2 天 | 错误率 > 0.1% |
| Day 3-4 | 30% → PostgreSQL | 2 天 | 错误率 > 0.05% |
| Day 5-6 | 50% → PostgreSQL | 2 天 | 错误率 > 0.01% |
| Day 7 | 100% → PostgreSQL | 1 天 | - |

#### 5.2 监控指标

```yaml
# 关键监控指标
metrics:
  - name: api_error_rate
    threshold: 0.01  # 1%
    action: alert

  - name: db_query_latency_p99
    threshold: 500ms
    action: alert

  - name: connection_pool_usage
    threshold: 80%
    action: alert
```

#### 5.3 回滚预案

```bash
# 1. 切换流量回 MySQL
# 修改 Nginx 配置或负载均衡器

# 2. 停止 PostgreSQL 写入
psql -c "ALTER DATABASE cretas_db SET default_transaction_read_only = on;"

# 3. 通知团队
# 发送告警

# 4. 分析问题
# 查看日志和监控
```

---

## 关键文件清单

### 配置文件

| 文件 | 修改内容 |
|------|----------|
| `pom.xml` | MySQL → PostgreSQL 驱动 |
| `application.properties` | 数据源和方言配置 |
| `application-prod.properties` | 生产环境数据源 |

### Entity 文件

| 文件 | 修改内容 |
|------|----------|
| `BaseEntity.java` | @SQLDelete 语法 |
| 所有 57 个 Entity | 检查 @GeneratedValue |

### 迁移脚本

| 目录 | 文件数 | 处理方式 |
|------|--------|----------|
| `db/migration/` | 45+ | 自动转换 + 手动审查 |
| `db/migration-pg/` (新建) | 45+ | PostgreSQL 版本 |

### 新增文件

| 文件 | 用途 |
|------|------|
| `V0001__create_enum_types.sql` | PostgreSQL ENUM 定义 |
| `V0002__create_update_triggers.sql` | 更新时间触发器 |
| `migrate.load` | pgloader 配置 |
| `fix-sequences.sql` | 序列修复 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| UUID 主键性能下降 | 查询变慢 | 中 | 使用 BIGSERIAL 或 UUID v1 |
| JSONB 查询语法差异 | 代码不兼容 | 低 | 提前测试所有 JSON 查询 |
| 事务隔离级别差异 | 并发问题 | 低 | 显式设置隔离级别 |
| 迁移窗口过长 | 业务中断 | 中 | 使用 pgloader 并行迁移 |
| 数据丢失 | 严重 | 极低 | 多重备份 + 校验 |

---

## 时间线总览

```
Week 1     : 阶段 0 - 评估准备
Week 2-3   : 阶段 1 - 代码兼容层
Week 4-5   : 阶段 2 - 迁移脚本转换
Week 6     : 阶段 3 - pgloader 数据迁移
Week 7-8   : 阶段 4 - 验证测试
Week 9     : 阶段 5 - 灰度切换
-----------------------------------------
Total      : 9 周
停机窗口   : 2-4 小时（阶段 3）
```

---

## PostgreSQL 优化建议

### 服务器配置

```ini
# postgresql.conf

# 内存配置（假设 8GB RAM）
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 64MB

# 并发配置
max_connections = 200
max_parallel_workers_per_gather = 4

# WAL 配置
wal_buffers = 64MB
checkpoint_completion_target = 0.9
```

### 索引优化

```sql
-- JSONB 字段添加 GIN 索引
CREATE INDEX idx_product_type_sku_config
    ON product_types USING GIN (sku_config);

-- 软删除部分索引
CREATE INDEX idx_users_active
    ON users (id) WHERE deleted_at IS NULL;

-- 复合索引
CREATE INDEX idx_production_batch_factory_created
    ON production_batches (factory_id, created_at DESC);
```

---

## 并行工作建议

### 多窗口并行
- ✅ 可并行
- 窗口 1: 代码层修改（pom.xml, properties, Entity）
- 窗口 2: 迁移脚本转换（45+ 个 SQL 文件）
- 窗口 3: 测试脚本准备

### 注意事项
- 代码修改和脚本转换可以并行
- 数据迁移必须在代码准备完成后执行
- 测试必须在迁移完成后执行
