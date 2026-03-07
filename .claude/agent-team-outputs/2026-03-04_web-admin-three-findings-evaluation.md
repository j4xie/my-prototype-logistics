# Web-Admin 全站测试目录三大发现评估报告

**日期**: 2026-03-04
**模式**: Full | 语言: Chinese
**增强项**: Codebase Grounding: ON | Browser: OFF (额度限制)

---

## 执行摘要

Web-admin 全站审计揭示三大系统性问题：(1) `useChartResize` 组合式函数已编写但 31 处图表实例零采用，全部手写 `window.addEventListener('resize')`；(2) 5 条核心业务工作流存在状态显示错误、步骤跳过、防重复提交缺失等缺陷；(3) 多处"基础设施写了但没用"的模式——后端 API 就绪但前端按钮未接线或功能为 stub。经代码验证，ECharts 零采用和调拨 REJECTED 显示错误为高置信度事实，工作流防重和排产大小写问题需进一步验证。总修复工作量估算约 **12-17 人天**。

---

## 一、三维对比矩阵

| 评估维度 | 严重问题数 | 影响范围 | 后端就绪度 | 修复复杂度 | 用户可感知度 |
|---------|-----------|---------|-----------|-----------|------------|
| **ECharts 图表（28实例）** | 9 个 (5星级) | 全部图表页面 | N/A (纯前端) | 中等 | 中（侧边栏切换/dialog 内可触发） |
| **工作流状态（5页面）** | 6 个 (5星级) | 调拨/采购/销售/排产/领料 | 高（API 已存在） | 低-中 | **高（直接影响业务操作）** |
| **Stub+断线（4+9）** | 12 个 (5星级) | 6 个业务模块 | 高（7/9组 API 就绪） | 中-高 | **极高（按钮点击无反应）** |

### 各子项细分

| 子项 | 严重性 | 技术债务类型 | 修复工作量 | 业务阻断 |
|-----|-------|------------|-----------|---------|
| useChartResize 未采用 (31处) | 5星 | 架构断裂 | 3天 | 否 |
| trends/index.vue 三重缺陷 | 5星 | 内存泄漏+DOM耦合 | 0.5天 | 否 |
| ProductionAnalysis 全量导入+无resize | 5星 | 包体积+内存 | 1天 | 否 |
| ref→shallowRef (15处) | 5星 | 性能 | 0.5天 | 否 |
| MapChart CDN 依赖 | 5星 | 可用性风险 | 0.5天 | 潜在 |
| **调拨 REJECTED 显示错误** | 5星 | 逻辑缺陷 | 0.5天 | **是** |
| **采购 QC 步骤跳过** | 5星 | 流程缺失 | 1天 | **是** |
| **销售 PICKED 状态孤立** | 5星 | 流程缺失 | 0.5天 | **是** |
| **领料审批量硬编码** | 5星 | 业务逻辑错误 | 0.5天 | **是** |
| 排产大小写不一致 | 5星 | 需验证 | 0.3天 | **待定** |
| 设备维护 stub (后端就绪) | 5星 | 集成断裂 | 1.5天 | **是** |
| 供应商/客户新增未接线 | 5星 | 集成断裂 | 1天 | **是** |
| 质检新建/详情未接线 | 5星 | 集成断裂 | 1天 | **是** |
| 原材料入库未接线 | 5星 | 集成断裂 | 1天 | **是** |

---

## 二、共识与分歧

### 全员共识（高置信度）

| 发现 | 置信度 | 验证方式 |
|------|--------|----------|
| `useChartResize` 零采用 | **95%** | Grep 确认：仅定义文件自身匹配，31处手写resize |
| 调拨 REJECTED → el-steps step 0 | **95%** | 源码验证：statusSteps不含REJECTED，indexOf返回-1→取0 |
| 全局无防重提交机制 | **90%** | 5条工作流均未见 isSubmitting/loading 防重逻辑 |
| 领料审批量硬编码 | **85%** | `approveRequisition(factoryId, row.id, { actualQuantity: row.requestedQuantity })` |
| SmartBI ref非shallowRef | **90%** | useChartResize.ts 内部正确用了 shallowRef，但业务组件未跟进 |

