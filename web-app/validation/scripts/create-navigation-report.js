const fs = require('fs');
const path = require('path');

// 读取JSON报告
const reportPath = path.join(__dirname, '../reports/navigation_report.json');
const outputPath = path.join(__dirname, '../reports/navigation_detailed_report.html');

console.log('正在生成导航详细报告...');
console.log(`读取报告: ${reportPath}`);

// 读取报告数据
const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// 生成HTML报告
const htmlReport = generateDetailedHtmlReport(reportData);

// 保存报告
fs.writeFileSync(outputPath, htmlReport);
console.log(`详细报告已保存至: ${outputPath}`);

/**
 * 生成详细HTML报告
 * @param {Object} report 报告数据
 * @returns {string} 详细HTML报告内容
 */
function generateDetailedHtmlReport(report) {
  const rows = report.results.map(result => `
    <tr class="${result.success ? 'bg-green-50' : 'bg-red-50'}">
      <td class="px-4 py-2 border">${result.name}</td>
      <td class="px-4 py-2 border"><a href="${result.url}" target="_blank" class="text-blue-600 hover:underline">${result.url}</a></td>
      <td class="px-4 py-2 border">${result.status}</td>
      <td class="px-4 py-2 border">${result.title || ''}</td>
      <td class="px-4 py-2 border">${result.success ? '✅ 成功' : '❌ 失败'}</td>
      <td class="px-4 py-2 border text-red-600">${result.errorMessage || ''}</td>
      <td class="px-4 py-2 border">
        ${result.screenshot ? `<img src="${result.screenshot.replace(/^.*[\\\/]/, '../reports/screenshots/')}" alt="${result.name} 页面截图" class="w-full max-w-md">` : ''}
      </td>
    </tr>
  `).join('');

  const errorDetails = report.results
    .filter(r => !r.success)
    .map(result => `
      <div class="bg-red-50 p-4 rounded-lg shadow-md mb-6">
        <h3 class="text-xl font-semibold text-red-700 mb-2">${result.name} (${result.url})</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-600 mb-1">状态码: <span class="font-medium">${result.status}</span></p>
            <p class="text-sm text-gray-600 mb-1">页面标题: <span class="font-medium">${result.title || '无标题'}</span></p>
            <p class="text-sm text-gray-600 mb-4">错误类型: <span class="font-medium text-red-600">${result.status >= 400 ? 'HTTP错误' : '未知错误'}</span></p>
            
            <div class="bg-white p-3 rounded border border-red-200 mb-4">
              <p class="text-sm font-medium text-red-700 mb-1">错误消息:</p>
              <p class="text-sm text-red-600">${result.errorMessage || '未检测到具体错误消息'}</p>
            </div>
          </div>
          
          <div>
            ${result.screenshot ? `
              <div class="border border-gray-200 rounded overflow-hidden shadow-sm">
                <p class="bg-gray-100 text-xs font-medium p-2 border-b">页面截图:</p>
                <img src="${result.screenshot.replace(/^.*[\\\/]/, '../reports/screenshots/')}" alt="${result.name} 页面截图" class="w-full">
              </div>
            ` : '<p class="text-sm text-gray-500">无截图</p>'}
          </div>
        </div>
        
        <div class="mt-4 flex space-x-2">
          <a href="${result.url}" target="_blank" class="text-sm text-blue-600 hover:underline">在新标签中打开</a>
          <a href="javascript:void(0)" onclick="copyToClipboard('${result.url}')" class="text-sm text-blue-600 hover:underline">复制URL</a>
        </div>
      </div>
    `).join('');

  // 计算统计信息
  const httpErrorCount = report.results.filter(r => r.status >= 400).length;

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>页面导航详细验证报告 - ${new Date(report.timestamp).toLocaleString()}</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script>
        function copyToClipboard(text) {
          navigator.clipboard.writeText(text).then(() => {
            alert('已复制到剪贴板');
          }).catch(err => {
            console.error('复制失败:', err);
          });
        }
      </script>
    </head>
    <body class="bg-gray-50 p-6">
      <div class="max-w-7xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">页面导航详细验证报告</h1>
          <div class="text-sm text-gray-500">
            报告生成时间: ${new Date(report.timestamp).toLocaleString()}
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 class="text-xl font-semibold mb-4">摘要</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 p-4 rounded">
              <div class="text-sm text-blue-600">总页面数</div>
              <div class="text-2xl font-bold">${report.totalPages}</div>
            </div>
            <div class="bg-green-50 p-4 rounded">
              <div class="text-sm text-green-600">成功页面</div>
              <div class="text-2xl font-bold">${report.successCount}</div>
            </div>
            <div class="bg-red-50 p-4 rounded">
              <div class="text-sm text-red-600">失败页面</div>
              <div class="text-2xl font-bold">${report.failCount}</div>
            </div>
            <div class="bg-yellow-50 p-4 rounded">
              <div class="text-sm text-yellow-600">HTTP错误</div>
              <div class="text-2xl font-bold">${httpErrorCount}</div>
            </div>
          </div>
          
          ${report.failCount > 0 ? `
            <div class="mt-6">
              <div class="bg-red-50 border-l-4 border-red-500 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-red-700">
                      检测到 ${report.failCount} 个页面导航问题。建议运行修复脚本:
                    </p>
                    <div class="mt-2 bg-gray-100 p-2 rounded font-mono text-sm overflow-x-auto">
                      npm run fix:page-transitions
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${report.failCount > 0 ? `
          <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-xl font-semibold mb-4">错误详情</h2>
            ${errorDetails}
          </div>
        ` : ''}
        
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4">所有页面结果</h2>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-gray-100">
                  <th class="px-4 py-2 border">页面名称</th>
                  <th class="px-4 py-2 border">URL</th>
                  <th class="px-4 py-2 border">状态码</th>
                  <th class="px-4 py-2 border">页面标题</th>
                  <th class="px-4 py-2 border">状态</th>
                  <th class="px-4 py-2 border">错误消息</th>
                  <th class="px-4 py-2 border">截图</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
} 