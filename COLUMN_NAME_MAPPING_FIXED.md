# 列名映射修复文档 (Column Name Mapping Fixed)

## 问题总结 (Problem Summary)

之前的SQL脚本中使用了错误的列名，导致8个表的INSERT失败。本文档详细说明了每个表的正确列名映射。

所有列名都是根据后端Spring Boot JPA entity类（`/backend-java/src/main/java/com/cretas/aims/entity/`）直接提取的。

---

## 1. Production Plans (生产计划)

### ❌ 之前错误的列名
```sql
INSERT INTO production_plans (id, factory_id, plan_number, period, status, total_planned_quantity, total_completed_quantity, ...)
```

### ✅ 正确的列名 (来自 ProductionPlan.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | VARCHAR(191) | 生产计划ID |
| factoryId | factory_id | VARCHAR | 工厂ID |
| planNumber | plan_number | VARCHAR(50) | 计划编号 (唯一) |
| productTypeId | product_type_id | VARCHAR(191) | 产品类型ID |
| plannedQuantity | planned_quantity | DECIMAL(10,2) | **计划数量** (✅ 正确列名) |
| actualQuantity | actual_quantity | DECIMAL(10,2) | 实际完成数量 |
| startTime | start_time | DATETIME | 开始时间 |
| endTime | end_time | DATETIME | 结束时间 |
| status | status | VARCHAR | 状态 (PENDING, IN_PROGRESS, COMPLETED) |
| customerOrderNumber | customer_order_number | VARCHAR(100) | 客户订单号 |
| priority | priority | INT | 优先级 |
| notes | notes | TEXT | 备注 |
| estimatedMaterialCost | estimated_material_cost | DECIMAL(10,2) | 估计材料成本 |
| estimatedLaborCost | estimated_labor_cost | DECIMAL(10,2) | 估计人工成本 |
| estimatedEquipmentCost | estimated_equipment_cost | DECIMAL(10,2) | 估计设备成本 |
| estimatedOtherCost | estimated_other_cost | DECIMAL(10,2) | 估计其他成本 |
| createdBy | created_by | INT | 创建人ID |

### ❌ 不存在的列
- `period` - **不存在** ❌
- `total_planned_quantity` - **应为 `planned_quantity`** ✅
- `total_completed_quantity` - **应为 `actual_quantity`** ✅

---

## 2. Material Batches (原料批次)

### ❌ 之前错误的列名
```sql
INSERT INTO material_batches (id, factory_id, batch_number, material_type_id, supplier_id, quantity, ...)
```

### ✅ 正确的列名 (来自 MaterialBatch.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | VARCHAR(191) | 批次ID |
| factoryId | factory_id | VARCHAR | 工厂ID |
| batchNumber | batch_number | VARCHAR(50) | 批次号 (唯一) |
| materialTypeId | material_type_id | VARCHAR(191) | 原料类型ID |
| supplierId | supplier_id | VARCHAR(191) | 供应商ID |
| receiptDate | inbound_date | DATE | **入库日期** (✅ 列名是 inbound_date) |
| purchaseDate | purchase_date | DATE | 采购日期 |
| expireDate | expire_date | DATE | 过期日期 |
| receiptQuantity | receipt_quantity | DECIMAL(10,2) | **收货数量** (✅ 正确列名) |
| quantityUnit | quantity_unit | VARCHAR(20) | 数量单位 |
| weightPerUnit | weight_per_unit | DECIMAL(10,3) | 单位重量 |
| usedQuantity | used_quantity | DECIMAL(10,2) | 已使用数量 |
| reservedQuantity | reserved_quantity | DECIMAL(10,2) | 保留数量 |
| unitPrice | unit_price | DECIMAL(10,2) | 单价 |
| status | status | VARCHAR | 状态 (AVAILABLE, USED, RESERVED, EXPIRED) |
| storageLocation | storage_location | VARCHAR(100) | 存储位置 |
| qualityCertificate | quality_certificate | VARCHAR(100) | 质量证书 |
| notes | notes | TEXT | 备注 |
| createdBy | created_by | INT | 创建人ID |

### ❌ 不存在的列
- `quantity` - **应为 `receipt_quantity`** ✅
- 列名应为 `inbound_date` 而非 `receiptDate` 的推测值

---

## 3. Processing Batches (加工批次)

### ❌ 之前错误的列名
```sql
INSERT INTO processing_batches (id, factory_id, batch_number, product_type_id, ...)
```

