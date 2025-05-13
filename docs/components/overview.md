# 组件概览

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

## 1. 组件设计原则

食品溯源系统的UI组件采用现代化的组件设计原则，帮助开发团队构建高效、一致且可维护的用户界面。以下是我们的核心设计原则：

### 1.1 组件化设计

- **原子设计方法**：应用原子设计思想，将UI分解为原子、分子、有机体、模板和页面五个层次
- **高内聚低耦合**：每个组件专注于单一职责，减少组件间依赖
- **可组合性**：小型组件可组合成复杂UI，提高代码复用性
- **可测试性**：组件设计便于单元测试和集成测试

### 1.2 一致性

- **视觉一致性**：遵循统一的设计语言和视觉风格
- **行为一致性**：相似组件具有一致的交互模式
- **命名一致性**：组件和属性采用一致的命名约定
- **API一致性**：相似组件提供一致的属性和方法接口

### 1.3 可访问性

- **符合WCAG标准**：遵循Web内容无障碍指南
- **键盘导航**：支持键盘导航和操作
- **屏幕阅读器支持**：提供适当的ARIA属性和标签
- **色彩对比度**：确保文本和背景的足够对比度

### 1.4 性能

- **懒加载**：支持组件按需加载
- **轻量化**：避免不必要的依赖
- **按需渲染**：使用条件渲染和虚拟列表优化大量数据渲染
- **缓存和记忆化**：适当使用缓存和记忆化技术

### 1.5 可扩展性

- **主题化**：支持主题定制，包括颜色、字体和间距
- **可配置性**：组件提供必要的配置选项，满足不同场景需求
- **插槽和组合**：使用插槽或子组件模式支持内容扩展
- **自定义钩子**：提供钩子用于自定义行为

## 2. 组件组织结构

系统组件按照以下结构组织：

```
src/
└── components/
    ├── common/        # 通用组件
    │   ├── Button/
    │   ├── Input/
    │   ├── Select/
    │   ├── Modal/
    │   ├── Card/
    │   ├── Table/
    │   └── ...
    ├── modules/       # 业务模块组件
    │   ├── trace/     # 溯源相关组件
    │   ├── farming/   # 农业/养殖相关组件
    │   ├── processing/# 加工相关组件
    │   ├── logistics/ # 物流相关组件
    │   └── admin/     # 管理后台组件
    └── ui/            # UI基础组件
        ├── icons/     # 图标组件
        ├── layout/    # 布局组件
        ├── theme/     # 主题组件
        └── ...
```

## 3. 组件类型和分类

### 3.1 通用组件（Common Components）

通用组件是系统中被广泛使用的基础组件，与业务逻辑无关。

| 组件类型 | 描述 | 示例 |
|---------|------|------|
| 表单组件 | 用于数据输入和表单交互 | Input, Select, Checkbox, RadioButton, Switch, Form |
| 导航组件 | 用于页面和视图导航 | Navbar, Tabs, Breadcrumb, Pagination |
| 反馈组件 | 提供用户操作反馈 | Alert, Toast, Modal, Dialog, Notification |
| 数据展示组件 | 展示数据和内容 | Card, Table, List, Badge, Avatar, Tooltip |
| 布局组件 | 控制页面和组件布局 | Grid, FlexBox, Container, Divider |

### 3.2 业务模块组件（Module Components）

业务模块组件实现特定业务功能，与业务逻辑紧密相关。

| 模块 | 组件类型 | 示例组件 |
|------|---------|---------|
| 溯源模块 | 溯源查询组件 | TraceQuery, TraceResult, TraceDetail, TraceTimeline |
| | 溯源管理组件 | BatchList, BatchCreate, BatchEditor, CertificateGenerator |
| 农业/养殖模块 | 数据采集组件 | DataCollectionForm, QRScanner, SensorData, WeatherDisplay |
| | 环境监控组件 | EnvironmentMonitor, GrowthChart, FeedingRecord |
| 加工模块 | 质量检测组件 | QualityTest, ProcessingStep, TestResult |
| | 加工记录组件 | ProcessingRecord, ProcessingTimeline |
| 物流模块 | 运输组件 | ShipmentTracker, RouteMap, DeliveryStatus |
| | 库存组件 | InventoryList, StockMovement, WarehouseMap |
| 管理模块 | 用户管理组件 | UserList, RoleEditor, PermissionSettings |
| | 数据分析组件 | AnalyticsDashboard, ReportGenerator, DataExport |

### 3.3 UI基础组件（UI Components）

UI基础组件提供设计系统基础元素，确保界面风格一致性。

| 组件类型 | 描述 | 示例 |
|---------|------|------|
| 图标组件 | 系统使用的图标集 | Icon, IconButton |
| 主题组件 | 控制主题和外观 | ThemeProvider, ColorSwatch |
| 动画组件 | 提供界面动效 | Transition, Animation, Skeleton |
| 排版组件 | 文本和排版控制 | Typography, Text, Heading |

