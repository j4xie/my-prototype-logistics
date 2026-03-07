/**
 * 权限状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 权限矩阵 - 定义每个角色对每个模块的权限
type PermissionLevel = 'rw' | 'r' | 'w' | '-';

interface ModulePermissions {
  dashboard: PermissionLevel;
  production: PermissionLevel;
  warehouse: PermissionLevel;
  quality: PermissionLevel;
  procurement: PermissionLevel;
  sales: PermissionLevel;
  hr: PermissionLevel;
  equipment: PermissionLevel;
  finance: PermissionLevel;
  system: PermissionLevel;
  analytics: PermissionLevel;
  scheduling: PermissionLevel;
  restaurant: PermissionLevel;
}

const PERMISSION_MATRIX: Record<string, ModulePermissions> = {
  // Level 0 - 工厂总监 (最高权限，全模块读写)
  factory_super_admin: {
    dashboard: 'rw',
    production: 'rw',
    warehouse: 'rw',
    quality: 'rw',
    procurement: 'rw',
    sales: 'rw',
    hr: 'rw',
    equipment: 'rw',
    finance: 'rw',
    system: 'rw',
    analytics: 'rw',
    scheduling: 'rw',
    restaurant: 'rw'
  },

  // Level 10 - 职能部门经理
  hr_admin: {
    dashboard: 'r', production: '-', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: 'rw', equipment: '-',
    finance: '-', system: 'r', analytics: '-', scheduling: '-', restaurant: '-'
  },
  procurement_manager: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: '-',
    procurement: 'rw', sales: '-', hr: '-', equipment: '-',
    finance: 'r', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },
  sales_manager: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: '-',
    procurement: '-', sales: 'rw', hr: '-', equipment: '-',
    finance: 'r', system: '-', analytics: 'r', scheduling: '-', restaurant: '-'  // SmartBI 只读访问
  },
  // 调度 (dispatcher) - 生产调度、数据分析、趋势监控
  dispatcher: {
    dashboard: 'rw', production: 'rw', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: 'r', equipment: 'r',
    finance: 'r', system: 'r', analytics: 'rw', scheduling: 'rw', restaurant: 'r'
  },
  // production_manager (已废弃，保留向后兼容，映射到 dispatcher)
  production_manager: {
    dashboard: 'rw', production: 'rw', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: 'r', equipment: 'r',
    finance: 'r', system: 'r', analytics: 'rw', scheduling: 'rw', restaurant: 'r'
  },
  warehouse_manager: {
    dashboard: 'r', production: 'r', warehouse: 'rw', quality: '-',
    procurement: 'r', sales: 'r', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: 'r', restaurant: '-'
  },
  equipment_admin: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: 'rw',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },
  quality_manager: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: 'rw',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },
  finance_manager: {
    dashboard: 'r', production: '-', warehouse: '-', quality: '-',
    procurement: '-', sales: 'r', hr: '-', equipment: '-',
    finance: 'rw', system: '-', analytics: 'r', scheduling: '-', restaurant: '-'
  },

  // 餐饮管理
  restaurant_manager: {
    dashboard: 'r', production: '-', warehouse: '-', quality: '-',
    procurement: 'r', sales: '-', hr: '-', equipment: '-',
    finance: 'r', system: '-', analytics: 'r', scheduling: '-', restaurant: 'rw'
  },

  // Level 20 - 车间管理 (只看计划，执行在批次/报工模块)
  workshop_supervisor: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: 'w',
    procurement: '-', sales: '-', hr: 'r', equipment: 'r',
    finance: '-', system: '-', analytics: '-', scheduling: 'r', restaurant: '-'
  },

  // Level 30 - 一线员工
  quality_inspector: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: 'w',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },
  operator: {
    dashboard: 'r', production: 'w', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },
  warehouse_worker: {
    dashboard: 'r', production: '-', warehouse: 'w', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  },

  // Level 50 - 查看者
  viewer: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: '-', equipment: 'r',
    finance: '-', system: '-', analytics: 'r', scheduling: 'r', restaurant: 'r'
  },

  // 平台管理员
  platform_admin: {
    dashboard: 'rw', production: 'rw', warehouse: 'rw', quality: 'rw',
    procurement: 'rw', sales: 'rw', hr: 'rw', equipment: 'rw',
    finance: 'rw', system: 'rw', analytics: 'rw', scheduling: 'rw', restaurant: 'rw'
  },

  // 默认
  unactivated: {
    dashboard: '-', production: '-', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-', restaurant: '-'
  }
};

export type ModuleName = keyof ModulePermissions;

/**
 * 工厂类型权限覆盖
 * 当 factory_super_admin 登录不同类型工厂时，限制可见模块
 * 例: F002 是餐饮门店，不需要看生产管理、质量管理等工厂模块
 */
