# API接口规范文档

<!-- 基于TASK-P3-019A完成成果更新 -->
<!-- 更新日期: 2025-06-05 -->
<!-- API覆盖率: 100% (69个接口) -->

## 📋 **文档概述**

本文档基于TASK-P3-019A完成的Mock API系统，详细定义了食品溯源系统的69个API接口规范，为真实后端API开发提供权威参考。

### **版本信息**
- **文档版本**: v2.0.0
- **API版本**: v1
- **接口总数**: 69个 (100%覆盖)
- **基础URL**: `{BASE_URL}/api`
- **技术栈**: RESTful API + JSON
- **认证方式**: JWT Bearer Token

### **业务模块覆盖**
- ✅ **农业模块** (9个接口): 田地、作物、种植计划、农事活动、收获记录
- ✅ **加工模块** (9个接口): 原料、生产批次、质检、成品管理
- ✅ **物流模块** (9个接口): 仓库、运输订单、车辆、司机管理
- ✅ **管理模块** (8个接口): 系统配置、权限、审计、监控
- ✅ **基础模块** (34个接口): 认证、用户、产品、溯源、AI分析

## 🔐 **认证系统接口**

### **用户登录**
```http
POST /api/auth/login
Content-Type: application/json

// 请求体
{
  "username": "admin",
  "password": "admin123"
}

// 响应 200
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-string",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@farm.com",
      "role": "admin",
      "permissions": ["read", "write", "delete", "admin"]
    },
    "expiresIn": 86400
  }
}
```

### **用户登出**
```http
POST /api/auth/logout
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "message": "Successfully logged out"
}
```

### **认证状态查询**
```http
GET /api/auth/status
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": {
    "isAuthenticated": true,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

## 🌾 **农业模块接口**

### **农业概览统计**
```http
GET /api/farming/overview
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": {
    "statistics": {
      "totalFields": 15,
      "totalCrops": 8,
      "activePlans": 12,
      "harvestsThisMonth": 5
    },
    "recentActivities": [...],
    "weatherForecast": {...}
  }
}
```

### **田地管理**
```http
GET /api/farming/fields?page=1&limit=10&search=玉米
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "1号田",
      "area": 50.5,
      "unit": "亩",
      "location": {
        "province": "黑龙江省",
        "city": "哈尔滨市",
        "coordinates": { "lat": 45.7, "lng": 126.6 }
      },
      "soilType": "黑土",
      "status": "active",
      "currentCrop": {
        "id": 1,
        "name": "先玉335玉米",
        "plantedAt": "2025-04-15",
        "expectedHarvest": "2025-09-20"
      },
      "owner": "黑牛农场",
      "manager": "张农夫"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

### **田地详情**
```http
GET /api/farming/fields/{id}
Authorization: Bearer {token}

// 响应格式同田地列表中的单项数据
```

### **作物管理**
```http
GET /api/farming/crops?page=1&limit=10
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "先玉335玉米",
      "variety": "杂交玉米",
      "category": "谷物",
      "description": "东北地区优良玉米品种",
      "characteristics": {
        "growthPeriod": "130-135天",
        "optimalTemperature": "18-25°C"
      },
      "marketInfo": {
        "currentPrice": 2.85,
        "unit": "元/斤",
        "trend": "稳中有升"
      }
    }
  ]
}
```

### **种植计划**
```http
GET /api/farming/plans
POST /api/farming/plans
Authorization: Bearer {token}

// POST请求体
{
  "fieldId": 1,
  "cropId": 1,
  "plannedDate": "2025-04-15",
  "expectedHarvest": "2025-09-20",
  "area": 30,
  "notes": "计划种植优质玉米"
}
```

### **农事活动和收获记录**
```http
GET /api/farming/activities
GET /api/farming/harvests
Authorization: Bearer {token}
```

## 🏭 **加工模块接口**

### **加工概览统计**
```http
GET /api/processing/overview
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": {
    "statistics": {
      "activeBatches": 8,
      "completedToday": 3,
      "totalOutput": 15680,
      "qualityPassRate": 98.5
    },
    "recentBatches": [...],
    "equipmentStatus": {...}
  }
}
```

