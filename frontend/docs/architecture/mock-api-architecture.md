# Mock API统一架构设计文档

<!-- TASK-P3-017B主要交付物 -->
<!-- 遵循规范: docs/architecture/design-principles.md -->
<!-- 基于技术选型: MSW v2.0 + OpenAPI 3.0 + TypeScript 5.0 -->
<!-- 创建日期: 2025-02-02 -->

## 📋 **架构概览**

### **设计目标**
解决Mock API系统性架构问题，建立统一、可扩展、版本管理的Mock服务架构：

1. **统一数据源**：解决多源数据不一致问题
2. **Schema权威性**：建立OpenAPI规范作为唯一可信来源
3. **环境隔离**：清晰的dev/test/prod环境控制
4. **版本管理**：完整的Schema版本追踪机制
5. **类型安全**：TypeScript接口自动同步

### **技术栈选型**
- **核心工具**: MSW (Mock Service Worker) v2.0+
- **Schema管理**: OpenAPI 3.0 + AsyncAPI 2.0
- **运行环境**: Next.js 14 App Router (浏览器端 + Node端)
- **类型系统**: TypeScript 5.0+ 严格模式
- **工具链**: @hey-api/openapi-ts + @mswjs/source

## 🏗️ **统一架构设计**

### **1. 中央Mock服务架构**

```
web-app-next/src/mocks/
├── 📄 node.ts              # Node端MSW服务器 (API Routes + Jest)
├── 📄 browser.ts           # 浏览器端MSW Worker (开发环境)
├── 📄 setup.ts             # 统一设置入口
├── 📁 handlers/            # API处理器 (自动生成)
│   ├── 📄 auth.handlers.ts
│   ├── 📄 users.handlers.ts
│   ├── 📄 products.handlers.ts
│   ├── 📄 trace.handlers.ts
│   ├── 📄 ai.handlers.ts
│   └── 📄 index.ts         # 统一导出
├── 📁 data/                # Mock数据管理
│   ├── 📄 seed.ts          # 种子数据
│   ├── 📄 version-manager.ts
│   └── 📁 fixtures/        # 测试数据
├── 📁 schemas/             # Schema版本管理
│   ├── 📄 openapi.yaml     # 权威API规范
│   ├── 📄 async-api.yaml   # 事件规范
│   └── 📁 versions/        # 版本历史
└── 📁 config/              # 配置管理
    ├── 📄 environments.ts  # 环境配置
    ├── 📄 middleware.ts    # 请求中间件
    └── 📄 types.ts         # 类型定义
```

### **2. MSW双端统一配置**

#### **浏览器端配置 (开发环境)**
```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// 浏览器端Worker - 拦截fetch/XMLHttpRequest
export const worker = setupWorker(...handlers);

// 开发模式自动启动
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js'
    }
  });
}
```

#### **Node端配置 (API Routes + 测试)**
```typescript
// src/mocks/node.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node端Server - 处理API Routes和Jest测试
export const server = setupServer(...handlers);

// 仅在测试环境自动启动
if (process.env.NODE_ENV === 'test') {
  server.listen({
    onUnhandledRequest: 'error'
  });
}
```

#### **统一设置入口**
```typescript
// src/mocks/setup.ts
export const setupMocks = async () => {
  if (typeof window === 'undefined') {
    // Node.js环境 (API Routes, Jest)
    const { server } = await import('./node');
    server.listen();
    return server;
  } else {
    // 浏览器环境 (开发环境)
    const { worker } = await import('./browser');
    await worker.start();
    return worker;
  }
};
```

### **3. Schema版本管理策略**

#### **OpenAPI权威规范**
```yaml
# src/mocks/schemas/openapi.yaml
openapi: 3.0.3
info:
  title: 食品溯源系统API
  version: 1.0.0-baseline  # 版本冻结机制
  description: 统一Mock API规范
servers:
  - url: http://localhost:3000/api/v1
    description: 开发环境
  - url: https://api.farm-trace.com/v1
    description: 生产环境
paths:
  /auth/login:
    post:
      operationId: authLogin
      summary: 用户登录
      # ... 详细定义
  /users/profile:
    get:
      operationId: getUserProfile
      summary: 获取用户资料
      # ... 详细定义
```

