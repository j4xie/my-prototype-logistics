# API接口规范文档

<!-- 基于现有Mock API整理，为真实API接入做准备 -->

## 📋 概述

本文档基于当前Mock API系统整理出完整的API接口规范，为未来接入真实后端API提供详细的接口定义和数据格式规范。

### 版本信息
- **文档版本**: v1.0.0
- **API版本**: v1
- **基础URL**: `{BASE_URL}/v1`
- **当前状态**: Mock API运行中，真实API开发中

## 🔐 认证系统

### 1. 用户登录
```typescript
POST /v1/auth/login

// 请求
interface LoginRequest {
  username: string;  // 邮箱或用户名
  password: string;  // 密码
}

// 响应
interface LoginResponse {
  success: boolean;
  data: {
    token: string;         // JWT访问令牌
    refreshToken: string;  // 刷新令牌
    user: UserInfo;       // 用户信息
    expiresIn: number;    // 过期时间(秒)
  };
  message?: string;
}

// Mock账户信息
// admin@farm.com / admin123 - 管理员
// manager@farm.com / manager123 - 管理员
// farmer@farm.com / farmer123 - 普通用户
```

### 2. 用户登出
```typescript
POST /v1/auth/logout

// 请求头
Authorization: Bearer <token>

// 响应
interface LogoutResponse {
  success: boolean;
  message: string;
}
```

### 3. 令牌验证
```typescript
GET /v1/auth/verify

// 请求头
Authorization: Bearer <token>

// 响应
interface TokenVerifyResponse {
  success: boolean;
  data: {
    valid: boolean;
    user?: UserInfo;
    expiresAt?: number;
  };
}
```

### 4. 用户状态查询
```typescript
GET /v1/auth/status

// 请求头
Authorization: Bearer <token>

// 响应
interface UserStatusResponse {
  success: boolean;
  data: {
    isAuthenticated: boolean;
    user: UserInfo;
    permissions: string[];
  };
}
```

## 👤 用户管理

### 5. 获取用户资料
```typescript
GET /v1/users/profile

// 请求头
Authorization: Bearer <token>

// 响应
interface UserProfileResponse {
  success: boolean;
  data: UserProfile;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'farmer' | 'consumer';
  permissions: string[];
  settings: {
    language: string;
    theme: string;
    notifications: boolean;
  };
  createdAt: string;
  lastLoginAt: string;
}
```

### 6. 更新用户资料
```typescript
PUT /v1/users/profile

// 请求头
Authorization: Bearer <token>

// 请求
interface UpdateProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
  settings?: {
    language?: string;
    theme?: string;
    notifications?: boolean;
  };
}

// 响应
interface UpdateProfileResponse {
  success: boolean;
  data: UserProfile;
  message: string;
}
```

## 📦 产品管理

### 7. 获取产品列表
```typescript
GET /v1/products

// 查询参数
interface ProductListQuery {
  page?: number;        // 页码，默认1
  pageSize?: number;    // 每页数量，默认10
  search?: string;      // 搜索关键词
  category?: string;    // 产品分类
  status?: string;      // 产品状态
  sortBy?: string;      // 排序字段
  sortOrder?: 'asc' | 'desc';  // 排序方向
}

// 响应
interface ProductListResponse {
  success: boolean;
  data: {
    products: Product[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

interface Product {
  id: string;
  name: string;
  category: string;
  description?: string;
  images: string[];
  price?: number;
  unit?: string;
  status: 'active' | 'inactive' | 'sold_out';
  farmer: {
    id: string;
    name: string;
    location: string;
  };
  certifications: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 8. 获取单个产品详情
```typescript
GET /v1/products/{productId}

// 响应
interface ProductDetailResponse {
  success: boolean;
  data: ProductDetail;
}

interface ProductDetail extends Product {
  specifications: Record<string, any>;
  qualityReports: QualityReport[];
  reviews: ProductReview[];
}
```

## 🔍 溯源系统

### 9. 获取溯源信息
```typescript
GET /v1/trace/{batchId}

// 响应
interface TraceInfoResponse {
  success: boolean;
  data: TraceInfo;
}

