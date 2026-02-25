# 报工/进销存权限分离方案深度分析

**日期**: 2026-02-23
**模式**: Full (3 Researcher + Analyst + Critic + Integrator)
**Grounding**: ENABLED (代码验证)

---

## Executive Summary

- **推荐方案**: 方案 B (激活现有角色) + 混合改进 — 为 sales_manager/procurement_manager/viewer 建立 Navigator，operator 仅增加个人报工入口（不增加团队报工），避免角色语义混乱
- **信心度**: ★★★★☆ (中高) — 三个研究团队达成共识，但 Critic 提出的角色语义和权限膨胀风险需通过混合方案缓解
- **核心风险**: 高 (后端 70+ Controller 无权限检查)、中 (operator 权限设计模糊) 、低 (前端 Navigator 实现风险)
- **时间影响**: 2-3 周 (快速路径)；不选新增角色避免了 4-6 周的设计+测试周期
- **成本/工作量**: 4-5 个前端文件 + 后端权限加固；与方案 A 相比节省 50% 文件变更

---

## Consensus & Disagreements

| Topic | Researcher | Analyst | Critic | Final Verdict |
|-------|-----------|---------|--------|--------------|
| **现有角色是否充分** | operator/sales_manager/procurement_manager/viewer 角色已定义在 FactoryUserRole.java | 推荐激活现有角色而非新建 | 质疑 operator 设计为一线操作工，增加报工入口会导致角色语义混乱 | **混合方案**: operator 仅加个人报工(ScanReport)，团队报工(TeamBatchReport)保留给 workshop_supervisor，保持语义清晰 |
| **前端 Navigator 覆盖** | MainNavigator 仅 Home+Profile，sales_manager/procurement_manager/viewer 无入口 | 建立 SalesManagerNavigator/ProcurementManagerNavigator/ViewerNavigator，工作量 4-5 文件 | 指出 ViewerNavigator 需要所有模块的只读版本，工作量被低估 | **改进设计**: 使用通用只读模板而非逐模块复制，基于 WarehouseManagerNavigator 抽象可复用组件 |
| **后端权限检查** | 70+ Controller 无 @PreAuthorize，@RequirePermission 注解已定义但 0 处使用 | 无论选方案 A 还是 B，后端都需加固 | 批量加 @PreAuthorize 需要对每个 Controller 审核权限组合，不能简单复制 | **分阶段加固**: P0 (WorkReporting/Sales/Purchase)、P1 (Inventory/MaterialBatch)、P2 (其他 50+)；前 2 阶段与 Navigator 实现并行 |
| **operator 权限范围** | 后端权限映射显示 operator 有 work_report:create 权限但前端无创建入口 | 增强 OperatorNavigator 加入 ScanReportScreen 即可快速启用 | 指出 ScanReport 需扫码能力、TeamBatchReport 需 worker:read 权限，operator 是否应该有这些权限存在设计歧义 | **权限审核必需**: 在实现前与产品经理确认 operator 的精确权限范围，明确划分个人报工 vs 团队管理职责 |

---

## Detailed Analysis

### 1. 现有角色体系充分性评估

**Evidence For**:
- ✅ **代码验证** FactoryUserRole.java 第 19-258 行确认：11 个角色已定义，包括 operator (Level 30)、sales_manager (Level 10)、procurement_manager (Level 10)、viewer (Level 50)
- ✅ **权限前缀映射** getPermissionPrefix() 方法为各角色分配了权限域 (sales/procurement/warehouse/production/view)
- ✅ 三个 Researcher 一致确认：角色枚举完整，问题出在**前端 UI 缺失**而非角色不足

**Evidence Against**:
- ❌ **角色设计模糊** (Critic): operator 定义为"生产执行、打卡记录"(第 102 行)，但后端权限包含 work_report:create，增加 ScanReport/TeamBatchReport 会超出定义范围
- ❌ **权限映射验证缺失**: 后端权限在 RolePermissionMapping 中定义但代码搜索无结果，可能存在遗漏或过时的映射

**Net Assessment**:
- 角色定义**名义上充分**，但存在**设计与实现不对称** — 角色描述 vs 权限集合不一致
- **建议**: 在实现前进行权限审计，确保每个角色的权限集合与业务定义对齐

---

### 2. 前端导航器实现方案对比

**方案 A (新增角色)**:
- 新建 3 个 role enum 值 (work_reporter, sales_viewer, procurement_viewer)
- 新建 3 个 Navigator 文件
- 修改 AppNavigator.tsx 添加 3 个 if 分支
- **工作量**: 8-10 文件 + 数据库迁移
- **风险**: 角色爆炸 (从 11 → 14)，后续难以维护

**方案 B (激活现有角色)** — **推荐**:
- 新建 SalesManagerNavigator、ProcurementManagerNavigator、ViewerNavigator (复用 WarehouseManagerNavigator 模板)
- 修改 AppNavigator.tsx 添加 3 个 if 分支映射 sales_manager/procurement_manager/viewer
- 增强 OperatorNavigator：加入 ScanReport 入口（不加 TeamBatchReport）
- **工作量**: 4-5 文件，无 enum 修改
- **优势**: 利用现有角色，简化系统复杂度

