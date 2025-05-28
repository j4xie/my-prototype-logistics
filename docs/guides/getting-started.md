# 快速开始指南

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

本文档提供食品溯源系统的快速开始指南，包括环境设置、项目安装和启动步骤。

## 1. 开发环境要求

开始开发前，请确保您的环境满足以下要求：

### 1.1 必要软件

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | 14.x 或更高 | JavaScript运行环境 |
| npm/yarn/pnpm | 最新版本 | 包管理器 |
| Git | 最新版本 | 版本控制系统 |

### 1.2 推荐工具

| 工具 | 用途 |
|------|------|
| Visual Studio Code | 代码编辑器，推荐使用的IDE |
| Chrome/Edge | 推荐用于开发和调试的浏览器 |
| Postman | API测试工具 |
| React Developer Tools | React调试扩展 |
| Redux DevTools | Redux状态管理调试扩展（如使用Redux） |

### 1.3 环境检查

运行以下命令以检查您的环境配置：

```bash
# 检查Node.js版本
node -v

# 检查npm版本
npm -v
# 或检查yarn版本
yarn -v
# 或检查pnpm版本
pnpm -v

# 检查Git版本
git --version
```

## 2. 获取项目代码

### 2.1 克隆仓库

```bash
# 使用HTTPS克隆
git clone https://github.com/yourusername/food-traceability-system.git

# 或使用SSH克隆
git clone git@github.com:yourusername/food-traceability-system.git

# 进入项目目录
cd food-traceability-system
```

### 2.2 分支说明

| 分支 | 说明 |
|------|------|
| main | 主分支，包含稳定版本代码 |
| develop | 开发分支，包含最新开发功能 |
| feature/* | 功能分支，用于开发新功能 |
| bugfix/* | 修复分支，用于修复bug |
| release/* | 发布分支，用于准备新版本发布 |

对于新手开发者，建议从develop分支开始：

```bash
git checkout develop
```

## 3. 安装依赖

本项目支持npm、yarn和pnpm包管理器，选择一种方式安装依赖：

### 3.1 使用npm

```bash
# 安装项目依赖
npm install
```

### 3.2 使用yarn

```bash
# 安装项目依赖
yarn
```

### 3.3 使用pnpm

```bash
# 安装项目依赖
pnpm install
```

### 3.4 处理可能的依赖问题

如果安装过程中遇到问题，可以尝试以下步骤：

1. 清除缓存后重新安装：
   ```bash
   npm cache clean --force
   npm install
   ```

2. 检查Node.js版本兼容性：
   ```bash
   # 如果使用nvm
   nvm use 14
   ```

3. 使用--legacy-peer-deps参数（针对npm 7+）：
   ```bash
   npm install --legacy-peer-deps
   ```

## 4. 环境配置

### 4.1 创建环境配置文件

项目使用`.env`文件管理环境变量。复制示例文件并根据需要修改：

```bash
# 复制环境变量示例文件
cp .env.example .env
```

### 4.2 常用环境变量

编辑`.env`文件，设置以下常用环境变量：

```
# 应用环境
NODE_ENV=development

# 服务器配置
PORT=3000
HOST=localhost

# API配置
API_URL=http://localhost:8080/api
API_TIMEOUT=10000

# 特性开关
FEATURE_OFFLINE_MODE=true
FEATURE_DATA_ANALYTICS=true
```

## 5. 启动开发服务器

### 5.1 启动命令

选择一种方式启动开发服务器：

```bash
# 使用npm
npm run start

# 使用yarn
yarn start

# 使用pnpm
pnpm start
```

服务器通常会启动在http://localhost:3000，浏览器会自动打开项目页面。

### 5.2 开发模式特性

开发模式提供以下特性：
- 热重载：修改代码后自动刷新
- 源码映射：方便调试
- 开发服务器代理：处理跨域请求
- 错误覆盖层：显示编译和运行时错误

### 5.3 常见启动问题排查

1. **端口被占用**：
   ```bash
   # 查找占用3000端口的进程
   # Windows
   netstat -ano | findstr :3000
   # Linux/macOS
   lsof -i :3000
   ```

2. **依赖问题**：
   ```bash
   # 重新安装依赖
   rm -rf node_modules
   npm install
   ```

3. **环境变量问题**：
   确保环境变量文件`.env`配置正确。

## 6. 项目目录结构

了解项目目录结构有助于更快上手开发：

```
.
├── web-app/                   # Web应用主目录
│   ├── src/                   # 源代码目录
│   │   ├── components/        # 组件目录
│   │   ├── pages/             # 页面组件
│   │   ├── hooks/             # 自定义Hooks
│   │   ├── utils/             # 工具函数
│   │   ├── services/          # API服务
│   │   ├── store/             # 状态管理
│   │   ├── styles/            # 全局样式
│   │   └── types/             # 类型定义
│   ├── public/                # 静态资源
│   ├── tests/                 # 测试文件
│   └── config/                # 配置文件
├── docs/                      # 项目文档
├── scripts/                   # 工具脚本
└── ...                        # 其他配置文件
```

完整的目录结构和说明请参考 [目录结构文档](../../DIRECTORY_STRUCTURE.md)。

## 7. 运行测试

### 7.1 运行所有测试

```bash
# 使用npm
npm test

# 使用yarn
yarn test

# 使用pnpm
pnpm test
```

### 7.2 运行特定测试

```bash
# 运行特定文件的测试
npm test -- src/components/Button.test.js

# 运行匹配特定模式的测试
npm test -- --testPathPattern=Button
```

### 7.3 测试覆盖率报告

```bash
# 生成测试覆盖率报告
npm test -- --coverage
```

覆盖率报告生成在`web-app/coverage/`目录下。

## 8. 构建生产版本

### 8.1 构建命令

```bash
# 使用npm
npm run build

# 使用yarn
yarn build

# 使用pnpm
pnpm build
```

构建输出生成在`web-app/build/`或`web-app/dist/`目录下。

### 8.2 预览生产构建

```bash
# 使用npm
npm run serve

# 使用yarn
yarn serve

# 使用pnpm
pnpm serve
```

此命令启动一个本地服务器来预览生产构建。

## 9. 开发工作流

### 9.1 创建新功能分支

```bash
# 从develop分支创建新分支
git checkout develop
git pull
git checkout -b feature/my-new-feature
```

### 9.2 提交更改

```bash
# 添加更改
git add .

# 提交更改
git commit -m "feat: add new feature description"
```

**提交消息格式**：项目遵循[约定式提交](https://www.conventionalcommits.org/)规范：

- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更改
- `style`: 不影响代码含义的更改（空格、格式等）
- `refactor`: 既不修复错误也不添加功能的代码更改
- `perf`: 改进性能的代码更改
- `test`: 添加缺失的测试或更正现有测试
- `build`: 影响构建系统的更改
- `ci`: 影响CI配置文件的更改
- `chore`: 其他不修改src或test的更改

### 9.3 推送更改

```bash
git push -u origin feature/my-new-feature
```

### 9.4 创建合并请求

在GitHub/GitLab上创建从您的功能分支到develop分支的合并请求（PR/MR）。

## 10. 下一步

完成基本设置后，请查阅以下文档继续深入了解项目：

- [开发指南](./development.md) - 详细的开发规范和流程
- [测试指南](./testing.md) - 了解如何编写和运行测试
- [组件文档](../components/overview.md) - 了解项目组件系统
- [API文档](../api/overview.md) - 了解项目API设计 