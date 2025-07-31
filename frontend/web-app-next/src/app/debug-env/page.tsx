'use client';

import { useEffect, useState } from 'react';

export default function DebugEnvPage() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    // 收集所有相关的环境变量
    const vars = {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'undefined',
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'undefined',
      NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API || 'undefined',
      NEXT_PUBLIC_ENABLE_REAL_API: process.env.NEXT_PUBLIC_ENABLE_REAL_API || 'undefined',
      NEXT_PUBLIC_MOCK_ENABLED: process.env.NEXT_PUBLIC_MOCK_ENABLED || 'undefined',
      NEXT_PUBLIC_DEFAULT_FACTORY_ID: process.env.NEXT_PUBLIC_DEFAULT_FACTORY_ID || 'undefined',
    };
    setEnvVars(vars);
  }, []);

  const testApiConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch('http://localhost:3001/health');
      const data = await response.text();
      console.log('Health check response:', data);
      alert(`Health check successful: ${data}`);
    } catch (error) {
      console.error('Health check failed:', error);
      alert(`Health check failed: ${error.message}`);
    }
  };

  const testApiLogin = async () => {
    try {
      console.log('Testing API login...');
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'factory_admin',
          password: 'SuperAdmin@123',
          factoryId: 'TEST_2024_001'
        })
      });
      const data = await response.json();
      console.log('Login response:', data);
      alert(`Login test result: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Login test failed:', error);
      alert(`Login test failed: ${error.message}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">环境变量调试页面</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">环境变量</h2>
        <div className="bg-gray-100 p-4 rounded">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="mb-2">
              <span className="font-mono font-bold">{key}:</span> 
              <span className="font-mono ml-2 text-blue-600">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">API 连接测试</h2>
        <div className="space-x-4">
          <button 
            onClick={testApiConnection}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            测试健康检查
          </button>
          <button 
            onClick={testApiLogin}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            测试登录API
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">当前URL信息</h2>
        <div className="bg-gray-100 p-4 rounded">
          <div><strong>Host:</strong> {typeof window !== 'undefined' ? window.location.host : 'N/A'}</div>
          <div><strong>Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</div>
          <div><strong>Protocol:</strong> {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}