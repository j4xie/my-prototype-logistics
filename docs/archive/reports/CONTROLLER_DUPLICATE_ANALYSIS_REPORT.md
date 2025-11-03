# Controller 重复功能分析报告

## 项目信息
- **项目**: cretas-backend-system (Spring Boot)
- **分析日期**: 2025-11-01
- **Controller 数量**: 19个
- **分析目的**: 识别重复的API接口和功能

---

## 执行摘要

本报告对 **19个Spring Boot Controller** 进行了全面分析，识别出以下重复类别：

### 重复统计
- **A类 - 完全重复的端点**: 2处
- **B类 - 功能重复**: 18处
- **C类 - CRUD操作重复**: 5组
- **D类 - 认证相关重复**: 3处

**总计**: **28处重复功能需要整合**

---

## 1. Controller 路径结构分析

### 1.1 路径前缀分类

| Controller | 路径前缀 | 类型 | 说明 |
|-----------|---------|------|------|
| **MobileController** | `/api/mobile` | 移动端通用 | 认证、文件上传、仪表盘、同步 |
| ConversionController | `/api/mobile/{factoryId}/conversions` | 移动端工厂级 | 转换率管理 |
| CustomerController | `/api/mobile/{factoryId}/customers` | 移动端工厂级 | 客户管理 |
| EquipmentController | `/api/mobile/{factoryId}/equipment` | 移动端工厂级 | 设备管理 |
| FactorySettingsController | `/api/mobile/{factoryId}/settings` | 移动端工厂级 | 工厂设置 |
| MaterialBatchController | `/api/mobile/{factoryId}/material-batches` | 移动端工厂级 | 原材料批次 |
| ProcessingController | `/api/mobile/{factoryId}/processing` | 移动端工厂级 | 生产加工 |
| ProductTypeController | `/api/mobile/{factoryId}/products/types` | 移动端工厂级 | 产品类型 |
| ProductionPlanController | `/api/mobile/{factoryId}/production-plans` | 移动端工厂级 | 生产计划 |
| RawMaterialTypeController | `/api/mobile/{factoryId}/materials/types` | 移动端工厂级 | 原材料类型 |
| ReportController | `/api/mobile/{factoryId}/reports` | 移动端工厂级 | 报表统计 |
| SupplierController | `/api/mobile/{factoryId}/suppliers` | 移动端工厂级 | 供应商管理 |
| TimeClockController | `/api/mobile/{factoryId}/timeclock` | 移动端工厂级 | 考勤打卡 |
| TimeStatsController | `/api/mobile/{factoryId}/time-stats` | 移动端工厂级 | 时间统计 |
| WorkTypeController | `/api/mobile/{factoryId}/work-types` | 移动端工厂级 | 工作类型 |
| **UserController** | `/api/{factoryId}/users` | Web端 | 用户管理 |
| **WhitelistController** | `/api/{factoryId}/whitelist` | Web端 | 白名单管理 |
| **SystemController** | `/api/mobile/system` | 移动端系统级 | 系统管理 |
| **TestController** | `/api/test` | 测试专用 | 密码测试 |

---

## 2. 类型A: 完全重复的端点

### A1. 系统健康检查重复

**位置**:
1. `MobileController.healthCheck()` - `/api/mobile/health`
2. `SystemController.getSystemHealth()` - `/api/mobile/system/health`

**重复内容**:
```java
// MobileController (Line 320-328)
@GetMapping("/health")
@Operation(summary = "健康检查")
public ApiResponse<Map<String, Object>> healthCheck() {
    Map<String, Object> health = new HashMap<>();
    health.put("status", "UP");
    health.put("timestamp", LocalDateTime.now());
    health.put("version", "1.0.0");
    return ApiResponse.success(health);
}

// SystemController (Line 38-44)
@GetMapping("/health")
@Operation(summary = "系统健康检查", description = "获取系统健康状态")
public ApiResponse<Map<String, Object>> getSystemHealth() {
    log.info("执行系统健康检查");
    Map<String, Object> health = systemService.getSystemHealth();
    return ApiResponse.success(health);
}
```

**建议**:
- **保留**: `SystemController.getSystemHealth()` (功能更完整，调用Service层)
- **删除**: `MobileController.healthCheck()` (简单实现)
- **统一路径**: `/api/mobile/system/health`

---

### A2. 用户信息获取重复

**位置**:
1. `MobileController.getCurrentUser()` - `/api/mobile/auth/me`
2. `UserController.getUserById()` - `/api/{factoryId}/users/{userId}`

