// 调试工具加载器
(function() {
    // 创建script标签
    var script = document.createElement('script');
    script.src = '/static/js/debug.js';
    script.async = true;
    script.onload = function() {
        console.info('调试工具已加载成功！使用window.showDebugPanel()显示调试面板。');
    };
    script.onerror = function() {
        console.error('调试工具加载失败，请检查路径是否正确。');
    };
    
    // 将script标签添加到文档中
    document.head.appendChild(script);
    
    // 添加快捷键支持
    document.addEventListener('keydown', function(event) {
        // Alt+D打开调试面板
        if (event.altKey && event.key === 'd') {
            if (window.showDebugPanel) {
                window.showDebugPanel();
            } else {
                console.warn('调试面板尚未加载，请稍候再试。');
            }
        }
    });
    
    console.info('调试加载器已初始化，按Alt+D打开调试面板。');
})(); 