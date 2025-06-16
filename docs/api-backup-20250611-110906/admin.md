# 管理模块API文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建管理模块API文档 -->

## 概述

管理模块API提供用户管理、权限配置、系统监控和数据统计功能。支持系统管理员对整个食品溯源系统进行全面管理和监控。

**基础路径**: `/api/v1/admin`

**需要认证**: 所有接口需要JWT Bearer Token认证

**权限要求**: 
- 读取操作: `admin:read`
- 写入操作: `admin:write`
- 超级管理: `admin:super`

## 数据模型

### 用户管理 (UserManagement)

```typescript
interface User {
  id: string;                  // 用户唯一标识
  username: string;            // 用户名
  email: string;               // 邮箱
  phone?: string;              // 手机号
  fullName: string;            // 真实姓名
  avatar?: string;             // 头像URL
  userType: 'ADMIN' | 'OPERATOR' | 'FARMER' | 'PROCESSOR' | 'LOGISTICS' | 'CONSUMER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  roles: Role[];               // 用户角色
  permissions: Permission[];   // 直接权限
  organizationId?: string;     // 所属组织ID
  departmentId?: string;       // 所属部门ID
  lastLoginTime?: string;      // 最后登录时间
  loginCount: number;          // 登录次数
  isEmailVerified: boolean;    // 邮箱是否验证
  isPhoneVerified: boolean;    // 手机是否验证
  twoFactorEnabled: boolean;   // 是否启用两步验证
  passwordLastChanged: string; // 密码最后修改时间
  profile: UserProfile;        // 用户档案
  preferences: UserPreferences; // 用户偏好
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface UserProfile {
  idNumber?: string;           // 身份证号
  birthday?: string;           // 生日
  gender?: 'MALE' | 'FEMALE' | 'OTHER';  // 性别
  address?: string;            // 地址
  company?: string;            // 公司
  position?: string;           // 职位
  bio?: string;                // 个人简介
}

interface UserPreferences {
  language: string;            // 语言偏好
  timezone: string;            // 时区
  dateFormat: string;          // 日期格式
  theme: 'LIGHT' | 'DARK' | 'AUTO';  // 主题
  notifications: NotificationSettings;  // 通知设置
}

interface NotificationSettings {
  email: boolean;              // 邮件通知
  sms: boolean;                // 短信通知
  push: boolean;               // 推送通知
  alertTypes: string[];        // 通知类型
}
```

### 角色权限 (RolePermission)

```typescript
interface Role {
  id: string;                  // 角色ID
  name: string;                // 角色名称
  code: string;                // 角色代码
  description: string;         // 角色描述
  level: number;               // 角色级别
  isSystemRole: boolean;       // 是否系统角色
  permissions: Permission[];   // 角色权限
  userCount: number;           // 用户数量
  createdBy: string;           // 创建者
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface Permission {
  id: string;                  // 权限ID
  name: string;                // 权限名称
  code: string;                // 权限代码
  resource: string;            // 资源
  action: string;              // 操作
  scope: 'GLOBAL' | 'ORGANIZATION' | 'DEPARTMENT' | 'PERSONAL';
  description: string;         // 权限描述
  category: string;            // 权限分类
  isSystemPermission: boolean; // 是否系统权限
  dependencies?: string[];     // 依赖权限
  createdAt: string;           // 创建时间
}
```

### 组织架构 (Organization)

```typescript
interface Organization {
  id: string;                  // 组织ID
  name: string;                // 组织名称
  code: string;                // 组织代码
  type: 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'PROJECT_GROUP';
  parentId?: string;           // 父组织ID
  level: number;               // 组织层级
  manager: string;             // 负责人ID
  contactInfo: ContactInfo;    // 联系信息
  address?: string;            // 地址
  description?: string;        // 描述
  isActive: boolean;           // 是否活跃
  memberCount: number;         // 成员数量
  children?: Organization[];   // 子组织
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}
```