**重复内容**:
```java
// MobileController (Line 273-280)
@GetMapping("/auth/me")
@Operation(summary = "获取当前用户信息")
public ApiResponse<UserDTO> getCurrentUser(
        @RequestHeader("Authorization") String authorization) {
    String token = extractToken(authorization);
    UserDTO user = mobileService.getUserFromToken(token);
    return ApiResponse.success(user);
}

// UserController (Line 86-95)
@GetMapping("/{userId}")
@Operation(summary = "获取用户详情")
public ApiResponse<UserDTO> getUserById(
        @PathVariable @NotBlank String factoryId,
        @PathVariable @NotNull Integer userId) {
    UserDTO user = userService.getUserById(factoryId, userId);
    return ApiResponse.success(user);
}
```

**区别**:
- MobileController: 从Token获取当前登录用户
- UserController: 通过userId获取任意用户

**建议**:
- **保留两者**: 功能不同，一个获取当前用户，一个获取指定用户
- **但需重命名**: MobileController应该改名为`getCurrentUserProfile()`更清晰

---

## 3. 类型B: 功能重复

### B1. 认证相关功能重复

#### B1.1 登录功能

**位置**:
- `MobileController.unifiedLogin()` - `/api/mobile/auth/unified-login`

**功能**: 统一登录接口（平台用户 + 工厂用户）

**可能的重复**:
- 未发现其他登录端点，但建议确认是否存在Web端独立的登录接口

---

#### B1.2 密码管理重复

**位置**:
1. `MobileController.changePassword()` - `/api/mobile/auth/change-password`
2. `MobileController.resetPassword()` - `/api/mobile/auth/reset-password`

**重复内容**:
```java
// MobileController - 修改密码 (Line 285-299)
@PostMapping("/auth/change-password")
@Operation(summary = "修改密码")
public ApiResponse<Void> changePassword(
        @RequestHeader("Authorization") String authorization,
        @RequestParam String oldPassword,
        @RequestParam String newPassword) {
    String token = extractToken(authorization);
    UserDTO user = mobileService.getUserFromToken(token);
    mobileService.changePassword(user.getId(), oldPassword, newPassword);
    return ApiResponse.success("密码修改成功", null);
}

// MobileController - 重置密码 (Line 303-316)
@PostMapping("/auth/reset-password")
@Operation(summary = "重置密码（管理员）")
public ApiResponse<Void> resetPassword(
        @RequestParam String factoryId,
        @RequestParam String username,
        @RequestParam String newPassword) {
    mobileService.resetPassword(factoryId, username, newPassword);
    return ApiResponse.success("密码重置成功", null);
}
```

**区别**:
- `changePassword()`: 用户自己修改密码（需要旧密码）
- `resetPassword()`: 管理员重置用户密码（不需要旧密码）

**建议**:
- **保留两者**: 功能逻辑不同，都需要
- **优化**: 考虑添加权限控制注解 `@PreAuthorize`

---

### B2. Token管理重复

**位置**:
1. `MobileController.refreshToken()` - `/api/mobile/auth/refresh`
2. `MobileController.validateToken()` - `/api/mobile/auth/validate`

**功能**:
- `refreshToken()`: 刷新访问令牌
- `validateToken()`: 验证令牌有效性

**建议**:
- **保留两者**: 功能不同且都必要

---

### B3. 仪表盘数据重复

**位置**:
1. `MobileController.getDashboardData()` - `/api/mobile/dashboard/{factoryId}`
2. `ReportController.getDashboardStatistics()` - `/api/mobile/{factoryId}/reports/dashboard`
3. `ProcessingController.getDashboardOverview()` - `/api/mobile/{factoryId}/processing/dashboard/overview`

**重复内容**:
```java
// MobileController (Line 114-122)
@GetMapping("/dashboard/{factoryId}")
@Operation(summary = "获取仪表盘数据")
public ApiResponse<MobileDTO.DashboardData> getDashboardData(
        @PathVariable String factoryId) {
    Integer userId = SecurityUtils.getCurrentUserId();
    MobileDTO.DashboardData data = mobileService.getDashboardData(factoryId, userId);
    return ApiResponse.success(data);
}

// ReportController (Line 37-44)
@GetMapping("/dashboard")
@Operation(summary = "获取仪表盘统计", description = "获取工厂的综合统计数据")
public ApiResponse<DashboardStatisticsDTO> getDashboardStatistics(
        @PathVariable String factoryId) {
    DashboardStatisticsDTO statistics = reportService.getDashboardStatistics(factoryId);
    return ApiResponse.success(statistics);
}

// ProcessingController (Line 298-305)
@GetMapping("/dashboard/overview")
@Operation(summary = "生产概览", description = "获取生产概览数据")
public ApiResponse<Map<String, Object>> getDashboardOverview(
        @PathVariable String factoryId) {
    Map<String, Object> overview = processingService.getDashboardOverview(factoryId);
    return ApiResponse.success(overview);
}
```

