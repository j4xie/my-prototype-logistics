/**
 * 食品溯源系统 - 通用JavaScript工具函数
 * Neo Minimal iOS-Style Admin UI
 * 版本: 1.0.0
 */

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
        
        this.showToast('无权限访问此功能', 'error');
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
        
        return false;
    }
};

// 通用UI工具函数
const traceUI = {
    /**
     * 显示加载中状态
     * @param {Element} element - 要显示加载状态的元素
     * @param {string} text - 加载文本
     * @param {string} originalContent - 原始内容（可选）
     */
    showLoading(element, text = '加载中...', originalContent = null) {
        if (!element) return;
        
        // 保存原始内容
        if (originalContent === null) {
            element.dataset.originalContent = element.innerHTML;
        } else {
            element.dataset.originalContent = originalContent;
        }
        
        // 显示加载状态
        element.innerHTML = `
            <div class="inline-flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>${text}</span>
            </div>
        `;
        
        // 禁用元素
        if (element.tagName === 'BUTTON') {
            element.disabled = true;
        }
    },
    
    /**
     * 隐藏加载状态，恢复原始内容
     * @param {Element} element - 显示加载状态的元素
     */
    hideLoading(element) {
        if (!element || !element.dataset.originalContent) return;
        
        // 恢复原始内容
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        
        // 启用元素
        if (element.tagName === 'BUTTON') {
            element.disabled = false;
        }
    },
    
    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型：info, success, warn, error
     * @param {number} duration - 显示时长（毫秒）
     */
    showToast(message, type = 'info', duration = 3000) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'trace-toast';
        
        // 图标映射
        const icons = {
            info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
            success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
            warn: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'
        };
        
        // 颜色映射
        const colors = {
            info: 'bg-blue-50 text-blue-800',
            success: 'bg-green-50 text-green-800',
            warn: 'bg-yellow-50 text-yellow-800',
            error: 'bg-red-50 text-red-800'
        };
        
        const icon = icons[type] || icons.info;
        const color = colors[type] || colors.info;
        
        // 设置内容
        toast.innerHTML = `
            <div class="flex items-center ${color} px-4 py-3 rounded shadow-lg">
                <div class="mr-3">
                    ${icon}
                </div>
                <div>${message}</div>
            </div>
        `;
        
        // 样式
        const style = document.createElement('style');
        style.textContent = `
            .trace-toast {
            position: fixed;
                bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
                animation: fadeInUp 0.3s ease forwards;
            }
            @keyframes fadeInUp {
                from {
            opacity: 0;
                    transform: translate(-50%, 20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, duration);
    },
    
    /**
     * 显示确认对话框
     * @param {string} message - 提示消息
     * @param {Function} confirmCallback - 确认回调
     * @param {Function} cancelCallback - 取消回调（可选）
     * @param {string} confirmText - 确认按钮文本
     * @param {string} cancelText - 取消按钮文本
     */
    showConfirm(message, confirmCallback, cancelCallback = null, confirmText = '确认', cancelText = '取消') {
        // 创建背景遮罩
        const overlay = document.createElement('div');
        overlay.className = 'trace-modal-overlay';
        
        // 创建对话框
        const modal = document.createElement('div');
        modal.className = 'trace-modal';
        
        // 设置内容
        modal.innerHTML = `
            <div class="trace-modal-content">
                <div class="trace-modal-body">
                    <p>${message}</p>
                </div>
                <div class="trace-modal-footer">
                    <button class="trace-modal-button cancel-button">${cancelText}</button>
                    <button class="trace-modal-button confirm-button">${confirmText}</button>
                </div>
            </div>
        `;
        
        // 样式
        const style = document.createElement('style');
        style.textContent = `
            .trace-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
                animation: fadeIn 0.2s ease forwards;
            }
            .trace-modal {
            background-color: white;
            border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 320px;
                overflow: hidden;
                animation: zoomIn 0.2s ease forwards;
            }
            .trace-modal-content {
                padding: 16px;
            }
            .trace-modal-body {
                margin-bottom: 16px;
            }
            .trace-modal-body p {
                margin: 0;
                text-align: center;
                color: #333;
            }
            .trace-modal-footer {
                display: flex;
                border-top: 1px solid #eee;
                margin: 0 -16px -16px;
            }
            .trace-modal-button {
                flex: 1;
                padding: 12px;
                border: none;
                background: none;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .trace-modal-button:first-child {
                border-right: 1px solid #eee;
            }
            .cancel-button {
                color: #666;
            }
            .confirm-button {
                color: #1890FF;
                font-weight: 500;
            }
            .cancel-button:hover {
                background-color: #f5f5f5;
            }
            .confirm-button:hover {
                background-color: #f0f7ff;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes zoomIn {
                from { transform: scale(0.9); }
                to { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到页面
        document.body.appendChild(overlay);
        overlay.appendChild(modal);
        
        // 关闭对话框
        function closeModal() {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';
            
        setTimeout(() => {
                document.body.removeChild(overlay);
            }, 200);
        }
        
        // 绑定事件
        const cancelButton = modal.querySelector('.cancel-button');
        const confirmButton = modal.querySelector('.confirm-button');
        
        cancelButton.addEventListener('click', () => {
            closeModal();
            if (cancelCallback) cancelCallback();
        });
        
        confirmButton.addEventListener('click', () => {
            closeModal();
            if (confirmCallback) confirmCallback();
        });
    }
};

// 将traceAuth和traceUI绑定到window对象
window.traceAuth = traceAuth;
window.traceUI = traceUI;
window.traceLoader = traceLoader;
window.traceCommon = { ...traceAuth, ...traceUI, ...traceLoader }; // 兼容性

// 文档加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化工具
    traceLoader.init();
}); 