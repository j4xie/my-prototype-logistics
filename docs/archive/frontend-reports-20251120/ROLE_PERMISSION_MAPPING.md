# 角色权限与导航映射检查报告

生成时间: 2025-01-03

## 一、8个角色权限配置总览

### 平台角色 (3个)

#### 1. system_developer (系统开发者)
**权限级别**: -1 (最高)
**用户类型**: platform
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ✅ trace_access (溯源)
- ✅ admin_access (管理)
- ✅ platform_access (平台)
- ✅ debug_access (调试)
- ✅ system_config (系统配置)

**功能权限**:
- user_manage_all (全部用户管理)
- data_view_all (全部数据查看)
- data_export (数据导出)
- system_config (系统配置)
- debug_access (调试访问)
- developer_tools (开发工具)
- platform_manage_all (平台管理)
- factory_manage_all (工厂管理)
- whitelist_manage (白名单管理)

**登录后跳转**: Main → 显示所有Tab
**可见Tab**: home, farming, processing, logistics, trace, admin, platform, developer

---

#### 2. platform_super_admin (平台超级管理员)
**权限级别**: 0
**用户类型**: platform
**模块访问**:
- ❌ farming_access
- ❌ processing_access
- ❌ logistics_access
- ❌ trace_access
- ❌ admin_access
- ✅ platform_access (平台)

**功能权限**:
- platform_manage_all (平台管理)
- factory_manage_all (工厂管理)
- user_manage_all (全部用户管理)
- whitelist_manage (白名单管理)
- data_view_all (全部数据查看)
- data_export (数据导出)

**登录后跳转**: Main → 显示平台Tab
**可见Tab**: home, platform

---

#### 3. platform_operator (平台操作员)
**权限级别**: 1
**用户类型**: platform
**模块访问**:
- ❌ farming_access
- ❌ processing_access
- ❌ logistics_access
- ❌ trace_access
- ❌ admin_access
- ✅ platform_access (平台)

**功能权限**:
- user_view_all (查看全部用户)
- data_view_all (查看全部数据)
- platform_view_all (查看平台)
- factory_view_all (查看工厂)

**登录后跳转**: Main → 显示平台Tab
**可见Tab**: home, platform

---

### 工厂角色 (5个)

#### 4. factory_super_admin (工厂超级管理员)
**权限级别**: 0
**用户类型**: factory
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ✅ trace_access (溯源)
- ✅ admin_access (管理)
- ❌ platform_access

**功能权限**:
- user_manage_factory (工厂用户管理)
- data_view_factory (工厂数据查看)
- data_export (数据导出)
- farming_access (种植访问)
- processing_access (加工访问)
- logistics_access (物流访问)
- trace_access (溯源访问)

**登录后跳转**: Main → 显示业务Tab
**可见Tab**: home, farming, processing, logistics, trace, admin

---

#### 5. permission_admin (权限管理员)
**权限级别**: 5
**用户类型**: factory
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ✅ trace_access (溯源)
- ✅ admin_access (管理)
- ❌ platform_access

**功能权限**:
- user_manage_factory (工厂用户管理)
- data_view_factory (工厂数据查看)
- permission_manage (权限管理)
- role_assign (角色分配)

**登录后跳转**: Main → 显示业务Tab
**可见Tab**: home, farming, processing, logistics, trace, admin

---

#### 6. department_admin (部门管理员)
**权限级别**: 10
**用户类型**: factory
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ✅ trace_access (溯源)
- ❌ admin_access
- ❌ platform_access

**功能权限**:
- user_manage_department (部门用户管理)
- data_view_department (部门数据查看)
- department_manage (部门管理)

**登录后跳转**: Main → 显示业务Tab (无admin)
**可见Tab**: home, farming, processing, logistics, trace

---

#### 7. operator (操作员)
**权限级别**: 30
**用户类型**: factory
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ❌ trace_access
- ❌ admin_access
- ❌ platform_access

**功能权限**:
- data_input (数据输入)
- data_view_own (查看自己的数据)
- basic_operations (基础操作)

**登录后跳转**: Main → 显示基础业务Tab
**可见Tab**: home, farming, processing, logistics

---

#### 8. viewer (查看者)
**权限级别**: 50
**用户类型**: factory
**模块访问**:
- ✅ farming_access (种植)
- ✅ processing_access (加工)
- ✅ logistics_access (物流)
- ✅ trace_access (溯源)
- ❌ admin_access
- ❌ platform_access

**功能权限**:
- data_view_own (查看自己的数据)
- report_view (查看报表)

**登录后跳转**: Main → 显示查看Tab
**可见Tab**: home, farming, processing, logistics, trace

---

## 二、Tab可见性检查

### Tab配置 (navigationStore.ts)