### 系统监控 (SystemMonitoring)

```typescript
interface SystemMetrics {
  timestamp: string;           // 时间戳
  serverInfo: ServerInfo;      // 服务器信息
  performance: PerformanceMetrics;  // 性能指标
  database: DatabaseMetrics;   // 数据库指标
  api: ApiMetrics;            // API指标
  business: BusinessMetrics;   // 业务指标
}

interface ServerInfo {
  hostname: string;            // 主机名
  os: string;                  // 操作系统
  cpuCores: number;           // CPU核心数
  totalMemory: number;        // 总内存(GB)
  diskSpace: number;          // 磁盘空间(GB)
  uptime: number;             // 运行时间(秒)
}

interface PerformanceMetrics {
  cpuUsage: number;           // CPU使用率(%)
  memoryUsage: number;        // 内存使用率(%)
  diskUsage: number;          // 磁盘使用率(%)
  networkIn: number;          // 网络入流量(MB/s)
  networkOut: number;         // 网络出流量(MB/s)
  loadAverage: number[];      // 负载平均值
}

interface DatabaseMetrics {
  connectionCount: number;     // 连接数
  activeQueries: number;       // 活跃查询数
  slowQueries: number;         // 慢查询数
  tableSize: number;           // 表大小(GB)
  indexSize: number;           // 索引大小(GB)
  queryLatency: number;        // 查询延迟(ms)
}

interface ApiMetrics {
  totalRequests: number;       // 总请求数
  successRate: number;         // 成功率(%)
  errorRate: number;           // 错误率(%)
  averageResponseTime: number; // 平均响应时间(ms)
  peakRps: number;            // 峰值RPS
  activeConnections: number;   // 活跃连接数
}

interface BusinessMetrics {
  totalUsers: number;          // 总用户数
  activeUsers: number;         // 活跃用户数
  totalTraces: number;         // 总溯源记录数
  todayTraces: number;         // 今日新增溯源记录
  totalTransactions: number;   // 总交易数
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';  // 系统健康状态
}
```

### 审计日志 (AuditLog)

```typescript
interface AuditLog {
  id: string;                  // 日志ID
  userId: string;              // 用户ID
  username: string;            // 用户名
  action: string;              // 操作动作
  resource: string;            // 操作资源
  resourceId?: string;         // 资源ID
  method: string;              // HTTP方法
  endpoint: string;            // API端点
  ipAddress: string;           // IP地址
  userAgent: string;           // 用户代理
  requestData?: any;           // 请求数据
  responseData?: any;          // 响应数据
  status: 'SUCCESS' | 'FAILURE' | 'ERROR';  // 操作状态
  errorMessage?: string;       // 错误信息
  duration: number;            // 操作耗时(ms)
  location?: LocationInfo;     // 地理位置
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';  // 风险级别
  tags?: string[];             // 标签
  createdAt: string;           // 创建时间
}
```

## 接口列表

### 用户管理

#### 获取用户列表