### 存在分歧（经 Critic 修正）

| 发现 | Analyst | Critic | 最终判定 |
|------|---------|--------|----------|
| ECharts迁移优先级 | P2 (5-6天) | P3 (2-3天)，window.addEventListener是官方推荐 | **采纳Critic: P3, 3天** |
| 排产detail缺confirm | P1修复项 | 架构分工——confirm在list.vue已有 | **采纳Critic: 移除P1** |
| 成本分析为"纯stub" | P3 stub | 186行含API+卡片，是半完成 | **采纳Critic: 重归类为"图表补全"** |
| 排产大小写 | P0紧急 | 60%置信度，存在迁移脚本 | **降为条件性修复** |

---

## 三、跨维度交叉模式

### 模式 1：基础设施写了但没用（Infrastructure-Adoption Gap）

**核心发现**。`useChartResize.ts` 已解决全部图表问题（ResizeObserver、shallowRef、自动dispose），但28图表实例零采用。后端 `EquipmentController` 提供3个维护API，但前端是纯stub。说明项目存在"写基础设施"和"写业务页面"之间的断层。

### 模式 2：全站无防御性提交保护

5个工作流全部缺少 `isSubmitting` 防重。结合 API 调用 `success=false` 时静默失败，用户双击可产生重复请求且感知不到操作失败。

### 模式 3：状态枚举前后端不对齐

调拨 REJECTED/CANCELLED 不在 statusSteps 中→显示错误。排产可能存在大小写不一致。采购 PENDING_QC 被跳过。根因：前后端没有共享状态枚举定义。

### 模式 4：正面案例证明团队有能力

三个完全正确的实现：`quality/disposals/list.vue`（按钮全接线）、`warehouse/shipments/list.vue`（CRUD完整）、`production/plans/list.vue`（7个handler+AI+Import/Export）。问题不是技术能力不足，而是质量标准不均匀。

---

## 四、ECharts 图表实例完整清单（28个）

### SmartBI 组件层（14个，通过 DynamicChartRenderer 间接使用）

| # | 组件 | 图表类型 | resize | dispose | 问题 |
|---|------|---------|--------|---------|------|
| 1 | DynamicChartRenderer.vue | 多类型(14种) | window.addEventListener | onUnmounted ✅ | dialog时序(nextTick非setTimeout) |
| 2 | TrendChart.vue | line/area | window.addEventListener | onUnmounted ✅ | ref非shallowRef, 双重watch |
| 3 | PieChart.vue | pie/donut | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 4 | RadarChart.vue | radar | window.addEventListener | onUnmounted ✅ | 高度依赖字符串prop可能塌陷 |
| 5 | HeatmapChart.vue | heatmap | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 6 | GaugeChart.vue | gauge | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 7 | MapChart.vue | map(China) | window.addEventListener | onUnmounted ✅ | **CDN依赖geo.datav.aliyun.com** |
| 8 | WaterfallChart.vue | bar(stacked) | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 9 | NestedDonutChart.vue | pie×2 | window.addEventListener | onUnmounted ✅ | _originalData绕过类型系统 |
| 10 | YoYMoMComparisonChart.vue | bar+line | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 11 | RankingChart.vue | bar(水平) | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 12 | CombinedChart.vue | bar+line混合 | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 13 | BudgetAchievementChart.vue | bar+line双轴 | window.addEventListener | onUnmounted ✅ | ref非shallowRef |
| 14 | CategoryStructureComparisonChart.vue | bar+line/pie×2 | window.addEventListener | onUnmounted ✅ | 视图切换无过渡 |

### View 层直接使用（14个）

| # | 页面 | 图表数 | 类型 | resize | dispose | 严重问题 |
|---|------|-------|------|--------|---------|---------|
| 15-17 | analytics/trends/index.vue | 3 | line×2+bar | window(永不清除) | **无onUnmounted** | **getElementById+泄漏+listener累积** |
| 18-21 | ProductionAnalysis.vue | 4 | line×2+bar+pie | **无** | 重渲染前dispose | **无resize+全量echarts+无主题** |
| 22-25 | EfficiencyAnalysis.vue | 4 | line+bar×2+heatmap | **无** | 重渲染前dispose | **无resize+全量echarts+无主题** |
| 26 | MetricsTrendChart.vue | 1 | line×4 | window.addEventListener | onUnmounted ✅ | 空数据用el-empty遮盖 |
| 27-28 | CalibrationDetailView.vue | 2 | radar+line | 待确认 | 待确认 | 需进一步确认 |

