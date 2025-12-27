/**
 * 路由守卫
 * 注意：不在顶层导入 store，避免在 pinia 初始化前访问
 */
import type { Router } from 'vue-router';
import type { ModuleName } from '@/store/modules/permission';

// 白名单路由 - 不需要登录
const whiteList = ['/login', '/403', '/404', '/mobile-only'];

// Mobile 专属角色 - 不允许登录 Web 端
// 参考原型文档: docs/prd/prototype/index.html - 14角色权限矩阵
const MOBILE_ONLY_ROLES = [
  'operator',
  'quality_inspector',
  'warehouse_worker'
];

export function setupRouterGuards(router: Router) {
  // 前置守卫
  router.beforeEach(async (to, _from, next) => {
    // 设置页面标题
    document.title = to.meta.title ? `${to.meta.title} - 白垩纪管理系统` : '白垩纪管理系统';

    // 白名单路由直接放行
    if (whiteList.includes(to.path)) {
      next();
      return;
    }

    // 动态导入 store，确保 pinia 已初始化
    const { useAuthStore } = await import('@/store/modules/auth');
    const { usePermissionStore } = await import('@/store/modules/permission');

    // 检查是否登录
    const authStore = useAuthStore();

    if (!authStore.isAuthenticated) {
      // 未登录，跳转登录页（避免重复跳转）
      if (to.path !== '/login') {
        next({ path: '/login', query: { redirect: to.fullPath } });
      } else {
        next();
      }
      return;
    }

    // 同步角色到权限 store
    const permissionStore = usePermissionStore();
    permissionStore.setRole(authStore.currentRole);

    // 检查是否是 Mobile 专属角色 (一线员工: 操作员、质检员、仓库工人)
    // 这些角色只能使用移动端 App，不能登录 Web 管理后台
    if (MOBILE_ONLY_ROLES.includes(authStore.currentRole)) {
      // 清除登录状态
      authStore.clearAuth();
      // 跳转到 Mobile 专属提示页面
      next({ path: '/mobile-only', query: { role: authStore.currentRole } });
      return;
    }

    // 检查模块权限
    const module = to.meta.module as ModuleName | undefined;
    if (module) {
      if (!permissionStore.canAccess(module)) {
        next('/403');
        return;
      }
    }

    next();
  });
}
