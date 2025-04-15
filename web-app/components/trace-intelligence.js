/**
 * 食品溯源系统 - 表单智能联动与智能化功能
 */

// 智能联动功能
const TraceSmartLink = (function() {
    // 数据关联规则
    const linkRules = {
        // 养殖场信息关联
        'farm-name': {
            target: ['farm-address', 'farm-license'],
            source: 'farmDatabase'
        },
        // 养殖周期智能关联
        'cycle-start': {
            target: ['cycle-end'],
            handler: function(value, targets) {
                if (value) {
                    // 例如：创建一个默认90天的周期
                    const startDate = new Date(value);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 90);
                    
                    // 设置结束日期最小值为开始日期
                    const endInput = document.getElementById(targets[0]);
                    if (endInput) {
                        endInput.min = value;
                        // 如果结束日期早于开始日期或未设置，则设置为默认值
                        if (!endInput.value || new Date(endInput.value) < startDate) {
                            endInput.value = endDate.toISOString().split('T')[0];
                        }
                    }
                }
            }
        },
        // 产品选择关联
        'product-type': {
            target: ['product-name', 'shelf-life', 'product-grade'],
            source: 'productDatabase'
        },
        // 批次号智能生成
        'production-date': {
            target: ['batch-number'],
            handler: function(value, targets) {
                if (value) {
                    // 基于日期生成批次号
                    const date = new Date(value);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    
                    // 获取产品类型代码（如果存在）
                    let productCode = 'P';
                    const productTypeSelect = document.getElementById('product-type');
                    if (productTypeSelect && productTypeSelect.value) {
                        productCode = productTypeSelect.value.substring(0, 1).toUpperCase();
                    }
                    
                    // 生成随机序列号
                    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                    
                    // 组合批次号
                    const batchNumber = `${productCode}${year}${month}${day}-${random}`;
                    
                    // 填充目标字段
                    const batchInput = document.getElementById(targets[0]);
                    if (batchInput && !batchInput.value) {
                        batchInput.value = batchNumber;
                    }
                }
            }
        }
    };
    
    // 模拟数据库
    const mockDatabases = {
        // 养殖场数据库
        farmDatabase: {
            '黑猪养殖场': { 
                address: '四川省成都市郫都区古城镇',
                license: 'FARM-SC-202301-0045'
            },
            '绿牧农场': { 
                address: '山东省潍坊市安丘市景芝镇',
                license: 'FARM-SD-202209-0128' 
            },
            '阳光牧业': { 
                address: '河南省南阳市方城县独树镇',
                license: 'FARM-HN-202104-0089' 
            }
        },
        // 产品数据库
        productDatabase: {
            'pork': {
                'product-name': '黑猪肉',
                'shelf-life': 14,
                'product-grade': 'premium'
            },
            'beef': {
                'product-name': '安格斯牛肉',
                'shelf-life': 21,
                'product-grade': 'premium'
            },
            'chicken': {
                'product-name': '土鸡',
                'shelf-life': 7,
                'product-grade': 'first'
            }
        }
    };
    
    // 处理数据关联
    function handleDataLink(sourceField, value) {
        const rule = linkRules[sourceField];
        if (!rule) return;
        
        // 处理基于数据库的关联
        if (rule.source && mockDatabases[rule.source]) {
            const database = mockDatabases[rule.source];
            if (database[value]) {
                const data = database[value];
                rule.target.forEach(targetField => {
                    const targetInput = document.getElementById(targetField);
                    if (targetInput && data[targetField] !== undefined) {
                        targetInput.value = data[targetField];
                        // 触发change事件
                        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        }
        
        // 处理自定义处理函数
        if (rule.handler && typeof rule.handler === 'function') {
            rule.handler(value, rule.target);
        }
    }
    
    // 设置字段关联
    function setupFieldLinks(formElement) {
        if (!formElement) return;
        
        // 为所有源字段添加事件监听
        Object.keys(linkRules).forEach(sourceField => {
            const sourceInput = document.getElementById(sourceField);
            if (sourceInput) {
                sourceInput.addEventListener('change', function() {
                    handleDataLink(sourceField, this.value);
                });
                
                // 如果已有值，立即触发
                if (sourceInput.value) {
                    handleDataLink(sourceField, sourceInput.value);
                }
            }
        });
    }
    
    return {
        init: function(formElement) {
            setupFieldLinks(formElement);
        },
        // 用于测试或演示目的
        getLinkRules: function() {
            return linkRules;
        },
        getMockDatabases: function() {
            return mockDatabases;
        }
    };
})();

// 表单智能提示系统
const TraceSmartSuggestion = (function() {
    // 提示规则
    const suggestionRules = [
        {
            // 批次号格式提示
            field: 'batch-number',
            condition: function(value) {
                return value && !/^[A-Z][0-9]{8}-[0-9]{3}$/.test(value);
            },
            message: '批次号格式不符合规范。建议使用格式：字母+8位日期+"-"+3位序号，例如P20230601-001'
        },
        {
            // 养殖周期长度提示
            fields: ['cycle-start', 'cycle-end'],
            condition: function(fields) {
                const startInput = document.getElementById(fields[0]);
                const endInput = document.getElementById(fields[1]);
                
                if (startInput?.value && endInput?.value) {
                    const start = new Date(startInput.value);
                    const end = new Date(endInput.value);
                    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
                    
                    // 如果养殖周期过短或过长
                    return days < 30 || days > 180;
                }
                return false;
            },
            message: '养殖周期长度异常。正常养殖周期通常在30-180天之间。'
        },
        {
            // 保质期建议
            field: 'shelf-life',
            condition: function(value) {
                return value && (value < 7 || value > 365);
            },
            message: '保质期设置异常。常见食品保质期通常在7-365天之间。'
        }
    ];
    
    // 创建提示元素
    function createSuggestionElement(message) {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'smart-suggestion mt-2';
        suggestionElement.innerHTML = `
            <i class="fas fa-lightbulb"></i>
            <span>${message}</span>
        `;
        return suggestionElement;
    }
    
    // 检查单个字段的提示规则
    function checkFieldSuggestion(field, value) {
        // 清除原有提示
        clearFieldSuggestion(field);
        
        // 检查适用于该字段的所有规则
        suggestionRules.forEach(rule => {
            if (rule.field === field) {
                if (rule.condition(value)) {
                    const inputElement = document.getElementById(field);
                    if (inputElement) {
                        const suggestionElement = createSuggestionElement(rule.message);
                        inputElement.parentNode.appendChild(suggestionElement);
                    }
                }
            }
        });
    }
    
    // 检查多字段关联的提示规则
    function checkMultiFieldSuggestion(fields) {
        // 清除相关字段的提示
        fields.forEach(field => {
            clearFieldSuggestion(field);
        });
        
        // 检查适用于这些字段的所有规则
        suggestionRules.forEach(rule => {
            if (rule.fields && arraysEqual(rule.fields, fields)) {
                if (rule.condition(fields)) {
                    const inputElement = document.getElementById(fields[0]);
                    if (inputElement) {
                        const suggestionElement = createSuggestionElement(rule.message);
                        inputElement.parentNode.appendChild(suggestionElement);
                    }
                }
            }
        });
    }
    
    // 清除字段的提示
    function clearFieldSuggestion(field) {
        const inputElement = document.getElementById(field);
        if (inputElement) {
            const suggestions = inputElement.parentNode.querySelectorAll('.smart-suggestion');
            suggestions.forEach(el => el.remove());
        }
    }
    
    // 比较两个数组是否相等（忽略顺序）
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, idx) => val === sortedB[idx]);
    }
    
    // 设置字段智能提示
    function setupFieldSuggestions(formElement) {
        if (!formElement) return;
        
        // 单个字段提示
        suggestionRules.forEach(rule => {
            if (rule.field) {
                const inputElement = document.getElementById(rule.field);
                if (inputElement) {
                    // 添加失去焦点事件
                    inputElement.addEventListener('blur', function() {
                        checkFieldSuggestion(rule.field, this.value);
                    });
                }
            }
        });
        
        // 多字段关联提示
        suggestionRules.forEach(rule => {
            if (rule.fields) {
                rule.fields.forEach(field => {
                    const inputElement = document.getElementById(field);
                    if (inputElement) {
                        // 添加失去焦点事件
                        inputElement.addEventListener('blur', function() {
                            checkMultiFieldSuggestion(rule.fields);
                        });
                    }
                });
            }
        });
    }
    
    return {
        init: function(formElement) {
            setupFieldSuggestions(formElement);
        }
    };
})();