**分析**:
- **MobileController**: 通用仪表盘数据（移动端首页）
- **ReportController**: 综合统计报表仪表盘
- **ProcessingController**: 生产模块专用仪表盘

**建议**:
- **保留**: MobileController.getDashboardData() - 作为移动端首页入口
- **保留**: ProcessingController.getDashboardOverview() - 生产模块专用
- **删除或重命名**: ReportController.getDashboardStatistics()
  - 改为: `getComprehensiveStatistics()` 或 `getFullReport()`
  - 避免与"dashboard"名称重复

---

### B4. 实时数据重复

**位置**:
1. `ReportController.getRealtimeData()` - `/api/mobile/{factoryId}/reports/realtime`
2. `TimeStatsController.getRealtimeStats()` - `/api/mobile/{factoryId}/time-stats/realtime`

**重复内容**:
```java
// ReportController (Line 340-347)
@GetMapping("/realtime")
@Operation(summary = "获取实时数据", description = "获取工厂实时运营数据")
public ApiResponse<Map<String, Object>> getRealtimeData(
        @PathVariable String factoryId) {
    Map<String, Object> data = reportService.getRealtimeData(factoryId);
    return ApiResponse.success(data);
}

// TimeStatsController (Line 166-173)
@GetMapping("/realtime")
@Operation(summary = "获取实时统计")
public ApiResponse<TimeStatsDTO> getRealtimeStats(
        @PathVariable String factoryId) {
    TimeStatsDTO stats = timeStatsService.getRealtimeStats(factoryId);
    return ApiResponse.success(stats);
}
```

**分析**:
- **ReportController**: 工厂整体实时运营数据
- **TimeStatsController**: 时间统计专用实时数据

**建议**:
- **保留两者**: 数据范围不同
- **优化命名**:
  - ReportController → `getRealtimeOverview()`
  - TimeStatsController → `getRealtimeTimeStats()`

---

### B5. 统计数据重复

**位置**:
1. `SystemController.getSystemStatistics()` - `/api/mobile/system/statistics`
2. `ProductionPlanController.getProductionStatistics()` - `/api/mobile/{factoryId}/production-plans/statistics`
3. `ReportController` - 多个统计端点

**分析**:
- **SystemController**: 系统级统计
- **ProductionPlanController**: 生产计划统计
- **ReportController**: 综合报表统计

**建议**:
- **保留所有**: 统计范围不同，都有存在价值

---

### B6. 导出功能重复

**位置**:
1. `ConversionController.exportConversions()` - `/api/mobile/{factoryId}/conversions/export`
2. `CustomerController.exportCustomerList()` - `/api/mobile/{factoryId}/customers/export`
3. `EquipmentController.exportEquipmentList()` - `/api/mobile/{factoryId}/equipment/export`
4. `MaterialBatchController.exportInventoryReport()` - `/api/mobile/{factoryId}/material-batches/export`
5. `ProductionPlanController.exportProductionPlans()` - `/api/mobile/{factoryId}/production-plans/export`
6. `ReportController.exportExcelReport()` - `/api/mobile/{factoryId}/reports/export/excel`
7. `ReportController.exportPdfReport()` - `/api/mobile/{factoryId}/reports/export/pdf`
8. `SupplierController.exportSupplierList()` - `/api/mobile/{factoryId}/suppliers/export`
9. `TimeClockController.exportAttendanceRecords()` - `/api/mobile/{factoryId}/timeclock/export`
10. `TimeStatsController.exportStatsReport()` - `/api/mobile/{factoryId}/time-stats/export`
11. `UserController.exportUsers()` - `/api/{factoryId}/users/export`
12. `WhitelistController.exportWhitelist()` - `/api/{factoryId}/whitelist/export`

**重复模式**:
- 所有Controller都有 `/export` 端点
- 返回类型: `byte[]` 或 `String` (CSV)
- 响应类型: Excel 或 CSV

**建议**:
- **保留所有**: 每个模块需要独立的导出功能
- **但需标准化**:
  - 统一返回类型: `byte[]`
  - 统一文件格式: Excel (XLSX)
  - 统一命名规范: `export{ResourceName}s()`
  - 考虑抽取公共导出工具类

---

### B7. 导入功能重复

**位置**:
1. `ConversionController.importConversions()` - `/api/mobile/{factoryId}/conversions/import`
2. `CustomerController.importCustomers()` - `/api/mobile/{factoryId}/customers/import`
3. `EquipmentController.importEquipment()` - `/api/mobile/{factoryId}/equipment/import`
4. `SupplierController.importSuppliers()` - `/api/mobile/{factoryId}/suppliers/import`
5. `UserController.batchImportUsers()` - `/api/{factoryId}/users/import`
6. `WhitelistController.importWhitelist()` - `/api/{factoryId}/whitelist/import`

