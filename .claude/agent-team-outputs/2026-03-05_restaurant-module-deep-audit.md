# 餐饮模块深度评估报告

**日期**: 2026-03-05
**模式**: Full | Language: Chinese | Grounding: ENABLED

---

## 执行摘要

餐饮模块包含4个CRUD页面（配方/领料/盘点/损耗）+ Dashboard，核心增删改查功能完整可用。最关键的问题是**前端统计卡片调用了错误的后端端点**：领料页调用`daily-summary`（返回食材聚合数据）而非`/statistics`（返回计数数据），导致统计卡片全显0。此问题修复成本极低（改一个API调用路径）。TypeScript类型安全存在约41处`any`，其中约10处为可操作的业务类型缺失。与工厂模块对比，餐饮在日期筛选和导出覆盖率上反超，但缺少timeline和审计历史。整体质量**中等偏上**，可在4-6小时内完成全部高优先级修复。

---

## 共识与分歧映射

### 全员共识（高置信度）

| 编号 | 发现 | 置信度 |
|------|------|--------|
| C1 | 领料`daily-summary`端点返回`{date, materialCount, items}`，前端期望`{todayCount, pendingCount, ...}`，统计卡片显0 | **95%** |
| C2 | `formRef = ref()`缺少`FormInstance`泛型（5处） | **95%** |
| C3 | `tableData`和`detailData`使用`any`（8处核心+33处受限于第三方库） | **95%** |
| C4 | Dashboard组件零any，类型质量良好 | **95%** |
| C5 | 导出使用`size: pagination.value.total`无上限（真实风险是内存压力而非502） | **90%** |

### 存在分歧的发现

| 编号 | R-A/R-C观点 | Critic观点 | 最终判定 |
|------|-------------|------------|----------|
| D1 | 统计卡片显0为P0 | P1（修复极简，不影响CRUD） | **P1** |
| D2 | 41处any严重违规 | 仅8-12处可操作 | **同意Critic** |
| D3 | BOM竞态需AbortController | API<100ms，最坏UI闪烁 | **P3** |
| D4 | loadStatistics永false是bug | 可能是设计选择 | **加fallback提示** |
| D5 | 导出>2000条502 | 手动PageRequest无限制 | **同意Critic，加内存安全阀** |

---

## 优先级行动计划

### P1 — 立即修复（预计2-3小时）

**1. 领料统计端点调用修正**
- 文件: `web-admin/src/views/restaurant/requisitions/list.vue:222-236`
- 问题: `getRequisitionDailySummary()`调用`/daily-summary`，返回食材聚合而非计数
- 修复: 改调`/statistics`端点（或新增`getRequisitionStatistics`），对齐字段名

**2. 配方搜索keyword后端支持**
- 文件: `backend/.../RecipeController.java`
- 问题: 前端传`keyword`参数但后端不接收
- 修复: 后端添加`@RequestParam(required=false) String keyword`

**3. 配方摘要字段对齐**
- 文件: `recipes/list.vue:203-213` + `RecipeController.java`
- 问题: 前端期望`totalRecipes/activeRecipes/dishCount`，后端返回`totalProducts/totalRecipeLines`
- 修复: 前端增加`totalProducts`别名到fallback链，或后端增加字段

### P2 — 短期改进（预计1-2小时）

**4. 核心业务类型补全**
- 新增`types/restaurant.ts`定义`RequisitionItem/RecipeItem/WastageRecord/StocktakingRecord` interface
- 替换4页的`ref<any[]>` → `ref<XxxItem[]>`（约10处）
- `formRef`加`ref<FormInstance>()`（5处）

**5. 导出安全阀**
- `handleExport`中`Math.min(pagination.value.total, 5000)` + 超限提示

### P3 — 按需改进

**6. loadStatistics失败降级** — 加`statsLoadFailed`标志+重试按钮
**7. BOM watcher防抖** — `debounce(300)`简单有效
**8. restaurant.ts API泛型** — `Record<string, unknown>` → 具体interface

### 不建议当前投入

- Timeline/审计历史：新功能需求，非bug
- 批量多选：全站级需求，工厂也缺
- CSS `!important`清理：影响极小

---

## 工厂模块对比总结

| 维度 | 餐饮 | 工厂 | 评价 |
|------|------|------|------|
| 日期范围筛选 | 4/4 | 0/3 | 餐饮领先 |
| 前端导出 | 4/4 | 1/3 | 餐饮领先 |
| 统计卡片 | 4/4（数据不准） | 1/3 | 持平 |
| BOM自动计算 | 有 | 无 | 餐饮独有优势 |
| Timeline/历史 | 无 | 批次有 | 工厂领先 |
| 过期预警 | 无 | 库存有 | 工厂领先 |
| TypeScript | ~10处可操作any | 类似 | 持平 |

---

## API覆盖率

| 状态 | 数量 | 占比 |
|------|------|------|
| 已使用 | 24 | 92% |
| 零调用 | 1 (getRecipesByDish) | 4% |
| 后端有/前端无 | 1 (/statistics) | 4% |

---

## 开放问题

1. `/statistics`端点是否需扩展（缺"今日领料数"字段）
2. `getRecipesByDish`零调用是否有意保留
3. 配方搜索的范围需求确认（食材名/菜品名/配方名）
4. 统计卡片失败时的产品偏好（隐藏 vs 显示失败提示）

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (parallel)
- Browser explorer: OFF
- Total codebase files examined: ~15
- Key disagreements: 5 (all resolved — Critic downgraded 3 severity levels)
- Phases: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded, no external claims)
- Healer: 5 checks passed, 0 auto-fixed ✅

### Healer Notes: All checks passed ✅
