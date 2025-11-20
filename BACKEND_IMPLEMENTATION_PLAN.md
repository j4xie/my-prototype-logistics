# Java后端完整实施计划

**调查日期**: 2025-11-19
**调查方式**: 数据库查询 + 前端代码检查 + 现有实现分析
**目标**: 实现所有缺失的后端API，连接数据库和前端

---

## 📊 详细调查结果

### ✅ 数据库状态（真实查询结果）

**总表数**: 45个表

**有数据的表**（按数据量排序）:
```sql
time_clock_record         1167条  ✅ 已实现Controller
permission_audit_logs       83条
material_spec_config         9条  ✅ 已实现Controller
production_plans             7条  ❌ 需实现
processing_batches           6条  ❌ 需实现
customers                    4条  ❌ 需实现
material_batches             4条  ❌ 需实现
users                        3条  ❌ 需实现
product_types                4条  ❌ 需实现 (包含: 鱼片、鱼头等)
raw_material_types           2条  ❌ 需实现 (包含: 带鱼、鲈鱼)
suppliers                    2条  ❌ 需实现
factories                    1条  ✅ 基础数据
```

**关键表结构特征**（实际DESCRIBE结果）:
- **主键类型**: `varchar(191)` UUID格式（如: `62de0ca0-24df-4f2d-a19b-12dc8ac9bb15`）
- **外键约束**:
  - `factory_id` → `factories(id)` ON DELETE CASCADE
  - `created_by` → `users(id)` ON DELETE SET NULL
- **唯一约束**:
  - `(factory_id, name)` UNIQUE
  - `(factory_id, code)` UNIQUE
- **索引**:
  - `(factory_id, is_active)`
  - `(factory_id, category)`
- **字段命名**: 使用下划线命名（如: `created_at`, `is_active`）

### ✅ 前端状态（代码检查结果）

**API客户端**: 26个TypeScript文件，约4471行代码

**实际使用的页面**（已确认调用API）:
```
ProductTypeManagementScreen.tsx     ← 使用Mock数据，等待productTypeApiClient
MaterialTypeManagementScreen.tsx    ← 使用Mock数据，等待materialTypeApiClient
SupplierManagementScreen.tsx        ← 使用Mock数据，等待supplierApiClient
CustomerManagementScreen.tsx        ← 使用Mock数据，等待customerApiClient
WorkTypeManagementScreen.tsx        ← 使用Mock数据，等待workTypeApiClient
UserManagementScreen.tsx            ← 使用Mock数据，等待userApiClient
WhitelistManagementScreen.tsx       ← 使用Mock数据，等待whitelistApiClient
MaterialBatchManagementScreen.tsx   ← 使用Mock数据，等待materialBatchApiClient
ProductionPlanManagementScreen.tsx  ← 使用Mock数据，等待productionPlanApiClient
MaterialReceiptScreen.tsx           ← 使用Mock数据，等待materialApiClient
```

**前端期望的接口格式**（ProductType示例）:
```typescript
interface ProductType {
  id: string;              // UUID字符串
  factoryId: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  isActive: boolean;       // 注意：驼峰命名
  createdAt: string;       // 注意：驼峰命名
  updatedAt?: string;
}
```

### ✅ 现有Java后端

**文件数**: 9个Java文件

**包结构**:
```
com.cretas.aims/
├── controller/
│   ├── TimeClockController.java           ✅
│   └── MaterialSpecConfigController.java  ✅
├── entity/
│   ├── TimeClockRecord.java               ✅
│   └── MaterialSpecConfig.java            ✅
├── repository/
│   ├── TimeClockRepository.java           ✅
│   └── MaterialSpecConfigRepository.java  ✅
├── service/
│   ├── TimeClockService.java              ✅
│   └── MaterialSpecConfigService.java     ✅
├── dto/ (空)
└── CretasBackendApplication.java          ✅
```

**技术栈**:
- Spring Boot 2.7.15
- Spring Data JPA
- MySQL Connector
- Validation
- Lombok

---

## 🎯 实施计划（按优先级分批）

### 第一批：P0核心基础数据管理（1周，5个模块）

**优先实现原因**: 这些是其他模块的基础，前端页面已完成，有真实数据

#### 1. ProductTypeController - 产品类型管理
- **数据库表**: `product_types` (4条数据)
- **前端页面**: `ProductTypeManagementScreen.tsx` (使用Mock)
- **API客户端**: `productTypeApiClient.ts` (12个API)
- **工作量**: 1.5天