**重复模式**:
- 所有Controller都有 `/import` 端点
- 接收: `List<CreateXxxRequest>` 或 CSV字符串
- 返回: `List<XxxDTO>` 或 `BatchResult`

**建议**:
- **保留所有**: 每个模块需要独立的导入功能
- **标准化**:
  - 统一输入格式: 支持CSV文件上传
  - 统一返回格式: `BatchResult` (成功数、失败数、错误列表)
  - 统一命名: `import{ResourceName}s()`

---

### B8. 批量操作重复

**位置**:
1. `ConversionController.updateActiveStatus()` - 批量激活/停用
2. `ProductTypeController.updateProductTypesStatus()` - 批量更新状态
3. `RawMaterialTypeController.updateMaterialTypesStatus()` - 批量更新状态
4. `UserController.batchImportUsers()` - 批量导入
5. `WhitelistController.batchAdd()` - 批量添加
6. `WhitelistController.batchDelete()` - 批量删除

**重复模式**:
- 批量更新状态: `/batch/status` 或 `/batch/activate`
- 批量删除: `/batch/delete` 或 `/batch`
- 批量创建/导入: `/import` 或 `/batch`

**建议**:
- **标准化路径**:
  - 批量创建: `POST /batch`
  - 批量更新状态: `PUT /batch/status`
  - 批量删除: `DELETE /batch`
- **保留所有**: 功能必要

---

### B9. 搜索功能重复

**位置**:
1. `CustomerController.searchCustomers()` - `/search`
2. `EquipmentController.searchEquipment()` - `/search`
3. `ProductTypeController.searchProductTypes()` - `/search`
4. `RawMaterialTypeController.searchMaterialTypes()` - `/search`
5. `SupplierController.searchSuppliers()` - `/search`
6. `UserController.searchUsers()` - `/search`
7. `WhitelistController.searchWhitelist()` - `/search`

**重复模式**:
- 路径: `GET /{resource}/search?keyword={keyword}`
- 返回: 分页结果 `PageResponse<DTO>`

**建议**:
- **保留所有**: 每个资源需要搜索
- **标准化**:
  - 统一参数: `keyword`, `page`, `size`
  - 统一返回: `PageResponse<DTO>`

---

### B10. 状态切换重复

**位置**:
1. `CustomerController.toggleCustomerStatus()` - `/status`
2. `SupplierController.toggleSupplierStatus()` - `/status`
3. `WorkTypeController.toggleWorkTypeStatus()` - `/toggle-status`

**重复模式**:
```java
@PutMapping("/{id}/status")
public ApiResponse<DTO> toggleStatus(
    @PathVariable String factoryId,
    @PathVariable Integer id,
    @RequestParam Boolean isActive)
```

**建议**:
- **保留所有**: 功能必要
- **标准化路径**: 统一使用 `/{id}/status` (不要用 `/toggle-status`)

---

### B11. 检查代码/名称是否存在重复

**位置**:
1. `CustomerController.checkCustomerCode()` - `/check-code`
2. `ProductTypeController.checkCodeExists()` - `/check-code`
3. `RawMaterialTypeController.checkCodeExists()` - `/check-code`
4. `SupplierController.checkSupplierCode()` - `/check-code`
5. `UserController.checkUsernameExists()` - `/check/username`
6. `UserController.checkEmailExists()` - `/check/email`

**重复模式**:
```java
@GetMapping("/check-code")
public ApiResponse<Boolean> checkCodeExists(
    @PathVariable String factoryId,
    @RequestParam String code)
```

**建议**:
- **保留所有**: 前端表单验证必需
- **标准化路径**:
  - 统一使用 `/check/{field}` (如 `/check/code`, `/check/username`)

---

### B12. 获取活跃资源列表重复

**位置**:
1. `CustomerController.getActiveCustomers()` - `/active`
2. `ProductTypeController.getActiveProductTypes()` - `/active`
3. `RawMaterialTypeController.getActiveMaterialTypes()` - `/active`
4. `SupplierController.getActiveSuppliers()` - `/active`
5. `WorkTypeController.getAllActiveWorkTypes()` - `/active`

**重复模式**:
```java
@GetMapping("/active")
public ApiResponse<List<DTO>> getActiveResources(
    @PathVariable String factoryId)
```

**建议**:
- **保留所有**: 下拉选择框常用
- **统一命名**: `getActive{Resources}()` (复数形式)

---

### B13. 按类别/类型获取资源重复

