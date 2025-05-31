# Mock API使用指南

<!-- updated for: Phase-3技术栈现代化 - Mock API系统完整说明 -->
<!-- authority: docs/api/api-specification.md - API接口详细规范的权威来源 -->
<!-- last-sync: 2025-01-22 -->

## 📋 概述

Mock API系统为食品溯源系统提供完整的前端开发和测试环境，模拟真实后端API的行为和数据。**当前状态：完全可用 ✅**

**API接口总览**：
- ✅ **认证模块**: 4个接口 - 用户登录、登出、状态查询、令牌验证
- ✅ **用户模块**: 2个接口 - 用户资料获取和更新 
- ✅ **产品模块**: 1个接口 - 产品列表查询
- ✅ **溯源模块**: 4个接口 - 溯源查询、验证、二维码、公开查询
- ✅ **AI分析模块**: 7个接口 - 生产洞察、优化建议、预测分析等 ⭐ **MVP核心**
- 🔄 **其他模块**: 农业、加工、物流等模块Mock实现中

**总计**：18个核心API接口已实现完整Mock

## 🚀 快速开始

### 启动Mock API服务

```bash
cd web-app-next
npm run dev
```

服务启动后可访问：`http://localhost:3000`

### 基础API调用示例

```typescript
import { apiClient } from '@/lib/api';

// 用户登录
const loginResponse = await apiClient.post('/auth/login', {
  username: 'admin',
  password: 'admin123'
});

// 获取用户资料
const profile = await apiClient.get('/users/profile');

// 溯源查询
const trace = await apiClient.get('/trace/BATCH001');

// AI生产洞察分析
const insights = await apiClient.post('/ai/production-insights', {
  batchId: 'batch-001',
  timeRange: '30d',
  analysisType: 'all'
});
```

## 🔍 API接口清单

### 认证模块 (`/api/auth/`)

#### POST `/api/auth/login` - 用户登录
**功能**: 用户身份验证和令牌获取

**请求参数**:
```typescript
{
  username: string; // 用户名
  password: string; // 密码
}
```

**测试账户**:
```typescript
// 管理员账户
{ username: 'admin', password: 'admin123', role: 'admin' }

// 管理员账户
{ username: 'manager', password: 'manager123', role: 'manager' }

// 普通用户
{ username: 'user', password: 'user123', role: 'user' }

// 测试用户
{ username: 'test', password: 'test123', role: 'user' }
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "mock-jwt-token-abc123",
    "user": {
      "id": "user-1",
      "username": "admin",
      "role": "admin",
      "permissions": ["read", "write", "admin"]
    },
    "expiresIn": 86400
  }
}
```

#### POST `/api/auth/logout` - 用户登出
**功能**: 清除用户会话

**Headers**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

#### GET `/api/auth/status` - 用户状态查询
**功能**: 获取当前用户的认证状态

**Headers**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "user-1",
      "username": "admin",
      "role": "admin"
    },
    "tokenValid": true,
    "expiresAt": "2025-01-23T00:00:00Z"
  }
}
```

#### POST `/api/auth/verify` - 令牌验证
**功能**: 验证JWT令牌的有效性

**请求参数**:
```typescript
{
  token: string; // JWT令牌
}
```

### 用户模块 (`/api/users/`)

#### GET `/api/users/profile` - 获取用户资料
**功能**: 获取当前用户的详细资料

**Headers**: `Authorization: Bearer <token>`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "user-1",
    "username": "admin",
    "email": "admin@farm.com",
    "displayName": "系统管理员",
    "avatar": "/avatars/admin.jpg",
    "role": "admin",
    "permissions": ["read", "write", "admin"],
    "createdAt": "2023-01-01T00:00:00Z",
    "lastLoginAt": "2025-01-22T08:00:00Z",
    "profile": {
      "phone": "13800138000",
      "department": "技术部",
      "position": "系统管理员"
    }
  }
}
```

### 产品模块 (`/api/products`)

#### GET `/api/products` - 获取产品列表
**功能**: 获取系统中的产品信息列表

**查询参数**:
- `page`: 页码（默认：1）
- `limit`: 每页数量（默认：20）
- `category`: 产品分类筛选
- `search`: 搜索关键词

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "product-1",
      "name": "有机西红柿",
      "category": "vegetable",
      "description": "优质有机西红柿",
      "specifications": {
        "variety": "樱桃番茄",
        "size": "中等",
        "weight": "200-300g"
      },
      "certifications": ["organic", "green"],
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 溯源模块 (`/api/trace/`)

#### GET `/api/trace/{id}` - 获取溯源信息
**功能**: 根据批次ID获取完整的溯源信息

