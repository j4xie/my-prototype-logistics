# 业务模块组件文档

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

本目录包含食品溯源系统的业务模块组件文档，按功能模块组织，详细说明每个业务组件的用途、属性和使用方式。

## 业务模块组件列表

### 溯源模块组件

#### 溯源查询组件
- TraceQuery - 溯源查询表单组件
- TraceResult - 溯源结果展示组件
- TraceDetail - 溯源详情组件
- TraceTimeline - 溯源时间线组件
- TraceMap - 溯源地图组件
- QRScanner - 二维码扫描组件

#### 溯源管理组件
- BatchList - 批次列表组件
- BatchCreate - 批次创建表单组件
- BatchEditor - 批次编辑组件
- CertificateGenerator - 证书生成组件
- CertificateViewer - 证书查看组件

### 农业/养殖模块组件

#### 数据采集组件
- DataCollectionForm - 数据采集表单组件
- FieldSelector - 田地选择组件
- CropSelector - 作物选择组件
- WeatherDisplay - 天气数据展示组件
- SensorData - 传感器数据组件

#### 环境监控组件
- EnvironmentMonitor - 环境监控组件
- GrowthChart - 生长曲线图表组件
- FeedingRecord - 饲喂记录组件
- VaccineRecord - 疫苗接种记录组件
- BreedingRecord - 繁殖记录组件

### 加工模块组件

#### 质量检测组件
- QualityTest - 质量检测表单组件
- TestResult - 检测结果展示组件
- SampleManager - 样品管理组件
- InspectionReport - 检验报告组件

#### 加工记录组件
- ProcessingRecord - 加工记录表单组件
- ProcessingTimeline - 加工时间线组件
- ProcessingStep - 加工步骤组件
- EnvironmentLog - 环境日志组件
- EquipmentLog - 设备日志组件

### 物流模块组件

#### 运输组件
- ShipmentTracker - 运输跟踪组件
- RouteMap - 路线地图组件
- DeliveryStatus - 配送状态组件
- VehicleMonitor - 车辆监控组件
- TemperatureLog - 温度日志组件

#### 库存组件
- InventoryList - 库存列表组件
- StockMovement - 库存移动记录组件
- WarehouseMap - 仓库地图组件
- StorageCondition - 储存条件监控组件
- ExpiryAlert - 过期提醒组件

### 管理模块组件

#### 用户管理组件
- UserList - 用户列表组件
- RoleEditor - 角色编辑组件
- PermissionSettings - 权限设置组件
- ActivityLog - 活动日志组件
- UserProfile - 用户档案组件

#### 数据分析组件
- AnalyticsDashboard - 分析仪表盘组件
- ReportGenerator - 报告生成组件
- DataExport - 数据导出组件
- TrendChart - 趋势图表组件
- ComparisonTable - 比较表格组件

## 组件文档格式

每个模块组件文档包含以下部分：

1. **组件描述**：概述组件的业务用途和特点
2. **组件属性**：详细列出组件的所有属性、类型和默认值
3. **数据需求**：组件所需的数据结构和格式
4. **事件**：组件触发的事件列表
5. **使用示例**：基本用法和高级用法示例
6. **业务流程**：组件在业务流程中的位置和作用
7. **交互说明**：组件的交互逻辑和流程
8. **API参考**：完整的API文档
9. **依赖关系**：组件的依赖和被依赖组件

## 文档开发进度

业务模块组件文档正在开发中，预计将分模块完成。优先开发核心溯源模块的组件文档，随后完成其他模块的组件文档。

查看[组件概览](../overview.md)了解组件系统的设计原则和组织结构。 