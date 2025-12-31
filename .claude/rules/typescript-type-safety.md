# TypeScript 类型安全规范

## 禁止滥用 `as any`

```typescript
// ❌ BAD
const data = response as any;
catch (error: any) { ... }
function process(data: any) { ... }

// ✅ GOOD - 使用类型守卫
function isApiResponse<T>(obj: unknown): obj is ApiResponse<T> {
  return typeof obj === 'object' && obj !== null && 'success' in obj;
}
```

**例外**（必须注释）:
```typescript
// @ts-expect-error - 第三方库类型不完整
const theme = useTheme() as any;
```

---

## 错误处理

```typescript
import { isAxiosError } from 'axios';

catch (error) {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) handleAuthExpired();
    else Alert.alert('请求失败', error.response?.data?.message);
  } else if (error instanceof Error) {
    Alert.alert('错误', error.message);
  }
}
```

---

## 组件 Props

```typescript
// ❌ BAD
const MyComponent = (props: any) => { ... };

// ✅ GOOD
interface Props {
  title: string;
  onPress: () => void;
}
const MyComponent: React.FC<Props> = ({ title, onPress }) => { ... };
```

---

## 导航参数

```typescript
// ❌ BAD
const route = useRoute<any>();

// ✅ GOOD
const route = useRoute<RouteProp<StackParamList, 'Detail'>>();
const { id } = route.params;
```

