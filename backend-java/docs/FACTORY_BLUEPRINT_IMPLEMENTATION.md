# 工厂类型蓝图实现文档

## 概述

工厂类型蓝图功能允许平台批量下发标准配置到新工厂，实现快速初始化和标准化管理。

**实现日期**: 2025-12-31
**版本**: 1.0.0
**状态**: 已完成实现（待编译环境修复后测试）

---

## 功能特性

### 1. 核心功能
- 创建和管理工厂类型蓝图（水产加工厂、肉类加工厂、通用食品厂等）
- 将蓝图配置应用到新工厂
- 预览蓝图应用效果（Dry-run模式）
- 从现有工厂生成新蓝图
- 查询蓝图应用历史

### 2. 蓝图包含内容
- **表单模板**: 自定义业务表单（验收表、质检表、加工记录表）
- **产品类型**: 产品定义和加工流程
- **规则配置**: 业务规则和阈值（预留）
- **部门结构**: 组织架构模板（预留）
- **默认配置**: 产能、班次、质量标准等

---

## 数据库设计

### 表结构

#### 1. factory_type_blueprints（工厂类型蓝图表）
```sql
CREATE TABLE factory_type_blueprints (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                     -- 蓝图名称
    description TEXT,                               -- 描述
    industry_type VARCHAR(50),                      -- 行业类型
    default_config JSON,                            -- 默认配置
    form_templates JSON,                            -- 表单模板
    rule_templates JSON,                            -- 规则模板
    product_type_templates JSON,                    -- 产品类型模板
    department_templates JSON,                      -- 部门模板
    is_active BOOLEAN DEFAULT TRUE,                 -- 是否激活
    version INT DEFAULT 1,                          -- 版本号
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);
```

#### 2. blueprint_applications（蓝图应用记录表）
```sql
CREATE TABLE blueprint_applications (
    id VARCHAR(36) PRIMARY KEY,
    blueprint_id VARCHAR(36) NOT NULL,              -- 蓝图ID
    factory_id VARCHAR(50) NOT NULL,                -- 工厂ID
    applied_by BIGINT,                              -- 应用人用户ID
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 应用时间
    status VARCHAR(20) DEFAULT 'COMPLETED',         -- 状态
    result_summary TEXT,                            -- 应用结果摘要
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);
```

### 默认蓝图数据
- **BLUEPRINT_SEAFOOD_001**: 水产加工厂标准蓝图
- **BLUEPRINT_MEAT_001**: 肉类加工厂标准蓝图
- **BLUEPRINT_GENERAL_001**: 通用食品加工厂蓝图

---

## API 接口

### 基础路径
```
/api/platform/blueprints
```

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/blueprints` | 获取所有蓝图列表 |
| GET | `/api/platform/blueprints/{id}` | 获取蓝图详情 |
| POST | `/api/platform/blueprints` | 创建蓝图 |
| PUT | `/api/platform/blueprints/{id}` | 更新蓝图 |
| DELETE | `/api/platform/blueprints/{id}` | 删除蓝图（软删除） |
| POST | `/api/platform/blueprints/{id}/apply` | 应用蓝图到工厂 |
| POST | `/api/platform/blueprints/{id}/preview` | 预览蓝图应用效果 |
| POST | `/api/platform/blueprints/generate-from-factory` | 从工厂生成蓝图 |
| GET | `/api/platform/blueprints/history/{factoryId}` | 查询工厂应用历史 |

---

## 使用示例

### 1. 获取所有蓝图
```bash
GET /api/platform/blueprints
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "BLUEPRINT_SEAFOOD_001",
      "name": "水产加工厂标准蓝图",
      "description": "适用于水产品加工企业...",
      "industryType": "SEAFOOD_PROCESSING",
      "isActive": true,
      "version": 1
    }
  ],
  "message": "获取蓝图列表成功"
}
```

### 2. 应用蓝图到工厂
```bash
POST /api/platform/blueprints/BLUEPRINT_SEAFOOD_001/apply
Content-Type: application/json

{
  "factoryId": "F12345",
  "appliedBy": 1,
  "preview": false
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "applicationId": "app-uuid-123",
    "blueprintId": "BLUEPRINT_SEAFOOD_001",
    "blueprintName": "水产加工厂标准蓝图",
    "factoryId": "F12345",
    "status": "COMPLETED",
    "formTemplatesCreated": 3,
    "productTypesCreated": 2,
    "rulesCreated": 0,
    "departmentsCreated": 0,
    "logs": [
      "处理表单模板: 水产原料验收表 (MATERIAL_RECEIPT)",
      "处理表单模板: 冷冻加工记录表 (PROCESSING)",
      "成功应用 3 个表单模板",
      "处理产品类型: 冷冻鱼片 (冷冻水产)",
      "成功应用 2 个产品类型"
    ],
    "summary": "成功应用蓝图 '水产加工厂标准蓝图' 到工厂 F12345。创建了 3 个表单模板，2 个产品类型。"
  },
  "message": "成功应用蓝图..."
}
```

### 3. 预览蓝图应用效果（Dry-run）
```bash
POST /api/platform/blueprints/BLUEPRINT_SEAFOOD_001/preview?factoryId=F12345
```

**说明**: 预览模式不会实际创建数据，只返回将要创建的内容清单。

### 4. 从现有工厂生成蓝图
```bash
POST /api/platform/blueprints/generate-from-factory
Content-Type: application/json

