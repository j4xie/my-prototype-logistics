/**
 * 统一权限配置
 * 定义所有角色和权限的映射关系
 */

// 平台管理员权限配置
export const PLATFORM_PERMISSIONS = {
  'platform_admin': {
    name: '平台管理员',
    description: '平台最高权限，可以管理所有工厂、用户和平台设置',
    permissions: [
      // 工厂管理
      'create_factory',
      'delete_factory',
      'manage_all_factories',
      'view_factories',
      'view_factory_details',
      'factory_activation_control',

      // 用户管理
      'manage_factory_users',
      'manage_all_users',
      'create_users',
      'delete_users',
      'activate_users',
      'view_users',

      // 平台管理
      'platform_settings',
      'system_monitoring',
      'platform_backup',
      'manage_platform_admins',

      // 数据分析
      'view_platform_analytics',
      'export_platform_data',
      'cross_factory_reports',

      // 系统功能
      'system_maintenance',
      'global_notifications',
      'audit_all_logs',

      // 白名单管理
      'manage_whitelist'
    ],
    dataAccess: 'all' // 所有数据
  }
};

// 工厂用户权限配置
export const FACTORY_PERMISSIONS = {
  'factory_super_admin': {
    name: '工厂超级管理员',
    description: '工厂内最高权限，可以管理工厂所有功能',
    permissions: [
      // 用户管理
      'manage_factory_users',
      'create_users',
      'delete_users',
      'activate_users',
      'assign_roles',
      
      // 工厂管理
      'factory_settings',
      'manage_all_departments',
      'factory_backup',
      'factory_configuration',
      
      // 数据管理
      'view_all_factory_data',
      'export_factory_data',
      'delete_factory_data',
      
      // 报表权限
      'view_factory_reports',
      'create_custom_reports',
      'schedule_reports',
      
      // 系统功能
      'manage_whitelist',
      'audit_factory_logs',
      'factory_notifications',
      
      // Phase 2 - 加工模块权限
      'processing_batch_create',
      'processing_batch_view_all',
      'processing_batch_edit',
      'processing_batch_delete',
      'quality_inspection_submit',
      'quality_inspection_approve',
      'quality_inspection_view_all',
      'equipment_monitoring_view',
      'equipment_data_export',
      'dashboard_view_factory',
      'alert_management_all'
    ],
    dataAccess: 'factory_all', // 工厂所有数据
    departmentAccess: 'all' // 所有部门
  },
  
  'permission_admin': {
    name: '权限管理员',
    description: '专职管理用户权限和白名单',
    permissions: [
      // 权限管理核心功能
      'activate_users',
      'assign_roles', 
      'manage_permissions',
      'audit_permissions',
      
      // 白名单管理
      'manage_whitelist',
      'add_whitelist_users',
      'remove_whitelist_users',
      'whitelist_bulk_operations',
      
      // 用户审核
      'review_user_applications',
      'approve_user_registrations',
      'reject_user_applications',
      
      // 报表权限
      'view_user_reports',
      'view_permission_reports',
      'export_user_data',
      
      // 审计功能
      'view_user_logs',
      'permission_change_logs'
    ],
    dataAccess: 'factory_users', // 工厂用户数据
    departmentAccess: 'all' // 跨部门权限管理
  },
  
  'department_admin': {
    name: '部门管理员',
    description: '管理特定部门的用户和数据',
    permissions: [
      // 部门用户管理
      'manage_department_users',
      'activate_department_users',
      'assign_department_roles',
      
      // 部门数据管理
      'department_data_management',
      'view_department_data',
      'edit_department_data',
      'export_department_data',
      
      // 部门报表
      'view_department_reports',
      'create_department_reports',
      
      // 部门设置
      'department_settings',
      'department_notifications',
      
      // Phase 2 - 部门级加工权限
      'processing_batch_create',
      'processing_batch_view_department',
      'processing_batch_edit',
      'quality_inspection_submit',
      'quality_inspection_approve',
      'equipment_monitoring_view',
      'dashboard_view_department',

      // 部门白名单管理
      'manage_department_whitelist',
      'add_department_whitelist_users',
      'remove_department_whitelist_users',
      'view_department_whitelist',
    ],
    dataAccess: 'department', // 本部门数据
    departmentAccess: 'own' // 仅本部门
  },
  
  'operator': {
    name: '操作员',
    description: '负责数据录入和基础查询',
    permissions: [
      // 基础操作
      'data_entry',
      'edit_own_records',
      'basic_query',
      
      // 查看权限
      'view_department_data',
      'view_own_records',
      
      // 基础功能
      'create_records',
      'update_records',
      'upload_files',
      
      // Phase 2 - 操作员级加工权限
      'processing_batch_create',
      'processing_batch_view_own',
      'quality_inspection_submit',
      'equipment_monitoring_view',
      'work_record_submit'
    ],
    dataAccess: 'department_limited', // 有限的部门数据
    departmentAccess: 'own' // 仅本部门
  },
  
  'viewer': {
    name: '查看者',
    description: '只能查看授权范围内的数据',
    permissions: [
      // 查看权限
      'read_authorized_data',
      'view_assigned_records',
      'basic_search',
      
      // 基础功能
      'export_authorized_data'
    ],
    dataAccess: 'limited', // 受限数据访问
    departmentAccess: 'authorized' // 授权范围
  }
};