## 4. 组件开发规范

### 4.1 组件文件结构

每个组件遵循以下文件结构：

```
ComponentName/
├── index.js             # 导出入口
├── ComponentName.jsx    # 组件实现
├── ComponentName.module.css # 组件样式（CSS模块）
├── ComponentName.test.js# 组件测试
└── README.md            # 组件文档
```

### 4.2 组件命名规范

- 组件文件和文件夹名使用PascalCase（如`Button`, `UserProfile`）
- 组件内部函数使用camelCase（如`handleClick`, `formatDate`）
- 样式类名使用camelCase或kebab-case（取决于CSS方案）
- 事件处理函数使用`handle`前缀（如`handleSubmit`, `handleChange`）

### 4.3 属性（Props）规范

- 属性名使用camelCase
- 布尔属性应遵循肯定命名（如`isActive`而非`isNotActive`）
- 提供合理的默认值
- 为所有必要属性编写PropTypes或TypeScript类型
- 避免过度使用布尔属性，优先使用枚举值

### 4.4 状态管理规范

- 本地状态使用React的useState和useReducer管理
- 组件间共享状态使用Context API
- 复杂全局状态使用Redux或Zustand
- 保持状态最小化和规范化
- 避免状态冗余和重复

## 5. 样式方案

系统使用多种样式方案，开发者可以根据需求选择合适的方案。

### 5.1 CSS模块

CSS模块是系统主要的样式方案，提供局部作用域的CSS。

```jsx
// Button.jsx
import styles from './Button.module.css';

function Button({ children, variant = 'primary' }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

```css
/* Button.module.css */
.button {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
}

.primary {
  background-color: var(--color-primary);
  color: white;
}

.secondary {
  background-color: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
```

### 5.2 Tailwind CSS

对于快速开发和原型设计，系统集成了Tailwind CSS。

```jsx
function Button({ children, variant = 'primary' }) {
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-transparent border border-blue-500 text-blue-500 hover:bg-blue-50'
  };
  
  return (
    <button className={`px-4 py-2 rounded font-medium transition ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

### 5.3 CSS变量和主题

系统使用CSS变量实现主题支持。

```css
/* 定义在全局CSS文件中 */
:root {
  --color-primary: #4a90e2;
  --color-secondary: #50e3c2;
  --color-text: #333333;
  --color-background: #ffffff;
  
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
}

[data-theme="dark"] {
  --color-primary: #5c9cf5;
  --color-secondary: #64f0d1;
  --color-text: #f0f0f0;
  --color-background: #1a1a1a;
}
```

## 6. 组件文档化

所有组件都应该有完善的文档，包括：

- 组件描述
- 属性列表和说明
- 使用示例
- 变体和配置
- 可访问性考虑
- 已知限制

系统使用Storybook作为组件文档和开发环境。

```jsx
// Button.stories.jsx
import Button from './Button';

export default {
  title: 'Common/Button',
  component: Button,
  argTypes: {
    variant: {
      control: { type: 'select', options: ['primary', 'secondary', 'danger'] },
      description: '按钮的样式变体'
    },
    size: {
      control: { type: 'select', options: ['small', 'medium', 'large'] },
      description: '按钮的大小'
    },
    disabled: {
      control: 'boolean',
      description: '是否禁用按钮'
    }
  }
};

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  variant: 'primary',
  children: '主要按钮',
  size: 'medium'
};

export const Secondary = Template.bind({});
Secondary.args = {
  variant: 'secondary',
  children: '次要按钮',
  size: 'medium'
};

export const Danger = Template.bind({});
Danger.args = {
  variant: 'danger',
  children: '危险操作',
  size: 'medium'
};
```

## 7. 组件使用指南

### 7.1 何时使用通用组件

- 实现基础UI元素时使用通用组件
- 组件需要在多个业务模块中复用时使用通用组件
- 组件不包含业务逻辑时使用通用组件

### 7.2 何时创建业务组件

- 组件实现特定业务功能时创建业务组件
- 通用组件组合无法满足需求时创建业务组件
- 多个页面需要共享相同业务逻辑时创建业务组件

### 7.3 组件开发最佳实践

- 从小组件开始，逐步构建复杂组件
- 使用组合而非继承来复用代码
- 保持组件专注于单一职责
- 使用适当的设计模式（如容器/展示组件、复合组件等）
- 考虑组件的可用性和可访问性
- 编写测试确保组件质量

## 8. 后续演进计划

组件系统将继续演进，未来计划包括：

1. **组件库独立化**：将核心通用组件提取为独立库
2. **组件国际化增强**：改进组件国际化支持
3. **组件性能优化**：引入代码分割和懒加载策略
4. **组件可访问性改进**：全面检查和改进组件可访问性
5. **设计系统文档化**：建立完整的设计系统文档 