| Tab名称 | 标题 | 所需模块 | 所需权限 | 所需角色 |
|---------|------|----------|----------|----------|
| home | 首页 | - | - | 所有人 |
| farming | 种植 | farming_access | - | - |
| processing | 加工 | processing_access | - | - |
| logistics | 物流 | logistics_access | - | - |
| trace | 溯源 | trace_access | - | - |
| alerts | 告警 | alerts_access | alerts:view | - |
| reports | 报表 | reports_access | reports:view | - |
| system | 监控 | system_access | system:view | - |
| admin | 管理 | admin_access | - | - |
| platform | 平台 | platform_access | - | - |
| developer | 开发 | - | - | system_developer |

### 各角色Tab可见性矩阵

| 角色 | home | farming | processing | logistics | trace | admin | platform | developer |
|------|------|---------|------------|-----------|-------|-------|----------|-----------|
| system_developer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| platform_super_admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| platform_operator | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| factory_super_admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| permission_admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| department_admin | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| operator | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| viewer | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

## 三、登录后导航流程

### SmartNavigationService.navigateAfterLogin()

```javascript
登录成功
  ↓
根据 role 和 userType 判断
  ↓
├─ system_developer → Main (显示所有Tab)
├─ platform (platform_super_admin/platform_operator) → Main (显示platform Tab)
└─ factory (所有工厂角色) → Main (显示对应业务Tab)
```

**所有角色登录后都跳转到 Main**，通过 `updateAvailableTabs(user)` 动态控制Tab显示

## 四、问题发现与建议

### ✅ 已确认正确的配置

1. **权限配置完整**: 所有8个角色都在 `FULL_ROLE_PERMISSIONS` 中有完整配置
2. **登录后跳转统一**: 都跳转到 Main,通过权限控制Tab显示
3. **权限刷新逻辑**: `useLogin.handleLoginSuccess()` 调用 `refreshPermissions(user)`
4. **Tab权限检查**: `navigationStore.canAccessTab()` 检查模块和权限

### ⚠️ 潜在问题

#### 1. **alerts/reports/system Tab 未在权限配置中启用**

当前权限配置中,没有角色启用以下模块:
- `alerts_access` (告警)
- `reports_access` (报表)
- `system_access` (监控)

**建议**: 为对应角色添加这些模块权限

#### 2. **登录后所有角色都跳转 Main**

`SmartNavigationService.navigateAfterLogin()` 中所有角色都返回 'Main',没有差异化处理。

**当前逻辑**: ✅ 正确 - 通过Tab可见性控制用户看到的功能
**建议**: 保持现���,这是最灵活的方案

#### 3. **部门权限在运行时设置**

`department_admin`, `operator`, `viewer` 的 `departments` 为空数组,注释说"将在运行时根据用户所属部门设置"。

**当前实现**: 在 `permissionStore.refreshPermissions()` 中有处理:
```typescript
if (user.userType === 'factory' && 'factoryUser' in user && user.factoryUser.department) {
  finalPermissions.departments = [user.factoryUser.department];
}
```

✅ **已正确实现**

## 五、修复建议

### 1. 为高级角色添加 alerts/reports/system 访问权限

修改 `FULL_ROLE_PERMISSIONS`:

```typescript
// system_developer - 已有所有权限,无需修改

// factory_super_admin - 添加高级功能
[FACTORY_ROLES.FACTORY_SUPER_ADMIN]: {
  modules: {
    // ... 现有模块
    alerts_access: true,    // 添加
    reports_access: true,   // 添加
    system_access: true,    // 添加
  },
  // ...
}

// permission_admin - 添加报表权限
[FACTORY_ROLES.PERMISSION_ADMIN]: {
  modules: {
    // ... 现有模块
    reports_access: true,   // 添加
  },
  // ...
}
```

### 2. 验证路由守卫配置 (NavigationGuard.tsx)

检查 `ROUTE_GUARDS` 配置与权限是否一致。

## 六、测试建议

### 手动测试每个角色

1. **system_developer** - 应看到8个Tab
2. **platform_super_admin** - 应看到2个Tab (home, platform)
3. **platform_operator** - 应看到2个Tab (home, platform)
4. **factory_super_admin** - 应看到6个Tab (home, farming, processing, logistics, trace, admin)
5. **permission_admin** - 应看到6个Tab (home, farming, processing, logistics, trace, admin)
6. **department_admin** - 应看到5个Tab (home, farming, processing, logistics, trace)
7. **operator** - 应看到4个Tab (home, farming, processing, logistics)
8. **viewer** - 应看到5个Tab (home, farming, processing, logistics, trace)

### 自动化测试

创建测试用例验证:
- 权限加载正确性
- Tab可见性正确性
- 路由守卫拦截正确性

---

**总结**: 整体架构设计合理,权限配置完整,登录后跳转逻辑正确。主要建议是为高级角色添加 alerts/reports/system 模块访问权限。