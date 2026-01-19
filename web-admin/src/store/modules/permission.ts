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
}

const PERMISSION_MATRIX: Record<string, ModulePermissions> = {
  // Level 0 - 工厂总监 (监控+配置角色，与App端一致)
  factory_super_admin: {
    dashboard: 'rw',     // 首页仪表板 - 完全控制
    production: 'r',     // 生产监控 - 只读
    warehouse: 'r',      // 仓储监控 - 只读
    quality: 'r',        // 质量监控 - 只读
    procurement: 'r',    // 采购监控 - 只读
    sales: 'r',          // 销售监控 - 只读
    hr: 'rw',            // 人事管理 - 完全控制
    equipment: 'rw',     // 设备管理 - 完全控制
    finance: 'r',        // 财务报表 - 只读
    system: 'rw',        // 系统配置（含AI意图）- 完全控制
    analytics: 'rw',     // 数据分析（含AI报告）- 完全控制
    scheduling: 'r'      // 调度监控 - 只读
  },

  // Level 10 - 职能部门经理
  hr_admin: {
    dashboard: 'r', production: '-', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: 'rw', equipment: '-',
    finance: '-', system: 'r', analytics: '-', scheduling: '-'
  },
  procurement_manager: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: '-',
    procurement: 'rw', sales: '-', hr: '-', equipment: '-',
    finance: 'r', system: '-', analytics: '-', scheduling: '-'
  },
  sales_manager: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: '-',
    procurement: '-', sales: 'rw', hr: '-', equipment: '-',
    finance: 'r', system: '-', analytics: 'r', scheduling: '-'  // SmartBI 只读访问
  },
  // 调度 (dispatcher) - 生产调度、数据分析、趋势监控
  dispatcher: {
    dashboard: 'rw', production: 'rw', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: 'r', equipment: 'r',
    finance: 'r', system: 'r', analytics: 'rw', scheduling: 'rw'
  },
  // production_manager (已废弃，保留向后兼容，映射到 dispatcher)
  production_manager: {
    dashboard: 'rw', production: 'rw', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: 'r', equipment: 'r',
    finance: 'r', system: 'r', analytics: 'rw', scheduling: 'rw'
  },
  warehouse_manager: {
    dashboard: 'r', production: 'r', warehouse: 'rw', quality: '-',
    procurement: 'r', sales: 'r', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: 'r'
  },
  equipment_admin: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: 'rw',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  },
  quality_manager: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: 'rw',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  },
  finance_manager: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: '-',
    procurement: 'r', sales: 'r', hr: 'r', equipment: '-',
    finance: 'rw', system: '-', analytics: 'r', scheduling: 'r'
  },

  // Level 20 - 车间管理
  workshop_supervisor: {
    dashboard: 'r', production: 'rw', warehouse: 'r', quality: 'w',
    procurement: '-', sales: '-', hr: 'r', equipment: 'r',
    finance: '-', system: '-', analytics: '-', scheduling: 'r'
  },

  // Level 30 - 一线员工
  quality_inspector: {
    dashboard: 'r', production: 'r', warehouse: '-', quality: 'w',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  },
  operator: {
    dashboard: 'r', production: 'w', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  },
  warehouse_worker: {
    dashboard: 'r', production: '-', warehouse: 'w', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  },

  // Level 50 - 查看者
  viewer: {
    dashboard: 'r', production: 'r', warehouse: 'r', quality: 'r',
    procurement: 'r', sales: 'r', hr: '-', equipment: 'r',
    finance: '-', system: '-', analytics: 'r', scheduling: 'r'
  },

  // 平台管理员
  platform_admin: {
    dashboard: 'rw', production: 'rw', warehouse: 'rw', quality: 'rw',
    procurement: 'rw', sales: 'rw', hr: 'rw', equipment: 'rw',
    finance: 'rw', system: 'rw', analytics: 'rw', scheduling: 'rw'
  },

  // 默认
  unactivated: {
    dashboard: '-', production: '-', warehouse: '-', quality: '-',
    procurement: '-', sales: '-', hr: '-', equipment: '-',
    finance: '-', system: '-', analytics: '-', scheduling: '-'
  }
};

export type ModuleName = keyof ModulePermissions;

export const usePermissionStore = defineStore('permission', () => {
  // State
  const loadedRoutes = ref<string[]>([]);
  const currentRole = ref<string>('unactivated');

  // 设置当前角色
  function setRole(role: string) {
    currentRole.value = role || 'unactivated';
  }

  // Getters
  const currentPermissions = computed((): ModulePermissions => {
    return PERMISSION_MATRIX[currentRole.value] || PERMISSION_MATRIX['unactivated'];
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
      'procurement', 'sales', 'hr', 'equipment', 'finance', 'system', 'analytics', 'scheduling'
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