**位置**:
1. `CustomerController.getCustomersByType()` - `/by-type`
2. `CustomerController.getCustomersByIndustry()` - `/by-industry`
3. `EquipmentController.getEquipmentByStatus()` - `/status/{status}`
4. `EquipmentController.getEquipmentByType()` - `/type/{type}`
5. `MaterialBatchController.getMaterialBatchesByType()` - `/material-type/{materialTypeId}`
6. `MaterialBatchController.getMaterialBatchesByStatus()` - `/status/{status}`
7. `ProductTypeController.getProductTypesByCategory()` - `/category/{category}`
8. `ProductionPlanController.getProductionPlansByStatus()` - `/status/{status}`
9. `RawMaterialTypeController.getMaterialTypesByCategory()` - `/category/{category}`
10. `RawMaterialTypeController.getMaterialTypesByStorageType()` - `/storage-type/{storageType}`
11. `SupplierController.getSuppliersByMaterialType()` - `/by-material`
12. `UserController.getUsersByRole()` - `/role/{roleCode}`

**重复模式**:
- 路径模式1: `/by-{field}?{field}={value}`
- 路径模式2: `/{field}/{value}`

**建议**:
- **保留所有**: 业务查询必需
- **标准化路径**: 优先使用 `/{field}/{value}` 模式
  - 如: `/type/{type}`, `/status/{status}`, `/category/{category}`

---

### B14. 统计信息重复

**位置**:
1. `ConversionController.getStatistics()` - `/statistics`
2. `CustomerController.getCustomerStatistics()` - `/{id}/statistics`
3. `CustomerController.getOverallCustomerStatistics()` - `/overall-statistics`
4. `EquipmentController.getEquipmentStatistics()` - `/{id}/statistics`
5. `EquipmentController.getOverallEquipmentStatistics()` - `/overall-statistics`
6. `MaterialBatchController.getInventoryStatistics()` - `/inventory/statistics`
7. `ProductionPlanController.getProductionStatistics()` - `/statistics`
8. `SupplierController.getSupplierStatistics()` - `/{id}/statistics`
9. `TimeClockController.getAttendanceStatistics()` - `/statistics`

**重复模式**:
- 单个资源统计: `/{id}/statistics`
- 整体统计: `/statistics` 或 `/overall-statistics`

**建议**:
- **保留所有**: 统计功能必需
- **标准化命名**:
  - 单个资源: `/{id}/statistics`
  - 整体统计: `/statistics/overall` 或直接 `/statistics`

---

### B15. 历史记录重复

**位置**:
1. `CustomerController.getCustomerPurchaseHistory()` - `/{id}/purchase-history`
2. `EquipmentController.getEquipmentUsageHistory()` - `/{id}/usage-history`
3. `EquipmentController.getEquipmentMaintenanceHistory()` - `/{id}/maintenance-history`
4. `MaterialBatchController.getBatchUsageHistory()` - `/{id}/usage-history`
5. `SupplierController.getSupplierHistory()` - `/{id}/history`
6. `TimeClockController.getClockHistory()` - `/history`

**重复模式**:
```java
@GetMapping("/{id}/history")
public ApiResponse<List<Map<String, Object>>> getHistory(...)
```

**建议**:
- **保留所有**: 历史追溯必需
- **标准化命名**:
  - 统一使用 `/{id}/history/{type}` (如 `/history/usage`, `/history/maintenance`)

---

### B16. 评级/信用管理重复

**位置**:
1. `CustomerController.updateCustomerRating()` - `/{id}/rating`
2. `CustomerController.updateCreditLimit()` - `/{id}/credit-limit`
3. `CustomerController.updateCurrentBalance()` - `/{id}/balance`
4. `SupplierController.updateSupplierRating()` - `/{id}/rating`
5. `SupplierController.updateCreditLimit()` - `/{id}/credit-limit`

**重复模式**:
```java
@PutMapping("/{id}/rating")
public ApiResponse<DTO> updateRating(
    @PathVariable String factoryId,
    @PathVariable Integer id,
    @RequestParam Integer rating,
    @RequestParam(required = false) String notes)
```

**分析**:
- 客户和供应商都需要评级管理
- 功能完全相同

**建议**:
- **保留两处**: 业务需要
- **考虑抽取**: 可以考虑抽取为通用的 `RatingService` 和 `CreditService`

---

### B17. 分布统计重复

**位置**:
1. `CustomerController.getCustomerRatingDistribution()` - `/rating-distribution`
2. `CustomerController.getCustomerTypeDistribution()` - `/type-distribution`
3. `CustomerController.getCustomerIndustryDistribution()` - `/industry-distribution`
4. `SupplierController.getSupplierRatingDistribution()` - `/rating-distribution`

