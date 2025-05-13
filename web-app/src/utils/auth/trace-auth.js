/**
 * trace-auth.js - 食品溯源系统认证模块
 * 版本: v1.0.0
 * 提供用户认证、权限管理和会话存储功能
 */

/**
 * traceAuth 对象 - 提供用户认证与权限管理功能
 */
const traceAuth = (function() {
    // 存储用户信息的本地存储键名
    const USER_STORAGE_KEY = 'trace_user';
    const TOKEN_STORAGE_KEY = 'trace_token';
    
    // 角色权限映射表
    const rolePermissions = {
        '系统管理员': [
            'admin',
            'admin.users',
            'admin.system',
            'farming.all',
            'farming.view',
            'processing.all',
            'processing.view',
            'logistics.all',
            'logistics.view',
            'trace.all',
            'trace.view'
        ],
        '养殖管理员': [
            'farming.all',
            'farming.view',
            'trace.view'
        ],
        '生产管理员': [
            'processing.all',
            'processing.view',
            'trace.view'
        ],
        '物流管理员': [
            'logistics.all',
            'logistics.view',
            'trace.view'
        ],
        '质检员': [
            'farming.view',
            'processing.view',
            'trace.view'
        ],
        '普通用户': [
            'trace.view'
        ]
    };
    
    /**
     * 获取当前登录用户
     * @returns {Object|null} 用户对象或 null（未登录）
     */
    function getCurrentUser() {
        try {
            const userJson = localStorage.getItem(USER_STORAGE_KEY);
            if (userJson) {
                return JSON.parse(userJson);
            }
        } catch (e) {
            console.error('获取用户信息失败:', e);
        }
        return null;
    }
    
    /**
     * 检查用户是否已登录
     * @returns {boolean} 是否已登录
     */
    function isAuthenticated() {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const user = getCurrentUser();
        return !!(token && user);
    }
    
    /**
     * 登录用户
     * @param {Object} userData 用户数据
     * @returns {boolean} 登录是否成功
     */
    function login(userData) {
        if (!userData || !userData.id) {
            console.error('登录失败: 无效的用户数据');
            return false;
        }
        
        try {
            // 生成模拟令牌 (实际项目中应由服务器提供)
            const token = generateToken(userData);
            
            // 保存用户数据和令牌
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            
            console.log('用户登录成功:', userData.name);
            return true;
        } catch (e) {
            console.error('登录失败:', e);
            return false;
        }
    }
    
    /**
     * 注销当前用户
     * @returns {boolean} 是否成功注销
     */
    function logout() {
        try {
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('注销失败:', e);
            return false;
        }
    }
    
    /**
     * 检查用户是否有指定权限
     * @param {string} permission 权限标识
     * @returns {boolean} 是否有权限
     */
    function hasPermission(permission) {
        if (!permission) return false;
        
        const user = getCurrentUser();
        if (!user) return false;
        
        // 如果用户有明确定义的权限列表，使用它
        if (Array.isArray(user.permissions)) {
            return user.permissions.includes(permission);
        }
        
        // 否则根据角色推断权限
        if (user.role && rolePermissions[user.role]) {
            return rolePermissions[user.role].includes(permission);
        }
        
        return false;
    }
    
    /**
     * 生成模拟认证令牌
     * @param {Object} user 用户数据
     * @returns {string} 认证令牌
     * @private
     */
    function generateToken(user) {
        // 实际项目中应使用JWT或其他安全机制
        // 这里仅生成一个模拟令牌用于演示
        const timestamp = new Date().getTime();
        const randomPart = Math.random().toString(36).substring(2);
        return `trace_${user.id}_${timestamp}_${randomPart}`;
    }
    
    /**
     * 更新当前用户信息
     * @param {Object} userData 要更新的用户数据
     * @returns {boolean} 是否更新成功
     */
    function updateUser(userData) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            console.error('更新用户失败: 用户未登录');
            return false;
        }
        
        try {
            // 合并现有用户数据和更新数据
            const updatedUser = { ...currentUser, ...userData };
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
            return true;
        } catch (e) {
            console.error('更新用户失败:', e);
            return false;
        }
    }
    
    /**
     * 检查用户会话是否过期
     * @returns {boolean} 会话是否有效
     */
    function isSessionValid() {
        // 实际项目中应检查令牌是否过期
        // 这里简单地检查令牌是否存在
        return !!localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    
    // 公开API
    return {
        isAuthenticated,
        getCurrentUser,
        login,
        logout,
        hasPermission,
        updateUser,
        isSessionValid
    };
})();

// 如果运行在Node.js环境中，则导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { traceAuth };
} 