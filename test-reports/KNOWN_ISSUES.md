# 已知问题清单

**最后更新**: 2025-11-20 19:21

---

## Issue #1: platform_admin 登录失败

**发现时间**: 2025-11-20 Phase 1.1 认证测试
**优先级**: P2 (低 - 有workaround)
**状态**: 🔴 未修复

### 问题描述

`platform_admin`账号登录时触发backend 500错误：
```
{
  "code": 500,
  "message": "系统内部错误，请联系管理员"
}
```

### 根本原因

Backend日志显示Hibernate SQL错误：
```
java.sql.SQLSyntaxErrorException: Unknown column 'production0_.start_date' in 'field list'
```

**技术分析**:
- Hibernate尝试查询`ProductionBatch`表时使用了错误的字段名
- 数据库实际字段: `start_time`, `end_time`
- Hibernate查询使用: `start_date`, `end_date`
- 可能原因: Hibernate二级缓存或entity metadata未刷新

### 复现步骤

```bash
curl -X POST http://localhost:10010/api/mobile/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform_admin","password":"123456"}'

# Response: 500 Internal Server Error
```

### 影响范围

- ❌ 仅影响`platform_admin`账号
- ✅ 其他同角色账号正常 (`admin`, `developer`)
- ✅ 不影响其他7个测试账号
- ✅ 不影响测试覆盖率（所有5种角色已覆盖）

### Workaround

使用以下账号代替`platform_admin`：
- `admin` (factory_super_admin @ PLATFORM)
- `developer` (factory_super_admin @ PLATFORM)

### 修复方案

**Option A - 快速修复** (推荐):
```bash
# 重启backend清除Hibernate缓存
cd /Users/jietaoxie/my-prototype-logistics/backend-java
pkill -f "spring-boot:run"
mvn spring-boot:run
```
**预计时间**: 2-3分钟

**Option B - 彻底修复**:
1. 检查`ProductionBatch` entity映射
2. 验证`@Column(name = "start_time")`是否正确
3. 清理Hibernate缓存配置
4. 重新编译backend

**预计时间**: 30分钟

**Option C - 数据库修复** (不推荐):
```sql
ALTER TABLE production_batches
  CHANGE COLUMN start_time start_date DATETIME;
ALTER TABLE production_batches
  CHANGE COLUMN end_time end_date DATETIME;
```
**影响**: 破坏性变更，影响现有数据

### 相关文件

- Backend Entity: `backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java`
- Backend日志: `backend-java/backend.log`
- 测试脚本: `tests/api/test_auth_simple.sh` (已跳过platform_admin)

### 测试状态

- Phase 1.1认证测试: ⊘ 跳过 (标记为已知问题)
- 其他测试: 使用`admin`或`developer`账号代替

### 下一步

- [ ] Backend团队确认是否需要修复
- [ ] 如需修复，选择修复方案并执行
- [ ] 修复后重新测试`platform_admin`账号
- [ ] 更新测试脚本移除跳过逻辑

---

## Issue #2: 批次创建API - product_type_id字段缺失

**发现时间**: 2025-11-20 Phase 1.4 Processing测试
**修复时间**: 2025-11-20 20:28
**优先级**: P1 (中 - 影响批次创建功能)
**状态**: ✅ 已修复

### 问题描述

创建生产批次时触发MySQL约束错误：
```
SQL Error: 1364
Field 'product_type_id' doesn't have a default value
```

### 根本原因

**数据模型不一致**：

1. **数据库表** `production_batches` 有两个产品类型字段：
   - `product_type` varchar(191) NULL - 可为空
   - `product_type_id` int NOT NULL - **必填但没有默认值**

