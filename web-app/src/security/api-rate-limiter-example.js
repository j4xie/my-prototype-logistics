/**
 * @file API限速器使用示例
 * @description 展示API限速器、节流和防抖功能的实际应用
 * @version 1.0.0
 * @created 2025-07-22
 */

const { 
  limitApiRequest, 
  throttle, 
  debounce, 
  clearAllLimiters 
} = require('./api-rate-limiter');

/**
 * 基本限速示例
 * 展示如何使用limitApiRequest函数限制API请求
 */
function basicRateLimitingExample() {
  console.log('开始基本限速示例...');
  
  const endpoint = '/api/data';
  const userId = 'user-123';
  
  // 模拟10次快速API请求
  for (let i = 0; i < 10; i++) {
    const result = limitApiRequest(endpoint, userId, {
      maxRequests: 5,            // 5秒内最多5个请求
      timeWindowMs: 5000,
      tokensPerInterval: 1,      // 每秒恢复1个令牌
      intervalMs: 1000
    });
    
    if (result.allowed) {
      console.log(`请求 #${i+1} 被允许 - 剩余: ${result.remaining}, 重置时间: ${result.resetTime}ms后`);
      // 这里可以执行实际的API请求
      // fetch(endpoint).then(...)
    } else {
      console.log(`请求 #${i+1} 被拒绝 - 重置时间: ${result.resetTime}ms后`);
      // 向用户显示限速信息
      // showRateLimitMessage(`请等待 ${Math.ceil(result.resetTime/1000)} 秒后再试`);
    }
  }
}

/**
 * 不同端点、不同用户的限速示例
 * 展示如何为不同端点和用户设置不同的限速规则
 */
function multiEndpointRateLimitingExample() {
  console.log('\n开始多端点限速示例...');
  
  const endpoints = ['/api/read', '/api/write', '/api/admin'];
  const users = ['regular-user', 'premium-user', 'admin-user'];
  
  // 为不同端点和用户类型定义不同的限速规则
  const limitConfigs = {
    '/api/read': {
      'regular-user': { maxRequests: 10, timeWindowMs: 10000 },
      'premium-user': { maxRequests: 20, timeWindowMs: 10000 },
      'admin-user': { maxRequests: 50, timeWindowMs: 10000 }
    },
    '/api/write': {
      'regular-user': { maxRequests: 5, timeWindowMs: 10000 },
      'premium-user': { maxRequests: 10, timeWindowMs: 10000 },
      'admin-user': { maxRequests: 20, timeWindowMs: 10000 }
    },
    '/api/admin': {
      'regular-user': { maxRequests: 0, timeWindowMs: 10000 }, // 无访问权限
      'premium-user': { maxRequests: 2, timeWindowMs: 10000 },
      'admin-user': { maxRequests: 15, timeWindowMs: 10000 }
    }
  };
  
  // 模拟不同用户访问不同端点
  endpoints.forEach(endpoint => {
    users.forEach(user => {
      const config = limitConfigs[endpoint][user];
      const result = limitApiRequest(endpoint, user, config);
      
      console.log(`用户: ${user}, 端点: ${endpoint} - 请求${result.allowed ? '允许' : '拒绝'}, 限制: ${result.limit}, 剩余: ${result.remaining}`);
    });
  });
}

/**
 * 按IP地址限速示例
 * 展示如何基于IP地址进行限速
 */
function ipBasedRateLimitingExample() {
  console.log('\n开始IP限速示例...');
  
  // 模拟多个IP地址
  const ipAddresses = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
  const endpoint = '/api/public';
  
  // 对于公共API，对所有IP地址进行限速
  ipAddresses.forEach(ip => {
    // 模拟每个IP快速发出多个请求
    for (let i = 0; i < 3; i++) {
      const result = limitApiRequest(endpoint, ip, {
        maxRequests: 2,        // 每10秒最多2个请求
        timeWindowMs: 10000
      });
      
      console.log(`IP: ${ip}, 请求 #${i+1} - ${result.allowed ? '允许' : '拒绝'}, 剩余: ${result.remaining}`);
    }
  });
}

/**
 * API节流示例
 * 展示如何使用throttle函数限制高频API调用
 */
function apiThrottlingExample() {
  console.log('\n开始API节流示例...');
  
  // 模拟API调用函数
  const fetchData = (query) => {
    console.log(`执行API调用: ${query} 在 ${new Date().toISOString()}`);
    // 实际API调用将在这里
    // return fetch(`/api/search?q=${query}`)
  };
  
  // 创建节流版本的API调用函数 - 每2秒最多执行一次
  const throttledFetchData = throttle(fetchData, 2000);
  
  // 模拟用户快速输入搜索查询
  console.log('模拟用户快速输入多个搜索查询:');
  
  // 立即调用一次 - 应该立即执行
  throttledFetchData('query-1');
  
  // 100ms后调用 - 应该被节流
  setTimeout(() => throttledFetchData('query-2'), 100);
  
  // 1000ms后调用 - 应该被节流
  setTimeout(() => throttledFetchData('query-3'), 1000);
  
  // 2100ms后调用 - 应该执行(2000ms节流期已过)
  setTimeout(() => throttledFetchData('query-4'), 2100);
  
  // 2200ms后调用 - 应该被节流
  setTimeout(() => throttledFetchData('query-5'), 2200);
  
  console.log('查看控制台输出，应该只有query-1和query-4被执行');
}

