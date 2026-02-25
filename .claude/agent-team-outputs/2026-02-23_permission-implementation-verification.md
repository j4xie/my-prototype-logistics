# 权限分离方案实施后完整性验证报告

**日期**: 2026-02-23
**模式**: Full | 3 Researchers + Critic | Codebase Grounding: ENABLED

---

## Executive Summary

权限分离方案的前端实施（3个新Navigator + OperatorNavigator增强）**质量良好**，所有Screen组件引用正确。但后端 `@RequirePermission` 注解实施存在 **3个P0级功能阻断缺陷**：`inventory`、`work_report`、`report` 三个模块不在 `PermissionServiceImpl` 的权限矩阵中，导致刚加的注解对所有非超管角色返回403。此外，`hasPermission()` 的action模型只支持 `read`/`write`/`*` 三种，注解中使用的 `create`/`approve`/`read_write` 等自定义action走default分支精确匹配，存在语义混乱。

---

## 一、验证通过的部分 ✅

| 验证项 | 结果 | 详情 |
|--------|------|------|
| SalesManagerNavigator Screen引用 | ✅ 全部9个依赖存在 | 路径解析正确 |
| ProcurementManagerNavigator Screen引用 | ✅ 全部9个依赖存在 | 路径解析正确 |
| ViewerNavigator Screen引用 | ✅ 全部9个依赖存在 | 路径解析正确 |
| OperatorNavigator 报工Tab | ✅ 依赖链完整 | ScanReport/Success/Draft均存在 |
| AppNavigator 角色路由 | ✅ 10个分支覆盖 | 新增3个角色正确接入 |
| viewer的sales:read → SalesController GET | ✅ 一致 | 后端接受`{"sales:read_write","sales:read"}` |
| viewer的procurement:read → PurchaseController GET | ✅ 一致 | 后端接受`{"procurement:read_write","procurement:read"}` |
| JwtAuthInterceptor执行顺序 | ✅ order=1先于PermissionInterceptor order=2 | 认证在权限之前 |

---

## 二、P0 — 功能阻断（100%概率，立即修复）

### P0-1: `inventory` 模块不在权限矩阵中

**影响**: TransferController 全部11个端点对非超管角色返回403，调拨功能完全不可用

**证据**: `PermissionServiceImpl.java` 的 `ALL_MODULES` 列表不含 `"inventory"`，无任何角色的权限Map包含 `inventory` 键。TransferController 使用 `@RequirePermission({"inventory:write", "inventory:read"})`，匹配必然失败。

**修复**: 在 `PermissionServiceImpl` 中为 `warehouse_manager` 添加 `"inventory": "read_write"`，为 `viewer` 添加 `"inventory": "read"`。或将 TransferController 注解改为已有的 `warehouse:write`/`warehouse:read`。

### P0-2: `work_report` 模块不在权限矩阵中

**影响**: WorkReportingController 中纯 `work_report:*` 注解的端点（getReports、getReport、approveReport、getPendingReports、getTodayCheckins、getCheckinList、getSummary）对非超管角色返回403。含 `production:write` 备选的端点（submitReport、checkin、checkout）仍可通过。

**证据**: `ALL_MODULES` 不含 `"work_report"`。`@RequirePermission("work_report:read")` 中 module=`work_report`，`rolePerms.get("work_report")` 返回 null → false。

**修复**: 将 `"work_report"` 加入 `ALL_MODULES`，并为 `workshop_supervisor`/`dispatcher` 分配 `"work_report": "read_write"`，为 `operator` 分配 `"work_report": "write"`。

### P0-3: `report` 模块不在权限矩阵中

**影响**: PurchaseController `/statistics` 和 SalesController `/statistics` 中 `report:read` 权限码永远不匹配。但由于这些端点是OR语义（如 `{"procurement:read_write","procurement:read","report:read"}`），前两个权限可以救场。**实际影响有限**，但仍是代码卫生问题。

**修复**: 将 `report` 加入权限矩阵，或从注解中移除 `report:read`（依赖已有模块权限即可）。

---

## 三、P1 — 设计缺陷（导致权限错误或前后端不一致）

### P1-1: ReturnOrderController 类级注解阻止viewer只读访问

**影响**: 类级 `@RequirePermission({"sales:read_write","procurement:read_write"})` 覆盖所有方法（含GET），viewer 仅有 `sales:read`，action=`read_write` 走 default 分支要求 `permType.equals("read_write")`，viewer 被拒。

**修复**: 为GET方法添加独立注解 `@RequirePermission({"sales:read_write","sales:read","procurement:read_write","procurement:read"})`。

### P1-2: hasPermission() action模型不支持自定义action

