# 数据库与Entity同步规范

**最后更新**: 2026-02-19

---

## 数据库类型

**生产环境和开发环境均使用 PostgreSQL**（已从 MySQL 迁移完成）。

---

## BaseEntity 必需字段

继承 `BaseEntity` 的实体，数据库表**必须**包含：

| 字段 | 类型 (PostgreSQL) | 说明 |
|------|-------------------|------|
| `created_at` | TIMESTAMP DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP DEFAULT NOW() | 更新时间 |
| `deleted_at` | TIMESTAMP NULL | 软删除 |

```sql
-- PostgreSQL
ALTER TABLE {table_name}
ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN deleted_at TIMESTAMP NULL;

-- 自动更新 updated_at (需要触发器)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_updated_at
BEFORE UPDATE ON {table_name}
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 新建 Entity 检查清单

- [ ] 继承 BaseEntity → 确保表有 audit 字段
- [ ] 检查 @Column 字段在数据库中存在
- [ ] 检查 @JoinColumn 外键约束
- [ ] GROUP BY 包含所有非聚合列 (PG 严格模式)

---

## MySQL → PostgreSQL 差异

| MySQL | PostgreSQL | 说明 |
|-------|-----------|------|
| `INSERT IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | 忽略重复 |
| `DATETIME` | `TIMESTAMP` | 时间类型 |
| `ON UPDATE CURRENT_TIMESTAMP` | 需触发器 | 自动更新 |
| `boolean 1/0` | `boolean true/false` | 布尔值 |
| `CONCAT(a, b)` | `a \|\| b` | 字符串拼接 |
| 宽松 GROUP BY | 严格 GROUP BY | 必须列出所有非聚合列 |

---

## 常见错误

### Unknown column 'xxx_.created_at'

Entity 继承 BaseEntity，但表缺少 created_at 列：
```sql
ALTER TABLE {table_name} ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
```

### GROUP BY 错误 (PostgreSQL)

```
column "xxx" must appear in the GROUP BY clause or be used in an aggregate function
```
修复: 在 GROUP BY 中列出所有 SELECT 的非聚合列。

---

## 推荐配置

```properties
# 开发环境
spring.jpa.hibernate.ddl-auto=update

# 生产环境 (禁止自动修改 schema)
spring.jpa.hibernate.ddl-auto=none
```
