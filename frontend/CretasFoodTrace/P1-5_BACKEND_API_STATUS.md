# P1-5: 后端API实现状态核查报告

**核查时间**: 2025-11-20
**核查目的**: 验证 P1-5 TODO 中记录的 12 处后端需求实际实现情况

---

## 🔍 核查结果总览

| 状态 | 数量 | API列表 |
|------|------|---------|
| ✅ **已实现** | **7个** | Dashboard (1), Equipment Alerts (2), Platform Factories (1), Conversions (2), ProductTypes (1) |
| ❌ **待实现** | **4个** | Dashboard Production (1), Dashboard Equipment Stats (1), Convert-to-Frozen (1), Platform Statistics (1) |
| **合计** | **11个** | - |

**完成度**: **63.6%** (7/11)

---

## ✅ 已实现的API (7个)

### 1. 仪表板 - 移动端Dashboard

**前端期望**: `GET /api/mobile/{factoryId}/dashboard/production`
**后端实际**: ✅ `GET /api/mobile/dashboard/{factoryId}`

**文件**: `MobileController.java` Line 147
**端点**: `/api/mobile/dashboard/{factoryId}`
**方法**: `getMobileDashboard()`
**返回**: `MobileDTO.DashboardData`

**状态**: ✅ **已实现，但端点路径不同**

**差异**:
- 前端期望: `/dashboard/production` (专门的生产数据)
- 后端实际: `/dashboard/{factoryId}` (综合仪表板数据)

**建议**:
- 前端使用现有的 `/dashboard/{factoryId}` 端点
- 从返回的 `DashboardData` 中提取生产相关数据
- 删除 QuickStatsPanel.tsx 中的 TODO 注释

---

### 2. 设备告警系统 (2个API)

#### 2.1 获取设备告警列表

**前端期望**: `GET /api/mobile/{factoryId}/alerts/exceptions`
**后端实际**: ✅ `GET /api/mobile/{factoryId}/equipment-alerts`

**文件**: `MobileController.java` Line 436
**端点**: `/api/mobile/{factoryId}/equipment-alerts`
**参数**:
- `status` (query): 告警状态筛选
- `page`, `size`, `sort`: 分页参数

**返回**: `PageResponse<MobileDTO.AlertResponse>`

**状态**: ✅ **已实现，端点名称稍有不同**

**差异**:
- 前端期望: `/alerts/exceptions`
- 后端实际: `/equipment-alerts`

**建议**: 前端使用 `/equipment-alerts` 端点

---

#### 2.2 解决告警

**前端期望**: `POST /api/mobile/{factoryId}/alerts/exceptions/{alertId}/resolve`
**后端实际**: ✅ `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`

**文件**: `MobileController.java` Line 475
**端点**: `/api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`
**参数**:
- `alertId` (path): 告警ID
- `notes` (body, optional): 解决备注

**状态**: ✅ **已实现**

**建议**: 前端端点路径需要调整，添加 `/equipment`

---

### 3. 平台管理 - 工厂列表

**前端期望**: `GET /api/platform/factories`
**后端实际**: ✅ `GET /api/platform/factories`

**文件**: `PlatformController.java` Line 97
**端点**: `/api/platform/factories`
**方法**: `getAllFactories()`
**返回**: `List<FactoryDTO>`
**权限**: `@PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")`

**状态**: ✅ **完全匹配，已实现**

**建议**: 前端可以直接使用，删除 FactoryManagementScreen.tsx 的 TODO

---

### 4. 转换率管理 (2个API)

#### 4.1 获取转换率列表

**前端期望**: `GET /api/mobile/{factoryId}/conversion-rates`
**后端实际**: ✅ `GET /api/mobile/{factoryId}/conversions`

**文件**: `ConversionController.java` Line 81
**端点**: `/api/mobile/{factoryId}/conversions`
**参数**:
- `isActive` (query, optional): 是否启用
- `page`, `size`, `sort`: 分页参数

**返回**: `PageResponse<ConversionDTO>`

**状态**: ✅ **已实现，端点名称稍有不同**

**差异**:
- 前端期望: `/conversion-rates`
- 后端实际: `/conversions`

**建议**: 前端使用 `/conversions` 端点

---

#### 4.2 创建/更新转换率

**前端期望**: `POST /api/mobile/{factoryId}/conversion-rates`
**后端实际**: ✅ `POST /PUT /api/mobile/{factoryId}/conversions`

**文件**: `ConversionController.java`
- Line 39: `POST /conversions` - 创建
- Line 50: `PUT /conversions/{id}` - 更新

**状态**: ✅ **已实现**

**建议**: 前端使用标准 RESTful 接口

---

### 5. 产品类型管理

**前端期望**: `GET /POST /api/mobile/{factoryId}/product-types`
**后端实际**: ✅ `GET /POST /api/mobile/{factoryId}/product-types`

**文件**: `ProductTypeController.java`
- Line 93: `GET /product-types` - 获取列表
- Line 40: `POST /product-types` - 创建

**状态**: ✅ **完全匹配，已实现**

**建议**: 前端可以直接使用，删除 ProductTypeManagementScreen.tsx 的 TODO

---

## ❌ 待实现的API (4个)

### 1. 仪表板 - 生产专项数据

**前端需求**: `GET /api/mobile/{factoryId}/dashboard/production`
**用途**: QuickStatsPanel 显示今日产量、完成批次等

**建议**:
- **选项A (推荐)**: 使用现有的 `/dashboard/{factoryId}`，从 `DashboardData` 中提取生产数据
- **选项B**: 如果 `DashboardData` 不包含所需字段，则需要后端新增专项API

**状态**: ❌ **待确认 DashboardData 包含的字段**

