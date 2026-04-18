# 权限矩阵 AI 驱动系统 — 4 层解析 + Canvas 集成

**日期**: 2026-04-18
**作者**: Claude (session `bf9bf97b-6b12-4165-a7ec-0536bdcfcdd1`)
**状态**: Design draft, 待用户 review
**Brainstorming skill**: superpowers:brainstorming (hard-gate 通过)
**相关 bug**: #319 (UX fallback 吞 message) + RdController 权限 regression (Phase 5 引入)

---

## 1. Executive Summary

项目当前权限系统为 **hardcoded 前后端双 matrix**, 带来 3 个用户可见问题:

1. **"权限不足"** 错误当点击 "新建样品" — 根因是 Phase 5 给 RdController 加 `@RequirePermission({"rd:read_write"})`, 但 `rd` 模块两边 matrix 都不存在, 导致只有 factory_super_admin 能用.
2. **"调拨单不存在"** / **"采购订单不存在"** — 详情页 GET 404 时用 toast 而非 empty-state, 用户体验断崖.
3. **前后端 matrix 不一致** — 前端有 `restaurant` / `platform_admin` 等 backend 没定义的元素, 反之后端有 `work_report/inventory/report` 前端未暴露.

本 spec 提出 **4 层权限解析架构 + Canvas 编辑器集成 + AI chat 辅助修改** 的综合方案, 分 5 个 Sprint 落地, S1 当天止血, S2-S5 各 1 天.

---

## 2. Problem Statement

### 2.1 业务问题

- 权限规则变更需要改 `.java` / `.ts` 代码 + 重新 deploy. 运维/客户支持看不见 / 改不动.
- 不同工厂的业务角色职责差异 (例如 F001 的 dispatcher 参与 RD 审核, F002 的 dispatcher 不参与) 只能靠分支代码, 不能配置化.
- 新增模块 (如本次的 `rd`) 需要 30+ 处改动 (前端 matrix / 后端 matrix / 每个角色分配), 容易漏.

### 2.2 技术问题

- 前后端 `PERMISSION_MATRIX` 常量重复定义, 偏移后靠人工 review 对齐.
- UserMenuPermission 已有 user-level 覆盖 (2026-04-08), 但只覆盖 menu_code 不是 module_code, 不够完整.
- Canvas 的 field-level 权限 (`permission_config` JSONB) 和 module-level 权限缺乏统一叙事, super_admin 在多处改权限.

### 2.3 为什么现在做

- Bug #319 (`@RequirePermission({"rd:rw"})` regression) 已 block RdController 的所有非 super_admin 用户的写操作
- Phase 2-19 共 593 个 `@RequirePermission` 注解, `rd` orphan 如果不修, 未来新 controller 复制模板会重蹈覆辙
- UX bug (详情页 toast vs empty-state) 已连续 2 个 session 观察到, 客户投诉风险升高

---

## 3. Goals & Non-Goals

### Goals

1. **G1**: 修复 RdController regression, 恢复 dispatcher/sales_manager 对 RD 模块的写权限
2. **G2**: 对齐前后端 `PERMISSION_MATRIX`, 消除 `restaurant`/`platform_admin`/`finance_manager.analytics` 等已知 divergence
3. **G3**: 权限规则从 hardcoded 常量迁移到 DB, 支持 platform_admin 和 factory_super_admin 在 UI 修改
4. **G4**: 工厂级权限 override 能力 (Layer 2) — 同 role 在不同工厂可有不同 module level
5. **G5**: AI chat 能识别 "改权限" 意图, 生成 diff 预览, 用户一键应用
6. **G6**: 修详情页 404 UX (empty-state 替代 toast) — 真正解决 "XX 不存在" 用户困惑

### Non-Goals

