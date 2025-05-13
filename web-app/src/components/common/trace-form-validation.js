/**
 * 食品溯源系统 - 表单验证脚本
 * 提供通用的表单验证功能
 */

// 验证表单字段
function validateField(field) {
    // 清除原有的错误提示
    clearFieldError(field);
    
    // 必填项验证
    if (field.hasAttribute('required') && !field.value.trim()) {
        showFieldError(field, '此字段不能为空');
        return false;
    }
    
    // 数值类型验证
    if (field.type === 'number') {
        // 数值范围验证
        if (field.hasAttribute('min') && Number(field.value) < Number(field.min)) {
            showFieldError(field, `不能小于${field.min}`);
            return false;
        }
        if (field.hasAttribute('max') && Number(field.value) > Number(field.max)) {
            showFieldError(field, `不能大于${field.max}`);
            return false;
        }
    }
    
    // 日期验证
    if (field.type === 'date' || field.type === 'datetime-local') {
        if (field.hasAttribute('min') && new Date(field.value) < new Date(field.min)) {
            showFieldError(field, `日期不能早于${formatDate(new Date(field.min))}`);
            return false;
        }
        if (field.hasAttribute('max') && new Date(field.value) > new Date(field.max)) {
            showFieldError(field, `日期不能晚于${formatDate(new Date(field.max))}`);
            return false;
        }
    }
    
    // 邮箱验证
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            showFieldError(field, '请输入有效的邮箱地址');
            return false;
        }
    }
    
    // 手机号验证
    if (field.dataset.type === 'phone' && field.value) {
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(field.value)) {
            showFieldError(field, '请输入有效的手机号码');
            return false;
        }
    }
    
    return true;
}

// 显示字段错误提示
function showFieldError(field, message) {
    // 添加错误样式
    field.classList.add('border-red-500');
    
    // 创建错误提示元素
    const errorElement = document.createElement('p');
    errorElement.className = 'text-red-500 text-xs mt-1 error-message';
    errorElement.innerText = message;
    
    // 插入到字段后面
    field.parentNode.appendChild(errorElement);
}

// 清除字段错误提示
function clearFieldError(field) {
    // 移除错误样式
    field.classList.remove('border-red-500');
    
    // 移除错误提示元素
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

// 验证整个表单
function validateForm(formElement) {
    const fields = formElement.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// 日期格式化
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// 表单状态保存
function saveFormState(formElement, stageId) {
    const formData = {};
    const fields = formElement.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
        if (field.name) {
            if (field.type === 'checkbox' || field.type === 'radio') {
                formData[field.name] = field.checked;
            } else {
                formData[field.name] = field.value;
            }
        }
    });
    
    localStorage.setItem(`trace_${stageId}_data`, JSON.stringify(formData));
}

// 表单状态恢复
function loadFormState(formElement, stageId) {
    const savedData = localStorage.getItem(`trace_${stageId}_data`);
    if (savedData) {
        const formData = JSON.parse(savedData);
        const fields = formElement.querySelectorAll('input, select, textarea');
        
        fields.forEach(field => {
            if (field.name && formData[field.name] !== undefined) {
                if (field.type === 'checkbox' || field.type === 'radio') {
                    field.checked = formData[field.name];
                } else {
                    field.value = formData[field.name];
                }
            }
        });
    }
}

// 为表单添加验证和状态保存功能
function initFormValidation(formElement, stageId) {
    if (!formElement) return;
    
    // 为所有输入字段添加blur事件监听
    const fields = formElement.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
        // 添加字段名称属性（如果没有）
        if (!field.hasAttribute('name')) {
            field.name = field.id || `field_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // 添加验证事件
        field.addEventListener('blur', () => {
            validateField(field);
        });
        
        // 添加状态保存事件
        field.addEventListener('change', () => {
            saveFormState(formElement, stageId);
        });
    });
    
    // 尝试加载保存的状态
    loadFormState(formElement, stageId);
}

// 导出功能
window.traceFormValidation = {
    validateField,
    validateForm,
    initFormValidation,
    saveFormState,
    loadFormState
}; 