// 表单根据产品类型动态显示
const TraceDynamicForm = (function() {
    // 产品类型与阶段映射
    const productStages = {
        'meat': ['breeding-stage', 'slaughter-stage', 'inspection-stage', 'logistics-stage', 'sales-stage'],
        'vegetable': ['breeding-stage', 'inspection-stage', 'logistics-stage', 'sales-stage'],
        'dairy': ['breeding-stage', 'inspection-stage', 'logistics-stage', 'sales-stage'],
        'processed': ['inspection-stage', 'logistics-stage', 'sales-stage']
    };
    
    // 显示或隐藏阶段
    function toggleStages(productType) {
        if (!productStages[productType]) return;
        
        // 获取所有阶段元素
        const allStages = document.querySelectorAll('.stage-section');
        
        // 先隐藏所有阶段
        allStages.forEach(stage => {
            stage.style.display = 'none';
        });
        
        // 显示相关阶段
        const stages = productStages[productType];
        stages.forEach(stageId => {
            const stageElement = document.getElementById(stageId);
            if (stageElement) {
                stageElement.style.display = 'block';
            }
        });
    }
    
    // 获取表单完成度
    function getFormCompletion(formElement) {
        if (!formElement) return 0;
        
        const requiredFields = formElement.querySelectorAll('[required]');
        if (requiredFields.length === 0) return 100;
        
        let filledCount = 0;
        
        requiredFields.forEach(field => {
            if (field.type === 'checkbox' || field.type === 'radio') {
                if (field.checked) filledCount++;
            } else if (field.value.trim()) {
                filledCount++;
            }
        });
        
        return Math.round((filledCount / requiredFields.length) * 100);
    }
    
    // 更新表单完成度
    function updateFormCompletion(formElement, progressElement) {
        if (!formElement || !progressElement) return;
        
        const completion = getFormCompletion(formElement);
        const progressBar = progressElement.querySelector('.form-progress-bar');
        
        if (progressBar) {
            progressBar.style.width = `${completion}%`;
            // 颜色根据完成度变化
            if (completion < 30) {
                progressBar.style.backgroundColor = '#ef4444'; // 红色
            } else if (completion < 70) {
                progressBar.style.backgroundColor = '#f59e0b'; // 黄色
            } else {
                progressBar.style.backgroundColor = '#10b981'; // 绿色
            }
        }
    }
    
    // 初始化表单完成度进度条
    function setupFormProgress(formElement) {
        if (!formElement) return;
        
        // 创建进度条元素
        const progressContainer = document.createElement('div');
        progressContainer.className = 'form-progress';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'form-progress-bar';
        progressBar.style.width = '0%';
        
        progressContainer.appendChild(progressBar);
        
        // 在表单开始前插入进度条
        formElement.parentNode.insertBefore(progressContainer, formElement);
        
        // 初始更新一次进度条
        updateFormCompletion(formElement, progressContainer);
        
        // 监听表单字段变化
        const fields = formElement.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.addEventListener('change', function() {
                updateFormCompletion(formElement, progressContainer);
            });
        });
        
        return progressContainer;
    }
    
    return {
        init: function(productTypeSelector) {
            if (!productTypeSelector) return;
            
            // 添加产品类型变化监听
            productTypeSelector.addEventListener('change', function() {
                toggleStages(this.value);
            });
            
            // 初始化时触发一次
            if (productTypeSelector.value) {
                toggleStages(productTypeSelector.value);
            }
        },
        setupProgress: setupFormProgress
    };
})();

// 导出功能
window.TraceIntelligence = {
    initSmartLink: TraceSmartLink.init,
    initSmartSuggestion: TraceSmartSuggestion.init,
    initDynamicForm: TraceDynamicForm.init,
    setupFormProgress: TraceDynamicForm.setupFormProgress
}; 