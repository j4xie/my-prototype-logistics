# 调试工具替代方案

这是一个简单的JavaScript调试工具包，可以作为BrowserTools MCP的替代方案。这些工具提供基本的调试功能，如日志记录、性能监控和错误跟踪。

## 文件说明

- `debug.js` - 主调试工具脚本，提供增强的控制台日志、错误捕获和调试面板
- `debug-test.html` - 测试页面，展示如何使用调试工具

## 使用方法

1. 在您的HTML页面中引入调试脚本：

```html
<script src="path/to/debug.js"></script>
```

2. 使用增强的控制台方法（自动添加时间戳和保存错误日志）：

```javascript
console.log("普通日志消息");
console.error("错误消息");
console.warn("警告消息");
console.info("信息消息");
```

3. 使用调试工具API：

```javascript
// 显示调试面板
window.showDebugPanel();

// 获取性能数据
var perfData = window.debugTools.getPerformanceData();

// 访问和管理错误日志
var errorLogs = window.debugTools.getErrorLogs();
window.debugTools.clearErrorLogs();
```

## 功能特点

- **增强的控制台日志**：为所有日志添加时间戳
- **错误捕获**：自动捕获全局JavaScript错误和未处理的Promise拒绝
- **错误存储**：将错误日志保存到localStorage中
- **性能监控**：收集和显示页面加载性能数据
- **调试面板**：提供一个简单的浮动调试面板，显示性能信息

## 替代Chrome DevTools

您也可以使用Chrome的内置DevTools作为更强大的替代方案：

1. 在Chrome中按F12或右键点击页面并选择"检查"
2. 使用Elements标签检查DOM元素
3. 使用Console标签查看日志和执行命令
4. 使用Network标签分析网络请求
5. 使用Performance标签分析性能

## 远程调试

要远程调试Chrome，请按照以下步骤操作：

1. 启动Chrome时添加远程调试标志：
   ```
   chrome.exe --remote-debugging-port=9222
   ```

2. 在另一台计算机的Chrome中访问：
   ```
   http://[调试主机的IP]:9222
   ```

3. 点击要调试的页面链接，开始远程调试会话 