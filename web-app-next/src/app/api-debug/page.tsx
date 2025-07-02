'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ApiDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // 测试1：最简参数格式
  const testBasicFormat = async () => {
    addLog('=== 测试1：最简参数格式 ===');
    setLoading(true);
    
    try {
      const testData = {
        username: 'testuser001',
        password: 'test123456',
        email: 'test@example.com'
      };
      
      addLog(`发送数据: ${JSON.stringify(testData, null, 2)}`);
      
      const response = await fetch('/api/proxy/auth/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const responseText = await response.text();
      addLog(`响应状态: ${response.status}`);
      addLog(`响应数据: ${responseText}`);
      
    } catch (error) {
      addLog(`错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 测试2：完整参数格式
  const testFullFormat = async () => {
    addLog('=== 测试2：完整参数格式 ===');
    setLoading(true);
    
    try {
      const testData = {
        username: 'testuser002',
        password: 'test123456',
        email: 'test002@example.com',
        role: 'user',
        permissions: 'basic',
        last_login: null,
        is_active: true,
        phone: '13800138002',
        department: 'test_dept',
        position: '测试员'
      };
      
      addLog(`发送数据: ${JSON.stringify(testData, null, 2)}`);
      
      const response = await fetch('/api/proxy/auth/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const responseText = await response.text();
      addLog(`响应状态: ${response.status}`);
      addLog(`响应数据: ${responseText}`);
      
    } catch (error) {
      addLog(`错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 测试3：数组参数格式（按照SQL INSERT顺序）
  const testArrayFormat = async () => {
    addLog('=== 测试3：数组参数格式 ===');
    setLoading(true);
    
    try {
      // 按照SQL INSERT顺序：username, password, email, role, permissions, last_login, is_active, phone, department, position
      const testData = [
        'testuser003',          // username
        'test123456',           // password
        'test003@example.com',  // email
        'user',                 // role
        'basic',                // permissions
        null,                   // last_login
        true,                   // is_active
        '13800138003',          // phone
        'test_dept',            // department
        '测试员003'              // position
      ];
      
      addLog(`发送数据: ${JSON.stringify(testData, null, 2)}`);
      
      const response = await fetch('/api/proxy/auth/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const responseText = await response.text();
      addLog(`响应状态: ${response.status}`);
      addLog(`响应数据: ${responseText}`);
      
    } catch (error) {
      addLog(`错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 测试4：测试现有用户登录
  const testLogin = async () => {
    addLog('=== 测试4：登录现有用户 ===');
    setLoading(true);
    
    try {
      const testData = {
        username: 'admin',  // 你说后端已经有的用户
        password: '123456'  // 假设的密码
      };
      
      addLog(`发送登录数据: ${JSON.stringify(testData, null, 2)}`);
      
      const response = await fetch('/api/proxy/auth/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const responseText = await response.text();
      addLog(`登录响应状态: ${response.status}`);
      addLog(`登录响应数据: ${responseText}`);
      
    } catch (error) {
      addLog(`登录错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 测试5：直接调用真实API（不通过代理）
  const testDirectAPI = async () => {
    addLog('=== 测试5：直接调用真实API ===');
    setLoading(true);
    
    try {
      const testData = {
        username: 'testuser005',
        password: 'test123456',
        email: 'test005@example.com'
      };
      
      addLog(`直接发送到 http://47.251.121.76:10010/users/register`);
      addLog(`发送数据: ${JSON.stringify(testData, null, 2)}`);
      
      const response = await fetch('http://47.251.121.76:10010/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      const responseText = await response.text();
      addLog(`直接API响应状态: ${response.status}`);
      addLog(`直接API响应数据: ${responseText}`);
      
    } catch (error) {
      addLog(`直接API错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto p-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">API 调试工具</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Button onClick={testBasicFormat} disabled={loading}>
            测试1：最简格式
          </Button>
          <Button onClick={testFullFormat} disabled={loading}>
            测试2：完整格式
          </Button>
          <Button onClick={testArrayFormat} disabled={loading}>
            测试3：数组格式
          </Button>
          <Button onClick={testLogin} disabled={loading}>
            测试4：登录测试
          </Button>
          <Button onClick={testDirectAPI} disabled={loading}>
            测试5：直接API
          </Button>
          <Button onClick={clearLogs} variant="ghost">
            清空日志
          </Button>
        </div>

        {loading && (
          <div className="text-center mb-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">测试中...</span>
          </div>
        )}

        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">调试日志：</h3>
          <div className="max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">点击测试按钮开始调试...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-sm font-mono mb-1 whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
} 