- **NG1**: 不重新设计菜单系统 (UserMenuPermission 保持 menu-level, 不升级到 module-level)
- **NG2**: 不建 fine-grained action-level 权限 (例如"dispatcher 能开票但不能作废") — 当前 read/write 二分够用
- **NG3**: 本轮不做 audit log UI (记日志但不提供查询页, 留给未来)
- **NG4**: 不支持权限规则的 version history / 回滚 UI (直接改直接生效, 万一出事手动 revert)
- **NG5**: AI chat 的 intent classifier 只加 "改权限" 一个新意图, 不重构现有 autopilot/plan/action 模式

---

## 4. Architecture — 4 层权限解析

### 4.1 层次模型

```
┌───────────────────────────────────────────────────────────────┐
│ Layer 0: User-Level Override (已存在, 不改动)                 │
│   表: user_menu_permissions (2026-04-08 加的)                 │
│   粒度: user_id × menu_code → GRANT/REVOKE                    │
│   作用: 个别用户的特批/禁令                                   │
└───────────────────────────────────────────────────────────────┘
                               ↓
┌───────────────────────────────────────────────────────────────┐
│ Layer 2: Factory Override (本 spec 新加)                      │
│   列: factory_module_configs.role_module_override (JSONB)     │
│   粒度: factoryId × role × module → rw/r/w/-                  │
│   存储: {"dispatcher":{"rd":"rw"},"sales_manager":{"rd":"r"}} │
│   改: factory_super_admin 在 Canvas "模块权限" tab            │
│   优先级: 比 Layer 1 高, 比 Layer 0 低                        │
└───────────────────────────────────────────────────────────────┘
                               ↓
┌───────────────────────────────────────────────────────────────┐
│ Layer 1: Platform Global Default (本 spec 新加)               │
│   表: platform_role_permissions                               │
│   列: role_code, module_code, permission_level (rw/r/w/-)    │
│   改: platform_admin 在 /platform/role-permissions 独立页     │
│   Seed: 初始从当前 hardcoded PERMISSION_MATRIX 迁移            │
└───────────────────────────────────────────────────────────────┘
                               ↓
┌───────────────────────────────────────────────────────────────┐
│ Fallback: Hardcoded PERMISSION_MATRIX (保留为安全网)          │
│   在 PermissionServiceImpl.java, 跟现在相同                   │
│   作用: DB 不可用 / Layer 1 空时兜底                          │
└───────────────────────────────────────────────────────────────┘

Layer 3 (未在本 spec scope, 但说明与 L0-L2 关系):
  列: factory_module_configs.permission_config (JSONB, 已存在)
  粒度: factoryId × moduleCode × fieldCode × role → edit/view/hidden
  作用: 字段级可见性/可编辑性
  独立于 L0-L2, 补充作用: L0-L2 gate 通过后, L3 在 response 过滤字段
```

### 4.2 解析顺序 (从特异到一般)

对于 `hasPermission(user, "rd:read_write")`:

1. **L2 check**: `factory_module_configs` 里 user.factoryId 对 user.role 的 rd 有 override? → 用 override level
2. **L1 check**: `platform_role_permissions` 里 user.role 对 rd 的 level? → 用这个 level
3. **Fallback**: hardcoded matrix (仍在 `PermissionServiceImpl.java`) → 用 level
4. **默认**: 如果一层都没查到 → 返回 false (failsafe)

**L0 集成说明** (重要): 当前 `user_menu_permissions` 表存 menu_code (路由级), 而 module_code (模块级) 是不同粒度. 本 spec **不做 L0 到 module 的映射**, L0 保持菜单层级独立机制:

- `UserMenuPermission` 继续只影响菜单可见性 (侧边栏 / 路由守卫)
- `@RequirePermission` 的 module-level check 只走 L2 → L1 → fallback
- 用户级 module-level override (例如"给张三特批 rd:rw") 如果将来需要, 再做新 migration 扩展 `user_menu_permissions` 加 `module_code` 字段

本 spec 的 "4 层" 叙述保留在 §4.1 是为了说明**整体权限体系**结构, 但 **L0 和 L3 不在本 spec 的实现 scope**, 只有 L1 + L2 + fallback 是本次新建/修改.

