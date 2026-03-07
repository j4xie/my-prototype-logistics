# Web-Admin 移动端适配优化报告

**日期**: 2026-03-03
**状态**: 已完成并验证

## 概览

用最少改动让 Vue3 + ElementPlus 的 85+ 页面 web-admin 在手机/平板上可用，不破坏桌面体验。

## 改动统计

| 改动类型 | 文件数 | 新增行数 |
|---------|--------|---------|
| 全局 CSS 响应式规则 | 1 (style.css) | ~80 行 |
| CSS 变量批量替换 (padding) | 85 | 129 instances |
| 侧边栏/头部/布局组件 | 4 | ~60 行 (已在之前 session 完成) |
| 登录页适配 | 1 | ~20 行 (已在之前 session 完成) |

## Phase 1: 全局 CSS 快速修复 (style.css)

### T1-1: Token 去重
将 legacy 别名改为引用 canonical 变量：
- `--primary-color` → `var(--color-primary)`
- `--success-color` → `var(--color-success)`
- 等 8 个别名统一

### T1-2: 渐变变量 + Stat Icon 工具类
```css
--gradient-primary: linear-gradient(135deg, #1B65A8, #2B7EC1);
.stat-icon--primary { background: var(--gradient-primary); }
```

### T1-3: 语义色彩工具类
```css
.text-positive { color: var(--color-success) !important; }
.text-negative { color: var(--color-danger) !important; }
```

### T1-4: 移动端网格修复 (@media max-width: 768px)
- `.statistics-row` 加入 2 列网格选择器
- `.page-header` flex-wrap 防止标题竖排
- `.el-col-6/8/10/12` 强制 100% 宽度
- `.chart` 高度限制 260px（防止 Y 轴裁切）

## Phase 2: Padding 响应式批量替换

**核心修复**: 将 85 个文件中的 `padding: 20px` → `padding: var(--page-padding)`

效果链路：
```
:root { --page-padding: 20px; }           /* 桌面默认 */
@media (max-width: 768px) { --page-padding: 12px; }  /* 移动端 */
```

替换范围：
- 115 处 `padding: 20px;` → `padding: var(--page-padding);`
- 14 处 `padding: 20px 0;` → `padding: var(--page-padding) 0;`
- 3 处 `padding: 20px 24px;` → `padding: var(--page-padding) 24px;`
- 2 处内联 style 保留原值（CSS 变量不支持内联）

## Playwright 验证结果

### 移动端 (375x812)
| 页面 | 状态 | 截图 |
|------|------|------|
| 登录页 | ✅ 表单居中，按钮换行 | verify-mobile-login.png |
| 仪表盘 | ✅ Stat 卡片单列，侧边栏隐藏 | verify-mobile-dashboard.png |
| 调度中心 | ✅ 标题水平显示（不再竖排） | verify-mobile-scheduling.png |
| 趋势分析 | ✅ 图表全宽单列堆叠 | verify-mobile-trends.png |
| 库存盘点 | ✅ Stat 卡片单列 | verify-mobile-warehouse.png |
| HR 员工 | ✅ 表格可横向滚动 | verify-mobile-hr.png |
| 生产批次 | ✅ 搜索栏换行，表格可滚动 | verify-mobile-batches.png |

### 桌面端 (1920x1080)
| 页面 | 状态 | 截图 |
|------|------|------|
| 仪表盘 | ✅ 4 列 stat 卡片，布局正常 | verify-desktop-dashboard.png |
| 调度中心 | ✅ 标题+按钮同行，4 列 stat | verify-desktop-scheduling.png |
| 趋势分析 | ✅ 全宽+双列图表 | verify-desktop-trends.png |

## 已知残留问题

1. **Y 轴标签轻微裁切**: 趋势图在 375px 下 "合格率(%)" 显示为 "率(%)"。需 ECharts grid.left 调大，但属于 per-chart 配置非全局可修。
2. **表格列优先级**: HR 员工表只显示首尾列，中间需横滑。可考虑按优先级隐藏次要列（需 per-view 修改）。

## 文件改动清单

### 本次 Session 修改
- `web-admin/src/style.css` — +80 行全局响应式规则
- 85 个 `.vue` 文件 — padding 变量替换
- 5 个 `.vue` + 1 个 `.scss` — 复合 padding 变量替换

### 之前 Session 完成
- `web-admin/src/store/modules/app.ts` — isMobile 状态 + resize 监听
- `web-admin/src/components/layout/AppLayout.vue` — 移动端 overlay + margin 归零
- `web-admin/src/components/layout/AppSidebar.vue` — 移动端 drawer 模式
- `web-admin/src/components/layout/AppHeader.vue` — 汉堡菜单 + 隐藏面包屑
- `web-admin/src/views/login/index.vue` — 移动端表单适配
