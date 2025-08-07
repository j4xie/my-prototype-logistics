# 增强权限系统使用指南

海牛食品溯源系统 React Native 应用的权限管理系统，支持多层级权限检查、权限缓存和灵活的权限控制。

## 系统架构

### 组件层级
```
usePermission (主Hook)
├── usePermissions (增强权限系统)
├── usePermissionStore (Zustand状态管理)
└── useAuthStore (用户认证状态)

权限保护组件
├── EnhancedPermissionGuard (增强权限守卫)
└── PermissionGuard (基础权限守卫)
    ├── RoleGuard (角色守卫)
    ├── ModuleGuard (模块守卫)
    └── DeveloperGuard (开发者守卫)
```

## 快速开始

### 1. 基础权限检查

```tsx
import { usePermission } from '../../hooks/usePermission';
import { PermissionGuard } from '../auth/PermissionGuard';

function MyComponent() {
  const { hasRole, hasPermission, hasModuleAccess } = usePermission();

  // 检查单个权限
  const canManageUsers = hasPermission('user_manage_all');
  
  // 检查角色
  const isAdmin = hasRole('platform_super_admin');
  
  // 检查模块访问
  const hasAdminAccess = hasModuleAccess('admin_access');

  return (
    <View>
      {canManageUsers && (
        <Text>您可以管理用户</Text>
      )}
      
      <PermissionGuard permission="user_create">
        <Button title="创建用户" />
      </PermissionGuard>
    </View>
  );
}
```

### 2. 增强权限检查

```tsx
import { EnhancedPermissionGuard } from '../auth/EnhancedPermissionGuard';

function AdvancedComponent() {
  return (
    <EnhancedPermissionGuard
      roles={['platform_super_admin', 'factory_super_admin']}
      permissions={['user_manage_all']}
      modules={['admin_access']}
      minimumLevel={10}
      options={{
        requireAll: false,
        checkLevel: true,
        cacheResult: true
      }}
      fallback={<Text>您没有权限访问此功能</Text>}
      onPermissionGranted={() => console.log('权限检查通过')}
      onPermissionDenied={(reason) => console.log('权限被拒绝:', reason)}
    >
      <AdminPanel />
    </EnhancedPermissionGuard>
  );
}
```

## 权限类型

### 用户角色 (UserRole)
```typescript
// 平台用户角色
'system_developer'        // 系统开发者 (级别: -1)
'platform_super_admin'    // 平台超级管理员 (级别: 0)
'platform_operator'       // 平台操作员 (级别: 1)

// 工厂用户角色
'factory_super_admin'     // 工厂超级管理员 (级别: 0)
'permission_admin'        // 权限管理员 (级别: 5)
'department_admin'        // 部门管理员 (级别: 10)
'operator'               // 操作员 (级别: 30)
'viewer'                 // 查看者 (级别: 50)
```

### 权限特性 (Features)
```typescript
// 用户管理权限
'user_manage_all'         // 管理所有用户
'user_manage_factory'     // 管理工厂用户
'user_manage_department'  // 管理部门用户
'user_create'            // 创建用户
'user_edit'              // 编辑用户
'user_delete'            // 删除用户

// 模块访问权限
'farming_access'         // 养殖模块
'processing_access'      // 加工模块
'logistics_access'       // 物流模块
'trace_access'           // 溯源模块
'admin_access'           // 管理模块
'platform_access'        // 平台模块
```

### 数据访问级别 (Data Access Level)
```typescript
'all'        // 全部数据 (系统开发者、平台管理员)
'factory'    // 工厂数据 (工厂用户)
'department' // 部门数据 (部门内用户)
'own'        // 个人数据 (仅自己)
```

## 组件使用指南

### EnhancedPermissionGuard

最强大的权限保护组件，支持多种权限检查方式：

#### 基本属性
```tsx
<EnhancedPermissionGuard
  // 权限检查参数
  permissions={['user_manage_all', 'user_edit']}
  roles={['platform_super_admin', 'factory_super_admin']}
  modules={['admin_access']}
  department="生产部门"
  minimumLevel={10}
  
  // 数据访问权限
  dataOwner="user123"
  dataDepartment="质量控制部"
  dataLevel="factory"
  
  // UI 控制
  fallback={<Text>权限不足</Text>}
  showFallback={true}
  loadingComponent={<LoadingSpinner />}
  errorComponent={<ErrorView />}
  
  // 行为控制
  options={{
    requireAll: false,        // 是否需要所有权限
    checkLevel: true,         // 是否检查权限级别
    checkDepartment: true,    // 是否检查部门权限
    cacheResult: true,        // 是否缓存结果
    retryOnFailure: false     // 失败时是否重试
  }}
  
  // 回调函数
  onPermissionGranted={() => console.log('权限通过')}
  onPermissionDenied={(reason) => console.log('权限拒绝:', reason)}
>
  <ProtectedContent />
</EnhancedPermissionGuard>
```

