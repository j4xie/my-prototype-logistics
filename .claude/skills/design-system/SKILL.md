---
name: design-system
description: 统一设计系统规范。覆盖 Vue Web Admin (Element Plus)、React Native (Expo/Paper)、微信小程序 (ColorUI) 三个平台。当用户需要设计/实现 UI 组件、页面布局、样式规范时触发。自动检测目标平台并加载对应设计规范。
---

# 统一设计系统 Skill

## 平台自动检测

根据用户请求上下文匹配目标平台：

| 信号 | 平台 |
|------|------|
| 路径含 `web-admin/`、提到 Element Plus / Vue / el-table / el-form / SCSS | **Vue Web Admin** |
| 路径含 `frontend/CretasFoodTrace/`、提到 RN / Expo / StyleSheet / Paper | **React Native** |
| 路径含 `MallCenter/mall_miniprogram/`、提到小程序 / WXSS / rpx / wx: | **微信小程序** |
| 多平台或不明确 | 提示用户选择，同时参考跨平台 Token 映射 |

检测到平台后，只加载该平台规范段落执行。

---

## Vue Web Admin 设计规范

**技术栈**: Vue 3 + Element Plus + scoped SCSS + CSS custom properties

### 颜色

| Token | 值 | 用途 |
|-------|----|------|
| primary | `#1B65A8` | 品牌主色、按钮、链接 |
| el-primary | `#409EFF` | Element Plus 默认主色 |
| bg-page | `#F4F6F9` | 页面背景 |
| bg-card | `#ffffff` | 卡片背景 |
| text-primary | `#1A2332` | 标题文字 |
| text-secondary | `#7A8599` | 辅助文字 |
| border | `#EDF2F7` | 边框、分割线 |

### 布局

- 侧栏: 展开 `220px` / 收起 `64px`
- 顶栏: `64px` 高，`backdrop-filter: blur(12px)` 毛玻璃
- 内容区: `padding: 20px`
- 过渡: 侧栏 `0.3s`，通用 `0.2s`

### 间距与圆角

- 间距基数: `4px` (4/8/12/16/20/24/32)
- 卡片圆角: `10px`
- 阴影: 蓝调 `box-shadow: 0 2px 12px rgba(27,101,168,0.06)`

