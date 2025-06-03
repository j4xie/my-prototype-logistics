/**
 * 食品溯源系统 - 数据趋势预测模块
 * 版本: 1.0.0
 * 提供数据分析、预测和决策支持功能
 */

window.tracePrediction = (function() {
    // 存储预测模型数据
    const models = {
        cost: {
            id: 'cost-prediction',
            name: '成本预测模型',
            algorithm: 'ARIMA',
            accuracy: 87.5,
            lastTrained: '2023-12-12',
            status: 'active',
            parameters: {
                confidenceLevel: 95,
                seasonalityStrength: 7,
                outlierThreshold: 3,
                predictionPeriod: 30
            }
        },
        production: {
            id: 'production-prediction',
            name: '产量预测模型',
            algorithm: 'RandomForest',
            accuracy: 82.3,
            lastTrained: '2023-12-10',
            status: 'active',
            parameters: {
                confidenceLevel: 90,
                seasonalityStrength: 6,
                outlierThreshold: 2.5,
                predictionPeriod: 30
            }
        },
        quality: {
            id: 'quality-prediction',
            name: '质量预测模型',
            algorithm: 'XGBoost',
            accuracy: 0,
            lastTrained: '',
            status: 'training',
            parameters: {
                confidenceLevel: 95,
                seasonalityStrength: 5,
                outlierThreshold: 3,
                predictionPeriod: 30
            }
        }
    };
    
    // 存储预测配置
    const config = {
        enablePrediction: true,
        autoOptimize: true,
        abnormalAlert: true,
        syncFrequency: '1hour',
        dataRetention: '90days',
        wifiOnly: false,
        alertThreshold: 10,
        permissions: {
            view: 'staff',
            edit: 'manager'
        }
    };
    
    // 模拟缓存的预测结果
    const predictionCache = {};
    
    /**
     * 初始化预测模块
     */
    function init() {
        // 从本地存储加载配置
        loadConfig();
        
        // 绑定数据同步事件
        if (config.enablePrediction) {
            setupDataSync();
        }
        
        console.log('预测模块初始化完成');
        
        // 处理可能的错误
        window.addEventListener('error', function(e) {
            console.warn('预测模块捕获到错误:', e.message);
            // 记录错误但允许继续执行
            return true;
        });
        
        // 如果图表库不可用，加载替代实现
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js未加载，使用简化图表实现');
            window.Chart = createFallbackChartImplementation();
        }
        
        return true;
    }
    
    /**
     * 从本地存储加载配置
     */
    function loadConfig() {
        try {
            const savedConfig = localStorage.getItem('trace_prediction_config');
            if (savedConfig) {
                Object.assign(config, JSON.parse(savedConfig));
            }
            
            const savedModels = localStorage.getItem('trace_prediction_models');
            if (savedModels) {
                Object.assign(models, JSON.parse(savedModels));
            }
        } catch (error) {
            console.error('加载预测配置失败:', error);
        }
    }
    
    /**
     * 保存配置到本地存储
     */
    function saveConfig() {
        try {
            localStorage.setItem('trace_prediction_config', JSON.stringify(config));
            localStorage.setItem('trace_prediction_models', JSON.stringify(models));
        } catch (error) {
            console.error('保存预测配置失败:', error);
        }
    }
    
    /**
     * 设置数据同步
     */
    function setupDataSync() {
        // 解析同步频率，设置定时器
        let interval = 60 * 60 * 1000; // 默认1小时
        
        switch(config.syncFrequency) {
            case '10min':
                interval = 10 * 60 * 1000;
                break;
            case '30min':
                interval = 30 * 60 * 1000;
                break;
            case '6hour':
                interval = 6 * 60 * 60 * 1000;
                break;
            case '12hour':
                interval = 12 * 60 * 60 * 1000;
                break;
            case 'daily':
                interval = 24 * 60 * 60 * 1000;
                break;
        }
        
        // 创建定时器
        setInterval(function() {
            // 检查是否需要同步
            if (config.wifiOnly && !isWifiConnected()) {
                console.log('仅在WiFi环境下同步，当前非WiFi连接');
                return;
            }
            
            // 执行数据同步
            syncData();
        }, interval);
    }
    
    /**
     * 检查是否连接WiFi
     * @returns {boolean} 是否连接WiFi
     */
    function isWifiConnected() {
        // 实际项目中应当使用网络信息API
        // 这里简单模拟，随机返回true/false
        return Math.random() > 0.3;
    }
    
    /**
     * 同步数据，更新预测
     */
    function syncData() {
        console.log('开始同步预测数据');
        
        // 清除旧缓存
        clearExpiredCache();
        
        // 对各个模型执行预测
        Object.keys(models).forEach(modelKey => {
            const model = models[modelKey];
            if (model.status === 'active') {
                generatePredictions(modelKey);
            }
        });
        
        console.log('预测数据同步完成');
    }
    
    /**
     * 清除过期缓存
     */
    function clearExpiredCache() {
        const now = Date.now();
        Object.keys(predictionCache).forEach(key => {
            if (predictionCache[key].expiry < now) {
                delete predictionCache[key];
            }
        });
    }
    
    /**
     * 获取预测数据
     * @param {string} modelId - 模型标识
     * @param {Object} options - 预测参数
     * @returns {Promise<Object>} 预测结果
     */
    function getPrediction(modelId, options = {}) {
        // 如果预测功能被禁用，返回空数据
        if (!config.enablePrediction) {
            return Promise.reject(new Error('预测功能已禁用'));
        }
        
        // 检查模型是否存在
        if (!models[modelId]) {
            return Promise.reject(new Error(`模型不存在: ${modelId}`));
        }
        
        // 检查权限
        if (!checkPermission('viewPredictions')) {
            return Promise.reject(new Error('无权限查看预测'));
        }
        
        try {
            // 预测参数
            const params = {
                batchId: options.batchId || 'B-2023-12',
                days: options.days || 30,
                ...options
            };
            
            // 根据模型类型生成不同的预测
            let predictionPromise;
            
            switch (modelId) {
                case 'cost':
                    predictionPromise = generateCostPrediction(params);
                    break;
                case 'production':
                    predictionPromise = generateProductionPrediction(params);
                    break;
                case 'quality':
                    predictionPromise = generateQualityPrediction(params);
                    break;
                default:
                    predictionPromise = generateCostPrediction(params);
            }
            
            // 添加错误处理
            return predictionPromise.catch(error => {
                console.error('预测生成失败:', error);
                
                // 根据模型类型返回备用数据
                let fallbackData;
                switch (modelId) {
                    case 'cost':
                        fallbackData = getFallbackCostData(params);
                        break;
                    case 'production':
                        fallbackData = getFallbackProductionData(params);
                        break;
                    case 'quality':
                        fallbackData = getFallbackQualityData(params);
                        break;
                    default:
                        fallbackData = getFallbackCostData(params);
                }
                
                // 记录错误并返回备用数据
                return handleError(error, fallbackData);
            });
        } catch (error) {
            // 处理同步错误
            console.error('预测请求处理错误:', error);
            const fallbackData = getFallbackCostData(options);
            return Promise.resolve(handleError(error, fallbackData));
        }
    }
    
    /**
     * 获取成本预测备用数据
     * @param {Object} params - 预测参数
     * @returns {Object} 备用数据
     */
    function getFallbackCostData(params) {
        const days = params.days || 30;
        const historicalDays = 5;
        
        // 生成历史数据
        const historicalData = [];
        for (let i = 0; i < historicalDays; i++) {
            historicalData.push({
                date: new Date(Date.now() - (historicalDays - i) * 86400000).toISOString().split('T')[0],
                value: 11.5 + i * 0.2
            });
        }
        
        // 生成预测数据
        const predictionData = [];
        for (let i = 0; i < days; i++) {
            predictionData.push({
                date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
                value: 12.3 + i * 0.2
            });
        }
        
        return {
            id: 'cost',
            batchId: params.batchId || 'B-2023-12',
            timestamp: new Date().toISOString(),
            historicalData,
            predictionData,
            trend: 'up',
            changePercent: 5.2,
            confidence: 85,
            interval: 0.8,
            recommendations: [
                {
                    id: 'rec-001',
                    title: '建议提前采购下季度饲料',
                    description: '根据预测，饲料成本将在未来30天内持续上涨，建议提前采购下季度饲料',
                    impact: '预计可节省约4.2%成本',
                    priority: 'high'
                }
            ],
            isBackupData: true  // 标记为备用数据
        };
    }
    
    /**
     * 获取产量预测备用数据
     * @param {Object} params - 预测参数
     * @returns {Object} 备用数据
     */
    function getFallbackProductionData(params) {
        const days = params.days || 30;
        const historicalDays = 5;
        
        // 生成历史数据
        const historicalData = [];
        for (let i = 0; i < historicalDays; i++) {
            historicalData.push({
                date: new Date(Date.now() - (historicalDays - i) * 86400000).toISOString().split('T')[0],
                value: 450 + i * 10
            });
        }
        
        // 生成预测数据
        const predictionData = [];
        for (let i = 0; i < days; i++) {
            predictionData.push({
                date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
                value: 500 + i * 5
            });
        }
        
        return {
            id: 'production',
            batchId: params.batchId || 'B-2023-12',
            timestamp: new Date().toISOString(),
            historicalData,
            predictionData,
            trend: 'up',
            changePercent: 3.8,
            confidence: 82,
            interval: 15,
            recommendations: [
                {
                    id: 'rec-002',
                    title: '优化饲养密度',
                    description: '当前饲养密度偏低，提高每平米饲养量可增加产出',
                    impact: '预计可提高产量2.5%',
                    priority: 'medium'
                }
            ],
            isBackupData: true  // 标记为备用数据
        };
    }
    
    /**
     * 获取质量预测备用数据
     * @param {Object} params - 预测参数
     * @returns {Object} 备用数据
     */
    function getFallbackQualityData(params) {
        const days = params.days || 30;
        const historicalDays = 5;
        
        // 生成历史数据
        const historicalData = [];
        for (let i = 0; i < historicalDays; i++) {
            historicalData.push({
                date: new Date(Date.now() - (historicalDays - i) * 86400000).toISOString().split('T')[0],
                value: 92 + i * 0.5
            });
        }
        
        // 生成预测数据
        const predictionData = [];
        for (let i = 0; i < days; i++) {
            predictionData.push({
                date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
                value: 94 + (i < 10 ? i * 0.2 : 2 + (i-10) * 0.1)
            });
        }
        
        return {
            id: 'quality',
            batchId: params.batchId || 'B-2023-12',
            timestamp: new Date().toISOString(),
            historicalData,
            predictionData,
            trend: 'up',
            changePercent: 2.1,
            confidence: 88,
            interval: 2.5,
            recommendations: [
                {
                    id: 'rec-003',
                    title: '调整饲料配方',
                    description: '增加优质蛋白质含量，有助于提高产品质量',
                    impact: '预计质量评分提升1.5%',
                    priority: 'medium'
                }
            ],
            isBackupData: true  // 标记为备用数据
        };
    }
    
    /**
     * 生成预测数据
     * @param {string} modelKey - 模型标识
     * @param {Object} params - 预测参数
     * @returns {Promise<Object>} 预测结果
     */
    async function generatePredictions(modelKey, params = {}) {
        const model = models[modelKey];
        
        if (!model) {
            throw new Error(`未找到预测模型: ${modelKey}`);
        }
        
        if (model.status !== 'active') {
            throw new Error(`预测模型未激活: ${modelKey}`);
        }
        
        // 实际项目中应从服务器获取预测结果
        // 这里使用模拟数据
        return new Promise((resolve) => {
            // 模拟网络延迟
            setTimeout(() => {
                // 根据模型类型生成不同的预测结果
                let result;
                
                switch(modelKey) {
                    case 'cost':
                        result = generateCostPrediction(model, params);
                        break;
                    case 'production':
                        result = generateProductionPrediction(model, params);
                        break;
                    case 'quality':
                        result = generateQualityPrediction(model, params);
                        break;
                    default:
                        result = { error: '未知模型类型' };
                }
                
                // 缓存结果
                const cacheKey = `${modelKey}_${JSON.stringify(params)}`;
                predictionCache[cacheKey] = {
                    data: result,
                    expiry: Date.now() + 3600000 // 缓存1小时
                };
                
                resolve(result);
            }, 500);
        });
    }
    
    /**
     * 生成成本预测
     * @param {Object} model - 模型信息
     * @param {Object} params - 预测参数
     * @returns {Object} 成本预测结果
     */
    function generateCostPrediction(model, params) {
        // 读取参数
        const batchId = params.batchId || 'B-2023-12';
        const days = params.days || model.parameters.predictionPeriod;
        
        // 生成模拟数据
        const startValue = 11.5 + Math.random() * 2;
        const trend = 0.05; // 上升趋势
        const seasonality = model.parameters.seasonalityStrength / 20; // 季节性波动
        const noise = 0.2; // 随机噪声
        
        // 生成历史数据
        const historicalData = [];
        for (let i = 0; i < 14; i++) {
            const day = i - 14;
            const value = startValue + 
                trend * day + 
                seasonality * Math.sin(day / 7 * Math.PI) + 
                (Math.random() - 0.5) * noise;
            
            historicalData.push({
                date: getDateString(day),
                value: parseFloat(value.toFixed(2))
            });
        }
        
        // 生成预测数据
        const predictionData = [];
        const lastHistoricalValue = historicalData[historicalData.length - 1].value;
        
        for (let i = 0; i < days; i++) {
            const day = i;
            const value = lastHistoricalValue + 
                trend * (day + 1) + 
                seasonality * Math.sin((day + 1) / 7 * Math.PI) + 
                (Math.random() - 0.5) * noise * 1.5;
            
            predictionData.push({
                date: getDateString(day),
                value: parseFloat(value.toFixed(2)),
                lower: parseFloat((value - noise * 2).toFixed(2)),
                upper: parseFloat((value + noise * 2).toFixed(2))
            });
        }
        
        // 计算变化百分比
        const firstValue = historicalData[0].value;
        const lastValue = predictionData[predictionData.length - 1].value;
        const changePercent = ((lastValue - firstValue) / firstValue * 100).toFixed(1);
        
        return {
            modelId: model.id,
            modelName: model.name,
            batchId: batchId,
            predictionPeriod: days,
            confidenceLevel: model.parameters.confidenceLevel,
            historicalData: historicalData,
            predictionData: predictionData,
            currentValue: lastHistoricalValue,
            predictedValue: predictionData[predictionData.length - 1].value,
            changePercent: parseFloat(changePercent),
            trend: changePercent > 0 ? 'up' : (changePercent < 0 ? 'down' : 'stable'),
            recommendations: generateCostRecommendations(lastHistoricalValue, lastValue, changePercent),
            factors: generateCostFactors(),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 生成成本影响因素
     * @returns {Array} 影响因素列表
     */
    function generateCostFactors() {
        return [
            { name: '主要原料价格', weight: 56 },
            { name: '采购批量', weight: 18 },
            { name: '库存周转', weight: 12 },
            { name: '季节因素', weight: 9 },
            { name: '其他因素', weight: 5 }
        ];
    }
    
    /**
     * 生成成本优化建议
     * @param {number} currentValue - 当前值
     * @param {number} predictedValue - 预测值
     * @param {number} changePercent - 变化百分比
     * @returns {Array} 建议列表
     */
    function generateCostRecommendations(currentValue, predictedValue, changePercent) {
        const recommendations = [];
        
        if (changePercent > 3) {
            recommendations.push({
                id: 'cost-rec-1',
                title: '提前采购下季度原料',
                description: '根据分析，原料价格有进一步上涨趋势，建议提前锁定下季度主要原料采购价格。',
                impact: '预计节省: 4.2%',
                priority: 'high'
            });
            
            recommendations.push({
                id: 'cost-rec-2',
                title: '调整配方结构',
                description: '在保证营养需求的前提下，适当调整现有饲料配方，减少价格波动较大的原料占比。',
                impact: '预计节省: 2.1%',
                priority: 'medium'
            });
            
            recommendations.push({
                id: 'cost-rec-3',
                title: '增加采购批量',
                description: '扩大单次采购量，利用规模效应降低单位采购成本。',
                impact: '预计节省: 1.5%',
                priority: 'low'
            });
        } else if (changePercent < -3) {
            recommendations.push({
                id: 'cost-rec-4',
                title: '优化库存管理',
                description: '当前原料价格处于低位，可适当增加库存量，为后续可能的价格上涨做准备。',
                impact: '预计节省: 2.8%',
                priority: 'medium'
            });
        } else {
            recommendations.push({
                id: 'cost-rec-5',
                title: '保持当前采购策略',
                description: '成本预计保持稳定，建议继续执行当前的采购和库存策略。',
                impact: '维持稳定运营',
                priority: 'low'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 生成产量预测（简化实现）
     */
    function generateProductionPrediction(model, params) {
        // 简化实现，实际项目中应有完整逻辑
        return {
            modelId: model.id,
            modelName: model.name,
            // 其他字段简化...
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 生成质量预测（简化实现）
     */
    function generateQualityPrediction(model, params) {
        // 简化实现，实际项目中应有完整逻辑
        return {
            modelId: model.id,
            modelName: model.name,
            // 其他字段简化...
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 获取日期字符串
     * @param {number} daysFromNow - 距今天数
     * @returns {string} 日期字符串
     */
    function getDateString(daysFromNow) {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    
    /**
     * 获取预测模型列表
     * @returns {Object} 模型列表
     */
    function getModels() {
        return JSON.parse(JSON.stringify(models));
    }
    
    /**
     * 更新模型参数
     * @param {string} modelKey - 模型标识
     * @param {Object} parameters - 新参数
     */
    function updateModelParams(modelKey, parameters) {
        if (!models[modelKey]) {
            throw new Error(`未找到预测模型: ${modelKey}`);
        }
        
        models[modelKey].parameters = { ...models[modelKey].parameters, ...parameters };
        models[modelKey].lastTrained = new Date().toISOString().split('T')[0];
        
        // 清除相关缓存
        Object.keys(predictionCache).forEach(key => {
            if (key.startsWith(modelKey)) {
                delete predictionCache[key];
            }
        });
        
        // 保存配置
        saveConfig();
        
        return models[modelKey];
    }
    
    /**
     * 更新系统配置
     * @param {Object} newConfig - 新配置
     */
    function updateConfig(newConfig) {
        const oldEnablePrediction = config.enablePrediction;
        const oldSyncFrequency = config.syncFrequency;
        
        Object.assign(config, newConfig);
        
        // 如果开启状态或同步频率发生变化，重新设置数据同步
        if (oldEnablePrediction !== config.enablePrediction || oldSyncFrequency !== config.syncFrequency) {
            setupDataSync();
        }
        
        // 保存配置
        saveConfig();
        
        return config;
    }
    
    /**
     * 开始模型训练
     * @param {string} modelKey - 模型标识
     */
    function trainModel(modelKey) {
        if (!models[modelKey]) {
            throw new Error(`未找到预测模型: ${modelKey}`);
        }
        
        // 更新模型状态
        models[modelKey].status = 'training';
        
        // 模拟训练过程
        return new Promise((resolve) => {
            setTimeout(() => {
                models[modelKey].status = 'active';
                models[modelKey].lastTrained = new Date().toISOString().split('T')[0];
                models[modelKey].accuracy = Math.round((80 + Math.random() * 10) * 10) / 10;
                
                // 保存配置
                saveConfig();
                
                resolve(models[modelKey]);
            }, 2000);
        });
    }
    
    // 创建简化的Chart.js替代实现
    function createFallbackChartImplementation() {
        return class FallbackChart {
            constructor(ctx, config) {
                this.ctx = ctx;
                this.config = config;
                this.data = config.data || {};
                console.log('使用备用图表绘制器');
                this.render();
            }
            
            render() {
                const ctx = this.ctx;
                if (!ctx || !ctx.getContext) return;
                
                try {
                    const context = ctx.getContext('2d');
                    if (!context) return;
                    
                    // 清空画布
                    context.clearRect(0, 0, ctx.width, ctx.height);
                    context.fillStyle = '#f5f5f5';
                    context.fillRect(0, 0, ctx.width, ctx.height);
                    
                    // 绘制简单直线
                    context.beginPath();
                    context.moveTo(0, ctx.height / 2);
                    context.lineTo(ctx.width, ctx.height / 2);
                    context.strokeStyle = '#1890FF';
                    context.stroke();
                    
                    // 添加文本说明
                    context.font = '12px Arial';
                    context.fillStyle = '#333';
                    context.textAlign = 'center';
                    context.fillText('简化图表显示 - 图表库未加载', ctx.width / 2, ctx.height / 2 - 15);
                } catch (e) {
                    console.error('备用图表渲染失败:', e);
                }
            }
            
            update() {
                this.render();
            }
            
            destroy() {
                // 清理操作
            }
        };
    }
    
    // 错误处理与恢复
    function handleError(error, fallbackData) {
        console.error('预测模块错误:', error);
        
        // 记录错误以供后续分析
        try {
            const errors = JSON.parse(localStorage.getItem('trace_prediction_errors') || '[]');
            errors.push({
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            });
            // 保留最近100条错误记录
            if (errors.length > 100) errors.shift();
            localStorage.setItem('trace_prediction_errors', JSON.stringify(errors));
        } catch (e) {
            // 忽略存储错误
        }
        
        // 返回备用数据，确保应用继续运行
        return fallbackData;
    }
    
    // 公开API
    return {
        init,
        getModels,
        getPrediction,
        updateModelParams,
        updateConfig,
        trainModel
    };
})();

// 自动初始化
document.addEventListener('DOMContentLoaded', function() {
    window.tracePrediction.init();
}); 