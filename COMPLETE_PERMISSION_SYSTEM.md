# 完整权限系统设计

## 权限层级架构

### 1. 双层权限体系

```
平台层 (Platform Level)
├── 平台超级管理员 (platform_super_admin)
└── 平台操作员 (platform_operator)

工厂层 (Factory Level)  
├── 工厂超级管理员 (factory_super_admin)
├── 权限管理员 (permission_admin)
├── 部门管理员 (department_admin)
├── 操作员 (operator)
└── 查看者 (viewer)
```

### 2. 数据模型设计

```typescript
// 平台管理员表
interface PlatformAdmin {
  id: string;
  username: string;
  role: 'platform_super_admin' | 'platform_operator';
  permissions: string[]; // 动态计算
}

// 工厂用户表
interface FactoryUser {
  id: string;
  factoryId: string;
  username: string;
  role: 'factory_super_admin' | 'permission_admin' | 'department_admin' | 'operator' | 'viewer';
  department?: string; // 部门管理员及以下需要
  permissions: string[]; // 动态计算
}
```

### 3. 权限计算函数

```javascript
// 平台管理员权限计算
function calculatePlatformPermissions(role) {
  const permissions = {
    'platform_super_admin': [
      'create_factory',
      'manage_all_factories', 
      'delete_factory',
      'platform_settings',
      'view_platform_analytics',
      'manage_platform_admins',
      'system_monitoring'
    ],
    'platform_operator': [
      'view_factories',
      'view_factory_status',
      'basic_support',
      'view_platform_analytics'
    ]
  };
  return permissions[role] || [];
}

// 工厂用户权限计算  
function calculateFactoryPermissions(role, department) {
  const basePermissions = {
    'factory_super_admin': [
      'manage_factory_users',
      'factory_settings', 
      'manage_all_departments',
      'view_factory_reports',
      'manage_whitelist',
      'factory_backup'
    ],
    'permission_admin': [
      'activate_users',
      'assign_roles',
      'manage_permissions',
      'view_user_reports',
      'audit_permissions'
    ],
    'department_admin': [
      'manage_department_users',
      'department_data_management',
      'view_department_reports',
      'department_settings'
    ],
    'operator': [
      'data_entry',
      'basic_query',
      'view_own_records'
    ],
    'viewer': [
      'read_authorized_data'
    ]
  };

  const permissions = basePermissions[role] || [];
  
  // 为所有工厂用户添加基础权限
  const commonPermissions = ['read', 'login', 'profile_update'];
  
  return [...permissions, ...commonPermissions];
}
```

### 4. 具体功能权限矩阵

#### 平台级功能

| 功能 | platform_super_admin | platform_operator |
|------|----------------------|-------------------|
| 创建新工厂 | ✅ | ❌ |
| 删除工厂 | ✅ | ❌ |
| 查看所有工厂 | ✅ | ✅ |
| 工厂状态监控 | ✅ | ✅ |
| 平台系统设置 | ✅ | ❌ |
| 平台用户管理 | ✅ | ❌ |
| 平台数据分析 | ✅ | ✅(限制) |
| 技术支持 | ✅ | ✅ |

#### 工厂级功能

| 功能 | factory_super_admin | permission_admin | department_admin | operator | viewer |
|------|--------------------|--------------------|------------------|----------|--------|
| **用户管理** |
| 激活用户 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 分配角色 | ✅ | ✅ | ✅(本部门) | ❌ | ❌ |
| 删除用户 | ✅ | ❌ | ❌ | ❌ | ❌ |
| **数据管理** |
| 查看所有数据 | ✅ | ✅ | ✅(本部门) | ✅(本部门) | ✅(授权) |
| 修改数据 | ✅ | ❌ | ✅(本部门) | ✅(本部门) | ❌ |
| 删除数据 | ✅ | ❌ | ✅(本部门) | ❌ | ❌ |
| **系统功能** |
| 工厂设置 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 白名单管理 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 查看报表 | ✅ | ✅ | ✅(本部门) | ❌ | ❌ |
| 数据导出 | ✅ | ✅ | ✅(本部门) | ❌ | ❌ |

### 5. 权限检查中间件实现

