/**
 * 食品溯源系统 - 通用JavaScript工具函数
 * Neo Minimal iOS-Style Admin UI
 * 版本: 1.0.0
 */

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
        window.location.href = 'login.html';
    },
    
    /**
     * 检查权限并重定向无权限用户
     * @param {string|Array} requiredPermission - 要求的权限
     * @param {string} redirectUrl - 重定向URL，默认为登录页
     * @returns {boolean} 权限检查结果
     */
    checkPermissionOrRedirect(requiredPermission, redirectUrl = 'login.html') {
        // 开发模式：始终返回true
        return true;
        
        // 正式代码（暂时注释）
        /*
        if (!this.isAuthenticated()) {
            window.location.href = redirectUrl;
            return false;
        }
        
        if (!this.hasPermission(requiredPermission)) {
            // 可以重定向到无权限页面
            window.location.href = 'home-selector.html?error=无权限访问此页面';
            return false;
        }
        
        return true;
        */
    }
};

// UI工具函数
const traceUI = {
    /**
     * 显示加载中状态
     * @param {HTMLElement} element - 要显示加载的元素
     * @param {string} text - 加载文本
     * @param {string} originalContent - 原始内容，用于恢复
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
        element.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${text}`;
        
        if (element.tagName === 'BUTTON') {
            element.disabled = true;
        }
    },
    
    /**
     * 隐藏加载状态
     * @param {HTMLElement} element - 要隐藏加载的元素
     */
    hideLoading(element) {
        if (!element) return;
        
        // 恢复原始内容
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
        
        if (element.tagName === 'BUTTON') {
            element.disabled = false;
        }
    },
    
    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型：'success', 'error', 'warning', 'info'
     * @param {number} duration - 持续时间(毫秒)
     */
    showToast(message, type = 'info', duration = 3000) {
        // 移除现有的toast
        const existingToast = document.querySelector('.trace-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `trace-toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 16px;
            background-color: rgba(0, 0, 0, 0.75);
            color: white;
            border-radius: 4px;
            font-size: 14px;
            z-index: 9999;
            max-width: 80%;
            text-align: center;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        // 设置图标
        let icon = 'info-circle';
        switch (type) {
            case 'success': icon = 'check-circle'; break;
            case 'error': icon = 'times-circle'; break;
            case 'warning': icon = 'exclamation-triangle'; break;
        }
        
        toast.innerHTML = `<i class="fas fa-${icon} mr-2"></i> ${message}`;
        
        // 添加到文档
        document.body.appendChild(toast);
        
        // 显示toast
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);
        
        // 设置自动消失
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    },
    
    /**
     * 显示确认对话框
     * @param {string} message - 确认消息
     * @param {Function} confirmCallback - 确认回调
     * @param {Function} cancelCallback - 取消回调
     * @param {string} confirmText - 确认按钮文本
     * @param {string} cancelText - 取消按钮文本
     */
    showConfirm(message, confirmCallback, cancelCallback = null, confirmText = '确认', cancelText = '取消') {
        // 移除现有的对话框
        const existingModal = document.querySelector('.trace-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 创建模态框容器
        const modal = document.createElement('div');
        modal.className = 'trace-modal';
        modal.style.cssText = `
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
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        // 创建模态框内容
        const modalContent = document.createElement('div');
        modalContent.className = 'trace-modal-content';
        modalContent.style.cssText = `
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 80%;
            width: 300px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            transform: translateY(20px);
            transition: transform 0.3s;
        `;
        
        // 设置内容
        modalContent.innerHTML = `
            <div class="trace-modal-body" style="margin-bottom: 16px;">
                ${message}
            </div>
            <div class="trace-modal-footer" style="display: flex; justify-content: flex-end;">
                <button id="modal-cancel" class="btn" style="margin-right: 8px; padding: 8px 16px;">${cancelText}</button>
                <button id="modal-confirm" class="btn btn-primary" style="padding: 8px 16px;">${confirmText}</button>
            </div>
        `;
        
        // 添加到文档
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.style.opacity = '1';
            modalContent.style.transform = 'translateY(0)';
        }, 10);
        
        // 绑定事件
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        
        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (confirmCallback) confirmCallback();
        });
        
        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (cancelCallback) cancelCallback();
        });
        
        // 关闭模态框函数
        function closeModal() {
            modal.style.opacity = '0';
            modalContent.style.transform = 'translateY(20px)';
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    },
    
    /**
     * 在列表中插入新项
     * @param {HTMLElement} container - 容器元素
     * @param {string} html - 要插入的HTML
     * @param {string} position - 插入位置：'prepend' 或 'append'
     */
    insertListItem(container, html, position = 'prepend') {
        if (!container) return;
        
        // 创建临时元素
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newItem = temp.firstElementChild;
        
        // 应用动画类
        newItem.style.opacity = '0';
        newItem.style.transform = 'translateY(10px)';
        newItem.style.transition = 'opacity 0.3s, transform 0.3s';
        
        // 插入元素
        if (position === 'prepend') {
            container.prepend(newItem);
        } else {
            container.appendChild(newItem);
        }
        
        // 触发动画
        setTimeout(() => {
            newItem.style.opacity = '1';
            newItem.style.transform = 'translateY(0)';
        }, 10);
    }
};

// 数据处理工具
const traceData = {
    /**
     * 格式化日期
     * @param {Date|string} date - 日期对象或日期字符串
     * @param {string} format - 格式，默认为 'YYYY-MM-DD'
     * @returns {string} 格式化后的日期
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = typeof date === 'string' ? new Date(date) : date;
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },
    
    /**
     * 格式化数值
     * @param {number} value - 数值
     * @param {number} digits - 小数位数
     * @returns {string} 格式化后的数值
     */
    formatNumber(value, digits = 2) {
        if (isNaN(value)) return '0';
        return parseFloat(value).toFixed(digits);
    },
    
    /**
     * 格式化货币
     * @param {number} value - 金额
     * @param {string} currency - 货币符号
     * @returns {string} 格式化后的货币
     */
    formatCurrency(value, currency = '¥') {
        if (isNaN(value)) return `${currency}0.00`;
        return `${currency}${parseFloat(value).toFixed(2)}`;
    },
    
    /**
     * 深拷贝对象
     * @param {Object} obj - 要拷贝的对象
     * @returns {Object} 拷贝后的对象
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // 处理日期
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        // 处理数组
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        // 处理对象
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = this.deepClone(obj[key]);
            }
        }
        
        return result;
    },
    
    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
};

// 网络请求工具
const traceAPI = {
    /**
     * 发送GET请求
     * @param {string} url - 请求地址
     * @param {Object} params - 请求参数
     * @returns {Promise} 请求Promise
     */
    async get(url, params = {}) {
        try {
            // 构建查询字符串
            const queryParams = new URLSearchParams();
            for (const key in params) {
                if (params[key] !== undefined && params[key] !== null) {
                    queryParams.append(key, params[key]);
                }
            }
            
            const queryString = queryParams.toString();
            const fullUrl = queryString ? `${url}?${queryString}` : url;
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('GET请求错误:', error);
            throw error;
        }
    },
    
    /**
     * 发送POST请求
     * @param {string} url - 请求地址
     * @param {Object} data - 请求数据
     * @returns {Promise} 请求Promise
     */
    async post(url, data = {}) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('POST请求错误:', error);
            throw error;
        }
    },
    
    /**
     * 发送PUT请求
     * @param {string} url - 请求地址
     * @param {Object} data - 请求数据
     * @returns {Promise} 请求Promise
     */
    async put(url, data = {}) {
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('PUT请求错误:', error);
            throw error;
        }
    },
    
    /**
     * 发送DELETE请求
     * @param {string} url - 请求地址
     * @returns {Promise} 请求Promise
     */
    async delete(url) {
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('DELETE请求错误:', error);
            throw error;
        }
    },
    
    /**
     * 上传文件
     * @param {string} url - 请求地址
     * @param {FormData} formData - 表单数据
     * @returns {Promise} 请求Promise
     */
    async uploadFile(url, formData) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`上传失败: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('文件上传错误:', error);
            throw error;
        }
    }
};

// 导出模块
window.traceAuth = traceAuth;
window.traceUI = traceUI;
window.traceData = traceData;
window.traceAPI = traceAPI; 