**重复模式**:
```java
@GetMapping("/rating-distribution")
public ApiResponse<Map<Integer, Long>> getRatingDistribution(
    @PathVariable String factoryId)
```

**建议**:
- **保留所有**: 数据分析必需
- **标准化命名**: `/distribution/{field}` (如 `/distribution/rating`)

---

### B18. 欠款管理重复

**位置**:
1. `CustomerController.getCustomersWithOutstandingBalance()` - `/outstanding-balance`
2. `SupplierController.getSuppliersWithOutstandingBalance()` - `/outstanding-balance`

**重复模式**:
```java
@GetMapping("/outstanding-balance")
public ApiResponse<List<DTO>> getWithOutstandingBalance(
    @PathVariable String factoryId)
```

**建议**:
- **保留两处**: 客户欠款和供应商欠款是不同的业务场景
- **考虑优化**: 可以考虑统一的财务管理模块

---

## 4. 类型C: CRUD操作重复

### C1. 标准CRUD模式

以下Controller都实现了标准的CRUD操作模式:

| Controller | 资源 | Create | Read | Update | Delete |
|-----------|------|--------|------|--------|--------|
| ConversionController | 转换率 | ✅ | ✅ | ✅ | ✅ |
| CustomerController | 客户 | ✅ | ✅ | ✅ | ✅ |
| EquipmentController | 设备 | ✅ | ✅ | ✅ | ✅ |
| MaterialBatchController | 原材料批次 | ✅ | ✅ | ✅ | ✅ |
| ProductTypeController | 产品类型 | ✅ | ✅ | ✅ | ✅ |
| ProductionPlanController | 生产计划 | ✅ | ✅ | ✅ | ✅ |
| RawMaterialTypeController | 原材料类型 | ✅ | ✅ | ✅ | ✅ |
| SupplierController | 供应商 | ✅ | ✅ | ✅ | ✅ |
| UserController | 用户 | ✅ | ✅ | ✅ | ✅ |
| WhitelistController | 白名单 | ✅ | ✅ | ✅ | ✅ |
| WorkTypeController | 工作类型 | ✅ | ✅ | ✅ | ✅ |

**标准CRUD端点模式**:
```java
POST   /                     // 创建
GET    /                     // 列表（分页）
GET    /{id}                 // 详情
PUT    /{id}                 // 更新
DELETE /{id}                 // 删除
```

**建议**:
- **保留所有**: CRUD是基础功能
- **标准化**: 确保所有Controller遵循统一的CRUD模式
- **考虑**: 可以创建 `BaseController<T>` 抽象类，减少重复代码

---

## 5. 类型D: 认证相关重复

### D1. Token提取方法重复

**位置**: 几乎所有Controller都有 `extractToken()` 方法

**重复代码**:
```java
// CustomerController (Line 422-427)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}

// EquipmentController (Line 437-442)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}

// MaterialBatchController (Line 418-423)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}

// MobileController (Line 333-338)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}

// ProductionPlanController (Line 391-396)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}

// SupplierController (Line 334-339)
private String extractToken(String authorization) {
    if (authorization != null && authorization.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new IllegalArgumentException("无效的Authorization头");
}
```

**重复数量**: **6个Controller** 有完全相同的 `extractToken()` 方法

**建议**:
- **删除所有重复**: 移除所有Controller中的 `extractToken()` 方法
- **创建工具类**:
  ```java
  // com.cretas.aims.utils.TokenUtils
  public class TokenUtils {
      public static String extractToken(String authorization) {
          if (authorization != null && authorization.startsWith("Bearer ")) {
              return authorization.substring(7);
          }
          throw new IllegalArgumentException("无效的Authorization头");
      }
  }
  ```
- **或使用拦截器**: 在拦截器中统一处理Token提取

---

### D2. 用户ID获取重复

**位置**: 多个Controller中重复获取当前用户ID

**重复模式**:
```java
// CustomerController
String token = extractToken(authorization);
Integer userId = mobileService.getUserFromToken(token).getId();

// EquipmentController
String token = extractToken(authorization);
Integer userId = mobileService.getUserFromToken(token).getId();

// MaterialBatchController
String token = extractToken(authorization);
Integer userId = mobileService.getUserFromToken(token).getId();
```

**建议**:
- **使用Spring Security**:
  ```java
  Integer userId = SecurityUtils.getCurrentUserId();
  ```
- **或创建注解**:
  ```java
  @CurrentUserId Integer userId
  ```

---

### D3. 设备激活重复

**位置**:
- `MobileController.activateDevice()` - `/api/mobile/activation/activate`

**功能**: 设备激活

**建议**:
- **保留**: 唯一的激活端点，无重复

---

