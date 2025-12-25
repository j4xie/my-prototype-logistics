# JWT Token 处理规范

## 概述

统一 JWT Token 的生成、存储、刷新和验证规则。

**最后更新**: 2025-12-25
**适用范围**: Spring Boot 后端 + React Native 前端

---

## Rule 1: Token 类型与用途

### 四种 Token 类型

| Token 类型 | 有效期 | 用途 | 存储位置 |
|-----------|--------|------|---------|
| `accessToken` | 24小时 | API 请求认证 | SecureStore |
| `refreshToken` | 7天 | 刷新 accessToken | SecureStore |
| `tempToken` | 5分钟 | 注册流程临时验证 | 内存 |
| `deviceToken` | 永久 | 设备绑定标识 | SecureStore |

### Token 结构 (JWT Payload)

```json
// accessToken payload
{
  "sub": "user_id",
  "role": "factory_super_admin",
  "factoryId": "F001",
  "userId": 22,
  "username": "factory_admin1",
  "iat": 1735000000,
  "exp": 1735086400
}
```

---

## Rule 2: 后端 Token 生成

### 标准生成模式

```java
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;  // 24小时

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;  // 7天

    public String generateAccessToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        claims.put("factoryId", user.getFactoryId());
        claims.put("userId", user.getId());
        claims.put("username", user.getUsername());

        return Jwts.builder()
            .setClaims(claims)
            .setSubject(user.getUsername())
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + accessTokenExpiration))
            .signWith(SignatureAlgorithm.HS256, secret)
            .compact();
    }
}
```

---

## Rule 3: 前端 Token 存储

### 安全存储 (SecureStore)

```typescript
// ✅ GOOD: 使用 SecureStore 存储敏感 Token
import * as SecureStore from 'expo-secure-store';

class TokenStorage {
  private static readonly ACCESS_TOKEN_KEY = 'access_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';

  static async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(this.ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  static async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(this.ACCESS_TOKEN_KEY);
  }

  static async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(this.ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(this.REFRESH_TOKEN_KEY);
  }
}
```

### 禁止的存储方式

```typescript
// ❌ BAD: 使用 AsyncStorage 存储 Token
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('access_token', token);  // 不安全！

// ❌ BAD: 存储在全局变量
global.accessToken = token;  // 不持久！

// ❌ BAD: 静默降级到 AsyncStorage
try {
  await SecureStore.setItemAsync('token', token);
} catch {
  await AsyncStorage.setItem('token', token);  // 禁止！
}
```

---

## Rule 4: Token 刷新机制

### 自动刷新拦截器

```typescript
// apiClient.ts
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // 刷新 Token
        const response = await axios.post('/api/mobile/auth/refresh', {
          refreshToken
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        await TokenStorage.saveTokens(accessToken, newRefreshToken);

        // 重试原请求
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);

      } catch (refreshError) {
        // 刷新失败，清除 Token 并跳转登录
        await TokenStorage.clearTokens();
        navigateToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Rule 5: Token 验证

### 后端验证中间件

```java
@Component
public class JwtAuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                            Object handler) throws Exception {
        String token = extractToken(request);

        if (token == null) {
            response.setStatus(401);
            response.getWriter().write("{\"success\":false,\"message\":\"未授权\"}");
            return false;
        }

        try {
            Claims claims = jwtService.validateToken(token);
            request.setAttribute("userId", claims.get("userId"));
            request.setAttribute("role", claims.get("role"));
            request.setAttribute("factoryId", claims.get("factoryId"));
            return true;
        } catch (ExpiredJwtException e) {
            response.setStatus(401);
            response.getWriter().write("{\"success\":false,\"message\":\"Token已过期\",\"code\":\"TOKEN_EXPIRED\"}");
            return false;
        }
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

---

## Rule 6: 安全注意事项

### 必须遵守

1. **HTTPS**: 生产环境必须使用 HTTPS
2. **Secret 管理**: JWT Secret 必须在环境变量中配置，禁止硬编码
3. **Token 过期**: accessToken 过期时间不超过 24 小时
4. **刷新限制**: refreshToken 只能使用一次
5. **登出清理**: 用户登出时必须清除所有 Token

### 配置示例

```properties
# application.properties
jwt.secret=${JWT_SECRET}
jwt.access-token-expiration=86400000   # 24小时
jwt.refresh-token-expiration=604800000 # 7天
```

---

## 常见问题

### Q: Token 过期后页面卡住？

A: 确保 401 拦截器正确配置，并有 `navigateToLogin()` 逻辑

### Q: 刷新 Token 时重复请求？

A: 使用请求队列，确保同时只有一个刷新请求：

```typescript
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
```

---

## 相关文件

- `backend/.../config/JwtAuthInterceptor.java` - JWT 验证拦截器
- `backend/.../utils/JwtUtil.java` - JWT 工具类
- `frontend/.../services/auth/authService.ts` - 认证服务
- `frontend/.../store/authStore.ts` - 认证状态管理