### 字体

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
font-size: 14px; /* base */
```

### 组件模式

```vue
<template>
  <div class="page-container">
    <div class="page-header">
      <h2>页面标题</h2>
      <el-button type="primary">操作</el-button>
    </div>
    <el-card shadow="never" class="content-card">
      <!-- 内容 -->
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-container { padding: 20px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.content-card { border-radius: 10px; }
</style>
```

---

## React Native 设计规范

**技术栈**: Expo 53+ / React Native Paper (MD3) / StyleSheet.create()

### 颜色

| Token | 值 | 用途 |
|-------|----|------|
| primary | `#1890FF` | 主色 |
| secondary | `#5856D6` | 辅助色 |
| success | `#34C759` | 成功 |
| warning | `#FFCC00` | 警告 |
| error | `#FF3B30` | 错误 |
| background | `#F5F5F5` | 页面背景 |
| surface | `#FFFFFF` | 卡片背景 |
| textPrimary | `#1F2937` | 主文字 |
| textSecondary | `#6B7280` | 辅助文字 |
| border | `#E5E7EB` | 边框 |
| primaryContainer | `#E6F7FF` | 浅蓝容器 |

### 间距

```typescript
const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, section: 40 };
```

### 圆角

```typescript
const borderRadius = { xs: 4, s: 8, m: 12, l: 16, xl: 24, round: 999 };
```

### 阴影

```typescript
const shadows = {
  small: Platform.select({
    ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 2 },
  }),
  medium: Platform.select({
    ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
  }),
};
```

### 按钮尺寸

| Size | Height | paddingH | fontSize |
|------|--------|----------|----------|
| small | 32 | 12 | 13 |
| medium | 44 | 20 | 15 |
| large | 56 | 32 | 17 |

### 组件模式

优先使用项目已有组件: `ScreenWrapper`, `NeoCard`, `NeoButton`, `StatusBadge`。

```tsx
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { NeoCard } from '@/components/common/NeoCard';

export default function MyScreen() {
  return (
    <ScreenWrapper title="页面标题">
      <NeoCard variant="elevated" style={{ marginBottom: spacing.l }}>
        {/* 内容 */}
      </NeoCard>
    </ScreenWrapper>
  );
}
```

`ScreenWrapper` 包含 SafeAreaView + max-width 500 居中。

---

## 微信小程序设计规范

**技术栈**: WXML + WXSS + CSS vars on `page{}` + ColorUI v2.1.4

### 颜色 — 双主题

| Token | 消费端 (C端) | 商家端 (B端) |
|-------|-------------|-------------|
| primary | `#52c41a` 绿 | `#C9A86C` 金 |
| bg-page | `#f5f5f5` | `#f5f5f5` |
| bg-card | `#ffffff` | `#ffffff` |
| text-primary | `#333333` | `#333333` |
| text-secondary | `#666666` | `#666666` |
| text-hint | `#aaaaaa` | `#aaaaaa` |
| tab-active | `#2967ff` | `#C9A86C` |

商家端 Header: `linear-gradient(135deg, #1A1A1A, #2D2D2D)` 黑金主题。

### 布局

- 导航栏背景: `#fefefe`，文字: black
- Header 高度: 约 `88rpx` (含状态栏)
- TabBar: 4 tabs，底色 `#ffffff`
- 安全区: `padding-top: constant(safe-area-inset-top); padding-top: env(safe-area-inset-top);`

### 间距与圆角 (rpx)

- 内容间距: `30rpx`
- 区块间距: `20rpx`
- 卡片圆角: `16rpx`
- 标准圆角: `6rpx`
- 全圆: `5000rpx`
- 阴影: `0 4rpx 20rpx rgba(0,0,0,0.08)`

### 字体

- 默认: `28rpx`
- 标题: `34rpx` bold
- 辅助: `24rpx`
- 小字: `22rpx`
- 大图标: `44rpx`

### 组件模式

```html
<view class="container">
  <view class="card">
    <text class="card-title">标题</text>
    <text class="card-desc">描述文字</text>
  </view>
</view>
```

```css
.container { padding: 0 20rpx; background: #f5f5f5; }
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
}
.card-title { font-size: 34rpx; font-weight: bold; color: #333; }
.card-desc { font-size: 24rpx; color: #666; margin-top: 10rpx; }
```

ColorUI 类名可直接使用: `cu-card`, `cu-bar`, `cu-avatar`, `cu-tag`, `cu-btn`。

---

## 跨平台 Token 映射

| Token | Vue Web Admin | React Native | 小程序 (消费/商家) |
|-------|--------------|-------------|-------------------|
| primary | `#1B65A8` | `#1890FF` | `#52c41a` / `#C9A86C` |
| bg-page | `#F4F6F9` | `#F5F5F5` | `#f5f5f5` |
| bg-card | `#ffffff` | `#ffffff` | `#ffffff` |
| text-primary | `#1A2332` | `#1F2937` | `#333` |
| text-secondary | `#7A8599` | `#6B7280` | `#666` |
| spacing-base | `16px` | `16` | `30rpx` |
| radius-card | `10px` | `12` | `16rpx` |
| shadow-card | blue-tinted rgba | Platform.select | `rgba(0,0,0,0.08)` |
| font-base | `14px` | `15` | `28rpx` |

---

## 与现有 Skill 协作

| 场景 | 先用 | 再用 |
|------|------|------|
| 从截图提取设计 → 实现 | `ui-designer` | `design-system` |
| 实现后审计合规性 | `design-system` | `web-design-guidelines` |
| 创建高质量独立页面 | `frontend-design` | `design-system` (保证平台一致性) |
