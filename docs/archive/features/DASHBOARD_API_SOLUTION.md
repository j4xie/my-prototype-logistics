# Dashboard API 解决方案

## 🎯 问题分析

**当前错误**:
```
❌ QuickStatsPanel - 加载统计数据失败: [AxiosError: Request failed with status code 403]
错误详情: {"message": "Request failed with status code 403", "status": 403, "url": "/api/mobile/processing/dashboard/production"}
```

## ✅ 答案：不需要创建新接口

**结论**: **不需要创建新的Dashboard API端点！** 可以直接使用现有的接口。

### 现有可用的Dashboard接口

根据API文档 (`docs/api/reference/swagger-api-reference.md`)，以下接口已经定义：

```typescript
GET /api/mobile/{factoryId}/processing/dashboard/overview      // 生产概览
GET /api/mobile/{factoryId}/processing/dashboard/production   // 生产统计
GET /api/mobile/{factoryId}/processing/dashboard/equipment    // 设备统计
GET /api/mobile/{factoryId}/processing/dashboard/quality      // 质量统计
GET /api/mobile/{factoryId}/processing/dashboard/alerts       // 告警统计
GET /api/mobile/{factoryId}/processing/dashboard/trends       // 趋势分析
```

这些接口在你的前端代码中已经正确调用：
- **文件**: `frontend/CretasFoodTrace/src/services/api/dashboardApiClient.ts`
- **组件**: `frontend/CretasFoodTrace/src/screens/main/components/QuickStatsPanel.tsx`

## 🔍 403错误的真正原因

### 可能原因1: 后端未实现 ⭐ 最有可能

**症状**: Java Spring Boot后端可能还没有实现这些Dashboard Controller

**检查方法**:
```bash
# 1. 检查Java后端是否有DashboardController
find . -name "*DashboardController.java" -o -name "*ProcessingController.java"

# 2. 检查日志
tail -f /www/wwwroot/cretas/cretas-backend.log

# 3. 测试接口
curl -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/production" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**解决方案**:
- **短期**: 使用Mock数据 (已经在你的代码中实现)
- **长期**: 在后端实现这些Controller端点

### 可能原因2: 权限配置问题

**症状**: 后端已实现接口，但权限配置错误

**检查**:
- 后端的 `@PreAuthorize` 注解配置
- Spring Security配置是否允许 `factory_super_admin` 访问
- Token是否包含正确的角色信息

### 可能原因3: 路径问题

**症状**: API路径不匹配

**检查**:
```bash
# 测试不同的路径格式
/api/mobile/FISH_2025_001/processing/dashboard/production    # 当前使用
/api/mobile/processing/dashboard/production?factoryId=FISH_2025_001  # 替代方案1
/api/processing/dashboard/production  # 替代方案2
```

## 💡 推荐解决方案

根据你的项目策略 (Phase 1-3 前端优先开发)，采用**分阶段方案**：

### Phase 1-3: 前端开发阶段 (当前) ✅

**策略**: 继续使用Mock数据，不阻塞前端开发

**实现**:

```typescript
// QuickStatsPanel.tsx (已实现)
try {
  setLoading(true);

  // 尝试调用真实API
  const [overviewRes, productionRes, equipmentRes] = await Promise.all([
    dashboardAPI.getDashboardOverview('today'),
    dashboardAPI.getProductionStatistics({ ... }),
    dashboardAPI.getEquipmentDashboard(),
  ]);

  // 解析数据...
} catch (error) {
  console.error('❌ API调用失败，使用Mock数据');

  // 使用Mock数据作为兜底
  setStatsData({
    todayOutput: 0,
    completedBatches: 0,
    totalBatches: 0,
    onDutyWorkers: 0,
    totalWorkers: 0,
    activeEquipment: 0,
    totalEquipment: 0,
  });
}
```

**优点**:
- ✅ 前端开发不受阻
- ✅ API接口已经设计好
- ✅ 一旦后端实现，前端无需修改

### Phase 4+: 后端实现阶段 (未来)

**策略**: 在Java Spring Boot后端实现Dashboard Controller

**需要实现的后端文件** (记录在后端需求文档中):

```java
// 1. 创建 DashboardController.java
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing/dashboard")
public class DashboardController {

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OPERATOR')")
    public ApiResponse<DashboardOverview> getOverview(
        @PathVariable String factoryId,
        @RequestParam(defaultValue = "today") String period
    ) {
        // 实现逻辑...
    }

    @GetMapping("/production")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OPERATOR')")
    public ApiResponse<ProductionStats> getProduction(
        @PathVariable String factoryId,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        // 实现逻辑...
    }

