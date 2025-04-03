/**
 * 食品溯源系统 - 用户认证和权限管理模块
 * 版本: 1.0.0
 */

// 用户与权限管理
export const traceAuth = {
  // 用户信息缓存
  user: {},
  
  // 登录状态
  isLoggedIn: false,
  
  /**
   * 初始化认证模块
   * @returns {Object} 认证模块实例
   */
  init() {
    // 从localStorage恢复认证状态
    const userStr = localStorage.getItem('trace_user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        this.user = userData;
        this.isLoggedIn = true;
      } catch (e) {
        console.error('认证数据解析错误', e);
        this.logout();
      }
    }
    
    console.log('认证模块已初始化');
    return this;
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
    return this.isLoggedIn;
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
    if (!this.isLoggedIn) return false;
    
    // 管理员拥有所有权限
    if (this.user.role === 'admin') return true;
    
    // 检查具体权限
    if (Array.isArray(permission)) {
      return permission.some(p => this.user.permissions && this.user.permissions.includes(p));
    }
    
    return this.user.permissions && this.user.permissions.includes(permission);
    */
  },
  
  /**
   * 用户登录
   * @param {Object} userData - 用户数据对象
   */
  login(userData) {
    this.user = userData;
    this.isLoggedIn = true;
    
    // 存储到localStorage
    localStorage.setItem('trace_user', JSON.stringify(userData));
  },
  
  /**
   * 用户登出
   */
  logout() {
    this.user = {};
    this.isLoggedIn = false;
    
    // 清除localStorage
    localStorage.removeItem('trace_user');
    
    // 注释掉跳转，避免在测试环境中出错
    /*
    // 跳转到登录页
    if (window.traceRoutes && window.traceRoutes.auth.login) {
      window.location.href = window.traceRoutes.auth.login;
    } else {
      window.location.href = '/pages/auth/login.html';
    }
    */
  },
  
  /**
   * 获取用户角色信息
   * @returns {string} 用户角色
   */
  getUserRole() {
    return this.user.role || 'guest';
  },
  
  /**
   * 验证登录表单
   * @param {Object} formData - 表单数据
   * @returns {Object} 验证结果
   */
  validateLoginForm(formData) {
    const errors = {};
    
    if (!formData.username || formData.username.trim() === '') {
      errors.username = '用户名不能为空';
    }
    
    if (!formData.password || formData.password === '') {
      errors.password = '密码不能为空';
    } else if (formData.password.length < 6) {
      errors.password = '密码长度不能少于6位';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

// 为了向后兼容，导出到全局对象
if (typeof window !== 'undefined') {
  window.traceAuth = traceAuth;
} 