# 仓储管理菜单可见性诊断与修复设计

**Date**: 2026-04-22
**Author**: Steve + Claude (brainstorming)
**Status**: Ready for plan
**Scope**: P0 (web-admin only — RN App + 合同号 UI 推迟到下一轮)
**Branch**: `e2e/v1-framework`
**Deploy gate**: test-first per `.claude/rules/server-operations.md`

---

## 1. Problem statement

客户张权 2026-04-22 反馈："仓库管理大模块没了"。配套 docx 截图显示 web-admin 左侧菜单**没有"仓储管理"入口**，仅有 首页 / 采购管理 / 销售管理 / 人事管理 / 财务管理 / 系统管理 / 数据分析 / 餐饮运营 / 智能 BI。

后续 superpowers code-reviewer 审计验证：
- `web-admin/src/router/index.ts:131-167` **已注册**完整 `仓储管理` 一级菜单 + 5 子菜单（原材料批次 / 出货管理 / 盘点管理 / 周转耗材 / 物料均价趋势）
- 路由配置无缺失 → **客户看不到是 PERMISSION FILTER 的问题，不是路由问题**

**目标**：让"工厂管理员"和"仓管的管理员"角色都能看到 + 进入 5 个仓储子菜单，恢复正常操作路径。

**非目标 (out of scope, 推迟)**：
- RN App `FAManagementScreen` 加"仓库管理"section（推迟下一轮）
- web-admin 5 个新建 Vue 页（入库/出库/库位/温控/预警 — 现有菜单不含这些，需要单独 ticket）
- 合同编号 DYNAMIC 表单 UI 修复（30 min 任务，可与本任务合并部署但设计独立）
- 后端 RBAC 加固（reviewer 发现 inventory/warehouse/sales controller 无 `@PreAuthorize`，单独安全 ticket）

---

## 2. Permission resolution model (codebase reality)

来源：`web-admin/src/store/modules/permission.ts`

```
最终权限 = factoryTypeFilter ∩ (DB-L2 override ∪ DB-L1 default ∪ hardcoded fallback)
                                            ↑ optional             ↑ primary       ↑ disaster recovery
```

**4 层解析顺序（per `2026-04-18-permission-matrix-ai-driven-design.md`）**：

| 层 | 来源 | 加载方式 |
|---|---|---|
| L0: hardcoded fallback | `permission.ts:41-190` `PERMISSION_MATRIX` | bundle 内置，仅当 DB API 失败时使用 |
| L1: platform default | `GET /api/admin/role-permissions` (`PlatformRolePermission` 表) | 登录后异步加载，30s debounce |
| L2: factory override | `GET /F001/canvas/role-module-override` (`FactoryRoleModuleOverride` 表) | 登录后异步加载，仅本工厂生效 |
| Filter: factoryType | `permission.ts:200-212` `FACTORY_TYPE_MODULE_FILTER` | hardcoded，按 factory 类型强过滤 |

**关键 hardcoded 现状**（fallback layer）：
- `factory_super_admin`: `warehouse: 'rw'` ✓
- `warehouse_manager`: `warehouse: 'rw'` ✓
- `warehouse_worker`: `warehouse: 'w'` ✓ (only write, but 仍可见菜单)
- **`factory_admin` 不存在于 hardcoded matrix** — 只有 `factory_super_admin`
- `RESTAURANT` 类型工厂：`warehouse: '-'` 强制屏蔽（覆盖角色权限）

---

## 3. Four candidate root causes