interface TraceInfo {
  batchId: string;
  productName: string;
  currentStage: string;
  status: 'active' | 'completed' | 'issue';
  farmer: FarmerInfo;
  traceSteps: TraceStep[];
  qualityInfo: QualityInfo;
  certifications: Certification[];
  createdAt: string;
  updatedAt: string;
}

interface TraceStep {
  id: string;
  stage: 'farming' | 'processing' | 'logistics' | 'retail';
  title: string;
  description: string;
  location: string;
  operator: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'pending';
  documents: Document[];
  photos: string[];
  data: Record<string, any>;
}
```

### 10. 批次验证
```typescript
GET /v1/trace/{batchId}/verify

// 响应
interface BatchVerifyResponse {
  success: boolean;
  data: VerificationResult;
}

interface VerificationResult {
  batchId: string;
  isValid: boolean;
  verificationScore: number;  // 0-100
  verificationDetails: {
    documentIntegrity: number;
    chainOfCustody: number;
    qualityCompliance: number;
    timelineConsistency: number;
  };
  issues: VerificationIssue[];
  verifiedAt: string;
}

interface VerificationIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  recommendation?: string;
}
```

### 11. 更新溯源信息
```typescript
PUT /v1/trace/{batchId}

// 请求头
Authorization: Bearer <token>

// 请求
interface UpdateTraceRequest {
  stage?: string;
  status?: string;
  data?: Record<string, any>;
  documents?: Document[];
  photos?: string[];
}

// 响应
interface UpdateTraceResponse {
  success: boolean;
  data: TraceInfo;
  message: string;
}
```

## 📊 数据类型定义

### 通用类型

```typescript
// 用户信息
interface UserInfo {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'farmer' | 'consumer';
  avatar?: string;
}

// 农户信息
interface FarmerInfo {
  id: string;
  name: string;
  location: string;
  contactInfo: ContactInfo;
  certifications: string[];
  rating: number;
}

// 联系信息
interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// 质量信息
interface QualityInfo {
  grade: 'A' | 'B' | 'C';
  score: number;
  testResults: TestResult[];
  inspectionDate: string;
  inspector: string;
}

// 测试结果
interface TestResult {
  name: string;
  value: string | number;
  unit?: string;
  standard?: string;
  status: 'pass' | 'fail' | 'warning';
}

// 认证信息
interface Certification {
  id: string;
  name: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  status: 'valid' | 'expired' | 'revoked';
  documentUrl?: string;
}

// 文档信息
interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

