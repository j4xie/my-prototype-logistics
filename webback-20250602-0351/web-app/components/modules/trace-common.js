/**
 * 食品溯源系统 - 通用JavaScript工具函数 (模块化版本)
 * Neo Minimal iOS-Style Admin UI
 * 版本: 1.0.0
 */

// 资源加载管理
const traceLoader = {
    // 缓存已加载的资源
    loadedResources: {},
    
    /**
     * 初始化资源加载器
     */
    init() {
        // 预加载常用图标
        this.preloadIcons(['home', 'record', 'user']);
        
        // 添加错误处理
        window.addEventListener('error', this.handleResourceError.bind(this), true);
        
        return this;
    },
    
    /**
     * 预加载图标资源
     * @param {Array} iconNames - 图标名称数组
     */
    preloadIcons(iconNames) {
        if (!window.traceRoutes || !window.traceRoutes.getIconPath) {
            // 如果traceRoutes未定义或缺少getIconPath方法，使用默认图标路径
            iconNames.forEach(name => {
                // 使用绝对路径，避免相对路径错误
                const iconPathBase = '/pages/assets/icons/';
                
                // 预加载灰色和蓝色图标
                const iconUrl = `${iconPathBase}${name}-gray.svg`;
                this.preloadImage(iconUrl);
                
                // 预加载蓝色图标
                const iconUrlActive = `${iconPathBase}${name}-blue.svg`;
                this.preloadImage(iconUrlActive);
            });
            return;
        }
        
        iconNames.forEach(name => {
            // 预加载灰色和蓝色图标
            [false, true].forEach(isActive => {
                const iconUrl = window.traceRoutes.getIconPath(name, isActive);
                this.preloadImage(iconUrl);
            });
        });
    },
    
    /**
     * 预加载图片
     * @param {string} url - 图片URL
     * @returns {Promise} - 加载完成的Promise
     */
    preloadImage(url) {
        if (this.loadedResources[url]) {
            return Promise.resolve(this.loadedResources[url]);
        }
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedResources[url] = img;
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`图片加载失败: ${url}`, err);
                reject(err);
            };
            img.src = url;
        });
    },
    
    /**
     * 处理资源加载错误
     * @param {Event} event - 错误事件
     */
    handleResourceError(event) {
        if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
            console.error(`资源加载失败: ${event.target.src || event.target.href}`);
            
            // 图标加载错误时使用备用图标
            if (event.target.tagName === 'IMG' && event.target.src.includes('/icons/')) {
                event.preventDefault();
                // 始终使用绝对路径确保能找到备用图标
                event.target.src = '/pages/assets/icons/default-icon.svg';
                // 使用灰色背景表示异常
                event.target.style.backgroundColor = '#f5f5f5';
                event.target.style.borderRadius = '4px';
                event.target.style.padding = '2px';
                
                // 防止循环触发错误
                event.target.onerror = null;
            }
        }
    }
};