### 4.3 为什么 L0 在最外层不是最内层

传统分层 (like CSS cascade) 是 "specific overrides general". 我们的顺序:

- L0 (user 级) 最特异 — 针对具体用户, 必须最先看
- L2 (factory 级) 次特异 — 本工厂的例外
- L1 (platform 级) 最一般 — 全局默认
- Fallback — 代码级保险

这样允许 platform_admin 设全局默认, factory_admin 在本工厂 override, super_admin 给特殊用户特批, 三者互不阻塞, 各自发挥.

---

## 5. Components

### 5.1 Backend (Java / Spring Boot)

#### 5.1.1 新表: `platform_role_permissions`

```sql
CREATE TABLE platform_role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) NOT NULL,           -- FactoryUserRole.name()
  module_code VARCHAR(32) NOT NULL,         -- 在 ALL_MODULES 白名单内
  permission_level VARCHAR(8) NOT NULL,     -- 'rw' | 'r' | 'w' | '-'
  updated_by BIGINT,                        -- 修改者 user_id
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,
  UNIQUE(role_code, module_code)
);

CREATE INDEX idx_platform_role_permissions_role ON platform_role_permissions(role_code);
```

Flyway migration: `V20260419_01__platform_role_permissions.sql`, seed 从当前 `PERMISSION_MATRIX` 填充.

#### 5.1.2 新列: `factory_module_configs.role_module_override`

```sql
ALTER TABLE factory_module_configs 
  ADD COLUMN role_module_override JSONB DEFAULT '{}';

COMMENT ON COLUMN factory_module_configs.role_module_override IS 
  '工厂级角色-模块权限 override. 格式: {"role_code":{"module_code":"rw|r|w|-"}}. 未列出的 (role,module) 组合 fallback 到 platform_role_permissions.';
```

Flyway migration: `V20260419_02__role_module_override_column.sql`

#### 5.1.3 `PermissionServiceImpl` 重构

```java
@Service
public class PermissionServiceImpl implements PermissionService {
  
  @Autowired private PlatformRolePermissionRepository platformRepo;
  @Autowired private FactoryModuleConfigRepository factoryConfigRepo;
  @Autowired private UserMenuPermissionRepository userMenuRepo;
  
  // Caffeine cache, 5min TTL, 1000 entries
  @Cacheable(value = "permissionResolution", key = "#user.id + ':' + #permissionCode")
  public boolean hasPermission(User user, String permissionCode) {
    // ... 按 L0 → L2 → L1 → fallback 顺序查 ...
  }
  
  // 清 cache 方法 (PUT API 调用)
  @CacheEvict(value = "permissionResolution", allEntries = true)
  public void invalidateCache() {}
  
  // 保留 hardcoded PERMISSION_MATRIX 作为 fallback
  private static final Map<FactoryUserRole, Map<String, String>> HARDCODED_FALLBACK = ...;
}
```

#### 5.1.4 新 API endpoints

| Method | Path | Role | 作用 |
|---|---|---|---|
| GET | `/api/mobile/platform/role-permissions` | platform_admin | 读 L1 全矩阵 |
| PUT | `/api/mobile/platform/role-permissions/{role}/{module}` | platform_admin | 改 L1 单格 |
| GET | `/api/mobile/{factoryId}/canvas/role-module-override` | factory_super_admin | 读 L2 本工厂 override |
| PUT | `/api/mobile/{factoryId}/canvas/role-module-override/{role}/{module}` | factory_super_admin | 改 L2 单格 (传 null 清 override) |

#### 5.1.5 新增 `rd` 模块 + 矩阵对齐

- `ALL_MODULES` 加 `"rd"` (同时加 `"restaurant"` 对齐前端)
- `PERMISSION_MATRIX` seed 时加 rd:
  - factory_super_admin: rw
  - platform_admin: rw (需要先加 platform_admin 到后端 FactoryUserRole enum)
  - sales_manager: rw
  - dispatcher: rw
  - workshop_supervisor: r
  - team_leader: r
  - group_leader: -
  - quality_manager: r
  - others: -
  - viewer: r

