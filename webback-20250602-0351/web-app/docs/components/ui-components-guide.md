# UI组件使用指南

## 概述

本文档介绍食品溯源系统中的UI组件库，所有组件都遵循Neo Minimal iOS-Style Admin UI设计规范，支持响应式设计和移动端适配。

## 表单组件

### Textarea 组件

多行文本输入组件，支持字符计数、错误状态显示等功能。

```jsx
import { Textarea } from '@/components/ui';

// 基础用法
<Textarea
  label="备注"
  placeholder="请输入备注信息"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

// 带字符限制
<Textarea
  label="产品描述"
  placeholder="请输入产品描述"
  maxLength={200}
  rows={6}
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

// 错误状态
<Textarea
  label="问题描述"
  value={issue}
  onChange={(e) => setIssue(e.target.value)}
  error="描述不能为空"
  required
/>
```

**Props:**
- `label`: 标签文本
- `placeholder`: 占位符文本
- `value`: 输入值
- `onChange`: 值变化回调
- `error`: 错误信息
- `maxLength`: 最大字符数
- `rows`: 行数（默认4）
- `resize`: 调整大小方式（'none', 'vertical', 'horizontal', 'both'）

## 数据展示组件

### Table 组件

响应式数据表格，桌面端显示表格，移动端自动转换为卡片布局。

```jsx
import { Table } from '@/components/ui';

const columns = [
  {
    key: 'name',
    title: '产品名称',
    sortable: true
  },
  {
    key: 'status',
    title: '状态',
    render: (value) => <StatusBadge status={value} />
  },
  {
    key: 'date',
    title: '创建时间',
    align: 'right'
  }
];

const data = [
  { name: '有机苹果', status: 'active', date: '2025-05-21' },
  { name: '绿色蔬菜', status: 'pending', date: '2025-05-20' }
];

<Table
  columns={columns}
  data={data}
  loading={loading}
  onRowClick={(row) => console.log('点击行:', row)}
/>
```

**Props:**
- `columns`: 列配置数组
- `data`: 数据数组
- `loading`: 加载状态
- `responsive`: 是否响应式（默认true）
- `striped`: 是否斑马纹（默认true）
- `onRowClick`: 行点击回调

**Column配置:**
- `key`: 数据字段名
- `title`: 列标题
- `sortable`: 是否可排序
- `render`: 自定义渲染函数
- `align`: 对齐方式（'left', 'center', 'right'）

### Badge 组件

状态标签和标记显示组件，包含多种变体。

```jsx
import { Badge, StatusBadge, NumberBadge, DotBadge } from '@/components/ui';

// 基础Badge
<Badge variant="primary">主要</Badge>
<Badge variant="success">成功</Badge>
<Badge variant="warning">警告</Badge>
<Badge variant="error">错误</Badge>

// 状态Badge
<StatusBadge status="active" />
<StatusBadge status="pending" />
<StatusBadge status="completed" />

// 数字Badge
<NumberBadge count={5} />
<NumberBadge count={99} max={99} />
<NumberBadge count={100} max={99} /> // 显示 "99+"

// 点状Badge
<DotBadge variant="success" />
<DotBadge variant="warning" />
```

**Badge Props:**
- `variant`: 变体类型（'default', 'primary', 'success', 'warning', 'error', 'info'）
- `size`: 尺寸（'small', 'default', 'large'）
- `shape`: 形状（'rounded', 'pill', 'square'）

## 布局组件

### FluidContainer 组件

流式容器组件，提供响应式布局支持。

```jsx
import { FluidContainer, Row, Column } from '@/components/ui';

<FluidContainer maxWidth="lg">
  <Row gutter={16}>
    <Column span={12} md={8} lg={6}>
      <Card>内容1</Card>
    </Column>
    <Column span={12} md={8} lg={6}>
      <Card>内容2</Card>
    </Column>
  </Row>
</FluidContainer>
```

## 移动端适配最佳实践

### 1. 响应式断点

组件库使用以下响应式断点：
- `sm`: 640px及以上
- `md`: 768px及以上
- `lg`: 1024px及以上
- `xl`: 1280px及以上

### 2. 移动优先设计

所有组件都采用移动优先的设计方法：
- 默认样式针对移动端优化
- 使用媒体查询逐步增强桌面端体验
- 触摸友好的交互设计

### 3. 表格移动端适配

Table组件在移动端自动转换为卡片布局：
- 保持数据的完整性和可读性
- 优化触摸操作体验
- 支持滚动和交互

### 4. 表单移动端优化

表单组件针对移动端进行了特别优化：
- 防止iOS设备自动缩放
- 优化虚拟键盘体验
- 增大触摸目标区域

## 主题定制

### 颜色系统

组件库使用统一的颜色系统：
- 主色：`#1890FF`
- 成功色：`#52C41A`
- 警告色：`#FA8C16`
- 错误色：`#FF4D4F`
- 信息色：`#1890FF`

### 自定义样式

可以通过`className`属性添加自定义样式：

```jsx
<Button className="custom-button-style">
  自定义按钮
</Button>
```

## 可访问性

所有组件都遵循WCAG 2.1 AA级别的可访问性标准：
- 支持键盘导航
- 提供适当的ARIA标签
- 保证足够的颜色对比度
- 支持屏幕阅读器

## 性能优化

### 1. 组件懒加载

对于大型组件，建议使用懒加载：

```jsx
import { lazy, Suspense } from 'react';

const Table = lazy(() => import('@/components/ui/Table'));

<Suspense fallback={<Loading />}>
  <Table data={data} columns={columns} />
</Suspense>
```

### 2. 虚拟化

对于大量数据的表格，考虑使用虚拟化技术：

```jsx
<Table
  data={largeDataSet}
  columns={columns}
  virtualized={true}
  height={400}
/>
```

## 测试

### 单元测试示例

```jsx
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui';

test('Badge组件渲染正确', () => {
  render(<Badge variant="success">测试</Badge>);
  expect(screen.getByText('测试')).toBeInTheDocument();
});
```

### 可访问性测试

```jsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('组件无可访问性问题', async () => {
  const { container } = render(<Badge>测试</Badge>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 更新日志

### v1.2.0 (2025-05-21)
- 新增 Textarea 组件
- 新增 Table 响应式组件
- 新增 Badge 组件系列
- 优化移动端适配体验

### v1.1.0 (2025-05-15)
- 新增流式布局组件系列
- 完善响应式设计支持
- 优化组件性能

### v1.0.0 (2025-05-12)
- 初始版本发布
- 基础UI组件库
- 移动端适配支持 