// 部门定义
export const DEPARTMENTS = {
  'farming': {
    name: '养殖部门',
    description: '负责动物养殖、饲料管理等',
    dataTypes: ['livestock', 'feed', 'breeding_records', 'health_records']
  },
  'processing': {
    name: '加工部门', 
    description: '负责食品加工、生产管理等',
    dataTypes: ['production_batches', 'quality_tests', 'raw_materials', 'finished_products']
  },
  'logistics': {
    name: '物流部门',
    description: '负责运输、仓储、配送等',
    dataTypes: ['transport_orders', 'warehouses', 'inventory', 'delivery_records']
  },
  'quality': {
    name: '质检部门',
    description: '负责质量检测、合规管理等', 
    dataTypes: ['quality_inspections', 'compliance_records', 'test_results', 'certifications']
  },
  'management': {
    name: '管理部门',
    description: '负责综合管理、行政事务等',
    dataTypes: ['management_reports', 'administrative_records', 'policies', 'announcements']
  }
};

// 数据访问权限映射
export const DATA_ACCESS_RULES = {
  'all': {
    scope: 'platform',
    filter: {},
    description: '访问所有数据'
  },
  'readonly': {
    scope: 'platform',
    filter: {},
    operations: ['read'],
    description: '只读访问所有数据'
  },
  'factory_all': {
    scope: 'factory',
    filter: { factoryId: 'USER_FACTORY_ID' },
    description: '访问工厂所有数据'
  },
  'factory_users': {
    scope: 'factory',
    filter: { factoryId: 'USER_FACTORY_ID' },
    dataTypes: ['users', 'roles', 'permissions', 'whitelist'],
    description: '访问工厂用户相关数据'
  },
  'department': {
    scope: 'department',
    filter: { 
      factoryId: 'USER_FACTORY_ID',
      department: 'USER_DEPARTMENT'
    },
    description: '访问本部门所有数据'
  },
  'department_limited': {
    scope: 'department',
    filter: { 
      factoryId: 'USER_FACTORY_ID',
      department: 'USER_DEPARTMENT'
    },
    operations: ['read', 'create', 'update'],
    description: '访问本部门数据（不可删除）'
  },
  'limited': {
    scope: 'user',
    filter: {
      factoryId: 'USER_FACTORY_ID',
      $or: [
        { createdBy: 'USER_ID' },
        { assignedTo: 'USER_ID' },
        { department: 'USER_DEPARTMENT', visibility: 'public' }
      ]
    },
    operations: ['read'],
    description: '访问授权范围内的数据'
  }
};

// 权限计算工具函数
export function calculateUserPermissions(userType, role, department = null) {
  if (userType === 'platform_admin') {
    return PLATFORM_PERMISSIONS[role] || PLATFORM_PERMISSIONS['platform_admin'];
  }
  
  if (userType === 'factory_user') {
    return FACTORY_PERMISSIONS[role] || FACTORY_PERMISSIONS['viewer'];
  }
  
  return FACTORY_PERMISSIONS['viewer']; // 默认最低权限
}

// 检查用户是否有特定权限
export function hasPermission(userPermissions, requiredPermission) {
  return userPermissions.permissions.includes(requiredPermission);
}

// 获取用户数据访问规则
export function getUserDataAccess(userPermissions) {
  return DATA_ACCESS_RULES[userPermissions.dataAccess] || DATA_ACCESS_RULES['limited'];
}

// 检查部门访问权限
export function canAccessDepartment(user, targetDepartment) {
  const userPermissions = calculateUserPermissions(user.type, user.role, user.department);
  
  if (userPermissions.departmentAccess === 'all') {
    return true;
  }
  
  if (userPermissions.departmentAccess === 'own') {
    return user.department === targetDepartment;
  }
  
  // 'authorized' 需要额外的授权检查
  return false;
}

// 生成数据查询过滤器
export function generateDataFilter(user, baseFilter = {}) {
  const userPermissions = calculateUserPermissions(user.type, user.role, user.department);
  const accessRule = getUserDataAccess(userPermissions);
  
  let filter = { ...baseFilter };
  
  // 替换占位符
  if (accessRule.filter) {
    const filterTemplate = JSON.stringify(accessRule.filter);
    const resolvedFilter = filterTemplate
      .replace(/USER_FACTORY_ID/g, user.factoryId || '')
      .replace(/USER_DEPARTMENT/g, user.department || '')
      .replace(/USER_ID/g, user.id || '');
    
    const dynamicFilter = JSON.parse(resolvedFilter);
    filter = { ...filter, ...dynamicFilter };
  }
  
  return filter;
}

export default {
  PLATFORM_PERMISSIONS,
  FACTORY_PERMISSIONS,
  DEPARTMENTS,
  DATA_ACCESS_RULES,
  calculateUserPermissions,
  hasPermission,
  getUserDataAccess,
  canAccessDepartment,
  generateDataFilter
};