#### 常用场景示例

**1. 管理员功能保护**
```tsx
<EnhancedPermissionGuard
  roles={['system_developer', 'platform_super_admin']}
  options={{ requireAll: false }}
>
  <AdminPanel />
</EnhancedPermissionGuard>
```

**2. 权限级别检查**
```tsx
<EnhancedPermissionGuard
  minimumLevel={10}
  options={{ checkLevel: true }}
  fallback={<Text>需要更高权限级别</Text>}
>
  <AdvancedFeatures />
</EnhancedPermissionGuard>
```

**3. 部门权限检查**
```tsx
<EnhancedPermissionGuard
  department="生产部门"
  options={{ checkDepartment: true }}
>
  <ProductionData />
</EnhancedPermissionGuard>
```

**4. 数据访问权限**
```tsx
<EnhancedPermissionGuard
  dataLevel="own"
  dataOwner={currentUser.id}
>
  <PersonalSettings />
</EnhancedPermissionGuard>
```

**5. 复杂权限组合**
```tsx
<EnhancedPermissionGuard
  roles={['factory_super_admin', 'permission_admin']}
  modules={['admin_access']}
  minimumLevel={15}
  department="质量控制部"
  options={{
    requireAll: false,
    checkLevel: true,
    checkDepartment: true,
    cacheResult: true
  }}
>
  <QualityManagement />
</EnhancedPermissionGuard>
```

### 基础权限守卫组件

#### RoleGuard - 角色守卫
```tsx
<RoleGuard 
  allowedRoles={['platform_super_admin', 'factory_super_admin']}
  fallback={<Text>需要管理员权限</Text>}
>
  <AdminContent />
</RoleGuard>
```

#### ModuleGuard - 模块守卫
```tsx
<ModuleGuard 
  module="admin_access"
  fallback={<Text>需要管理模块权限</Text>}
>
  <ModuleContent />
</ModuleGuard>
```

#### DeveloperGuard - 开发者守卫
```tsx
<DeveloperGuard fallback={<Text>仅开发者可见</Text>}>
  <DebugTools />
</DeveloperGuard>
```

## Hook 使用指南

### usePermission - 统一权限Hook

```tsx
import { usePermission } from '../../hooks/usePermission';

function MyComponent() {
  const {
    // 基础信息
    user,
    permissions,
    isLoading,
    
    // 基础权限检查
    hasPermission,
    hasRole,
    hasAnyRole,
    hasModuleAccess,
    
    // 增强权限检查
    checkEnhancedPermissions,
    hasMinimumLevel,
    hasDepartmentAccess,
    hasDataAccess,
    getUserLevel,
    getUserDepartments,
    
    // 缓存管理
    clearPermissionCache,
    getPermissionCacheStats,
    
    // 权限刷新
    refreshPermissions
  } = usePermission();
  
  // 使用示例
  const handleCheckComplexPermissions = async () => {
    const result = await checkEnhancedPermissions({
      roles: ['platform_super_admin'],
      permissions: ['user_manage_all'],
      minimumLevel: 10,
      dataAccess: {
        level: 'factory',
        department: '生产部门'
      }
    }, {
      requireAll: false,
      checkLevel: true,
      cacheResult: true
    });
    
    if (result.hasAccess) {
      console.log('权限检查通过');
    } else {
      console.log('权限不足:', result.reason);
    }
  };
}
```

### usePermissions - 增强权限Hook

直接使用增强权限系统：

```tsx
import { usePermissions } from '../../hooks/usePermissions';

function AdvancedComponent() {
  const {
    checkPermissions,
    hasMinimumLevel,
    hasDepartmentAccess,
    hasDataAccess,
    clearCache,
    getCacheStats
  } = usePermissions();
  
  // 复杂权限检查
  const checkAccess = async () => {
    const result = await checkPermissions({
      roles: ['admin'],
      permissions: ['edit'],
      dataAccess: { level: 'factory' }
    });
    
    return result.hasAccess;
  };
}
```

## 权限缓存系统