---

## 五、工作流状态流转详情

### 1. 调拨流转 (Transfer) — `transfer/detail.vue`

**状态**: DRAFT→REQUESTED→APPROVED→SHIPPED→RECEIVED→CONFIRMED（+ REJECTED/CANCELLED 终止态）
**已确认Bug**: REJECTED/CANCELLED 在 el-steps 显示为"草稿"（step 0）
**修复**: `currentStep()` 对终止态返回特殊标记 + el-steps 增加 error 分支

### 2. 采购订单 (Procurement) — `procurement/orders/detail.vue`

**采购状态**: DRAFT→SUBMITTED→APPROVED→PARTIAL_RECEIVED→COMPLETED
**收货子状态**: DRAFT→**PENDING_QC(被跳过)**→CONFIRMED
**已确认Bug**: 收货确认按钮条件 `row.status === 'DRAFT'` 直接跳过质检步骤
**修复**: 补充 PENDING_QC 操作按钮

### 3. 销售订单 (Sales) — `sales/orders/detail.vue`

**销售状态**: DRAFT→CONFIRMED→PROCESSING(隐式)→PARTIAL_DELIVERED→COMPLETED
**发货子状态**: DRAFT→**PICKED(孤立)**→SHIPPED→DELIVERED
**已确认Bug**: 无"确认拣货"按钮，PICKED 状态无法触达
**修复**: 添加拣货按钮 或 移除 PICKED 状态

### 4. 领料/损耗审批 — `requisitions/list.vue` + `wastage/list.vue`

**共享状态**: DRAFT→SUBMITTED→APPROVED/REJECTED
**已确认Bug**: 审批量硬编码 `actualQuantity: row.requestedQuantity`
**已确认Bug**: 损耗允许 REJECTED→重提交，领料不允许（不一致）

### 5. 排产计划 (Scheduling) — `scheduling/plans/detail.vue`

**计划状态**: draft→confirmed→in_progress→completed
**排程行状态**: pending→in_progress→completed
**争议项**: detail 页缺 confirm 按钮（Critic 认为是架构分工，list.vue 已有）
**待验证**: 大小写是否一致（存在 `migrate_scheduling_status_uppercase.sql` 迁移脚本）

### 全局共性问题

- **无防重提交**: 5个工作流均无 isSubmitting 保护
- **API 失败静默**: `if (res.success)` 有提示，else 分支缺失
- **canWrite 粗粒度**: 无角色分离（申请人和审批人是同一权限）

---

## 六、Stub 页面与未接线按钮

### Stub 页面（4个）

| 页面 | 文件 | 实际状态 | 后端API | 修复工作量 |
|------|------|---------|---------|-----------|
| 角色管理 | system/roles/index.vue | 纯stub (17行) | 部分(仅角色分配) | 3-5天(需后端) |
| 设备维护 | equipment/maintenance/index.vue | 纯stub (17行) | **完整**(3个API) | 1.5天 |
| 批次详情 | production/batches/detail.vue | 轻度stub (20行) | 完整 | 1天 |
| 成本分析 | finance/costs/index.vue | **半完成**(186行,含API+卡片) | 无专用controller | 0.5天(补图表) |

### 未接线按钮（9组，13个按钮）

| 页面 | 按钮 | 后端API | 难度 | 优先级 |
|------|------|---------|------|--------|
| 供应商管理 | 新增/查看/编辑/删除 | **完整** | 中 | P1 |
| 客户管理 | 新增/查看/编辑/删除 | **完整** | 中 | P1 |
| 员工管理 | 添加/查看/编辑 | **完整**(含导入) | 中 | P2 |
| 设备管理 | 添加/维护/编辑 | **完整** | 中 | P1 |
| 质检记录 | 新建/查看详情 | 完整 | 中 | P1 |
| 原材料批次 | 入库/查看/编辑 | 完整 | 中 | P2 |

