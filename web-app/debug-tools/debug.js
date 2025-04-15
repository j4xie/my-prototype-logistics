// 调试工具脚本 - 替代BrowserTools MCP
(function() {
  // 保存原始console方法
  var originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };
  
  // 添加时间戳和额外信息的包装函数
  function enhancedLog(type, args) {
    var timestamp = new Date().toISOString();
    var prefix = "[" + timestamp + "] [" + type + "]";
    
    // 发送到原始控制台
    originalConsole[type].apply(console, [prefix].concat(Array.prototype.slice.call(args)));
    
    // 将日志保存到本地存储
    try {
      if (type === "error") {
        var logs = JSON.parse(localStorage.getItem("debug_error_logs") || "[]");
        logs.push({
          timestamp: timestamp,
          message: Array.prototype.slice.call(args).map(function(arg) {
            return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
          }).join(" "),
          url: window.location.href,
          userAgent: navigator.userAgent
        });
        // 限制存储的日志数量
        if (logs.length > 100) logs.shift();
        localStorage.setItem("debug_error_logs", JSON.stringify(logs));
      }
    } catch (e) {
      originalConsole.error("Error saving logs:", e);
    }
  }
  
  // 重写console方法
  console.log = function() { enhancedLog("log", arguments); };
  console.error = function() { enhancedLog("error", arguments); };
  console.warn = function() { enhancedLog("warn", arguments); };
  console.info = function() { enhancedLog("info", arguments); };
  
  // 添加全局错误捕获
  window.addEventListener("error", function(event) {
    console.error("全局错误:", event.message, "at", event.filename, ":", event.lineno, ":", event.colno);
    return false;
  });
  
  // 添加Promise错误捕获
  window.addEventListener("unhandledrejection", function(event) {
    console.error("未处理的Promise拒绝:", event.reason);
  });
  
  // 添加一个全局调试对象
  window.debugTools = {
    // 获取所有存储的错误日志
    getErrorLogs: function() {
      return JSON.parse(localStorage.getItem("debug_error_logs") || "[]");
    },
    
    // 清除错误日志
    clearErrorLogs: function() {
      localStorage.removeItem("debug_error_logs");
      console.log("错误日志已清除");
    },
    
    // 获取性能数据
    getPerformanceData: function() {
      if (!window.performance) {
        return "Performance API不支持";
      }
      
      var timing = performance.timing;
      var navigationStart = timing.navigationStart;
      
      return {
        "页面加载时间": timing.loadEventEnd - navigationStart + "ms",
        "DOM准备时间": timing.domComplete - timing.domLoading + "ms",
        "DNS解析时间": timing.domainLookupEnd - timing.domainLookupStart + "ms",
        "TCP连接时间": timing.connectEnd - timing.connectStart + "ms",
        "请求响应时间": timing.responseEnd - timing.requestStart + "ms",
        "白屏时间": timing.responseStart - navigationStart + "ms",
        "DOM交互时间": timing.domInteractive - navigationStart + "ms",
        "资源数": performance.getEntriesByType("resource").length
      };
    },
    
    // 显示调试面板
    showDebugPanel: function() {
      var panel = document.createElement("div");
      panel.id = "debug-panel";
      panel.style.cssText = "position:fixed;bottom:0;right:0;width:300px;height:200px;background:rgba(0,0,0,0.8);color:white;padding:10px;font-family:monospace;z-index:10000;overflow:auto;";
      
      var header = document.createElement("div");
      header.textContent = "调试面板";
      header.style.cssText = "font-weight:bold;margin-bottom:10px;cursor:move;";
      panel.appendChild(header);
      
      var closeBtn = document.createElement("button");
      closeBtn.textContent = "X";
      closeBtn.style.cssText = "position:absolute;top:5px;right:5px;cursor:pointer;";
      closeBtn.onclick = function() {
        document.body.removeChild(panel);
      };
      panel.appendChild(closeBtn);
      
      var content = document.createElement("div");
      var perfData = this.getPerformanceData();
      var perfHtml = "<b>性能信息:</b><br>";
      
      for (var key in perfData) {
        perfHtml += key + ": " + perfData[key] + "<br>";
      }
      
      content.innerHTML = perfHtml;
      panel.appendChild(content);
      
      document.body.appendChild(panel);
      
      return panel;
    },
    
    // 截屏替代功能
    captureScreen: function() {
      alert("截屏功能在自定义调试工具中不可用。请使用浏览器的开发者工具。");
    }
  };
  
  // 导出一个全局函数来快速显示调试面板
  window.showDebugPanel = function() {
    return window.debugTools.showDebugPanel();
  };
  
  console.info("调试工具已加载。使用window.debugTools访问功能或window.showDebugPanel()显示调试面板。");
})(); 