# API 文档完善计划

> 更新时间: 2026-01-02 23:45

## 概述

为 Swagger/OpenAPI 和 FoxAPI 完善所有 API 接口的文档，包括：
- 接口描述 (`@Operation description`)
- 参数说明 (`@Parameter description + example`)
- 模块标签 (`@Tag description`)

---

## 进度总览

| 状态 | 批次 | Controllers | 接口数 | 进度 |
|------|------|-------------|--------|------|
| ✅ 已完成 | 批次1-3 | 11 | ~280 | 100% |
| ✅ 已完成 | 批次4 | 10 | ~60 | 100% |
| ⏳ 进行中 | 批次5 | 33 | ~100 | 40% |

**总进度**: ~380/440 接口 (**86%**)

---

## 已完成 (批次1-3)

### 批次1 - 核心业务 (5 Controllers, 147 接口)

| Controller | 接口数 | 说明 |
|------------|--------|------|
| MobileController | 35 | 移动端认证、健康检查、工厂初始化 |
| ProcessingController | 41 | 生产批次、加工阶段、包装管理 |
| ProductionPlanController | 20 | 生产计划CRUD、排产、物料匹配 |
| MaterialBatchController | 26 | 原材料批次管理、库存查询 |
| UserController | 25 | 用户管理、角色权限、部门分配 |

### 批次2 - 质量设备 (4 Controllers, 63 接口)

| Controller | 接口数 | 说明 |
|------------|--------|------|
| QualityDispositionController | 9 | 质量处置规则、审批流程 |
| QualityCheckItemController | 21 | 检验项目配置、检验模板 |
| EquipmentController | 26 | 设备管理、维护记录 |
| EquipmentAlertsController | 7 | 设备告警、告警处理 |

### 批次3 - 调度排产 (2 Controllers, 58 接口)

| Controller | 接口数 | 说明 |
|------------|--------|------|
| SchedulingController | 48 | 排产调度、工人分配、产能管理 |
| UrgentInsertController | 10 | 紧急插单、时隙管理 |

---

## 已完成 (批次4 - AI与报表)

| Controller | 接口数 | 说明 |
|------------|--------|------|
| AIController | 8 | AI 聊天、成本分析、报告生成 |
| AIIntentConfigController | 6 | 意图配置、参数设置 |
| ReportController | 15 | 报表生成、Dashboard数据 |
| VoiceRecognitionController | 4 | 语音识别、语音输入 |
| FormAssistantController | 5 | 表单智能助手、Schema生成 |
| LinUCBController | 3 | 智能推荐算法 |
| AIRuleController | 6 | AI 规则管理 |
| AIBusinessDataController | 5 | AI 业务数据初始化 |
| AIQuotaConfigController | 4 | AI 配额管理 |
| IntentAnalysisController | 4 | 意图分析、数据操作 |

---

## 批次5 进行中 - 配置与平台 (33 Controllers, ~100 接口)

### ✅ 已完成

| Controller | 接口数 | 完成时间 |
|------------|--------|----------|
| FactorySettingsController | 27 | 2026-01-02 |
| NotificationController | 9 | 2026-01-02 |
| WorkSessionController | 15 | (已有文档) |
| TimeStatsController | 17 | (已有文档) |
| ProductTypeController | 18 | (已有文档) |

### ⏳ 待处理

#### 模板与规则
| Controller | 预估接口 | 说明 |
|------------|----------|------|
| FormTemplateController | 18 | 表单模板管理、版本控制 |
| EncodingRuleController | 16 | 编码规则配置、生成测试 |
| TemplatePackageController | 4 | 模板包 |
| RuleController | 4 | 规则管理 |
| RulePackController | 3 | 规则包 |
| ConfigChangeSetController | 3 | 配置变更集 |

#### 基础配置
| Controller | 预估接口 | 说明 |
|------------|----------|------|
| SupplierController | 6 | 供应商管理 |
| CustomerController | 6 | 客户管理 |
| DepartmentController | 5 | 部门管理 |
| RawMaterialTypeController | 4 | 原材料类型 |
| ConversionController | 5 | 转换率配置 |

#### 系统功能
| Controller | 预估接口 | 说明 |
|------------|----------|------|
| TimeClockController | 6 | 考勤打卡 |
| ShipmentController | 8 | 出货管理 |
| TraceabilityController | 5 | 溯源查询 |
| DisposalController | 4 | 废弃处理 |

#### 平台管理
| Controller | 预估接口 | 说明 |
|------------|----------|------|
| PlatformController | 8 | 平台管理、工厂CRUD |
| FactoryBlueprintController | 5 | 工厂蓝图 |
| BlueprintVersionController | 4 | 蓝图版本 |
| SystemController | 3 | 系统信息 |
| SystemConfigController | 4 | 系统配置 |

#### 其他功能
| Controller | 预估接口 | 说明 |
|------------|----------|------|
| WhitelistController | 4 | 白名单管理 |
| WorkTypeController | 3 | 工种管理 |
| MaterialSpecConfigController | 3 | 材料规格 |
| MixedBatchController | 3 | 混批管理 |
| CameraController | 2 | 相机拍照 |
| DeviceController | 3 | 设备绑定 |
| ApprovalChainController | 4 | 审批链 |
| SupplierAdmissionController | 4 | 供应商准入 |
| MaterialConsumptionController | 3 | 物料消耗 |
| WorkOrderController | 新增 | 工单管理 |
| LabelController | 新增 | 标签管理 |
| BatchRelationController | 新增 | 批次关联 |

---

## 文档格式规范

### @Tag 模块标签
```java
@Tag(name = "通知管理", description = "通知管理相关接口，包括通知列表查询、未读数量统计、最近通知获取、通知详情查看、已读标记（单条/全部）、通知创建和删除等功能")
```

### @Operation 接口描述
```java
@Operation(
    summary = "获取通知列表",
    description = "分页获取工厂的通知列表，支持按通知类型和已读状态筛选，默认按创建时间倒序排列"
)
```

### @Parameter 参数说明
```java
@PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
@RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
@RequestParam(required = false) @Parameter(description = "通知类型: INFO/WARNING/ERROR/SUCCESS", example = "INFO") NotificationType type,
@RequestBody @Parameter(description = "通知信息，包含标题、内容、类型等") Notification notification
```

---

## 验证方式

1. 启动后端服务
2. 访问 Swagger UI: `http://localhost:10010/swagger-ui.html`
3. 检查各接口的描述、参数、响应是否正确显示
4. 使用 FoxAPI 导入验证

---

## 下次继续点

**当前任务**: FormTemplateController (18 endpoints) - 表单模板管理

**任务队列**:
1. FormTemplateController - 表单模板
2. EncodingRuleController - 编码规则
3. 其余 Batch 5 Controllers

---

## 备注

- 所有描述使用中文
- 遵循现有代码风格
- 参数 example 使用真实有效的示例值
- @PathVariable factoryId 统一使用 `example = "F001"`
- page 参数说明是否 0-based 或 1-based