**影响**: switch只处理 `read`/`write`/`*`，其余（含 `create`/`approve`/`read_write`）走default精确匹配。这导致：
- `work_report:create` 即使 work_report 模块存在且角色有 `read_write` 权限，也能通过（因为default分支 `"read_write".equals("read_write")` = true）——**但无法区分 create 和 approve**
- 细粒度控制（如"允许create但不允许approve"）在当前架构下不可能实现

**修复**: 扩展switch增加 `case "create":`、`case "approve":` 等处理逻辑，或重新设计注解中的action为 `read`/`write` 而非自定义动作。

### P1-3: procurement_manager/sales_manager 后端权限矩阵缺失

**影响**: Web Admin 显示菜单但后端403

| 角色 | Web端有但后端缺 | 后果 |
|------|----------------|------|
| procurement_manager | `finance: 'r'`, `production: 'r'` | 财务/生产模块页面白屏 |
| sales_manager | `finance: 'r'`, `analytics: 'r'` | 财务/分析模块页面白屏 |

**修复**: 在 `PermissionServiceImpl` 的对应角色Map中补全缺失模块。注意 Critic 指出 procurement_manager 是否需要 finance 权限存在业务争议（职责分离原则）。

### P1-4: 109/114 Controller 无 @RequirePermission

**影响**: PermissionInterceptor 对无注解方法直接放行（`annotation==null → return true`），同工厂内任意角色可调用任何无注解的 Controller。高敏感无保护 Controller 包括：UserController、WageController、ArApController、FactorySettingsController、SystemConfigController。

**修复**: 分批为高敏感Controller添加注解（优先 finance/hr/system 模块）。

---

## 四、P2 — 边界问题

| # | 问题 | 影响 | 修复 |
|---|------|------|------|
| P2-1 | `ALL_MODULES` 缺少 `scheduling` | viewer 的 scheduling:read 未生成 | 加入 ALL_MODULES |
| P2-2 | ReturnOrderController OR语义越权 | sales_manager 可审批采购退货，procurement_manager 可操作销售退货 | 按 returnType 拆分权限或拆Controller |
| P2-3 | `isPublicEndpoint()` 使用 `uri.contains("/upload")` | 未来upload类路径可能绕过工厂隔离 | 改为精确前缀匹配 |
| P2-4 | factoryId排除列表硬编码 | 维护风险 | 改为Set常量+注释说明 |
| P2-5 | ViewerNavigator 页面内写按钮无前端门控 | viewer看到无效按钮触发403 | 增加角色条件渲染 |
| P2-6 | 3个活跃角色无RN Navigator | equipment_admin/quality_manager/finance_manager fallback到MainNavigator | 按需新建Navigator |

---

## 五、推荐修复优先级

### 立即修复（阻塞当前版本发布）

```
1. PermissionServiceImpl.java — 补全 work_report、inventory 到 ALL_MODULES 和角色Map
2. ReturnOrderController.java — GET方法加独立 @RequirePermission（含 read 权限）
3. PermissionServiceImpl.java — 补全 scheduling 到 ALL_MODULES
```

### 本迭代内修复

```
4. PermissionServiceImpl.java — procurement_manager/sales_manager 补全缺失模块权限
5. UserController/WageController/ArApController — 加 @RequirePermission（高敏感）
6. hasPermission() — 考虑扩展 action 模型
```

### 下迭代修复

```
7. 逐步为剩余 Controller 补权限注解（按模块分批）
8. PermissionInterceptor 默认策略考虑改为"无注解拒绝"（需配合白名单）
9. equipment_admin/quality_manager/finance_manager 的 RN Navigator
```

---

## 六、Consensus & Disagreements

| 结论 | 研究员 | Critic | 最终置信度 |
|------|--------|--------|-----------|
| work_report/inventory 缺失导致403 | 一致确认 | 代码验证确认 | **Very High** |
| ReturnOrderController viewer被拒 | 一致确认 | 确认但补充了精确机制 | **Very High** |
| procurement_manager需要finance权限 | 研究员认为需要 | Critic质疑（职责分离） | **Medium** — 需业务确认 |
| 补全模块即可修复 | 研究员认为是 | Critic指出action模型也需修 | **Medium** — 需架构决策 |
| 新建Navigator完整性 | 全部通过 | 未挑战 | **Very High** |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: 28 codebase evidence (all ★★★★★)
- Key disagreements: 1 resolved (ReturnOrderController机制), 1 unresolved (procurement_manager是否需要finance)
- Phases completed: Research (parallel) → Critique → Manager Integration
- Fact-check: disabled (codebase grounding, no external claims)
- Healer: All structural checks passed ✅

### Healer Notes: All checks passed ✅