**请求**:
```http
GET /api/v1/admin/users?page=1&limit=20&filter=status:ACTIVE,userType:FARMER
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| page | 数字 | 否 | 页码，默认1 |
| limit | 数字 | 否 | 每页数量，默认20，最大100 |
| sort | 字符串 | 否 | 排序字段，默认createdAt |
| order | 字符串 | 否 | 排序方向，asc/desc，默认desc |
| filter | 字符串 | 否 | 筛选条件 |
| search | 字符串 | 否 | 搜索关键词 |

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "user-001",
      "username": "farmer_zhang",
      "email": "zhang@example.com",
      "phone": "13800138001",
      "fullName": "张三",
      "userType": "FARMER",
      "status": "ACTIVE",
      "roles": [
        {
          "id": "role-farmer",
          "name": "农场主",
          "code": "FARMER"
        }
      ],
      "lastLoginTime": "2023-05-21T10:30:00Z",
      "loginCount": 45,
      "isEmailVerified": true,
      "isPhoneVerified": true,
      "twoFactorEnabled": false,
      "createdAt": "2023-01-15T08:30:00Z",
      "updatedAt": "2023-05-21T10:30:00Z"
    }
  ],
  "meta": {
    "total": 256,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

#### 创建用户

**请求**:
```http
POST /api/v1/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "new_processor",
  "email": "processor@example.com",
  "phone": "13800138002",
  "fullName": "李四",
  "password": "SecurePassword123!",
  "userType": "PROCESSOR",
  "roleIds": ["role-processor"],
  "organizationId": "org-001",
  "profile": {
    "company": "食品加工厂",
    "position": "厂长"
  },
  "preferences": {
    "language": "zh-CN",
    "timezone": "Asia/Shanghai"
  }
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "user-002",
    "username": "new_processor",
    "status": "ACTIVE",
    // ... 完整用户信息
  }
}
```

#### 更新用户信息

**请求**:
```http
PATCH /api/v1/admin/users/{userId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "SUSPENDED",
  "roleIds": ["role-basic-processor"],
  "profile": {
    "position": "副厂长"
  }
}
```

#### 重置用户密码

**请求**:
```http
POST /api/v1/admin/users/{userId}/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "NewSecurePassword123!",
  "forceChangeOnLogin": true,
  "notifyUser": true
}
```

### 角色权限管理

#### 获取角色列表

**请求**:
```http
GET /api/v1/admin/roles?page=1&limit=20
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "role-001",
      "name": "系统管理员",
      "code": "ADMIN",
      "description": "拥有系统所有权限的超级管理员",
      "level": 1,
      "isSystemRole": true,
      "userCount": 3,
      "permissions": [
        {
          "id": "perm-001",
          "name": "用户管理",
          "code": "admin:users",
          "resource": "users",
          "action": "manage",
          "scope": "GLOBAL"
        }
      ],
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### 创建角色

**请求**:
```http
POST /api/v1/admin/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "质检员",
  "code": "QUALITY_INSPECTOR",
  "description": "负责产品质量检测的专业人员",
  "level": 3,
  "permissionIds": [
    "perm-quality-read",
    "perm-quality-write",
    "perm-quality-test"
  ]
}
```

#### 获取权限列表

**请求**:
```http
GET /api/v1/admin/permissions?category=farming&scope=ORGANIZATION
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "perm-farming-001",
      "name": "查看农场信息",
      "code": "read:farms",
      "resource": "farms",
      "action": "read",
      "scope": "ORGANIZATION",
      "description": "允许查看本组织下的农场信息",
      "category": "farming",
      "isSystemPermission": true,
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "categories": ["farming", "processing", "logistics", "admin"]
  }
}
```

### 组织架构管理

#### 获取组织架构树

