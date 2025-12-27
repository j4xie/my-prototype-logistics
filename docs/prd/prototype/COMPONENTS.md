# Component Library - 统一组件库

## 概述

`components.css` 提供了一套统一的、可复用的 UI 组件样式，用于替代 `styles.css` 中分散的重复定义。

**使用方法**: 在 HTML 文件中添加以下引用（在 styles.css 之后）：

```html
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="components.css">
```

---

## 组件列表

### 1. Card 卡片

替代: `stat-card`, `module-card`, `info-card`, `detail-card`

```html
<div class="card">
  <div class="card__header">
    <span class="card__title">标题</span>
    <span class="card__subtitle">副标题</span>
  </div>
  <div class="card__content">
    内容区域
  </div>
  <div class="card__footer">
    底部区域
  </div>
</div>

<!-- 变体 -->
<div class="card card--compact">紧凑型</div>
<div class="card card--flat">扁平型（无阴影）</div>
<div class="card card--clickable">可点击型</div>
```

### 2. Button 按钮

```html
<button class="btn btn--primary">主要按钮</button>
<button class="btn btn--secondary">次要按钮</button>
<button class="btn btn--success">成功按钮</button>
<button class="btn btn--danger">危险按钮</button>
<button class="btn btn--warning">警告按钮</button>
<button class="btn btn--outline">轮廓按钮</button>

<!-- 尺寸变体 -->
<button class="btn btn--primary btn--sm">小按钮</button>
<button class="btn btn--primary btn--lg">大按钮</button>
<button class="btn btn--primary btn--block">全宽按钮</button>
```

### 3. Status Tag 状态标签

```html
<span class="status-tag status-tag--success">正常</span>
<span class="status-tag status-tag--warning">警告</span>
<span class="status-tag status-tag--error">错误</span>
<span class="status-tag status-tag--info">信息</span>
<span class="status-tag status-tag--default">默认</span>

<!-- 状态点 -->
<span class="status-dot status-dot--success"></span>
<span class="status-dot status-dot--warning"></span>
<span class="status-dot status-dot--error"></span>
```

### 4. List Item 列表项

替代: `task-item`, `batch-item`, `order-item`

```html
<a href="#" class="list-item">
  <div class="list-item__icon">图</div>
  <div class="list-item__content">
    <div class="list-item__title">标题</div>
    <div class="list-item__subtitle">描述文字</div>
  </div>
  <div class="list-item__right">
    <div class="list-item__value">100</div>
    <div class="list-item__meta">单位</div>
  </div>
</a>
```

### 5. Stat Grid 统计网格

```html
<div class="stat-grid">
  <div class="stat-item">
    <div class="stat-item__value">128</div>
    <div class="stat-item__label">今日产量</div>
  </div>
  <!-- 重复 4 个 stat-item -->
</div>

<!-- 变体 -->
<div class="stat-grid stat-grid--3col">3列布局</div>
<div class="stat-grid stat-grid--2col">2列布局</div>
```

### 6. Progress Bar 进度条

```html
<div class="progress">
  <div class="progress__bar progress__bar--primary" style="width: 75%"></div>
</div>

<!-- 带标签 -->
<div class="progress-with-label">
  <div class="progress">
    <div class="progress__bar progress__bar--success" style="width: 60%"></div>
  </div>
  <span class="progress-with-label__text">60%</span>
</div>
```

### 7. Form 表单

```html
<div class="form-group">
  <label class="form-label">
    字段名称 <span class="form-label__required">*</span>
  </label>
  <input type="text" class="form-input" placeholder="请输入">
  <span class="form-hint">提示信息</span>
  <span class="form-error">错误信息</span>
</div>

<div class="form-group">
  <label class="form-label">下拉选择</label>
  <select class="form-select">
    <option>选项1</option>
    <option>选项2</option>
  </select>
</div>

<div class="form-group">
  <label class="form-label">多行文本</label>
  <textarea class="form-textarea" placeholder="请输入"></textarea>
</div>
```

### 8. Section 区块

```html
<div class="section">
  <div class="section__header">
    <span class="section__title">区块标题</span>
    <a href="#" class="section__more">查看更多 ></a>
  </div>
  <!-- 区块内容 -->
</div>
```

### 9. Avatar 头像

