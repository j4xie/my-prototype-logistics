/**
 * 食品溯源系统 - 数据导入与扫码录入功能
 */

// 数据导入功能
const TraceDataImport = (function() {
    // 支持的文件类型
    const SUPPORTED_FORMATS = ['.csv', '.xlsx', '.json'];
    
    // 转换CSV文件为JSON对象
    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const data = lines[i].split(',');
            const item = {};
            
            headers.forEach((header, index) => {
                item[header] = data[index]?.trim() || '';
            });
            
            result.push(item);
        }
        
        return result;
    }
    
    // 导入Excel文件（简化版，实际可能需要使用专门的库如SheetJS）
    function parseExcel(arrayBuffer) {
        console.log('Excel解析需要SheetJS库支持');
        return null;
    }
    
    // 解析JSON文件
    function parseJSON(jsonText) {
        try {
            return JSON.parse(jsonText);
        } catch (error) {
            console.error('JSON解析错误:', error);
            return null;
        }
    }
    
    // 处理文件导入
    function handleFileImport(file, callback) {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!SUPPORTED_FORMATS.includes(fileExtension)) {
            alert(`不支持的文件格式: ${fileExtension}。请使用 CSV, XLSX 或 JSON 格式`);
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            let data = null;
            
            try {
                switch (fileExtension) {
                    case '.csv':
                        data = parseCSV(event.target.result);
                        break;
                    case '.xlsx':
                        data = parseExcel(event.target.result);
                        break;
                    case '.json':
                        data = parseJSON(event.target.result);
                        break;
                }
                
                if (data && callback) {
                    callback(data);
                }
            } catch (error) {
                console.error('文件解析错误:', error);
                alert('文件解析失败，请检查文件格式是否正确');
            }
        };
        
        reader.onerror = function() {
            console.error('文件读取错误');
            alert('文件读取失败，请重试');
        };
        
        if (fileExtension === '.xlsx') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    }
    
    // 填充表单数据
    function fillFormData(formElement, data) {
        if (!formElement || !data || !data.length) return;
        
        // 使用第一条数据填充表单
        const record = data[0];
        
        // 遍历表单字段并填充数据
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const name = input.name || input.id;
            if (name && record[name] !== undefined) {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = record[name] === 'true' || record[name] === true;
                } else {
                    input.value = record[name];
                }
                
                // 触发change事件以激活任何依赖于该字段的逻辑
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    
    // 创建数据导入区域
    function createImportUI(targetElement, formElement) {
        if (!targetElement) return;
        
        const importArea = document.createElement('div');
        importArea.className = 'data-import-area mb-4';
        importArea.innerHTML = `
            <div class="data-import-icon">
                <i class="fas fa-file-import"></i>
            </div>
            <p class="text-sm font-medium text-gray-700 mb-2">导入数据</p>
            <p class="text-xs text-gray-500 mb-3">支持 CSV, Excel 或 JSON 格式</p>
            <input type="file" id="file-import" accept=".csv,.xlsx,.json" class="hidden">
            <div class="flex justify-center space-x-3">
                <label for="file-import" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-100 transition-colors">
                    <i class="fas fa-upload mr-1"></i> 选择文件
                </label>
                <button type="button" id="template-download" class="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
                    <i class="fas fa-download mr-1"></i> 下载模板
                </button>
            </div>
        `;
        
        targetElement.prepend(importArea);
        
        // 文件导入处理
        const fileInput = importArea.querySelector('#file-import');
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                handleFileImport(this.files[0], data => {
                    fillFormData(formElement, data);
                });
            }
        });
        
        // 下载模板处理
        const templateButton = importArea.querySelector('#template-download');
        templateButton.addEventListener('click', function() {
            generateTemplate(formElement);
        });
    }
    
    // 生成导入模板
    function generateTemplate(formElement) {
        if (!formElement) return;
        
        // 收集字段名
        const inputs = formElement.querySelectorAll('input, select, textarea');
        const fields = [];
        
        inputs.forEach(input => {
            const name = input.name || input.id;
            if (name && !fields.includes(name)) {
                fields.push(name);
            }
        });
        
        // 创建CSV内容
        const csvContent = fields.join(',') + '\n' + fields.map(() => '').join(',');
        
        // 创建下载链接
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', '溯源数据导入模板.csv');
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    return {
        init: function(targetElement, formElement) {
            createImportUI(targetElement, formElement);
        },
        handleFileImport: handleFileImport,
        fillFormData: fillFormData
    };
})();