**需要实现的端点**:
```java
GET    /api/mobile/{factoryId}/products/types              // 列表查询
POST   /api/mobile/{factoryId}/products/types              // 创建
GET    /api/mobile/{factoryId}/products/types/{id}         // 详情
PUT    /api/mobile/{factoryId}/products/types/{id}         // 更新
DELETE /api/mobile/{factoryId}/products/types/{id}         // 删除
GET    /api/mobile/{factoryId}/products/types/active       // 活跃列表
GET    /api/mobile/{factoryId}/products/types/category/{cat}  // 按类别
GET    /api/mobile/{factoryId}/products/types/search       // 搜索
GET    /api/mobile/{factoryId}/products/types/check-code   // 检查代码
GET    /api/mobile/{factoryId}/products/types/categories   // 类别列表
POST   /api/mobile/{factoryId}/products/types/init-defaults // 初始化
PUT    /api/mobile/{factoryId}/products/types/batch/status // 批量更新
```

**实现文件**:
```
entity/ProductType.java
repository/ProductTypeRepository.java
service/ProductTypeService.java
controller/ProductTypeController.java
```

**Entity示例**:
```java
@Entity
@Table(name = "product_types")
public class ProductType {
    @Id
    @Column(name = "id", length = 191)
    private String id;  // UUID字符串

    @Column(name = "factory_id", nullable = false, length = 191)
    private String factoryId;

    @Column(name = "name", nullable = false, length = 191)
    private String name;

    @Column(name = "code", nullable = false, length = 191)
    private String code;

    @Column(name = "category", length = 191)
    private String category;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Integer createdBy;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

**JSON响应格式**（驼峰命名）:
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": "62de0ca0-24df-4f2d-a19b-12dc8ac9bb15",
    "factoryId": "CRETAS_2024_001",
    "name": "鱼片",
    "code": "YP001",
    "category": "鱼肉制品",
    "description": null,
    "isActive": true,
    "createdAt": "2025-10-06T04:38:01.918",
    "updatedAt": "2025-10-06T04:38:01.918",
    "createdBy": null
  }
}
```

#### 2. MaterialTypeController - 原材料类型管理
- **数据库表**: `raw_material_types` (2条数据: 带鱼、鲈鱼)
- **前端页面**: `MaterialTypeManagementScreen.tsx`
- **API数量**: 13个
- **工作量**: 1.5天

**特殊字段**:
- `unit`: 单位（默认"kg"）
- `category`: 类别（海水鱼、淡水鱼等）

#### 3. SupplierController - 供应商管理
- **数据库表**: `suppliers` (2条数据)
- **前端页面**: `SupplierManagementScreen.tsx`
- **API数量**: 8个（MVP精简版）
- **工作量**: 1天

**特殊字段**:
- `contact_person`, `contact_phone`
- `business_type`, `credit_level`
- `delivery_area`, `payment_terms`

#### 4. CustomerController - 客户管理
- **数据库表**: `customers` (4条数据)
- **前端页面**: `CustomerManagementScreen.tsx`
- **API数量**: 10个
- **工作量**: 1天

**字段与Supplier类似**

#### 5. WorkTypeController - 工种管理
- **数据库表**: `work_types`
- **前端页面**: `WorkTypeManagementScreen.tsx`
- **API数量**: 6个
- **工作量**: 0.5天

**特殊字段**:
- `type_code`, `type_name`
- `department`: ENUM('farming','processing','logistics','quality','management')
- `color_code`: 颜色代码（如 "#FF5733"）

---

### 第二批：P0用户与权限管理（1周，2个模块）

#### 6. UserController - 用户管理
- **数据库表**: `users` (3条数据)
- **前端页面**: `UserManagementScreen.tsx`
- **API数量**: 10个
- **工作量**: 2天

**复杂点**:
- 用户角色系统（8种角色）
- 权限验证
- 密码加密

#### 7. WhitelistController - 白名单管理
- **数据库表**: `user_whitelist`
- **前端页面**: `WhitelistManagementScreen.tsx`
- **API数量**: 8个
- **工作量**: 1天

**特殊字段**:
- `status`: ENUM('PENDING','REGISTERED','EXPIRED')
- `expires_at`: 过期时间

---

### 第三批：P1生产管理核心（2周，4个模块）

#### 8. ProcessingBatchController - 加工批次管理
- **数据库表**: `processing_batches` (6条数据)
- **前端页面**: `ProcessingDashboard`, `BatchDetailScreen`
- **API数量**: 13个
- **工作量**: 3天