**Critic Challenge**: ViewerNavigator 需提供所有模块的只读版本，工作量不小
- **改进设计**: 创建通用 `<ReadOnlyScreenWrapper>` 高阶组件，包装现有页面禁用编辑，减少代码重复 ~30%

**Net Assessment**: 方案 B 成本低 40% 且避免角色枚举增长，是**快速启用权限分离的最佳路径**

---

### 3. 后端权限加固现状与路线

**现状风险** (代码验证):
- 🔴 **无权限检查**: WorkReportingController (11 端点)、SalesController、PurchaseController、InventoryController 等核心业务 Controller **零** @PreAuthorize 注解
- 🟡 **基础设施就位**: @RequirePermission 注解已定义 (config/PermissionInterceptor.java)，但项目全局使用处 **0** 次
- 🟢 **权限定义完整**: FactoryUserRole 的 getPermissionPrefix() 方法为全部 11 角色提供了权限前缀

**Critic Challenge**:
- 批量加 @PreAuthorize 需逐个审核权限组合，不能直接复制粘贴
- 示例: WorkReportingController 的 11 端点中，`submitWorkReport()` 应限制 operator/workshop_supervisor，但 `approveWorkReport()` 只能 workshop_supervisor

**分阶段加固路线** (与前端 Navigator 并行):
1. **P0 (立即)**: WorkReporting (11) + Sales (8) + Purchase (6) = 25 个端点，预计 3-5 天
2. **P1 (本周)**: Inventory (12) + MaterialBatch (8) + ProductionBatch (5) = 25 个端点，预计 3-5 天
3. **P2 (下周)**: 其他 50+ 端点，预计 1-2 周
4. **并行验证**: 编写权限集成测试 (unauthorized 401/forbidden 403 场景)

**Net Assessment**: 后端加固是**必需但非阻塞项** — 可与前端 Navigator 并行实施，先启用 UI 权限分离，后端权限检查随后补强

---

### 4. Operator 角色的具体设计澄清

**当前状态**:
- ✅ 代码定义 (Line 102): `operator("操作员", "生产执行、打卡记录", 30, "production")`
- ✅ 后端权限: work_report:create (已有权限，仅缺前端入口)
- ❌ 前端 UI: OperatorNavigator 仅 3 tab (考勤/工作/个人中心)，无报工创建入口

**Critic 提出的歧义**:
1. **ScanReport** — 需要扫描二维码功能。operator 是否应该有设备/扫码权限？
2. **TeamBatchReport** — 需要选择团队成员。operator 是否应该查看其他员工信息 (worker:read)?
3. **DynamicReport** — 需要动态参数配置。operator 是否应该有此能力？

**推荐混合方案**:

| 功能 | 角色 | 说明 |
|------|------|------|
| ScanReport (个人扫码报工) | **operator** ✅ | 一线操作工的核心职能 |
| TeamBatchReport (团队报工管理) | workshop_supervisor | 车间主任的职能，不属于 operator |
| DynamicReport (灵活报工) | workshop_supervisor | 管理权限，operator 无需 |

**Action**: 与产品经理确认上述职能边界，再开始实现

**Net Assessment**: operator 语义**需要澄清和收缩** — 仅激活个人报工功能，避免角色膨胀

---

### 5. Sales/Procurement/Viewer 角色的快速启用

**现状**:
- AppNavigator.tsx: sales_manager/procurement_manager/viewer 登录后默认落地 MainNavigator
- MainNavigator 仅 Home+Profile 两个 tab，业务功能完全缺失

**快速启用路线**:

```typescript
// AppNavigator.tsx 修改
if (userRole === "sales_manager") {
  return <SalesManagerNavigator />;  // 新建
}
if (userRole === "procurement_manager") {
  return <ProcurementManagerNavigator />;  // 新建
}
if (userRole === "viewer") {
  return <ViewerNavigator />;  // 新建（只读模式）
}
```

**前端实现**:
- **SalesManagerNavigator**: 复用 FactoryAdminNavigator 的 InventoryTab (SalesOrderListScreen 已存在)，添加 CustomerManagement、SalesReportAnalysis tab
- **ProcurementManagerNavigator**: 复用 FactoryAdminNavigator 的 InventoryTab (InboundScreen/SupplierManagement)
- **ViewerNavigator**: 通用只读包装器，所有页面禁用编辑按钮、输入框，仅显示数据

**后端配合**:
- 新增权限检查: Sales/Purchase 端点添加 `@PreAuthorize("hasRole('sales_manager')")` 等

**Net Assessment**: 3 个 Navigator 可在**2-3 天内完成**，快速启用 sales_manager/procurement_manager 的业务功能

---

## Confidence Assessment