## 6. 整合建议总结

### 6.1 立即删除的重复功能 (2处)

| 序号 | Controller | 方法 | 路径 | 原因 | 保留版本 |
|------|-----------|------|------|------|---------|
| 1 | MobileController | healthCheck() | `/api/mobile/health` | 简单实现，功能不完整 | SystemController.getSystemHealth() |
| 2 | 所有Controller | extractToken() | N/A | 重复的工具方法 | 抽取为TokenUtils工具类 |

### 6.2 需要重命名的功能 (5处)

| 序号 | Controller | 当前方法 | 建议新名称 | 原因 |
|------|-----------|---------|-----------|------|
| 1 | MobileController | getCurrentUser() | getCurrentUserProfile() | 避免与getUserById混淆 |
| 2 | ReportController | getDashboardStatistics() | getComprehensiveStatistics() | 避免与dashboard重复 |
| 3 | ReportController | getRealtimeData() | getRealtimeOverview() | 区分整体vs模块实时数据 |
| 4 | TimeStatsController | getRealtimeStats() | getRealtimeTimeStats() | 明确是时间统计 |
| 5 | WorkTypeController | getAllActiveWorkTypes() | getActiveWorkTypes() | 统一命名规范 |

### 6.3 需要标准化的功能组 (12组)

| 功能组 | 涉及Controller数量 | 标准化建议 |
|--------|-------------------|-----------|
| 导出功能 | 12个 | 统一返回`byte[]`，统一文件格式Excel，统一方法名`export{Resources}()` |
| 导入功能 | 6个 | 统一输入CSV文件，统一返回`BatchResult`，统一方法名`import{Resources}()` |
| 批量操作 | 6个 | 统一路径: `POST /batch`, `PUT /batch/status`, `DELETE /batch` |
| 搜索功能 | 7个 | 统一路径: `GET /search?keyword={keyword}` |
| 状态切换 | 3个 | 统一路径: `PUT /{id}/status` |
| 代码检查 | 6个 | 统一路径: `GET /check/{field}` (如 `/check/code`) |
| 活跃列表 | 5个 | 统一方法名: `getActive{Resources}()` (复数) |
| 按字段查询 | 12个 | 优先使用: `GET /{field}/{value}` |
| 统计信息 | 9个 | 单个: `/{id}/statistics`, 整体: `/statistics` |
| 历史记录 | 6个 | 统一路径: `/{id}/history/{type}` |
| 评级管理 | 5个 | 考虑抽取`RatingService` |
| 分布统计 | 4个 | 统一路径: `/distribution/{field}` |

### 6.4 建议创建的公共组件

#### 6.4.1 BaseController 抽象类
```java
public abstract class BaseController<T, ID> {
    protected abstract BaseService<T, ID> getService();

    @PostMapping
    public ApiResponse<T> create(@RequestBody @Valid T entity) {
        return ApiResponse.success(getService().create(entity));
    }

    @GetMapping("/{id}")
    public ApiResponse<T> getById(@PathVariable ID id) {
        return ApiResponse.success(getService().getById(id));
    }

    // ... 其他CRUD方法
}
```

#### 6.4.2 TokenUtils 工具类
```java
public class TokenUtils {
    public static String extractToken(String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        throw new IllegalArgumentException("无效的Authorization头");
    }
}
```

#### 6.4.3 ExportUtils 导出工具类
```java
public class ExportUtils {
    public static byte[] exportToExcel(List<?> data, Class<?> clazz) {
        // 统一的Excel导出逻辑
    }
}
```

#### 6.4.4 ImportUtils 导入工具类
```java
public class ImportUtils {
    public static <T> List<T> importFromCsv(MultipartFile file, Class<T> clazz) {
        // 统一的CSV导入逻辑
    }
}
```

---

## 7. 优先级建议

### P0 - 高优先级（立即处理）

1. **删除 `MobileController.healthCheck()`**
   - 工作量: 5分钟
   - 影响: 低（有替代方案）

2. **抽取 `extractToken()` 为工具类**
   - 工作量: 30分钟
   - 影响: 中（需要修改6个Controller）

3. **标准化CRUD路径**
   - 工作量: 2小时
   - 影响: 中（提高API一致性）

### P1 - 中优先级（本周完成）

4. **重命名冲突的方法**
   - 工作量: 1小时
   - 影响: 低（主要是命名）

5. **标准化导出/导入功能**
   - 工作量: 4小时
   - 影响: 高（提高代码复用）

6. **标准化批量操作路径**
   - 工作量: 2小时
   - 影响: 中（提高API一致性）

### P2 - 低优先级（下个迭代）

7. **创建 BaseController 抽象类**
   - 工作量: 8小时
   - 影响: 高（大幅减少重复代码）

