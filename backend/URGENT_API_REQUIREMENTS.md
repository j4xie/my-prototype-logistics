# 🚨 紧急后端API补充需求

**创建时间**: 2025-11-20
**优先级**: P0（最高优先级）
**来源**: P1-5 TODO清理 + 后端API核查
**状态**: 待实现

---

## 📋 需求总览

| 需求 | 类型 | 估计工作量 | 优先级 |
|------|------|-----------|--------|
| TodayStats字段补充 | 字段增强 | 30分钟 | P0 |
| 转冻品API | 新API | 1小时 | P0 |
| 平台统计API | 新API | 1小时 | P0 |
| **合计** | **3项** | **2.5小时** | **P0** |

---

## 🔥 需求1: TodayStats 字段补充

**文件**: `MobileDTO.java`
**位置**: Line 270 `class TodayStats`
**优先级**: P0（最高）
**工作量**: 30分钟

### 当前结构

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public static class TodayStats {
    private Integer productionCount;      // 生产数量
    private Integer qualityCheckCount;    // 质检数量
    private Integer materialReceived;     // 原材料接收
    private Integer ordersCompleted;      // 订单完成
    private Double productionEfficiency;  // 生产效率
    private Integer activeWorkers;        // 活跃工人
}
```

### 需要补充的字段

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public static class TodayStats {
    // ========== 现有字段保留 ==========
    private Integer productionCount;
    private Integer qualityCheckCount;
    private Integer materialReceived;
    private Integer ordersCompleted;
    private Double productionEfficiency;
    private Integer activeWorkers;

    // ========== 🆕 新增字段 ==========

    // 1. 今日产量（千克）
    private Double todayOutputKg;

    // 2. 总批次数
    private Integer totalBatches;

    // 3. 总工人数
    private Integer totalWorkers;

    // 4. 活跃设备数
    private Integer activeEquipment;

    // 5. 总设备数
    private Integer totalEquipment;
}
```

### 数据来源建议

**后端实现参考**:

```java
// 在 MobileService.getDashboardData() 中补充

TodayStats stats = TodayStats.builder()
    // 现有字段...
    .productionCount(...)
    .activeWorkers(...)

    // 🆕 新增字段
    .todayOutputKg(calculateTodayOutputKg(factoryId))           // 从 processing_batches 表计算今日actualOutput总和
    .totalBatches(countTotalBatches(factoryId))                // 从 processing_batches 表统计总数
    .totalWorkers(countTotalWorkers(factoryId))                // 从 users 表统计工厂总人数
    .activeEquipment(countActiveEquipment(factoryId))          // 从 equipment 表统计status='active'的数量
    .totalEquipment(countTotalEquipment(factoryId))            // 从 equipment 表统计总数
    .build();
```

**SQL参考**:

```sql
-- 1. 今日产量（kg）
SELECT COALESCE(SUM(actual_output), 0) as today_output_kg
FROM processing_batches
WHERE factory_id = ?
  AND DATE(start_time) = CURDATE()
  AND status IN ('completed', 'COMPLETED');

-- 2. 总批次数
SELECT COUNT(*) as total_batches
FROM processing_batches
WHERE factory_id = ?;

-- 3. 总工人数
SELECT COUNT(*) as total_workers
FROM users u
JOIN factory_users fu ON u.id = fu.user_id
WHERE fu.factory_id = ?
  AND u.is_active = true;

-- 4. 活跃设备数
SELECT COUNT(*) as active_equipment
FROM equipment
WHERE factory_id = ?
  AND status = 'active';

-- 5. 总设备数
SELECT COUNT(*) as total_equipment
FROM equipment
WHERE factory_id = ?;
```

**影响范围**:
- DTO修改: `MobileDTO.TodayStats`
- Service修改: `MobileService.getDashboardData()`
- 新增5个查询方法

---

## 🔥 需求2: 转冻品API

**端点**: `POST /api/mobile/{factoryId}/materials/batches/{id}/convert-to-frozen`
**优先级**: P0
**工作量**: 1小时

### API规范

**请求参数**:
- `factoryId` (path, required): String - 工厂ID
- `id` (path, required): Long - 原材料批次ID

**请求体**:
```json
{
  "convertedBy": 1,
  "convertedDate": "2025-11-20",
  "storageLocation": "冷库A区",
  "notes": "转冻品备注"
}
```

**响应格式**:
```json
{
  "code": 200,
  "success": true,
  "message": "已成功转为冻品",
  "data": {
    "id": 123,
    "batchNumber": "MB20251120001",
    "materialType": "frozen_chicken",
    "status": "frozen",
    "convertedAt": "2025-11-20T14:00:00Z",
    "storageLocation": "冷库A区"
  }
}
```

### 实现建议

**Controller**: `MaterialBatchController.java`

