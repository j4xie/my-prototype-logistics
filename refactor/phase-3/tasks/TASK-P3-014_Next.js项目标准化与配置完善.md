# TASK-P3-014: Next.js项目标准化与配置完善

<!-- updated for: Phase-3技术栈现代化 - Next.js项目标准化与配置完善 -->

## 任务概述

**任务ID**: TASK-P3-014  
**任务名称**: Next.js项目标准化与配置完善  
**优先级**: P1 (高)  
**预估工期**: 1周  
**依赖**: TASK-P3-001 (已完成)  
**状态**: 📋 新建

## 任务目标

基于TASK-P3-001的技术选型成果，完善web-app-next项目的目录结构，补充缺失的配置文件，确保项目完全符合Next.js 14 App Router标准规范。

## 任务背景

通过分析当前web-app-next目录结构，发现项目基础已建立但仍缺少以下标准配置：

### 🚨 **当前缺失项 (11%)**
- `tailwind.config.ts` (应为TypeScript配置)
- `src/styles/` 目录 (全局样式管理)
- `tests/` 目录 (测试文件组织)
- `.env.local` 文件 (本地环境变量)

### ✅ **已有配置 (89%)**
- ✅ Next.js 14基础项目结构
- ✅ TypeScript配置 (tsconfig.json)
- ✅ Tailwind CSS集成 (tailwind.config.js)
- ✅ Next.js配置 (next.config.js)
- ✅ 基础组件和路由结构

## 详细任务清单

### 🎯 **第一步：配置文件标准化 (优先级P0)**

#### 1.1 Tailwind配置升级
- [ ] 将`tailwind.config.js`升级为`tailwind.config.ts`
- [ ] 添加完整的TypeScript类型支持
- [ ] 配置自定义主题系统
- [ ] 添加组件类名预设
- [ ] 配置响应式断点

#### 1.2 环境变量配置
- [ ] 创建`.env.local`示例文件
- [ ] 配置开发环境API端点
- [ ] 设置构建时环境变量
- [ ] 添加环境变量类型定义

#### 1.3 TypeScript配置优化
- [ ] 优化`tsconfig.json`路径映射
- [ ] 添加严格模式配置
- [ ] 配置编译器选项
- [ ] 设置模块解析策略

### 🗂️ **第二步：目录结构完善 (优先级P1)**

#### 2.1 样式系统组织
```
src/styles/
├── globals/              # 全局样式
│   ├── reset.css        # CSS重置
│   ├── typography.css   # 排版样式
│   ├── variables.css    # CSS变量
│   └── components.css   # 组件样式
├── themes/              # 主题系统
│   ├── light.css       # 亮色主题
│   └── dark.css        # 暗色主题
├── utilities/           # 工具类
│   ├── animations.css  # 动画工具类
│   └── spacing.css     # 间距工具类
└── globals.css         # 主入口文件
```

#### 2.2 测试目录建立
```
tests/
├── __mocks__/           # 测试模拟
│   ├── fileMock.js     # 文件模拟
│   └── styleMock.js    # 样式模拟
├── unit/                # 单元测试
│   ├── components/     # 组件测试
│   └── utils/          # 工具函数测试
├── integration/         # 集成测试
│   └── api/            # API集成测试
├── e2e/                # 端到端测试
│   ├── auth.spec.ts    # 认证流程测试
│   └── trace.spec.ts   # 溯源功能测试
├── setup.ts            # 测试环境设置
└── jest.config.js      # Jest配置
```

#### 2.3 工具库扩展
```
src/lib/
├── utils.ts            # 已有工具函数
├── api.ts              # API客户端配置
├── constants.ts        # 常量定义
├── validations.ts      # 表单验证模式
└── auth.ts             # 认证工具函数
```

### 🔧 **第三步：开发工具链配置 (优先级P1)**

#### 3.1 代码质量工具
- [ ] 完善ESLint配置规则
- [ ] 配置Prettier代码格式化
- [ ] 添加Husky Git钩子
- [ ] 配置lint-staged预提交检查

#### 3.2 性能监控配置
- [ ] 配置Bundle Analyzer
- [ ] 添加Lighthouse CI配置
- [ ] 设置性能预算限制
- [ ] 配置Core Web Vitals监控

#### 3.3 开发体验工具
- [ ] 配置VSCode设置推荐
- [ ] 添加调试配置文件
- [ ] 设置开发服务器代理
- [ ] 配置热重载优化

### 📚 **第四步：文档和示例完善 (优先级P2)**

