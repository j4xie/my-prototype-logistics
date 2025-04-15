# 按钮问题报告

**生成时间**: 2025/4/5 17:05:48

## 概要

| 指标 | 值 | 百分比 |
| ---- | ---- | ---- |
| 总按钮数 | 411 | 100% |
| 具有唯一ID的按钮 | 292 | 71.05% |
| 具有无障碍属性的按钮 | 337 | 82.00% |
| 具有视觉反馈的按钮 | 292 | 71.05% |

## 优先级页面

以下是按问题按钮数量排序的页面，建议按此顺序修复：

| 优先级 | 页面 | 问题按钮数 | 总按钮数 | 问题比率 |
| ---- | ---- | ---- | ---- | ---- |
| 1 | `/pages/farming/data-verification.html` | 61 | 22 | 277% |
| 2 | `/pages/farming/auto-monitoring.html` | 41 | 14 | 293% |
| 3 | `/pages/farming/data-collection-center.html` | 40 | 15 | 267% |
| 4 | `/pages/farming/qrcode-collection.html` | 38 | 14 | 271% |
| 5 | `/pages/farming/prediction-analytics.html` | 30 | 13 | 231% |
| 6 | `/pages/farming/model-management.html` | 29 | 11 | 264% |
| 7 | `/pages/farming/manual-collection.html` | 26 | 10 | 260% |
| 8 | `/pages/farming/indicator-detail.html` | 23 | 9 | 256% |
| 9 | `/pages/farming/prediction-config.html` | 14 | 6 | 233% |
| 10 | `/pages/coming-soon.html` | 10 | 5 | 200% |

## 缺少唯一ID的按钮

共有 **119** 个按钮缺少唯一ID.

| 页面 | 按钮文本 | 按钮类型 | 类名 |
| ---- | ---- | ---- | ---- |
| `/pages/coming-soon.html` | 返回 | button | trace-top-nav-back |
| `/pages/coming-soon.html` | 搜索 | button | trace-top-nav-button |
| `/pages/coming-soon.html` | 更多选项 | button | trace-top-nav-button |
| `/pages/coming-soon.html` | 刷新 | button | icon-btn |
| `/pages/coming-soon.html` | 返回上一页 | button | mt-6 px-4 py-2 bg-blue-500 text-white... |
| `/pages/farming/auto-monitoring.html` | 监控设置 | button | icon-btn |
| `/pages/farming/auto-monitoring.html` | B-2023-12 | button | batch-item active |
| `/pages/farming/auto-monitoring.html` | B-2023-11 | button | batch-item |
| `/pages/farming/auto-monitoring.html` | B-2023-10 | button | batch-item |
| `/pages/farming/auto-monitoring.html` | B-2023-09 | button | batch-item |
| `/pages/farming/auto-monitoring.html` | 刷新 | button | text-blue-500 text-sm flex items-center |
| `/pages/farming/auto-monitoring.html` | 温度 | button | px-3 py-1 bg-blue-100 text-blue-600 r... |
| `/pages/farming/auto-monitoring.html` | 湿度 | button | px-3 py-1 bg-gray-100 text-gray-600 r... |
| `/pages/farming/auto-monitoring.html` | 氨气浓度 | button | px-3 py-1 bg-gray-100 text-gray-600 r... |
| `/pages/farming/auto-monitoring.html` | 光照强度 | button | px-3 py-1 bg-gray-100 text-gray-600 r... |
| `/pages/farming/auto-monitoring.html` | 饲料消耗 | button | px-3 py-1 bg-gray-100 text-gray-600 r... |
| `/pages/farming/auto-monitoring.html` | 处理 | button | text-blue-500 text-sm px-3 py-1 borde... |
| `/pages/farming/auto-monitoring.html` | 修改 | button | text-blue-500 text-sm |
| `/pages/farming/auto-monitoring.html` | 校准 | button | text-blue-500 text-sm |
| `/pages/farming/data-collection-center.html` | 返回 | button | trace-top-nav-back |
| `/pages/farming/data-collection-center.html` | 搜索 | button | trace-top-nav-button |
| `/pages/farming/data-collection-center.html` | 更多选项 | button | trace-top-nav-button |
| `/pages/farming/data-collection-center.html` | 筛选数据 | button | icon-btn mr-2 |
| `/pages/farming/data-collection-center.html` | 刷新数据 | button | icon-btn |
| `/pages/farming/data-collection-center.html` | 全部批次 | button | status-tag info mr-2 whitespace-nowrap |
| `/pages/farming/data-collection-center.html` | B-2023-12 | button | status-tag mr-2 whitespace-nowrap |
| `/pages/farming/data-collection-center.html` | B-2023-11 | button | status-tag mr-2 whitespace-nowrap |
| `/pages/farming/data-collection-center.html` | B-2023-10 | button | status-tag mr-2 whitespace-nowrap |
| `/pages/farming/data-collection-center.html` | B-2023-09 | button | status-tag mr-2 whitespace-nowrap |
| `/pages/farming/data-collection-center.html` | 查看详情 | button | text-blue-500 text-sm flex items-center |

