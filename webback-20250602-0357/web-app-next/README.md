# 食品溯源系统 - Next.js现代化版�?
> **重要说明**: 本项目是Phase-3技术栈现代化的成果，采用Next.js 14 + TypeScript 5技术栈�?> 
> **配置完整�?*: 项目已完�?00%工程化配置，包含完整的开发工具链、测试框架、代码质量保障等�?> 
> **避免重复**: 所有配置文件都已标准化配置，请勿重复创建或修改核心配置�?
## 📋 项目概述

本项目是食品溯源系统的现代化版本，基于Next.js 14 + TypeScript 5技术栈构建。项目已完成Phase-3技术栈现代化的核心工作，包括：

- �?**15个核心组件TypeScript现代化迁�?* (100%完成)
- �?**完整的工程化配置** (测试、构建、代码质�?
- �?**现代化开发工具链** (VSCode集成、Git钩子、调试配�?
- �?**标准化项目结�?* (配置模块、目录索引、类型系�?

## 🚀 快速开�?
### 环境要求
- Node.js 18+ 
- npm/yarn/pnpm
- VSCode (推荐，已配置完整开发环�?

### 安装和运�?```bash
# 安装依赖
npm install

# 启动开发服务器 (使用Turbopack)
npm run dev

# 构建项目
npm run build

# 运行测试
npm run test

# 代码质量检�?npm run lint
npm run type-check
npm run format
```

### 开发服务器
```bash
npm run dev
```
访问 [http://localhost:3000](http://localhost:3000) 查看应用

## 🛠�?项目配置说明

### ⚠️ 重要配置文件 (请勿随意修改)

以下配置文件已经过精心配置和验证�?*请勿重复创建或随意修�?*�?
#### 核心配置文件
- **`package.json`** - 项目依赖和脚本配�?  - 🔧 完整的npm scripts (dev, build, test, lint, format�?
  - 🔧 lint-staged配置 (Git提交前代码检�?
  - 🔧 精选的开发依赖和工具�?  - ⚠️ **重要�?*: 项目的核心配置，修改需谨慎

- **`tsconfig.json`** - TypeScript编译配置
  - 🔧 严格类型检查配�?  - 🔧 Next.js优化的编译选项
  - 🔧 路径映射和模块解�?  - ⚠️ **重要�?*: 确保TypeScript类型安全和编译正�?
- **`jest.config.js`** - Jest测试框架配置
  - 🔧 Next.js + TypeScript测试环境
  - 🔧 模拟配置 (Next.js Router、Image�?
  - 🔧 测试覆盖率配�?(80%阈�?
  - ⚠️ **重要�?*: 测试框架的核心配置，确保测试正常运行

- **`.prettierrc`** - 代码格式化配�?  - 🔧 统一的代码风格配�?  - 🔧 Tailwind CSS插件集成
  - 🔧 TypeScript/JSX格式化规�?  - ⚠️ **重要�?*: 确保团队代码风格一�?
#### Git工作流配�?- **`.husky/pre-commit`** - Git提交前钩�?  - 🔧 自动运行lint-staged检�?  - 🔧 提交前ESLint修复和Prettier格式�?  - ⚠️ **重要�?*: 防止低质量代码进入版本控�?
- **`.husky/commit-msg`** - 提交消息钩子
  - 🔧 预留commitlint集成接口
  - ⚠️ **重要�?*: 提交消息格式规范�?
#### VSCode开发环境配�?- **`.vscode/settings.json`** - 项目特定编辑器设�?  - 🔧 TypeScript导入偏好和自动完�?  - 🔧 保存时自动格式化和ESLint修复
  - 🔧 Tailwind CSS语言支持
  - ⚠️ **重要�?*: 确保团队开发环境一�?
- **`.vscode/extensions.json`** - 推荐扩展
  - 🔧 核心扩展: Prettier, ESLint, Tailwind CSS
  - 🔧 开发工�? TypeScript, Auto Rename Tag
  - 🔧 AI辅助: GitHub Copilot
  - ⚠️ **重要�?*: 提供最佳开发体�?
- **`.vscode/launch.json`** - 调试配置
  - 🔧 Next.js全栈调试配置
  - 🔧 服务端和客户端调试支�?  - ⚠️ **重要�?*: 支持断点调试和性能分析

### 📁 项目结构说明

#### 应用配置模块 (`src/config/`)
```
src/config/
├── app.ts          # 应用基础配置 (环境变量、API、功能开�?
├── constants.ts    # 应用常量定义 (API端点、路由、业务常�?
└── index.ts        # 配置模块导出索引
```

**使用方式**:
```typescript
import { appConfig } from '@/config';
import { API_ENDPOINTS, ROUTES } from '@/config/constants';

// 获取API配置
const apiUrl = appConfig.api.baseUrl;

// 使用常量
const loginUrl = API_ENDPOINTS.AUTH.LOGIN;
const homePath = ROUTES.HOME;
```

**重要�?*: 
- �?统一的配置管理，避免硬编�?- �?环境变量类型安全管理
- �?业务常量集中定义
- ⚠️ **请勿在其他地方重复定义相同常�?*

#### 目录索引文件
```
src/hooks/index.ts     # 自定义Hooks导出索引
src/services/index.ts  # API服务层导出索�? 
src/utils/index.ts     # 工具函数导出索引
```

**重要�?*:
- �?为将来的功能扩展预留接口
- �?统一的模块导出规�?- �?清晰的模块边界定�?- ⚠️ **添加新功能时请使用这些索引文件导�?*

#### 组件�?(`src/components/ui/`)
```
src/components/ui/
├── button.tsx         # 按钮组件 �?├── card.tsx           # 卡片组件 �?├── modal.tsx          # 模态框组件 �?├── loading.tsx        # 加载组件 �?├── input.tsx          # 输入框组�?�?├── select.tsx         # 选择器组�?�?├── textarea.tsx       # 文本域组�?�?├── table.tsx          # 表格组件 �?├── badge.tsx          # 徽章组件 �?├── stat-card.tsx      # 统计卡片组件 �?├── mobile-search.tsx  # 移动搜索组件 �?├── touch-gesture.tsx  # 触摸手势组件 �?├── mobile-nav.tsx     # 移动导航组件 �?├── fluid-container.tsx # 流式容器组件 �?├── row.tsx            # 行布局组件 �?├── column.tsx         # 列布局组件 �?├── page-layout.tsx    # 页面布局组件 �?└── index.ts           # 组件导出索引
```

**重要�?*:
- �?**15个核心组件已完成TypeScript现代化迁�?*
- �?完整的类型系统和可访问性支�?- �?符合WCAG 2.1 AA标准
- �?移动端优化和响应式设�?- ⚠️ **这些组件已经过充分测试，请优先使用而非重新创建**

## 🧪 测试框架

### 测试配置
- **Jest** - 测试运行器和断言�?- **Testing Library** - React组件测试工具
- **jsdom** - DOM环境模拟

### 运行测试
```bash
# 运行所有测�?npm run test

# 监听模式运行测试
npm run test:watch

# 生成覆盖率报�?npm run test:coverage

# CI环境测试
npm run test:ci
```

### 测试示例
```typescript
// tests/unit/components/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

**重要�?*:
- �?确保组件功能正确�?- �?防止回归问题
- �?提高代码质量和可维护�?- ⚠️ **新增组件请添加对应测试文�?*

## 🎨 开发规�?
### 代码风格
- **TypeScript** - 严格类型检�?- **ESLint** - 代码质量检�?- **Prettier** - 代码格式�?- **Tailwind CSS** - 样式框架

### 组件开发规�?```typescript
// 组件示例
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          // variant styles...
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

### 重要规范
- �?使用forwardRef支持ref传�?- �?完整的TypeScript类型定义
- �?可访问性属性支�?- �?Tailwind CSS类名组合
- ⚠️ **请遵循现有组件的API设计模式**

## 📊 性能指标

### 构建性能
- �?**构建时间**: 2�?(符合<5秒标�?
- �?**开发服务器启动**: <3�?- �?**热重载响�?*: <1�?- �?**Bundle大小**: 101kB (优化良好)

### 代码质量
- �?**TypeScript类型检�?*: 100%通过
- �?**ESLint代码质量**: 100%通过
- �?**测试覆盖�?*: 配置80%阈�?- �?**构建成功�?*: 100%

## 🚨 注意事项

### 配置文件保护
⚠️ **以下文件已经过精心配置，请勿随意修改**:
- `package.json` - 项目依赖和脚�?- `tsconfig.json` - TypeScript配置
- `jest.config.js` - 测试配置
- `.prettierrc` - 代码格式�?- `.husky/*` - Git钩子
- `.vscode/*` - VSCode配置

### 避免重复创建
⚠️ **以下功能已存在，请勿重复创建**:
- 组件�?(15个核心组件已完成)
- 配置管理系统 (`src/config/`)
- 测试框架 (Jest + Testing Library)
- 开发工具链 (ESLint + Prettier)
- Git工作�?(Husky + lint-staged)

### 扩展指南
�?**正确的扩展方�?*:
- 新增组件: 在`src/components/ui/`目录下创建，并在`index.ts`中导�?- 新增hooks: 在`src/hooks/`目录下创建，并在`index.ts`中导�?- 新增服务: 在`src/services/`目录下创建，并在`index.ts`中导�?- 新增工具: 在`src/utils/`目录下创建，并在`index.ts`中导�?
## 📚 相关文档

- [Phase-3技术栈现代化规划](../refactor/phase-3/PHASE-3-COMPREHENSIVE-PLAN.md)
- [Phase-3工作计划](../refactor/phase-3/PHASE-3-COMPREHENSIVE-PLAN.md)
- [组件迁移指南](../refactor/phase-3/docs/COMPONENT-MIGRATION-GUIDE.md)
- [技术选型决策](../refactor/phase-3/docs/TECH-SELECTION.md)
- [项目目录结构](../DIRECTORY_STRUCTURE.md)

## 🤝 贡献指南

1. **开发前**: 阅读本README和相关文�?2. **代码规范**: 遵循TypeScript和ESLint规范
3. **测试**: 为新功能添加测试用例
4. **提交**: 使用规范的提交消息格�?5. **审查**: 确保代码质量和功能完整�?
---

**项目状�?*: �?Phase-3技术栈现代�?2%完成  
**最后更�?*: 2025-05-28  
**维护团队**: 食品溯源系统开发团�?
