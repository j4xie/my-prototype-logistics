# 前后端字段命名规范

## 概述

统一前后端字段命名转换规则，避免因命名不一致导致的数据丢失或错误。

**最后更新**: 2025-12-25
**适用范围**: Spring Boot 后端 + React Native 前端

---

## Rule 1: 命名约定

### 后端 (Java/Spring Boot)

```java
// Entity: camelCase
public class MaterialBatch {
    private String batchNumber;      // camelCase
    private String materialTypeId;   // camelCase
    private LocalDateTime createdAt; // camelCase
}

// 数据库: snake_case
CREATE TABLE material_batches (
    batch_number VARCHAR(50),        -- snake_case
    material_type_id VARCHAR(50),    -- snake_case
    created_at DATETIME              -- snake_case
);
```

### 前端 (TypeScript/React Native)

```typescript
// Interface: camelCase (与后端 DTO 一致)
interface MaterialBatch {
  batchNumber: string;      // camelCase
  materialTypeId: string;   // camelCase
  createdAt: string;        // camelCase
}
```

### JSON API 传输

```json
{
  "batchNumber": "MB-001",
  "materialTypeId": "MT-001",
  "createdAt": "2025-12-25T10:00:00"
}
```

---

## Rule 2: Spring Boot 配置

### 自动转换配置

```properties
# application.properties
spring.jackson.property-naming-strategy=LOWER_CAMEL_CASE
```

### Entity → 数据库映射

```java
@Entity
@Table(name = "material_batches")  // snake_case 表名
public class MaterialBatch {

    @Column(name = "batch_number")  // 显式指定 snake_case 列名
    private String batchNumber;

    @Column(name = "material_type_id")
    private String materialTypeId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
```

### 或使用 Hibernate 命名策略

```properties
# 自动将 camelCase 转换为 snake_case
spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
spring.jpa.hibernate.naming.implicit-strategy=org.hibernate.boot.model.naming.ImplicitNamingStrategyLegacyJpaImpl
```

---

## Rule 3: 常见字段映射表

| Java Entity | 数据库列名 | JSON 响应 | TS 接口 |
|-------------|-----------|-----------|---------|
| `factoryId` | `factory_id` | `factoryId` | `factoryId` |
| `batchNumber` | `batch_number` | `batchNumber` | `batchNumber` |
| `createdAt` | `created_at` | `createdAt` | `createdAt` |
| `updatedAt` | `updated_at` | `updatedAt` | `updatedAt` |
| `deletedAt` | `deleted_at` | `deletedAt` | `deletedAt` |
| `materialTypeId` | `material_type_id` | `materialTypeId` | `materialTypeId` |
| `unitPrice` | `unit_price` | `unitPrice` | `unitPrice` |
| `totalCost` | `total_cost` | `totalCost` | `totalCost` |

---

## Rule 4: 禁止的做法

### 后端

```java
// ❌ BAD: JSON 字段使用 snake_case
@JsonProperty("batch_number")
private String batchNumber;

// ❌ BAD: 数据库列名使用 camelCase
@Column(name = "batchNumber")
private String batchNumber;

// ✅ GOOD: 保持一致
@Column(name = "batch_number")  // 数据库 snake_case
private String batchNumber;      // Java camelCase，JSON 也是 camelCase
```

### 前端

```typescript
// ❌ BAD: 混用命名风格
interface MaterialBatch {
  batch_number: string;  // snake_case 错误
  materialTypeId: string; // camelCase 正确
}

// ✅ GOOD: 统一 camelCase
interface MaterialBatch {
  batchNumber: string;
  materialTypeId: string;
}
```

---

## Rule 5: 检查工具

### 后端检查

```bash
# 检查是否有 @JsonProperty 使用 snake_case
grep -r "@JsonProperty.*_" backend-java/src/

# 检查 @Column 命名是否规范
grep -r "@Column" backend-java/src/ | grep -v "name = \""
```

### 前端检查

```bash
# 检查 interface 中是否有 snake_case 字段
grep -rE "^\s+[a-z]+_[a-z]+" frontend/src/types/
```

---

## 历史问题记录

### 2025-12-25: 字段名不一致导致数据丢失

**问题**: 后端返回 `materialTypeId`，前端期望 `material_type_id`
**原因**: 前端 interface 使用了 snake_case
**解决**: 统一前端 interface 为 camelCase

---

## 相关文件

- `backend/.../config/JacksonConfig.java` - JSON 序列化配置
- `backend/.../entity/BaseEntity.java` - 基础实体类
- `frontend/.../types/index.ts` - 前端类型定义