### 缓存机制
- **自动缓存**: 权限检查结果默认缓存5分钟
- **智能失效**: 用户信息变化时自动清除相关缓存
- **性能优化**: 减少重复的权限计算开销

### 缓存管理
```tsx
const { 
  clearPermissionCache, 
  getPermissionCacheStats 
} = usePermission();

// 查看缓存统计
const stats = getPermissionCacheStats();
console.log('缓存条目数:', stats.totalEntries);
console.log('命中率:', stats.hitRate + '%');
console.log('平均年龄:', stats.averageAge + '秒');

// 清除所有缓存
clearPermissionCache();
```

## 错误处理

### 权限检查失败处理
```tsx
<EnhancedPermissionGuard
  roles={['admin']}
  errorComponent={
    <View style={styles.errorContainer}>
      <Text>权限检查失败，请稍后重试</Text>
      <Button title="重试" onPress={retryPermissionCheck} />
    </View>
  }
  onPermissionDenied={(reason) => {
    // 记录权限拒绝日志
    console.log('Permission denied:', reason);
    // 可以显示更友好的错误提示
    showErrorToast(reason);
  }}
>
  <ProtectedContent />
</EnhancedPermissionGuard>
```

### 网络错误重试
```tsx
<EnhancedPermissionGuard
  roles={['admin']}
  options={{ retryOnFailure: true }}
  onPermissionDenied={(reason) => {
    if (reason.includes('Network')) {
      // 网络错误，将自动重试
      console.log('Network error, will retry automatically');
    }
  }}
>
  <NetworkDependentContent />
</EnhancedPermissionGuard>
```

## 性能优化建议

### 1. 合理使用缓存
```tsx
// 对于频繁检查的权限，启用缓存
<EnhancedPermissionGuard
  roles={['admin']}
  options={{ cacheResult: true }}
>
  <FrequentlyCheckedContent />
</EnhancedPermissionGuard>
```

### 2. 避免过度嵌套
```tsx
// ❌ 不推荐：过度嵌套
<EnhancedPermissionGuard roles={['admin']}>
  <EnhancedPermissionGuard permissions={['edit']}>
    <EnhancedPermissionGuard modules={['user']}>
      <Content />
    </EnhancedPermissionGuard>
  </EnhancedPermissionGuard>
</EnhancedPermissionGuard>

// ✅ 推荐：组合权限检查
<EnhancedPermissionGuard
  roles={['admin']}
  permissions={['edit']}
  modules={['user']}
>
  <Content />
</EnhancedPermissionGuard>
```

### 3. 适当的权限粒度
```tsx
// ❌ 权限过细
<EnhancedPermissionGuard permissions={['user_view_name']}>
  <Text>{user.name}</Text>
</EnhancedPermissionGuard>

// ✅ 合适的权限粒度
<EnhancedPermissionGuard permissions={['user_view']}>
  <UserProfile user={user} />
</EnhancedPermissionGuard>
```

## 调试和测试

### 开发模式调试
```tsx
// 在开发环境中启用详细日志
<EnhancedPermissionGuard
  roles={['admin']}
  onPermissionGranted={() => {
    if (__DEV__) {
      console.log('✅ Permission granted for admin role');
    }
  }}
  onPermissionDenied={(reason) => {
    if (__DEV__) {
      console.log('❌ Permission denied:', reason);
    }
  }}
>
  <AdminContent />
</EnhancedPermissionGuard>
```

### 权限测试组件
参考 `components/examples/PermissionExamples.tsx` 了解完整的测试示例。

## 最佳实践

1. **明确权限边界**: 在组件设计时就明确需要哪些权限
2. **合理使用缓存**: 平衡性能和实时性
3. **友好的错误提示**: 告诉用户为什么没有权限以及如何获取
4. **权限最小化原则**: 只检查必要的权限
5. **测试覆盖**: 确保所有权限分支都有对应的测试

## 常见问题

**Q: 权限检查过程中出现闪烁怎么办？**
A: 使用 `loadingComponent` 提供平滑的加载体验。

**Q: 如何处理权限变更后的实时更新？**
A: 调用 `refreshPermissions()` 方法刷新权限，系统会自动清除相关缓存。

**Q: 缓存会不会导致权限更新不及时？**
A: 用户信息变化时会自动清除缓存，也可以手动调用 `clearPermissionCache()` 清除。

**Q: 如何优化权限检查的性能？**
A: 启用权限缓存、避免过度嵌套、使用合适的权限粒度。