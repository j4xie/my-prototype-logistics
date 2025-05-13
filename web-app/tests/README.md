# 测试目录使用指南

## 目录结构

```
tests/
├── e2e/                  # 端到端测试
│   ├── global-setup.js   # 全局测试设置
│   └── *.test.js         # 端到端测试用例
├── integration/          # 集成测试
│   ├── mock-server/      # 模拟服务器
│   │   ├── index.js      # 模拟服务器实现
│   │   ├── mockFetch.js  # Fetch请求模拟工具
│   │   └── static/       # 静态资源目录
│   └── *.test.js         # 集成测试用例
├── unit/                 # 单元测试
│   └── *.test.js         # 单元测试用例
├── utils/                # 测试工具
│   ├── fileMock.js       # 文件模拟
│   └── styleMock.js      # 样式模拟
├── setup.js              # 测试环境设置
├── run-all-tests.js      # 测试运行脚本
└── README.md             # 本文档
```

## 测试类型

### 单元测试 (Unit Tests)

单元测试位于 `tests/unit/` 目录，用于测试独立的代码单元（如函数、类、组件等）。

**运行命令：**
```
npm run test:unit
```

### 集成测试 (Integration Tests)

集成测试位于 `tests/integration/` 目录，用于测试多个组件之间的交互，以及API调用等。

**运行命令：**
```
npm run test:integration
```

### 端到端测试 (End-to-End Tests)

端到端测试位于 `tests/e2e/` 目录，使用Playwright模拟真实用户交互和浏览器行为。

**运行命令：**
```
npm run test:e2e
```

**运行交互式UI：**
```
npm run test:e2e:ui
```

### 运行所有测试

运行所有类型的测试：

```
npm run test:all
```

## 添加新测试

### 添加单元测试

1. 在 `tests/unit/` 目录创建一个新的测试文件，命名为 `<component-name>.test.js`
2. 导入要测试的模块
3. 使用Jest的API编写测试用例
4. 运行 `npm run test:unit` 验证测试

示例：
```javascript
// tests/unit/config-loader.test.js
const configLoader = require('../../src/utils/config-loader');

describe('配置加载器', () => {
  test('应该能够获取默认配置', () => {
    const config = configLoader.getConfig('app');
    expect(config).toBeDefined();
  });
});
```

### 添加集成测试

1. 在 `tests/integration/` 目录创建一个新的测试文件，命名为 `<feature-name>.test.js`
2. 导入相关模块和mock-server工具
3. 编写测试用例，测试多个组件之间的交互
4. 运行 `npm run test:integration` 验证测试

### 添加端到端测试

1. 在 `tests/e2e/` 目录创建一个新的测试文件，命名为 `<feature-name>.test.js`
2. 使用Playwright的API编写测试用例
3. 运行 `npm run test:e2e` 验证测试

## 测试工具

### Mock Server

集成测试中的模拟服务器位于 `tests/integration/mock-server/` 目录，用于模拟后端API响应。

使用方法：
```javascript
const mockFetch = require('./mock-server/mockFetch');
global.fetch = mockFetch;
```

### 测试助手

通用测试工具和助手函数位于 `tests/setup.js` 中，通过全局 `testHelpers` 对象访问。

使用示例：
```javascript
// 模拟fetch请求
testHelpers.mockFetch({ data: 'response' });

// 模拟LocalStorage
const mockStorage = testHelpers.mockLocalStorage();
```

## 最佳实践

1. **测试命名**：使用描述性名称，表明测试的功能和期望结果
2. **测试隔离**：每个测试应该独立运行，不依赖其他测试的状态
3. **使用前置/后置钩子**：使用 `beforeEach` 和 `afterEach` 设置和清理测试环境
4. **模拟外部依赖**：使用Jest的mock功能模拟外部API和服务
5. **测试覆盖率**：运行 `npm test` 会生成覆盖率报告，位于 `coverage/` 目录

## 常见问题

### 测试运行缓慢

- 使用 `--testPathPattern` 只运行特定测试文件
- 使用 `.only` 只运行特定测试用例，如 `test.only('should work', () => {...})`

### 测试失败

1. 检查错误消息，确定失败原因
2. 使用 `console.log` 或断点调试测试
3. 使用 `npm run test:e2e:ui` 可视化调试端到端测试

### 模拟复杂依赖

对于复杂的外部依赖，创建专用的模拟模块在 `tests/utils/` 目录中，然后在测试中导入使用。 