{
  "factoryId": "F12345",
  "blueprintName": "我的自定义水产蓝图",
  "description": "基于F12345工厂配置生成",
  "industryType": "SEAFOOD_PROCESSING",
  "includeFormTemplates": true,
  "includeRules": false,
  "includeProductTypes": true,
  "includeDepartments": false
}
```

---

## 文件结构

```
backend-java/src/main/java/com/cretas/aims/
├── entity/config/
│   ├── FactoryTypeBlueprint.java          # 蓝图实体
│   └── BlueprintApplication.java          # 应用记录实体
├── repository/config/
│   ├── FactoryTypeBlueprintRepository.java
│   └── BlueprintApplicationRepository.java
├── service/
│   ├── FactoryBlueprintService.java       # 服务接口
│   └── impl/
│       └── FactoryBlueprintServiceImpl.java
├── controller/
│   └── FactoryBlueprintController.java    # REST API控制器
└── dto/blueprint/
    ├── CreateBlueprintRequest.java
    ├── ApplyBlueprintRequest.java
    ├── BlueprintApplicationResult.java
    └── GenerateBlueprintFromFactoryRequest.java

backend-java/src/main/resources/db/migration/
└── V2025_12_31_2__factory_type_blueprints.sql  # 数据库迁移脚本
```

---

## 核心实现逻辑

### 应用蓝图流程
1. **验证蓝图**: 检查蓝图ID是否存在
2. **创建应用记录**: 记录应用状态为 IN_PROGRESS
3. **应用表单模板**:
   - 解析蓝图中的 `formTemplates` JSON
   - 为每个模板创建 `FormTemplate` 实体
   - 设置 `factoryId`、`source=IMPORT`、`sourcePackageId=blueprintId`
4. **应用产品类型**:
   - 解析蓝图中的 `productTypeTemplates` JSON
   - 为每个产品创建 `ProductType` 实体
   - 自动生成产品编码
5. **更新应用状态**: 标记为 COMPLETED
6. **返回结果**: 包含创建统计和详细日志

### JSON数据格式

#### 表单模板 (formTemplates)
```json
[
  {
    "name": "水产原料验收表",
    "type": "MATERIAL_RECEIPT",
    "fields": ["batchNumber", "species", "weight", "temperature", "freshness"]
  }
]
```

#### 产品类型模板 (productTypeTemplates)
```json
[
  {
    "name": "冷冻鱼片",
    "category": "冷冻水产",
    "processSteps": ["解冻", "清洗", "切片", "速冻", "包装"]
  }
]
```

---

## 技术要点

### 1. JSON存储
- Entity中使用 `String` 类型存储JSON数据（避免hibernate-types依赖）
- Service层使用 `ObjectMapper` 进行序列化/反序列化
- 支持灵活的JSON结构

### 2. 事务管理
- 所有写操作使用 `@Transactional` 注解
- 应用蓝图失败时自动回滚

### 3. 软删除
- 所有实体继承 `BaseEntity`，支持软删除
- 查询时过滤 `deletedAt IS NULL`

### 4. 版本控制
- 蓝图支持版本号，每次更新递增
- 便于追踪蓝图演化历史

---

## 扩展计划

### 短期（P1）
- [x] 表单模板应用
- [x] 产品类型应用
- [ ] 规则配置应用
- [ ] 部门结构应用

### 中期（P2）
- [ ] 蓝图版本比较功能
- [ ] 蓝图差异化应用（仅应用部分配置）
- [ ] 蓝图继承机制（基于父蓝图扩展）

### 长期（P3）
- [ ] 蓝图市场（共享和下载社区蓝图）
- [ ] AI自动生成蓝图
- [ ] 蓝图应用回滚功能

---

## 注意事项

### 编译环境
当前代码因Lombok与Java 17兼容性问题无法编译，需要：
- 升级Lombok到最新版本（1.18.30+）
- 或降级Java版本到Java 11
- 或手动生成Getter/Setter替换Lombok注解

### 数据库迁移
运行Flyway迁移脚本前，确保：
- 数据库支持JSON字段类型（MySQL 5.7.8+）
- 备份现有数据
- 检查是否有同名蓝图冲突

### 权限控制
- 蓝图管理API应仅对平台管理员开放
- 建议添加 `@PreAuthorize` 注解进行权限校验

---

## 测试清单

### 单元测试
- [ ] FactoryBlueprintService 各方法测试
- [ ] JSON序列化/反序列化测试
- [ ] 异常场景测试

### 集成测试
- [ ] 完整蓝图应用流程测试
- [ ] 预览模式测试
- [ ] 从工厂生成蓝图测试
- [ ] 事务回滚测试

### API测试
- [ ] Postman测试用例
- [ ] 边界条件测试
- [ ] 并发应用测试

---

## 总结

本次实现完成了工厂类型蓝图的核心功能，包括：
- 完整的数据库设计和迁移脚本
- Entity、Repository、Service、Controller四层架构
- 8个REST API接口
- 3个默认蓝图数据
- 支持预览模式和从工厂生成蓝图

**代码质量**:
- 遵循项目规范（snake_case数据库，camelCase Java）
- 完整的JavaDoc注释
- 统一的响应格式 `{success, data, message}`
- 事务管理和异常处理

**待完成工作**:
- 修复编译环境问题
- 补充单元测试和集成测试
- 实现规则配置和部门结构应用
- 添加权限控制
