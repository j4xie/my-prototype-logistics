# TypeScript 类型安全规范

## 概述

减少 `as any` 使用，提高代码类型安全性。

**最后更新**: 2025-12-25
**触发原因**: 发现 226+ 处 `as any` 类型断言

---

## Rule 1: 禁止滥用 `as any`

### 统计现状

当前项目存在 **226+ 处** `as any` 使用，主要分布在：
- 屏幕组件 (Screens): ~150 处
- API 客户端 (Services): ~50 处
- 工具函数 (Utils): ~26 处

### 禁止的场景

```typescript
// ❌ BAD: 绕过类型检查
const data = response as any;
const value = (item as any).someProperty;

// ❌ BAD: 错误类型使用 any
catch (error: any) {
  console.log(error.message);
}

// ❌ BAD: 函数参数使用 any
function process(data: any) {
  return data.value;
}
```

### 允许的例外（必须注释说明）

```typescript
// ✅ ACCEPTABLE: 第三方库类型不完整
// @ts-expect-error - react-native-paper 类型定义缺失 onDismiss
const theme = useTheme() as any;

// ✅ ACCEPTABLE: 明确知道类型但TS无法推断
// Type assertion needed: API returns mixed types
const items = response.data as unknown as ItemType[];
```

---

## Rule 2: 正确的类型断言方式

### 使用 `unknown` 替代 `any`

```typescript
// ❌ BAD
function parseData(input: any) {
  return input.value;
}

// ✅ GOOD
function parseData(input: unknown): number {
  if (typeof input === 'object' && input !== null && 'value' in input) {
    return (input as { value: number }).value;
  }
  throw new Error('Invalid input format');
}
```

### 使用类型守卫

```typescript
// ✅ GOOD: 类型守卫函数
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

function isApiResponse<T>(obj: unknown): obj is ApiResponse<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    'data' in obj
  );
}

// 使用
const response = await fetch('/api/data');
const json = await response.json();

if (isApiResponse<User[]>(json)) {
  // json.data 类型安全为 User[]
  setUsers(json.data);
}
```

---

## Rule 3: 错误处理类型

### 标准错误处理模式

```typescript
import { isAxiosError, AxiosError } from 'axios';

// ✅ GOOD: 类型安全的错误处理
try {
  await apiCall();
} catch (error) {
  if (isAxiosError(error)) {
    // error 类型为 AxiosError
    const status = error.response?.status;
    const message = error.response?.data?.message ?? '请求失败';
    handleHttpError(status, message);
  } else if (error instanceof Error) {
    // 标准 Error
    handleGenericError(error.message);
  } else {
    // 完全未知的错误
    handleUnknownError(String(error));
  }
}
```

### 自定义错误类型

```typescript
// errors/ApiError.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 使用
if (error instanceof ApiError) {
  if (error.code === 'AUTH_EXPIRED') {
    redirectToLogin();
  }
}
```

---

## Rule 4: 组件 Props 类型

### 明确定义 Props 接口

```typescript
// ❌ BAD
const MyComponent = (props: any) => { ... };

// ✅ GOOD
interface MyComponentProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onPress, disabled = false }) => {
  ...
};
```

### 导航参数类型

```typescript
// ❌ BAD
const route = useRoute<any>();
const params = route.params as any;

// ✅ GOOD
type BatchDetailParams = {
  batchId: string;
  factoryId: string;
};

const route = useRoute<RouteProp<ProcessingStackParamList, 'BatchDetail'>>();
const { batchId, factoryId } = route.params;
```

---

## Rule 5: API 响应类型

### 定义明确的响应类型

```typescript
// types/api.ts
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface MaterialBatch {
  id: string;
  batchNumber: string;
  materialTypeId: string;
  quantity: number;
  status: 'available' | 'reserved' | 'depleted';
  createdAt: string;
}

// 使用
const response = await api.get<PaginatedResponse<MaterialBatch>>('/batches');
// response.data.content 类型安全为 MaterialBatch[]
```

---

## 减少 `as any` 的行动计划

### 优先级

1. **高优先级**: API 响应处理 (~50处)
   - 创建统一的响应类型
   - 使用泛型 API Client

2. **中优先级**: 错误处理 (~36处)
   - 使用 `isAxiosError` 和类型守卫
   - 创建自定义错误类

3. **低优先级**: 第三方库兼容 (~20处)
   - 添加 `@ts-expect-error` 注释说明
   - 提 PR 完善类型定义

### 检查命令

```bash
# 统计 as any 使用
grep -r "as any" src/ | wc -l

# 找出最多使用 as any 的文件
grep -rc "as any" src/ | sort -t: -k2 -nr | head -20
```

---

## 相关文件

- `frontend/.../types/index.ts` - 全局类型定义
- `frontend/.../types/apiResponses.ts` - API 响应类型
- `frontend/.../types/navigation.ts` - 导航参数类型
- `tsconfig.json` - TypeScript 配置
