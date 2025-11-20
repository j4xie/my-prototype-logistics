# API Client 开发标准

**版本**: v1.0
**发布日期**: 2025-11-19
**适用范围**: 所有新创建和修改的API Client
**强制执行**: 通过ESLint规则和Code Review

---

## 📋 目录

1. [命名规范](#命名规范)
2. [文件结构标准](#文件结构标准)
3. [TypeScript类型定义](#typescript类型定义)
4. [文档标准](#文档标准)
5. [代码模板](#代码模板)
6. [Code Review清单](#code-review清单)
7. [最佳实践](#最佳实践)

---

## 命名规范

### 文件命名

**格式**: `xxxApiClient.ts`
- 使用camelCase
- 必须以`ApiClient.ts`结尾
- 单词清晰、有意义

**✅ 正确示例**:
```
timeclockApiClient.ts
userApiClient.ts
processingApiClient.ts
materialBatchApiClient.ts
materialQuickApiClient.ts  # 使用后缀明确职责
```

**❌ 错误示例**:
```
api.ts                    # 太宽泛
apiClient.ts              # 不明确
materialApiClient.ts      # 不够明确（已重命名为materialQuickApiClient）
enhancedApiClient.ts      # 不明确功能
customApi.ts              # 缺少ApiClient后缀
```

---

### 类命名

**格式**: `XxxApiClient`
- 使用PascalCase
- 与文件名对应
- 必须以`ApiClient`结尾

**示例**:
```typescript
// 文件: timeclockApiClient.ts
export class TimeclockApiClient {
  // ...
}
```

---

### 实例命名

**格式**: `xxxApiClient`
- 使用camelCase
- 与类名对应
- 必须以`ApiClient`结尾

**强制导出单例**:
```typescript
// ✅ 正确 - 导出单例实例
export const timeclockApiClient = new TimeclockApiClient();
export default timeclockApiClient;

// ❌ 错误 - 直接导出类
export class TimeclockApiClient { ... }
export default TimeclockApiClient;
```

---

## 文件结构标准

### 标准模板

每个API Client文件必须包含以下结构（按顺序）:

```typescript
// 1. 文件头部注释（JSDoc）
/**
 * XXX管理API客户端
 *
 * 职责: [一句话描述职责]
 * 使用场景: [主要使用场景]
 * 用户角色: [目标用户角色]
 *
 * 总计X个API - 路径：/api/mobile/{factoryId}/xxx/*
 */

// 2. 导入语句
import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

// 3. TypeScript类型定义
export interface XxxType {
  id: string | number;
  // ...
}

export interface XxxParams {
  // ...
}

export interface XxxResponse {
  // ...
}

// 4. API Client类定义
class XxxApiClient {
  // 4.1 私有方法（如path生成）
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/xxx`;
  }

  // 4.2 公共API方法（按CRUD顺序）
  // Create
  async create(data: XxxParams, factoryId?: string): Promise<XxxResponse> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // Read
  async getList(params?: any, factoryId?: string): Promise<XxxType[]> {
    return await apiClient.get(this.getPath(factoryId), { params });
  }

  async getById(id: string, factoryId?: string): Promise<XxxType> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // Update
  async update(id: string, data: XxxParams, factoryId?: string): Promise<XxxResponse> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // Delete
  async delete(id: string, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 4.3 业务方法（按功能分组，添加注释）
  // 导出功能
  async export(params?: any, factoryId?: string): Promise<Blob> {
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params,
      responseType: 'blob'
    });
  }

  // 导入功能
  async import(file: File, factoryId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post(`${this.getPath(factoryId)}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}

// 5. 导出单例
export const xxxApiClient = new XxxApiClient();
export default xxxApiClient;
```

---

## TypeScript类型定义

### 基本要求

1. **所有API方法必须有类型定义**
2. **禁止使用`any`** - 使用`unknown`或具体类型
3. **参数类型优先使用interface**
4. **响应类型必须定义**

### 类型定义模板

```typescript
// 实体类型
export interface XxxEntity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // 使用可选标记
  description?: string;
  // 使用联合类型
  status: 'active' | 'inactive' | 'pending';
}

// 请求参数类型
export interface XxxCreateParams {
  name: string;
  description?: string;
  // 使用嵌套类型
  config?: {
    enabled: boolean;
    value: number;
  };
}

export interface XxxUpdateParams extends Partial<XxxCreateParams> {
  id: string;
}

// 查询参数类型
export interface XxxQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 响应类型
export interface XxxResponse {
  success: boolean;
  data: XxxEntity;
  message?: string;
}

export interface XxxListResponse {
  success: boolean;
  data: XxxEntity[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

### 类型命名规范

| 用途 | 命名格式 | 示例 |
|------|---------|------|
| 实体 | `XxxEntity` 或 `Xxx` | `User`, `ProcessingBatch` |
| 创建参数 | `XxxCreateParams` | `UserCreateParams` |
| 更新参数 | `XxxUpdateParams` | `UserUpdateParams` |
| 查询参数 | `XxxQueryParams` | `UserQueryParams` |
| 响应 | `XxxResponse` | `UserResponse` |
| 列表响应 | `XxxListResponse` | `UserListResponse` |

---

## 文档标准

### 类级文档（必须）

```typescript
/**
 * XXX管理API客户端
 *
 * 职责: [一句话描述]
 * 使用场景: [主要使用场景]
 * 用户角色: [目标用户]
 *
 * 与其他API的关系:
 * - xxxApiClient: [关系说明]
 * - yyyApiClient: [关系说明]
 *
 * 总计X个API - 路径：/api/mobile/{factoryId}/xxx/*
 *
 * @example
 * ```typescript
 * import { xxxApiClient } from './xxxApiClient';
 *
 * // 查询列表
 * const list = await xxxApiClient.getList({ page: 1 });
 *
 * // 创建记录
 * const result = await xxxApiClient.create({ name: 'Test' });
 * ```
 */
```

### 方法级文档（复杂方法必须）

```typescript
/**
 * 批量导入XXX数据
 *
 * @param file - Excel文件（.xlsx或.csv格式）
 * @param factoryId - 工厂ID（可选，默认使用DEFAULT_FACTORY_ID）
 * @returns 导入结果，包含成功数、失败数和错误详情
 *
 * @throws {Error} 文件格式错误
 * @throws {Error} 数据验证失败
 *
 * @example
 * ```typescript
 * const file = new File([...], 'data.xlsx');
 * const result = await xxxApiClient.import(file, 'F001');
 * console.log(`成功: ${result.successCount}, 失败: ${result.failureCount}`);
 * ```
 */
async import(file: File, factoryId?: string): Promise<ImportResult> {
  // ...
}
```

### 废弃标记（必须）

当需要废弃API Client或方法时:

```typescript
/**
 * @deprecated 此方法已废弃 (废弃日期: YYYY-MM-DD)
 *
 * ⚠️ 请使用 newMethod 替代
 *
 * 替代方案:
 * ```typescript
 * // 旧代码:
 * await oldMethod(params);
 *
 * // 新代码:
 * await newMethod(params);
 * ```
 *
 * 废弃原因:
 * - [原因1]
 * - [原因2]
 *
 * 删除计划: Phase X
 */
async oldMethod(params: any): Promise<any> {
  console.warn('[xxxApiClient.oldMethod] 此方法已废弃，请使用 newMethod()');
  // ...
}
```

---

## 代码模板

### 完整模板文件

创建新API Client时，复制以下模板:

```typescript
/**
 * [模块名]管理API客户端
 *
 * 职责: [一句话描述职责]
 * 使用场景: [Screen名称]
 * 用户角色: [角色名称]
 *
 * 总计[X]个API - 路径：/api/mobile/{factoryId}/[path]/*
 */

import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

// ==========================================
// TypeScript类型定义
// ==========================================

export interface [EntityName] {
  id: string | number;
  // TODO: 添加字段
}

export interface [EntityName]CreateParams {
  // TODO: 添加字段
}

export interface [EntityName]UpdateParams extends Partial<[EntityName]CreateParams> {
  id: string | number;
}

export interface [EntityName]QueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

// ==========================================
// API Client类
// ==========================================

class [ModuleName]ApiClient {
  /**
   * 生成API路径
   */
  private getPath(factoryId?: string): string {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/[path]`;
  }

  // ==========================================
  // CRUD操作
  // ==========================================

  /**
   * 创建[实体]
   */
  async create(data: [EntityName]CreateParams, factoryId?: string): Promise<[EntityName]> {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  /**
   * 查询[实体]列表
   */
  async getList(params?: [EntityName]QueryParams, factoryId?: string): Promise<[EntityName][]> {
    return await apiClient.get(this.getPath(factoryId), { params });
  }

  /**
   * 根据ID查询[实体]
   */
  async getById(id: string | number, factoryId?: string): Promise<[EntityName]> {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 更新[实体]
   */
  async update(id: string | number, data: [EntityName]UpdateParams, factoryId?: string): Promise<[EntityName]> {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  /**
   * 删除[实体]
   */
  async delete(id: string | number, factoryId?: string): Promise<void> {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // ==========================================
  // 业务方法
  // ==========================================

  // TODO: 添加业务方法
}

// ==========================================
// 导出单例
// ==========================================

export const [moduleName]ApiClient = new [ModuleName]ApiClient();
export default [moduleName]ApiClient;
```

---

## Code Review清单

### PR提交者自查清单

提交API Client相关PR前，必须确认:

**命名规范** (5项):
- [ ] 文件名符合`xxxApiClient.ts`格式
- [ ] 类名符合`XxxApiClient`格式
- [ ] 实例名符合`xxxApiClient`格式
- [ ] 导出的是单例实例，不是类
- [ ] TypeScript类型命名符合规范

**文档完整性** (6项):
- [ ] 类级JSDoc文档完整
- [ ] 复杂方法有方法级文档
- [ ] 包含使用示例
- [ ] 说明了与其他API Client的关系
- [ ] 已更新API_CLIENT_INDEX.md
- [ ] 如有废弃，添加了@deprecated标记

**类型定义** (5项):
- [ ] 所有方法参数有类型定义
- [ ] 所有方法返回值有类型定义
- [ ] 没有使用`any`类型（除非绝对必要）
- [ ] interface导出为public
- [ ] 复杂类型使用了嵌套或联合类型

**代码质量** (6项):
- [ ] 通过TypeScript编译
- [ ] 通过ESLint检查
- [ ] 方法按CRUD顺序组织
- [ ] 私有方法使用`private`关键字
- [ ] 有完整的错误处理
- [ ] 至少被1个Screen使用

**后端对接** (4项):
- [ ] API路径与后端一致
- [ ] HTTP方法正确（GET/POST/PUT/DELETE）
- [ ] 请求参数格式与后端匹配
- [ ] 响应格式与后端匹配

---

### Reviewer检查清单

Code Review时，必须检查:

**架构设计** (5项):
- [ ] 职责单一，不与现有API Client重复
- [ ] 命名明确，能体现职责
- [ ] 在三层架构中位置正确（如Material系列）
- [ ] 没有过度设计
- [ ] 符合项目整体架构

**代码规范** (5项):
- [ ] 符合命名规范
- [ ] 符合文件结构标准
- [ ] TypeScript类型定义完整
- [ ] 文档完整清晰
- [ ] ESLint检查通过

**功能完整性** (4项):
- [ ] 实现了所有必要的API方法
- [ ] 错误处理完整
- [ ] 与后端API路径一致
- [ ] 有实际使用场景

**文档同步** (3项):
- [ ] API_CLIENT_INDEX.md已更新
- [ ] 如有冲突，参考了API_CONFLICT_RESOLUTION_SOP.md
- [ ] 如有职责混淆，参考了相关职责说明文档

---

## 最佳实践

### 1. 使用统一的apiClient实例

**✅ 推荐**:
```typescript
import { apiClient } from './apiClient';

class XxxApiClient {
  async getList() {
    return await apiClient.get('/path');
  }
}
```

**❌ 不推荐**:
```typescript
import axios from 'axios';

class XxxApiClient {
  async getList() {
    // 不要直接使用axios或创建新实例
    return await axios.get('http://localhost:3001/path');
  }
}
```

---

### 2. 使用factoryId参数

**✅ 推荐**:
```typescript
async getList(params?: QueryParams, factoryId?: string): Promise<Result[]> {
  const fId = factoryId || DEFAULT_FACTORY_ID;
  return await apiClient.get(`/api/mobile/${fId}/xxx`, { params });
}
```

**❌ 不推荐**:
```typescript
async getList(params?: QueryParams): Promise<Result[]> {
  // 硬编码factoryId
  return await apiClient.get('/api/mobile/F001/xxx', { params });
}
```

---

### 3. 正确处理错误

**✅ 推荐**:
```typescript
async create(data: CreateParams, factoryId?: string): Promise<Result> {
  try {
    return await apiClient.post(this.getPath(factoryId), data);
  } catch (error) {
    console.error('[xxxApiClient.create] 创建失败:', error);
    throw error; // 重新抛出，让调用方处理
  }
}
```

**❌ 不推荐**:
```typescript
async create(data: CreateParams): Promise<Result> {
  // 不处理错误，也不记录日志
  return await apiClient.post('/path', data);
}
```

---

### 4. 使用明确的返回类型

**✅ 推荐**:
```typescript
async getList(): Promise<User[]> {
  const response = await apiClient.get<User[]>('/users');
  return response; // 类型明确
}
```

**❌ 不推荐**:
```typescript
async getList(): Promise<any> {  // any类型
  return await apiClient.get('/users');
}
```

---

### 5. 合理组织方法顺序

**推荐顺序**:
1. 私有方法（如getPath）
2. CRUD方法（Create → Read → Update → Delete）
3. 业务方法（按功能分组）
4. 工具方法（导入、导出等）

```typescript
class XxxApiClient {
  // 1. 私有方法
  private getPath() { ... }

  // 2. CRUD
  async create() { ... }
  async getList() { ... }
  async getById() { ... }
  async update() { ... }
  async delete() { ... }

  // 3. 业务方法
  async activate() { ... }
  async deactivate() { ... }

  // 4. 工具方法
  async export() { ... }
  async import() { ... }
}
```

---

### 6. 避免过度设计

**✅ 简洁实用**:
```typescript
class XxxApiClient {
  async getList(params?: QueryParams): Promise<Result[]> {
    return await apiClient.get(this.getPath(), { params });
  }
}
```

**❌ 过度设计**:
```typescript
class XxxApiClient {
  private cache: Map<string, any>;
  private requestQueue: Array<any>;
  private retryConfig: RetryConfig;

  // 734行复杂代码...
  // 但从未被使用（enhancedApiClient的教训）
}
```

---

## 📚 参考文档

- [API_CLIENT_INDEX.md](./API_CLIENT_INDEX.md) - API Client索引
- [API_CONFLICT_RESOLUTION_SOP.md](./API_CONFLICT_RESOLUTION_SOP.md) - 冲突处理流程
- [TIMESTATS_VS_TIMECLOCK.md](./TIMESTATS_VS_TIMECLOCK.md) - 职责边界示例
- [ESLINT_SETUP_GUIDE.md](../../ESLINT_SETUP_GUIDE.md) - ESLint配置

---

## 🔄 标准更新

**版本历史**:
- v1.0 (2025-11-19): 初始版本

**更新流程**:
1. 提出修改建议（通过Issue或PR）
2. 团队讨论并达成共识
3. 更新文档版本号
4. 通知所有开发者

---

**最后更新**: 2025-11-19
**维护者**: 前端技术负责人
**强制执行**: 通过ESLint + Code Review
