# API限速器

这个模块提供了完整的API请求限速解决方案，用于防止API滥用和保护服务器资源。

## 功能特点

- **令牌桶算法**：使用高效的令牌桶算法进行限速
- **灵活配置**：支持自定义最大请求数、时间窗口和令牌恢复速率
- **多端点支持**：可以为不同的API端点设置不同的限速规则
- **身份识别**：基于用户ID、IP地址等身份标识符进行限速
- **节流函数**：限制函数在指定时间内最多执行一次
- **防抖函数**：延迟函数执行，直到停止调用一段时间后才执行

## 使用示例

### 服务器端限速

```javascript
const { limitApiRequest } = require('./api-rate-limiter');
const express = require('express');
const app = express();

// 添加限速中间件
app.use('/api', (req, res, next) => {
  const identifier = req.user ? req.user.id : req.ip;
  const endpoint = req.path;
  
  const options = {
    maxRequests: 60,           // 每分钟最多60个请求
    timeWindowMs: 60000,       // 1分钟窗口
    tokensPerInterval: 1,      // 每秒恢复1个令牌
    intervalMs: 1000           // 恢复间隔1秒
  };
  
  const result = limitApiRequest(endpoint, identifier, options);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: '请求频率过高，请稍后再试',
      retryAfter: Math.ceil(result.resetTime / 1000)
    });
  }
  
  next();
});
```

### 前端节流和防抖

```javascript
const { throttle, debounce } = require('./api-rate-limiter');

// 使用节流防止按钮频繁点击
const saveButton = document.getElementById('save-button');
const throttledSave = throttle(() => {
  saveData();
}, 2000);

saveButton.addEventListener('click', throttledSave);

// 使用防抖优化搜索输入
const searchInput = document.getElementById('search-input');
const debouncedSearch = debounce((event) => {
  searchApi(event.target.value);
}, 500);

searchInput.addEventListener('input', debouncedSearch);
```

## API参考

### RateLimiter

令牌桶算法实现的限速器类。

```javascript
const limiter = new RateLimiter({
  maxRequests: 100,          // 令牌桶容量
  timeWindowMs: 60000,       // 时间窗口（毫秒）
  tokensPerInterval: 5,      // 每个间隔添加的令牌数
  intervalMs: 1000           // 添加令牌的时间间隔（毫秒）
});
```

#### 方法

- `checkAndConsume()`: 检查是否允许请求并消耗一个令牌
- `addTokens(count)`: 手动添加令牌到桶中
- `stopPeriodicRefill()`: 停止定期添加令牌的定时器

### limitApiRequest

限制API请求，使用令牌桶算法。

```javascript
const result = limitApiRequest(endpoint, identifier, options);
```

#### 参数

- `endpoint`: API端点标识符
- `identifier`: 请求方标识符（如用户ID或IP地址）
- `options`: 限速配置选项（同RateLimiter构造函数）

#### 返回值

```javascript
{
  allowed: true,       // 请求是否被允许
  remaining: 59,       // 剩余令牌数
  limit: 60,           // 最大令牌数
  resetTime: 0         // 重置时间（毫秒）
}
```

### throttle

限制函数在一定时间内最多执行一次。

```javascript
const throttled = throttle(func, wait, options);
```

#### 参数

- `func`: 要节流的函数
- `wait`: 等待时间（毫秒）
- `options`: 配置选项
  - `leading`: 是否在等待开始前调用（默认为true）
  - `trailing`: 是否在等待结束后调用（默认为true）

### debounce

延迟函数执行，如果指定时间内再次调用则重新计时。

```javascript
const debounced = debounce(func, wait, options);
```

#### 参数

- `func`: 要防抖的函数
- `wait`: 等待时间（毫秒）
- `options`: 配置选项
  - `leading`: 是否在等待开始前调用（默认为false）
  - `trailing`: 是否在等待结束后调用（默认为true）
  - `maxWait`: 最大等待时间（毫秒）

### clearAllLimiters

清除所有限速器。

```javascript
clearAllLimiters();
```

## 性能注意事项

- 为了保持良好的性能，不活跃的限速器会在30分钟后自动清理
- 对于高流量的应用，建议根据实际需求调整最大请求数和时间窗口
- 在使用节流和防抖函数时，请选择合适的等待时间，避免影响用户体验

## 集成示例

查看 `api-rate-limiter-integration.js` 文件获取更多集成示例：

- 基于Express的服务器端中间件
- 根据不同API端点设置不同限速规则
- 前端API客户端与限速器集成
- 处理限速响应和重试逻辑 