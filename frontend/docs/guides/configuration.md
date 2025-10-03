# 配置系统使用指南

<!-- updated for: 项目重构阶段一 - 配置文件整合 -->

## 1. 配置系统概述

食品溯源系统采用分层配置管理机制，具有以下特点：

- **分域配置**: 将配置按功能域分成多个小文件
- **环境特定配置**: 支持开发、测试、生产环境配置分离
- **统一访问接口**: 提供简单一致的配置访问方式
- **类型安全**: 使用JSDoc提供类型定义
- **文档化**: 所有配置项都有详细文档

## 2. 配置目录结构

配置文件按照以下结构组织：

```
web-app/
├── config/                    # 配置根目录
│   ├── default/               # 默认配置
│   │   ├── app.js             # 应用基本配置
│   │   ├── api.js             # API相关配置
│   │   ├── auth.js            # 认证相关配置
│   │   ├── ui.js              # UI相关配置
│   │   ├── features.js        # 功能特性配置
│   │   ├── storage.js         # 存储相关配置
│   │   ├── performance.js     # 性能相关配置
│   │   └── integration.js     # 第三方集成配置
│   ├── environments/          # 环境特定配置
│   │   ├── development.js     # 开发环境配置
│   │   ├── testing.js         # 测试环境配置
│   │   └── production.js      # 生产环境配置
│   ├── server/                # 服务器配置
│   │   ├── default.js         # 默认服务器配置
│   │   ├── development.js     # 开发环境服务器配置
│   │   ├── testing.js         # 测试环境服务器配置
│   │   └── production.js      # 生产环境服务器配置
│   ├── build/                 # 构建配置
│   │   ├── babel.config.js    # Babel配置
│   │   └── postcss.config.js  # PostCSS配置
│   ├── test/                  # 测试配置
│   │   ├── jest.config.js     # Jest主配置
│   │   ├── jest.setup.js      # Jest设置文件
│   │   └── test.config.js     # 通用测试配置
│   └── assets.js              # 资源管理配置
├── src/
│   └── utils/
│       └── config-loader.js   # 统一配置加载工具
```

## 3. 使用配置加载器

### 3.1 基本用法

```javascript
// 导入配置加载器
const configLoader = require('../src/utils/config-loader');

// 初始化（通常在应用启动时执行一次）
configLoader.init({
  environment: 'development', // 指定环境
  useLocalStorage: true,      // 是否使用本地存储
  storageKey: 'app_config'    // 本地存储键名
});

// 获取完整配置
const config = configLoader.getConfig();

// 获取特定域的配置
const apiConfig = configLoader.getDomain('api');

// 获取特定配置项（支持点分隔路径）
const apiEndpoint = configLoader.get('api.endpoint', '/api'); // 第二个参数是默认值

// 修改配置
configLoader.set('api.timeout', 60000);

// 重置配置
configLoader.reset(); // 重置所有配置
configLoader.reset('api'); // 重置特定域的配置
```

### 3.2 配置环境

配置加载器支持三种环境：

- **development**: 开发环境，启用调试特性
- **testing**: 测试环境，使用模拟数据
- **production**: 生产环境，关注性能和安全

可以通过以下方式切换环境：

```javascript
// 切换环境
configLoader.setEnvironment('production');

// 获取当前环境
const currentEnv = configLoader.getEnvironment();
```

### 3.3 配置导入/导出

```javascript
// 导出配置为JSON字符串
const configJson = configLoader.exportConfig();

// 导入配置
configLoader.importConfig(configJson);
```

## 4. 配置各个域的说明

### 4.1 应用基本配置 (app.js)

```javascript
const appConfig = configLoader.getDomain('app');
/*
{
  name: "食品溯源系统",  // 应用名称
  version: "1.0.0",     // 应用版本
  environment: "development", // 环境
  debugMode: true,      // 调试模式
  theme: "light",       // 主题
  language: "zh-CN"     // 默认语言
}
*/
```

### 4.2 API配置 (api.js)

```javascript
const apiConfig = configLoader.getDomain('api');
/*
{
  endpoint: "/api",     // API根端点
  version: "v1",        // API版本
  timeout: 30000,       // 请求超时(毫秒)
  retryAttempts: 3,     // 失败重试次数
  retryDelay: 1000,     // 重试延迟(毫秒)
  batchSize: 100,       // 批量请求大小
  useCache: true,       // 是否使用缓存
  cacheTime: 300        // 缓存时间(秒)
}
*/
```

### 4.3 认证配置 (auth.js)

```javascript
const authConfig = configLoader.getDomain('auth');
/*
{
  enabled: true,                  // 是否启用认证
  tokenStorage: "localStorage",   // 令牌存储方式
  tokenName: "trace_token",       // 令牌名称
  sessionTimeout: 1800,           // 会话超时(秒)
  refreshThreshold: 300,          // 刷新阈值(秒)
  loginUrl: "/auth/login.html",   // 登录页面
  logoutUrl: "/auth/logout",      // 登出接口
  authType: "jwt"                 // 认证类型
}
*/
```

## 5. 环境特定配置说明

环境特定配置文件只包含与默认配置不同的部分，在运行时会与默认配置合并。

### 5.1 开发环境配置示例

```javascript
// development.js
module.exports = {
  app: {
    environment: "development",
    debugMode: true
  },
  
  api: {
    timeout: 60000, // 更长的超时时间
    retryAttempts: 5 // 更多重试次数
  },
  
  // ... 其他与默认配置不同的部分
};
```

## 6. 配置系统实施建议

### 6.1 在项目中使用配置系统

1. **尽早初始化**: 在应用入口点初始化配置加载器
2. **统一访问**: 不直接引用配置文件，统一通过配置加载器访问
3. **避免硬编码**: 从配置中读取值，而不是硬编码
4. **使用默认值**: 使用 `get()` 方法的第二个参数提供默认值

### 6.2 扩展配置

添加新配置时：

1. 创建相应域的配置文件（如果是新域）
2. 定义类型信息（使用JSDoc）
3. 添加详细注释
4. 提供合理的默认值
5. 必要时更新环境特定配置

### 6.3 敏感信息处理

敏感信息（如API密钥、密码等）应：

1. 不要硬编码在配置文件中
2. 使用环境变量注入（APP_CONFIG_xxx）
3. 使用配置加载器的环境变量加载机制

## 7. 常见问题

### 为什么我的配置更改没有生效？

可能原因：
- 在初始化配置加载器之前调用了 `set()`
- 存在冲突的环境特定配置
- 没有调用正确的方法（例如，使用 `getDomain()` 返回的是副本）

### 如何在开发和生产环境使用不同配置？

使用环境特定配置文件：
1. 在 `environments/development.js` 中设置开发环境的特定值
2. 在 `environments/production.js` 中设置生产环境的特定值
3. 在应用启动时正确设置环境 