**路径参数**:
- `id`: 批次编号（如：BATCH001, BATCH002等）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "BATCH001",
    "batchCode": "BATCH001",
    "productName": "有机西红柿",
    "productType": "vegetable",
    "currentStage": "retail",
    "qrCode": "https://trace.farm.com/qr/BATCH001",
    "stages": [
      {
        "stage": "farming",
        "name": "种植阶段",
        "location": "山东省寿光市有机农场",
        "startTime": "2023-03-01T00:00:00Z",
        "endTime": "2023-06-15T00:00:00Z",
        "operator": "张三",
        "data": {
          "seedVariety": "樱桃番茄",
          "plantingMethod": "有机种植",
          "fertilizer": "有机肥",
          "irrigation": "滴灌"
        },
        "images": ["/images/farming/plant.jpg"],
        "certifications": ["organic"]
      },
      {
        "stage": "harvesting",
        "name": "收获阶段",
        "location": "山东省寿光市有机农场",
        "startTime": "2023-06-15T06:00:00Z",
        "endTime": "2023-06-15T18:00:00Z",
        "operator": "李四",
        "data": {
          "harvestMethod": "人工采摘",
          "quality": "优等",
          "quantity": "500kg"
        }
      }
    ],
    "location": {
      "province": "山东省",
      "city": "寿光市",
      "coordinates": {
        "latitude": 36.8569,
        "longitude": 118.7324
      }
    },
    "createdAt": "2023-03-01T00:00:00Z",
    "updatedAt": "2023-06-16T00:00:00Z"
  }
}
```

#### POST `/api/trace/{id}/verify` - 批次验证
**功能**: 验证批次信息的真实性

**路径参数**:
- `id`: 批次编号

**请求参数**:
```typescript
{
  verificationCode?: string; // 可选的验证码
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "confidence": 0.95,
    "batchId": "BATCH001",
    "verificationTime": "2025-01-22T10:30:00Z",
    "details": {
      "dataIntegrity": true,
      "certificationsValid": true,
      "timelineConsistent": true,
      "locationVerified": true
    },
    "warnings": [],
    "recommendations": []
  }
}
```

## 🎛️ 环境配置

### 环境变量设置

创建 `.env.local` 文件：

```bash
# Mock API配置
NEXT_PUBLIC_API_ENV=mock
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_MOCK_API=true
NEXT_PUBLIC_MOCK_DELAY=300

# 开发模式配置
NODE_ENV=development
NEXT_PUBLIC_DEBUG_MODE=true
```

### API客户端配置

API客户端会自动检测Mock环境：

```typescript
// web-app-next/src/lib/api.ts
const getApiConfig = () => {
  const env = process.env.NEXT_PUBLIC_API_ENV || 'mock';
  
  if (env === 'mock') {
    return {
      baseURL: '/api',
      timeout: 10000,
      mockDelay: 300,
      useMockData: true
    };
  }
  
  // 其他环境配置...
};
```

## 🔧 Mock数据自定义

### 修改测试数据

Mock数据定义在API路由文件中，可以根据需要修改：

```typescript
// web-app-next/src/app/api/auth/login/route.ts
const mockUsers = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    permissions: ['read', 'write', 'admin']
  },
  // 添加更多测试用户...
];
```

### AI分析模块 (`/api/ai/`) ⭐ **MVP核心功能**

#### POST `/api/ai/production-insights` - 生产数据洞察分析
**功能**: 基于生产数据生成智能洞察和改进建议

**请求参数**:
```typescript
{
  batchId?: string;           // 批次ID（可选）
  timeRange?: string;         // 时间范围: '7d', '30d', '3m', '1y'
  analysisType?: 'efficiency' | 'quality' | 'cost' | 'all';  // 分析类型
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "efficiency": 87,
      "quality": 94,
      "cost": 76,
      "trend": "improving"
    },
    "insights": [
      {
        "category": "efficiency",
        "title": "设备运行效率优化空间",
        "description": "生产线A的设备利用率仅为78%，存在20%的提升空间",
        "impact": "high",
        "actionable": true,
        "recommendedActions": ["优化设备维护计划", "调整生产排期"]
      }
    ],
    "metrics": {
      "efficiency": {
        "currentValue": 87,
        "targetValue": 95,
        "improvement": 8,
        "bottlenecks": ["设备维护", "人员培训"]
      }
    }
  },
  "meta": {
    "requestId": "ai-insights-20250531-001",
    "processingTime": 1500
  }
}
```

#### POST `/api/ai/optimize` - 优化建议引擎
**功能**: 基于当前数据提供个性化优化建议

**请求参数**:
```typescript
{
  processType: 'farming' | 'processing' | 'logistics';
  currentData: Record<string, any>;
  targetMetrics?: string[];
}
```

#### POST `/api/ai/predict` - 预测分析服务
**功能**: 机器学习预测分析

**请求参数**:
```typescript
{
  type: 'yield' | 'quality' | 'timeline' | 'cost';
  inputData: Record<string, any>;
  predictionPeriod?: string;
}
```

#### POST `/api/ai/aggregate` - 数据聚合分析
**功能**: 跨模块综合数据分析

#### POST `/api/ai/realtime-analysis` - 实时监控分析
**功能**: 实时数据监控和异常检测

#### GET `/api/ai/model-status` - AI模型状态查询
**功能**: 查询AI模型健康状态

#### GET `/api/ai/analysis-history` - AI分析历史
**功能**: 获取历史分析结果

> **详细接口文档**: 完整的AI接口规范请参阅 [`ai-analytics.md`](./ai-analytics.md)

**前端Hook集成**:
```typescript
import { useAIAnalytics } from '@/hooks/useApi-simple';

