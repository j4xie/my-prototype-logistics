/**
 * mockFetch帮手
 * 将请求转发到本地mock服务器
 */

/**
 * 模拟fetch实现，将请求转发到本地mock服务器
 * @param {string} url - 原始请求URL
 * @param {Object} opts - fetch选项
 * @returns {Promise<Response>} - 模拟响应
 */
function mockFetch(url, opts = {}) {
  // 获取环境变量端口，默认9090
  const mockPort = process.env.MOCK_PORT || 9090;
  
  // 解析原始URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    // 如果不是完整URL，则假设为相对路径
    parsedUrl = new URL(url, `http://example.com`);
  }
  
  // 构建mock服务器URL
  const mockUrl = `http://localhost:${mockPort}${parsedUrl.pathname}${parsedUrl.search}`;
  
  console.log(`[MockFetch] 转发请求: ${url} -> ${mockUrl}`);
  
  // 调用真实的fetch转发到mock服务器
  return fetch(mockUrl, opts)
    .then(response => {
      // 构建新的Response对象，保留原始响应的状态和头信息
      return response.blob().then(blob => {
        const mockResponse = new Response(blob, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        
        // 添加一个标记，表明这是mock响应
        Object.defineProperty(mockResponse, 'isMockResponse', {
          value: true,
          writable: false
        });
        
        return mockResponse;
      });
    })
    .catch(error => {
      console.error(`[MockFetch] 请求失败: ${mockUrl}`, error);
      throw new Error(`Mock请求失败: ${error.message}`);
    });
}

module.exports = mockFetch; 