### 5.2 Frontend (Vue 3 / Pinia)

#### 5.2.1 `permission.ts` store 改为 DB-driven

**前端**: 完全删除 hardcoded `PERMISSION_MATRIX` 常量 (Sprint 3 执行).
**后端**: 保留 hardcoded matrix 作为 DB 不可用时的 fallback (safety net, §4.1 已说明), **不**删除.

Frontend 改为:

```typescript
export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<ModulePermissions | null>(null);  // 当前用户的 resolved 权限
  const isLoaded = ref(false);
  
  async function loadForCurrentUser() {
    // login 成功后调用
    // fetch L1 全矩阵 + L2 本 factory override → merge → 填 permissions
    const [l1Resp, l2Resp] = await Promise.all([
      get('/api/mobile/platform/role-permissions'),
      get(`/api/mobile/${authStore.factoryId}/canvas/role-module-override`)
    ]);
    permissions.value = mergeLayers(l1Resp.data, l2Resp.data, authStore.role);
    isLoaded.value = true;
  }
  
  function canWrite(module: ModuleName): boolean {
    if (!isLoaded.value) return false;  // 加载前保守拒绝
    const level = permissions.value?.[module];
    return level === 'rw' || level === 'w';
  }
  
  // 保留向后兼容 API
  function canAccess(module: ModuleName): boolean { ... }
  function hasFullAccess(module: ModuleName): boolean { ... }
});
```

#### 5.2.2 新页 `/platform/role-permissions`

- 路由: `/platform/role-permissions`
- 守卫: 仅 platform_admin
- 组件: `views/platform/RolePermissions.vue`
- UI: 表格 (行=角色, 列=模块, 单元格=dropdown `rw/r/w/-`)
- 保存: 单元格 change 后本地 dirty, 点 "保存更改" 批量 PUT
- 安全: 当前 user 的 system 行禁止改成 `-` (circular lockout guard)

#### 5.2.3 Canvas 加 "模块权限" tab

- 文件: `views/platform/canvas-editor/components/ModulePermissionMatrix.vue`
- 位置: Canvas editor 第 8 个 tab (和 "字段权限" 并列)
- UI: 同 /platform/role-permissions 的表格, 但:
  - 每格有视觉区分 "继承" (灰色斜体) vs "本工厂 override" (粗体)
  - Hover 单元格显示 tooltip "来源: 全局默认 rw / 来源: 本工厂 override rw (2026-04-19 改)"
  - 每格旁有小 🔄 按钮 "重置为默认" (清 override)
- 调用: PUT `/canvas/role-module-override`

#### 5.2.4 AI chat 增强 (AIChatPanel.vue)

当前 AI 支持 diff 类型: `TOGGLE_FIELD`, `ADD_RULE` 等. 新加:

```typescript
// 新 diff 类型
{
  type: 'UPDATE_PERMISSION',
  layer: 'L1' | 'L2',        // 全局默认 or 工厂 override
  factoryId?: string,         // L2 时必填
  role: string,               // e.g., 'dispatcher'
  module: string,             // e.g., 'rd'
  from: 'rw'|'r'|'w'|'-'|null,
  to: 'rw'|'r'|'w'|'-'|null,
  description: string,        // 给用户看的 "把 F001 dispatcher 的 rd 从 r 改 rw"
}
```

AI backend (`/config/v2/ai/chat`) prompt 增强: 识别 "改权限/调整权限/给/收回权限" 等关键词, 根据当前 user.role 推断 layer (platform_admin → L1, factory_super_admin → L2), 生成 diff.

用户点 "应用" 按钮 → 前端调对应 PUT API → store 清 cache → 全局权限更新.