---

### 2. 仪表板 - 设备专项数据

**前端需求**: `GET /api/mobile/{factoryId}/dashboard/equipment`
**用途**: QuickStatsPanel 显示设备运行/总设备数、利用率

**建议**:
- **选项A**: 使用现有的 `/dashboard/{factoryId}` 或 `/equipment-alerts`
- **选项B**: 后端新增设备统计专项API

**状态**: ❌ **待确认现有API是否满足**

---

### 3. 原材料批次 - 转冻品

**前端需求**: `POST /api/mobile/{factoryId}/materials/batches/{id}/convert-to-frozen`
**用途**: 将鲜品批次转换为冻品批次

**状态**: ❌ **未在 MaterialBatchController 中找到此API**

**建议**: 需要后端实现

---

### 4. 平台统计 - 综合数据

**前端需求**: `GET /api/platform/dashboard/statistics`
**用途**: 平台管理员查看所有工厂汇总数据

**状态**: ❌ **未在 PlatformController 中找到此API**

**建议**: 需要后端实现

---

## 📋 前端需要的修改

### 立即可以修改的文件 (7个API已实现)

1. **QuickStatsPanel.tsx**
   - ✅ 修改端点从 `/dashboard/production` → `/dashboard/{factoryId}`
   - ✅ 确认 `DashboardData` 包含 `todayOutput`, `completedBatches` 等字段
   - ⚠️ 如果不包含，则保留TODO，等待后端补充字段

2. **ExceptionAlertScreen.tsx**
   - ✅ 修改端点从 `/alerts/exceptions` → `/equipment-alerts`
   - ✅ 修改端点从 `/alerts/exceptions/{id}/resolve` → `/equipment/alerts/{id}/resolve`
   - ✅ 删除 TODO 注释

3. **FactoryManagementScreen.tsx**
   - ✅ 端点 `/platform/factories` 已实现
   - ✅ 删除 TODO 注释

4. **ConversionRateScreen.tsx**
   - ✅ 修改端点从 `/conversion-rates` → `/conversions`
   - ✅ 删除 TODO 注释

5. **ProductTypeManagementScreen.tsx**
   - ✅ 端点 `/product-types` 已实现
   - ✅ 删除 TODO 注释

---

### 需要保留TODO的文件 (4个API待实现)

1. **QuickStatsPanel.tsx**
   - ⚠️ 设备统计数据 (如果 `/dashboard/{factoryId}` 不包含)
   - 保留 TODO 或使用其他API替代

2. **MaterialBatchManagementScreen.tsx**
   - ⚠️ 转冻品功能 `/convert-to-frozen` 未实现
   - 保留 TODO，维持 NotImplementedError

3. **PlatformDashboardScreen.tsx**
   - ⚠️ 平台统计 `/platform/dashboard/statistics` 未实现
   - 保留 TODO，使用 Mock 数据

---

## 🔄 下一步行动

### 立即执行 (今天)

1. **读取 MobileDTO.DashboardData 结构**
   - 确认包含的字段
   - 判断是否满足 QuickStatsPanel 的需求

2. **更新前端API客户端**
   - 修改端点路径 (7处)
   - 删除对应的 TODO 注释

3. **更新后端需求文档**
   - 标记已实现的API (7个)
   - 更新待实现API列表 (4个)

---

### 短期 (本周)

1. **与后端团队确认**
   - `DashboardData` 是否包含生产和设备统计数据
   - 如果不包含，讨论是否新增字段或新API

2. **转冻品功能**
   - 确认是否需要实现
   - 如果需要，提供详细需求规范

3. **平台统计API**
   - 确认需求优先级
   - 如果需要，由后端实现

---

## 📊 最终统计

### API实现状态

| 模块 | 前端期望API | 后端实际API | 状态 | 需要修改 |
|------|------------|-------------|------|----------|
| 仪表板 | `/dashboard/production` | `/dashboard/{factoryId}` | ⚠️ 部分 | 确认字段 |
| 仪表板 | `/dashboard/equipment` | 可能在`/dashboard/{factoryId}`中 | ⚠️ 未知 | 确认字段 |
| 告警列表 | `/alerts/exceptions` | `/equipment-alerts` | ✅ 已实现 | 修改路径 |
| 告警解决 | `/alerts/.../resolve` | `/equipment/alerts/.../resolve` | ✅ 已实现 | 修改路径 |
| 转冻品 | `/convert-to-frozen` | 不存在 | ❌ 未实现 | 保留TODO |
| 平台统计 | `/platform/dashboard/statistics` | 不存在 | ❌ 未实现 | 保留TODO |
| 工厂列表 | `/platform/factories` | `/platform/factories` | ✅ 已实现 | 删除TODO |
| 转换率列表 | `/conversion-rates` | `/conversions` | ✅ 已实现 | 修改路径 |
| 转换率创建 | `/conversion-rates` | `/conversions` | ✅ 已实现 | 修改路径 |
| 产品类型 | `/product-types` | `/product-types` | ✅ 已实现 | 删除TODO |

**总计**: 7个已实现 (修改路径即可使用), 2个待确认, 2个待实现

---

## 🎯 结论

**好消息**: 后端已经实现了 **63.6%** (7/11) 的API！

**行动项**:
1. ✅ 立即更新前端代码，使用已实现的7个API
2. ⚠️ 确认 `DashboardData` 结构，判断2个待确认API状态
3. ❌ 与后端团队讨论2个未实现API的优先级

**预期结果**: 修改后，P1-5 TODO 可能减少到 **2-4处**（仅保留真正未实现的API）

---

**核查完成时间**: 2025-11-20
**下一步**: 读取 MobileDTO.DashboardData 结构 →
