/**
 * 食品溯源系统 - 通用JavaScript工具函数
 * 此文件为向后兼容文件，重定向到模块化版本
 * 版本: 1.0.0
 */

// 导入模块化版本
import { traceCommon as modulesTraceCommon } from '../modules/trace-common.js';

// 为了向后兼容，使用相同的变量名
const traceLoader = modulesTraceCommon.traceLoader;
const traceAuth = modulesTraceCommon.traceAuth;

// 暴露给全局对象
window.traceLoader = traceLoader;
window.traceAuth = traceAuth;

// 输出重定向信息
console.log('通用工具(utils/trace-common.js)已重定向到模块化版本');

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
window.traceUI = traceUI;

// 文档加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化工具
    traceLoader.init();
}); 