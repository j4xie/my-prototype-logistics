# Mock API使用指南

<!-- 基于TASK-P3-019A完成成果更新 -->
<!-- 更新日期: 2025-06-05 -->
<!-- 架构基础: MSW 2.0 + 中央Mock服务 + Hook层统一访问 -->

## 📋 **系统概述**

Mock API系统为食品溯源系统提供完整的前端开发和测试环境，基于MSW (Mock Service Worker) v2.0架构，实现69个API接口的100%覆盖。

**核心特性**:
- ✅ **69个API接口**完整实现，覆盖农业、加工、物流、管理4大业务模块
- ✅ **MSW架构**：浏览器端Worker + Node端Server双端支持
- ✅ **Hook层统一访问**：通过useApi Hook实现Mock/Real API透明切换
- ✅ **TypeScript类型安全**：100%类型覆盖，编译时错误检查
- ✅ **中文本地化数据**：真实中国农业场景业务数据
- ✅ **认证权限机制**：完整RBAC权限控制和JWT认证

**系统状态**: ✅ **100%可用** - 立即可用于前端开发和页面迁移

## 🚀 **快速开始**

### **启动Mock API服务**

```bash
cd web-app-next
npm run dev
```

**服务地址**: `http://localhost:3000`  
**Mock控制台**: 开发环境自动启用MSW浏览器Worker  
**状态监控**: 通过useMockStatus Hook实时监控Mock状态

### **基础使用模式**

#### **1. Hook层统一访问（推荐）**
```typescript
import { useApi } from '@/hooks/api/useApi';

function MyComponent() {
  // 自动路由到Mock或Real API
  const { data, loading, error } = useApi('/farming/overview');
  
  // 带参数查询
  const { data: fields } = useApi('/farming/fields', {
    params: { page: 1, limit: 10, search: '玉米' }
  });
  
  // POST请求
  const { mutate: createPlan } = useApi('/farming/plans', {
    method: 'POST'
  });
  
  return <div>{/* 组件内容 */}</div>;
}
```

#### **2. 直接API调用**
```typescript
import { apiClient } from '@/lib/api';

// 农业模块API调用
const farmingOverview = await apiClient.get('/api/farming/overview');
const fieldDetails = await apiClient.get('/api/farming/fields/123');

// 加工模块API调用
const rawMaterials = await apiClient.get('/api/processing/raw-materials');
const qualityTest = await apiClient.get('/api/processing/quality-tests/456');
```

#### **3. Mock状态监控**
```typescript
import { useMockStatus } from '@/hooks/useMockStatus';

function DevPanel() {
  const { isActive, apiCount, errors } = useMockStatus();
  
  return (
    <div>
      <p>Mock状态: {isActive ? '✅ 活跃' : '❌ 未活跃'}</p>
      <p>API接口: {apiCount}个已注册</p>
      <p>错误计数: {errors.length}</p>
    </div>
  );
}
```

## 🌾 **农业模块 API**

### **概览统计**
- **接口**: `GET /api/farming/overview`
- **功能**: 农业生产概览数据，包含田地、作物、计划统计

```typescript
// 响应示例
{
  "success": true,
  "data": {
    "statistics": {
      "totalFields": 15,      // 田地总数
      "totalCrops": 8,        // 作物品种数
      "activePlans": 12,      // 活跃种植计划
      "harvestsThisMonth": 5  // 本月收获次数
    },
    "recentActivities": [
      {
        "id": 1,
        "type": "种植",
        "crop": "先玉335玉米",
        "field": "1号田",
        "date": "2025-06-01",
        "operator": "张农夫"
      }
    ],
    "weatherForecast": {
      "temperature": { "min": 18, "max": 28 },
      "humidity": 65,
      "rainfall": 0,
      "forecast": "晴转多云"
    }
  }
}
```

### **田地管理**
- **接口**: `GET /api/farming/fields` - 田地列表（支持分页+搜索）
- **接口**: `GET /api/farming/fields/:id` - 田地详情

