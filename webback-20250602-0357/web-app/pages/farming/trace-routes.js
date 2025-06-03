// 养殖管理路由
export const farmingRoutes = {
    home: '/pages/home/home-farming.html',
    createTrace: '/pages/farming/create-trace.html',
    vaccine: '/pages/farming/farming-vaccine.html',
    breeding: '/pages/farming/farming-breeding.html',
    monitor: '/pages/farming/farming-monitor.html'
};

export function navigate(route) {
    window.location.href = farmingRoutes[route];
} 