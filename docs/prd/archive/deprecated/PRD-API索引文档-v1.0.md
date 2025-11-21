# 白垩纪食品溯源系统 - API索引文档 v1.0

> **版本**: v1.0
> **生成日期**: 2025-11-20
> **文档策略**: 分层文档模式
> **总API数**: 397个端点

---

## 📚 文档结构说明

### 文档分层策略

本项目采用**分层文档模式**，将397个API端点分为两层文档：

**第1层：核心API主文档**（20-30个最重要API）
- 📄 文件：`PRD-API端点完整文档-v3.0.md`
- 📊 详细程度：**超详细（8个维度完整分析）**
- 📌 包含内容：
  - 基本信息、请求参数详解、响应结构详解
  - 业务逻辑详解、数据库操作详解
  - 性能考虑、安全措施、代码示例、FAQ
- ✅ 已完成：7/25个核心API

**第2层：Controller分文档**（25个文档，覆盖全部397端点）
- 📄 文件：`PRD-API-{ControllerName}.md`
- 📊 详细程度：**中等详细（5个维度分析）**
- 📌 包含内容：
  - 基本信息、请求参数、响应结构
  - 业务逻辑核心、代码示例
- ⏳ 待创建：25个Controller文档

---

## 🔍 快速查找API

### 按功能模块查找

