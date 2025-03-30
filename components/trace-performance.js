/**
 * 食品溯源系统 - 性能优化组件
 * 提供代码分割、延迟加载、资源预加载和性能监控功能
 */

const TracePerformance = (function() {
    // 配置
    const config = {
        enabled: true,
        lazyLoadEnabled: true,
        resourcePrefetchEnabled: true,
        monitoringEnabled: true,
        cacheEnabled: true,
        compressionEnabled: true,
        cacheExpiry: 86400000, // 24小时（毫秒）
        metricsEndpoint: null, // 实际项目中设置性能监控数据上报地址
        imageQuality: 80, // 图片优化质量（百分比）
        lowBandwidthThreshold: 200 // 低带宽阈值（KB/s）
    };
    
    // 性能指标
    let performanceMetrics = {
        pageLoaded: false,
        timeToFirstByte: 0,
        domContentLoaded: 0,
        fullLoadTime: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
        resourceCount: 0,
        resourceSize: 0,
        memoryUsage: null,
        networkType: 'unknown',
        effectiveConnectionType: 'unknown',
        deviceMemory: 0,
        hardwareConcurrency: 0,
        batteryLevel: null,
        timestamp: Date.now()
    };
    
    // 连接信息
    let connectionInfo = {
        downlink: 0,        // 以Mbps为单位的下行带宽
        effectiveType: '4g', // 有效连接类型: 4g, 3g, 2g, slow-2g
        rtt: 0,             // 往返时间（毫秒）
        saveData: false      // 用户启用了数据保存模式
    };
    
    // 资源加载队列
    const resourceQueue = [];
    
    // 资源缓存
    const resourceCache = {};
    
    // 初始化性能监控
    function init() {
        if (!config.enabled) return false;
        
        // 测量导航和初始加载性能
        measureNavigationPerformance();
        
        // 设置观察者
        if (config.monitoringEnabled) {
            setupPerformanceObservers();
        }
        
        // 获取网络连接信息
        updateConnectionInfo();
        
        // 设置网络变化监听
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', updateConnectionInfo);
        }
        
        // 初始化电池信息（如果支持）
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                performanceMetrics.batteryLevel = battery.level;
                
                battery.addEventListener('levelchange', () => {
                    performanceMetrics.batteryLevel = battery.level;
                    
                    // 如果电池电量低，进入省电模式
                    if (battery.level < 0.15) {
                        enterLowPowerMode();
                    }
                });
            });
        }
        
        // 设置页面可见性监听
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                // 页面不可见时，暂停非必要操作
                pauseNonEssentialOperations();
            } else {
                // 页面可见时，恢复操作
                resumeOperations();
            }
        });
        
        // 页面加载完成事件
        window.addEventListener('load', function() {
            performanceMetrics.pageLoaded = true;
            performanceMetrics.fullLoadTime = performance.now();
            
            // 收集资源信息
            collectResourceMetrics();
            
            // 如果启用了资源预加载，执行预加载
            if (config.resourcePrefetchEnabled) {
                prefetchResources();
            }
            
            // 延迟上报性能数据，确保所有指标都已收集
            setTimeout(reportPerformanceMetrics, 2000);
        });
        
        // 监听设备内存变化（如果支持）
        if ('deviceMemory' in navigator) {
            performanceMetrics.deviceMemory = navigator.deviceMemory;
        }
        
        // 获取硬件并发数
        if ('hardwareConcurrency' in navigator) {
            performanceMetrics.hardwareConcurrency = navigator.hardwareConcurrency;
        }
        
        return true;
    }
    
    // 测量导航和初始加载性能
    function measureNavigationPerformance() {
        if (!performance || !performance.timing) return;
        
        const timing = performance.timing;
        
        // 计算关键性能指标
        performanceMetrics.timeToFirstByte = timing.responseStart - timing.navigationStart;
        performanceMetrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
        
        // 如果加载已完成，记录完整加载时间
        if (timing.loadEventEnd > 0) {
            performanceMetrics.fullLoadTime = timing.loadEventEnd - timing.navigationStart;
        }
    }
    
    // 设置性能观察者
    function setupPerformanceObservers() {
        // 检查性能观察者API支持
        if (!('PerformanceObserver' in window)) return;
        
        try {
            // 观察绘制（Paint）时间
            const paintObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (entry.name === 'first-paint') {
                        performanceMetrics.firstPaint = entry.startTime;
                    } else if (entry.name === 'first-contentful-paint') {
                        performanceMetrics.firstContentfulPaint = entry.startTime;
                    }
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });
            
            // 观察Largest Contentful Paint
            if ('LargestContentfulPaint' in window) {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    performanceMetrics.largestContentfulPaint = lastEntry.startTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            }
            
            // 观察First Input Delay
            if ('PerformanceEventTiming' in window) {
                const fidObserver = new PerformanceObserver((entryList) => {
                    const firstInput = entryList.getEntries()[0];
                    if (firstInput) {
                        performanceMetrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
                    }
                });
                fidObserver.observe({ type: 'first-input', buffered: true });
            }
            
            // 观察Cumulative Layout Shift
            if ('LayoutShift' in window) {
                let cumulativeLayoutShift = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            cumulativeLayoutShift += entry.value;
                            performanceMetrics.cumulativeLayoutShift = cumulativeLayoutShift;
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            }
            
            // 观察资源加载性能
            const resourceObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    // 排除XHR和其他非资源加载
                    if (entry.initiatorType && ['img', 'script', 'css', 'link'].includes(entry.initiatorType)) {
                        performanceMetrics.resourceCount++;
                        performanceMetrics.resourceSize += entry.transferSize || 0;
                    }
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            
            // 观察长任务
            if ('TaskAttributionTiming' in window) {
                const longTaskObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        // 记录长任务（超过50ms的任务）
                        console.warn(`检测到长任务: ${entry.duration}ms`, entry);
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            }
            
        } catch (e) {
            console.error('性能观察者设置失败:', e);
        }
    }
    
    // 更新连接信息
    function updateConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            connectionInfo = {
                downlink: connection.downlink || 0,
                effectiveType: connection.effectiveType || '4g',
                rtt: connection.rtt || 0,
                saveData: connection.saveData || false
            };
            
            performanceMetrics.networkType = connection.type || 'unknown';
            performanceMetrics.effectiveConnectionType = connection.effectiveType || 'unknown';
            
            // 如果连接条件差，调整优化策略
            adjustForNetworkConditions();
        }
    }
    
    // 根据网络条件调整优化策略
    function adjustForNetworkConditions() {
        // 如果是低带宽连接
        if (connectionInfo.downlink < 0.5 || connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
            // 降低图片质量
            config.imageQuality = 60;
            
            // 禁用预加载
            config.resourcePrefetchEnabled = false;
            
            // 减少并发请求
            config.maxConcurrentRequests = 2;
            
            // 如果启用了数据保存模式
            if (connectionInfo.saveData) {
                // 进一步优化
                config.imageQuality = 40;
                disableNonEssentialFeatures();
            }
        } else {
            // 恢复默认设置
            config.imageQuality = 80;
            config.resourcePrefetchEnabled = true;
            config.maxConcurrentRequests = 6;
        }
    }
    
    // 禁用非必要功能
    function disableNonEssentialFeatures() {
        // 禁用动画
        document.body.classList.add('reduce-motion');
        
        // 禁用自动播放视频
        document.querySelectorAll('video[autoplay]').forEach(video => {
            video.removeAttribute('autoplay');
            video.pause();
        });
        
        // 禁用非必要的背景图
        document.querySelectorAll('.bg-image:not(.essential)').forEach(el => {
            el.style.backgroundImage = 'none';
        });
    }
    
    // 收集资源指标
    function collectResourceMetrics() {
        if (!performance || !performance.getEntriesByType) return;
        
        const resources = performance.getEntriesByType('resource');
        let totalSize = 0;
        let count = 0;
        
        resources.forEach(resource => {
            totalSize += resource.transferSize || 0;
            count++;
        });
        
        performanceMetrics.resourceCount = count;
        performanceMetrics.resourceSize = totalSize;
        
        // 如果支持，获取内存使用情况
        if (performance.memory) {
            performanceMetrics.memoryUsage = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
    }
    
    // 上报性能指标
    function reportPerformanceMetrics() {
        // 更新时间戳
        performanceMetrics.timestamp = Date.now();
        
        // 在控制台输出性能指标
        console.log('性能指标:', performanceMetrics);
        
        // 如果配置了上报端点，发送数据
        if (config.metricsEndpoint) {
            fetch(config.metricsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(performanceMetrics),
                // 确保性能数据上报不阻塞用户体验
                keepalive: true
            }).catch(err => console.error('性能数据上报失败:', err));
        }
        
        // 存储到本地存储（用于历史比较）
        try {
            const history = JSON.parse(localStorage.getItem('trace_performance_history') || '[]');
            history.push(performanceMetrics);
            
            // 只保留最近10条记录
            if (history.length > 10) {
                history.shift();
            }
            
            localStorage.setItem('trace_performance_history', JSON.stringify(history));
        } catch (e) {
            console.error('性能历史保存失败:', e);
        }
    }
    
    // 低电量模式
    function enterLowPowerMode() {
        console.log('进入低电量模式');
        
        // 减少更新频率
        config.refreshInterval = 10000; // 10秒
        
        // 降低图片质量
        config.imageQuality = 50;
        
        // 禁用非必要功能
        disableNonEssentialFeatures();
    }
    
    // 暂停非必要操作
    function pauseNonEssentialOperations() {
        // 暂停轮询和自动更新
        clearAllIntervals();
        
        // 暂停动画
        document.body.classList.add('pause-animations');
        
        // 暂停视频
        document.querySelectorAll('video').forEach(video => video.pause());
        
        // 暂停音频
        document.querySelectorAll('audio').forEach(audio => audio.pause());
    }
    
    // 恢复操作
    function resumeOperations() {
        // 恢复动画
        document.body.classList.remove('pause-animations');
        
        // 恢复自动播放的视频
        document.querySelectorAll('video[autoplay]').forEach(video => {
            if (video.hasAttribute('data-autoplay')) {
                video.play().catch(() => {});
            }
        });
        
        // 恢复自动播放的音频
        document.querySelectorAll('audio[autoplay]').forEach(audio => {
            if (audio.hasAttribute('data-autoplay')) {
                audio.play().catch(() => {});
            }
        });
    }
    
    // 清除所有间隔计时器
    function clearAllIntervals() {
        // 获取所有注册的间隔计时器
        const intervals = window.tracePerfIntervals || [];
        
        // 清除所有间隔计时器
        intervals.forEach(id => clearInterval(id));
        
        // 重置数组
        window.tracePerfIntervals = [];
    }
    
    // 安全的setInterval包装器
    function safeSetInterval(callback, interval) {
        // 创建间隔计时器
        const id = setInterval(callback, interval);
        
        // 如果全局数组不存在，创建它
        if (!window.tracePerfIntervals) {
            window.tracePerfIntervals = [];
        }
        
        // 添加到全局数组
        window.tracePerfIntervals.push(id);
        
        // 返回ID，以便可以单独清除
        return id;
    }
    
    // 懒加载图片
    function lazyLoadImages() {
        if (!config.lazyLoadEnabled || !('IntersectionObserver' in window)) return;
        
        const imgObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    
                    if (src) {
                        // 根据网络条件选择图片质量
                        if (connectionInfo.downlink < 1 || connectionInfo.effectiveType === '2g') {
                            // 如果网络条件差，加载低质量图片
                            img.src = src.replace(/\.(jpg|jpeg|png)/i, '-low.$1');
                        } else {
                            img.src = src;
                        }
                        
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '100px 0px', // 提前100px开始加载
            threshold: 0.1
        });
        
        // 获取所有带data-src属性的图片
        document.querySelectorAll('img[data-src]').forEach(img => {
            imgObserver.observe(img);
        });
    }
    
    // 资源预加载
    function prefetchResources() {
        if (!config.resourcePrefetchEnabled) return;
        
        // 获取可能需要预加载的资源
        const prefetchLinks = [
            // 示例：预加载下一步可能需要的资源
            { url: 'components/trace-breeding.html', type: 'document' },
            { url: 'components/trace-slaughter.html', type: 'document' },
            { url: 'components/trace-inspection.html', type: 'document' },
            { url: 'assets/images/steps-icon.png', type: 'image' }
        ];
        
        // 如果连接条件好，执行预加载
        if (connectionInfo.effectiveType === '4g' && !connectionInfo.saveData) {
            prefetchLinks.forEach(resource => {
                const link = document.createElement('link');
                link.rel = (resource.type === 'document') ? 'prefetch' : 'preload';
                link.href = resource.url;
                link.as = resource.type;
                
                // 添加到文档头
                document.head.appendChild(link);
            });
        }
    }
    
    // 异步加载脚本
    function loadScriptAsync(url, callback) {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        
        // 如果提供了回调函数
        if (callback && typeof callback === 'function') {
            script.onload = callback;
        }
        
        // 添加到文档
        document.body.appendChild(script);
        
        return script;
    }
    
    // 延迟加载非关键资源
    function deferNonCriticalResources() {
        // 延迟加载的资源
        const deferredResources = [
            { type: 'script', url: 'components/trace-analytics.js' },
            { type: 'style', url: 'assets/styles/print.css', media: 'print' },
            { type: 'style', url: 'assets/styles/animations.css' }
        ];
        
        // 延迟执行，确保关键内容已加载
        window.addEventListener('load', () => {
            // 等待主要内容加载完毕后再加载非关键资源
            setTimeout(() => {
                deferredResources.forEach(resource => {
                    if (resource.type === 'script') {
                        loadScriptAsync(resource.url);
                    } else if (resource.type === 'style') {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = resource.url;
                        if (resource.media) {
                            link.media = resource.media;
                        }
                        document.head.appendChild(link);
                    }
                });
            }, 1000); // 延迟1秒加载
        });
    }
    
    // 代码分割：动态导入组件
    async function loadComponent(name) {
        // 检查缓存
        if (config.cacheEnabled && resourceCache[name]) {
            return resourceCache[name];
        }
        
        try {
            // 根据组件名构建路径
            const path = `components/trace-${name}.js`;
            
            // 动态导入
            const module = await import(path);
            
            // 缓存结果
            if (config.cacheEnabled) {
                resourceCache[name] = module;
            }
            
            return module;
        } catch (error) {
            console.error(`加载组件 ${name} 失败:`, error);
            throw error;
        }
    }
    
    // 动态加载HTML模板
    async function loadTemplate(templateName) {
        // 检查缓存
        const cacheKey = `template_${templateName}`;
        if (config.cacheEnabled && resourceCache[cacheKey]) {
            return resourceCache[cacheKey];
        }
        
        // 构建模板URL
        const templateUrl = `components/${templateName}.html`;
        
        try {
            const response = await fetch(templateUrl);
            if (!response.ok) {
                throw new Error(`模板加载失败: ${response.status} ${response.statusText}`);
            }
            
            const templateHtml = await response.text();
            
            // 缓存模板
            if (config.cacheEnabled) {
                resourceCache[cacheKey] = {
                    html: templateHtml,
                    timestamp: Date.now(),
                    expires: Date.now() + config.cacheExpiry
                };
            }
            
            return templateHtml;
        } catch (error) {
            console.error(`加载模板 ${templateName} 失败:`, error);
            throw error;
        }
    }
    
    // 清理缓存
    function cleanCache() {
        const now = Date.now();
        
        // 清理过期的缓存
        Object.keys(resourceCache).forEach(key => {
            const entry = resourceCache[key];
            if (entry && entry.expires && entry.expires < now) {
                delete resourceCache[key];
            }
        });
    }
    
    // 获取性能建议
    function getPerformanceSuggestions() {
        const suggestions = [];
        
        // 根据性能指标提供建议
        if (performanceMetrics.largestContentfulPaint > 2500) {
            suggestions.push({
                metric: 'LCP',
                value: performanceMetrics.largestContentfulPaint,
                suggestion: '最大内容绘制时间过长，考虑优化图片大小、使用CDN、或实现图片懒加载。'
            });
        }
        
        if (performanceMetrics.firstInputDelay > 100) {
            suggestions.push({
                metric: 'FID',
                value: performanceMetrics.firstInputDelay,
                suggestion: '首次输入延迟过高，检查主线程阻塞问题，考虑将长任务拆分或使用Web Worker。'
            });
        }
        
        if (performanceMetrics.cumulativeLayoutShift > 0.1) {
            suggestions.push({
                metric: 'CLS',
                value: performanceMetrics.cumulativeLayoutShift,
                suggestion: '累积布局偏移过大，为图片和广告元素设置明确的宽高，避免动态注入内容时导致布局变化。'
            });
        }
        
        if (performanceMetrics.resourceCount > 50) {
            suggestions.push({
                metric: '资源数',
                value: performanceMetrics.resourceCount,
                suggestion: '资源请求过多，考虑合并小文件、使用CSS Sprites、减少第三方脚本。'
            });
        }
        
        if (performanceMetrics.resourceSize > 3 * 1024 * 1024) {
            suggestions.push({
                metric: '资源大小',
                value: (performanceMetrics.resourceSize / (1024 * 1024)).toFixed(2) + 'MB',
                suggestion: '页面资源总大小过大，优化图片大小、启用文本压缩、实现代码分割。'
            });
        }
        
        if (performanceMetrics.memoryUsage && performanceMetrics.memoryUsage.usedJSHeapSize > 0.7 * performanceMetrics.memoryUsage.jsHeapSizeLimit) {
            suggestions.push({
                metric: '内存使用',
                value: (performanceMetrics.memoryUsage.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
                suggestion: 'JavaScript内存使用接近限制，检查内存泄漏问题，清理不需要的DOM引用。'
            });
        }
        
        return suggestions;
    }
    
    // 初始化时启动懒加载
    window.addEventListener('DOMContentLoaded', () => {
        if (config.enabled && config.lazyLoadEnabled) {
            lazyLoadImages();
            deferNonCriticalResources();
        }
    });
    
    // 定期清理缓存
    if (config.cacheEnabled) {
        setInterval(cleanCache, 300000); // 每5分钟
    }
    
    // 返回公共API
    return {
        init,
        getMetrics: function() {
            return { ...performanceMetrics };
        },
        getConnectionInfo: function() {
            return { ...connectionInfo };
        },
        lazyLoadImages,
        prefetchResources,
        loadComponent,
        loadTemplate,
        loadScriptAsync,
        getPerformanceSuggestions,
        getConfig: function() {
            return { ...config };
        },
        setConfig: function(newConfig) {
            Object.assign(config, newConfig);
            return { ...config };
        },
        clearCache: function() {
            Object.keys(resourceCache).forEach(key => {
                delete resourceCache[key];
            });
            console.log('资源缓存已清空');
        }
    };
})();

// 导出全局对象
window.TracePerformance = TracePerformance; 