```typescript
// 查询参数
{
  page?: number;     // 页码，默认1
  limit?: number;    // 每页数量，默认10
  search?: string;   // 搜索关键词
  status?: 'active' | 'inactive' | 'maintenance'; // 田地状态
}

// 响应示例
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
        "district": "双城区",
        "address": "幸福乡农业园区1号田",
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

### **作物管理**
- **接口**: `GET /api/farming/crops` - 作物列表
- **接口**: `GET /api/farming/crops/:id` - 作物详情

```typescript
// 作物详情响应示例
{
  "success": true,
  "data": {
    "id": 1,
    "name": "先玉335玉米",
    "variety": "杂交玉米",
    "category": "谷物",
    "description": "东北地区优良玉米品种，适应性强，产量高",
    "characteristics": {
      "growthPeriod": "130-135天",
      "optimalTemperature": "18-25°C",
      "waterRequirement": "中等",
      "soilRequirement": "肥沃黑土"
    },
    "nutritionValue": {
      "protein": "8.5%",
      "starch": "72%",
      "fat": "4.2%",
      "fiber": "2.8%"
    },
    "marketInfo": {
      "currentPrice": 2.85,
      "unit": "元/斤",
      "trend": "稳中有升",
      "marketDemand": "高"
    }
  }
}
```

### **种植计划和农事活动**
- **接口**: `GET /api/farming/plans` - 种植计划列表
- **接口**: `POST /api/farming/plans` - 创建种植计划
- **接口**: `GET /api/farming/activities` - 农事活动列表
- **接口**: `GET /api/farming/harvests` - 收获记录列表

## 🏭 **加工模块 API (9个接口)**

- `GET /api/processing/overview` - 加工概览统计
- `GET /api/processing/raw-materials` - 原料管理列表
- `GET /api/processing/batches` - 生产批次列表
- `GET /api/processing/quality-tests` - 质检记录列表
- `GET /api/processing/finished-products` - 成品管理列表

## 🚛 **物流模块 API (9个接口)**

- `GET /api/logistics/overview` - 物流概览统计
- `GET /api/logistics/warehouses` - 仓库管理列表
- `GET /api/logistics/orders` - 运输订单列表
- `GET /api/logistics/vehicles` - 车辆管理列表
- `GET /api/logistics/drivers` - 司机管理列表

## 👥 **管理模块 API (8个接口)**

- `GET /api/admin/overview` - 管理控制台概览
- `GET /api/admin/configs` - 系统配置管理
- `GET /api/admin/roles` - 角色管理
- `GET /api/admin/permissions` - 权限管理
- `GET /api/admin/audit-logs` - 审计日志
- `GET /api/admin/monitoring` - 系统监控
- `GET /api/admin/reports/stats` - 报表统计

## 🔐 **认证和权限**

### **测试账户**

| 用户名 | 密码 | 角色 | 权限范围 |
|--------|------|------|----------|
| admin | admin123 | 系统管理员 | 全部权限 |
| manager | manager123 | 业务经理 | 业务模块读写 |
| farmer | farmer123 | 农户 | 农业模块 |
| processor | processor123 | 加工员 | 加工模块 |
| driver | driver123 | 司机 | 物流模块查看 |

### **认证使用示例**

```typescript
// 登录获取token
const response = await apiClient.post('/api/auth/login', {
  username: 'admin',
  password: 'admin123'
});

// Hook层自动处理认证（推荐）
const { data, loading } = useApi('/farming/fields');

// 手动添加认证头
const response2 = await apiClient.get('/api/admin/configs', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🛠️ **环境配置**

```bash
# .env.local
NEXT_PUBLIC_API_ENV=mock
NEXT_PUBLIC_MOCK_DELAY=300
NEXT_PUBLIC_API_BASE_URL=/api
NODE_ENV=development
```

## 🚀 **最佳实践**

### **1. 使用Hook层访问API**
```typescript
// ✅ 推荐
const { data, loading, error } = useApi('/farming/overview');

// ❌ 不推荐
const data = await fetch('/api/farming/overview');
```

### **2. 统一错误处理**
```typescript
const { data, loading, error } = useApi('/farming/fields');

if (error) {
  console.error('API错误:', error.message);
  // 显示用户友好的错误提示
}
```

### **3. 分页和搜索**
```typescript
const { data } = useApi('/farming/fields', {
  params: {
    page: 1,
    limit: 10,
    search: '玉米田',
    status: 'active'
  }
});
```

## 📊 **技术指标**

- **总接口数**: 69个API (100%覆盖率)
- **代码量**: 3953行 (124KB)
- **响应时间**: 100-600ms (模拟真实网络)
- **数据质量**: 100%中文本地化
- **类型安全**: 100%TypeScript覆盖

## 🔧 **故障排除**

### **常见问题**

**Q: Mock API无响应**
```bash
# 检查开发服务器
npm run dev

# 检查浏览器控制台MSW状态
console.log('[MSW] Mocking enabled')
```

**Q: 认证失败**
```typescript
// 重新登录获取新token
await apiClient.post('/api/auth/login', {
  username: 'admin',
  password: 'admin123'
});
```

---

**文档版本**: 1.0.0  
**最后更新**: 2025-06-05  
**基于**: TASK-P3-019A (Mock API业务模块扩展) 完成成果  
**技术架构**: MSW 2.0 + 中央Mock服务 + Hook层统一访问 