// 用户与权限管理
const traceAuth = {
    // 用户信息缓存
    user: {
        id: '',
        name: '',
        role: '',
        permissions: [],
        isAuthenticated: false
    },
    
    /**
     * 检查用户是否已认证
     * @returns {boolean} 认证状态
     */
    isAuthenticated() {
        // 开发模式：始终返回true
        return true;
        
        // 正式代码（暂时注释）
        /*
        // 从localStorage获取认证状态
        const userStr = localStorage.getItem('trace_user');
        if (userStr) {
            try {
                const userData = JSON.parse(userStr);
                this.user = { ...userData, isAuthenticated: true };
                return true;
            } catch (e) {
                console.error('认证数据解析错误', e);
                this.logout();
                return false;
            }
        }
        return false;
        */
    },
    
    /**
     * 检查用户是否拥有指定权限
     * @param {string|Array} permission - 权限名称或权限数组
     * @returns {boolean} 是否有权限
     */
    hasPermission(permission) {
        // 开发模式：始终返回true
        return true;
        
        // 正式代码（暂时注释）
        /*
        if (!this.user.isAuthenticated) return false;
        
        if (Array.isArray(permission)) {
            return permission.some(p => this.user.permissions.includes(p));
        }
        
        return this.user.permissions.includes(permission);
        */
    },
    
    /**
     * 用户登录
     * @param {Object} userData - 用户数据对象
     */
    login(userData) {
        this.user = {
            ...userData,
            isAuthenticated: true
        };
        
        // 存储到localStorage
        localStorage.setItem('trace_user', JSON.stringify(this.user));
    },
    
    /**
     * 用户登出
     */
    logout() {
        this.user = {
            id: '',
            name: '',
            role: '',
            permissions: [],
            isAuthenticated: false
        };
        
        // 清除localStorage
        localStorage.removeItem('trace_user');
        
        // 跳转到登录页
        try {
            // 使用相对路径计算跳转
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            let loginPath;
            
            if (pathSegments.length <= 1 || !pathSegments.includes('pages')) {
                // 如果在根目录或浅层目录
                loginPath = './pages/auth/login.html';
            } else if (pathSegments.length === 2 && pathSegments[0] === 'pages') {
                // 如果在pages下的直接子目录
                loginPath = './auth/login.html';
            } else {
                // 如果在更深的目录
                const depth = pathSegments.length - pathSegments.indexOf('pages') - 1;
                loginPath = '../'.repeat(depth) + 'auth/login.html';
            }
            
            window.location.href = loginPath;
        } catch (error) {
            console.error('导航到登录页时出错', error);
            // 使用绝对路径作为最后手段
            window.location.href = '/pages/auth/login.html';
        }
    },
    
    /**
     * 检查权限或重定向
     * @param {string|Array} requiredPermission - 所需权限
     * @param {string} redirectUrl - 重定向URL（可选）
     * @returns {boolean} - 是否有权限
     */
    checkPermissionOrRedirect(requiredPermission, redirectUrl = null) {
        if (this.hasPermission(requiredPermission)) {
            return true;
        }
        
        // 重定向到指定URL或登录页
        if (!redirectUrl) {
            const isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
            redirectUrl = isRoot ? './pages/auth/login.html' : '../auth/login.html';
        }
        
        if (window.traceUI && window.traceUI.showToast) {
            window.traceUI.showToast('无权限访问此功能', 'error');
        }
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
        
        return false;
    }
};

// 确保trace-routes.js已加载
document.addEventListener('DOMContentLoaded', function() {
    if (!window.traceRoutes) {
        console.error('traceRoutes未定义，正在动态加载trace-routes.js');
        // 动态加载routes模块
        const script = document.createElement('script');
        
        // 检测当前脚本的路径
        const currentScript = document.currentScript;
        const currentPath = currentScript ? currentScript.src : '';
        
        // 根据当前URL路径计算相对路径
        let scriptPath = '';
        
        if (currentPath.includes('/components/')) {
            // 如果在components目录中
            scriptPath = './trace-routes.js';
        } else {
            // 否则假设在其他位置，使用绝对路径
            const pagePath = window.location.pathname;
            if (pagePath.includes('/pages/')) {
                // 在子页面中
                const depth = pagePath.split('/').filter(Boolean).length - 1;
                scriptPath = '../'.repeat(depth) + 'components/trace-routes.js';
            } else {
                // 在根目录
                scriptPath = './components/trace-routes.js';
            }
        }
        
        script.src = scriptPath;
        
        script.onerror = function() {
            console.error('无法加载trace-routes.js，尝试使用备用路径');
            // 尝试备用路径
            script.src = '/components/trace-routes.js';
        };
        
        document.head.appendChild(script);
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化资源加载器
    traceLoader.init();
});

// 导出模块
export const traceCommon = {
    traceLoader,
    traceAuth
};

export default traceCommon; 