```html
<div class="avatar avatar--sm">张</div>
<div class="avatar avatar--md">李</div>
<div class="avatar avatar--lg">王</div>
<div class="avatar avatar--xl">赵</div>
```

### 10. Badge 徽章

```html
<span class="badge">5</span>
<span class="badge badge--primary">新</span>
<span class="badge badge--success">完成</span>
<span class="badge badge--dot"></span>
```

### 11. Empty State 空状态

```html
<div class="empty-state">
  <div class="empty-state__icon">空</div>
  <div class="empty-state__title">暂无数据</div>
  <div class="empty-state__description">暂时没有相关数据</div>
  <button class="btn btn--primary">添加数据</button>
</div>
```

### 12. Search Box 搜索框

```html
<div class="search-box">
  <span class="search-box__icon">搜</span>
  <input type="text" class="search-box__input" placeholder="搜索...">
</div>
```

### 13. Bottom Navigation 底部导航

```html
<nav class="bottom-nav">
  <a href="#" class="bottom-nav__item active">
    <svg class="bottom-nav__icon"><!-- SVG --></svg>
    <span>首页</span>
  </a>
  <a href="#" class="bottom-nav__item">
    <svg class="bottom-nav__icon"><!-- SVG --></svg>
    <span>列表</span>
  </a>
  <!-- 4-5 个导航项 -->
</nav>
```

### 14. Tab Bar 标签栏

```html
<div class="tab-bar">
  <span class="tab-bar__item active">全部</span>
  <span class="tab-bar__item">待处理</span>
  <span class="tab-bar__item">已完成</span>
</div>
```

### 15. Loading 加载

```html
<div class="loading">
  <div class="loading__spinner"></div>
  <span class="loading__text">加载中...</span>
</div>
```

### 16. Modal 弹窗

```html
<div class="modal-overlay">
  <div class="modal">
    <div class="modal__header">
      <span class="modal__title">弹窗标题</span>
    </div>
    <div class="modal__body">
      弹窗内容
    </div>
    <div class="modal__footer">
      <button class="btn btn--secondary">取消</button>
      <button class="btn btn--primary">确定</button>
    </div>
  </div>
</div>
```

### 17. Divider 分割线

```html
<div class="divider"></div>
<div class="divider divider--thick"></div>
```

---

## 工具类 (Utility Classes)

### 文本颜色
- `.text-primary` / `.text-secondary` / `.text-tertiary`
- `.text-success` / `.text-warning` / `.text-error`

### 背景
- `.bg-primary` / `.bg-secondary`

### 字重
- `.font-bold` / `.font-normal`

### 文本对齐
- `.text-center` / `.text-left` / `.text-right`

### Flexbox
- `.flex` / `.flex-col` / `.flex-1`
- `.items-center` / `.justify-between` / `.justify-center`
- `.gap-sm` / `.gap-md` / `.gap-lg`

### 间距
- `.mt-sm` / `.mt-md` / `.mt-lg` (margin-top)
- `.mb-sm` / `.mb-md` / `.mb-lg` (margin-bottom)
- `.p-sm` / `.p-md` / `.p-lg` (padding)

---

## 设计令牌 (CSS Variables)

所有组件使用 `styles.css` 中定义的 CSS 变量：

| 变量 | 用途 |
|------|------|
| `--primary-color` | 主色调 |
| `--success-color` | 成功色 |
| `--warning-color` | 警告色 |
| `--error-color` | 错误色 |
| `--text-primary` | 主要文字 |
| `--text-secondary` | 次要文字 |
| `--text-tertiary` | 辅助文字 |
| `--bg-primary` | 主背景 |
| `--bg-secondary` | 次背景 |
| `--spacing-sm/md/lg` | 间距 |
| `--radius-sm/md/lg` | 圆角 |
| `--shadow-sm/md/lg` | 阴影 |

---

## 迁移指南

### 替换对照表

| 旧类名 | 新类名 |
|--------|--------|
| `.stat-card` | `.card` |
| `.module-card` | `.card` |
| `.info-card` | `.card card--flat` |
| `.task-item` | `.list-item` |
| `.batch-item` | `.list-item` |
| `.order-item` | `.list-item` |
| `.action-btn.primary` | `.btn.btn--primary` |
| `.action-btn.secondary` | `.btn.btn--secondary` |
| `.status.success` | `.status-tag.status-tag--success` |
| `.status.warning` | `.status-tag.status-tag--warning` |