// 产品评价
interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// 质量报告
interface QualityReport {
  id: string;
  reportType: string;
  testDate: string;
  results: TestResult[];
  inspector: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

## 🧠 AI数据分析接口

本系统的核心AI分析功能接口。详细接口规范请参阅：**[`ai-analytics.md`](./ai-analytics.md)**

### AI接口快速导览

| 接口路径 | 方法 | 功能描述 | Hook函数 |
|----------|------|----------|----------|
| `/v1/ai/production-insights` | POST | 生产数据洞察分析 | `useProductionInsights` |
| `/v1/ai/optimize` | POST | 优化建议引擎 | `useOptimizationSuggestions` |
| `/v1/ai/predict` | POST | 预测分析服务 | `usePredictiveAnalysis` |
| `/v1/ai/aggregate` | POST | 数据聚合分析 | `useDataAggregation` |
| `/v1/ai/realtime-analysis` | POST | 实时监控分析 | `useRealtimeAnalysis` |
| `/v1/ai/model-status` | GET | AI模型状态查询 | `apiClient.get` |
| `/v1/ai/analysis-history` | GET | AI分析历史查询 | `apiClient.get` |

### TypeScript类型定义

```typescript
// 导入AI分析相关类型
import {
  ProductionInsightsRequest,
  ProductionInsightsResponse,
  OptimizationRequest,
  OptimizationResponse,
  PredictiveAnalysisRequest,
  PredictiveAnalysisResponse,
  DataAggregationRequest,
  DataAggregationResponse,
  RealtimeAnalysisRequest,
  RealtimeAnalysisResponse,
  ModelStatusResponse,
  AnalysisHistoryResponse
} from './ai-analytics';
```

### 前端Hook集成示例

```typescript
import { useAIAnalytics } from '@/hooks/useApi-simple';

function AIDashboard() {
  const { useProductionInsights, useOptimizationSuggestions } = useAIAnalytics();
  
  const insights = useProductionInsights({
    batchId: 'batch-001',
    timeRange: '30d',
    analysisType: 'all'
  });

  const suggestions = useOptimizationSuggestions({
    processType: 'processing',
    currentData: { efficiency: 85, quality: 92 },
    targetMetrics: ['efficiency', 'cost']
  });

  return (
    <div>
      <AIInsightsPanel data={insights.data} loading={insights.loading} />
      <OptimizationPanel suggestions={suggestions.data} />
    </div>
  );
}
```

### Mock API实现状态

| 接口 | Mock状态 | 备注 |
|------|----------|------|
| 生产洞察分析 | ✅ 完成 | 基于真实业务场景的模拟数据 |
| 优化建议引擎 | ✅ 完成 | 智能建议算法模拟 |
| 预测分析 | ✅ 完成 | 多场景预测模拟 |
| 数据聚合 | ✅ 完成 | 跨模块数据整合 |
| 实时监控 | ✅ 完成 | 实时状态和告警模拟 |
| 模型状态 | 🔄 开发中 | AI模型健康状态监控 |
| 分析历史 | 🔄 开发中 | 历史分析记录查询 |

> **详细信息**: AI分析接口的完整文档、数据模型、错误处理等信息请查看 [`ai-analytics.md`](./ai-analytics.md)

## 🚨 错误处理

### 错误响应格式
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### 常见错误码
```typescript
const ERROR_CODES = {
  // 认证错误
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_TOKEN_EXPIRED: 'AUTH_002',
  AUTH_TOKEN_INVALID: 'AUTH_003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  
  // 验证错误
  VALIDATION_REQUIRED_FIELD: 'VAL_001',
  VALIDATION_INVALID_FORMAT: 'VAL_002',
  VALIDATION_OUT_OF_RANGE: 'VAL_003',
  
  // 业务错误
  RESOURCE_NOT_FOUND: 'BUS_001',
  RESOURCE_ALREADY_EXISTS: 'BUS_002',
  RESOURCE_IN_USE: 'BUS_003',
  
  // 系统错误
  INTERNAL_SERVER_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  NETWORK_ERROR: 'SYS_003',
} as const;
```

## 🔧 环境配置

### Mock API环境
```bash
# .env.local
NEXT_PUBLIC_API_ENV=mock
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_MOCK_API=true
NEXT_PUBLIC_MOCK_DELAY=300
```

### 开发环境
```bash
# .env.development
NEXT_PUBLIC_API_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_MOCK_API=false
```

### 生产环境
```bash
# .env.production
NEXT_PUBLIC_API_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://api.yourapp.com/v1
NEXT_PUBLIC_MOCK_API=false
```

## 📝 实施计划

### 第一阶段：Mock API完善（当前）
- ✅ 基础认证系统Mock API
- ✅ 用户管理Mock API
- ✅ 产品管理Mock API
- ✅ 溯源系统Mock API
- 🔄 离线队列Mock适配

### 第二阶段：真实API开发（规划中）
- 🔲 后端API服务开发
- 🔲 数据库设计和实现
- 🔲 API接口实现
- 🔲 集成测试和部署

### 第三阶段：API切换（未来）
- 🔲 环境配置切换
- 🔲 数据迁移和同步
- 🔲 全面测试验证
- 🔲 生产环境部署

## 📋 后端开发建议

为后端团队提供的开发建议：

### 技术栈建议
- **语言**: Node.js + TypeScript / Python + FastAPI / Java + Spring Boot
- **数据库**: PostgreSQL + Redis
- **认证**: JWT + OAuth2
- **文档**: OpenAPI 3.0 / Swagger

### 接口实现要点
1. **完全按照本规范实现接口路径和数据格式**
2. **实现完整的错误处理和状态码**
3. **添加请求限制和安全验证**
4. **支持分页和筛选查询**
5. **实现文件上传和处理**
6. **添加日志记录和监控**

### 数据模型参考
参考Mock API中的数据结构设计数据库表结构，确保数据类型和字段完全一致。

---

**文档状态**: 基于Mock API整理完成  
**下次更新**: 真实API开发启动时  
**维护责任**: 前端团队 + 后端团队  