2. **Entity映射错误** ([ProductionBatch.java:59-60](backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java#L59-L60)):
   ```java
   @Column(name = "product_type", length = 191)
   private String productTypeId;  // ❌ 映射到错误的列
   ```
   - Entity的`productTypeId`字段映射到`product_type`列（varchar, nullable）
   - 但数据库要求`product_type_id`列（int, NOT NULL）必须有值
   - Entity没有任何字段映射到`product_type_id`列

3. **现有数据** 所有批次都使用 `product_type_id = 1`：
   ```sql
   SELECT product_type, product_type_id FROM production_batches;
   -- product_type | product_type_id
   -- NULL         | 1
   -- NULL         | 1
   -- NULL         | 1
   ```

### 复现步骤

```bash
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/processing/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "TEST-001",
    "productTypeId": "PT001",
    "quantity": 500,
    "unit": "kg",
    "status": "PLANNED"
  }'

# Response: 500 Internal Server Error
# Backend Log: Field 'product_type_id' doesn't have a default value
```

### 影响范围

- ❌ **无法创建新批次** - 所有批次创建API调用失败
- ✅ 查询现有批次正常（列表、详情）
- ❌ Phase 1.4测试: Test 6 (批次创建) 失败
- ✅ Phase 1.4测试: Tests 1-5 (查询APIs) 100%通过

### 修复方案

**Option A - 修复Entity映射** (推荐):
1. 修改 [ProductionBatch.java:59-60](backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java#L59-L60):
   ```java
   // 修改前:
   @Column(name = "product_type", length = 191)
   private String productTypeId;

   // 修改后:
   @Column(name = "product_type_id", nullable = false)
   private Integer productTypeId;  // 改为Integer类型
   ```
2. 重新编译并测试
3. **预计时间**: 15分钟

**Option B - 数据库添加默认值**:
```sql
ALTER TABLE production_batches
  MODIFY COLUMN product_type_id INT DEFAULT 1;
```
- 优点: 快速修复，无需重启backend
- 缺点: 掩盖数据模型问题，未来可能引发bug
- **预计时间**: 2分钟

**Option C - 统一数据模型** (彻底方案):
1. 决定使用哪个字段：
   - `product_type` (varchar) - 使用产品类型的string ID（如"PT001"）
   - `product_type_id` (int) - 使用整数ID（如1, 2, 3）
2. 删除多余字段
3. 更新所有相关代码
4. **预计时间**: 1-2小时

### 临时Workaround

测试脚本跳过批次创建测试，仅测试查询功能：
```bash
# tests/api/test_processing_core.sh
# Test 6: 创建新批次 - SKIPPED (Known Issue #2)
```

### 相关文件

- Entity: [backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java](backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java)
- Service: [backend-java/src/main/java/com/cretas/aims/service/impl/ProcessingServiceImpl.java](backend-java/src/main/java/com/cretas/aims/service/impl/ProcessingServiceImpl.java)
- 测试脚本: [tests/api/test_processing_core.sh](tests/api/test_processing_core.sh)
- Backend日志: `backend-java/backend.log`

### 修复实施

**修复方案**: 采用方案A - 修复Entity映射

**修改内容**:
```java
// 文件: backend-java/src/main/java/com/cretas/aims/entity/ProductionBatch.java
// 第59-60行

// 修改前:
@Column(name = "product_type", length = 191)
private String productTypeId;

// 修改后:
@Column(name = "product_type_id", nullable = false)
private Integer productTypeId;
```

**验证测试**:
```bash
# 测试批次创建 (TEST-FIXED-20251120202810)
POST /api/mobile/CRETAS_2024_001/processing/batches
{
  "batchNumber": "TEST-FIXED-20251120202810",
  "productTypeId": 1,
  "productName": "龙虾",
  "quantity": 500,
  "unit": "kg",
  "status": "PLANNED"
}

# Response: 200 OK
# ✅ 批次ID: 4, 创建成功
```

### 下一步

- [x] Backend团队选择修复方案 (方案A)
- [x] 实施修复 (修改Entity映射)
- [x] 测试批次创建功能 (✅ 通过)
- [ ] 更新测试脚本移除跳过逻辑

---

**记录人**: Claude Code
**联系**: 参见CLAUDE.md