| # | Root cause | 验证方法 | 命中概率 |
|---|---|---|---|
| **R1** | 客户角色是 `factory_admin` (而非 `factory_super_admin`)，hardcoded matrix 没有，DB seed 也缺 → fallback 走 `unactivated` 全 `-` | `GET /api/auth/me` 看 `role` 字段；`SELECT * FROM users WHERE username='<客户账号>'` | 高（中文"工厂管理员"字面对应 factory_admin） |
| **R2** | 客户工厂 `factoryType = RESTAURANT`，`FACTORY_TYPE_MODULE_FILTER.RESTAURANT.warehouse = '-'` 强制屏蔽 | `GET /api/auth/me` 看 `factoryType` 字段；`SELECT industry_type FROM factories WHERE id=<factoryId>` | 中（客户做食品工厂可能误标） |
| **R3** | DB L1 `platform_role_permission` 表对该角色的 `warehouse` 列存了 `'-'`，覆盖 hardcoded | `GET /api/admin/role-permissions`；`SELECT role, module, level FROM platform_role_permission WHERE module='warehouse'` | 中（数据迁移可能漏） |
| **R4** | DB L2 `factory_role_module_override` 表里该工厂对 `warehouse` 模块设了 `'-'` | `GET /<factoryId>/canvas/role-module-override`；`SELECT * FROM factory_role_module_override WHERE factory_id=<x> AND module='warehouse'` | 低（要主动配过才会有） |

---

## 4. Design

### 4.1 Process

```
Step 1: 诊断 (~30 min)
  ├─ 取得客户账号 + 测试环境登录 (or DB read access)
  ├─ 跑 4 项检查 (R1-R4)
  └─ 输出诊断报告：命中哪个根因 + 受影响范围 (单角色/单工厂/全平台)

Step 2: 针对性修复 (~30 min - 2h, depends on root cause)
  └─ 按 §5 决策矩阵选修复方案

Step 3: 验证 (~10 min on test env)
  ├─ 客户/我们用受影响账号重新登录
  ├─ 检查左侧菜单出现"仓储管理"+5 子菜单
  ├─ 点击每个子菜单确认页面加载（403/blank 都算失败）
  └─ 工厂管理员 + 仓管管理员两个角色都验

Step 4: 灰度部署 (test → 客户验收 → prod)
  └─ 按 server-operations.md test-first 规则
```

### 4.2 Components touched per root cause

| Root cause | 修复点 | 影响范围 | 风险 |
|---|---|---|---|
| **R1** factory_admin 缺 seed | (a) `permission.ts` PERMISSION_MATRIX 加 `factory_admin` 条目 (兜底)；(b) `PlatformRolePermissionSeeder` 加 SQL migration 插入 DB 行 | 全平台所有 factory_admin 角色 | 中 — 如果之前 factory_admin 是故意限制的，这次开放可能越权 |
| **R2** RESTAURANT 强过滤 | 与客户确认工厂类型；如果误标 → SQL 改 factory.industry_type；如果真餐饮但需库存（中央厨房）→ 改 `FACTORY_TYPE_MODULE_FILTER.RESTAURANT.warehouse` 从 `'-'` 改 `'r'` 或删除该 entry | 单工厂 (a) 或全餐饮客户 (b) | 高 (b)— 影响所有现存餐饮客户的菜单可见性 |
| **R3** DB L1 缺 row | PUT `/api/platform/role-permissions/<role>/warehouse?level=rw` (调一次 API)，或写 SQL migration 修复 | 单角色全平台 | 低 |
| **R4** L2 override | UI: web-admin Canvas role-module-override 页面移除该 row；或 SQL: `DELETE FROM factory_role_module_override WHERE factory_id=<x> AND role=<r> AND module='warehouse'` | 单工厂单角色 | 低 |

### 4.3 Data flow

```
客户登录
  ↓
authStore.login() → 拿 access_token + user info
  ↓
permissionStore.setRole(role, factoryId, factoryType)
  ↓
loadFromDb() ← 异步，30s debounce
  ├─ getPlatformPermissions() → L1 default
  └─ getFactoryOverride(factoryId) → L2 override
  ↓
mergedPermissions = mergeForRole(L1, L2, role)  // L2 wins L1
  ↓
applyFactoryTypeFilter(merged, factoryType)  // RESTAURANT.warehouse='-' override
  ↓
dbPermissions.value = filtered
  ↓
canRead('warehouse') → 'r' or 'rw' or 'w' → 菜单可见 / '-' → 隐藏
```