**复杂字段**:
- `raw_materials`: JSON字段
- `status`: ENUM (5种状态)
- `quality_grade`: ENUM('A','B','C','failed')
- 成本字段: `raw_material_cost`, `labor_cost`, `equipment_cost`, `total_cost`

#### 9. MaterialBatchController - 原材料批次管理
- **数据库表**: `material_batches` (4条数据)
- **前端页面**: `MaterialBatchManagementScreen.tsx`
- **API数量**: 14个
- **工作量**: 2天

**复杂逻辑**:
- FIFO库存管理
- 过期预警
- 库存统计

#### 10. ProductionPlanController - 生产计划管理
- **数据库表**: `production_plans` (7条数据)
- **前端页面**: `ProductionPlanManagementScreen.tsx`
- **API数量**: 12个
- **工作量**: 2天

**关联关系**:
- 关联 product_type_id
- 关联 customer_id

#### 11. ConversionRateController - 转化率管理
- **数据库表**: ❌ `conversion_rates` 表不存在！需要创建
- **前端页面**: `ConversionRateManagementScreen.tsx`
- **API数量**: 8个
- **工作量**: 2天（包含建表）

**需要创建表**:
```sql
CREATE TABLE conversion_rates (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  product_type_id VARCHAR(191) NOT NULL,
  material_type_id VARCHAR(191) NOT NULL,
  conversion_ratio DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_conversion (factory_id, product_type_id, material_type_id),
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  FOREIGN KEY (material_type_id) REFERENCES raw_material_types(id)
);
```

---

### 第四批：P2辅助功能（1周，5个模块）

#### 12. FactorySettingsController - 工厂设置
- **数据库表**: `factory_settings`
- **API数量**: 7个
- **工作量**: 1.5天

**JSON字段**:
- `password_policy`: JSON
- `department_settings`: JSON
- `custom_permissions`: JSON
- `ai_settings`: JSON

#### 13. DashboardController - 仪表盘统计
- **数据库表**: 多表聚合查询
- **API数量**: 9个
- **工作量**: 2天

**聚合数据**:
- 生产统计
- 库存统计
- 成本统计
- 质检统计

#### 14. AttendanceController - 考勤统计
- **数据库表**: `time_clock_record` (复用)
- **API数量**: 5个
- **工作量**: 1天

**统计维度**:
- 按日期范围
- 按用户
- 按部门

#### 15. TimeStatsController - 工时统计
- **数据库表**: `time_clock_record` (复用)
- **API数量**: 6个
- **工作量**: 1天

#### 16. PlatformController - 平台管理
- **数据库表**: `platform_admins`
- **API数量**: 4个
- **工作量**: 0.5天

---

## 📋 实施清单总结

### 工作量估算

| 批次 | 模块数 | API总数 | 预估工时 | 包含内容 |
|------|--------|---------|----------|----------|
| **第一批** | 5个 | 49个 | 5-7天 | ProductType, MaterialType, Supplier, Customer, WorkType |
| **第二批** | 2个 | 18个 | 3天 | User, Whitelist |
| **第三批** | 4个 | 47个 | 9-11天 | ProcessingBatch, MaterialBatch, ProductionPlan, ConversionRate |
| **第四批** | 5个 | 31个 | 6天 | FactorySettings, Dashboard, Attendance, TimeStats, Platform |
| **总计** | **16个** | **145个** | **23-27天** | 完整后端实现 |

### 每个模块包含的文件

```
模块名称/
├── entity/XxxEntity.java          (JPA实体, ~100-150行)
├── repository/XxxRepository.java  (数据访问, ~50-80行)
├── service/XxxService.java        (业务逻辑, ~200-300行)
├── controller/XxxController.java  (REST API, ~150-250行)
└── dto/XxxDTO.java (可选)         (数据传输对象, ~50行)
```

### 关键技术要点

#### 1. 数据库字段映射（下划线 → 驼峰）

使用Jackson的PropertyNamingStrategy：
```java
@Configuration
public class JacksonConfig {
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setPropertyNamingStrategy(PropertyNamingStrategies.LOWER_CAMEL_CASE);
        return mapper;
    }
}
```

或在Entity上使用：
```java
@JsonProperty("isActive")
@Column(name = "is_active")
private Boolean isActive;
```

#### 2. UUID主键生成

```java
@PrePersist
public void generateId() {
    if (this.id == null) {
        this.id = UUID.randomUUID().toString();
    }
}
```

