# PRD-API-SystemController

**控制器**: SystemController
**基础路径**: `/api/mobile/system`
**功能**: 系统管理与监控
**端点数量**: 9个
**文档版本**: v1.0.0
**最后更新**: 2025-01-20

---

## 📋 目录

- [控制器概览](#控制器概览)
- [API端点列表](#api端点列表)
- [详细API文档](#详细api文档)
  - [1. 系统健康监控](#1-系统健康监控)
  - [2. 日志管理](#2-日志管理)
  - [3. 性能监控](#3-性能监控)
  - [4. 系统配置](#4-系统配置)
  - [5. 数据库管理](#5-数据库管理)
- [前端集成指南](#前端集成指南)
- [业务规则](#业务规则)
- [错误处理](#错误处理)

---

## 控制器概览

### 核心功能
SystemController提供**系统级管理与监控功能**，包括健康检查、日志管理、性能监控、配置管理、数据库状态监控等企业级运维需求。

### 技术特点
- **健康检查**: 实时监控系统运行状态
- **日志管理**: 系统日志、API访问日志记录与查询
- **性能监控**: CPU、内存、线程、数据库连接池监控
- **统计分析**: 系统运营数据统计
- **日志清理**: 自动化日志清理机制
- **配置管理**: 系统配置信息查询
- **数据库监控**: 数据库连接和状态监控

### 业务价值
- 保障系统稳定运行
- 快速定位和解决问题
- 性能优化和容量规划
- 审计和合规要求
- 运维自动化支持

---

## API端点列表

### 1. 系统健康与监控 (3个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/health` | 系统健康检查 | 公开 |
| GET | `/performance` | 性能监控 | 系统管理员 |
| GET | `/statistics` | 系统统计 | 系统管理员 |

### 2. 日志管理 (4个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| POST | `/logs` | 记录系统日志 | 认证用户 |
| GET | `/logs` | 获取系统日志 | 系统管理员 |
| GET | `/api-logs` | 获取API访问日志 | 系统管理员 |
| POST | `/cleanup-logs` | 清理过期日志 | 系统管理员 |

### 3. 系统配置与状态 (2个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/configuration` | 获取系统配置 | 系统管理员 |
| GET | `/database/status` | 数据库状态 | 系统管理员 |

---

## 详细API文档

## 1. 系统健康监控

### 1.1 系统健康检查

**接口定义**
```
GET /api/mobile/system/health
```

**功能描述**
获取系统健康状态，包括应用状态、数据库连接、磁盘空间、内存使用等关键指标。

**请求参数**
无需参数

**响应数据结构**
```typescript
interface SystemHealth {
  // 总体状态
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;

  // 应用信息
  application: {
    name: string;
    version: string;
    uptime: number;           // 运行时长(秒)
    startTime: string;        // 启动时间
  };

  // 数据库健康
  database: {
    status: 'UP' | 'DOWN';
    connectionPool: {
      active: number;         // 活跃连接
      idle: number;           // 空闲连接
      total: number;          // 总连接数
      max: number;            // 最大连接数
    };
    responseTime: number;     // 响应时间(ms)
  };

  // 磁盘空间
  diskSpace: {
    total: number;            // 总空间(GB)
    free: number;             // 可用空间(GB)
    used: number;             // 已用空间(GB)
    usagePercent: number;     // 使用率
    threshold: number;        // 告警阈值
    status: 'OK' | 'WARNING' | 'CRITICAL';
  };

  // 内存使用
  memory: {
    total: number;            // 总内存(MB)
    used: number;             // 已用内存(MB)
    free: number;             // 可用内存(MB)
    usagePercent: number;     // 使用率
    maxHeap: number;          // 最大堆内存(MB)
    usedHeap: number;         // 已用堆内存(MB)
  };

  // 线程信息
  threads: {
    total: number;            // 总线程数
    running: number;          // 运行中
    blocked: number;          // 阻塞
    waiting: number;          // 等待
    peak: number;             // 峰值线程数
  };

  // 外部依赖
  dependencies: {
    [key: string]: {
      status: 'UP' | 'DOWN';
      responseTime?: number;
      message?: string;
    };
  };

  // 告警列表
  alerts: Array<{
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    component: string;
    message: string;
    timestamp: string;
  }>;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "status": "UP",
    "timestamp": "2025-01-20T10:30:00",
    "application": {
      "name": "Cretas Backend System",
      "version": "1.0.0",
      "uptime": 86400,
      "startTime": "2025-01-19T10:30:00"
    },
    "database": {
      "status": "UP",
      "connectionPool": {
        "active": 5,
        "idle": 15,
        "total": 20,
        "max": 50
      },
      "responseTime": 15
    },
    "diskSpace": {
      "total": 500.0,
      "free": 200.0,
      "used": 300.0,
      "usagePercent": 60.0,
      "threshold": 85.0,
      "status": "OK"
    },
    "memory": {
      "total": 4096,
      "used": 2048,
      "free": 2048,
      "usagePercent": 50.0,
      "maxHeap": 2048,
      "usedHeap": 1024
    },
    "threads": {
      "total": 50,
      "running": 10,
      "blocked": 2,
      "waiting": 38,
      "peak": 60
    },
    "dependencies": {
      "DeepSeekAI": {
        "status": "UP",
        "responseTime": 500
      },
      "Redis": {
        "status": "UP",
        "responseTime": 5
      }
    },
    "alerts": [
      {
        "severity": "WARNING",
        "component": "Memory",
        "message": "内存使用率较高: 85%",
        "timestamp": "2025-01-20T10:25:00"
      }
    ]
  },
  "timestamp": "2025-01-20T10:30:00"
}
```

**业务规则**
- 公开端点，无需认证
- 数据每30秒更新一次
- 状态判断规则:
  - UP: 所有关键组件正常
  - DEGRADED: 部分非关键组件异常
  - DOWN: 关键组件异常
- 自动发送告警通知

---

### 1.2 系统性能监控

**接口定义**
```
GET /api/mobile/system/performance
```

**功能描述**
获取系统性能监控数据，包括CPU、内存、GC、线程池、数据库性能等详细指标。

**请求参数**
无需参数

**响应数据结构**
```typescript
interface SystemPerformance {
  timestamp: string;

  // CPU性能
  cpu: {
    cores: number;              // CPU核心数
    usage: number;              // CPU使用率 (0-100)
    systemLoad: number;         // 系统负载
    processLoad: number;        // 进程负载
    loadAverage: {
      oneMinute: number;
      fiveMinute: number;
      fifteenMinute: number;
    };
  };

  // 内存详情
  memory: {
    heap: {
      init: number;             // 初始堆内存(MB)
      used: number;             // 已用堆内存(MB)
      committed: number;        // 已提交堆内存(MB)
      max: number;              // 最大堆内存(MB)
      usagePercent: number;
    };
    nonHeap: {
      init: number;
      used: number;
      committed: number;
      max: number;
    };
    buffer: {
      direct: number;           // 直接缓冲区(MB)
      mapped: number;           // 映射缓冲区(MB)
    };
  };

  // 垃圾回收
  gc: {
    youngGC: {
      count: number;            // 年轻代GC次数
      time: number;             // GC总时间(ms)
      avgTime: number;          // 平均GC时间(ms)
    };
    fullGC: {
      count: number;            // Full GC次数
      time: number;
      avgTime: number;
    };
    totalGCTime: number;        // 总GC时间(ms)
    gcTimePercent: number;      // GC时间占比
  };

  // 线程池性能
  threadPools: Array<{
    name: string;
    coreSize: number;           // 核心线程数
    maxSize: number;            // 最大线程数
    activeCount: number;        // 活跃线程
    queueSize: number;          // 队列长度
    queueCapacity: number;      // 队列容量
    completedTasks: number;     // 已完成任务
    rejectedTasks: number;      // 拒绝任务数
  }>;

  // 数据库性能
  database: {
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    avgQueryTime: number;       // 平均查询时间(ms)
    slowQueries: number;        // 慢查询数(>1s)
    totalQueries: number;       // 总查询数
    qps: number;                // 每秒查询数
  };

  // HTTP请求性能
  http: {
    totalRequests: number;      // 总请求数
    activeRequests: number;     // 活跃请求
    avgResponseTime: number;    // 平均响应时间(ms)
    rps: number;                // 每秒请求数
    errorRate: number;          // 错误率
    statusCodes: {
      '2xx': number;
      '4xx': number;
      '5xx': number;
    };
  };

  // 缓存性能
  cache?: {
    hitRate: number;            // 命中率
    missRate: number;           // 未命中率
    evictionCount: number;      // 驱逐次数
    size: number;               // 缓存大小
  };

  // 性能趋势(最近1小时)
  trend: {
    timestamps: string[];
    cpuUsage: number[];
    memoryUsage: number[];
    responseTime: number[];
  };
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "timestamp": "2025-01-20T10:30:00",
    "cpu": {
      "cores": 8,
      "usage": 45.5,
      "systemLoad": 3.2,
      "processLoad": 2.1,
      "loadAverage": {
        "oneMinute": 2.5,
        "fiveMinute": 2.3,
        "fifteenMinute": 2.0
      }
    },
    "memory": {
      "heap": {
        "init": 512,
        "used": 1024,
        "committed": 2048,
        "max": 4096,
        "usagePercent": 25.0
      },
      "nonHeap": {
        "init": 128,
        "used": 64,
        "committed": 128,
        "max": 256
      },
      "buffer": {
        "direct": 32,
        "mapped": 16
      }
    },
    "gc": {
      "youngGC": {
        "count": 150,
        "time": 3500,
        "avgTime": 23.3
      },
      "fullGC": {
        "count": 5,
        "time": 2000,
        "avgTime": 400.0
      },
      "totalGCTime": 5500,
      "gcTimePercent": 0.15
    },
    "threadPools": [
      {
        "name": "http-nio-10010",
        "coreSize": 10,
        "maxSize": 200,
        "activeCount": 5,
        "queueSize": 0,
        "queueCapacity": 1000,
        "completedTasks": 15000,
        "rejectedTasks": 0
      }
    ],
    "database": {
      "activeConnections": 5,
      "idleConnections": 15,
      "waitingConnections": 0,
      "avgQueryTime": 25,
      "slowQueries": 3,
      "totalQueries": 50000,
      "qps": 120
    },
    "http": {
      "totalRequests": 100000,
      "activeRequests": 10,
      "avgResponseTime": 150,
      "rps": 250,
      "errorRate": 0.5,
      "statusCodes": {
        "2xx": 95000,
        "4xx": 3000,
        "5xx": 500
      }
    },
    "trend": {
      "timestamps": ["10:00", "10:15", "10:30"],
      "cpuUsage": [40.0, 42.5, 45.5],
      "memoryUsage": [22.0, 23.5, 25.0],
      "responseTime": [140, 145, 150]
    }
  }
}
```

**业务规则**
- 仅系统管理员可访问
- 数据每分钟更新
- 趋势数据保留最近1小时
- 性能告警阈值:
  - CPU > 80%: WARNING
  - Memory > 85%: WARNING
  - GC时间占比 > 10%: WARNING
  - 慢查询 > 100/小时: WARNING

---

### 1.3 系统统计概览

**接口定义**
```
GET /api/mobile/system/statistics?factoryId={factoryId}
```

**功能描述**
获取系统运营统计概览，包括用户活跃度、API调用量、数据增长等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Query | 否 | 工厂ID，不传则返回全局统计 |

**响应数据结构**
```typescript
interface SystemStatistics {
  // 用户统计
  users: {
    total: number;              // 总用户数
    active: number;             // 活跃用户
    online: number;             // 在线用户
    newToday: number;           // 今日新增
    newThisMonth: number;       // 本月新增
    byRole: {
      [role: string]: number;
    };
  };

  // 工厂统计
  factories: {
    total: number;              // 总工厂数
    active: number;             // 活跃工厂
    inactive: number;           // 停用工厂
    newThisMonth: number;
  };

  // API调用统计
  apiCalls: {
    today: number;              // 今日调用
    thisMonth: number;          // 本月调用
    avgResponseTime: number;    // 平均响应时间(ms)
    errorRate: number;          // 错误率
    topEndpoints: Array<{
      endpoint: string;
      count: number;
      avgResponseTime: number;
    }>;
  };

  // 数据统计
  dataStats: {
    totalRecords: number;       // 总记录数
    productionBatches: number;  // 生产批次
    materialBatches: number;    // 物料批次
    qualityRecords: number;     // 质检记录
    growthRate: number;         // 数据增长率(%)
  };

  // 存储统计
  storage: {
    totalSize: number;          // 总存储(GB)
    databaseSize: number;       // 数据库(GB)
    fileSize: number;           // 文件存储(GB)
    backupSize: number;         // 备份(GB)
    growthRate: number;         // 增长率(%)
  };

  // 系统日志统计
  logs: {
    totalLogs: number;          // 总日志数
    errorLogs: number;          // 错误日志
    warningLogs: number;        // 警告日志
    todayLogs: number;          // 今日日志
    avgLogsPerDay: number;      // 日均日志量
  };

  // 活跃度趋势(最近30天)
  activityTrend: Array<{
    date: string;
    activeUsers: number;
    apiCalls: number;
    dataRecords: number;
  }>;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "users": {
      "total": 500,
      "active": 350,
      "online": 50,
      "newToday": 5,
      "newThisMonth": 25,
      "byRole": {
        "factory_super_admin": 10,
        "department_admin": 50,
        "supervisor": 100,
        "operator": 340
      }
    },
    "factories": {
      "total": 20,
      "active": 18,
      "inactive": 2,
      "newThisMonth": 2
    },
    "apiCalls": {
      "today": 50000,
      "thisMonth": 1500000,
      "avgResponseTime": 150,
      "errorRate": 0.5,
      "topEndpoints": [
        {
          "endpoint": "/api/mobile/{factoryId}/processing/batches",
          "count": 15000,
          "avgResponseTime": 200
        },
        {
          "endpoint": "/api/mobile/{factoryId}/reports/dashboard",
          "count": 12000,
          "avgResponseTime": 500
        }
      ]
    },
    "dataStats": {
      "totalRecords": 1000000,
      "productionBatches": 50000,
      "materialBatches": 150000,
      "qualityRecords": 80000,
      "growthRate": 15.5
    },
    "storage": {
      "totalSize": 100.5,
      "databaseSize": 50.2,
      "fileSize": 40.3,
      "backupSize": 10.0,
      "growthRate": 8.5
    },
    "logs": {
      "totalLogs": 5000000,
      "errorLogs": 25000,
      "warningLogs": 50000,
      "todayLogs": 100000,
      "avgLogsPerDay": 150000
    },
    "activityTrend": [
      {
        "date": "2025-01-01",
        "activeUsers": 300,
        "apiCalls": 45000,
        "dataRecords": 500
      }
    ]
  }
}
```

**业务规则**
- 活跃用户: 最近7天内登录的用户
- 活跃工厂: 最近30天内有操作的工厂
- 数据每小时更新一次
- 趋势数据保留最近30天

---

## 2. 日志管理

### 2.1 记录系统日志

**接口定义**
```
POST /api/mobile/system/logs
```

**功能描述**
创建新的系统日志记录，用于记录应用层面的业务日志、审计日志等。

**请求Body**
```typescript
interface SystemLog {
  factoryId?: string;         // 工厂ID
  logType: string;            // 日志类型: INFO/WARNING/ERROR/AUDIT
  logLevel: string;           // 日志级别: DEBUG/INFO/WARN/ERROR/FATAL
  module?: string;            // 模块名称
  action?: string;            // 操作类型
  userId?: number;            // 用户ID
  username?: string;          // 用户名
  ipAddress?: string;         // IP地址
  userAgent?: string;         // User Agent
  requestMethod?: string;     // 请求方法: GET/POST/PUT/DELETE
  requestUrl?: string;        // 请求URL
  requestParams?: string;     // 请求参数(JSON字符串)
  responseStatus?: number;    // 响应状态码
  responseData?: string;      // 响应数据(JSON字符串)
  errorMessage?: string;      // 错误信息
  stackTrace?: string;        // 堆栈跟踪
  executionTime?: number;     // 执行时间(ms)
  message?: string;           // 日志消息
}
```

**请求示例**
```json
{
  "factoryId": "CRETAS_2024_001",
  "logType": "AUDIT",
  "logLevel": "INFO",
  "module": "UserManagement",
  "action": "CREATE_USER",
  "userId": 1,
  "username": "admin",
  "ipAddress": "192.168.1.100",
  "userAgent": "CretasApp/1.0.0 (iOS 15.0)",
  "requestMethod": "POST",
  "requestUrl": "/api/mobile/CRETAS_2024_001/users",
  "requestParams": "{\"username\":\"newuser\",\"role\":\"operator\"}",
  "responseStatus": 200,
  "executionTime": 150,
  "message": "创建用户成功: newuser"
}
```

**响应**
```json
{
  "code": 200,
  "message": "日志记录成功",
  "data": null
}
```

**业务规则**
- 所有认证用户都可以记录日志
- 系统自动填充createdAt字段
- 重要操作(AUDIT类型)会触发告警
- 日志自动归档和清理

---

### 2.2 获取系统日志列表

**接口定义**
```
GET /api/mobile/system/logs?factoryId={factoryId}&logType={logType}&page={page}&size={size}
```

**功能描述**
分页获取系统日志列表，支持按工厂ID、日志类型筛选。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Query | 否 | 工厂ID |
| logType | String | Query | 否 | 日志类型 |
| page | Integer | Query | 否 | 页码，默认1 |
| size | Integer | Query | 否 | 每页大小，默认20 |

**响应数据结构**
```typescript
interface PageResponse<SystemLog> {
  items: SystemLog[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 12345,
        "factoryId": "CRETAS_2024_001",
        "logType": "ERROR",
        "logLevel": "ERROR",
        "module": "Processing",
        "action": "CREATE_BATCH",
        "userId": 10,
        "username": "operator01",
        "ipAddress": "192.168.1.100",
        "requestMethod": "POST",
        "requestUrl": "/api/mobile/CRETAS_2024_001/processing/batches",
        "responseStatus": 500,
        "errorMessage": "数据库连接超时",
        "executionTime": 5000,
        "message": "创建批次失败",
        "createdAt": "2025-01-20T10:30:00"
      }
    ],
    "total": 1000,
    "page": 1,
    "size": 20,
    "totalPages": 50,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**业务规则**
- 仅系统管理员可查看
- 按创建时间倒序排列
- 最多返回最近30天的日志
- 支持全文搜索(message字段)

---

### 2.3 获取API访问日志

**接口定义**
```
GET /api/mobile/system/api-logs?factoryId={factoryId}&page={page}&size={size}
```

**功能描述**
获取API访问日志，专门用于API调用监控和分析。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Query | 否 | 工厂ID |
| page | Integer | Query | 否 | 页码，默认1 |
| size | Integer | Query | 否 | 每页大小，默认20 |

**响应数据结构**
与系统日志列表相同，但仅返回API访问相关的日志。

**业务规则**
- 仅返回requestMethod不为空的日志
- 按响应时间降序排列慢请求
- 高亮显示错误请求(5xx)

---

### 2.4 清理过期日志

**接口定义**
```
POST /api/mobile/system/cleanup-logs?beforeDate={beforeDate}
```

**功能描述**
清理指定日期之前的日志记录，释放存储空间。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| beforeDate | LocalDate | Query | 是 | 清理此日期之前的日志(YYYY-MM-DD) |

**请求示例**
```
POST /api/mobile/system/cleanup-logs?beforeDate=2024-12-01
```

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": 150000  // 删除的日志条数
}
```

**业务规则**
- 仅系统管理员可执行
- 不能删除最近7天的日志
- AUDIT类型日志保留至少90天
- 删除前自动备份
- 建议定期执行(每月)

---

## 3. 系统配置

### 3.1 获取系统配置

**接口定义**
```
GET /api/mobile/system/configuration
```

**功能描述**
获取系统配置信息，包括应用配置、环境变量、特性开关等。

**请求参数**
无需参数

**响应数据结构**
```typescript
interface SystemConfiguration {
  // 应用配置
  application: {
    name: string;
    version: string;
    environment: string;        // dev/staging/production
    timezone: string;
    locale: string;
  };

  // 数据库配置
  database: {
    type: string;               // MySQL/PostgreSQL
    maxConnections: number;
    minConnections: number;
    connectionTimeout: number;
  };

  // 文件存储配置
  storage: {
    provider: string;           // local/s3/oss
    maxFileSize: number;        // MB
    allowedTypes: string[];
    uploadPath: string;
  };

  // JWT配置
  jwt: {
    accessTokenExpiry: number;  // 秒
    refreshTokenExpiry: number;
    algorithm: string;
  };

  // AI集成配置
  ai: {
    provider: string;           // DeepSeek
    model: string;
    maxTokens: number;
    quotaLimit: number;         // 月度配额
  };

  // 特性开关
  features: {
    [featureName: string]: {
      enabled: boolean;
      description: string;
      version: string;
    };
  };

  // 限流配置
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerHour: number;
  };

  // 日志配置
  logging: {
    level: string;              // DEBUG/INFO/WARN/ERROR
    retentionDays: number;
    maxFileSize: number;        // MB
  };
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "application": {
      "name": "Cretas Backend System",
      "version": "1.0.0",
      "environment": "production",
      "timezone": "Asia/Shanghai",
      "locale": "zh_CN"
    },
    "database": {
      "type": "MySQL",
      "maxConnections": 50,
      "minConnections": 10,
      "connectionTimeout": 30000
    },
    "storage": {
      "provider": "local",
      "maxFileSize": 10,
      "allowedTypes": ["jpg", "png", "pdf", "xlsx"],
      "uploadPath": "/uploads"
    },
    "jwt": {
      "accessTokenExpiry": 86400,
      "refreshTokenExpiry": 604800,
      "algorithm": "HS256"
    },
    "ai": {
      "provider": "DeepSeek",
      "model": "deepseek-chat",
      "maxTokens": 4000,
      "quotaLimit": 30
    },
    "features": {
      "ai_analysis": {
        "enabled": true,
        "description": "AI成本分析功能",
        "version": "1.0"
      },
      "biometric_auth": {
        "enabled": false,
        "description": "生物识别认证",
        "version": "2.0"
      }
    },
    "rateLimit": {
      "enabled": true,
      "requestsPerMinute": 60,
      "requestsPerHour": 1000
    },
    "logging": {
      "level": "INFO",
      "retentionDays": 30,
      "maxFileSize": 100
    }
  }
}
```

**业务规则**
- 仅系统管理员可访问
- 敏感信息(密钥等)已脱敏
- 配置更新需要重启应用
- 建议缓存配置数据

---

## 4. 数据库管理

### 4.1 获取数据库状态

**接口定义**
```
GET /api/mobile/system/database/status
```

**功能描述**
获取数据库连接和状态信息，用于监控数据库健康。

**请求参数**
无需参数

**响应数据结构**
```typescript
interface DatabaseStatus {
  // 连接池状态
  connectionPool: {
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    active: number;             // 活跃连接
    idle: number;               // 空闲连接
    waiting: number;            // 等待连接
    total: number;              // 总连接数
    max: number;                // 最大连接数
    min: number;                // 最小连接数
    usagePercent: number;       // 使用率
  };

  // 数据库信息
  database: {
    type: string;               // MySQL 8.0
    version: string;
    host: string;
    port: number;
    schema: string;
    charset: string;
    timezone: string;
  };

  // 性能指标
  performance: {
    uptime: number;             // 运行时长(秒)
    totalQueries: number;       // 总查询数
    qps: number;                // 每秒查询数
    avgQueryTime: number;       // 平均查询时间(ms)
    slowQueries: number;        // 慢查询数
    slowQueryThreshold: number; // 慢查询阈值(ms)
    cacheHitRate: number;       // 缓存命中率
  };

  // 存储统计
  storage: {
    totalSize: number;          // 总大小(GB)
    dataSize: number;           // 数据大小(GB)
    indexSize: number;          // 索引大小(GB)
    freeSpace: number;          // 可用空间(GB)
    largestTables: Array<{
      tableName: string;
      rows: number;
      dataSize: number;         // MB
      indexSize: number;
    }>;
  };

  // 连接信息
  connections: {
    current: number;            // 当前连接数
    max: number;                // 最大连接数
    maxUsed: number;            // 历史峰值
    aborted: number;            // 中断连接数
    byUser: Array<{
      user: string;
      count: number;
    }>;
  };

  // 锁信息
  locks: {
    tableLocks: number;
    rowLocks: number;
    deadlocks: number;
    waitingLocks: number;
  };

  // 主从复制(如果配置)
  replication?: {
    role: 'master' | 'slave';
    status: 'running' | 'stopped' | 'error';
    lag: number;                // 复制延迟(秒)
    slaveIORunning: boolean;
    slaveSQLRunning: boolean;
  };
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "connectionPool": {
      "status": "HEALTHY",
      "active": 5,
      "idle": 15,
      "waiting": 0,
      "total": 20,
      "max": 50,
      "min": 10,
      "usagePercent": 40.0
    },
    "database": {
      "type": "MySQL",
      "version": "8.0.28",
      "host": "localhost",
      "port": 3306,
      "schema": "cretas_db",
      "charset": "utf8mb4",
      "timezone": "Asia/Shanghai"
    },
    "performance": {
      "uptime": 864000,
      "totalQueries": 10000000,
      "qps": 120,
      "avgQueryTime": 25,
      "slowQueries": 150,
      "slowQueryThreshold": 1000,
      "cacheHitRate": 95.5
    },
    "storage": {
      "totalSize": 50.5,
      "dataSize": 40.2,
      "indexSize": 10.3,
      "freeSpace": 150.0,
      "largestTables": [
        {
          "tableName": "system_logs",
          "rows": 5000000,
          "dataSize": 2500,
          "indexSize": 500
        },
        {
          "tableName": "material_batches",
          "rows": 500000,
          "dataSize": 800,
          "indexSize": 200
        }
      ]
    },
    "connections": {
      "current": 20,
      "max": 151,
      "maxUsed": 45,
      "aborted": 10,
      "byUser": [
        {
          "user": "cretas_app",
          "count": 18
        },
        {
          "user": "cretas_admin",
          "count": 2
        }
      ]
    },
    "locks": {
      "tableLocks": 0,
      "rowLocks": 5,
      "deadlocks": 0,
      "waitingLocks": 0
    }
  }
}
```

**业务规则**
- 仅系统管理员可访问
- 数据每分钟更新
- 连接池告警阈值:
  - 使用率 > 80%: WARNING
  - 等待连接 > 5: WARNING
  - 慢查询 > 100/小时: WARNING
- 自动触发性能优化建议

---

## 前端集成指南

### API客户端封装

```typescript
// systemApiClient.ts
import { apiClient } from './apiClient';
import type {
  SystemHealth,
  SystemPerformance,
  SystemStatistics,
  SystemLog,
  SystemConfiguration,
  DatabaseStatus,
} from '../types/system';
import type { PageResponse, PageRequest } from '../types/common';

export const systemApiClient = {
  // 1. 系统健康与监控
  getHealth: async (): Promise<SystemHealth> => {
    return apiClient.get('/api/mobile/system/health');
  },

  getPerformance: async (): Promise<SystemPerformance> => {
    return apiClient.get('/api/mobile/system/performance');
  },

  getStatistics: async (factoryId?: string): Promise<SystemStatistics> => {
    return apiClient.get('/api/mobile/system/statistics', {
      params: factoryId ? { factoryId } : {},
    });
  },

  // 2. 日志管理
  createLog: async (log: SystemLog): Promise<void> => {
    return apiClient.post('/api/mobile/system/logs', log);
  },

  getLogs: async (
    factoryId?: string,
    logType?: string,
    page: number = 1,
    size: number = 20
  ): Promise<PageResponse<SystemLog>> => {
    return apiClient.get('/api/mobile/system/logs', {
      params: { factoryId, logType, page, size },
    });
  },

  getApiLogs: async (
    factoryId?: string,
    page: number = 1,
    size: number = 20
  ): Promise<PageResponse<SystemLog>> => {
    return apiClient.get('/api/mobile/system/api-logs', {
      params: { factoryId, page, size },
    });
  },

  cleanupLogs: async (beforeDate: string): Promise<number> => {
    return apiClient.post('/api/mobile/system/cleanup-logs', null, {
      params: { beforeDate },
    });
  },

  // 3. 系统配置
  getConfiguration: async (): Promise<SystemConfiguration> => {
    return apiClient.get('/api/mobile/system/configuration');
  },

  // 4. 数据库管理
  getDatabaseStatus: async (): Promise<DatabaseStatus> => {
    return apiClient.get('/api/mobile/system/database/status');
  },
};
```

### React Native使用示例

#### 1. 系统健康监控页面

```typescript
// SystemHealthScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Chip, ProgressBar } from 'react-native-paper';
import { systemApiClient } from '../services/api/systemApiClient';
import type { SystemHealth } from '../types/system';

export const SystemHealthScreen: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    try {
      const data = await systemApiClient.getHealth();
      setHealth(data);
    } catch (error) {
      console.error('加载系统健康状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UP': return '#4caf50';
      case 'DEGRADED': return '#ff9800';
      case 'DOWN': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 总体状态 */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Title>系统状态</Title>
            <Chip
              style={{ backgroundColor: getStatusColor(health?.status || 'UP') }}
              textStyle={{ color: '#fff' }}
            >
              {health?.status}
            </Chip>
          </View>
          <Paragraph>运行时长: {Math.floor((health?.application.uptime || 0) / 3600)}小时</Paragraph>
        </Card.Content>
      </Card>

      {/* 数据库 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>数据库</Title>
          <Paragraph>状态: {health?.database.status}</Paragraph>
          <Paragraph>
            连接池: {health?.database.connectionPool.active}/{health?.database.connectionPool.max}
          </Paragraph>
          <ProgressBar
            progress={(health?.database.connectionPool.active || 0) / (health?.database.connectionPool.max || 1)}
            color="#2196f3"
          />
        </Card.Content>
      </Card>

      {/* 内存 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>内存使用</Title>
          <Paragraph>
            {health?.memory.used}MB / {health?.memory.total}MB ({health?.memory.usagePercent.toFixed(1)}%)
          </Paragraph>
          <ProgressBar
            progress={(health?.memory.usagePercent || 0) / 100}
            color={(health?.memory.usagePercent || 0) > 80 ? '#f44336' : '#4caf50'}
          />
        </Card.Content>
      </Card>

      {/* 磁盘空间 */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>磁盘空间</Title>
          <Paragraph>
            已用 {health?.diskSpace.used}GB / {health?.diskSpace.total}GB ({health?.diskSpace.usagePercent.toFixed(1)}%)
          </Paragraph>
          <ProgressBar
            progress={(health?.diskSpace.usagePercent || 0) / 100}
            color={health?.diskSpace.status === 'OK' ? '#4caf50' : '#ff9800'}
          />
        </Card.Content>
      </Card>

      {/* 告警 */}
      {health?.alerts && health.alerts.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>系统告警</Title>
            {health.alerts.map((alert, index) => (
              <View key={index} style={styles.alert}>
                <Chip
                  style={{ backgroundColor: getSeverityColor(alert.severity) }}
                  textStyle={{ color: '#fff' }}
                >
                  {alert.severity}
                </Chip>
                <Paragraph>{alert.message}</Paragraph>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return '#d32f2f';
    case 'ERROR': return '#f44336';
    case 'WARNING': return '#ff9800';
    case 'INFO': return '#2196f3';
    default: return '#9e9e9e';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alert: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 4,
  },
});
```

#### 2. 日志查看器

```typescript
// SystemLogsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Chip, Searchbar } from 'react-native-paper';
import { systemApiClient } from '../services/api/systemApiClient';
import type { SystemLog } from '../types/system';

export const SystemLogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logType, setLogType] = useState<string>();

  const loadLogs = async (pageNum: number = 1) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await systemApiClient.getLogs(undefined, logType, pageNum, 20);
      setLogs(pageNum === 1 ? response.items : [...logs, ...response.items]);
      setPage(pageNum);
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [logType]);

  const renderLog = ({ item }: { item: SystemLog }) => (
    <Card style={styles.logCard}>
      <Card.Content>
        <View style={styles.logHeader}>
          <Chip
            style={{ backgroundColor: getLogLevelColor(item.logLevel) }}
            textStyle={{ color: '#fff' }}
          >
            {item.logLevel}
          </Chip>
          <Paragraph style={styles.time}>
            {new Date(item.createdAt).toLocaleString()}
          </Paragraph>
        </View>
        <Title style={styles.logModule}>{item.module} - {item.action}</Title>
        <Paragraph>{item.message}</Paragraph>
        {item.errorMessage && (
          <Paragraph style={styles.error}>{item.errorMessage}</Paragraph>
        )}
        <Paragraph style={styles.meta}>
          用户: {item.username} | IP: {item.ipAddress} | 耗时: {item.executionTime}ms
        </Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Chip
          selected={!logType}
          onPress={() => setLogType(undefined)}
          style={styles.filterChip}
        >
          全部
        </Chip>
        <Chip
          selected={logType === 'ERROR'}
          onPress={() => setLogType('ERROR')}
          style={styles.filterChip}
        >
          错误
        </Chip>
        <Chip
          selected={logType === 'WARNING'}
          onPress={() => setLogType('WARNING')}
          style={styles.filterChip}
        >
          警告
        </Chip>
        <Chip
          selected={logType === 'AUDIT'}
          onPress={() => setLogType('AUDIT')}
          style={styles.filterChip}
        >
          审计
        </Chip>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={() => loadLogs(page + 1)}
        onEndReachedThreshold={0.5}
        refreshing={loading}
        onRefresh={() => loadLogs(1)}
      />
    </View>
  );
};

const getLogLevelColor = (level: string) => {
  switch (level) {
    case 'FATAL': return '#d32f2f';
    case 'ERROR': return '#f44336';
    case 'WARN': return '#ff9800';
    case 'INFO': return '#2196f3';
    case 'DEBUG': return '#9e9e9e';
    default: return '#9e9e9e';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filters: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
  },
  filterChip: {
    marginRight: 8,
  },
  logCard: {
    margin: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: '#666',
  },
  logModule: {
    fontSize: 16,
    marginBottom: 4,
  },
  error: {
    color: '#f44336',
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});
```

---

## 业务规则

### 1. 访问权限
- `/health`: 公开端点，无需认证
- 其他端点: 仅系统管理员可访问
- 日志查询: 仅可查看本工厂的日志

### 2. 数据更新频率
- 健康检查: 30秒
- 性能监控: 1分钟
- 系统统计: 1小时
- 数据库状态: 1分钟

### 3. 告警规则
- CPU > 80%: WARNING
- Memory > 85%: WARNING
- Disk > 90%: CRITICAL
- 连接池使用率 > 80%: WARNING
- 慢查询 > 100/小时: WARNING
- 错误率 > 5%: WARNING

### 4. 日志管理
- 日志保留期: 30天(普通), 90天(AUDIT)
- 自动归档: 每日凌晨
- 日志清理: 手动触发
- 删除前备份: 必须

---

## 错误处理

### 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 4001 | 无权限访问 | 检查用户角色 |
| 4002 | 参数验证失败 | 检查请求参数 |
| 5001 | 系统服务异常 | 稍后重试或联系管理员 |
| 5002 | 数据库连接失败 | 检查数据库状态 |
| 5003 | 日志清理失败 | 检查权限和参数 |

### 错误处理示例

```typescript
try {
  const health = await systemApiClient.getHealth();
  if (health.status === 'DOWN') {
    Alert.alert('系统异常', '系统当前不可用，请稍后重试');
  }
} catch (error: any) {
  if (error.code === 5002) {
    Alert.alert('错误', '数据库连接失败，请联系技术支持');
  } else {
    Alert.alert('错误', error.message || '加载失败');
  }
}
```

---

## 总结

SystemController提供了**全面的系统管理与监控功能**，包含:

✅ **9个API端点**: 健康检查、日志管理、性能监控、配置管理、数据库监控
✅ **实时监控**: 系统状态、性能指标、数据库健康
✅ **日志管理**: 系统日志、API日志、审计日志
✅ **统计分析**: 用户活跃度、API调用量、数据增长
✅ **告警机制**: 自动检测异常并告警
✅ **运维支持**: 配置查询、日志清理、数据库监控

这套系统为运维团队提供了**完整的监控和管理工具**，保障系统稳定运行。
