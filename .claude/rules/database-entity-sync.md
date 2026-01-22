# 数据库与Entity同步规范

**最后更新**: 2026-01-22

---

## BaseEntity 必需字段

继承 `BaseEntity` 的实体，数据库表**必须**包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| `deleted_at` | DATETIME NULL | 软删除 |

```sql
ALTER TABLE {table_name}
ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN deleted_at DATETIME NULL;
```

---

## 新建 Entity 检查清单

- [ ] 继承 BaseEntity → 确保表有 audit 字段
- [ ] 检查 @Column 字段在数据库中存在
- [ ] 检查 @JoinColumn 外键约束

---

## 常见错误

### Unknown column 'xxx_.created_at'

Entity 继承 BaseEntity，但表缺少 created_at 列：
```sql
ALTER TABLE {table_name} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
```

---

## 推荐配置

```properties
# 开发环境：启动时验证 schema
spring.jpa.hibernate.ddl-auto=validate
```