/**
 * 表单提交防抖示例
 * 展示如何使用debounce函数防止表单重复提交
 */
function formSubmitDebouncingExample() {
  console.log('\n开始表单提交防抖示例...');
  
  // 模拟表单提交函数
  const submitForm = (formData) => {
    console.log(`表单提交: ${JSON.stringify(formData)} 在 ${new Date().toISOString()}`);
    // 实际表单提交将在这里
    // return fetch('/api/submit', { method: 'POST', body: JSON.stringify(formData) })
  };
  
  // 创建防抖版本的表单提交函数 - 最后一次操作1000ms后才执行
  const debouncedSubmit = debounce(submitForm, 1000);
  
  // 模拟用户快速多次点击提交按钮
  console.log('模拟用户快速点击提交按钮多次:');
  
  const formData = { name: '张三', email: 'zhangsan@example.com' };
  
  // 模拟多次快速点击
  debouncedSubmit(formData);
  
  setTimeout(() => debouncedSubmit(formData), 200);
  setTimeout(() => debouncedSubmit(formData), 400);
  setTimeout(() => debouncedSubmit(formData), 600);
  
  console.log('查看控制台输出，表单应该只提交一次，在最后一次点击后1000ms');
}

/**
 * 窗口调整大小防抖示例
 * 展示如何使用debounce函数处理窗口调整大小事件
 */
function windowResizeDebouncingExample() {
  console.log('\n开始窗口调整大小防抖示例...');
  
  // 模拟处理窗口调整大小的函数
  const handleResize = () => {
    console.log(`处理窗口调整大小: ${window.innerWidth}x${window.innerHeight} 在 ${new Date().toISOString()}`);
    // 实际处理逻辑将在这里
    // updateLayout();
  };
  
  // 创建防抖版本的处理函数 - 调整停止300ms后执行
  const debouncedHandleResize = debounce(handleResize, 300);
  
  // 在浏览器环境中使用
  if (typeof window !== 'undefined') {
    // 添加事件监听器
    window.addEventListener('resize', debouncedHandleResize);
    
    console.log('已添加窗口调整大小事件监听器。尝试调整浏览器窗口大小，处理函数将在调整停止300ms后执行');
    
    // 注意：实际使用时，应该也提供一个清理函数
    // 例如：return () => window.removeEventListener('resize', debouncedHandleResize);
  } else {
    console.log('此示例需要在浏览器环境中运行');
  }
}

/**
 * 搜索输入防抖示例
 * 展示如何使用debounce函数处理搜索输入
 */
function searchInputDebouncingExample() {
  console.log('\n开始搜索输入防抖示例...');
  
  // 模拟搜索API调用
  const searchAPI = (query) => {
    console.log(`执行搜索: "${query}" 在 ${new Date().toISOString()}`);
    // 实际API调用将在这里
    // return fetch(`/api/search?q=${query}`).then(res => res.json());
  };
  
  // 创建防抖版本的搜索函数 - 用户停止输入500ms后执行
  const debouncedSearch = debounce(searchAPI, 500);
  
  // 模拟用户输入搜索查询
  console.log('模拟用户输入搜索查询:');
  
  // 用户输入"a"
  debouncedSearch('a');
  
  // 100ms后，用户输入"ap"
  setTimeout(() => debouncedSearch('ap'), 100);
  
  // 200ms后，用户输入"app"
  setTimeout(() => debouncedSearch('app'), 200);
  
  // 300ms后，用户输入"appl"
  setTimeout(() => debouncedSearch('appl'), 300);
  
  // 400ms后，用户输入"apple"
  setTimeout(() => debouncedSearch('apple'), 400);
  
  console.log('查看控制台输出，搜索应该只执行一次，查询词为"apple"');
}

// 导出所有示例函数
module.exports = {
  basicRateLimitingExample,
  multiEndpointRateLimitingExample,
  ipBasedRateLimitingExample,
  apiThrottlingExample,
  formSubmitDebouncingExample,
  windowResizeDebouncingExample,
  searchInputDebouncingExample,
  
  // 运行所有示例的便捷函数
  runAllExamples: function() {
    basicRateLimitingExample();
    multiEndpointRateLimitingExample();
    ipBasedRateLimitingExample();
    apiThrottlingExample();
    formSubmitDebouncingExample();
    windowResizeDebouncingExample();
    searchInputDebouncingExample();
    
    // 最后清除所有限速器
    setTimeout(() => {
      console.log('\n清除所有限速器');
      clearAllLimiters();
    }, 3000);
  }
}; 