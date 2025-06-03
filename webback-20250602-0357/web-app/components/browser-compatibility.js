
// 浏览器环境兼容性脚本
(function() {
  // 处理process对象
  if (typeof process === 'undefined') {
    window.process = {
      env: {
        NODE_ENV: 'production'
      }
    };
  }
  
  // 处理其他可能缺失的Node.js对象
  if (typeof global === 'undefined') {
    window.global = window;
  }
  
  console.log('浏览器兼容性补丁已应用');
})();