#### 5.2.5 详情页 `<NotFoundEmpty>` 组件 (Sprint 5)

独立 sprint, 但在本 spec 一并规划:

```vue
<!-- components/common/NotFoundEmpty.vue -->
<template>
  <el-empty :description="description">
    <el-button type="primary" @click="router.push(returnPath)">
      返回{{ returnLabel }}
    </el-button>
  </el-empty>
</template>
```

改 `transfer/detail.vue`, `procurement/orders/detail.vue` 等 detail 页面: catch 404 时 set `notFound.value = true`, 模板 `<NotFoundEmpty v-if="notFound" ...>` 替代当前 toast.

---

## 6. Data Flow (完整请求生命周期)

```
[1] 用户登录 (POST /auth/unified-login)
    ↓
[2] authStore.setUser(response.data) 
    → role='dispatcher', factoryId='F001'
    ↓
[3] permissionStore.loadForCurrentUser()
    → Promise.all([
        GET /platform/role-permissions → L1 全矩阵
        GET /F001/canvas/role-module-override → L2 本工厂 override
      ])
    → 过滤出 role=dispatcher 的 L1 + L2 行, merge
    → permissions.value = { dashboard:'rw', production:'rw', rd:'rw', ... }
    → isLoaded = true
    ↓
[4] 路由 /rd/samples 加载
    → permission guard: canAccess('rd') === true → allow
    → 组件渲染, canWrite('rd') === true → 显示 "新建样品" 按钮
    ↓
[5] 用户点 "新建样品" → 填表 → 提交
    → POST /api/mobile/F001/rd/samples (axios)
    → JwtInterceptor: 设置 user 到 request.attributes
    → PermissionInterceptor: @RequirePermission({"rd:read_write"}) 检查
      → permissionService.hasAnyPermission(user, "rd:read_write")
      → hasPermission(user, "rd:read_write"):
        → L0 check: user_menu_permissions 无 GRANT/REVOKE (Cache miss → DB → cache)
        → L2 check: F001.role_module_override?.dispatcher?.rd === 'rw' ✓ return true
      → PASS
    → Controller 执行, 返回 201
    ↓
[6] Response 过滤 (L3, 字段级)
    → ResponseAdvice 读 factory_module_configs.permission_config
    → field 'customer.phone' 对 dispatcher = 'hidden' → 从 JSON 移除
    → 返回 filtered JSON

[权限修改流程]
[7] super_admin 在 Canvas "模块权限" tab 把 F001.dispatcher.rd 改成 'r'
    → UI dropdown change → dirty=true
    → 点 "保存" → PUT /F001/canvas/role-module-override/dispatcher/rd { level: 'r' }
    → 后端 update factory_module_configs.role_module_override JSONB
    → @CacheEvict 清 permissionResolution cache
    → 所有 F001 用户下次请求时 hasPermission(dispatcher, "rd:*") 重新计算
    ↓
[8] 或: AI chat 对话 "把 F001 调度员对 RD 改只读"
    → POST /config/v2/ai/chat { message: ... }
    → AI 解析: intent=UPDATE_PERMISSION, role=dispatcher, module=rd, to=r
    → 推断 layer=L2 (因为 current user = factory_super_admin)
    → Response: { diff: { type:'UPDATE_PERMISSION', ... } }
    → 前端渲染 diff card + "应用" 按钮
    → 用户点 "应用" → 同 [7] 的 PUT 流程
```

---

## 7. Error Handling

### 7.1 Circular Lockout 守护

platform_admin 不能把自己角色的 system 模块改成 `-` (会锁死管理 UI).

```java
// PlatformRolePermissionController.update()
if (roleCode.equals("platform_admin") && moduleCode.equals("system") 
    && !level.equals("rw")) {
  throw new BusinessException("不能降低平台管理员对 system 模块的权限 (会锁死管理 UI)");
}
```

类似守护 factory_super_admin.system — 改其 level 只允许超级管理员自己手动 DB SQL.

