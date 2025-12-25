---
name: code-review
description: 审查代码质量、性能、安全性和设计模式。检查项目特定的反模式（降级处理、错误处理、类型安全）。使用此 Skill 来审查 PR、优化代码、或检查 TypeScript 类型安全性。
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# 代码审查 Skill

根据 Cretas 项目的代码质量标准进行代码审查。

## 审查检查清单

### 1. 错误处理 (Error Handling)

**检查项**:
- [ ] 所有 try-catch 使用具体错误类型（不是 `any`）
- [ ] 错误有明确的用户提示（不只是 console.log）
- [ ] 关键操作失败时通知用户
- [ ] 没有空的 catch 块
- [ ] Promise.allSettled 仅用于非关键数据，失败有提示

```typescript
// 禁止：错误被吞掉
try {
  const data = await api.getData();
  return data;
} catch (error) {
  console.error('加载失败:', error);
  return { data: 0 };  // 返回假数据
}

// 正确：明确显示错误状态
try {
  const data = await api.getData();
  setData(data);
  setError(null);
} catch (error) {
  setError({ message: '加载失败，请稍后重试', canRetry: true });
  setData(null);
}
```

### 2. 数据验证 (Data Validation)

**检查项**:
- [ ] 没有 `as any` 类型断言（或有充分理由并注释）
- [ ] 使用 `??` 而非 `||` 作为默认值
- [ ] 可选链不超过 2 层
- [ ] API 响应有运行时验证
- [ ] TypeScript strict 模式通过

```typescript
// 禁止：误判合法的 0、false、''
const count = data?.items?.length || 0;

// 正确：只有 null/undefined 才用默认值
const count = data?.items?.length ?? 0;
```

### 3. 降级处理 (Degradation)

**检查项**:
- [ ] 降级时有用户通知（Alert/Toast）
- [ ] 没有 SecureStore 静默降级到 AsyncStorage
- [ ] Promise.allSettled 失败有用户提示
- [ ] 区分开发/生产环境（Mock 数据）

```typescript
// 禁止：静默降级
try {
  await SecureStore.setItemAsync('token', token);
} catch (error) {
  await AsyncStorage.setItem('token', token);  // 用户不知道安全性降低
}

// 正确：不降级，直接抛错
try {
  await SecureStore.setItemAsync('token', token);
} catch (error) {
  throw new SecurityError('SecureStore 不可用，无法安全存储令牌');
}
```

### 4. 配置管理 (Configuration)

**检查项**:
- [ ] 没有硬编码的超时/重试次数
- [ ] 没有硬编码的 GPS 坐标/URL
- [ ] 角色判断使用枚举而非字符串
- [ ] 没有魔法数字（使用常量）

```typescript
// 禁止：魔法数字
setTimeout(() => retry(), 3000);
axios.get(url, { timeout: 30000 });

// 正确：使用配置常量
import { TIMEOUTS, RETRY_CONFIG } from '@/config/constants';
setTimeout(() => retry(), RETRY_CONFIG.BASE_DELAY);
axios.get(url, { timeout: TIMEOUTS.DEFAULT_API });
```

### 5. TODO 和未实现功能

**检查项**:
- [ ] 生产代码没有 TODO/FIXME/HACK
- [ ] 未实现功能抛出 NotImplementedError
- [ ] Mock 数据仅在开发环境
- [ ] TODO 关联 Issue 编号

```typescript
// 禁止：TODO 堆积
async authenticate(): Promise<boolean> {
  // TODO: 未来实现生物识别
  return false;
}

// 正确：明确抛出错误
async authenticate(): Promise<boolean> {
  throw new NotImplementedError(
    '生物识别功能尚未实现',
    'BIOMETRIC_AUTH',
    { plannedPhase: 'Phase 4-5' }
  );
}
```

### 6. 返回值和状态处理

**检查项**:
- [ ] 不返回 null 掩盖错误原因
- [ ] 使用 Result 类型或抛出错误
- [ ] 函数返回类型明确

```typescript
// 禁止：返回 null 掩盖原因
function getUserId(): number | null {
  if (!user) return null;
  if (isNaN(userId)) return null;
  return userId;
}

// 正确：使用 Result 类型
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function getUserId(): Result<number, 'NO_USER' | 'INVALID_ID'> {
  if (!user) return { ok: false, error: 'NO_USER' };
  if (isNaN(userId)) return { ok: false, error: 'INVALID_ID' };
  return { ok: true, value: userId };
}
```

### 7. 安全性 (Security)

**检查项**:
- [ ] 敏感数据使用 SecureStore
- [ ] Token 不存储在 AsyncStorage
- [ ] 降级时有安全警告
- [ ] 不记录敏感信息到日志

## 自动化检查命令

### TypeScript 严格模式检查

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
npx tsc --noEmit --skipLibCheck
```

### ESLint 检查

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace
npm run lint
```

### 查找反模式

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 查找 as any 类型断言
grep -r "as any" src/ --include="*.ts" --include="*.tsx" | head -20

# 查找空 catch 块
grep -r "catch.*{" src/ --include="*.ts" --include="*.tsx" | grep -v "error"

# 查找 TODO/FIXME 注释
grep -r "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" | head -20

# 查找硬编码超时
grep -r "setTimeout.*[0-9]\{4,\}" src/ --include="*.ts" --include="*.tsx"

# 查找 || 默认值（可能误判）
grep -r "\|\| 0\|\| ''\|\| false" src/ --include="*.ts" --include="*.tsx" | head -20

# 查找 AsyncStorage 存储 token
grep -r "AsyncStorage.*token\|token.*AsyncStorage" src/ --include="*.ts" --include="*.tsx"
```

### 深度代码分析

```bash
# 统计代码行数
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1

# 查找大文件（可能需要拆分）
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -10

# 查找复杂函数（行数 > 50）
awk '/^(export )?(async )?function|^const .* = (async )?\(/' src/**/*.ts | head -20
```

## 项目特定规则

### 禁止使用的 API 客户端

根据 `.eslintrc.js` 配置：

| 禁止使用 | 应该使用 |
|----------|----------|
| `attendanceApiClient` | `timeclockApiClient` |
| `employeeApiClient` | `userApiClient` |
| `enhancedApiClient` | `apiClient` |
| `materialApiClient` | `materialQuickApiClient` |

### TypeScript 配置要求

参见 `tsconfig.json`：
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true`

## 参考文档

- 完整规范: `CLAUDE.md` 中的 "禁止的开发模式" 章节
- ESLint 规则: `.eslintrc.js`
- TypeScript 配置: `tsconfig.json`
- Jest 配置: `jest.config.js` (70% 覆盖率要求)