// 扫码录入功能
const TraceScanInput = (function() {
    let scanner = null;
    
    // 初始化扫码器（使用HTML5 Qrcode库）
    function initScanner(targetElement) {
        // 实际项目中，应引入HTML5 Qrcode库
        console.log('扫码功能需要HTML5 Qrcode库支持');
    }
    
    // 添加扫码按钮到输入字段
    function addScanButton(inputElement) {
        if (!inputElement) return;
        
        // 确保输入字段有相对定位的父元素
        const parentElement = inputElement.parentElement;
        if (getComputedStyle(parentElement).position === 'static') {
            parentElement.style.position = 'relative';
        }
        
        const scanButton = document.createElement('button');
        scanButton.type = 'button';
        scanButton.className = 'scan-input-button';
        scanButton.innerHTML = '<i class="fas fa-qrcode"></i>';
        scanButton.title = '扫码输入';
        scanButton.setAttribute('aria-label', '扫码输入');
        
        parentElement.appendChild(scanButton);
        
        // 添加点击事件
        scanButton.addEventListener('click', function() {
            openScannerModal(inputElement);
        });
    }
    
    // 打开扫码器模态框
    function openScannerModal(inputElement) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-medium text-gray-900">扫描条码/二维码</h3>
                    <button type="button" class="text-gray-400 hover:text-gray-500" id="close-scanner">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="scanner-container" class="w-full h-64 bg-gray-100 mb-4 flex items-center justify-center">
                    <p class="text-gray-500">
                        <i class="fas fa-camera text-xl mr-2"></i> 
                        相机加载中...
                    </p>
                </div>
                <div class="text-center text-sm text-gray-500 mb-4">
                    请将条码或二维码置于摄像头前方
                </div>
                <div class="flex justify-end">
                    <button type="button" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors" id="cancel-scan">
                        取消
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 关闭按钮事件
        const closeButton = document.getElementById('close-scanner');
        const cancelButton = document.getElementById('cancel-scan');
        
        closeButton.addEventListener('click', function() {
            document.body.removeChild(modal);
        });
        
        cancelButton.addEventListener('click', function() {
            document.body.removeChild(modal);
        });
        
        // 在这里可以初始化扫码器
        // 实际项目中应使用HTML5 Qrcode库或其他扫码库
        // 扫码完成后，将结果填入inputElement.value
        
        // 模拟扫码成功
        setTimeout(function() {
            const simulatedCode = 'TRACE-' + Math.floor(Math.random() * 1000000);
            alert(`模拟扫码结果: ${simulatedCode}`);
            if (inputElement) {
                inputElement.value = simulatedCode;
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            }
            document.body.removeChild(modal);
        }, 3000);
    }
    
    // 添加扫码按钮到所有适合的输入字段
    function addScanButtonsToForm(formElement) {
        if (!formElement) return;
        
        // 可扫码的字段类型
        const scanableFields = formElement.querySelectorAll('input[type="text"], input[type="number"]');
        
        scanableFields.forEach(input => {
            // 检查是否适合添加扫码按钮（批次号、编码等）
            const name = input.name || input.id || '';
            const isScanable = name.includes('code') || 
                               name.includes('batch') || 
                               name.includes('number') ||
                               name.includes('id');
            
            if (isScanable) {
                addScanButton(input);
            }
        });
    }
    
    return {
        init: function(formElement) {
            addScanButtonsToForm(formElement);
        }
    };
})();

// 导出数据工具接口
const traceDataTools = {
    import: TraceDataImport,
    scan: TraceScanInput,
    getIconPath: function(name) {
        return `/static/icons/${name}.svg`;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { traceDataTools };
} else {
    window.traceDataTools = traceDataTools;
}

// 在文档加载完成后初始化表单验证
document.addEventListener('DOMContentLoaded', () => {
    const importContainer = document.getElementById('data-import-container');
    const traceForm = document.getElementById('trace-form');
    
    if (importContainer && traceForm) {
        traceDataTools.import.init(importContainer, traceForm);
        traceDataTools.scan.init(traceForm);
    }
}); 