### 7.2 Module 白名单校验

PUT 时 validate `moduleCode in ALL_MODULES`, 防止乱写 (例如 `"system:rw"` 拼错成 `"sytem:rw"`).

```java
if (!ALL_MODULES.contains(moduleCode)) {
  throw new BusinessException("无效的模块代码: " + moduleCode 
    + ". 允许: " + String.join(",", ALL_MODULES));
}
```

### 7.3 JSONB corruption 兜底

读 `role_module_override` 如果 parse 失败 (极端 DB 污染):

```java
try {
  Map<String, Map<String, String>> override = 
    objectMapper.readValue(json, new TypeReference<>() {});
  return override.getOrDefault(role, Collections.emptyMap()).get(module);
} catch (JsonProcessingException e) {
  log.error("factory_module_configs.role_module_override corrupt for factory {}", factoryId, e);
  return null;  // fallback 到 L1
}
```

### 7.4 Cache 不一致

PUT API 必须 `@CacheEvict(allEntries=true)`. 多实例部署时 (未来) 需要 distributed cache invalidation (Redis pub/sub), 本 spec 单实例模式 ok.

### 7.5 Deadlock protection — 权限还没加载时

`permissionStore.canWrite(module)` 在 `isLoaded=false` 时返回 `false` (保守拒绝) — 防止登录瞬间 flicker 显示不该显示的按钮.

### 7.6 Degradation — 加载权限失败时

`loadForCurrentUser()` 如果 GET 失败 (网络异常 / 服务宕机):
- `isLoaded` 保持 false
- `permissions` 保持 null  
- UI 显示 "权限加载中, 请刷新" 蒙层 (而不是 silent all-deny)
- 允许用户手动重试

---

## 8. Testing Strategy

### 8.1 Unit tests (Java)

```java
// PermissionServiceImplTest
@Test void hasPermission_L0GrantOverridesAll() { ... }
@Test void hasPermission_L0RevokeOverridesAll() { ... }
@Test void hasPermission_L2OverridesL1() { ... }
@Test void hasPermission_L1AppliesWhenNoL2() { ... }
@Test void hasPermission_FallbackToHardcodedWhenNoL1() { ... }
@Test void hasPermission_DefaultFalseWhenAllMissing() { ... }
@Test void hasPermission_CircularLockoutGuard() { ... }

// PlatformRolePermissionControllerTest  
@Test void putRolePermission_asPlatformAdmin_succeeds() { ... }
@Test void putRolePermission_asFactorySuperAdmin_forbidden() { ... }
@Test void putRolePermission_invalidModule_400() { ... }
@Test void putRolePermission_platformAdminSystemDowngrade_rejected() { ... }
```

### 8.2 Integration tests

```java
// PermissionFlowIntegrationTest (@SpringBootTest)
@Test void flywayMigration_seedsPlatformRolePermissions() {
  // 验证 migration 完成后 DB 行数 = hardcoded MATRIX 行数
}
@Test void endToEndRequest_dispatcherRdSamplesWrite_afterRdModuleAdded() {
  // dispatcher login → POST /rd/samples → 201
}
```

### 8.3 Frontend tests

```typescript
// permission.test.ts (Vitest)
describe('permissionStore.mergeLayers', () => {
  it('L2 override takes precedence over L1 default', () => { ... });
  it('unlisted module falls back to hardcoded', () => { ... });
});
```

### 8.4 E2E tests (Playwright, per v2.2 qa-prompt)

4 个 deep scenarios:

**E1**: platform_admin 改全局 dispatcher.rd=r, 新开 tab 用 dispatcher 登录 → 新建样品按钮消失
**E2**: factory_super_admin F001 override dispatcher.rd=rw (全局为 r), F001 dispatcher 有按钮, F002 dispatcher 无按钮
**E3**: AI chat "把 F001 dispatcher 对 rd 改只读" → 生成 diff → 应用 → L2 写入成功, dispatcher 立即失去按钮
**E4**: 详情页 FAKE-ID → <NotFoundEmpty> 渲染, 点"返回列表" 导航正确, console 0 error