**请求**:
```http
GET /api/v1/admin/organizations/tree
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "org-001",
      "name": "总公司",
      "code": "HEAD_OFFICE",
      "type": "COMPANY",
      "level": 1,
      "manager": "user-001",
      "memberCount": 150,
      "children": [
        {
          "id": "org-002",
          "name": "农业部",
          "code": "FARMING_DEPT",
          "type": "DEPARTMENT",
          "level": 2,
          "manager": "user-002",
          "memberCount": 45,
          "children": []
        }
      ],
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 创建组织

**请求**:
```http
POST /api/v1/admin/organizations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "质检部",
  "code": "QUALITY_DEPT",
  "type": "DEPARTMENT",
  "parentId": "org-001",
  "manager": "user-003",
  "description": "负责产品质量检测和控制",
  "contactInfo": {
    "phone": "0532-88888888",
    "email": "quality@company.com",
    "contactPerson": "质检部主管"
  }
}
```

### 系统监控

#### 获取系统指标

**请求**:
```http
GET /api/v1/admin/system/metrics
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "timestamp": "2023-05-21T15:30:00Z",
    "serverInfo": {
      "hostname": "prod-server-01",
      "os": "Ubuntu 20.04",
      "cpuCores": 8,
      "totalMemory": 32,
      "diskSpace": 500,
      "uptime": 2592000
    },
    "performance": {
      "cpuUsage": 45.6,
      "memoryUsage": 68.2,
      "diskUsage": 35.8,
      "networkIn": 12.5,
      "networkOut": 8.3,
      "loadAverage": [1.2, 1.5, 1.8]
    },
    "database": {
      "connectionCount": 25,
      "activeQueries": 8,
      "slowQueries": 2,
      "tableSize": 15.6,
      "indexSize": 3.2,
      "queryLatency": 85
    },
    "api": {
      "totalRequests": 125680,
      "successRate": 99.2,
      "errorRate": 0.8,
      "averageResponseTime": 145,
      "peakRps": 850,
      "activeConnections": 42
    },
    "business": {
      "totalUsers": 1250,
      "activeUsers": 680,
      "totalTraces": 25600,
      "todayTraces": 156,
      "totalTransactions": 89500,
      "systemHealth": "HEALTHY"
    }
  }
}
```

#### 获取系统日志

**请求**:
```http
GET /api/v1/admin/system/logs?level=ERROR&startDate=2023-05-21T00:00:00Z&endDate=2023-05-21T23:59:59Z
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "log-001",
      "timestamp": "2023-05-21T14:25:30Z",
      "level": "ERROR",
      "service": "api-server",
      "message": "Database connection timeout",
      "stack": "Error: Connection timeout...",
      "metadata": {
        "userId": "user-123",
        "endpoint": "/api/v1/traces",
        "duration": 5000
      }
    }
  ],
  "meta": {
    "total": 15,
    "levels": ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]
  }
}
```

### 审计日志

#### 获取审计日志

**请求**:
```http
GET /api/v1/admin/audit-logs?page=1&limit=20&filter=action:CREATE,resource:users
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "audit-001",
      "userId": "user-admin",
      "username": "admin",
      "action": "CREATE",
      "resource": "users",
      "resourceId": "user-002",
      "method": "POST",
      "endpoint": "/api/v1/admin/users",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "status": "success",
      "duration": 250,
      "riskLevel": "LOW",
      "createdAt": "2023-05-21T14:30:00Z"
    }
  ],
  "meta": {
    "total": 1580,
    "page": 1,
    "limit": 20,
    "totalPages": 79
  }
}
```

### 数据统计

#### 获取用户统计

**请求**:
```http
GET /api/v1/admin/statistics/users?period=30days&groupBy=userType
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "totalUsers": 1250,
    "activeUsers": 980,
    "newUsers": 85,
    "usersByType": {
      "FARMER": 450,
      "PROCESSOR": 280,
      "LOGISTICS": 180,
      "CONSUMER": 250,
      "ADMIN": 15,
      "OPERATOR": 75
    },
    "usersByStatus": {
      "ACTIVE": 1100,
      "INACTIVE": 120,
      "SUSPENDED": 25,
      "PENDING": 5
    },
    "registrationTrend": [
      {
        "date": "2023-05-15",
        "count": 12
      },
      {
        "date": "2023-05-16",
        "count": 8
      }
    ],
    "loginActivity": {
      "dailyActiveUsers": 680,
      "weeklyActiveUsers": 850,
      "monthlyActiveUsers": 980
    }
  },
  "meta": {
    "period": "30 days",
    "endDate": "2023-05-21T23:59:59Z"
  }
}
```

#### 获取业务统计

**请求**:
```http
GET /api/v1/admin/statistics/business?startDate=2023-05-01&endDate=2023-05-21
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "traceability": {
      "totalTraces": 25600,
      "completedTraces": 24850,
      "pendingTraces": 750,
      "completionRate": 97.1,
      "averageCompletionTime": 2.5
    },
    "modules": {
      "farming": {
        "totalRecords": 8500,
        "activeRecords": 1200,
        "farms": 450
      },
      "processing": {
        "totalRecords": 6800,
        "activeRecords": 980,
        "facilities": 125
      },
      "logistics": {
        "totalShipments": 5200,
        "inTransit": 280,
        "delivered": 4920,
        "onTimeRate": 94.6
      }
    },
    "quality": {
      "totalTests": 12500,
      "passedTests": 12180,
      "passRate": 97.4,
      "averageScore": 92.3
    },
    "alerts": {
      "totalAlerts": 156,
      "resolvedAlerts": 142,
      "pendingAlerts": 14,
      "criticalAlerts": 3
    }
  }
}
```

## 错误码表

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|------------|------|----------|
| USER_NOT_FOUND | 404 | 用户不存在 | 检查用户ID是否正确 |
| ROLE_NOT_FOUND | 404 | 角色不存在 | 检查角色ID是否正确 |
| PERMISSION_NOT_FOUND | 404 | 权限不存在 | 检查权限ID是否正确 |
| ORGANIZATION_NOT_FOUND | 404 | 组织不存在 | 检查组织ID是否正确 |
| INSUFFICIENT_PRIVILEGE | 403 | 权限不足 | 需要管理员权限 |
| USERNAME_EXISTS | 422 | 用户名已存在 | 使用不同的用户名 |
| EMAIL_EXISTS | 422 | 邮箱已被使用 | 使用不同的邮箱地址 |
| ROLE_CODE_EXISTS | 422 | 角色代码已存在 | 使用不同的角色代码 |
| ORGANIZATION_CODE_EXISTS | 422 | 组织代码已存在 | 使用不同的组织代码 |
| INVALID_PASSWORD | 422 | 密码格式不符合要求 | 密码需包含大小写字母、数字和特殊字符 |
| CANNOT_DELETE_SYSTEM_ROLE | 422 | 无法删除系统角色 | 系统内置角色不能删除 |
| USER_HAS_DEPENDENCIES | 422 | 用户存在关联数据 | 先处理用户的关联数据 |
| CIRCULAR_ORGANIZATION | 422 | 组织结构存在循环引用 | 检查父组织设置 |

## 业务规则

1. **用户管理规则**:
   - 用户名和邮箱必须唯一
   - 密码必须符合安全策略
   - 系统管理员不能被删除或禁用
   - 用户删除前必须解除所有关联关系

2. **角色权限规则**:
   - 系统角色不能被删除或修改
   - 角色代码必须唯一
   - 权限分配必须遵循最小权限原则
   - 角色删除前必须先移除所有用户关联

3. **组织架构规则**:
   - 组织代码必须唯一
   - 不能存在循环的父子关系
   - 删除组织前必须先删除或转移子组织
   - 组织负责人必须是有效用户

4. **审计日志规则**:
   - 所有管理操作必须记录审计日志
   - 审计日志不能被修改或删除
   - 敏感操作需要记录详细信息
   - 高风险操作需要额外审批

5. **系统监控规则**:
   - 系统指标每分钟采集一次
   - 异常指标需要立即报警
   - 历史数据保留90天
   - 关键指标需要设置阈值监控

## 使用示例

### 完整的用户管理流程示例

```javascript
// 1. 创建新用户
const user = await fetch('/api/v1/admin/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'quality_inspector',
    email: 'qc@company.com',
    fullName: '质检员王五',
    userType: 'OPERATOR',
    password: 'SecurePass123!',
    roleIds: ['role-quality-inspector'],
    organizationId: 'org-quality-dept'
  })
});

// 2. 分配权限
const roleAssignment = await fetch(`/api/v1/admin/users/${user.data.id}/roles`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    roleIds: ['role-quality-inspector', 'role-basic-user']
  })
});

// 3. 查看审计日志
const auditLogs = await fetch('/api/v1/admin/audit-logs', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

// 4. 获取系统统计
const statistics = await fetch('/api/v1/admin/statistics/users?period=7days', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
``` 