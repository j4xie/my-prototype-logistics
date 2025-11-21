# 白垩纪食品溯源系统 - 功能与文件映射 v2.0

> **版本**: v2.0 (优化版)
> **生成日期**: 2025-11-20
> **格式**: Markdown (便于版本控制和维护)
> **v1.0对比**: 补充了AI分析、设备告警、数据导入导出等核心功能

---

## 📑 文档目录

1. [认证与权限模块](#1-认证与权限模块)
2. [考勤管理模块](#2-考勤管理模块)
3. [生产加工模块](#3-生产加工模块)
4. [AI智能分析模块](#4-ai智能分析模块-新增)
5. [设备管理模块](#5-设备管理模块-完善)
6. [库存管理模块](#6-库存管理模块)
7. [质量检验模块](#7-质量检验模块)
8. [基础数据管理模块](#8-基础数据管理模块)
9. [平台管理模块](#9-平台管理模块)
10. [报表分析模块](#10-报表分析模块-新增)
11. [数据导入导出](#11-数据导入导出-新增)
12. [更新日志](#更新日志)

---

## 1. 认证与权限模块

### 1.1 统一登录

**功能描述**: 支持平台管理员和工厂用户的统一登录入口，系统自动识别用户类型并路由到对应界面。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/auth/EnhancedLoginScreen.tsx` | 登录页面主组件 | ~400行 |
| `frontend/CretasFoodTrace/src/services/auth/authService.ts` | 认证服务封装 | ~250行 |
| `frontend/CretasFoodTrace/src/services/api/apiClient.ts` | 统一API客户端 | ~180行 |
| `frontend/CretasFoodTrace/src/services/tokenManager.ts` | Token管理器 | ~120行 |
| `frontend/CretasFoodTrace/src/store/authStore.ts` | 认证状态管理(Zustand) | ~150行 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/MobileController.java` | 移动端控制器 | 603行 |
| `backend-java/src/main/java/com/cretas/aims/service/AuthService.java` | 认证服务 | ~200行 |
| `backend-java/src/main/java/com/cretas/aims/security/JwtTokenProvider.java` | JWT工具类 | ~150行 |

#### API端点
```
POST /api/mobile/auth/unified-login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "Admin@123456",
  "deviceId": "UUID-xxx-xxx",
  "deviceInfo": {
    "model": "iPhone 13",
    "os": "iOS 16.0"
  }
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "roleCode": "super_admin",
      "factoryId": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 1800
    },
    "userType": "platform"
  }
}
```

#### 数据库表
- `users` - 工厂用户表
- `platform_admin` - 平台管理员表
- `user_sessions` - 会话记录表

---

### 1.2 Token刷新

**功能描述**: 自动刷新accessToken，无需用户重新登录。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/services/api/apiClient.ts` | Axios响应拦截器自动刷新 |

**拦截器逻辑**:
```typescript
// 响应拦截器 - 自动刷新Token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = await TokenManager.getRefreshToken();

      const response = await apiClient.post('/mobile/auth/refresh', null, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      const { accessToken } = response.data.data;
      await TokenManager.setAccessToken(accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);
```

#### API端点
```
POST /api/mobile/auth/refresh
```

---

### 1.3 用户注册（两阶段）

**功能描述**: 两阶段注册流程 - 手机验证 → 创建账户。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/auth/RegisterScreen.tsx` | 注册页面 |

#### API端点
```
POST /api/mobile/auth/register-phase-one    # 手机验证
POST /api/mobile/auth/register-phase-two    # 创建账户
```

---

### 1.4 忘记密码

**功能描述**: 通过手机验证码重置密码。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/auth/ForgotPasswordScreen.tsx` | 忘记密码页面 |

#### API端点
```
POST /api/mobile/auth/send-verification-code   # 发送验证码
POST /api/mobile/auth/verify-reset-code        # 验证验证码
POST /api/mobile/auth/forgot-password          # 重置密码
```

---

### 1.5 权限验证

**功能描述**: 前端路由守卫和后端注解验证相结合的权限控制。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/components/permissions/PermissionGuard.tsx` | 权限守卫组件 |
| `frontend/CretasFoodTrace/src/store/permissionStore.ts` | 权限状态管理 |

**使用示例**:
```tsx
<PermissionGuard requiredRole="factory_admin">
  <UserManagementScreen />
</PermissionGuard>
```

#### 后端实现
**Spring Security 注解**:
```java
@PreAuthorize("hasRole('ROLE_FACTORY_ADMIN') or hasRole('ROLE_SUPER_ADMIN')")
@PostMapping("/users")
public ResponseEntity<User> createUser(@RequestBody User user) {
  // ...
}
```

---

## 2. 考勤管理模块

### 2.1 员工打卡

**功能描述**: 支持上下班打卡、休息管理、GPS位置验证。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/attendance/TimeClockScreen.tsx` | 打卡页面 | ~350行 |
| `frontend/CretasFoodTrace/src/services/api/timeclockApiClient.ts` | 打卡API客户端 | ~180行 |

**页面功能**:
- 实时显示当前时间
- GPS位置获取（可选）
- 上班打卡 / 下班打卡 / 开始休息 / 结束休息
- 今日打卡记录展示
- 工作时长实时计算

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/TimeClockController.java` | 打卡控制器 | 216行 |

#### API端点
```
POST /api/mobile/{factoryId}/timeclock/clock-in      # 上班打卡
POST /api/mobile/{factoryId}/timeclock/clock-out     # 下班打卡
POST /api/mobile/{factoryId}/timeclock/break-start   # 开始休息
POST /api/mobile/{factoryId}/timeclock/break-end     # 结束休息
GET  /api/mobile/{factoryId}/timeclock/status        # 打卡状态
GET  /api/mobile/{factoryId}/timeclock/today         # 今日打卡记录
```

#### 数据库表
- `time_clock_record` - 打卡记录表
  - `id` - 主键
  - `factory_id` - 工厂ID
  - `user_id` - 用户ID
  - `clock_in_time` - 上班时间
  - `clock_out_time` - 下班时间
  - `break_start_time` - 休息开始时间
  - `break_end_time` - 休息结束时间
  - `work_minutes` - 工作分钟数
  - `location` - GPS位置

---

### 2.2 考勤历史

**功能描述**: 查看个人或部门的考勤历史记录。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/attendance/AttendanceHistoryScreen.tsx` | 考勤历史页面 |
| `frontend/CretasFoodTrace/src/screens/attendance/DepartmentAttendanceScreen.tsx` | 部门考勤页面 |

#### API端点
```
GET /api/mobile/{factoryId}/timeclock/history               # 个人考勤历史
GET /api/mobile/{factoryId}/timeclock/department/{dept}     # 部门考勤
GET /api/mobile/{factoryId}/timeclock/statistics            # 考勤统计
```

---

### 2.3 工时统计

**功能描述**: 工时汇总、加班统计、工时排行榜。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/attendance/TimeStatsScreen.tsx` | 工时统计页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/TimeStatsController.java` | 工时统计控制器 | 259行 |

#### API端点
```
GET /api/mobile/{factoryId}/time-stats/summary              # 工时汇总
GET /api/mobile/{factoryId}/time-stats/by-department        # 部门工时统计
GET /api/mobile/{factoryId}/time-stats/by-user/{userId}    # 用户工时统计
GET /api/mobile/{factoryId}/personnel/work-hours-ranking   # 工时排行榜
GET /api/mobile/{factoryId}/personnel/overtime-statistics  # 加班统计
```

---

## 3. 生产加工模块

### 3.1 批次列表

**功能描述**: 显示所有生产批次，支持筛选、搜索、排序。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/processing/BatchListScreen.tsx` | 批次列表页面 | ~400行 |
| `frontend/CretasFoodTrace/src/services/api/processingApiClient.ts` | 生产API客户端 | ~450行 |

**页面功能**:
- 批次列表展示（分页）
- 状态筛选（pending/processing/completed/cancelled）
- 日期范围筛选
- 搜索批次号/产品名称
- 按创建时间/完成时间排序

#### API端点
```
GET /api/mobile/{factoryId}/processing/batches?page=0&size=20&status=processing&sort=createdAt,desc
```

**查询参数**:
- `page`: 页码 (从0开始)
- `size`: 每页大小
- `status`: `pending` | `processing` | `completed` | `cancelled`
- `startDate`, `endDate`: 日期范围
- `supervisorId`: 主管ID
- `sort`: 排序字段

#### 数据库表
- `processing_batch` - 加工批次表

---

### 3.2 批次创建

**功能描述**: 创建新的生产批次，指定产品、数量、原材料需求。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/processing/CreateBatchScreen.tsx` | 批次创建页面 | ~500行 |
| `frontend/CretasFoodTrace/src/components/processing/MaterialTypeSelector.tsx` | 材料类型选择器 | ~180行 |
| `frontend/CretasFoodTrace/src/components/processing/SupervisorSelector.tsx` | 主管选择器 | ~120行 |

**表单字段**:
- 产品名称（必填）
- 数量 + 单位（必填）
- 主管（必填）
- 原材料需求（多个，可选）
- 备注

#### API端点
```
POST /api/mobile/{factoryId}/processing/batches
```

**请求体**:
```json
{
  "productName": "冷冻虾仁",
  "quantity": 1000,
  "unit": "kg",
  "supervisorId": 5,
  "materialRequirements": [
    {
      "materialBatchId": "MB-001",
      "quantity": 1200
    }
  ],
  "notes": "优先生产"
}
```

---

### 3.3 批次详情

**功能描述**: 查看批次的完整信息，包括成本、工时、设备使用、质检记录。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/processing/BatchDetailScreen.tsx` | 批次详情页面 | ~600行 |

**页面内容**:
- 基本信息（批次号、产品、数量、状态）
- 成本分解（原材料、人工、设备、总成本）
- 参与人员列表
- 设备使用记录
- 质检记录列表
- 时间线（批次生命周期事件）

#### API端点
```
GET /api/mobile/{factoryId}/processing/batches/{batchId}
GET /api/mobile/{factoryId}/processing/batches/{batchId}/timeline
```

---

### 3.4 批次操作

**功能描述**: 开始生产、暂停、完成、取消批次。

#### 前端实现
批次详情页面提供操作按钮。

#### API端点
```
POST /api/mobile/{factoryId}/processing/batches/{batchId}/start      # 开始生产
POST /api/mobile/{factoryId}/processing/batches/{batchId}/pause      # 暂停生产
POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete   # 完成生产
POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel     # 取消生产
```

**完成生产请求体**:
```json
{
  "actualQuantity": 980,
  "goodQuantity": 950,
  "defectQuantity": 30,
  "notes": "部分原料质量问题导致次品增加"
}
```

---

### 3.5 原材料批次管理

**功能描述**: 管理原材料批次，包括入库、消耗、调整、冻结、退回。

#### 前端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `frontend/CretasFoodTrace/src/screens/processing/MaterialBatchManagementScreen.tsx` | 原材料批次管理页面 | 56KB (最大文件) |
| `frontend/CretasFoodTrace/src/screens/processing/MaterialReceiptScreen.tsx` | 原料接收页面 | ~300行 |
| `frontend/CretasFoodTrace/src/screens/processing/InventoryCheckScreen.tsx` | 库存盘点页面 | ~350行 |
| `frontend/CretasFoodTrace/src/screens/processing/InventoryStatisticsScreen.tsx` | 库存统计页面 | ~400行 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/MaterialBatchController.java` | 原材料批次控制器 | 463行 |

#### API端点
```
# CRUD
GET    /api/mobile/{factoryId}/material-batches                    # 批次列表
POST   /api/mobile/{factoryId}/material-batches                    # 创建批次（入库）
GET    /api/mobile/{factoryId}/material-batches/{batchId}          # 批次详情
PUT    /api/mobile/{factoryId}/material-batches/{batchId}          # 更新批次
DELETE /api/mobile/{factoryId}/material-batches/{batchId}          # 删除批次

# 查询
GET /api/mobile/{factoryId}/material-batches/material-type/{typeId}  # 按材料类型
GET /api/mobile/{factoryId}/material-batches/status/{status}         # 按状态
GET /api/mobile/{factoryId}/material-batches/low-stock               # 低库存
GET /api/mobile/{factoryId}/material-batches/near-expiry             # 临期
GET /api/mobile/{factoryId}/material-batches/statistics              # 库存统计
GET /api/mobile/{factoryId}/material-batches/search?q=虾仁           # 搜索

# 操作
POST /api/mobile/{factoryId}/material-batches/{batchId}/adjust       # 调整数量
POST /api/mobile/{factoryId}/material-batches/{batchId}/consume      # 记录消耗
POST /api/mobile/{factoryId}/material-batches/{batchId}/return       # 退回
POST /api/mobile/{factoryId}/material-batches/{batchId}/freeze       # 冻结
POST /api/mobile/{factoryId}/material-batches/{batchId}/unfreeze     # 解冻
POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen  # 转冷冻
```

#### 数据库表
- `material_batch` - 原材料批次表
  - `id` - 主键
  - `factory_id` - 工厂ID
  - `material_type_id` - 材料类型ID
  - `batch_number` - 批次号
  - `quantity` - 数量
  - `available_quantity` - 可用数量
  - `unit` - 单位
  - `status` - 状态
  - `supplier_id` - 供应商ID
  - `purchase_date` - 采购日期
  - `expiry_date` - 过期日期
  - `unit_price` - 单价
  - `storage_location` - 存储位置

---

### 3.6 生产计划

**功能描述**: 创建、执行、完成生产计划。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/ProductionPlanManagementScreen.tsx` | 生产计划管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/ProductionPlanController.java` | 生产计划控制器 | 387行 |

#### API端点
```
GET  /api/mobile/{factoryId}/production-plans           # 计划列表
POST /api/mobile/{factoryId}/production-plans           # 创建计划
PUT  /api/mobile/{factoryId}/production-plans/{id}      # 更新计划
POST /api/mobile/{factoryId}/production-plans/{id}/execute   # 执行计划
POST /api/mobile/{factoryId}/production-plans/{id}/complete  # 完成计划
```

---

### 3.7 质量检验

**功能描述**: 提交质检记录、查看质检列表、质量统计。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/QualityInspectionListScreen.tsx` | 质检列表页面 |
| `frontend/CretasFoodTrace/src/screens/processing/QualityInspectionDetailScreen.tsx` | 质检详情页面 |
| `frontend/CretasFoodTrace/src/screens/processing/CreateQualityRecordScreen.tsx` | 创建质检记录页面 |
| `frontend/CretasFoodTrace/src/screens/processing/QualityAnalyticsScreen.tsx` | 质量分析页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/QualityInspectionController.java` | 质检控制器 | 107行 |

#### API端点
```
GET  /api/mobile/{factoryId}/quality-inspections                 # 质检列表
GET  /api/mobile/{factoryId}/quality-inspections/{id}            # 质检详情
POST /api/mobile/{factoryId}/quality-inspections                 # 创建质检
PUT  /api/mobile/{factoryId}/quality-inspections/{id}            # 更新质检
GET  /api/mobile/{factoryId}/processing/quality/statistics       # 质量统计
GET  /api/mobile/{factoryId}/processing/quality/trends           # 质量趋势
```

**质检记录字段**:
```json
{
  "productionBatchId": "BATCH-20251120-001",
  "result": "pass",  // "pass" | "fail" | "pending"
  "temperature": 4.5,
  "weight": 980.5,
  "appearance": "良好",
  "smell": "正常",
  "texture": "紧实",
  "notes": "符合标准",
  "photos": ["url1", "url2"]
}
```

#### 数据库表
- `quality_inspection` - 质检记录表

---

### 3.8 成本分析

**功能描述**: 查看批次成本分析、成本对比。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard.tsx` | 成本分析仪表盘 |
| `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard/CostOverviewCard.tsx` | 成本概览卡片 |
| `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard/LaborStatsCard.tsx` | 人工成本卡片 |
| `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard/EquipmentStatsCard.tsx` | 设备成本卡片 |
| `frontend/CretasFoodTrace/src/screens/processing/CostAnalysisDashboard/AIAnalysisSection.tsx` | AI分析区域 |
| `frontend/CretasFoodTrace/src/screens/processing/CostComparisonScreen.tsx` | 成本对比页面 |

#### API端点
```
GET /api/mobile/{factoryId}/processing/batches/{batchId}/cost-analysis   # 批次成本分析
GET /api/mobile/{factoryId}/processing/cost-comparison?batchIds=B001,B002,B003  # 批次成本对比
POST /api/mobile/{factoryId}/processing/batches/{batchId}/recalculate-cost      # 重算成本
```

**成本分析响应**:
```json
{
  "code": 200,
  "data": {
    "batchId": "BATCH-20251120-001",
    "totalCost": 15000.00,
    "costBreakdown": {
      "material": {
        "amount": 8000.00,
        "percentage": 53.33
      },
      "labor": {
        "amount": 5000.00,
        "percentage": 33.33,
        "details": [
          {
            "workerId": 10,
            "workerName": "张三",
            "workMinutes": 360,
            "cost": 2500.00
          }
        ]
      },
      "equipment": {
        "amount": 2000.00,
        "percentage": 13.33
      }
    },
    "unitCost": 15.31
  }
}
```

---

### 3.9 生产仪表盘

**功能描述**: 生产概览、产量统计、质量仪表盘、设备仪表盘。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/ProcessingDashboard.tsx` | 生产仪表盘 |

#### API端点
```
GET /api/mobile/{factoryId}/processing/dashboard/overview     # 生产概览
GET /api/mobile/{factoryId}/processing/dashboard/production   # 生产统计
GET /api/mobile/{factoryId}/processing/dashboard/quality      # 质量仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/equipment    # 设备仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/alerts       # 告警仪表盘
GET /api/mobile/{factoryId}/processing/dashboard/trends       # 趋势分析
```

---

## 4. AI智能分析模块 ✨新增

**功能描述**: DeepSeek驱动的AI成本分析、优化建议、配额管理。

### 4.1 AI批次成本分析

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/DeepSeekAnalysisScreen.tsx` | DeepSeek分析页面 |
| `frontend/CretasFoodTrace/src/screens/processing/AIAnalysisDetailScreen.tsx` | AI分析详情页面 |
| `frontend/CretasFoodTrace/src/screens/processing/AIReportListScreen.tsx` | AI报告列表页面 |
| `frontend/CretasFoodTrace/src/screens/processing/AIConversationHistoryScreen.tsx` | AI对话历史页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/AIController.java` | AI控制器 | 409行 |
| `backend-java/src/main/java/com/cretas/aims/service/AIAnalysisService.java` | AI分析服务 | ~350行 |
| `backend-java/src/main/java/com/cretas/aims/service/DeepSeekApiClient.java` | DeepSeek API客户端 | ~200行 |

#### API端点
```
# 成本分析
POST /api/mobile/{factoryId}/ai/analysis/cost/batch         # 单批次分析
POST /api/mobile/{factoryId}/ai/analysis/cost/time-range    # 时间范围分析
POST /api/mobile/{factoryId}/ai/analysis/cost/compare       # 批次对比分析

# 配额管理
GET  /api/mobile/{factoryId}/ai/quota                        # 查询配额
PUT  /api/mobile/{factoryId}/ai/quota                        # 更新配额（平台管理员）

# 对话管理
GET    /api/mobile/{factoryId}/ai/conversations/{sessionId}  # 对话历史
DELETE /api/mobile/{factoryId}/ai/conversations/{sessionId}  # 关闭对话

# 报告管理
GET  /api/mobile/{factoryId}/ai/reports                      # 报告列表
GET  /api/mobile/{factoryId}/ai/reports/{reportId}           # 报告详情
POST /api/mobile/{factoryId}/ai/reports/generate             # 生成报告

# 健康检查
GET /api/mobile/{factoryId}/ai/health                        # AI服务健康检查
```

**AI分析请求**:
```json
{
  "batchId": "BATCH-20251120-001",
  "question": "分析这个批次的成本构成，找出可优化的地方",
  "sessionId": null
}
```

**AI分析响应**:
```json
{
  "code": 200,
  "data": {
    "reportId": "AI-REPORT-001",
    "analysis": "根据数据分析，该批次总成本15000元，其中人工成本占比33.33%略高于行业平均水平...",
    "suggestions": [
      "建议优化生产流程，减少人工工时",
      "考虑采用自动化设备降低人工成本"
    ],
    "costBreakdown": {
      "material": 8000.00,
      "labor": 5000.00,
      "equipment": 2000.00
    },
    "sessionId": "AI-SESSION-001",
    "quotaConsumed": 1,
    "quotaRemaining": 14
  }
}
```

#### 数据库表
- `ai_analysis_result` - AI分析结果表
- `ai_audit_log` - AI审计日志表
- `ai_usage_log` - AI使用日志表
- `ai_conversation` - AI对话表
- `ai_quota` - AI配额表

#### 缓存策略
- Redis缓存，TTL 5分钟
- 相似问题直接返回缓存，不消耗配额
- 缓存Key: `MD5(batchId + question)`

---

### 4.2 AI时间范围分析

**功能描述**: 分析周度/月度成本趋势，找出异常波动原因。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/TimeRangeCostAnalysisScreen.tsx` | 时间范围成本分析页面 |

---

### 4.3 AI批次对比分析

**功能描述**: 对比2-5个批次的成本效率，找出最佳实践。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/BatchComparisonScreen.tsx` | 批次对比分析页面 |

---

## 5. 设备管理模块 🔧完善

**功能描述**: 设备CRUD、设备监控、设备告警生命周期管理。

### 5.1 设备列表与管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/EquipmentManagementScreen.tsx` | 设备管理页面 |
| `frontend/CretasFoodTrace/src/screens/processing/EquipmentDetailScreen.tsx` | 设备详情页面 |
| `frontend/CretasFoodTrace/src/screens/processing/EquipmentMonitoringScreen.tsx` | 设备监控页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/EquipmentController.java` | 设备控制器 | 502行 |

#### API端点
```
# CRUD
GET    /api/mobile/{factoryId}/equipment                    # 设备列表
POST   /api/mobile/{factoryId}/equipment                    # 创建设备
GET    /api/mobile/{factoryId}/equipment/{equipmentId}      # 设备详情
PUT    /api/mobile/{factoryId}/equipment/{equipmentId}      # 更新设备
DELETE /api/mobile/{factoryId}/equipment/{equipmentId}      # 删除设备

# 查询
GET /api/mobile/{factoryId}/equipment/status/{status}       # 按状态
GET /api/mobile/{factoryId}/equipment/type/{type}           # 按类型
GET /api/mobile/{factoryId}/equipment/search?q=冷冻          # 搜索

# 操作
POST /api/mobile/{factoryId}/equipment/{equipmentId}/start         # 启动设备
POST /api/mobile/{factoryId}/equipment/{equipmentId}/stop          # 停止设备
POST /api/mobile/{factoryId}/equipment/{equipmentId}/maintenance   # 记录维护
GET  /api/mobile/{factoryId}/equipment/{equipmentId}/history       # 使用历史
GET  /api/mobile/{factoryId}/equipment/{equipmentId}/alerts        # 设备告警

# 统计
GET /api/mobile/{factoryId}/equipment/statistics             # 设备统计
GET /api/mobile/{factoryId}/equipment/utilization            # 设备利用率
```

#### 数据库表
- `equipment` - 设备表
  - `id` - 主键
  - `factory_id` - 工厂ID
  - `name` - 设备名称
  - `type` - 设备类型
  - `model` - 型号
  - `status` - 状态 (idle/running/maintenance/scrapped)
  - `purchase_date` - 采购日期
  - `purchase_price` - 采购价格
  - `lifespan_years` - 使用年限
  - `last_maintenance_date` - 上次维护日期

---

### 5.2 设备告警管理 ✨新增

**功能描述**: 设备告警的完整生命周期管理（触发 → 确认 → 处理 → 解决 → 归档）。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/EquipmentAlertsScreen.tsx` | 设备告警页面 |

#### API端点
```
# 告警列表
GET /api/mobile/{factoryId}/equipment-alerts?status=ACTIVE&severity=HIGH

# 告警操作
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge    # 确认告警
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve        # 解决告警
POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/ignore         # 忽略告警

# 告警统计
GET /api/mobile/{factoryId}/equipment-alerts/statistics?period=weekly
```

**告警生命周期**:
```
ACTIVE → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
         ↓
       IGNORED
```

**解决告警请求**:
```json
{
  "solution": "更换了温度传感器",
  "preventiveMeasures": "建议每月检查一次传感器"
}
```

#### 数据库表
- `equipment_alert` - 设备告警表
  - `id` - 主键
  - `equipment_id` - 设备ID
  - `factory_id` - 工厂ID
  - `alert_type` - 告警类型 (TEMPERATURE/FAULT/MAINTENANCE)
  - `severity` - 严重程度 (LOW/MEDIUM/HIGH/CRITICAL)
  - `status` - 状态
  - `triggered_at` - 触发时间
  - `acknowledged_at` - 确认时间
  - `resolved_at` - 解决时间
  - `acknowledged_by` - 确认人
  - `resolved_by` - 解决人
  - `description` - 描述

---

## 6. 库存管理模块

**功能描述**: 库存预警、盘点、统计。

### 6.1 库存预警

#### 前端实现
- 已整合到 `MaterialBatchManagementScreen.tsx` 中

#### API端点
```
GET /api/mobile/{factoryId}/material-batches/low-stock      # 低库存批次
GET /api/mobile/{factoryId}/material-batches/near-expiry    # 临期批次
```

---

### 6.2 库存盘点

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/InventoryCheckScreen.tsx` | 库存盘点页面 |

---

### 6.3 库存统计

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/processing/InventoryStatisticsScreen.tsx` | 库存统计页面 |

#### API端点
```
GET /api/mobile/{factoryId}/material-batches/statistics
```

---

## 7. 质量检验模块

（已在3.7节详细描述）

---

## 8. 基础数据管理模块

### 8.1 用户管理

**功能描述**: 用户CRUD、角色管理、激活/停用、数据导入导出。

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/UserManagementScreen.tsx` | 用户管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/UserController.java` | 用户控制器 | 314行 |

#### API端点
```
# CRUD
GET    /api/mobile/{factoryId}/users                # 用户列表
POST   /api/mobile/{factoryId}/users                # 创建用户
GET    /api/mobile/{factoryId}/users/{userId}       # 用户详情
PUT    /api/mobile/{factoryId}/users/{userId}       # 更新用户
DELETE /api/mobile/{factoryId}/users/{userId}       # 删除用户

# 用户操作
GET  /api/mobile/{factoryId}/users/role/{roleCode}         # 按角色获取
POST /api/mobile/{factoryId}/users/{userId}/activate       # 激活用户
POST /api/mobile/{factoryId}/users/{userId}/deactivate     # 停用用户
PUT  /api/mobile/{factoryId}/users/{userId}/role           # 更新角色

# 检查
GET /api/mobile/{factoryId}/users/check/username?username=xxx  # 用户名是否存在
GET /api/mobile/{factoryId}/users/check/email?email=xxx        # 邮箱是否存在

# 搜索
GET /api/mobile/{factoryId}/users/search?q=张三

# 导入导出 ✨
GET  /api/mobile/{factoryId}/users/export                      # 导出用户列表 (Excel)
POST /api/mobile/{factoryId}/users/import                      # 批量导入用户
GET  /api/mobile/{factoryId}/users/export/template             # 下载导入模板
```

---

### 8.2 部门管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/DepartmentManagementScreen.tsx` | 部门管理页面 |

#### 后端实现
| 文件路径 | 说明 |
|---------|------|
| `backend-java/src/main/java/com/cretas/aims/controller/DepartmentController.java` | 部门控制器 |

#### API端点
```
GET    /api/mobile/{factoryId}/departments
POST   /api/mobile/{factoryId}/departments
PUT    /api/mobile/{factoryId}/departments/{id}
DELETE /api/mobile/{factoryId}/departments/{id}
```

---

### 8.3 产品类型管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/ProductTypeManagementScreen.tsx` | 产品类型管理页面 |

#### 后端实现
| 文件路径 | 说明 |
|---------|------|
| `backend-java/src/main/java/com/cretas/aims/controller/ProductTypeController.java` | 产品类型控制器 |

#### API端点
```
GET    /api/mobile/{factoryId}/product-types
POST   /api/mobile/{factoryId}/product-types
PUT    /api/mobile/{factoryId}/product-types/{id}
DELETE /api/mobile/{factoryId}/product-types/{id}
```

---

### 8.4 原材料类型管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/MaterialTypeManagementScreen.tsx` | 材料类型管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/MaterialTypeController.java` | 材料类型控制器 | 556行 |

#### API端点
```
GET    /api/mobile/{factoryId}/material-types
POST   /api/mobile/{factoryId}/material-types
PUT    /api/mobile/{factoryId}/material-types/{id}
DELETE /api/mobile/{factoryId}/material-types/{id}
GET    /api/mobile/{factoryId}/material-types/export
POST   /api/mobile/{factoryId}/material-types/import
```

---

### 8.5 供应商管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/SupplierManagementScreen.tsx` | 供应商管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/SupplierController.java` | 供应商控制器 | 398行 |

#### API端点
```
GET    /api/mobile/{factoryId}/suppliers
POST   /api/mobile/{factoryId}/suppliers
PUT    /api/mobile/{factoryId}/suppliers/{id}
DELETE /api/mobile/{factoryId}/suppliers/{id}
GET    /api/mobile/{factoryId}/suppliers/{id}/rating         # 供应商评级
POST   /api/mobile/{factoryId}/suppliers/{id}/rate           # 评价供应商
```

---

### 8.6 客户管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFfoodTrace/src/screens/management/CustomerManagementScreen.tsx` | 客户管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/CustomerController.java` | 客户控制器 | 506行 |

#### API端点
```
GET    /api/mobile/{factoryId}/customers
POST   /api/mobile/{factoryId}/customers
PUT    /api/mobile/{factoryId}/customers/{id}
DELETE /api/mobile/{factoryId}/customers/{id}
GET    /api/mobile/{factoryId}/customers/{id}/orders        # 客户订单
```

---

### 8.7 白名单管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/WhitelistManagementScreen.tsx` | 白名单管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/WhitelistController.java` | 白名单控制器 | 281行 |

#### API端点
```
GET    /api/mobile/{factoryId}/whitelist                 # 白名单列表
POST   /api/mobile/{factoryId}/whitelist                 # 添加白名单
DELETE /api/mobile/{factoryId}/whitelist/{phone}         # 移除白名单
GET    /api/mobile/{factoryId}/whitelist/check/{phone}   # 检查手机号
```

---

### 8.8 工种管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/WorkTypeManagementScreen.tsx` | 工种管理页面 |

#### 后端实现
| 文件路径 | 说明 |
|---------|------|
| `backend-java/src/main/java/com/cretas/aims/controller/WorkTypeController.java` | 工种控制器 |

---

### 8.9 转换率配置

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/ConversionRateScreen.tsx` | 转换率配置页面 |

#### 后端实现
| 文件路径 | 说明 |
|---------|------|
| `backend-java/src/main/java/com/cretas/aims/controller/ConversionController.java` | 转换率控制器 |

---

### 8.10 材料规格配置

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/MaterialSpecManagementScreen.tsx` | 材料规格管理页面 |

#### 后端实现
| 文件路径 | 说明 |
|---------|------|
| `backend-java/src/main/java/com/cretas/aims/controller/MaterialSpecConfigController.java` | 材料规格控制器 |

---

### 8.11 工厂设置

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/FactorySettingsScreen.tsx` | 工厂设置页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/FactorySettingsController.java` | 工厂设置控制器 | 263行 |

#### API端点
```
GET /api/mobile/{factoryId}/settings           # 获取工厂设置
PUT /api/mobile/{factoryId}/settings           # 更新工厂设置
PUT /api/mobile/{factoryId}/settings/gps       # 更新GPS位置
PUT /api/mobile/{factoryId}/settings/work-time # 更新工作时间
```

---

### 8.12 AI设置

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/AISettingsScreen.tsx` | AI设置页面 |

---

## 9. 平台管理模块

**说明**: 仅平台管理员（`platform_admin`, `super_admin`）可访问。

### 9.1 平台仪表盘

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/platform/PlatformDashboardScreen.tsx` | 平台仪表盘页面 |

#### API端点
```
GET /api/platform/dashboard/statistics
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "totalFactories": 15,
    "activeFactories": 14,
    "totalUsers": 1800,
    "totalBatchesThisMonth": 2500,
    "totalOutputThisMonth": 2250000,
    "aiQuotaUtilization": 64.0
  }
}
```

---

### 9.2 工厂管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/platform/FactoryManagementScreen.tsx` | 工厂管理页面 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/PlatformController.java` | 平台控制器 | 217行 |

#### API端点
```
GET    /api/platform/factories                     # 工厂列表
GET    /api/platform/factories/{factoryId}         # 工厂详情
POST   /api/platform/factories                     # 创建工厂
PUT    /api/platform/factories/{factoryId}         # 更新工厂
DELETE /api/platform/factories/{factoryId}         # 删除工厂（软删除）
POST   /api/platform/factories/{factoryId}/activate    # 激活工厂
POST   /api/platform/factories/{factoryId}/deactivate  # 停用工厂
```

---

### 9.3 AI配额管理

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/platform/AIQuotaManagementScreen.tsx` | AI配额管理页面 |

#### API端点
```
GET /api/platform/ai-quota                        # 所有工厂AI配额
PUT /api/platform/ai-quota/{factoryId}            # 更新工厂AI配额
GET /api/platform/ai-usage-stats?period=weekly    # AI使用统计
```

**配额更新请求**:
```json
{
  "weeklyQuota": 30
}
```

---

## 10. 报表分析模块 ✨新增

**功能描述**: 13类报表，包括生产、质量、成本、人员等多维度分析。

### 10.1 报表列表

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/reports/ReportDashboardScreen.tsx` | 报表仪表盘 |
| `frontend/CretasFoodTrace/src/screens/reports/ProductionReportScreen.tsx` | 生产报表 |
| `frontend/CretasFoodTrace/src/screens/reports/QualityReportScreen.tsx` | 质量报表 |
| `frontend/CretasFoodTrace/src/screens/reports/CostReportScreen.tsx` | 成本报表 |
| `frontend/CretasFoodTrace/src/screens/reports/PersonnelReportScreen.tsx` | 人员报表 |
| `frontend/CretasFoodTrace/src/screens/reports/EfficiencyReportScreen.tsx` | 效率报表 |
| `frontend/CretasFoodTrace/src/screens/reports/AnomalyReportScreen.tsx` | 异常报表 |
| `frontend/CretasFoodTrace/src/screens/reports/TrendReportScreen.tsx` | 趋势报表 |
| `frontend/CretasFoodTrace/src/screens/reports/KPIReportScreen.tsx` | KPI报表 |
| `frontend/CretasFoodTrace/src/screens/reports/ForecastReportScreen.tsx` | 预测报表 |
| `frontend/CretasFoodTrace/src/screens/reports/RealtimeReportScreen.tsx` | 实时报表 |
| `frontend/CretasFoodTrace/src/screens/reports/DataExportScreen.tsx` | 数据导出 |

#### 后端实现
| 文件路径 | 说明 | 代码行数 |
|---------|------|---------|
| `backend-java/src/main/java/com/cretas/aims/controller/ReportController.java` | 报告控制器 | 347行 |

#### API端点
```
GET /api/mobile/{factoryId}/reports/production      # 生产报表
GET /api/mobile/{factoryId}/reports/quality         # 质量报表
GET /api/mobile/{factoryId}/reports/cost            # 成本报表
GET /api/mobile/{factoryId}/reports/personnel       # 人员报表
GET /api/mobile/{factoryId}/reports/efficiency      # 效率报表
POST /api/mobile/{factoryId}/reports/generate       # 生成报告
GET  /api/mobile/{factoryId}/reports/{reportId}/download  # 下载报告
```

---

## 11. 数据导入导出 ✨新增

**功能描述**: Excel格式的批量导入导出，支持用户、设备、原材料批次等。

### 11.1 支持的实体

| 实体 | 导出API | 导入API | 模板下载 |
|------|---------|---------|----------|
| **用户** | `GET /users/export` | `POST /users/import` | `GET /users/export/template` |
| **设备** | `GET /equipment/export` | `POST /equipment/import` | `GET /equipment/export/template` |
| **原材料批次** | `GET /material-batches/export` | `POST /material-batches/import` | `GET /material-batches/export/template` |
| **材料类型** | `GET /material-types/export` | `POST /material-types/import` | `GET /material-types/export/template` |

### 11.2 导入流程

1. **下载模板** → **填写数据** → **上传文件** → **验证数据** → **导入结果反馈**

**导入结果响应**:
```json
{
  "code": 200,
  "data": {
    "successCount": 10,
    "failureCount": 2,
    "errors": [
      {
        "row": 3,
        "error": "用户名已存在: operator01"
      },
      {
        "row": 5,
        "error": "手机号格式错误"
      }
    ]
  }
}
```

### 11.3 后端实现

**技术栈**: Apache POI

**导出逻辑**:
```java
// 创建Excel工作簿
Workbook workbook = new XSSFWorkbook();
Sheet sheet = workbook.createSheet("用户列表");

// 表头
Row headerRow = sheet.createRow(0);
headerRow.createCell(0).setCellValue("用户名");
headerRow.createCell(1).setCellValue("姓名");
headerRow.createCell(2).setCellValue("部门");
// ...

// 数据行
List<User> users = userRepository.findAll();
for (int i = 0; i < users.size(); i++) {
  Row row = sheet.createRow(i + 1);
  row.createCell(0).setCellValue(users.get(i).getUsername());
  // ...
}

// 返回文件流
ByteArrayOutputStream out = new ByteArrayOutputStream();
workbook.write(out);
return out.toByteArray();
```

### 11.4 前端实现

| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/management/EntityDataExportScreen.tsx` | 实体数据导出页面 |

---

## 12. 移动端特性

### 12.1 离线支持

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/services/networkManager.ts` | 网络状态管理 |
| `frontend/CretasFoodTrace/src/store/offlineStore.ts` | 离线数据存储 |

#### API端点
```
GET  /api/mobile/offline/{factoryId}?dataTypes=batches,materials,users  # 离线数据包
POST /api/mobile/sync/{factoryId}                                        # 数据同步
```

---

### 12.2 推送通知

#### API端点
```
POST   /api/mobile/push/register      # 注册推送通知
DELETE /api/mobile/push/unregister    # 取消推送注册
```

---

### 12.3 设备管理

#### API端点
```
GET    /api/mobile/devices              # 获取用户设备列表
DELETE /api/mobile/devices/{deviceId}   # 移除设备
```

---

### 12.4 版本管理

#### API端点
```
GET /api/mobile/version/check?currentVersion=1.1.0&platform=ios
```

---

### 12.5 监控接口

#### API端点
```
POST /api/mobile/report/crash          # 上报崩溃日志
POST /api/mobile/report/performance    # 上报性能数据
```

---

### 12.6 用户反馈

#### 前端实现
| 文件路径 | 说明 |
|---------|------|
| `frontend/CretasFoodTrace/src/screens/profile/FeedbackScreen.tsx` | 用户反馈页面 |

#### API端点
```
POST /api/mobile/{factoryId}/feedback
```

---

## 更新日志

### v2.0 (2025-11-20)

#### ✨ 新增功能

1. **AI智能分析模块**（全新章节）
   - AI批次成本分析
   - AI时间范围分析
   - AI批次对比分析
   - AI配额管理
   - AI对话历史
   - AI报告管理

2. **设备告警管理**（完善）
   - 告警生命周期（ACTIVE → ACKNOWLEDGED → RESOLVED）
   - 告警统计和趋势分析
   - 告警操作（确认、解决、忽略）

3. **数据导入导出**（全新功能）
   - Excel批量导入（用户、设备、原材料批次等）
   - 导入模板下载
   - 导入结果反馈（成功/失败详情）

4. **报表分析模块**（全新章节）
   - 13类报表（生产、质量、成本、人员等）
   - 报表生成和下载

5. **人员绩效分析**（新增API）
   - 工时排行榜
   - 加班统计
   - 人员绩效统计

6. **移动端特性**（完善）
   - 离线数据包
   - 推送通知管理
   - 设备管理
   - 版本检查
   - 崩溃上报
   - 用户反馈

#### 🔄 更新内容

1. **认证流程**
   - 更新API路径：`/api/auth/login` → `/api/mobile/auth/unified-login`
   - 补充Token刷新流程
   - 补充忘记密码流程

2. **前端页面清单**
   - 完整的75个页面列表
   - 按模块分类（认证、考勤、生产、平台等）

3. **后端API清单**
   - 25个Controller
   - 577个API端点
   - 详细的请求/响应示例

4. **数据实体更新**
   - User实体新增字段：`monthlySalary`, `expectedWorkMinutes`
   - Factory实体新增字段：`aiWeeklyQuota`
   - ProcessingBatch实体：详细的成本字段分解

#### ❌ 修正错误

1. **API路径错误**
   - 旧：`/api/auth/*` → 新：`/api/mobile/auth/*`
   - 旧：散落的AI接口 → 新：统一到 `/api/mobile/{factoryId}/ai/*`

2. **缺失的功能映射**
   - 补充了AI分析模块的完整映射
   - 补充了设备告警管理的完整流程
   - 补充了数据导入导出的实现细节

#### 📊 统计数据

| 指标 | v1.0 | v2.0 | 变化 |
|------|------|------|------|
| **前端页面** | ~40个 | 75个 | +35个 |
| **后端Controller** | ~15个 | 25个 | +10个 |
| **API端点** | ~300个 | 577个 | +277个 |
| **功能模块** | 9个 | 12个 | +3个 |
| **数据实体** | ~35个 | 43个 | +8个 |

#### 🎯 v2.0 vs v1.0 主要差异

| 维度 | v1.0 | v2.0 |
|------|------|------|
| **格式** | HTML | Markdown (便于版本控制) |
| **AI功能** | 未详细描述 | 完整的AI分析模块 |
| **设备告警** | 未提及 | 完整的告警生命周期 |
| **导入导出** | 未提及 | 详细的批量操作流程 |
| **报表模块** | 未详细描述 | 13类报表完整列表 |
| **移动端特性** | 部分描述 | 完整的离线/推送/监控 |
| **API文档** | 简略 | 详细的请求/响应示例 |
| **代码行数统计** | 无 | 完整的文件大小统计 |

---

## 附录

### A. 文件路径约定

- 前端路径基于 `frontend/CretasFoodTrace/`
- 后端路径基于 `backend-java/`
- 所有路径为项目相对路径

### B. API格式说明

- HTTP方法：GET, POST, PUT, DELETE
- 路径参数：`{factoryId}`, `{userId}` 等
- 查询参数：`?page=0&size=20`
- 响应格式：统一的JSON格式

### C. 数据库表命名

- 采用下划线命名：`processing_batch`, `time_clock_record`
- 主键统一为 `id`
- 外键：`factory_id`, `user_id` 等

### D. 权限标识

- `platform_admin` - 平台管理员
- `factory_super_admin` - 工厂超级管理员
- `factory_admin` - 工厂管理员
- `department_admin` - 部门主管
- `supervisor` - 生产主管
- `operator` - 操作员
- `viewer` - 查看者

---

**文档维护**:
- **版本**: v2.0
- **生成日期**: 2025-11-20
- **维护人**: 架构团队
- **格式**: Markdown

**相关文档**:
- [业务逻辑总览](../BUSINESS_LOGIC_OVERVIEW.md)
- [API完整参考](../API_COMPLETE_REFERENCE.md)
- [PRD系统产品需求文档 v4.0](./PRD-系统产品需求文档-v4.0.md)