每个 E2E 按 qa-prompt v2.2 Rule 7 + 8 (MutationObserver + 四位一体 + sticky 5s).

---

## 9. Rollout Plan (5 Sprint, Approach I)

### Sprint 1 (30 min, 今天止血)

**注意**: Sprint 1 是 **过渡性修复** — 所有 hardcoded matrix 改动在 Sprint 3 前端 store 重构时会被 DB-driven 替代 (前端), 后端 hardcoded 保留作 fallback.

**交付**:
- `PermissionServiceImpl.ALL_MODULES` 加 `"rd"` + `"restaurant"`
- Backend `PERMISSION_MATRIX` hardcoded 各角色填 `rd` level (按 Clarifying Q3 矩阵) — 作 Sprint 2 seed 数据源 + 长期 fallback
- Frontend `permission.ts` `ModulePermissions` interface 加 `rd: PermissionLevel` — Sprint 3 store 重构后 interface 仍在 (只是值改来源)
- Frontend 各角色 `PERMISSION_MATRIX` 加 rd 行 — **Sprint 3 删除**, 目前作过渡
- `RdController` 注解保持 `{"rd:read_write"}` — 现在 rd 模块存在了, dispatcher/sales_manager 有 rw 所以通过
- 可选: 把 `rd/samples/list.vue` 的 `canWrite('production')` 改成 `canWrite('rd')` (不是必要, dispatcher 既有 production:rw 也有 rd:rw, 两种检查都过; 但 **语义更准** — 因为 RD 不是 production)

**可发布**: test

**验证**: Playwright E2E dispatcher 登录 → 新建 RD 样品成功

### Sprint 2 (1 天)

**交付**:
- Flyway V20260419_01: 建表 `platform_role_permissions`, seed 从 hardcoded MATRIX 填充
- Flyway V20260419_02: `factory_module_configs` 加列 `role_module_override JSONB DEFAULT '{}'`
- `PermissionServiceImpl` 重构: 改为按 L0→L2→L1→fallback 查询 + Caffeine cache
- 新 Repository: `PlatformRolePermissionRepository`, `FactoryModuleConfigRepository` (已存在?核对)
- 新 Controller: `PlatformRolePermissionController` (GET/PUT L1)
- 扩展 `CanvasConfigController` 加 L2 GET/PUT endpoints
- 单元测试 + 集成测试 (§8.1, §8.2)
- Backend 部署 (DB migration + jar)
- **前后端 matrix 对齐**: 后端加 `restaurant`, `platform_admin`, 对齐 `finance_manager.analytics` (rw→r 或 r→rw, 以业务为准 — 需 clarify)

**可发布**: test → prod (纯 backend + DB, 无 UI 风险)

**验证**: Postman / curl 调 GET/PUT API, 观察 DB 变化 + cache 清理

### Sprint 3 (1 天)

**交付**:
- Frontend `permission.ts` 重构: 删 hardcoded matrix, 改为 login 后 fetch + merge
- 新页 `/platform/role-permissions` (components/platform/RolePermissions.vue)
- Canvas 加 "模块权限" tab (`ModulePermissionMatrix.vue`)
- Frontend 单元测试 (§8.3)
- E2E: platform_admin 手动改 L1, factory_admin 改 L2

**可发布**: test

**验证**: E2E §8.4 E1+E2

### Sprint 4 (1 天)

**交付**:
- AI Chat (AIChatPanel.vue) 加 `UPDATE_PERMISSION` diff 类型支持
- AI backend (`/config/v2/ai/chat`) prompt 增强: 识别改权限意图 + layer 推断
- E2E: §8.4 E3 (AI chat 改权限)

**可发布**: test → prod

### Sprint 5 (0.5 天, 与 S1-S4 任何时候并行)