#### 4.1 项目文档
- [ ] 创建项目README更新
- [ ] 添加开发指南文档
- [ ] 编写部署说明文档
- [ ] 建立贡献指南

#### 4.2 代码示例
- [ ] 创建组件使用示例
- [ ] 添加API调用示例
- [ ] 建立最佳实践指南
- [ ] 创建故障排除文档

## 预期输出

### 配置文件交付物
- [ ] `tailwind.config.ts` - TypeScript化的Tailwind配置
- [ ] `.env.local` - 本地环境变量示例
- [ ] `jest.config.js` - Jest测试配置
- [ ] `.vscode/settings.json` - VSCode推荐设置
- [ ] `next.config.js` - 完善的Next.js配置

### 目录结构交付物
- [ ] `src/styles/` - 完整的样式系统目录
- [ ] `tests/` - 标准化的测试目录结构
- [ ] `src/lib/` - 扩展的工具库目录
- [ ] `docs/` - 项目文档目录

### 工具链交付物
- [ ] `.eslintrc.json` - 完善的ESLint配置
- [ ] `.prettierrc` - Prettier格式化配置
- [ ] `package.json` - 更新的脚本和依赖
- [ ] `husky/` - Git钩子配置目录

## 验收标准

### 功能标准
- [ ] Next.js项目构建成功，无警告无错误
- [ ] 所有TypeScript类型检查通过
- [ ] ESLint和Prettier检查100%通过
- [ ] 测试框架正常运行
- [ ] 开发服务器热重载正常

### 规范标准
- [ ] 目录结构符合Next.js 14最佳实践
- [ ] 配置文件符合现代前端工程化标准
- [ ] 代码质量工具集成完整
- [ ] 文档完整且可操作

### 性能标准
- [ ] 构建时间保持在5秒以内
- [ ] 开发服务器启动时间<3秒
- [ ] 热重载响应时间<1秒
- [ ] Bundle大小符合预期

## 技术规范

### 配置文件标准
```typescript
// tailwind.config.ts 示例结构
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

### 环境变量结构
```bash
# .env.local 示例
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development
DATABASE_URL=postgresql://...
AUTH_SECRET=your-secret-key
```

## 实施计划

### 第1天：配置文件标准化
- 升级Tailwind配置为TypeScript
- 创建环境变量文件
- 完善TypeScript配置

### 第2天：目录结构建立
- 创建styles目录结构
- 建立测试目录框架
- 扩展lib工具库

### 第3天：开发工具链集成
- 配置代码质量工具
- 设置性能监控
- 添加开发体验工具

### 第4-5天：文档和验证
- 编写项目文档
- 创建使用示例
- 进行全面验证测试

## 风险评估

### 潜在风险
1. **配置冲突风险** - 中等
   - 现有配置可能与新配置冲突
   - 缓解：备份现有配置，逐步迁移

2. **构建兼容性风险** - 低
   - 新配置可能影响构建流程
   - 缓解：充分测试，保持向后兼容

3. **开发体验影响** - 低
   - 配置变更可能影响开发流程
   - 缓解：提供迁移指南，团队培训

## 相关文件

### 输入文件
- [TASK-P3-001技术选型文档](./TASK-P3-001_前端框架迁移评估与选型.md)
- [Phase-3工作计划](../PHASE-3-WORK-PLAN.md)
- [Next.js官方文档](https://nextjs.org/docs)

### 输出文件
- `web-app-next/` - 完善的项目目录结构
- `refactor/phase-3/docs/PROJECT-STANDARDIZATION.md` - 标准化文档
- `refactor/phase-3/docs/DEVELOPMENT-GUIDE.md` - 开发指南

## 变更记录

| 日期 | 变更类型 | 说明 | 负责人 |
|------|----------|------|--------|
| 2025-05-27 | 创建 | 创建标准化任务文档 | AI助手 |

## 下一步任务

完成TASK-P3-014后，将为以下任务提供支撑：
- **TASK-P3-002**: 构建工具现代化 (依赖本任务的配置完善)
- **TASK-P3-005**: TypeScript集成 (依赖本任务的类型配置)
- **TASK-P3-006**: 开发工具链完善 (与本任务部分重叠)

---

**任务状态**: 📋 新建  
**创建日期**: 2025-05-27  
**最后更新**: 2025-05-27  
**文档维护**: 按照[refactor-phase3-agent.mdc](../../../.cursor/rules/refactor-phase3-agent.mdc)规则管理 