### **原料管理**
```http
GET /api/processing/raw-materials?page=1&limit=10
GET /api/processing/raw-materials/{id}
Authorization: Bearer {token}

// 响应示例
{
  "success": true,
  "data": {
    "id": 1,
    "name": "有机大豆",
    "category": "谷物原料",
    "currentStock": 5000,
    "unit": "kg",
    "supplier": {
      "name": "黑牛农场",
      "contact": "张农夫"
    },
    "qualityStandards": {
      "protein": "≥40%",
      "moisture": "≤13%"
    }
  }
}
```

### **生产批次管理**
```http
GET /api/processing/batches
POST /api/processing/batches
Authorization: Bearer {token}

// POST请求体
{
  "productType": "大豆油",
  "rawMaterialIds": [1, 2],
  "plannedQuantity": 1000,
  "operator": "李师傅"
}
```

### **质量检测**
```http
GET /api/processing/quality-tests
GET /api/processing/quality-tests/{id}
Authorization: Bearer {token}
```

### **成品管理**
```http
GET /api/processing/finished-products
GET /api/processing/finished-products/{id}
Authorization: Bearer {token}
```

## 🚛 **物流模块接口**

### **物流概览统计**
```http
GET /api/logistics/overview
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": {
    "statistics": {
      "activeOrders": 15,
      "completedToday": 8,
      "onTimeRate": 96.5,
      "totalVehicles": 25
    },
    "recentOrders": [...],
    "warehouseOccupancy": {...}
  }
}
```

### **仓库管理**
```http
GET /api/logistics/warehouses
GET /api/logistics/warehouses/{id}
Authorization: Bearer {token}

// 响应示例
{
  "success": true,
  "data": {
    "id": 1,
    "name": "1号中央仓库",
    "type": "cold_storage",
    "location": {
      "province": "北京市",
      "address": "朝阳区物流园区1号"
    },
    "capacity": {
      "total": 5000,
      "used": 3200,
      "unit": "m³"
    },
    "temperatureControl": {
      "zones": [
        { "name": "冷冻区", "temperature": -18 },
        { "name": "冷藏区", "temperature": 4 }
      ]
    }
  }
}
```

### **运输订单**
```http
GET /api/logistics/orders?status=in_transit
GET /api/logistics/orders/{id}
Authorization: Bearer {token}

// 响应示例
{
  "success": true,
  "data": {
    "id": "LO-2025060501",
    "status": "in_transit",
    "origin": { "warehouse": "1号中央仓库" },
    "destination": { "customer": "上海农贸市场" },
    "vehicle": { "plateNumber": "京A12345" },
    "driver": { "name": "王师傅" },
    "tracking": {
      "currentLocation": { "city": "天津市" },
      "progress": 45
    }
  }
}
```

### **车辆和司机管理**
```http
GET /api/logistics/vehicles
GET /api/logistics/vehicles/{id}
GET /api/logistics/drivers
GET /api/logistics/drivers/{id}
Authorization: Bearer {token}
```

## 👥 **管理模块接口**

### **管理概览统计**
```http
GET /api/admin/overview
Authorization: Bearer {token}

// 响应 200
{
  "success": true,
  "data": {
    "systemStats": {
      "totalUsers": 45,
      "activeUsers": 38,
      "onlineUsers": 12
    },
    "performanceMetrics": {
      "cpuUsage": 35.2,
      "memoryUsage": 68.5
    },
    "recentActivities": [...],
    "alerts": [...]
  }
}
```

### **系统配置**
```http
GET /api/admin/configs
GET /api/admin/configs/{id}
Authorization: Bearer {token}
```

### **权限管理**
```http
GET /api/admin/roles
GET /api/admin/permissions
Authorization: Bearer {token}
```

### **审计日志**
```http
GET /api/admin/audit-logs?page=1&user=admin
Authorization: Bearer {token}
```

### **系统监控**
```http
GET /api/admin/monitoring
Authorization: Bearer {token}
```

### **报表统计**
```http
GET /api/admin/reports/stats?period=30d
Authorization: Bearer {token}
```

## 🛡️ **通用接口规范**

### **请求格式**
- **Content-Type**: `application/json`
- **Authorization**: `Bearer {JWT_TOKEN}`
- **Accept**: `application/json`

### **响应格式**
```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  message: string;
}
```