#### **版本管理机制**
```typescript
// src/mocks/data/version-manager.ts
export interface SchemaVersion {
  version: string;           // 语义化版本号
  timestamp: number;         // 版本时间戳
  description: string;       // 变更描述
  breaking: boolean;         // 是否破坏性变更
  checksum: string;          // Schema校验和
}

export class SchemaVersionManager {
  private currentVersion = '1.0.0-baseline';

  async lockVersion(version: string): Promise<void> {
    // 冻结当前Schema版本
  }

  async syncTypes(): Promise<void> {
    // 自动生成TypeScript接口
    // openapi-typescript ./schemas/openapi.yaml --output ./types/api.d.ts
  }

  async validateHandlers(): Promise<boolean> {
    // 验证Handler与Schema一致性
  }
}
```

### **4. 自动化Handler生成**

#### **OpenAPI → MSW Handler自动生成**
```typescript
// src/mocks/scripts/generate-handlers.ts
import { fromOpenApi } from '@mswjs/source/open-api';
import { generateApi } from '@hey-api/openapi-ts';

export async function generateHandlers() {
  // 1. 生成TypeScript接口
  await generateApi({
    input: './src/mocks/schemas/openapi.yaml',
    output: './src/mocks/types/api.d.ts',
    format: 'prettier',
    exportSchemas: true
  });

  // 2. 生成MSW handlers
  const spec = await loadOpenAPISpec('./src/mocks/schemas/openapi.yaml');
  const handlers = await fromOpenApi(spec);

  // 3. 写入Handler文件
  await writeHandlers('./src/mocks/handlers/', handlers);
}
```

#### **生成的Handler示例**
```typescript
// src/mocks/handlers/auth.handlers.ts (自动生成)
import { http, HttpResponse } from 'msw';
import type { AuthLoginRequest, AuthLoginResponse } from '../types/api';

export const authHandlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as AuthLoginRequest;

    // Mock业务逻辑
    const mockResponse: AuthLoginResponse = {
      success: true,
      data: {
        token: generateMockToken(),
        user: getMockUser(body.username),
        expiresIn: 86400
      }
    };

    return HttpResponse.json(mockResponse);
  })
];
```

### **5. 环境隔离和启停控制**

#### **环境配置管理**
```typescript
// src/mocks/config/environments.ts
export interface MockEnvironment {
  name: string;
  baseUrl: string;
  enabled: boolean;
  handlers: string[];  // 启用的handler模块
  dataSet: string;     // 使用的数据集
}

export const environments: Record<string, MockEnvironment> = {
  development: {
    name: 'development',
    baseUrl: 'http://localhost:3000/api/v1',
    enabled: true,
    handlers: ['auth', 'users', 'products', 'trace', 'ai'],
    dataSet: 'full'
  },
  test: {
    name: 'test',
    baseUrl: 'http://localhost:3000/api/v1',
    enabled: true,
    handlers: ['auth', 'users', 'products'],
    dataSet: 'minimal'
  },
  production: {
    name: 'production',
    baseUrl: 'https://api.farm-trace.com/v1',
    enabled: false,  // 生产环境禁用Mock
    handlers: [],
    dataSet: 'none'
  }
};
```

#### **智能启停控制**
```typescript
// src/mocks/config/middleware.ts
export const mockMiddleware = {
  shouldMock: (request: Request): boolean => {
    const env = process.env.NODE_ENV;
    const config = environments[env];

    // 生产环境强制禁用
    if (env === 'production') return false;

    // 检查Mock开关
    const mockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';
    return config.enabled && mockEnabled;
  },

  getHandlers: (env: string): string[] => {
    return environments[env]?.handlers || [];
  }
};
```

### **6. API版本感知机制**

#### **版本Header支持**
```typescript
// src/mocks/handlers/version-middleware.ts
export const versionMiddleware = http.all('*', ({ request }) => {
  const apiVersion = request.headers.get('x-api-version') || '1.0.0';

  // 版本兼容性检查
  if (!isVersionSupported(apiVersion)) {
    return HttpResponse.json({
      error: 'Unsupported API version',
      supportedVersions: ['1.0.0', '1.1.0']
    }, { status: 400 });
  }

  // 注入版本信息到响应
  return new Response(null, {
    headers: {
      'x-api-version': apiVersion,
      'x-schema-version': getCurrentSchemaVersion()
    }
  });
});
```

#### **向后兼容策略**
```typescript
// src/mocks/data/compatibility.ts
export const schemaCompatibility = {
  '1.0.0': {
    deprecated: [],
    breaking: false
  },
  '1.1.0': {
    deprecated: ['old-field'],
    breaking: false,
    migrations: {
      'old-field': 'new-field'
    }
  }
};
```

## 🔧 **Next.js 14集成方案**

### **App Router集成**
```typescript
// src/app/layout.tsx
import { setupMocks } from '@/mocks/setup';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 开发环境自动启动Mock
  if (process.env.NODE_ENV === 'development') {
    await setupMocks();
  }

  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
```