const FACTORY_PERMISSION_OVERRIDE: Record<string, ModulePermissions> = {
  // F002 - 餐饮门店: 只显示餐饮相关模块
  'F002': {
    dashboard: 'rw',
    production: '-',
    warehouse: '-',
    quality: '-',
    procurement: 'rw',
    sales: '-',
    hr: '-',
    equipment: '-',
    finance: 'rw',
    system: 'rw',
    analytics: 'rw',
    scheduling: '-',
    restaurant: 'rw'
  }
};

export const usePermissionStore = defineStore('permission', () => {
  // State
  const loadedRoutes = ref<string[]>([]);
  const currentRole = ref<string>('unactivated');
  const currentFactoryId = ref<string>('');

  // 设置当前角色和工厂ID
  function setRole(role: string, factoryId?: string) {
    currentRole.value = role || 'unactivated';
    currentFactoryId.value = factoryId || '';
  }

  // Getters
  const currentPermissions = computed((): ModulePermissions => {
    const rolePerms = PERMISSION_MATRIX[currentRole.value] || PERMISSION_MATRIX['unactivated'];
    // 工厂类型覆盖: 当特定工厂有覆盖配置时，使用覆盖权限
    const factoryOverride = currentFactoryId.value ? FACTORY_PERMISSION_OVERRIDE[currentFactoryId.value] : undefined;
    if (factoryOverride) return factoryOverride;
    return rolePerms;
  });

  // Actions
  function canAccess(module: ModuleName): boolean {
    const permission = currentPermissions.value[module];
    return permission !== '-';
  }

  function canWrite(module: ModuleName): boolean {
    const permission = currentPermissions.value[module];
    return permission === 'rw' || permission === 'w';
  }

  function hasFullAccess(module: ModuleName): boolean {
    const permission = currentPermissions.value[module];
    return permission === 'rw';
  }

  function getPermissionLevel(module: ModuleName): PermissionLevel {
    return currentPermissions.value[module];
  }

  function getAccessibleModules(): ModuleName[] {
    const modules: ModuleName[] = [
      'dashboard', 'production', 'warehouse', 'quality',
      'procurement', 'sales', 'hr', 'equipment', 'finance', 'system', 'analytics', 'scheduling', 'restaurant'
    ];
    return modules.filter(m => canAccess(m));
  }

  /**
   * 检查是否可以访问 SmartBI 模块
   * SmartBI 访问权限: 有 analytics/sales/finance 任一读权限即可
   */
  function canAccessSmartBI(): boolean {
    return canAccess('analytics') || canAccess('sales') || canAccess('finance');
  }

  /**
   * 检查是否有 SmartBI 写权限 (上传数据等)
   */
  function canWriteSmartBI(): boolean {
    return canWrite('analytics');
  }

  function addLoadedRoute(routeName: string) {
    if (!loadedRoutes.value.includes(routeName)) {
      loadedRoutes.value.push(routeName);
    }
  }

  function clearLoadedRoutes() {
    loadedRoutes.value = [];
  }

  return {
    loadedRoutes,
    currentRole,
    currentPermissions,
    setRole,
    canAccess,
    canWrite,
    hasFullAccess,
    getPermissionLevel,
    getAccessibleModules,
    canAccessSmartBI,
    canWriteSmartBI,
    addLoadedRoute,
    clearLoadedRoutes
  };
});

export { PERMISSION_MATRIX };
export type { ModulePermissions, PermissionLevel };
