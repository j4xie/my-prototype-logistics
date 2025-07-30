# 权限模型简化方案

## 当前问题分析

现有权限系统存在多层复杂性：
- `roleCode` + `roleLevel` + `permissions[]` + `department` 四重控制
- 权限检查逻辑分散在多个中间件中
- 角色定义不够清晰统一

## 简化方案

### 1. 统一权限模型设计

```typescript
// 简化后的用户权限模型
interface UserPermission {
  // 主要角色（决定核心权限）
  role: 'super_admin' | 'department_admin' | 'operator' | 'viewer';
  
  // 部门范围（限制数据访问范围）
  department: 'farming' | 'processing' | 'logistics' | 'quality' | 'management' | 'all';
  
  // 具体权限（自动根据role计算，无需存储）
  computed_permissions: string[];
}
```

### 2. 角色权限矩阵

| 角色 | 说明 | 权限范围 | 数据访问 |
|------|------|----------|----------|
| `super_admin` | 工厂超级管理员 | 全部功能 | 全厂数据 |
| `department_admin` | 部门主管 | 部门管理 + 基础功能 | 本部门数据 |
| `operator` | 操作员 | 数据录入 + 基础查询 | 本部门数据 |
| `viewer` | 查看者 | 仅查看权限 | 授权数据 |

### 3. 权限计算规则

```javascript
// 权限自动计算函数
function calculatePermissions(role, department) {
  const basePermissions = {
    super_admin: ['read', 'write', 'delete', 'manage_users', 'manage_factory', 'view_reports'],
    department_admin: ['read', 'write', 'manage_department', 'view_reports'],
    operator: ['read', 'write', 'create_records'],
    viewer: ['read']
  };
  
  return basePermissions[role] || ['read'];
}
```

### 4. 简化实现步骤

#### 步骤1：数据库结构调整
```sql
-- 移除复杂字段，保留核心字段
ALTER TABLE users 
DROP COLUMN roleLevel,
DROP COLUMN permissions,
MODIFY COLUMN roleCode ENUM('super_admin', 'department_admin', 'operator', 'viewer');
```

#### 步骤2：中间件简化
```javascript
// 统一权限检查中间件
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    const { user } = req;
    const userPermissions = calculatePermissions(user.roleCode, user.department);
    
    if (userPermissions.includes(requiredPermission) || userPermissions.includes('all')) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: '权限不足',
      required: requiredPermission,
      userRole: user.roleCode
    });
  };
};
```

#### 步骤3：路由权限配置
```javascript
// 清晰的路由权限配置
router.get('/users', requirePermission('read'), getUsers);
router.post('/users', requirePermission('write'), createUser);
router.delete('/users/:id', requirePermission('delete'), deleteUser);
router.get('/reports', requirePermission('view_reports'), getReports);
```

#### 步骤4：前端权限组件
```typescript
// 统一的权限检查组件
function PermissionGuard({ permission, children, fallback = null }) {
  const { user } = useAuth();
  const hasPermission = checkUserPermission(user, permission);
  
  return hasPermission ? children : fallback;
}

// 使用示例
<PermissionGuard permission="write">
  <CreateButton />
</PermissionGuard>
```

### 5. 迁移策略

#### 阶段1：向后兼容（1周）
- 保留现有字段，添加新的权限计算逻辑
- 双重验证确保功能正常

#### 阶段2：逐步替换（2周）
- 更新所有权限检查点
- 前端组件统一使用新权限系统

#### 阶段3：清理优化（1周）
- 移除旧字段和代码
- 数据库结构最终优化

### 6. 配置文件示例

```javascript
// config/permissions.js
export const ROLE_PERMISSIONS = {
  super_admin: {
    name: '超级管理员',
    permissions: ['read', 'write', 'delete', 'manage_users', 'manage_factory', 'view_reports'],
    departments: ['all']
  },
  department_admin: {
    name: '部门主管',
    permissions: ['read', 'write', 'manage_department', 'view_reports'],
    departments: ['farming', 'processing', 'logistics', 'quality', 'management']
  },
  operator: {
    name: '操作员',
    permissions: ['read', 'write', 'create_records'],
    departments: ['farming', 'processing', 'logistics', 'quality']
  },
  viewer: {
    name: '查看者',
    permissions: ['read'],
    departments: ['all']
  }
};

export const DEPARTMENT_ACCESS_RULES = {
  'all': ['*'], // 所有数据
  'farming': ['farming_*', 'shared_*'],
  'processing': ['processing_*', 'shared_*'],
  'logistics': ['logistics_*', 'shared_*'],
  'quality': ['quality_*', 'shared_*'],
  'management': ['management_*', 'reports_*', 'shared_*']
};
```

### 7. 优势对比

| 方面 | 简化前 | 简化后 |
|------|--------|--------|
| 字段数量 | 4个字段 | 2个字段 |
| 权限检查 | 复杂条件判断 | 统一函数计算 |
| 维护成本 | 高 | 低 |
| 理解难度 | 困难 | 简单 |
| 扩展性 | 差 | 好 |

### 8. 实施建议

1. **立即可做**：
   - 创建权限计算函数
   - 添加权限配置文件
   - 实现向后兼容验证

2. **分步实施**：
   - 先更新后端权限检查
   - 再更新前端权限组件
   - 最后清理数据库结构

3. **质量保证**：
   - 详细的权限测试用例
   - 数据迁移验证脚本
   - 回滚方案准备

这个简化方案可以将复杂的多层权限系统简化为清晰的二维模型（角色+部门），大大降低维护成本和理解难度。