任何一层把 warehouse 设成 '-'，菜单都消失。诊断需逐层 trace。

### 4.4 Error handling

- **诊断失败**（无法登录客户账号 / 无法连 DB）→ 立即 escalate，不能继续设计修复
- **修复后菜单仍不可见** → revisit 是否漏诊断了某层（典型：客户浏览器缓存 → 强制清除 + 重登）
- **修复后影响其他客户**（特别是 R2-b）→ 立即 git revert + 通知

### 4.5 Testing

- **诊断阶段**：手动 + curl，无自动化测试
- **修复阶段**：
  - R1 → 加 unit test 校验 `PERMISSION_MATRIX.factory_admin.warehouse !== '-'`
  - R2-b → 加 unit test 校验 `FACTORY_TYPE_MODULE_FILTER.RESTAURANT.warehouse !== '-'` (如果改了)
  - R3 → 调 `GET /api/admin/role-permissions` 后 grep 返回 JSON 含 `warehouse: rw`
  - R4 → 调 `GET /<factoryId>/canvas/role-module-override` 后确认无 warehouse override
- **E2E 验证**：用 customer-affected role 登录 web-admin test env (139:8097)，截图 5 个仓储子菜单全部可点 + 进页面无 403/blank

---

## 5. Decision matrix

诊断完成后，按下表决策：

| 命中根因 | 修复优先级 | 工时 | 部署节奏 |
|---|---|---|---|
| 仅 R1 | High | 1h | test → 客户验 → prod |
| 仅 R2-a (factoryType 误标) | Low | 30 min SQL | 直接 prod (单工厂数据修复) |
| 仅 R2-b (餐饮客户也要库存) | Critical (影响面广) | 2h + 充分回归 | test → 跑全餐饮客户 smoke → prod |
| 仅 R3 | Medium | 30 min | test → prod |
| 仅 R4 | Low | 10 min | 直接 prod (单工厂配置变更) |
| 多根因叠加 | High | 2-4h | 按最高级别走 |

---

## 6. Prerequisites (BLOCKING — must resolve before plan can proceed)

诊断阶段 **必须**先有以下之一：
1. 客户账号 + 密码 (test env or prod env)，能登录复现
2. 客户的 username + factoryId，授权我跑 SQL 直查 prod / test DB

未拿到这两项之前，本 spec 无法转入 plan + implementation。

---

## 7. Open questions

无 — 所有关键决策已敲定：
- ~~仓库子页范围~~ → 不重建，复用现有 5 个 Vue 页
- ~~RN App 是否一起做~~ → 推迟下一轮
- ~~合同号是否本轮做~~ → 推迟下一轮（独立 30 min 任务）
- ~~是否加"编辑合同号后门"~~ → 取消（reviewer push back，无具体用例）
- ~~诊断 vs 批量加固~~ → 诊断先行（用户 Q4 选 A）

---

## 8. Acceptance criteria

- [ ] 诊断报告输出，明确命中 R1 / R2 / R3 / R4 之一或多个
- [ ] 修复 PR 在 test env (139:8097) 部署
- [ ] 客户用受影响账号登录 test，看到"仓储管理"一级菜单 + 5 子菜单
- [ ] 5 子菜单全部点击进去无 403 / 无白屏
- [ ] 工厂管理员 + 仓管管理员两个角色都验过
- [ ] 客户书面 ack 后部 prod
- [ ] 部 prod 后再 24h 内复查无回归（其他角色看到错误菜单 / 餐饮客户看到 warehouse 误开等）

---

## 9. Diagnostic results (2026-04-23 partial)

DB 层 4 + 1 根因查询完成。客户指定测试工厂为 **六膳门 (F006)**。

### 9.1 已排除的根因