**交付**:
- `components/common/NotFoundEmpty.vue` 组件
- 改 `transfer/detail.vue`, `procurement/orders/detail.vue` (+ 其他 ~10 detail 页面) catch 404 → 显示 empty-state
- 删除对应 toast 逻辑
- E2E: §8.4 E4

**可发布**: test → prod

### Sprint 依赖

S1 (止血, 独立) → 同时 S5 (独立)
S2 → S3 (前端需要 API) → S4 (AI 需要 UI diff 能正确渲染)

---

## 10. Open Questions / Risks

### 10.1 业务 clarify

- **Q1**: `finance_manager` 的 `analytics` 级别应该是 `r` (前端现状) 还是 `rw` (后端现状)? 影响 Sprint 2 对齐.
- **Q2**: `platform_admin` 后端目前不在 `FactoryUserRole` enum. 是加到 enum, 还是单独 `PlatformRole` enum? 影响 Sprint 2 schema.
- **Q3**: `restaurant_manager` 角色要不要加到后端? (前端已有) 或者认为餐饮场景用 `sales_manager` + 工厂类型=RESTAURANT 过滤?

### 10.2 技术 risk

- **R1**: Cache 不一致 (多实例部署) — 目前单实例 ok, 未来扩容前需加 Redis pub/sub invalidation
- **R2**: AI intent classifier 可能把非权限语句误判为 UPDATE_PERMISSION — 确认步骤 (用户必须点"应用") 缓解风险
- **R3**: Flyway migration seed SQL 需保证和当前 hardcoded MATRIX 完全一致, 否则生产部署后某角色瞬间失去权限 — 建议 S2 写 self-check (启动时对比 DB vs hardcoded, 不一致打 error log)
- **R4**: permissionStore 加载失败时 UI 不可用 — §7.6 已规划 "权限加载中" 蒙层, 但需要设计 retry backoff

### 10.3 Scope risk

- **SR1**: Sprint 5 可能发现不止 2 个详情页有 404 toast 问题, 需要扫全部 detail.vue. 预估 10-15 个, 半天够
- **SR2**: UserMenuPermission (L0) 目前只有 menu_code, 不是 module_code. 本 spec 假定 L0 check 时做 menu_code → module 的映射 (硬编码表). 若未来扩展 UserMenuPermission 到 module 级, 需要独立 migration

---

## 11. Glossary

- **Layer 0 (L0)**: User-level override, user_menu_permissions table, GRANT/REVOKE
- **Layer 1 (L1)**: Platform global default, platform_role_permissions table
- **Layer 2 (L2)**: Factory override, factory_module_configs.role_module_override JSONB
- **Layer 3 (L3)**: Field-level, factory_module_configs.permission_config JSONB (不在本 spec 主 scope)
- **Fallback**: Hardcoded PERMISSION_MATRIX in PermissionServiceImpl.java
- **Module**: 功能模块 (production/warehouse/rd/...), granularity 与菜单一一对应
- **Role**: FactoryUserRole enum 值 (dispatcher/sales_manager/...)
- **Level**: 权限级别 `rw`/`r`/`w`/`-`
- **Diff (AI)**: Canvas AI chat 的变更提议, JSON 对象, 用户点"应用"才执行
- **UPDATE_PERMISSION**: 新 diff 类型, 格式见 §5.2.4

---

## 12. Approval Checklist

- [x] § 1-6 Design sections 用户 verbal 确认 "OK" (session `bf9bf97b`, 2026-04-18 23:30 CST)
- [x] Spec 写入 `docs/superpowers/specs/2026-04-18-permission-matrix-ai-driven-design.md`
- [ ] Self-review (placeholder/consistency/scope/ambiguity) — 下一步
- [ ] User review spec file — 用户阅读并批准
- [ ] 进入 `writing-plans` skill 生成 implementation plan

---

**结束**. 签名: Claude, session `bf9bf97b-6b12-4165-a7ec-0536bdcfcdd1`.