#### 1. 认证与授权模块
| API端点 | 功能 | 文档位置 | 详细程度 |
|---------|------|----------|---------|
| `POST /api/mobile/auth/unified-login` | 统一登录 | [主文档 §1.1](PRD-API端点完整文档-v3.0.md#11-统一登录-unified-login) | ⭐⭐⭐ 超详细 |
| `POST /api/mobile/auth/refresh` | Token刷新 | [主文档 §1.2](PRD-API端点完整文档-v3.0.md#12-token刷新-refresh-token) | ⭐⭐⭐ 超详细 |
| `POST /api/mobile/auth/logout` | 用户登出 | [主文档 §1.3](PRD-API端点完整文档-v3.0.md#13-用户登出-logout) | ⭐⭐⭐ 超详细 |
| `POST /api/mobile/auth/send-verification-code` | 发送验证码 | [主文档 §1.4](PRD-API端点完整文档-v3.0.md#14-发送验证码-send-verification-code) | ⭐⭐⭐ 超详细 |
| ... 其他6个认证API | ... | [MobileController分文档](PRD-API-MobileController.md) (待创建) | ⭐⭐ 中等详细 |

#### 2. 生产加工模块
| API端点 | 功能 | 文档位置 | 详细程度 |
|---------|------|----------|---------|
| `POST /api/mobile/{factoryId}/processing/batches` | 创建生产批次 | [主文档 §2.1](PRD-API端点完整文档-v3.0.md#21-创建生产批次-create-production-batch) | ⭐⭐⭐ 超详细 |
| `POST /api/mobile/{factoryId}/processing/batches/{batchId}/start` | 开始生产 | [主文档 §2.2](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 |
| `POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause` | 暂停生产 | [ProcessingController分文档](PRD-API-ProcessingController.md) (待创建) | ⭐⭐ 中等详细 |
| `POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete` | 完成生产 | [ProcessingController分文档](PRD-API-ProcessingController.md) (待创建) | ⭐⭐ 中等详细 |
| `POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel` | 取消生产 | [ProcessingController分文档](PRD-API-ProcessingController.md) (待创建) | ⭐⭐ 中等详细 |
| ... 其他18个生产API | ... | [ProcessingController分文档](PRD-API-ProcessingController.md) (待创建) | ⭐⭐ 中等详细 |

#### 3. 原材料批次管理模块 ⭐E2E测试重点
| API端点 | 功能 | 文档位置 | 详细程度 | E2E测试 |
|---------|------|----------|---------|---------|
| `POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen` | 转为冻品 | [主文档 §3.1](PRD-API端点完整文档-v3.0.md#31-转为冻品-convert-to-frozen) | ⭐⭐⭐ 超详细 | ✅ 已验证 |
| `POST /api/mobile/{factoryId}/material-batches/{batchId}/undo-frozen` | 撤销转冻品（10分钟窗口） | [主文档 §3.2](PRD-API端点完整文档-v3.0.md#32-撤销转冻品-undo-frozen) | ⭐⭐⭐ 超详细 | ✅ 已验证 |
| `POST /api/mobile/{factoryId}/material-batches` | 创建原材料批次 | [主文档 §3.3](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 | - |
| `GET /api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}` | FIFO批次查询 | [主文档 §3.4](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 | - |
| ... 其他21个原材料API | ... | [MaterialBatchController分文档](PRD-API-MaterialBatchController.md) (待创建) | ⭐⭐ 中等详细 | - |

#### 4. 设备管理模块 ⭐E2E测试重点
| API端点 | 功能 | 文档位置 | 详细程度 | E2E测试 |
|---------|------|----------|---------|---------|
| `GET /api/mobile/{factoryId}/equipment-alerts` | 获取设备告警列表 | [主文档 §4.1](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 | ✅ 已验证（currentPage字段） |
| `POST /api/mobile/{factoryId}/equipment` | 创建设备 | [主文档 §4.2](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 | - |
| `PUT /api/mobile/{factoryId}/equipment/{equipmentId}/status` | 更新设备状态 | [主文档 §4.3](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 | - |
| ... 其他22个设备API | ... | [EquipmentController分文档](PRD-API-EquipmentController.md) (待创建) | ⭐⭐ 中等详细 | - |

#### 5. 质量检验模块
| API端点 | 功能 | 文档位置 | 详细程度 |
|---------|------|----------|---------|
| `POST /api/mobile/{factoryId}/quality-inspections` | 提交质检记录 | [主文档 §5.1](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 |
| `GET /api/mobile/{factoryId}/quality-inspections` | 获取质检记录 | [主文档 §5.2](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 |
| `GET /api/mobile/{factoryId}/quality-inspections/statistics` | 质检统计 | [主文档 §5.3](PRD-API端点完整文档-v3.0.md) (规划中) | ⭐⭐⭐ 超详细 |
| ... 其他10个质检API | ... | [QualityInspectionController分文档](PRD-API-QualityInspectionController.md) (待创建) | ⭐⭐ 中等详细 |

---

## 📊 按Controller分类

### 核心Controller（前10个，覆盖80%业务）

| Controller | 端点数 | 基础路径 | 核心功能 | 文档状态 |
|-----------|--------|---------|---------|---------|
| **MobileController** | 36 | `/api/mobile` | 认证、文件上传、告警 | 🔨 主文档4个 + 分文档待创建 |
| **ProcessingController** | 23 | `/api/mobile/{factoryId}/processing` | 生产加工管理 | 🔨 主文档1个 + 分文档待创建 |
| **MaterialBatchController** | 25 | `/api/mobile/{factoryId}/material-batches` | 原材料批次管理 | 🔨 主文档2个 + 分文档待创建 |
| **EquipmentController** | 25 | `/api/mobile/{factoryId}/equipment` | 设备管理 | ⏳ 分文档待创建 |
| **CustomerController** | 26 | `/api/mobile/{factoryId}/customers` | 客户管理 | ⏳ 分文档待创建 |
| **FactorySettingsController** | 22 | `/api/mobile/{factoryId}/settings` | 工厂设置 | ⏳ 分文档待创建 |
| **WhitelistController** | 20 | `/api/{factoryId}/whitelist` | 白名单管理 | ⏳ 分文档待创建 |
| **ProductionPlanController** | 20 | `/api/mobile/{factoryId}/production-plans` | 生产计划 | ⏳ 分文档待创建 |
| **SupplierController** | 19 | `/api/mobile/{factoryId}/suppliers` | 供应商管理 | ⏳ 分文档待创建 |
| **ReportController** | 19 | `/api/mobile/{factoryId}/reports` | 报表统计 | ⏳ 分文档待创建 |

**小计**: 235个端点 (59%)

### 辅助Controller（15个，覆盖其余41%）

| Controller | 端点数 | 基础路径 | 核心功能 | 文档状态 |
|-----------|--------|---------|---------|---------|
| TimeStatsController | 17 | `/api/mobile/{factoryId}/time-stats` | 考勤统计 | ⏳ 分文档待创建 |
| MaterialTypeController | 16 | `/api/mobile/{factoryId}/materials/types` | 物料类型 | ⏳ 分文档待创建 |
| ConversionController | 15 | `/api/mobile/{factoryId}/conversions` | 转换率管理 | ⏳ 分文档待创建 |
| UserController | 15 | `/api/mobile/{factoryId}/users` | 用户管理 | ⏳ 分文档待创建 |
| RawMaterialTypeController | 13 | `/api/mobile/{factoryId}/raw-material-types` | 原料类型 | ⏳ 分文档待创建 |
| ProductTypeController | 13 | `/api/mobile/{factoryId}/product-types` | 产品类型 | ⏳ 分文档待创建 |
| QualityInspectionController | 13 | `/api/mobile/{factoryId}/quality-inspections` | 质量检验 | ⏳ 分文档待创建 |
| TimeClockController | 13 | `/api/mobile/{factoryId}/time-clock` | 打卡管理 | ⏳ 分文档待创建 |
| DepartmentController | 11 | `/api/mobile/{factoryId}/departments` | 部门管理 | ⏳ 分文档待创建 |
| WorkTypeController | 11 | `/api/mobile/{factoryId}/work-types` | 工种管理 | ⏳ 分文档待创建 |
| PlatformController | 10 | `/api/platform` | 平台管理 | ⏳ 分文档待创建 |
| AIController | 10 | `/api/mobile/{factoryId}/ai` | AI分析 | ⏳ 分文档待创建 |
| MaterialSpecConfigController | 9 | `/api/mobile/{factoryId}/material-spec-config` | 规格配置 | ⏳ 分文档待创建 |
| SystemController | 4 | `/api/mobile/system` | 系统管理 | ⏳ 分文档待创建 |
| TestController | 3 | `/api/test` | 测试接口 | ⏳ 分文档待创建 |

**小计**: 162个端点 (41%)

**总计**: 397个端点 (100%)

---

## 🔎 按HTTP方法查找

### POST（创建/操作类，~150个）
- 认证登录、批次创建、状态变更、数据提交等
- 详见各Controller分文档

### GET（查询类，~180个）
- 列表查询、详情查询、统计数据等
- 详见各Controller分文档

### PUT（更新类，~40个）
- 数据更新、状态更新等
- 详见各Controller分文档

### DELETE（删除类，~27个）
- 数据删除、软删除等
- 详见各Controller分文档

---

## ⭐ E2E测试验证的API

以下API经过**E2E测试完整验证**，文档包含测试发现的问题和修复方案：

### 1. Material Batch E2E (12/12 通过)
| API端点 | 测试覆盖 | 修复点 | 文档链接 |
|---------|---------|--------|---------|
| 转为冻品 | ✅ storage_location更新 | - | [§3.1](PRD-API端点完整文档-v3.0.md#31-转为冻品-convert-to-frozen) |
| 撤销转冻品 | ✅ 10分钟内成功 | ✅ 时区问题、负数检查 | [§3.2](PRD-API端点完整文档-v3.0.md#32-撤销转冻品-undo-frozen) |
| 撤销转冻品（超时） | ✅ 10分钟后拒绝 | ✅ 防御性时间验证 | [§3.2](PRD-API端点完整文档-v3.0.md#32-撤销转冻品-undo-frozen) |

### 2. Equipment Alerts E2E (20/20 通过)
| API端点 | 测试覆盖 | 修复点 | 文档链接 |
|---------|---------|--------|---------|
| 获取设备告警列表 | ✅ currentPage字段 | ✅ PageResponse字段缺失 | [§4.1](PRD-API端点完整文档-v3.0.md) (规划中) |
| 按状态筛选告警 | ✅ status=ACTIVE | ✅ 测试数据准备 | [§4.1](PRD-API端点完整文档-v3.0.md) (规划中) |
| 确认告警 | ✅ 状态变更 | - | [§4.1](PRD-API端点完整文档-v3.0.md) (规划中) |

### 3. Dashboard E2E (24/24 通过)
| API端点 | 测试覆盖 | 修复点 | 文档链接 |
|---------|---------|--------|---------|
| 生产概览 | ✅ completedBatches | ✅ 字段添加 | [§2.3](PRD-API端点完整文档-v3.0.md) (已添加基础版) |
| 生产概览 | ✅ avgPassRate | ✅ 字段提升到顶层 | [§2.3](PRD-API端点完整文档-v3.0.md) (已添加基础版) |

### 4. Platform Management E2E (17/17 通过)
| API端点 | 测试覆盖 | 修复点 | 文档链接 |
|---------|---------|--------|---------|
| 获取工厂列表（分页） | ✅ page=0&size=1 | ✅ 手动分页实现 | [PlatformController分文档](PRD-API-PlatformController.md) (待创建) |

---

## 📝 文档编写进度

### 主文档（PRD-API端点完整文档-v3.0.md）

**目标**: 20-30个核心API（超详细8维度分析）

**已完成**: 7/25 (28%)
- ✅ 1.1 统一登录
- ✅ 1.2 Token刷新
- ✅ 1.3 用户登出
- ✅ 1.4 发送验证码
- ✅ 2.1 创建生产批次
- ✅ 3.1 转为冻品
- ✅ 3.2 撤销转冻品

**计划添加**: 13-18个
- ⏳ 2.2 开始生产
- ⏳ 2.3 完成生产
- ⏳ 2.4 生产概览（Dashboard）
- ⏳ 3.3 创建原材料批次
- ⏳ 3.4 FIFO批次查询
- ⏳ 4.1 获取设备告警列表
- ⏳ 4.2 创建设备
- ⏳ 5.1 提交质检记录
- ⏳ 5.2 获取质检记录
- ⏳ 6.1 创建用户
- ⏳ 6.2 更新用户信息
- ⏳ 7.1 获取工厂列表
- ⏳ 7.2 创建工厂

### Controller分文档

**目标**: 25个文档，覆盖全部397端点

**已完成**: 0/25 (0%)

**优先级排序**:
1. 🔥 **高优先级**（核心业务，先创建）
   - ProcessingController (23个端点)
   - MaterialBatchController (25个端点)
   - EquipmentController (25个端点)
   - MobileController (36个端点)
   - CustomerController (26个端点)

2. ⚙️ **中优先级**（常用功能）
   - FactorySettingsController (22个端点)
   - ProductionPlanController (20个端点)
   - QualityInspectionController (13个端点)
   - UserController (15个端点)
   - ReportController (19个端点)

3. 📊 **低优先级**（辅助功能）
   - 其余15个Controller

---

## 🛠️ 使用指南

### 如何查找API文档？

**方法1：按功能查找**
1. 确定要查找的功能模块（如"原材料管理"）
2. 在本文档的"按功能模块查找"部分找到相应模块
3. 查看表格中的"文档位置"列，点击链接跳转

**方法2：按Controller查找**
1. 确定API所属的Controller（从路径判断，如`/api/mobile/{factoryId}/processing`属于ProcessingController）
2. 在本文档的"按Controller分类"部分找到对应Controller
3. 查看"文档状态"，跳转到对应文档

**方法3：按端点路径查找**
1. 使用浏览器的查找功能（Ctrl+F / Cmd+F）
2. 输入API路径关键字（如`convert-to-frozen`）
3. 快速定位到相关API

### 如何贡献文档？

1. 选择一个待创建的Controller分文档
2. 参考主文档的格式（可简化为5个维度）
3. 提交Pull Request

---

## 📌 附录

### 文档更新历史

| 版本 | 日期 | 更新内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2025-11-20 | 创建API索引文档，梳理分层文档结构 | Claude Code |

### 相关文档链接

- [PRD-API端点完整文档-v3.0.md](./PRD-API端点完整文档-v3.0.md) - 核心API主文档
- [PRD-系统产品需求文档-v4.0.md](./PRD-系统产品需求文档-v4.0.md) - 产品需求文档
- [PRD-实现状态总览.md](./PRD-实现状态总览.md) - 前端页面实现状态
- [backend/rn-update-tableandlogic.md](../../backend/rn-update-tableandlogic.md) - 后端API需求

### 联系方式

- 技术支持：tech@cretas.com
- 文档反馈：docs@cretas.com
- GitHub Issues：https://github.com/cretas/food-trace/issues

---

**文档维护者**: Cretas Development Team
**最后更新**: 2025-11-20
**文档版本**: v1.0
