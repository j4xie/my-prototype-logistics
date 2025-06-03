# 追溯模块组件

## 概述

追溯模块提供了现代化的React组件，用于食品溯源记录的展示、编辑和管理。所有组件都支持响应式设计和移动端适配。

## 组件列表

### 现代化React组件

#### TraceRecordView
溯源记录视图组件，支持多种显示模式。

```jsx
import { TraceRecordView } from '@/components/modules/trace';

// 列表视图
<TraceRecordView
  records={records}
  viewMode="list"
  onRecordClick={handleRecordClick}
/>

// 表格视图（桌面端）
<TraceRecordView
  records={records}
  viewMode="table"
  onRecordClick={handleRecordClick}
/>

// 详情视图
<TraceRecordView
  viewMode="detail"
  selectedRecord={selectedRecord}
  showTimeline={true}
/>
```

#### TraceRecordForm
溯源记录表单组件，支持创建和编辑。

```jsx
import { TraceRecordForm } from '@/components/modules/trace';

// 创建新记录
<TraceRecordForm
  mode="create"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>

// 编辑现有记录
<TraceRecordForm
  mode="edit"
  initialData={recordData}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

### 传统组件（逐步迁移中）

- `TraceRecordQuery` - 记录查询组件
- `TraceRecordDetails` - 记录详情组件
- 各种工具模块（trace-data, trace-core等）

## 移动端适配特性

### 响应式布局
- **桌面端**: 使用表格布局展示数据
- **移动端**: 自动转换为卡片布局
- **平板端**: 根据屏幕尺寸智能适配

### 触摸优化
- 增大触摸目标区域
- 优化滑动和点击交互
- 支持手势操作

### 表单优化
- 防止iOS设备自动缩放
- 优化虚拟键盘体验
- 移动端友好的文件上传

## 使用示例

### 完整的追溯页面

```jsx
import React, { useState } from 'react';
import { TraceRecordView, TraceRecordForm } from '@/components/modules/trace';
import { PageLayout } from '@/components/ui';

const TracePage = () => {
  const [currentView, setCurrentView] = useState('list');
  const [selectedRecord, setSelectedRecord] = useState(null);

  return (
    <PageLayout title="溯源管理">
      {currentView === 'list' && (
        <TraceRecordView
          records={records}
          viewMode="list"
          onRecordClick={(record) => {
            setSelectedRecord(record);
            setCurrentView('detail');
          }}
        />
      )}
      
      {currentView === 'form' && (
        <TraceRecordForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={() => setCurrentView('list')}
        />
      )}
      
      {currentView === 'detail' && (
        <TraceRecordView
          viewMode="detail"
          selectedRecord={selectedRecord}
          showTimeline={true}
        />
      )}
    </PageLayout>
  );
};
```

## 数据格式

### 记录数据结构

```javascript
const recordData = {
  id: 'trace_001',
  productName: '有机苹果',
  productType: 'fruit',
  batchNumber: 'AP2025052101',
  stage: 'retail',
  location: '北京市朝阳区超市',
  status: 'completed',
  timestamp: '2025-05-21T10:30:00Z',
  handlerName: '张三',
  description: '产品描述信息',
  attachments: [
    { name: '质检报告.pdf', size: 1024 }
  ],
  timeline: [
    {
      operation: '种植',
      timestamp: '2025-03-01T08:00:00Z',
      location: '山东烟台果园',
      description: '操作描述'
    }
  ]
};
```

## 开发指南

### 添加新的视图模式

1. 在`TraceRecordView`组件中添加新的渲染函数
2. 更新`viewMode`属性的类型定义
3. 在`renderContent`方法中添加新的case

### 自定义样式

组件使用Tailwind CSS，可以通过`className`属性添加自定义样式：

```jsx
<TraceRecordView
  className="custom-trace-view"
  records={records}
/>
```

### 扩展表单字段

在`TraceRecordForm`组件中：

1. 更新`formData`状态结构
2. 添加新的表单控件
3. 更新验证逻辑

## 演示页面

访问 `/trace/demo` 查看完整的组件演示和移动端适配效果。

## 技术栈

- React 18+
- Tailwind CSS
- 响应式设计
- 移动端优化
- 无障碍访问支持

## 更新日志

### v2.0.0 (2025-05-21)
- 创建现代化React版本组件
- 实现响应式设计和移动端适配
- 支持多种视图模式
- 优化表单输入体验

### v1.x (历史版本)
- 传统JavaScript组件
- 基础功能实现 