8. **创建通用工具类**
   - 工作量: 4小时
   - 影响: 中（提高代码复用）

---

## 8. 风险评估

### 删除重复功能的风险

| 操作 | 风险等级 | 风险说明 | 缓解措施 |
|------|---------|---------|---------|
| 删除healthCheck | 低 | 可能有前端调用 | 先查询日志，确认无调用后删除 |
| 抽取extractToken | 低 | 逻辑简单，不会出错 | 充分测试即可 |
| 重命名方法 | 中 | 前端需要同步修改 | 与前端团队协调，分阶段迁移 |
| 标准化路径 | 高 | 所有客户端都需要修改 | 使用API版本管理，保留旧版本一段时间 |

---

## 9. 实施计划

### Week 1: 清理和抽取

- [ ] Day 1-2: 删除 `MobileController.healthCheck()`
- [ ] Day 2-3: 创建 `TokenUtils` 并替换所有 `extractToken()`
- [ ] Day 3-5: 创建 `ExportUtils` 和 `ImportUtils`

### Week 2: 标准化

- [ ] Day 1-2: 标准化CRUD路径
- [ ] Day 3-4: 标准化批量操作路径
- [ ] Day 5: 重命名冲突方法

### Week 3-4: 架构优化

- [ ] Week 3: 创建 `BaseController` 抽象类
- [ ] Week 4: 重构现有Controller继承 `BaseController`

---

## 10. 测试建议

### 单元测试
- 为所有新创建的工具类编写单元测试
- 覆盖率要求: >90%

### 集成测试
- 测试所有修改后的API端点
- 确保前后端契约不变

### 回归测试
- 运行完整的E2E测试套件
- 确保没有功能退化

---

## 11. 附录

### 11.1 完整的Controller端点清单

见下表 (共19个Controller, 约300+个端点):

| Controller | 端点数量 | CRUD | 导出 | 导入 | 搜索 | 统计 |
|-----------|---------|------|------|------|------|------|
| MobileController | 20 | - | - | - | - | ✅ |
| ConversionController | 14 | ✅ | ✅ | ✅ | - | ✅ |
| CustomerController | 27 | ✅ | ✅ | ✅ | ✅ | ✅ |
| EquipmentController | 30 | ✅ | ✅ | ✅ | ✅ | ✅ |
| FactorySettingsController | 25 | ✅ | ✅ | ✅ | - | - |
| MaterialBatchController | 26 | ✅ | ✅ | - | - | ✅ |
| ProcessingController | 20 | ✅ | - | - | - | ✅ |
| ProductTypeController | 13 | ✅ | - | - | ✅ | - |
| ProductionPlanController | 24 | ✅ | ✅ | - | - | ✅ |
| RawMaterialTypeController | 13 | ✅ | - | - | ✅ | - |
| ReportController | 23 | - | ✅ | - | - | ✅ |
| SupplierController | 22 | ✅ | ✅ | ✅ | ✅ | ✅ |
| SystemController | 8 | - | - | - | - | ✅ |
| TestController | 2 | - | - | - | - | - |
| TimeClockController | 14 | ✅ | ✅ | - | - | ✅ |
| TimeStatsController | 17 | - | ✅ | - | - | ✅ |
| UserController | 15 | ✅ | ✅ | ✅ | ✅ | - |
| WhitelistController | 24 | ✅ | ✅ | ✅ | ✅ | ✅ |
| WorkTypeController | 10 | ✅ | - | - | - | ✅ |

**总计**: 约 **307个API端点**

### 11.2 重复代码统计

- **完全重复的端点**: 2处
- **功能重复**: 18处
- **CRUD重复**: 11组（标准化即可）
- **工具方法重复**: `extractToken()` 在6个Controller中

**估计可减少的代码量**: 约 **500-800行**（通过抽取工具类和BaseController）

---

## 12. 总结

### 关键发现

1. **系统设计良好**: 大部分"重复"实际上是必要的业务功能，不是真正的重复
2. **主要问题**:
   - 工具方法重复 (`extractToken()`)
   - 命名不一致
   - 路径模式不统一
3. **优化方向**:
   - 标准化优于删除
   - 抽取公共组件优于重复代码

### 建议优先级

1. **立即处理** (P0): 删除真正的重复（如healthCheck）
2. **本周完成** (P1): 标准化命名和路径
3. **下个迭代** (P2): 创建BaseController和工具类

### 预期收益

- **代码量减少**: 500-800行
- **维护性提升**: 统一的API模式
- **开发效率**: 减少重复劳动

---

**报告生成时间**: 2025-11-01
**分析工具**: Claude Code (Anthropic)
**项目版本**: 1.0.0
