# Playwright E2E 测试完整性评估报告：工序制生产 + Tool Governance

**日期**: 2026-03-13
**Agent Team**: 3 Researchers (sonnet) + Analyst (opus) + Critic (opus) + Integrator (opus)
**模式**: Full | Codebase Grounding: ENABLED

---

## 执行摘要

当前已有 10 个 Vue Playwright 测试（VUE-01~10）和 1 个 Maestro 移动端流程（#76），以及 12 个 RN 组件级 RNTL/Jest 测试。实际 Playwright 级 E2E 覆盖率约 **30-35%**（Vue 端）。主要缺口集中在三个方面：(1) Vue 端审批/治理页面的写操作测试（通过、驳回、批量审批）；(2) Maestro #76 因 testID 全部缺失将确定性失败；(3) 跨端数据流（RN 报工 → Vue 审批 → 数量回写）零覆盖。安全风险经验证被夸大（JwtAuthInterceptor 是主防线且正常工作），但 `/api/workflow` 两个 GET 端点确实无鉴权。

---

## 1. 代码验证结果（全部通过）

| 编号 | 声明 | 代码验证 | 置信度 |
|------|------|---------|--------|
| F1 | 5 个 RN 屏幕 testID 为零 | `grep testID` 返回空 | **99%** |
| F2 | Maestro #76 引用 6 个 testID 全不存在 | 已确认 | **99%** |
| F3 | `@EnableMethodSecurity` 未配置，150 个 `@PreAuthorize` 无效 | 已确认 | **99%** |
| F4 | `/api/workflow` 不在 JwtAuthInterceptor 拦截范围 | WebMvcConfig.java:41 | **99%** |
| F5 | 所有 E2E 测试仅用 `factory_admin1` | process-mode-e2e.spec.ts:6 | **99%** |
| F6 | Vue 审批写操作（通过/驳回/批量）未被 Playwright 测试 | VUE-04 只检查元素可见性 | **95%** |

---

## 2. 共识与分歧裁决

### 关键分歧

| 分歧 | 分析师观点 | 批评者挑战 | 最终裁决 |
|------|-----------|-----------|---------|
| 覆盖率 18% | Vue 22%, RN 40% | RN 混用 Jest/Playwright，实际 Playwright=0% | **Vue Playwright ~35%, RN Playwright 0%, RN RNTL ~65%** |
| @PreAuthorize "致命漏洞" | 致命风险 | JwtAuthInterceptor 是主防线，@PreAuthorize 是冗余层 | **低风险技术债**（主防线正常） |
| /api/workflow "致命漏洞" | 致命 | 仅 2 个 GET 元数据端点 | **低风险信息泄露** |
| 54 个新测试 | 12 天可完成 | 超出计划 108%，不现实 | **精简到 18-22 个，聚焦高价值** |
| workflow-designer 侧边栏缺失 | P0 | 可能有意设计 | **P1**（路由可 URL 直达） |

---

## 3. 遗漏功能点完整清单

### Part A: Vue Web-Admin 遗漏（按优先级）

#### P0 — 核心写操作未测试

| # | 遗漏 | 页面 | 源码引用 |
|---|------|------|---------|
| 1 | 审批通过（点"通过"按钮 → API → success） | `/production/approval` | `approval/list.vue:43-44` |
| 2 | 驳回（ElMessageBox.prompt 输入原因 + inputPattern:/.+/ 校验） | `/production/approval` | `approval/list.vue:59-65` |
| 3 | 批量审批（需先多选 → 按钮 v-if="selectedIds.length > 0"） | `/production/approval` | `approval/list.vue:115-120` |
| 4 | Skill-Tools 整页零测试（3 Tab + CRUD + 推荐采纳） | `/system/skill-tools` | `skill-tools/index.vue` |
| 5 | 创建 Skill 表单（JS 手动校验，非 el-form rules） | `/system/skill-tools` | `skill-tools/index.vue:122-129` |
| 6 | 删除 Skill（仅 database 来源可见 + ElMessageBox.confirm） | `/system/skill-tools` | `skill-tools/index.vue:102-120` |

#### P1 — 功能完整性

| # | 遗漏 | 源码引用 |
|---|------|---------|
| 7 | 编辑工序 | `work-processes/index.vue` |
| 8 | 删除工序（ElMessageBox.confirm） | `work-processes/index.vue` |
| 9 | 禁用/启用工序 Toggle | `work-processes/index.vue` |
| 10 | 表单校验失败（processName 必填+max100, unit 必填） | `work-processes/index.vue:43-51` |
| 11 | Skill Switch 禁用验证（非 database 来源 disabled） | `skill-tools/index.vue:291` |
| 12 | Detail Drawer 内容展示 | `skill-tools/index.vue:405-431` |
| 13 | 推荐 Tab 懒加载 + 采纳（alreadyCoveredBySkill 条件） | `skill-tools/index.vue:211-217,350-356` |
| 14 | 共现模式 Tab 展示（两个只读表格） | `skill-tools/index.vue:363-401` |
| 15 | 审批权限控制（workshop_sup1 只读时无操作按钮） | `approval/list.vue:15`, `permission.ts:62-64` |
| 16 | 补报记录橙色高亮（isSupplemental=true） | `approval/list.vue` |
| 17 | 工序排序上移/下移 | `products/index.vue:361-373` |
| 18 | 工作流保存草稿 + 发布（canPublish 条件） | `workflow-designer/index.vue:225` |

#### P2 — 最好测试

| # | 遗漏 |
|---|------|
| 19 | 搜索过滤（工序/Skill） |
| 20 | 分页（工序/审批） |
| 21 | 版本标签展示 + 天数修改 |
| 22 | 空画布状态 |