    @GetMapping("/equipment")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'DEPARTMENT_ADMIN')")
    public ApiResponse<EquipmentStats> getEquipment(
        @PathVariable String factoryId
    ) {
        // 实现逻辑...
    }

    // 其他dashboard端点...
}
```

**数据库查询逻辑**:
```java
// 从现有的表中聚合数据
// - processing_batch (生产批次)
// - user (员工考勤)
// - equipment (设备状态)
// - quality_inspection (质检记录)
```

## 📋 后端需求文档

**记录位置**: `backend/rn-update-tableandlogic.md` (如果存在)

**需要添加的内容**:

```markdown
### Dashboard API实现需求

#### 端点列表
1. **GET /api/mobile/{factoryId}/processing/dashboard/overview**
   - 功能: 获取生产概览数据
   - 权限: factory_super_admin, department_admin, operator
   - 返回数据:
     - summary: 批次统计、质检数、告警数、在岗人数
     - kpi: 生产效率、质量合格率、设备利用率
     - alerts: 当前活跃告警数

2. **GET /api/mobile/{factoryId}/processing/dashboard/production**
   - 功能: 获取生产统计数据
   - 权限: factory_super_admin, department_admin, operator
   - 查询参数: startDate, endDate, department
   - 返回数据:
     - batchStatusDistribution: 按状态分组的批次统计
     - productTypeStats: 按产品类型分组的统计
     - dailyTrends: 每日生产趋势

3. **GET /api/mobile/{factoryId}/processing/dashboard/equipment**
   - 功能: 获取设备统计数据
   - 权限: factory_super_admin, department_admin
   - 返回数据:
     - statusDistribution: 设备状态分布
     - departmentDistribution: 部门设备分布
     - summary: 设备总数、在用数、利用率

4. **GET /api/mobile/{factoryId}/processing/dashboard/quality**
   - 功能: 获取质量统计数据
   - 权限: factory_super_admin, department_admin
   - 查询参数: period (week/month/quarter)

5. **GET /api/mobile/{factoryId}/processing/dashboard/alerts**
   - 功能: 获取告警统计数据
   - 权限: factory_super_admin, department_admin

6. **GET /api/mobile/{factoryId}/processing/dashboard/trends**
   - 功能: 获取趋势分析数据
   - 权限: factory_super_admin, department_admin
   - 查询参数: period, metric (production/quality)

#### 数据库查询需求

**涉及的表**:
- `processing_batch` - 生产批次数据
- `user` - 用户考勤数据
- `equipment` - 设备状态数据
- `quality_inspection` - 质检记录
- `alert` - 告警记录 (如果存在)

**示例SQL查询**:
```sql
-- 今日批次统计
SELECT
  status,
  COUNT(*) as count,
  SUM(quantity) as totalQuantity
FROM processing_batch
WHERE factory_id = ?
  AND DATE(created_at) = CURRENT_DATE
GROUP BY status;

-- 在岗员工统计
SELECT COUNT(DISTINCT user_id)
FROM attendance
WHERE factory_id = ?
  AND DATE(clock_in) = CURRENT_DATE
  AND clock_out IS NULL;

-- 设备利用率
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as active
FROM equipment
WHERE factory_id = ?;
```
```

## 🚀 立即可以做的

### 选项1: 改进Mock数据显示

在 `QuickStatsPanel.tsx` 中使用更真实的Mock数据：

```typescript
// catch块中使用示例数据而不是全0
catch (error) {
  console.warn('⚠️ 使用Mock数据 - Dashboard API未实现');
  setStatsData({
    todayOutput: 156.5,           // Mock: 156.5kg
    completedBatches: 3,          // Mock: 3个批次
    totalBatches: 5,              // Mock: 总共5个批次
    onDutyWorkers: 8,             // Mock: 8人在岗
    totalWorkers: 12,             // Mock: 总共12人
    activeEquipment: 4,           // Mock: 4台设备运行
    totalEquipment: 6,            // Mock: 总共6台设备
  });
}
```

### 选项2: 添加Mock数据服务 (推荐)

创建一个Mock数据服务文件：

```typescript
// src/services/mockData/dashboardMockData.ts
export const mockDashboardData = {
  overview: {
    period: 'today',
    summary: {
      totalBatches: 5,
      activeBatches: 2,
      completedBatches: 3,
      qualityInspections: 3,
      activeAlerts: 1,
      onDutyWorkers: 8,
      totalWorkers: 12,
    },
    kpi: {
      productionEfficiency: 85.5,
      qualityPassRate: 95.2,
      equipmentUtilization: 72.3,
    },
    alerts: {
      active: 1,
      status: 'warning',
    },
  },
  production: {
    batchStatusDistribution: [
      { status: 'COMPLETED', count: 3, totalQuantity: 156.5 },
      { status: 'IN_PROGRESS', count: 2, totalQuantity: 98.0 },
    ],
    productTypeStats: [
      { productType: '鱼片', count: 2, totalQuantity: 120.0, avgQuantity: 60.0 },
      { productType: '鱼丸', count: 3, totalQuantity: 134.5, avgQuantity: 44.8 },
    ],
    dailyTrends: [
      { date: '2025-11-01', batches: 4, quantity: 180.0, completed: 4 },
      { date: '2025-11-02', batches: 5, quantity: 254.5, completed: 3 },
    ],
  },
  equipment: {
    statusDistribution: [
      { status: 'RUNNING', count: 4 },
      { status: 'IDLE', count: 2 },
      { status: 'MAINTENANCE', count: 0 },
    ],
    departmentDistribution: [
      { department: '加工车间', count: 4 },
      { department: '包装车间', count: 2 },
    ],
    summary: {
      totalEquipment: 6,
      activeEquipment: 4,
      utilizationRate: 66.7,
      recentAlerts: 1,
    },
  },
};
```

然后在 `QuickStatsPanel.tsx` 中使用：

```typescript
import { mockDashboardData } from '../../../services/mockData/dashboardMockData';

