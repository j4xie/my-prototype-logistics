'use client';

import React, { useState } from 'react';
import { authService } from '@/services/auth.service';

export default function ApiDebugPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [mockStatus, setMockStatus] = useState<any>(null);

  const testLogin = async () => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('[调试] 开始测试登录...');
      console.log('[调试] 当前环境:', authService.getEnvironment());
      
      const response = await authService.login({
        username: 'admin',
        password: 'admin123'
      });
      
      console.log('[调试] 登录响应:', response);
      setResult(response);
    } catch (err: any) {
      console.error('[调试] 登录失败:', err);
      setError(err.message || '登录失败');
      
      // 显示更详细的错误信息
      if (err.response) {
        console.error('[调试] 错误响应:', err.response);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const testRegister = async () => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('[调试] 开始测试注册...');
      const response = await authService.register({
        username: 'testuser',
        password: 'test123',
        email: '15857853221@qq.com',
        phone: '13331914881',
        department: '技术部',
        position: '开发工程师'
      });
      
      console.log('[调试] 注册响应:', response);
      setResult(response);
    } catch (err: any) {
      console.error('[调试] 注册失败:', err);
      setError(err.message || '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMockStatus = async () => {
    try {
      console.log('[调试] 检查Mock状态...');
      // 直接发送请求到Mock API端点
      const response = await fetch('/api/auth/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('[调试] Mock状态响应:', data);
      setMockStatus({ success: true, data });
    } catch (err: any) {
      console.error('[调试] Mock状态检查失败:', err);
      setMockStatus({ success: false, error: err.message });
    }
  };

  React.useEffect(() => {
    // 页面加载时检查Mock状态
    checkMockStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          API 调试工具
        </h1>
        
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              当前环境: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {authService.getEnvironment()}
              </span>
              {typeof window !== 'undefined' && (
                <button
                  onClick={() => window.location.href = '?mock=false'}
                  className="ml-2 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  切换到真实API
                </button>
              )}
            </div>
            <div>
              MSW状态: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {typeof window !== 'undefined' && window.navigator?.serviceWorker ? 
                  (window.navigator.serviceWorker.controller ? '已激活' : '未激活') : 
                  '不支持'}
              </span>
            </div>
            <div>
              当前URL: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                {typeof window !== 'undefined' ? window.location.origin : 'SSR'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={testLogin}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试登录'}
            </button>

            <button
              onClick={testRegister}
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试注册'}
            </button>

            <button
              onClick={checkMockStatus}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
            >
              检查Mock状态
            </button>
          </div>

          {mockStatus && (
            <div className={`p-4 border rounded-lg ${mockStatus.success ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <h3 className={`font-medium mb-2 ${mockStatus.success ? 'text-blue-800' : 'text-orange-800'}`}>
                Mock API状态:
              </h3>
              <pre className={`text-sm overflow-auto ${mockStatus.success ? 'text-blue-700 bg-blue-100' : 'text-orange-700 bg-orange-100'} p-3 rounded`}>
                {JSON.stringify(mockStatus, null, 2)}
              </pre>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">错误信息:</h3>
              <p className="text-red-700 text-sm break-words">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">成功响应:</h3>
              <pre className="text-green-700 text-sm bg-green-100 p-3 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 