/**
 * 路由配置模块
 * 集中管理系统中所有页面路径，确保路径统一性
 * 使用绝对路径确保在任何层级的页面中都能正确导航
 */
const traceRoutes = {
    // 认证相关路由
    auth: {
        login: '/pages/auth/login.html',
        register: '/pages/auth/register.html',
        forgotPassword: '/pages/auth/forgot-password.html',
        resetPassword: '/pages/auth/reset-password.html'
    },
    
    // 首页相关路由
    home: {
        selector: '/pages/home/home-selector.html',
        farming: '/pages/home/home-farming.html',
        processing: '/pages/home/home-processing.html',
        logistics: '/pages/home/home-logistics.html',
        admin: '/pages/home/home-admin.html'
    },
    
    // 养殖模块相关路由
    farming: {
        breeding: '/pages/farming/farming-breeding.html',
        feeding: '/pages/farming/farming-feeding.html',
        health: '/pages/farming/farming-health.html',
        environment: '/pages/farming/farming-environment.html',
        statistics: '/pages/farming/farming-statistics.html'
    },
    
    // 加工模块相关路由
    processing: {
        slaughter: '/pages/processing/processing-slaughter.html',
        quality: '/pages/processing/processing-quality.html',
        environment: '/pages/processing/processing-environment.html',
        reports: '/pages/processing/processing-reports.html'
    },
    
    // 物流销售模块相关路由
    logistics: {
        create: '/pages/logistics/logistics-create.html',
        list: '/pages/logistics/logistics-list.html',
        detail: '/pages/logistics/logistics-detail.html',
        monitor: '/pages/logistics/vehicle-monitor.html',
        clients: '/pages/logistics/client-management.html'
    },
    
    // 溯源模块相关路由
    trace: {
        query: '/pages/trace/trace-query.html',
        list: '/pages/trace/trace-list.html',
        detail: '/pages/trace/trace-detail.html',
        map: '/pages/trace/trace-map.html',
        certificate: '/pages/trace/trace-certificate.html',
        edit: '/pages/trace/trace-edit.html'
    },
    
    // 用户中心相关路由
    profile: {
        index: '/pages/profile/profile.html',
        settings: '/pages/profile/settings.html',
        notifications: '/pages/profile/notifications.html',
        security: '/pages/profile/security.html',
        help: '/pages/profile/help.html'
    },
    
    // 管理员相关路由
    admin: {
        users: '/pages/admin/user-management.html',
        roles: '/pages/admin/role-management.html',
        permissions: '/pages/admin/permission-management.html',
        logs: '/pages/admin/system-logs.html',
        settings: '/pages/admin/system-settings.html'
    },
    
    /**
     * 获取相对路径
     * @param {string} currentPath - 当前页面路径
     * @param {string} targetPath - 目标页面路径
     * @returns {string} 从当前页面到目标页面的相对路径
     */
    getRelativePath: function(currentPath, targetPath) {
        // 简化版相对路径逻辑，实际应用中可能需要更复杂的计算
        const currentDepth = (currentPath.match(/\//g) || []).length;
        const prefix = '../'.repeat(Math.max(0, currentDepth - 1));
        
        // 去掉开头的 '/'
        const cleanTargetPath = targetPath.startsWith('/') 
            ? targetPath.substring(1) 
            : targetPath;
            
        return prefix + cleanTargetPath;
    },
    
    /**
     * 根据当前URL获取相对路径
     * @param {string} targetPath - 目标页面的绝对路径
     * @returns {string} 相对路径
     */
    getRelativeToCurrentPage: function(targetPath) {
        const currentPath = window.location.pathname;
        return this.getRelativePath(currentPath, targetPath);
    },
    
    /**
     * 获取图标路径
     * @param {string} name - 图标名称
     * @param {boolean} isActive - 是否激活状态
     * @returns {string} 图标路径
     */
    getIconPath: function(name, isActive = false) {
        const iconColor = isActive ? 'blue' : 'gray';
        return `/pages/assets/icons/${name}-${iconColor}.svg`;
    }
};

// 导出路由配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { traceRoutes };
} else {
    window.traceRoutes = traceRoutes;