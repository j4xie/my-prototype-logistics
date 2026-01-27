# PostgreSQL 迁移 - 手动审查摘要

**生成时间**: 2026-01-26
**状态**: 自动转换完成，剩余项需人工审查

---

## 转换统计

| 项目 | 数量 | 状态 |
|------|------|------|
| 总文件数 | 153 | ✅ 已转换 |
| 数据类型转换 | ~300+ | ✅ 自动完成 |
| MODIFY COLUMN | 30 | ✅ 已修复 |
| COMMENT= | 55 | ✅ 已移除 |
| ENUM 内联定义 | 11 文件 | ⚠️ 需审查 |
| INSERT IGNORE | 5 文件 | ⚠️ 需审查 |
| GROUP_CONCAT | 1 文件 | ⚠️ 需审查 |

---

## 1. ENUM 类型处理 (11 文件)

### 已定义的类型 (V0001__create_enum_types.sql)

29 个 ENUM 类型已在 V0001 中预定义。

### 待处理的内联 ENUM

这些文件仍包含 MySQL 风格的内联 ENUM 定义，需要替换为预定义类型引用：

| 文件 | ENUM 示例 |
|------|-----------|
| V2025_12_27_4__add_scheduling_module_tables.sql | status, assignment_type |
| V2026_01_04_10__scale_protocol_tables.sql | connection_type, checksum_type |
| V2026_01_04_20__iot_infrastructure_tables.sql | device_type, status, data_quality |
| V2026_01_05_20__isapi_devices_tables.sql | status |
| V2026_01_18_01__smart_bi_tables.sql | 多个状态类型 |

### 修复方法

```sql
-- 原始 MySQL:
CREATE TABLE t (
    status ENUM('active', 'inactive') DEFAULT 'active'
);

-- PostgreSQL (使用预定义类型):
CREATE TABLE t (
    status status DEFAULT 'active'
);
-- 或者使用 CHECK 约束:
CREATE TABLE t (
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
```

---

## 2. INSERT IGNORE 处理 (5 文件)

这些文件包含 `INSERT IGNORE` 语句，已标记为 TODO：

| 文件 | 建议冲突键 |
|------|------------|
| V2025_12_28_2__dispatcher_enhancement.sql | factory_id, rule_type |
| V20260121__aps_adaptive_scheduling.sql | factory_id |
| V2026_01_14_3__bom_sample_data.sql | id |
| V2026_01_18_01__smart_bi_tables.sql | factory_id, skill_code |
| V2026_01_21_001__aps_adaptive_scheduling.sql | factory_id |

### 修复方法

```sql
-- 原始 MySQL:
INSERT IGNORE INTO table (col1, col2) VALUES (...);

-- PostgreSQL:
INSERT INTO table (col1, col2) VALUES (...)
ON CONFLICT (primary_key_or_unique_columns) DO NOTHING;
```

---

## 3. GROUP_CONCAT 处理 (1 文件)

| 文件 | 位置 |
|------|------|
| V2026_01_19_12__smart_bi_new_skills.sql | GROUP_CONCAT 函数 |

### 修复方法

```sql
-- 原始 MySQL:
SELECT GROUP_CONCAT(col) FROM table;

-- PostgreSQL:
SELECT STRING_AGG(col::text, ',') FROM table;
```

---

## 4. 已自动处理的项目

以下转换已由脚本自动完成：

| MySQL | PostgreSQL | 数量 |
|-------|------------|------|
| DATETIME | TIMESTAMP WITH TIME ZONE | ~200 |
| TINYINT(1) | BOOLEAN | ~50 |
| AUTO_INCREMENT | SERIAL/BIGSERIAL | ~180 |
| MEDIUMTEXT/LONGTEXT | TEXT | ~30 |
| ENGINE=InnoDB | (已移除) | 全部 |
| DEFAULT CHARSET | (已移除) | 全部 |
| UNSIGNED | (已移除) | ~100 |
| MODIFY COLUMN | ALTER COLUMN ... TYPE | 30 |
| IFNULL() | COALESCE() | ~10 |
| COMMENT='...' | (已移除) | 55 |

---

## 5. 执行顺序建议

1. **先执行 V0001** - 创建所有 ENUM 类型
2. **执行 V0002** - 创建 updated_at 触发器
3. **按版本顺序执行** - 其他迁移脚本
4. **最后执行 V9999** - 设置 pg_cron 定时任务

---

## 6. 注意事项

1. **索引语法**: `ON table_name` 在 PostgreSQL 中不需要
   ```sql
   -- MySQL
   DROP INDEX idx_name ON table_name;
   -- PostgreSQL
   DROP INDEX IF EXISTS idx_name;
   ```

2. **外键约束**: 确保引用的表已创建

3. **数据迁移**: 建议使用 pgloader 进行数据迁移，而非执行这些 DDL 脚本

---

## 附录: 需要审查的文件列表

```
backend-java/src/main/resources/db/migration-pg-converted/MANUAL_REVIEW_REQUIRED.txt
```