... 及其他 89 个按钮

## 缺少无障碍属性的按钮

共有 **74** 个按钮缺少无障碍属性（aria-label或tabindex）.

| 页面 | 按钮文本 | 按钮类型 | ID |
| ---- | ---- | ---- | ---- |
| `/pages/farming/auto-monitoring.html` | B-2023-12 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-11 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-10 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-09 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 刷新 | button | refresh-status-btn |
| `/pages/farming/auto-monitoring.html` | 温度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 湿度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 氨气浓度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 光照强度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 饲料消耗 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 处理 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 修改 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 校准 | button | 无ID |
| `/pages/farming/data-collection-center.html` | 全部批次 | button | all-batches-btn |
| `/pages/farming/data-collection-center.html` | B-2023-12 | button | b202312-btn |
| `/pages/farming/data-collection-center.html` | B-2023-11 | button | b202311-btn |
| `/pages/farming/data-collection-center.html` | B-2023-10 | button | b202310-btn |
| `/pages/farming/data-collection-center.html` | B-2023-09 | button | b202309-btn |
| `/pages/farming/data-collection-center.html` | 查看详情 | button | viewDataDetailBtn |
| `/pages/farming/data-collection-center.html` | 查看全部采集任务 | button | viewAllStatusBtn |
| `/pages/farming/data-collection-center.html` | 查看历史 | button | viewHistoryBtn |
| `/pages/farming/data-collection-center.html` | 加载更多数据 | button | moreDataBtn |
| `/pages/farming/data-collection-center.html` | 配置设置 | button | configCollectionBtn |
| `/pages/farming/data-verification.html` | 全部批次 | button | all-batches-btn |
| `/pages/farming/data-verification.html` | B-2023-12 | button | b202312-btn |
| `/pages/farming/data-verification.html` | B-2023-11 | button | b202311-btn |
| `/pages/farming/data-verification.html` | B-2023-10 | button | b202310-btn |
| `/pages/farming/data-verification.html` | 批量通过 | button | batch-approve-btn |
| `/pages/farming/data-verification.html` | 批量退回 | button | batch-reject-btn |
| `/pages/farming/data-verification.html` | 查看详情 | button | view-detail-btn |

... 及其他 44 个按钮

## 缺少视觉反馈的按钮

共有 **119** 个按钮缺少视觉反馈（hover/focus/active效果）.

| 页面 | 按钮文本 | 按钮类型 | ID |
| ---- | ---- | ---- | ---- |
| `/pages/coming-soon.html` | 返回 | button | nav-back-button |
| `/pages/coming-soon.html` | 搜索 | button | nav-search-button |
| `/pages/coming-soon.html` | 更多选项 | button | nav-more-button |
| `/pages/coming-soon.html` | 刷新 | button | refreshBtn |
| `/pages/coming-soon.html` | 返回上一页 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 监控设置 | button | settingsBtn |
| `/pages/farming/auto-monitoring.html` | B-2023-12 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-11 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-10 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | B-2023-09 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 刷新 | button | refresh-status-btn |
| `/pages/farming/auto-monitoring.html` | 温度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 湿度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 氨气浓度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 光照强度 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 饲料消耗 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 处理 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 修改 | button | 无ID |
| `/pages/farming/auto-monitoring.html` | 校准 | button | 无ID |
| `/pages/farming/data-collection-center.html` | 返回 | button | nav-back-button |
| `/pages/farming/data-collection-center.html` | 搜索 | button | nav-search-button |
| `/pages/farming/data-collection-center.html` | 更多选项 | button | nav-more-button |
| `/pages/farming/data-collection-center.html` | 筛选数据 | button | filterBtn |
| `/pages/farming/data-collection-center.html` | 刷新数据 | button | refreshBtn |
| `/pages/farming/data-collection-center.html` | 全部批次 | button | all-batches-btn |
| `/pages/farming/data-collection-center.html` | B-2023-12 | button | b202312-btn |
| `/pages/farming/data-collection-center.html` | B-2023-11 | button | b202311-btn |
| `/pages/farming/data-collection-center.html` | B-2023-10 | button | b202310-btn |
| `/pages/farming/data-collection-center.html` | B-2023-09 | button | b202309-btn |
| `/pages/farming/data-collection-center.html` | 查看详情 | button | viewDataDetailBtn |

... 及其他 89 个按钮

## 解决方案

### 自动修复

可以使用自动修复脚本处理大部分问题：

```bash
# 运行自动修复脚本
npm run fix:buttons
```

### 手动修复

1. **唯一ID**：每个按钮应该添加一个唯一的ID属性：
```html
<button id="unique-button-id">按钮文本</button>
```

2. **无障碍属性**：按钮应包含适当的无障碍属性：
```html
<button id="submit-btn" aria-label="提交表单" tabindex="0">提交</button>
```

3. **视觉反馈**：按钮应提供视觉反馈：
```html
<button class="hover:shadow-md hover:opacity-90 focus:outline-none focus:ring-2 active:transform active:scale-95">按钮</button>
```