### ✅ 正确的列名 (来自 ProcessingBatch.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | VARCHAR(191) | 加工批次ID |
| factoryId | factory_id | VARCHAR | 工厂ID |
| batchNumber | batch_number | VARCHAR(50) | 批次号 (唯一) |
| productName | product_name | VARCHAR | 产品名称 |
| productType | product_type | VARCHAR(191) | 产品类型 (★ 注意: 不是 product_type_id) |
| quantity | quantity | DECIMAL(10,2) | 数量 |
| outputQuantity | actual_quantity | DECIMAL(10,2) | **实际产出** (列名 actual_quantity) |
| unit | unit | VARCHAR(20) | 单位 |
| startTime | start_time | DATETIME | 开始时间 |
| endTime | end_time | DATETIME | 结束时间 |
| status | status | VARCHAR(20) | 状态 (pending, processing, completed, cancelled) |
| supervisorId | supervisor_id | INT | 主管ID |
| materialCost | material_cost | DECIMAL(10,2) | 材料成本 |
| laborCost | labor_cost | DECIMAL(10,2) | 人工成本 |
| equipmentCost | equipment_cost | DECIMAL(10,2) | 设备成本 |
| otherCost | other_cost | DECIMAL(10,2) | 其他成本 |
| totalCost | total_cost | DECIMAL(10,2) | 总成本 |
| productionEfficiency | production_efficiency | DECIMAL(5,2) | 生产效率 (%) |
| notes | notes | TEXT | 备注 |

### ❌ 不存在的列
- `product_type_id` - **应为 `product_type`** (不是外键ID) ✅

---

## 4. Production Batches (生产批次)

### ❌ 之前错误的列名
```sql
INSERT INTO production_batches (id, factory_id, batch_number, product_type_id, production_plan_id, ..., start_date, end_date, ...)
```

### ✅ 正确的列名 (来自 ProductionBatch.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | BIGINT (自增) | **生产批次ID** (自动生成) |
| factoryId | factory_id | VARCHAR(50) | 工厂ID |
| batchNumber | batch_number | VARCHAR(50) | 批次号 (唯一) |
| productionPlanId | production_plan_id | INT | 生产计划ID |
| productTypeId | product_type_id | INT | **产品类型ID** (★ 注意: INT类型) |
| productName | product_name | VARCHAR(100) | 产品名称 |
| plannedQuantity | planned_quantity | DECIMAL(12,2) | 计划数量 |
| quantity | quantity | DECIMAL(10,2) | 数量 (NOT NULL) |
| unit | unit | VARCHAR(20) | 单位 (NOT NULL) |
| actualQuantity | actual_quantity | DECIMAL(12,2) | 实际产量 |
| goodQuantity | good_quantity | DECIMAL(12,2) | 良品数量 |
| defectQuantity | defect_quantity | DECIMAL(12,2) | 不良品数量 |
| status | status | VARCHAR(20) | 状态 (PLANNED, IN_PROGRESS, COMPLETED, CANCELLED) |
| qualityStatus | quality_status | VARCHAR(30) | 质量状态 |
| startTime | start_time | DATETIME | **开始时间** (不是 start_date) |
| endTime | end_time | DATETIME | **结束时间** (不是 end_date) |
| equipmentId | equipment_id | INT | 设备ID |
| equipmentName | equipment_name | VARCHAR(100) | 设备名称 |
| supervisorId | supervisor_id | INT | 主管ID |
| supervisorName | supervisor_name | VARCHAR(50) | 主管名称 |
| workerCount | worker_count | INT | 工人数量 |
| workDurationMinutes | work_duration_minutes | INT | 工作时长 (分钟) |
| materialCost | material_cost | DECIMAL(12,2) | 材料成本 |
| laborCost | labor_cost | DECIMAL(12,2) | 人工成本 |
| equipmentCost | equipment_cost | DECIMAL(12,2) | 设备成本 |
| otherCost | other_cost | DECIMAL(12,2) | 其他成本 |
| totalCost | total_cost | DECIMAL(12,2) | 总成本 |
| unitCost | unit_cost | DECIMAL(12,4) | 单位成本 |
| yieldRate | yield_rate | DECIMAL(5,2) | 良品率 (%) |
| efficiency | efficiency | DECIMAL(5,2) | 效率 (%) |
| notes | notes | TEXT | 备注 |
| createdBy | created_by | INT | 创建人ID |

### ❌ 不存在的列
- `start_date` - **应为 `start_time`** (DATETIME类型) ✅
- `end_date` - **应为 `end_time`** (DATETIME类型) ✅

---

## 5. Quality Inspections (质量检验)

### ❌ 之前错误的列名
```sql
INSERT INTO quality_inspections (id, factory_id, batch_id, batch_type, ...)
```