#### 3. 统一响应格式

```java
public class ApiResponse<T> {
    private boolean success;
    private int code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, 200, "操作成功", data);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }
}
```

#### 4. 分页查询

使用Spring Data JPA的Pageable：
```java
@GetMapping
public ResponseEntity<ApiResponse<Page<ProductType>>> getList(
    @PathVariable String factoryId,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
) {
    Pageable pageable = PageRequest.of(page, size);
    Page<ProductType> result = service.findByFactoryId(factoryId, pageable);
    return ResponseEntity.ok(ApiResponse.success(result));
}
```

#### 5. 全局异常处理

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<?>> handleNotFound(EntityNotFoundException e) {
        return ResponseEntity.status(404)
            .body(ApiResponse.error(404, e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<?>> handleDuplicate(DataIntegrityViolationException e) {
        return ResponseEntity.status(400)
            .body(ApiResponse.error(400, "数据重复或违反约束"));
    }
}
```

---

## 🚀 快速开始指南

### 第一步：实现ProductTypeController（示例）

1. **创建Entity** (`entity/ProductType.java`)
2. **创建Repository** (`repository/ProductTypeRepository.java`)
3. **创建Service** (`service/ProductTypeService.java`)
4. **创建Controller** (`controller/ProductTypeController.java`)
5. **编译测试**: `mvn clean compile`
6. **启动服务**: `mvn spring-boot:run`
7. **API测试**: `curl http://localhost:10010/api/mobile/F001/products/types`
8. **E2E测试脚本**: 创建 `tests/product-types/test-e2e.sh`

### 测试验证流程

每个模块完成后：
1. ✅ **编译通过**: `mvn clean package -DskipTests`
2. ✅ **服务启动**: 检查日志无错误
3. ✅ **API测试**: 测试所有端点（GET, POST, PUT, DELETE）
4. ✅ **前端集成**: 前端页面移除Mock数据，调用真实API
5. ✅ **数据验证**: 检查数据库数据正确性

---

## 📊 预期成果

完成所有实施后：
- ✅ **16个Controller** 全部实现
- ✅ **145个REST API** 全部可用
- ✅ **45个数据库表** 全部连接
- ✅ **26个前端API客户端** 全部激活
- ✅ **51个前端页面** 全部使用真实数据
- ✅ **100% E2E测试覆盖**

**系统完整度**: 从 5% → 100%

---

## 🔍 特别注意事项

### 数据库相关

1. **conversion_rates表需要创建** - 这个表在数据库中不存在
2. **外键约束** - 注意ON DELETE CASCADE和ON DELETE SET NULL
3. **唯一约束** - factory_id + name/code 必须唯一
4. **ENUM字段** - 使用@Enumerated(EnumType.STRING)
5. **JSON字段** - 使用@Column(columnDefinition = "JSON")

### 前端兼容

1. **字段命名** - 数据库下划线 → JSON驼峰
2. **响应格式** - 必须符合 ApiResponse<T> 格式
3. **分页格式** - 前端期望 {content: [], totalElements, totalPages}
4. **日期格式** - ISO8601格式 (2025-10-06T04:38:01.918)

### 性能优化

1. **索引使用** - 利用已有的索引（factory_id, is_active等）
2. **N+1问题** - 使用@EntityGraph或JOIN FETCH
3. **分页查询** - 大数据量必须分页
4. **缓存策略** - 考虑使用@Cacheable

---

## 📅 实施时间表

### Week 1 - 第一批P0基础数据
- Day 1-2: ProductType, MaterialType
- Day 3: Supplier
- Day 4: Customer
- Day 5: WorkType

### Week 2 - 第二批P0用户权限
- Day 1-2: User
- Day 3: Whitelist
- Day 4-5: 测试与优化

### Week 3 - 第三批P1生产管理(1)
- Day 1-3: ProcessingBatch
- Day 4-5: MaterialBatch

### Week 4 - 第三批P1生产管理(2)
- Day 1-2: ProductionPlan
- Day 3-4: ConversionRate (含建表)
- Day 5: 测试与优化

### Week 5 - 第四批P2辅助功能
- Day 1-2: FactorySettings, Dashboard
- Day 3: Attendance, TimeStats
- Day 4: Platform
- Day 5: 全面测试与优化

**总计**: 5周（25个工作日）完成所有后端开发

---

**创建者**: Claude Code Assistant
**创建日期**: 2025-11-19
**版本**: v1.0
**状态**: 待执行