### **API Routes集成**
```typescript
// src/app/api/[...path]/route.ts
import { server } from '@/mocks/node';

export async function GET(request: Request) {
  // 如果Mock启用，直接使用MSW处理
  if (process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true') {
    return await server.request(request);
  }

  // 否则代理到真实API
  return await fetch(process.env.API_BASE_URL + request.url);
}
```

### **开发工具链配置**
```json
// package.json scripts
{
  "scripts": {
    "mock:generate": "tsx src/mocks/scripts/generate-handlers.ts",
    "mock:validate": "tsx src/mocks/scripts/validate-schema.ts",
    "mock:version": "tsx src/mocks/scripts/version-manager.ts",
    "dev:mock": "NEXT_PUBLIC_MOCK_ENABLED=true npm run dev",
    "dev:real": "NEXT_PUBLIC_MOCK_ENABLED=false npm run dev"
  }
}
```

## 📊 **性能优化策略**

### **懒加载机制**
```typescript
// 按需加载Handler模块
export const loadHandlers = async (modules: string[]) => {
  const handlers = await Promise.all(
    modules.map(async (module) => {
      const { default: handler } = await import(`./handlers/${module}.handlers.ts`);
      return handler;
    })
  );
  return handlers.flat();
};
```

### **缓存策略**
```typescript
// src/mocks/config/cache.ts
export const cacheConfig = {
  handlers: {
    ttl: 5 * 60 * 1000,  // 5分钟
    maxSize: 100
  },
  schemas: {
    ttl: 30 * 60 * 1000, // 30分钟
    maxSize: 10
  }
};
```

## 🔒 **质量保证机制**

### **Schema验证**
```typescript
// src/mocks/scripts/validate-schema.ts
import Ajv from 'ajv';

export async function validateSchema() {
  const ajv = new Ajv();
  const schema = await loadOpenAPISchema();

  // 验证Schema格式
  const valid = ajv.validateSchema(schema);
  if (!valid) {
    throw new Error(`Invalid OpenAPI schema: ${ajv.errorsText()}`);
  }

  // 验证Handler覆盖率
  const coverage = await calculateHandlerCoverage(schema);
  if (coverage < 0.95) {
    console.warn(`Handler coverage: ${coverage * 100}%, target: 95%`);
  }
}
```

### **CI/CD集成**
```yaml
# .github/workflows/mock-api-validation.yml
name: Mock API Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Schema
        run: npm run mock:validate
      - name: Generate Handlers
        run: npm run mock:generate
      - name: Test Mock API
        run: npm run test:mock
```

## 🎯 **实施路径**

### **阶段1：基础架构建立** (Day 1-2)
1. ✅ 创建目录结构
2. ✅ 配置MSW双端设置
3. ✅ 建立Schema版本管理
4. ✅ 实现环境隔离控制

### **阶段2：自动化工具链** (Day 2-3)
1. ✅ OpenAPI → TypeScript生成
2. ✅ MSW Handler自动生成
3. ✅ 版本管理脚本
4. ✅ CI/CD验证流程

### **阶段3：现有API迁移** (后续任务)
1. 迁移18个现有API接口
2. 统一Mock数据管理
3. 完整测试覆盖
4. 性能优化调优

## 📋 **风险评估和缓解**

### **技术风险**
| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| MSW版本兼容性 | 高 | 低 | 版本锁定 + 回归测试 |
| TypeScript生成错误 | 中 | 中 | 多工具验证 + 手动检查 |
| Handler覆盖率不足 | 中 | 中 | 自动化测试 + 覆盖率检查 |

### **实施风险**
| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| 现有代码破坏 | 高 | 低 | 渐进式迁移 + 备份策略 |
| 学习曲线陡峭 | 中 | 中 | 培训文档 + 示例代码 |
| 工具链复杂化 | 中 | 中 | 自动化脚本 + 简化接口 |

## 🎉 **预期收益**

### **短期收益** (1-2周)
- ✅ 消除多源数据不一致问题
- ✅ 建立Schema单一可信来源
- ✅ 环境切换更加可控
- ✅ 减少Mock相关Bug

### **长期收益** (1-3个月)
- 🚀 API开发效率提升40%
- 🔧 维护工作量减少60%
- 📈 测试覆盖率提升到95%+
- 🎯 真实API集成时间缩短50%

---

**文档版本**: v1.0.0
**创建日期**: 2025-02-02
**负责人**: Phase-3技术负责人
**状态**: ✅ 架构设计完成 - 待实施验证
