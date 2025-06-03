// 主页路由
export const homeRoutes = {
    selector: '/pages/home/home-selector.html',
    farming: '/pages/home/home-farming.html',
    processing: '/pages/home/home-processing.html',
    logistics: '/pages/home/home-logistics.html'
};

export function navigate(route) {
    window.location.href = homeRoutes[route];
} 