### ✅ 正确的列名 (来自 QualityInspection.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | VARCHAR(191) | 检验ID |
| factoryId | factory_id | VARCHAR | 工厂ID |
| productionBatchId | production_batch_id | VARCHAR(191) | **生产批次ID** (不是 batch_id) |
| inspectorId | inspector_id | INT | 检验员ID |
| inspectionDate | inspection_date | DATE | 检验日期 |
| sampleSize | sample_size | DECIMAL(10,2) | 抽样大小 |
| passCount | pass_count | DECIMAL(10,2) | 通过数量 |
| failCount | fail_count | DECIMAL(10,2) | 失败数量 |
| passRate | pass_rate | DECIMAL(5,2) | 通过率 (%) |
| result | result | VARCHAR(20) | 检验结果 (PASS, FAIL, CONDITIONAL) |
| notes | notes | TEXT | 备注 |

### ❌ 不存在的列
- `batch_id` - **应为 `production_batch_id`** ✅
- `batch_type` - **不存在** ❌

---

## 6. Equipment (设备)

### ❌ 之前错误的列名
```sql
INSERT INTO equipment (id, factory_id, name, code, equipment_type, ...)
```

### ✅ 正确的列名 (来自 Equipment.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | INT (自增) | 设备ID |
| factoryId | factory_id | VARCHAR | 工厂ID |
| code | code | VARCHAR(50) | 设备编码 (与factory_id组合唯一) |
| name | name | VARCHAR | 设备名称 |
| category | category | VARCHAR(50) | **分类** (不是 equipment_type) |
| model | model | VARCHAR(100) | 型号 |
| manufacturer | manufacturer | VARCHAR(100) | 制造商 |
| purchaseDate | purchase_date | DATE | 购买日期 |
| purchasePrice | purchase_price | DECIMAL(10,2) | 购买价格 |
| status | status | VARCHAR | 状态 (IDLE, IN_USE, MAINTENANCE, RETIRED) |
| location | location | VARCHAR(100) | 位置 |
| totalOperatingHours | total_operating_hours | INT | 总运行小时 |
| lastMaintenanceDate | last_maintenance_date | DATE | 最后维护日期 |
| nextMaintenanceDate | next_maintenance_date | DATE | 下次维护日期 |
| maintenanceIntervalDays | maintenance_interval_days | INT | 维护间隔天数 |
| maintenanceNotes | maintenance_notes | TEXT | 维护备注 |
| isActive | is_active | BOOLEAN | 是否活跃 |
| notes | notes | TEXT | 备注 |

### ❌ 不存在的列
- `equipment_type` - **应为 `category`** ✅

---

## 7. Equipment Alerts (设备告警)

### ❌ 之前错误的列名
```sql
INSERT INTO equipment_alerts (id, factory_id, equipment_id, alert_type, level, description, ...)
```

### ✅ 正确的列名 (来自 EquipmentAlert.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | INT (自增) | 告警ID |
| factoryId | factory_id | VARCHAR(50) | 工厂ID |
| equipmentId | equipment_id | VARCHAR(191) | 设备ID |
| alertType | alert_type | VARCHAR(50) | 告警类型 |
| level | level | VARCHAR(20) | 告警级别 (INFO, WARNING, ERROR) |
| status | status | VARCHAR(20) | 告警状态 (ACTIVE, ACKNOWLEDGED, RESOLVED, IGNORED) |
| message | message | TEXT | **告警消息** (不是 description) |
| details | details | TEXT | 详细信息 |
| triggeredAt | triggered_at | DATETIME | 触发时间 |
| acknowledgedAt | acknowledged_at | DATETIME | 确认时间 |
| acknowledgedBy | acknowledged_by | INT | 确认人ID |
| acknowledgedByName | acknowledged_by_name | VARCHAR(100) | 确认人名称 |
| resolvedAt | resolved_at | DATETIME | 解决时间 |
| resolvedBy | resolved_by | INT | 解决人ID |
| resolvedByName | resolved_by_name | VARCHAR(100) | 解决人名称 |
| resolutionNotes | resolution_notes | TEXT | 解决方案备注 |
| ignoredAt | ignored_at | DATETIME | 忽略时间 |
| ignoredBy | ignored_by | INT | 忽略人ID |
| ignoredByName | ignored_by_name | VARCHAR(100) | 忽略人名称 |
| ignoreReason | ignore_reason | TEXT | 忽略原因 |

### ❌ 不存在的列
- `description` - **应为 `message` 或 `details`** ✅

---

## 8. Factory Settings (工厂设置)

### ❌ 之前错误的列名
```sql
INSERT INTO factory_settings (id, factory_id, setting_key, setting_value, ...)
```

