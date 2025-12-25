# 数据库与Entity同步规范

## 概述

本规则确保 JPA Entity 与数据库表结构保持同步，避免运行时错误。

**最后更新**: 2025-12-25
**触发原因**: equipment_alerts 表缺少 BaseEntity 必需字段导致 500 错误

---

## Rule 1: BaseEntity 必需字段

所有继承 `BaseEntity` 的实体，对应的数据库表**必须**包含：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| `deleted_at` | DATETIME | NULL | 软删除时间 |

**添加字段 SQL:**
```sql
ALTER TABLE {table_name}
ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN deleted_at DATETIME NULL;
```

---

## Rule 2: 新建 Entity 检查清单

创建新 Entity 时，必须完成以下检查：

- [ ] 确认是否继承 BaseEntity
- [ ] 如果继承，确保数据库表有 created_at/updated_at/deleted_at
- [ ] 检查所有 @Column 字段在数据库中存在
- [ ] 检查 @JoinColumn 外键约束正确

**验证命令:**
```bash
# 检查表结构
mysql -u root cretas_db -e "DESCRIBE {table_name};"

# 检查是否有 BaseEntity 字段
mysql -u root cretas_db -e "DESCRIBE {table_name};" | grep -E "created_at|updated_at|deleted_at"
```

---

## Rule 3: Entity 修改后同步流程

修改 Entity 后，按以下顺序检查：

1. **添加字段** → 数据库添加对应列
2. **删除字段** → 评估是否删除列（建议保留）
3. **修改类型** → 数据库修改列类型
4. **添加关联** → 检查外键约束

---

## 常见错误与解决方案

### Error: Unknown column 'xxx_.created_at' in 'field list'

**原因:** Entity 继承 BaseEntity，但数据库表缺少 created_at 列

**解决:**
```sql
ALTER TABLE {table_name} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE {table_name} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

### Error: Cannot delete or update a parent row

**原因:** 外键约束阻止删除

**解决:** 检查关联表数据，或使用软删除

---

## 推荐配置

在 `application.properties` 中启用 schema 验证：

```properties
# 开发环境：启动时验证 schema
spring.jpa.hibernate.ddl-auto=validate

# 生产环境：禁止自动修改
spring.jpa.hibernate.ddl-auto=none
```

---

## 历史问题记录

### 2025-12-25: equipment_alerts 表缺少 audit 字段

**问题:** 访问首页Dashboard时出现500错误
```
Unknown column 'equipmenta0_.created_at' in 'field list'
```

**原因:** `EquipmentAlert` 继承 `BaseEntity`，但数据库表缺少 `created_at`/`updated_at` 字段

**解决:**
```sql
ALTER TABLE equipment_alerts
ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```