### 正面案例（已完成页面）

- `quality/disposals/list.vue` — 按钮全接线，对话框完整，审批流程完整
- `warehouse/shipments/list.vue` — 新建/发货/送达/取消全有handler
- `production/plans/list.vue` — 7个handler + AI Chat + Import/Export（最成熟页面）

---

## 七、最终优先级与建议

### P0 — 立即修复（3-4 天）

| # | 问题 | 文件 | 方案 | 工作量 |
|---|------|------|------|--------|
| 1 | 调拨 REJECTED 显示错误 | transfer/detail.vue | currentStep() 对终止态特殊处理 | 0.5天 |
| 2 | 5工作流防重提交 | 5个detail/list文件 | 提取 useSubmitGuard composable | 1天 |
| 3 | API 失败静默吞错 | 所有workflow文件 | 统一 catch→ElMessage.error | 1天 |
| 4 | 采购 QC 步骤接入 | procurement/orders/detail.vue | 补质检操作按钮 | 1天 |

### P1 — 短期修复（3-5 天）

| # | 问题 | 方案 | 工作量 |
|---|------|------|--------|
| 5 | 设备/供应商/客户/质检按钮接线 | 参照disposals.vue模式补对话框 | 3天 |
| 6 | 领料审批量改为可编辑 | ElMessageBox.prompt输入actualQuantity | 0.5天 |
| 7 | 损耗vs领料重提交统一 | 领料补REJECTED→SUBMITTED路径 | 0.5天 |
| 8 | 销售PICKED状态处理 | 添加拣货按钮 或 移除PICKED | 0.5天 |

### P-条件 — 验证后决定

| # | 问题 | 验证方法 | 如果需要修复 |
|---|------|---------|-------------|
| 9 | 排产大小写 | 查询生产DB: `SELECT DISTINCT status FROM scheduling_plans` | 前端加.toUpperCase()兼容 |
| 10 | MapChart CDN | 测试内网环境能否访问geo.datav.aliyun.com | 下载GeoJSON到public/ |

### P3 — 渐进改进（3 天）

| # | 问题 | 方案 | 工作量 |
|---|------|------|--------|
| 11 | 28图表迁移useChartResize | 逐文件替换手写addEventListener | 3天 |
| 12 | trends/index.vue重构 | getElementById→ref, 补onUnmounted | 0.5天 |
| 13 | ProductionAnalysis全量导入 | import * as echarts→@/utils/echarts | 0.5天 |

```
P0 (立即, 3-4天)     ████████░░  调拨REJECTED + 防重 + 静默失败 + 采购QC
P1 (短期, 3-5天)     ██████░░░░  按钮接线 + 审批量 + 损耗统一 + PICKED
P-条件 (验证后)      ████░░░░░░  排产大小写 + MapChart CDN
P3 (渐进, 3天)       ███░░░░░░░  useChartResize迁移 + trends重构 + 全量导入
                     ─────────────────────────────────────
                     总计: 12-17人天
```

---

## 八、开放问题

| # | 问题 | 影响 | 验证方式 |
|---|------|------|---------|
| Q1 | 排产status在生产DB中是大写还是小写？ | 排产模块全部状态判断 | 直接查询生产数据库 |
| Q2 | 6模块按钮未接线是设计选择还是遗漏？ | P1工作量可能减半 | 与产品确认PRD |
| Q3 | 后端工作流API是否有幂等性保护？ | 防重优先级可降 | 检查Controller层 |
| Q4 | MapChart CDN在内网是否可访问？ | 地图可能空白 | 目标环境测试 |
| Q5 | 销售PICKED是已废弃状态？ | 决定补全或移除 | 检查DB中PICKED记录数 |
| Q6 | useChartResize是否需要可选主题参数？ | 迁移时部分组件可能行为变化 | 审查composable实现 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3 (sonnet)
- Browser explorer: OFF (usage limit reached)
- Total source files scanned: 67+
- Key disagreements: 3 resolved (ECharts priority↓, scheduling confirm→removed, cost stub→reclassified), 2 unresolved (scheduling case, PICKED status)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (internal codebase evaluation)
- Healer: All checks passed ✅
- Competitor profiles: N/A
