# 餐饮模块前端完整性与质量评估

**日期**: 2026-03-04
**模式**: Full | 语言: Chinese | 代码库验证: ENABLED

---

## Executive Summary

- **总体评估**: 餐饮模块具备4个完整CRUD页面+Dashboard，基础可用但Dashboard数据源存在严重误导性错误（3/4卡片数据不准确），需优先修复
- **置信度**: 高 — 三组研究者交叉验证，Critic代码复核确认核心发现成立
- **关键风险**: Dashboard将`totalElements`（记录条数）显示为"今日领料单数"和"本月损耗金额"，用户会基于错误数据做经营决策
- **工作量**: P0修复约1-2人天（Dashboard数据源+路由module），P1约1人天（导出+表单验证），P2为项目级技术债
- **完成度**: 70-75%，核心CRUD功能完整，但Dashboard、类型安全、高级分析页缺失

---

## Consensus & Disagreements

| 议题 | 研究者发现 | 分析师判定 | Critic挑战 | 最终裁定 |
|------|-----------|-----------|-----------|---------|
| Dashboard数据准确性 | 3/4卡片数据错误 | P0，"形同虚设" | 3/4错误确认，但"形同虚设"过度悲观 | **P0维持**。3/4数据卡片误导用户，但导航功能正常 |
| loadData无catch严重性 | 3/4页loadData无catch | P1 | 降级P2——finally保证loading状态恢复 | **降为P2** |
| 路由module不一致 | meta.module='production'而非'restaurant' | 未特别标注 | 新发现P1，可能影响权限 | **P1** |
| 损耗导出缺失 | 缺导出按钮 | P0 | 降为P1——非数据错误 | **P1** |
| TypeScript类型 | 全部ref<any[]> | P2 | 项目级技术债，非餐饮独有 | **P2/项目级** |
| destroy-on-close | 全部Dialog缺失 | P2 | P3/可忽略 | **P3** |

---

## Comparison Matrix

| 评估维度 | 配方管理 | 领料管理 | 盘点管理 | 损耗管理 | Dashboard |
|----------|---------|---------|---------|---------|-----------|
| 表单验证 | 3/4字段 | 2/5字段(PRODUCTION漏) | 双表单正确 | 3/3最完整 | N/A |
| 错误处理 | 有catch ✅ | loadData无catch | loadData无catch | loadData无catch | Promise.allSettled ✅ |
| 导出功能 | ✅ | ✅ | ✅ | ❌ 缺失 | N/A |
| 数据准确性 | ✅ | ✅ | ✅ | ✅ | ❌ 3/4卡片错误 |
| API利用率 | 5/6 | 5/7 | 4/6 | 5/7 | 未用后端聚合接口 |

---

## Confidence Assessment

| 结论 | 置信度 | 依据 |
|------|--------|------|
| Dashboard 3/4卡片数据不准确 | ★★★★★ | 3组研究者一致，代码验证确认 |
| 路由module与canWrite不一致 | ★★★★★ | Critic发现，代码验证确认 |
| 后端聚合接口存在但前端未调用 | ★★★★☆ | 字段映射未实际验证 |
| 模块完成度70-75% | ★★★★☆ | 三方基本一致 |

---

## Actionable Recommendations

### Immediate / 立即执行（P0）
- **修复Dashboard数据源**: 调用后端`RestaurantDashboardController`聚合接口，获取正确的今日领料数、低库存数、本月损耗金额
  - 文件: `DashboardRestaurant.vue` (~30行改动)

### Short-term / 本周内（P1）
- **修复路由module标识**: `router/index.ts`第542-566行 `module: 'production'` → `module: 'restaurant'`（5处）
- **补充损耗导出功能**: `wastage/list.vue`添加导出按钮+handleExport函数
- **补全PRODUCTION模式表单验证**: `requisitions/list.vue`的productTypeId添加条件required规则

### Conditional / 视情况（P2-P3）
- loadData补catch+ElMessage.error（视用户反馈）
- TypeScript接口定义（全项目治理时）
- destroy-on-close可忽略

---

## Open Questions

1. 后端`RestaurantDashboardController`返回的字段结构是否与前端stats对象匹配？
2. 路由`module: 'production'`是否导致餐饮菜单对非production权限用户不可见？
3. PRODUCTION模式下后端是否有`@NotBlank`等校验兜底？
4. `getRecipesByDish`接口是否有前端使用场景？

---

## Process Note
- Mode: Full
- Researchers deployed: 3 (UI/UX, API对齐, 路由权限)
- Total source files examined: 10+
- Key disagreements: 4 resolved (loadData严重性, Dashboard定性, 损耗导出优先级, destroy-on-close)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Healer: All checks passed ✅