```javascript
// 平台管理员权限检查
export const requirePlatformPermission = (permission) => {
  return async (req, res, next) => {
    const { admin } = req; // 来自平台认证中间件
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: '需要平台管理员权限'
      });
    }
    
    const permissions = calculatePlatformPermissions(admin.role);
    
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: '平台权限不足',
        required: permission,
        userRole: admin.role
      });
    }
    
    next();
  };
};

// 工厂用户权限检查  
export const requireFactoryPermission = (permission) => {
  return async (req, res, next) => {
    const { user } = req; // 来自工厂用户认证中间件
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '需要工厂用户权限'
      });
    }
    
    const permissions = calculateFactoryPermissions(user.role, user.department);
    
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: '工厂权限不足',
        required: permission,
        userRole: user.role,
        department: user.department
      });
    }
    
    next();
  };
};

// 数据访问范围检查
export const requireDataAccess = (dataType) => {
  return async (req, res, next) => {
    const { user, admin } = req;
    
    // 平台管理员可以访问所有数据
    if (admin && admin.role === 'platform_super_admin') {
      req.dataScope = 'all';
      return next();
    }
    
    // 工厂用户数据访问控制
    if (user) {
      switch (user.role) {
        case 'factory_super_admin':
          req.dataScope = { factoryId: user.factoryId };
          break;
        case 'permission_admin':
          req.dataScope = { factoryId: user.factoryId, type: 'user_data' };
          break;
        case 'department_admin':
        case 'operator':
        case 'viewer':
          req.dataScope = { 
            factoryId: user.factoryId, 
            department: user.department 
          };
          break;
        default:
          return res.status(403).json({
            success: false,
            message: '无数据访问权限'
          });
      }
      return next();
    }
    
    return res.status(401).json({
      success: false,
      message: '未认证用户'
    });
  };
};
```

### 6. 路由权限配置示例

```javascript
// 平台管理路由
router.post('/platform/factories', 
  authenticatePlatformAdmin,
  requirePlatformPermission('create_factory'),
  createFactory
);

router.get('/platform/factories',
  authenticatePlatformAdmin, 
  requirePlatformPermission('view_factories'),
  getFactories
);

// 工厂管理路由
router.post('/factory/users',
  authenticateUser,
  requireFactoryPermission('manage_factory_users'),
  createFactoryUser  
);

router.get('/factory/users',
  authenticateUser,
  requireFactoryPermission('view_user_reports'),
  requireDataAccess('user_data'),
  getFactoryUsers
);

// 部门数据路由
router.post('/department/records',
  authenticateUser,
  requireFactoryPermission('data_entry'),
  requireDataAccess('department_data'),
  createRecord
);
```

### 7. 前端权限组件

```typescript
// 平台管理员权限组件
function PlatformPermissionGuard({ permission, children, fallback = null }) {
  const { admin } = usePlatformAuth();
  const permissions = calculatePlatformPermissions(admin?.role);
  const hasPermission = permissions.includes(permission);
  
  return hasPermission ? children : fallback;
}

// 工厂用户权限组件  
function FactoryPermissionGuard({ permission, children, fallback = null }) {
  const { user } = useFactoryAuth();
  const permissions = calculateFactoryPermissions(user?.role, user?.department);
  const hasPermission = permissions.includes(permission);
  
  return hasPermission ? children : fallback;
}

// 使用示例
<PlatformPermissionGuard permission="create_factory">
  <CreateFactoryButton />
</PlatformPermissionGuard>

<FactoryPermissionGuard permission="manage_department_users">
  <DepartmentUserManagement />
</FactoryPermissionGuard>
```

### 8. 权限继承和优先级

```
权限优先级（从高到低）：
1. platform_super_admin - 平台最高权限，可以操作一切
2. platform_operator - 平台查看权限，支持操作
3. factory_super_admin - 工厂内最高权限
4. permission_admin - 工厂内用户权限管理
5. department_admin - 部门内最高权限  
6. operator - 部门内操作权限
7. viewer - 最低查看权限
```

### 9. 数据过滤实现

```javascript
// 根据用户权限自动过滤数据
async function getFilteredData(req, model, baseQuery = {}) {
  const { user, admin, dataScope } = req;
  
  let query = { ...baseQuery };
  
  // 平台管理员看所有数据
  if (admin && admin.role === 'platform_super_admin') {
    return await model.find(query);
  }
  
  // 工厂用户数据过滤
  if (user) {
    query.factoryId = user.factoryId;
    
    // 部门级权限进一步过滤
    if (['department_admin', 'operator', 'viewer'].includes(user.role)) {
      query.department = user.department;
    }
  }
  
  return await model.find(query);
}
```

### 10. 权限审计日志

```javascript
// 权限操作日志记录
function logPermissionAction(req, action, target, result) {
  const { user, admin } = req;
  const actor = admin || user;
  
  const logEntry = {
    timestamp: new Date(),
    actorType: admin ? 'platform_admin' : 'factory_user',
    actorId: actor.id,
    action,
    target,
    result,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  // 记录到审计日志表
  AuditLog.create(logEntry);
}
```

这个完整的权限系统设计实现了：
- 清晰的平台/工厂双层架构
- 细粒度的权限控制
- 自动的数据访问范围限制  
- 完整的权限审计
- 灵活的扩展能力