| Root cause | 检查方法 | 结果 |
|---|---|---|
| **R1** factory_admin 缺 seed | `users` 表查询 | F006 用户：`f006_admin` (factory_super_admin) / `f006_workshop` (workshop_supervisor) / `f006_worker1` (operator)。**`factory_admin` 角色实际不存在于 DB**（hardcoded matrix 里只有 factory_super_admin），客户口语"工厂管理员"对应的是 factory_super_admin。✅ 排除 |
| **R2** RESTAURANT factoryType 强过滤 | `factories` 表 | F006: `name='六膳门食品科技', type='FACTORY'`。FACTORY 类型 filter 不影响 warehouse。✅ 排除 |
| **R3** DB L1 platform_role_permissions 缺 row | `SELECT * FROM platform_role_permissions WHERE module_code='warehouse'` | 22 行齐全，含 `factory_super_admin / warehouse / rw` ✓ + `warehouse_manager / warehouse / rw` ✓ + `workshop_supervisor / warehouse / r` ✓。✅ 排除 |
| **R4** DB L2 factory override | `SELECT * FROM factory_module_configs WHERE factory_id IN ('F001','F006') AND role_module_override <> '{}'` | 0 行。F006 全部 19 个 module config 的 `role_module_override` 字段都是空 JSON。✅ 排除 |
| **R5（新）** Canvas disabled-modules API 屏蔽 | `AppSidebar.vue:32-46` 调 `GET /{factoryId}/config/disabled-modules`，逻辑见 `ConfigController.java:58-70` | F006 无 PUBLISHED config（只有 v1 APPROVED + v2 DRAFT），API 走 fallback 返空 list。F001 有 v1 PUBLISHED 但其 factory_module_configs 0 行。`module_code='warehouse' AND enabled=false` 全表 0 行。✅ 排除 |

### 9.2 推论

按 §2 "最终权限 = factoryTypeFilter ∩ (DB-L2 ∪ DB-L1 ∪ hardcoded)" 解析模型，**`f006_admin` 登录后应该能看到 仓储管理 一级菜单 + 4 子菜单**（原材料批次/出货管理/盘点管理/物料均价趋势 — 注意 spec §1 写"5 子菜单"含周转耗材, 但 sidebar 实际配置无周转耗材）。

**矛盾点**：客户报告 "仓储管理大模块没了"，但 DB 状态显示应该可见。可能原因：
- (a) 客户实际用的不是 `f006_admin`，而是另一个我们没看过的账号 / 工厂
- (b) 测试环境 (10011) 已停 (`SpringApplicationShutdownHook` ~10:19 CST)，客户 22 日测试时连的是某个之前部署的版本，状态可能与现在 DB 不同
- (c) 客户浏览器 localStorage 里有过期的 permission 缓存
- (d) Sidebar 渲染逻辑有未识别的第 6 层 gate

### 9.3 需要的下一步

| Step | 谁做 | 期望产出 |
|---|---|---|
| **A. 重启 test 10011** | Steve / 我 | systemctl 起 cretas-backend test，10011 监听 |
| **B. 用 f006_admin 登录 web-admin test env (139:8097)** | 我 | 截图证明菜单可见 / 不可见 |
| **C. 若 B 显示菜单可见** | Steve | 告知客户用 `f006_admin / <密码>` 复测，可能问题已自愈或客户用了别的账号 |
| **D. 若 B 显示菜单仍不可见** | 我 | dig 第 6 层 gate (Vue dev tools 看 permissionStore.canAccess('warehouse') 返回值，trace 渲染) |

诊断 blocker 从"无客户账号"变更为"test 环境需重启 + login 验证"。

---

## 10. References

- 客户原始反馈：`系统修改意见.docx`（在用户 Steve 微信留存）
- Reviewer audit：本会话 superpowers:code-reviewer 输出
- 权限模型设计：`docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md`
- 部署规则：`.claude/rules/server-operations.md`
- 关键代码：
  - `web-admin/src/store/modules/permission.ts:41-212`
  - `web-admin/src/router/index.ts:131-167`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/FactoryUserRole.java:33,71,134`
  - `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/permission/PlatformRolePermission.java`