```java
@PostMapping("/{id}/convert-to-frozen")
@Operation(summary = "将原材料批次转为冻品")
public ApiResponse<MaterialBatchDTO> convertToFrozen(
        @PathVariable @Parameter(description = "工厂ID") String factoryId,
        @PathVariable @Parameter(description = "批次ID") Long id,
        @RequestBody @Valid ConvertToFrozenRequest request) {

    log.info("转冻品: factoryId={}, batchId={}", factoryId, id);
    MaterialBatchDTO result = materialBatchService.convertToFrozen(factoryId, id, request);
    return ApiResponse.success(result, "已成功转为冻品");
}
```

**DTO**: 新增 `ConvertToFrozenRequest`

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public static class ConvertToFrozenRequest {
    @NotNull(message = "操作人员ID不能为空")
    private Integer convertedBy;

    @NotNull(message = "转换日期不能为空")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate convertedDate;

    @NotBlank(message = "存储位置不能为空")
    private String storageLocation;

    private String notes;
}
```

**Service**: `MaterialBatchService.convertToFrozen()`

```java
@Transactional
public MaterialBatchDTO convertToFrozen(String factoryId, Long id, ConvertToFrozenRequest request) {
    // 1. 查询原材料批次
    MaterialBatch batch = materialBatchRepository.findByIdAndFactoryId(id, factoryId)
        .orElseThrow(() -> new BusinessException("批次不存在"));

    // 2. 验证批次状态（只有鲜品可以转冻品）
    if (!"fresh".equals(batch.getStatus())) {
        throw new BusinessException("只有鲜品批次可以转为冻品");
    }

    // 3. 更新批次状态
    batch.setStatus("frozen");
    batch.setStorageLocation(request.getStorageLocation());
    batch.setConvertedAt(LocalDateTime.now());
    batch.setConvertedBy(request.getConvertedBy());
    batch.setNotes(request.getNotes());

    // 4. 保存并返回
    MaterialBatch saved = materialBatchRepository.save(batch);
    return materialBatchMapper.toDTO(saved);
}
```

**数据库字段**:

检查 `material_batches` 表是否有以下字段，如无需添加：
- `converted_at` DATETIME - 转换时间
- `converted_by` INT - 操作人员ID
- `storage_location` VARCHAR(255) - 存储位置

---

## 🔥 需求3: 平台统计API

**端点**: `GET /api/platform/dashboard/statistics`
**优先级**: P0
**工作量**: 1小时

### API规范

**请求参数**: 无（使用 JWT token 识别平台管理员身份）

**响应格式**:
```json
{
  "code": 200,
  "success": true,
  "message": "获取成功",
  "data": {
    "totalFactories": 15,
    "activeFactories": 12,
    "inactiveFactories": 3,
    "totalUsers": 450,
    "activeUsers": 420,
    "totalBatches": 1250,
    "completedBatches": 1100,
    "totalProductionToday": 15000.5,
    "totalAIQuotaUsed": 1200,
    "totalAIQuotaLimit": 10000,
    "systemHealth": "healthy"
  }
}
```

### 实现建议

**Controller**: `PlatformController.java`

```java
@GetMapping("/dashboard/statistics")
@Operation(summary = "获取平台统计数据", description = "获取所有工厂的汇总统计（仅平台管理员）")
@PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
public ApiResponse<PlatformStatisticsDTO> getDashboardStatistics() {
    log.info("API调用: 获取平台统计数据");
    PlatformStatisticsDTO statistics = platformService.getDashboardStatistics();
    return ApiResponse.success(statistics);
}
```

**DTO**: 新增 `PlatformStatisticsDTO`

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformStatisticsDTO {
    private Integer totalFactories;
    private Integer activeFactories;
    private Integer inactiveFactories;
    private Integer totalUsers;
    private Integer activeUsers;
    private Long totalBatches;
    private Long completedBatches;
    private Double totalProductionToday;
    private Integer totalAIQuotaUsed;
    private Integer totalAIQuotaLimit;
    private String systemHealth;  // "healthy", "warning", "critical"
}
```

**Service**: `PlatformService.getDashboardStatistics()`

```java
public PlatformStatisticsDTO getDashboardStatistics() {
    // 1. 统计工厂
    long totalFactories = factoryRepository.count();
    long activeFactories = factoryRepository.countByIsActive(true);

    // 2. 统计用户
    long totalUsers = userRepository.count();
    long activeUsers = userRepository.countByIsActive(true);

    // 3. 统计批次
    long totalBatches = processingBatchRepository.count();
    long completedBatches = processingBatchRepository.countByStatus("completed");

    // 4. 统计今日产量
    Double todayProduction = processingBatchRepository.sumActualOutputByDate(LocalDate.now());

    // 5. 统计AI配额
    Integer aiQuotaUsed = aiUsageRepository.sumUsageByMonth(YearMonth.now());
    Integer aiQuotaLimit = 10000; // 从配置中读取

    // 6. 系统健康状态
    String systemHealth = determineSystemHealth(activeFactories, totalFactories);

    return PlatformStatisticsDTO.builder()
        .totalFactories((int) totalFactories)
        .activeFactories((int) activeFactories)
        .inactiveFactories((int) (totalFactories - activeFactories))
        .totalUsers((int) totalUsers)
        .activeUsers((int) activeUsers)
        .totalBatches(totalBatches)
        .completedBatches(completedBatches)
        .totalProductionToday(todayProduction != null ? todayProduction : 0.0)
        .totalAIQuotaUsed(aiQuotaUsed)
        .totalAIQuotaLimit(aiQuotaLimit)
        .systemHealth(systemHealth)
        .build();
}

private String determineSystemHealth(long activeFactories, long totalFactories) {
    double ratio = (double) activeFactories / totalFactories;
    if (ratio >= 0.9) return "healthy";
    if (ratio >= 0.7) return "warning";
    return "critical";
}
```