### ✅ 正确的列名 (来自 FactorySettings.java)

| 实体属性 | 数据库列名 | 数据类型 | 说明 |
|---------|----------|---------|-----|
| id | id | INT (自增) | 设置ID |
| factoryId | factory_id | VARCHAR(50) | 工厂ID (唯一) |
| aiSettings | ai_settings | TEXT | AI设置JSON |
| aiWeeklyQuota | ai_weekly_quota | INT | AI周配额 |
| allowSelfRegistration | allow_self_registration | BOOLEAN | 是否允许自注册 |
| requireAdminApproval | require_admin_approval | BOOLEAN | 是否需要管理员审批 |
| defaultUserRole | default_user_role | VARCHAR(50) | 默认用户角色 |
| notificationSettings | notification_settings | TEXT | 通知设置JSON |
| workTimeSettings | work_time_settings | TEXT | 工作时间设置JSON |
| productionSettings | production_settings | TEXT | 生产设置JSON |
| inventorySettings | inventory_settings | TEXT | 库存设置JSON |
| dataRetentionSettings | data_retention_settings | TEXT | 数据保留设置JSON |
| language | language | VARCHAR(10) | 语言 |
| timezone | timezone | VARCHAR(50) | 时区 |
| dateFormat | date_format | VARCHAR(20) | 日期格式 |
| currency | currency | VARCHAR(10) | 货币 |
| enableQrCode | enable_qr_code | BOOLEAN | 是否启用二维码 |
| enableBatchManagement | enable_batch_management | BOOLEAN | 是否启用批次管理 |
| enableQualityCheck | enable_quality_check | BOOLEAN | 是否启用质量检查 |
| enableCostCalculation | enable_cost_calculation | BOOLEAN | 是否启用成本计算 |
| enableEquipmentManagement | enable_equipment_management | BOOLEAN | 是否启用设备管理 |
| enableAttendance | enable_attendance | BOOLEAN | 是否启用考勤 |
| createdBy | created_by | INT | 创建人ID |
| updatedBy | updated_by | INT | 更新人ID |
| lastModifiedAt | last_modified_at | DATETIME | 最后修改时间 |

### ❌ 不存在的列
- `setting_key` - **不存在，应为具体的配置列** ❌
- `setting_value` - **不存在，应为具体的配置列** ❌
- FactorySettings表采用**专用列设计**而非通用的key-value设计 ✅

---

## 使用说明 (Usage Instructions)

### 1. 执行修复版本的SQL
```bash
mysql -u cretas -pSyS6Jp3pyFMwLdA -h 139.196.165.140 cretas_db < server_complete_business_data_FIXED.sql
```

### 2. 验证导入结果
执行脚本后，系统会自动输出验证统计：
```
✅ 生产计划 - Count
✅ 原料批次 - Count
✅ 加工批次 - Count
✅ 生产批次 - Count
✅ 质量检验 - Count
✅ 设备 - Count
✅ 设备告警 - Count
✅ 工作类型 - Count
✅ 工厂设置 - Count
```

### 3. 检查错误
如果仍然有错误，查看错误消息中的列名，与本文档对比。

---

## 关键修复点总结 (Key Fixes Summary)

| 表名 | 错误列名 | 正确列名 | 说明 |
|-----|---------|---------|-----|
| production_plans | period | (已删除) | 该列不存在 |
| production_plans | total_planned_quantity | planned_quantity | 列名映射 |
| production_plans | total_completed_quantity | actual_quantity | 列名映射 |
| material_batches | quantity | receipt_quantity | 原料批次的收货数量 |
| material_batches | (隐含) | inbound_date | 应使用inbound_date而非receiptDate |
| processing_batches | product_type_id | product_type | STRING类型，非外键ID |
| production_batches | start_date | start_time | DATETIME类型 |
| production_batches | end_date | end_time | DATETIME类型 |
| quality_inspections | batch_id | production_batch_id | 外键引用production_batches |
| quality_inspections | batch_type | (已删除) | 该列不存在 |
| equipment | equipment_type | category | 设备分类 |
| equipment_alerts | description | message | 告警消息 |
| factory_settings | setting_key | (多个列) | key-value设计改为专用列 |
| factory_settings | setting_value | (多个列) | key-value设计改为专用列 |

---

## 参考资源 (References)

- **JPA Entity类路径**: `/backend-java/src/main/java/com/cretas/aims/entity/`
- **修复版SQL**: `/server_complete_business_data_FIXED.sql`
- **本映射文档**: `/COLUMN_NAME_MAPPING_FIXED.md`

---

生成时间: 2025-11-22
作者: Claude Code Assistant