catch (error) {
  console.warn('⚠️ 使用Mock数据 - Dashboard API未实现');

  // 使用详细的Mock数据
  const overview = mockDashboardData.overview;
  const production = mockDashboardData.production;
  const equipment = mockDashboardData.equipment;

  // 计算今日产量
  const todayOutput = production.batchStatusDistribution.reduce(
    (sum, stat) => sum + stat.totalQuantity,
    0
  );

  setStatsData({
    todayOutput,
    completedBatches: overview.summary.completedBatches,
    totalBatches: overview.summary.totalBatches,
    onDutyWorkers: overview.summary.onDutyWorkers,
    totalWorkers: overview.summary.totalWorkers,
    activeEquipment: equipment.summary.activeEquipment,
    totalEquipment: equipment.summary.totalEquipment,
  });
}
```

### 选项3: 环境配置切换

在 `config.ts` 中添加Mock模式开关：

```typescript
// src/constants/config.ts
export const APP_CONFIG = {
  // API配置
  API_BASE_URL: 'http://106.14.165.234:10010',

  // 开发配置
  USE_MOCK_DATA: true,  // 开发阶段使用Mock数据
  ENABLE_API_LOGGING: true,

  // 生产配置
  PRODUCTION_MODE: false,
};
```

然后在API客户端中使用：

```typescript
// dashboardApiClient.ts
import { APP_CONFIG } from '../../constants/config';
import { mockDashboardData } from '../mockData/dashboardMockData';

export const dashboardAPI = {
  getDashboardOverview: async (period = 'today') => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 使用Mock数据 - Dashboard Overview');
      return {
        success: true,
        data: mockDashboardData.overview,
        message: 'Mock数据',
      };
    }

    // 真实API调用
    const response = await apiClient.get('/api/mobile/processing/dashboard/overview', {
      params: { period },
    });
    return response.data;
  },

  // 其他方法类似...
};
```

## 📊 测试和验证

### 前端测试 (立即可用)

```typescript
// 在组件中添加日志
console.log('📊 Dashboard数据:', statsData);

// 检查API响应
console.log('📡 API响应:', overviewRes);
```

### 后端测试 (Phase 4+)

```bash
# 1. 测试登录
curl -X POST "http://106.14.165.234:10010/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD","factoryId":"FISH_2025_001"}'

# 2. 获取Token后测试Dashboard API
TOKEN="YOUR_ACCESS_TOKEN"
curl -X GET "http://106.14.165.234:10010/api/mobile/FISH_2025_001/processing/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN"
```

## 🎯 总结

### 回答你的问题

**Q: Dashboard接口一定要创建新的接口和端点吗？能不能用已有的接口的不同的端点？**

**A: 不需要创建新接口！**

1. ✅ **API接口已经设计好**: `/api/mobile/{factoryId}/processing/dashboard/*` 系列端点
2. ✅ **前端代码已经实现**: `dashboardApiClient.ts` 已经包含所有调用
3. ❌ **后端还未实现**: Java Spring Boot后端可能还没有实现这些Controller
4. ✅ **短期方案**: 使用Mock数据，不阻塞前端开发
5. ✅ **长期方案**: Phase 4+ 实现后端接口，前端无需修改

### 下一步行动

**立即可以做**:
1. 使用Mock数据完善前端展示 (选项1或选项2)
2. 记录后端需求到文档 (如果有 `backend/rn-update-tableandlogic.md`)
3. 继续前端其他功能开发

**Phase 4+ 后端开发时**:
1. 实现 `DashboardController.java`
2. 配置权限和角色访问控制
3. 编写数据库查询逻辑
4. 前端切换到真实API (只需修改 `USE_MOCK_DATA` 配置)

---

**最后更新**: 2025-11-02
**状态**: Phase 1-3 前端开发阶段 - 使用Mock数据方案
