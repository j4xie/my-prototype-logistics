# 食品溯源系统测试指南

本目录包含食品溯源系统的测试脚本和相关配置文件。测试框架采用Jest和Playwright，支持单元测试、集成测试、端到端测试和安全测试。

## 测试目录结构

```
tests/
├── __mocks__/            # 模拟对象目录
├── e2e/                  # 端到端测试
│   ├── results/          # 测试结果存储
│   ├── test-data/        # 测试数据
│   └── *.test.js         # 测试文件
├── integration/          # 集成测试
│   └── *.test.js         # 测试文件
├── security/             # 安全测试
│   ├── reports/          # 安全测试报告
│   ├── screenshots/      # 测试截图
│   └── security-tests.js # 安全测试主文件
├── unit/                 # 单元测试
│   ├── auth/             # 认证模块测试
│   ├── data/             # 数据模块测试
│   ├── server/           # 服务器模块测试
│   ├── store/            # 存储模块测试
│   ├── trace/            # 溯源模块测试
│   ├── ui/               # UI模块测试
│   └── utils/            # 工具模块测试
├── run-all-tests.js      # 统一测试执行脚本(Node.js)
├── run-all-tests.bat     # 统一测试执行脚本(Windows批处理)
├── run-all-tests.ps1     # 统一测试执行脚本(PowerShell)
├── run-unit-tests.js     # 单元测试执行脚本
├── run-integration-tests.js # 集成测试执行脚本
├── run-security-tests.js # 安全测试执行脚本
└── setup.js              # 测试环境设置
```

## 运行测试

### 统一运行所有测试

在Windows系统上，您可以使用以下三种方式之一运行所有测试：

1. 使用Node.js脚本：

```bash
node tests/run-all-tests.js
```

2. 使用Windows批处理文件：

```bash
tests\run-all-tests.bat
```

3. 使用PowerShell脚本：

```powershell
.\tests\run-all-tests.ps1
```

### 运行特定类型的测试

如果您只想运行特定类型的测试，可以使用以下命令：

#### Node.js脚本

```bash
# 只运行单元测试
node tests/run-all-tests.js --unit-only

# 只运行集成测试
node tests/run-all-tests.js --integration-only

# 只运行端到端测试
node tests/run-all-tests.js --e2e-only

# 只运行安全测试
node tests/run-all-tests.js --security-only

# 排除某类测试
node tests/run-all-tests.js --no-e2e --no-security
```

#### Windows批处理文件

```bash
# 只运行单元测试
tests\run-all-tests.bat --unit-only

# 只运行集成测试
tests\run-all-tests.bat --integration-only

# 只运行端到端测试
tests\run-all-tests.bat --e2e-only

# 只运行安全测试
tests\run-all-tests.bat --security-only
```

#### PowerShell脚本

```powershell
# 只运行单元测试
.\tests\run-all-tests.ps1 -UnitOnly

# 只运行集成测试
.\tests\run-all-tests.ps1 -IntegrationOnly

# 只运行端到端测试
.\tests\run-all-tests.ps1 -E2EOnly

# 只运行安全测试
.\tests\run-all-tests.ps1 -SecurityOnly

# 排除某类测试
.\tests\run-all-tests.ps1 -NoE2E -NoSecurity
```

### 直接运行单个测试文件

如果您想直接运行特定的测试文件，可以使用以下命令：

```bash
# 运行单个单元测试文件
npx jest tests/unit/trace/record-query.test.js

# 使用详细输出模式
npx jest tests/unit/trace/record-query.test.js --verbose

# 运行端到端测试
npx playwright test tests/e2e/trace.test.js
```

## 常见问题解决

### 解决Windows上的命令串联问题

在Windows PowerShell上运行命令时，请使用分号(`;`)而不是&&来串联命令：

```powershell
# 正确的方式
cd C:\path\to\project; npx jest tests/unit/trace/record-query.test.js

# 错误的方式（在PowerShell中会出错）
cd C:\path\to\project && npx jest tests/unit/trace/record-query.test.js
```

### 运行测试时出现环境问题

如果您在运行测试时遇到环境相关的问题，可以尝试运行修复脚本：

```bash
node tests/fix-loader-timeout.js
```

### 测试覆盖率报告

测试执行后，覆盖率报告会生成在`coverage/`目录下。您可以通过浏览器打开`coverage/lcov-report/index.html`查看详细报告。

## 编写新的测试

在编写新的测试时，请遵循以下规范：

1. 测试文件命名为`*.test.js`
2. 将测试文件放在对应的测试类型目录下
3. 为测试添加适当的描述和注释
4. 尽量保持测试的独立性
5. 使用`beforeEach`和`afterEach`进行测试环境的设置和清理

## 测试环境设置

如果您需要修改测试环境设置，请编辑`setup.js`文件。该文件包含Jest的全局设置，如模拟对象、环境变量等。

## 更多信息

关于测试框架的更多信息，请参考：

- [Jest文档](https://jestjs.io/docs/getting-started)
- [Playwright文档](https://playwright.dev/docs/intro) 