### **分页参数**
```typescript
interface PaginationQuery {
  page?: number;    // 页码，默认1
  limit?: number;   // 每页数量，默认10
  search?: string;  // 搜索关键词
  sort?: string;    // 排序字段
  order?: 'asc' | 'desc'; // 排序方向
}

interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### **HTTP状态码**
- `200` - 请求成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权访问
- `403` - 权限不足
- `404` - 资源不存在
- `500` - 服务器内部错误

### **错误码定义**
```typescript
enum ErrorCodes {
  // 认证相关
  INVALID_CREDENTIALS = 'AUTH001',
  TOKEN_EXPIRED = 'AUTH002',
  INSUFFICIENT_PERMISSIONS = 'AUTH003',
  
  // 业务相关
  FIELD_NOT_FOUND = 'FARM001',
  CROP_NOT_AVAILABLE = 'FARM002',
  BATCH_PROCESSING_ERROR = 'PROC001',
  VEHICLE_UNAVAILABLE = 'LOG001',
  
  // 系统相关
  DATABASE_ERROR = 'SYS001',
  EXTERNAL_SERVICE_ERROR = 'SYS002'
}
```

## 📊 **接口清单总览**

### **农业模块 (9个接口)**
1. `GET /api/farming/overview` - 农业概览统计
2. `GET /api/farming/fields` - 田地列表
3. `GET /api/farming/fields/{id}` - 田地详情
4. `GET /api/farming/crops` - 作物列表
5. `GET /api/farming/crops/{id}` - 作物详情
6. `GET /api/farming/plans` - 种植计划列表
7. `POST /api/farming/plans` - 创建种植计划
8. `GET /api/farming/activities` - 农事活动列表
9. `GET /api/farming/harvests` - 收获记录列表

### **加工模块 (9个接口)**
1. `GET /api/processing/overview` - 加工概览统计
2. `GET /api/processing/raw-materials` - 原料列表
3. `GET /api/processing/raw-materials/{id}` - 原料详情
4. `GET /api/processing/batches` - 生产批次列表
5. `POST /api/processing/batches` - 创建生产批次
6. `GET /api/processing/quality-tests` - 质检记录列表
7. `GET /api/processing/quality-tests/{id}` - 质检详情
8. `GET /api/processing/finished-products` - 成品列表
9. `GET /api/processing/finished-products/{id}` - 成品详情

### **物流模块 (9个接口)**
1. `GET /api/logistics/overview` - 物流概览统计
2. `GET /api/logistics/warehouses` - 仓库列表
3. `GET /api/logistics/warehouses/{id}` - 仓库详情
4. `GET /api/logistics/orders` - 运输订单列表
5. `GET /api/logistics/orders/{id}` - 运输订单详情
6. `GET /api/logistics/vehicles` - 车辆列表
7. `GET /api/logistics/vehicles/{id}` - 车辆详情
8. `GET /api/logistics/drivers` - 司机列表
9. `GET /api/logistics/drivers/{id}` - 司机详情

### **管理模块 (8个接口)**
1. `GET /api/admin/overview` - 管理概览统计
2. `GET /api/admin/configs` - 系统配置列表
3. `GET /api/admin/configs/{id}` - 系统配置详情
4. `GET /api/admin/roles` - 角色列表
5. `GET /api/admin/permissions` - 权限列表
6. `GET /api/admin/audit-logs` - 审计日志
7. `GET /api/admin/monitoring` - 系统监控
8. `GET /api/admin/reports/stats` - 报表统计

### **基础模块 (34个接口)**
- **认证模块** (6个): 登录、登出、状态查询、权限验证等
- **用户模块** (12个): 用户管理、资料、偏好设置等
- **产品模块** (4个): 产品列表、详情、分类、搜索
- **溯源模块** (5个): 产品溯源、批次查询、溯源链
- **AI分析模块** (7个): 生产洞察、优化建议、预测分析

## 🔧 **开发指南**

### **Mock到真实API迁移**
1. **接口路径保持一致** - 所有路径规范已在Mock中验证
2. **数据格式对齐** - 响应结构与Mock API完全一致
3. **错误处理统一** - 使用相同的错误码和消息格式
4. **认证机制兼容** - JWT Token认证方式保持不变

### **测试验证**
- **功能测试**: 基于Mock API的测试用例可直接复用
- **性能测试**: 响应时间目标 < 500ms
- **安全测试**: JWT令牌验证、权限控制、SQL注入防护
- **兼容性测试**: 确保前端代码无需修改

---

**文档版本**: v2.0.0  
**最后更新**: 2025-06-05  
**基于**: TASK-P3-019A完成成果 (69个API接口)  
**下次更新**: 根据真实API开发进度同步更新  
**维护**: 开发团队负责保持文档与实现同步