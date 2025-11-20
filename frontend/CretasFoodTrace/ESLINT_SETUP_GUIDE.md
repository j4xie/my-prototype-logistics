# ESLint配置指南

**配置日期**: 2025-11-19
**目的**: 自动检测废弃API使用，强制API Client开发规范

---

## 📦 安装依赖

```bash
cd /Users/jietaoxie/my-prototype-logistics/frontend/CretasFoodTrace

# 安装ESLint相关依赖
npm install --save-dev \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint-config-expo \
  eslint-plugin-react \
  eslint-plugin-react-native \
  eslint-plugin-react-hooks
```

---

## ⚙️ 配置文件

已创建 `.eslintrc.js` 配置文件，包含以下规则：

### 1. 废弃API禁用规则

**禁止导入的API Client**:
- ❌ `attendanceApiClient` → 使用 `timeclockApiClient`
- ❌ `employeeApiClient` → 使用 `userApiClient`
- ❌ `enhancedApiClient` → 使用 `apiClient`

**效果**: 当代码中导入废弃API时，ESLint会报错并提示替代方案。

### 2. API Client命名规范

- 文件名必须遵循: `xxxApiClient.ts` 格式
- 类名必须遵循: `XxxApiClient` 格式 (PascalCase)
- 实例名必须遵循: `xxxApiClient` 格式 (camelCase)

### 3. TypeScript规则

- 未使用变量警告（以`_`开头的除外）
- `any`类型使用警告
- 自动检测React版本

### 4. React Native规则

- 内联样式警告
- Hooks使用规则检查

---

## 🚀 使用方法

### 1. 添加npm脚本

编辑 `package.json`，添加以下scripts:

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "lint:api": "eslint src/services/api --ext .ts,.tsx"
  }
}
```

### 2. 运行Lint检查

```bash
# 检查所有文件
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 仅检查API Client文件
npm run lint:api
```

### 3. IDE集成

**VS Code配置**:

安装插件:
```
名称: ESLint
ID: dbaeumer.vscode-eslint
```

在 `.vscode/settings.json` 中添加:
```json
{
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## 🔍 实际效果示例

### 示例1: 禁止导入废弃API

**错误代码**:
```typescript
import { attendanceApiClient } from './services/api/attendanceApiClient';

// ESLint错误:
// ❌ attendanceApiClient已废弃 (2025-11-19)，
//    请使用 timeclockApiClient 替代。
//    详见: src/services/api/API_CLIENT_INDEX.md
```

**正确代码**:
```typescript
import { timeclockApiClient } from './services/api/timeclockApiClient';
```

---

### 示例2: API Client命名规范

**错误代码**:
```typescript
// 文件名: customApi.ts
export class CustomApi {
  // ...
}
export const customApi = new CustomApi();

// ESLint警告:
// ⚠️ Identifier 'customApi' does not match pattern '^[a-z][a-zA-Z0-9]*ApiClient$'
```

**正确代码**:
```typescript
// 文件名: customApiClient.ts
export class CustomApiClient {
  // ...
}
export const customApiClient = new CustomApiClient();
```

---

### 示例3: TypeScript类型检查

**错误代码**:
```typescript
const apiClient: any = ...;  // ⚠️ Unexpected any. Specify a different type.

const unusedVariable = 123;  // ⚠️ 'unusedVariable' is assigned but never used.
```

**正确代码**:
```typescript
const apiClient: AxiosInstance = ...;  // ✅ 明确类型

const _unusedVariable = 123;  // ✅ 使用_前缀表示有意未使用
```

---

## 🛠️ 故障排查

### 问题1: ESLint命令找不到

**症状**:
```bash
npm run lint
# 错误: eslint: command not found
```

**解决方案**:
```bash
# 确保已安装依赖
npm install

# 如果仍然失败，全局安装
npm install -g eslint
```

---

### 问题2: 插件找不到

**症状**:
```
Error: Failed to load plugin '@typescript-eslint' declared in '.eslintrc.js'
```

**解决方案**:
```bash
# 重新安装所有ESLint相关依赖
npm install --save-dev \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin
```

---

### 问题3: React Native规则不生效

**症状**:
```
Warning: React version not specified in eslint-plugin-react settings
```

**解决方案**:
已在`.eslintrc.js`中配置:
```javascript
settings: {
  react: {
    version: 'detect',  // 自动检测React版本
  },
}
```

---

## 📋 ESLint规则维护

### 添加新的废弃API

当需要废弃新的API Client时，编辑 `.eslintrc.js`:

```javascript
'no-restricted-imports': [
  'error',
  {
    paths: [
      // ... 现有规则 ...

      // 新增废弃API
      {
        name: './services/api/newDeprecatedApiClient',
        message: '❌ newDeprecatedApiClient已废弃 (YYYY-MM-DD)，请使用 replacementApiClient 替代。',
      },
    ],
  },
],
```

### 禁用特定文件的规则

在文件顶部添加注释:

```typescript
/* eslint-disable no-restricted-imports */
import { attendanceApiClient } from './attendanceApiClient';
/* eslint-enable no-restricted-imports */

// 或禁用整个文件
/* eslint-disable */
```

---

## 🎯 CI/CD集成

### GitHub Actions

创建 `.github/workflows/lint.yml`:

```yaml
name: ESLint Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
```

### Pre-commit Hook

使用 Husky + lint-staged:

```bash
# 安装
npm install --save-dev husky lint-staged

# 配置 package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "git add"
    ]
  }
}

# 启用 git hooks
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

---

## 📊 统计报告

运行lint后可以生成统计报告:

```bash
# 生成JSON格式报告
npm run lint -- --format json --output-file eslint-report.json

# 生成HTML报告（需要安装eslint-formatter-html）
npm install --save-dev eslint-formatter-html
npm run lint -- --format html --output-file eslint-report.html
```

---

## 🔗 相关文档

- [API_CLIENT_INDEX.md](./src/services/api/API_CLIENT_INDEX.md) - API Client索引
- [API_CONFLICT_RESOLUTION_SOP.md](./src/services/api/API_CONFLICT_RESOLUTION_SOP.md) - 冲突处理流程
- [ESLint官方文档](https://eslint.org/docs/latest/)
- [TypeScript ESLint文档](https://typescript-eslint.io/)

---

## ✅ 验证配置

运行以下命令验证ESLint配置正确:

```bash
# 1. 检查配置文件语法
npx eslint --print-config .eslintrc.js

# 2. 测试单个文件
npx eslint src/services/api/timeclockApiClient.ts

# 3. 检查是否正确禁用废弃API
# 创建测试文件
echo "import { attendanceApiClient } from './services/api/attendanceApiClient';" > test-deprecated.ts
npx eslint test-deprecated.ts
# 应该报错: attendanceApiClient已废弃
rm test-deprecated.ts
```

---

**配置完成日期**: 2025-11-19
**维护**: 每次废弃新API时更新 `.eslintrc.js`
**Review**: 每月检查规则是否生效
