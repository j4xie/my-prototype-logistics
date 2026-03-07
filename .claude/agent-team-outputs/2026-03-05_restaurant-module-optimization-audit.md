# 餐饮模块修复后状态评估与下一轮优化建议

**日期**: 2026-03-05
**模式**: Full | 语言: Chinese | Grounding: ENABLED

---

## Executive Summary

餐饮模块整体质量良好，在表单验证、useFactoryId、API 独立文件等 6 个维度已超越工厂模块基线。但 API 打通率仅 53%（17/28），存在 8 个前端函数零调用、4 个 CRUD 缺失。最关键的 P0 问题是 BOM 自动填料断路（calculate API 未对接）。建议分三轮迭代：第一轮 1 天修复 Quick Wins，第二轮补齐统计与搜索，第三轮按需处理。

## Immediate (P0, Day 1)

| # | 任务 | 预估 | 文件 |
|---|------|------|------|
| IM-1 | BOM自动填料对接 | 2h | requisitions/list.vue, restaurant.ts |
| IM-2 | Dashboard catch加ElMessage | 15min | DashboardRestaurant.vue |
| IM-3 | 详情抽屉改API fetch | 1h | wastage/requisitions/stocktaking |
| IM-4 | Cancel按钮disabled | 15min | 4个dialog |
| IM-5 | 清理as any | 30min | 4页 |

## Short-term (P1, Day 2-3)

| # | 任务 | 预估 |
|---|------|------|
| ST-1 | 统计卡片接入 | 3h |
| ST-2 | 文本搜索+日期范围 | 2h |
| ST-3 | 分页jumper+始终显示 | 1h |
| ST-4 | 清理/接入零调用函数 | 1h |

## Conditional (P2-P3)

- CD-1: 配方查看页面
- CD-2: usePagination推广
- CD-3: 全量导出
- CD-4: 无障碍aria-label
- CD-5: 移动端深度适配

## API打通率

- 后端28端点, 前端29函数, 实际打通17个(53%)
- 8个unused前端函数
- 3个后端端点无前端函数
- 4个缺失CRUD(wastage PUT, requisitions PUT/DELETE, stocktaking DELETE)

## Process Note

- Mode: Full
- Researchers deployed: 3
- Total sources: codebase evidence (68 tool calls)
- Phases: Research → Analysis → Critique [partial] → Integration → Heal
- Healer: All checks passed ✅