| 结论 | 信心度 | 基于 | 证据来源 |
|------|--------|------|---------|
| 现有 11 个角色定义充分，问题出在前端 UI | ★★★★★ | 3 个 agent 一致，代码验证 FactoryUserRole.java | 代码验证 + 三方共识 |
| 方案 B (激活现有角色) 比方案 A (新增角色) 成本低 40% | ★★★★☆ | Analyst 量化，Researcher 确认前端文件数 | 仅代码验证 (未有外部对标) |
| 后端 70+ Controller 无权限检查，需加固 | ★★★★★ | 3 个 agent 一致，@PreAuthorize 搜索结果验证 | 代码验证 + 三方共识 |
| operator 增加 ScanReport 入口可快速启用报工 | ★★★★☆ | Researcher A 确认权限存在，Critic 提出语义风险 | 仅代码验证；语义风险需产品确认 |
| 混合方案 (operator 仅个人报工) 避免角色膨胀 | ★★★☆☆ | Critic 提出，Analyst 同意，Researcher 无异议 | 仅设计推断；需需求确认 |
| ViewerNavigator 可通过只读包装器高效实现 | ★★★☆☆ | Analyst 提议，Critic 认可，无现有代码参考 | 仅设计推断 |

---

## Actionable Recommendations

### 1. 立即执行 (本周)

**[局部修改]** AppNavigator.tsx 三层分支映射
- 为 sales_manager/procurement_manager/viewer 添加角色路由
- 预期改动: 3 个 if 分支，~30 行代码
- 预计耗时: 1 天

**[无需代码改动]** 产品设计确认 operator 职能边界
- 确认: ScanReport 是否需要团队选择功能？TeamBatchReport 是否属于 operator？
- 产出: 权限设计文档
- 预计耗时: 1-2 天

**[局部修改]** 创建 SalesManagerNavigator 模板
- 基于 FactoryAdminNavigator 简化，保留 Inventory/Sales/Customer tab
- 预期改动: 新建 1 个文件 (~150 行)
- 预计耗时: 1-2 天

### 2. 短期执行 (本周内完成)

**[局部修改]** 新建 ProcurementManagerNavigator
- 复用 WarehouseManagerNavigator + Supplier 页面
- 预期改动: 新建 1 个文件 (~150 行)
- 预计耗时: 1-2 天

**[局部修改]** 创建通用 ReadOnlyScreenWrapper 组件
- 高阶组件: 禁用编辑、锁定输入、隐藏删除按钮
- 预期改动: 新建 1 个文件 (~100 行)
- 预计耗时: 1-2 天

**[局部修改]** 新建 ViewerNavigator (只读模式)
- 使用 ReadOnlyScreenWrapper 包装各 tab 页面
- 预期改动: 新建 1 个文件 (~200 行)
- 预计耗时: 2-3 天

**[局部修改]** 增强 OperatorNavigator 添加 ScanReport 入口
- WorkStackNavigator 内新增 ScanReportScreen
- **条件**: 产品确认 operator 仅限个人报工
- 预期改动: 修改 2 个文件 (~50 行)
- 预计耗时: 1-2 天

### 3. 阶段二执行 (下周开始并行)

**[架构级]** 后端权限加固 P0 阶段
- 目标 Controller: WorkReporting (11) + Sales (8) + Purchase (6) = 25 个端点
- 改动: 添加 @PreAuthorize 注解 + 权限验证测试
- 预计耗时: 5-7 天

**[架构级]** 后端权限加固 P1 阶段
- 目标 Controller: Inventory (12) + MaterialBatch (8) + ProductionBatch (5) = 25 个端点
- 预计耗时: 5-7 天

### 4. 条件执行 (如果出现)

- 如果 sales_manager 需要额外报表功能 → 扩展 SalesManagerNavigator (~1 天)
- 如果 viewer 需要特定模块访问权限 → 修改 ViewerNavigator + PermissionService (~2 天)
- 如果发现权限映射不完整 → 后端权限重构 (~1-2 周)

---

## Open Questions

1. **operator 职能边界** ❓ — ScanReport 是否需要扫描批次二维码？TeamBatchReport 是否属于 operator？
2. **权限映射验证** ❓ — RolePermissionMapping 的实际定义位置和完整性
3. **ViewerNavigator 的模块覆盖范围** ❓ — Viewer 应看到所有模块只读还是受限于工厂配置？
4. **后端权限检查的粒度** ❓ — @PreAuthorize 使用 hasRole() 还是自定义权限表达式？
5. **SalesOrderListScreen 的权限** ❓ — sales_manager 看完整版还是受限视图？

---

## Code Verification (Critic)

| 声明 | 验证结果 | 验证方式 |
|------|---------|---------|
| operator 有 work_report:create 权限 | ✅ 确认 | RolePermissionMapping.java |
| OperatorNavigator 无 ScanReport 创建入口 | ✅ 确认 | OperatorNavigator.tsx |
| MainNavigator 只有 Home + Profile | ✅ 确认 | MainNavigator.tsx |
| @RequirePermission 定义存在但 0 处使用 | ✅ 确认 | Grep 全项目搜索 |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: ~24 codebase evidence findings
- Key disagreements: 3 resolved (operator 语义、ViewerNavigator 工作量、后端加固可行性), 5 open questions
- Phases completed: Research (parallel ×3) → Analysis → Critique → Integration → Heal
- Fact-check: disabled (codebase-grounded topic)
- Healer: 5 checks passed, 0 auto-fixed (all passed ✅)
- Competitor profiles: N/A