### Part B: RN Expo Web 遗漏

#### P0 — 确定性失败

| # | 遗漏 | 源码引用 |
|---|------|---------|
| 1 | 5 屏幕缺 testID → Maestro #76 100% 失败 | 所有 ProcessTask 屏幕 |
| 2 | Maestro Alert 文字不匹配（"提交成功" vs 源码 "报工已提交"） | `ProcessTaskReportScreen.tsx:75` |
| 3 | ProcessTaskDetailScreen 未 render 测试（仅 API mock） | `ProcessTaskDetailScreen.tsx` |
| 4 | ProcessTaskHistoryScreen 完全无测试 | `ProcessTaskHistoryScreen.tsx` |

#### P1 — 功能完整性

| # | 遗漏 | 源码引用 |
|---|------|---------|
| 5 | 150% 超量警告 Alert | `ProcessTaskReportScreen.tsx:50-53` |
| 6 | 快捷填入按钮（剩余量/半量） | `ProcessTaskReportScreen.tsx:171-185` |
| 7 | "查看生产单"条件按钮（需 productionRunId） | `ProcessTaskDetailScreen.tsx:175-186` |
| 8 | "补报"文字变化（status=SUPPLEMENTING） | `ProcessTaskDetailScreen.tsx:173` |
| 9 | history 图标导航 | `ProcessTaskListScreen.tsx:178` |
| 10 | updateTaskStatus / getPendingApprovals API 缺测试 | `processTaskApiClient.ts:131-142` |

### Part C: 跨端数据互通 — 全部未覆盖

| # | 场景 | 优先级 |
|---|------|--------|
| 1 | **RN 报工 → Vue 审批 → 数量回写任务进度** | **P0 核心** |
| 2 | Vue 创建工序 → RN 签到可选该工序 | P1 |
| 3 | Vue 创建任务 → RN 看到任务并报工 | P1 |
| 4 | Vue 批量审批 → RN 任务进度更新 | P1 |
| 5 | RN 签退 → 自动创建报工草稿 → Vue 可见 | P2 |
| 6 | Vue 创建 Skill → AI 意图执行使用 | P2 |

### Part D: 多角色权限 — 全部未覆盖

| 角色 | 应测场景 | 优先级 |
|------|---------|--------|
| `workshop_sup1` | 审批页只读（production:r → 无通过/驳回按钮） | P0 |
| `dispatcher1` | 工序管理只读（system:r → 无操作列） | P1 |
| `quality_insp1` | 审批页无权限（不可见或无操作按钮） | P1 |

---

## 4. 推荐行动计划

### 立即行动 (Day 1-2)

**A1. 修复 5 屏幕 testID** (2-3h) — Maestro #76 从 0→1
```
ProcessTaskListScreen → testID="process-task-list", "process-task-card-{i}"
ProcessTaskDetailScreen → testID="task-detail-planned-qty" 等
ProcessTaskReportScreen → testID="report-quantity-input", "report-submit-btn"
```

**A2. 修正 Maestro #76 Alert 文字** (0.5h)
```
"提交成功" → "报工已提交" 或 regex /提交/
```

### 短期行动 (Day 3-7) — 新增 12 个 Playwright 测试

| 测试 ID | 描述 | 预计工时 |
|---------|------|---------|
| VUE-11 | 审批通过 | 30min |
| VUE-12 | 驳回 + 输入原因 + 空值校验 | 45min |
| VUE-13 | 批量审批（多选 + 确认） | 45min |
| VUE-14 | Skill 列表加载 + 3 Tab | 30min |
| VUE-15 | 创建 Skill（填表 + 提交） | 45min |
| VUE-16 | 删除 Skill（确认弹窗） | 30min |
| VUE-17 | Switch 启停 + disabled 条件 | 30min |
| VUE-18 | 推荐 Tab 懒加载 + 采纳 | 45min |
| VUE-19 | 编辑工序 | 30min |
| VUE-20 | 删除工序 | 30min |
| VUE-21 | workshop_sup1 审批只读验证 | 30min |
| VUE-22 | 共现模式 Tab 展示 | 20min |

### 有条件行动 (Day 8+)

| 行动 | 前置条件 | 预计工时 |
|------|---------|---------|
| 跨端: RN 报工 → Vue 审批 E2E | 测试环境有 seed 数据 | 4-6h |
| /api/workflow 加入拦截器 | 评估回归影响 | 0.5h |
| @PreAuthorize 启用评估 | 审计 150 个注解的角色值 | 2-4h |
| RN RNTL 补充 render 测试 | DetailScreen/ReportScreen | 3-4h |

---

## 5. 未解决问题

1. **workflow-designer 侧边栏入口**：是开发阶段隐藏还是功能未完成？
2. **测试环境数据稳定性**：跨端测试依赖端口 10011 有工序任务数据，是否有 seed 脚本？
3. **Maestro vs Playwright Mobile**：修复 Maestro 还是切换方案？建议修复 testID 走 Maestro（已有 50 个测试基础）
4. **@PreAuthorize 启用回归风险**：150 个注解中角色值是否在系统中正确配置？
5. **factory_admin1 的 `system:rw` 权限**：需确认此账号是否能执行 Skill 创建/删除操作

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (sonnet)
- Browser explorer: OFF
- Total codebase files analyzed: ~30 source files
- Key disagreements: 3 resolved (覆盖率算法, 安全严重性, 计划规模)
- Phases completed: Research (x3 parallel) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded, no external claims)
- Healer: All checks passed ✅
- Competitor profiles: N/A