**SQL参考**:

```sql
-- 今日产量汇总
SELECT COALESCE(SUM(actual_output), 0) as total_production_today
FROM processing_batches
WHERE DATE(start_time) = CURDATE()
  AND status = 'completed';

-- AI配额统计（本月）
SELECT COALESCE(SUM(tokens_used), 0) as ai_quota_used
FROM ai_usage_logs
WHERE YEAR(created_at) = YEAR(CURDATE())
  AND MONTH(created_at) = MONTH(CURDATE());
```

---

## 📊 实现优先级

### 第一优先级（今天完成）

1. ✅ **TodayStats 字段补充**
   - 工作量: 30分钟
   - 影响: QuickStatsPanel 完整功能

### 第二优先级（今天/明天完成）

2. ✅ **转冻品 API**
   - 工作量: 1小时
   - 影响: MaterialBatchManagementScreen 功能完整

3. ✅ **平台统计 API**
   - 工作量: 1小时
   - 影响: PlatformDashboardScreen 功能完整

---

## ✅ 验收标准

### TodayStats 字段补充

- [ ] `MobileDTO.TodayStats` 包含5个新字段
- [ ] `MobileService.getDashboardData()` 返回正确数据
- [ ] 前端调用 `/dashboard/{factoryId}` 能获取所有字段
- [ ] 所有字段类型正确（Integer/Double）

### 转冻品 API

- [ ] 端点 `POST /materials/batches/{id}/convert-to-frozen` 可访问
- [ ] 接受正确的请求体
- [ ] 返回 200 和正确的响应格式
- [ ] 批次状态正确更新为 `frozen`
- [ ] 非鲜品批次调用时返回业务错误

### 平台统计 API

- [ ] 端点 `GET /platform/dashboard/statistics` 可访问
- [ ] 需要平台管理员权限
- [ ] 返回正确的统计数据
- [ ] 所有字段非空
- [ ] systemHealth 根据活跃工厂比例正确计算

---

## 🧪 测试建议

### 测试脚本

```bash
# 1. 测试 TodayStats
curl -X GET "http://localhost:10010/api/mobile/dashboard/CRETAS_2024_001" \
  -H "Authorization: Bearer $TOKEN"

# 预期响应包含:
# {
#   "data": {
#     "todayStats": {
#       "todayOutputKg": 1250.5,
#       "totalBatches": 150,
#       "totalWorkers": 50,
#       "activeEquipment": 18,
#       "totalEquipment": 20
#     }
#   }
# }

# 2. 测试转冻品
curl -X POST "http://localhost:10010/api/mobile/CRETAS_2024_001/materials/batches/123/convert-to-frozen" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "冷库A区",
    "notes": "测试转冻品"
  }'

# 预期响应: 200, status="frozen"

# 3. 测试平台统计
curl -X GET "http://localhost:10010/api/platform/dashboard/statistics" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN"

# 预期响应包含所有字段
```

---

## 📝 前端协调

**前端团队**: 暂时保留相关TODO注释，待后端完成后再删除

**后端完成通知**: 后端实现完成后，请在以下Issue中通知前端：
- Issue标题: `[P0] 后端API补充完成 - TodayStats + 转冻品 + 平台统计`
- 附带: 测试通过的curl命令和响应示例

---

## 🎯 时间表

| 任务 | 负责人 | 预计开始 | 预计完成 | 状态 |
|------|--------|---------|---------|------|
| TodayStats字段补充 | 后端团队 | 今天 | 今天 | ⏳ 待开始 |
| 转冻品API | 后端团队 | 今天 | 今天/明天 | ⏳ 待开始 |
| 平台统计API | 后端团队 | 今天 | 今天/明天 | ⏳ 待开始 |
| 前端集成测试 | 前端团队 | 后端完成后 | 后端完成后+1小时 | ⏳ 待开始 |

**总工作量**: 2.5小时（后端） + 1小时（前端集成）

---

## 📞 联系方式

**问题咨询**: 如有疑问，请在项目群联系前端负责人

**完成通知**: 后端完成后请@前端负责人

---

**文档创建**: 2025-11-20
**文档更新**: 待后端完成后更新状态
**优先级**: P0 - 紧急
**预期完成**: 今天/明天

🚨 **请后端团队优先处理此文档中的3项需求！**