function Dashboard() {
  const { useProductionInsights } = useAIAnalytics();
  
  const insights = useProductionInsights({
    batchId: 'batch-001',
    timeRange: '30d',
    analysisType: 'all'
  });

  if (insights.loading) return <LoadingSpinner />;
  return <InsightsPanel data={insights.data} />;
}
```

### 模拟延迟

Mock API支持模拟网络延迟：

```typescript
// 在API路由中添加延迟
await new Promise(resolve => 
  setTimeout(resolve, process.env.NEXT_PUBLIC_MOCK_DELAY || 300)
);
```

### 模拟错误场景

测试错误处理：

```typescript
// 使用特殊用户名触发错误
{
  username: 'error',
  password: 'any'
} // 返回500错误

{
  username: 'invalid',
  password: 'any'
} // 返回401错误
```

## 🧪 测试和验证

### API功能测试

使用内置的测试页面进行API测试：

```bash
# 访问测试页面
http://localhost:3000/demo
```

### 手动API测试

使用浏览器开发者工具或Postman：

```bash
# 测试登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 测试溯源查询
curl -X GET http://localhost:3000/api/trace/BATCH001
```

### 自动化测试

运行内置的API测试套件：

```bash
cd web-app-next
npm run test:api
```

## 🔄 与原系统的兼容性

### API路由对比

Mock API与原 `web-app/api-router.js` 保持功能一致：

| 原API路由 | Mock API路由 | 状态 |
|-----------|-------------|------|
| `/api/auth/login` | `/api/auth/login` | ✅ 完全兼容 |
| `/api/auth/logout` | `/api/auth/logout` | ✅ 完全兼容 |
| `/api/auth/status` | `/api/auth/status` | ✅ 完全兼容 |
| `/api/auth/verify` | `/api/auth/verify` | ✅ 完全兼容 |
| `/api/products` | `/api/products` | ✅ 完全兼容 |
| `/api/trace/{id}` | `/api/trace/{id}` | ✅ 完全兼容 |
| `/api/users/profile` | `/api/users/profile` | ✅ 完全兼容 |

### 响应格式一致性

Mock API使用与原系统相同的响应格式：

```typescript
// 成功响应
{
  success: true,
  data: {...}
}

// 错误响应
{
  success: false,
  error: {
    code: string,
    message: string
  }
}
```

## 📈 性能特性

### 响应时间

- **平均响应时间**: 300ms（可配置）
- **登录接口**: 200-500ms
- **数据查询**: 100-300ms
- **文件上传**: 500-1000ms

### 并发支持

- **最大并发**: 100个请求/秒
- **连接池**: 自动管理
- **请求队列**: 内置支持

### 内存使用

- **基础内存**: ~50MB
- **数据缓存**: ~10MB
- **最大内存**: ~100MB

## 🛠️ 故障排除

### 常见问题

#### 1. 端口占用错误
```bash
Error: Port 3000 is already in use
```

**解决方案**：
```bash
# 杀死占用端口的进程
npx kill-port 3000

# 或者使用其他端口
npm run dev -- -p 3001
```

#### 2. API请求失败
```typescript
// 检查网络状态
console.log('Online:', navigator.onLine);

// 检查API配置
console.log('API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
```

#### 3. 认证令牌问题
```typescript
// 清除本地存储的令牌
localStorage.removeItem('auth-token');

// 重新登录
await apiClient.post('/auth/login', credentials);
```

### 调试模式

启用详细的调试信息：

```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_LOG_LEVEL=debug
```

## 📚 相关文档

- **[API接口规范](./api-specification.md)** - 完整API接口定义
- **[API概览](./overview.md)** - API总览和通用约定
- **[认证机制](./authentication.md)** - 认证与授权详解

## 🔄 更新日志

### v1.3.0 (2025-05-31) **当前版本**
- ✅ 新增AI分析模块7个接口
- ✅ 完善AI数据分析API文档
- ✅ 集成useAIAnalytics Hook系统
- ✅ 添加AI MVP核心功能支持
- ✅ 更新API总数至18个接口

### v1.2.0 (2025-01-22)
- ✅ 完成Mock API系统搭建
- ✅ 实现11个核心API接口
- ✅ 添加完整的TypeScript类型支持
- ✅ 与原api-router.js功能对齐
- ✅ 添加自动化测试支持

### v1.1.0 (2025-01-21)
- ✅ 基础API客户端实现
- ✅ 认证流程搭建
- ✅ 错误处理机制

---

**维护状态**: ✅ 完全可用  
**更新时间**: 2025-01-22  
**负责团队**: 前端开发团队 