# 配置文件整合 - 结构设计

<!-- updated for: 项目重构阶段一 - 配置文件整合 -->

## 1. 配置目录结构

根据分析结果，我们设计了统一的配置目录结构如下：

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

## 2. 配置类型和职责

### 2.1 默认配置 (default/)

默认配置分为多个领域特定的模块，每个模块负责一类配置：

- **app.js**: 应用基本信息（名称、版本、环境）
- **api.js**: API端点、超时、重试策略等
- **auth.js**: 认证方式、令牌处理、会话管理
- **ui.js**: 主题、布局、交互效果等
- **features.js**: 功能开关和特性配置
- **storage.js**: 本地存储、缓存、离线数据等
- **performance.js**: 性能监控、采样率、日志级别
- **integration.js**: 第三方服务集成配置

### 2.2 环境配置 (environments/)

环境配置文件只包含与特定环境不同的配置，继承默认配置：

- **development.js**: 开发环境特有设置（调试模式、扩展超时等）
- **testing.js**: 测试环境特有设置（测试API、模拟数据等）
- **production.js**: 生产环境特有设置（优化性能、严格安全等）

### 2.3 服务器配置 (server/)

服务器配置包含本地开发服务器和API服务器的配置：

- **default.js**: 默认服务器设置
- **development.js**: 开发服务器特定设置
- **testing.js**: 测试服务器特定设置
- **production.js**: 生产服务器特定设置

### 2.4 构建和测试配置

- **build/**: 构建工具配置
- **test/**: 测试框架配置

## 3. 配置加载机制

我们将实现统一的配置加载机制，满足以下需求：

1. **环境检测**: 自动检测当前运行环境
2. **配置合并**: 默认配置与环境配置的深度合并
3. **运行时覆盖**: 支持运行时动态覆盖配置
4. **敏感信息处理**: 环境变量优先加载敏感信息
5. **类型检查**: 配置值的类型和格式验证
6. **本地持久化**: 可选的本地存储用户配置
7. **访问API**: 统一的配置获取接口

### 3.1 配置加载器设计

`src/utils/config-loader.js` 将提供以下功能：

```javascript
// 配置加载器API
const configLoader = {
  /**
   * 初始化配置加载器
   * @param {Object} options - 初始化选项
   * @returns {Object} - 配置加载器实例
   */
  init(options = {}) {...},
  
  /**
   * 获取完整配置
   * @returns {Object} - 完整的配置对象
   */
  getConfig() {...},
  
  /**
   * 获取特定域的配置
   * @param {string} domain - 配置域（如'app', 'api'等）
   * @returns {Object} - 特定域的配置
   */
  getDomain(domain) {...},
  
  /**
   * 获取特定配置项
   * @param {string} path - 配置路径（点分隔，如'api.endpoint'）
   * @param {*} defaultValue - 未找到时的默认值
   * @returns {*} - 配置值
   */
  get(path, defaultValue) {...},
  
  /**
   * 覆盖配置值
   * @param {string} path - 配置路径
   * @param {*} value - 新值
   * @returns {boolean} - 是否成功
   */
  set(path, value) {...},
  
  /**
   * 重置配置到默认值
   * @param {string} [domain] - 可选的配置域
   */
  reset(domain) {...},
  
  /**
   * 保存用户配置到本地存储
   */
  saveToStorage() {...},
  
  /**
   * 从本地存储加载用户配置
   */
  loadFromStorage() {...}
};
```

## 4. 配置迁移策略

迁移将分三个阶段进行：

### 4.1 准备阶段

1. 创建新的配置目录结构
2. 开发配置加载器
3. 准备文档模板

### 4.2 迁移阶段

1. 将现有配置按照领域分类提取到新结构
2. 消除重复配置，建立单一真相来源
3. 分离环境特定配置
4. 处理敏感信息

### 4.3 切换阶段

1. 更新引用旧配置的代码
2. 使用适配器保持向后兼容
3. 测试新配置系统
4. 移除不再使用的配置

## 5. 配置文档标准

每个配置文件将使用以下标准进行文档化：

```javascript
/**
 * @module config/default/api
 * @description API配置项
 */

/**
 * API默认配置
 * @typedef {Object} ApiConfig
 * @property {string} endpoint - API根端点
 * @property {string} version - API版本
 * @property {number} timeout - 请求超时(毫秒)
 * @property {number} retryAttempts - 失败重试次数
 * @property {number} retryDelay - 重试延迟(毫秒)
 * @property {boolean} useCache - 是否使用响应缓存
 */

/**
 * API默认配置
 * @type {ApiConfig}
 */
module.exports = {
  endpoint: "/api",
  version: "v1",
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  useCache: true
};
```

每个配置项应包含：

1. 详细注释说明用途
2. 类型定义和可能的值范围
3. 与其他配置的关系或依赖
4. 默认值及其理由 