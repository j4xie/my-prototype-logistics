'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Badge from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { authService } from '@/services/auth.service';
import { realApiClient } from '@/lib/real-api-client';
import { CheckCircle, XCircle, Code, Database, Send, User } from 'lucide-react';

/**
 * 真实API集成测试页面
 * 用于测试与后端API的连接和认证
 */
export default function RealApiTestPage() {
  const [testResults, setTestResults] = useState<Array<{
    name: string;
    status: 'success' | 'error' | 'pending';
    message: string;
    response?: any;
  }>>([]);
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    factoryId: 'TEST_2024_001'
  });
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    email: '',
    phone: '',
    name: '',
    factoryId: 'TEST_2024_001'
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const addResult = (name: string, status: 'success' | 'error' | 'pending', message: string, response?: any) => {
    setTestResults(prev => [...prev, { name, status, message, response }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // 测试API连接
  const testConnection = async () => {
    setLoading(true);
    setSelectedTest('connection');
    
    try {
      addResult('API连接测试', 'pending', '正在测试后端API连接...');
      
      // 测试基本连接
      const response = await realApiClient.get('/api/auth/status');
      
      addResult('API连接测试', 'success', '后端API连接成功', response);
    } catch (error) {
      addResult('API连接测试', 'error', `连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  // 测试手机号验证
  const testPhoneVerification = async () => {
    if (!phoneNumber) {
      addResult('手机号验证', 'error', '请输入手机号');
      return;
    }
    
    setLoading(true);
    setSelectedTest('phone');
    
    try {
      addResult('手机号验证', 'pending', `正在验证手机号: ${phoneNumber}...`);
      
      const response = await authService.verifyPhone(phoneNumber, credentials.factoryId);
      
      addResult('手机号验证', 'success', response.message || '手机号验证成功', response);
    } catch (error) {
      addResult('手机号验证', 'error', `验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  // 测试用户注册
  const testRegistration = async () => {
    if (!registerData.username || !registerData.password || !registerData.email) {
      addResult('用户注册', 'error', '请填写完整的注册信息');
      return;
    }
    
    setLoading(true);
    setSelectedTest('register');
    
    try {
      addResult('用户注册', 'pending', `正在注册用户: ${registerData.username}...`);
      
      const response = await authService.register(registerData);
      
      addResult('用户注册', 'success', response.message || '用户注册成功', response);
    } catch (error) {
      addResult('用户注册', 'error', `注册失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  // 测试用户登录
  const testLogin = async () => {
    if (!credentials.username || !credentials.password) {
      addResult('用户登录', 'error', '请输入用户名和密码');
      return;
    }
    
    setLoading(true);
    setSelectedTest('login');
    
    try {
      addResult('用户登录', 'pending', `正在登录用户: ${credentials.username}...`);
      
      const response = await authService.login({
        username: credentials.username,
        password: credentials.password
      });
      
      addResult('用户登录', 'success', response.message || '登录成功', response);
    } catch (error) {
      addResult('用户登录', 'error', `登录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  // 测试用户资料获取
  const testUserProfile = async () => {
    setLoading(true);
    setSelectedTest('profile');
    
    try {
      addResult('用户资料', 'pending', '正在获取用户资料...');
      
      const response = await authService.getUserProfile();
      
      addResult('用户资料', 'success', '用户资料获取成功', response);
    } catch (error) {
      addResult('用户资料', 'error', `获取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  // 测试用户登出
  const testLogout = async () => {
    setLoading(true);
    setSelectedTest('logout');
    
    try {
      addResult('用户登出', 'pending', '正在登出...');
      
      await authService.logout();
      
      addResult('用户登出', 'success', '登出成功');
    } catch (error) {
      addResult('用户登出', 'error', `登出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setSelectedTest(null);
    }
  };

  const StatusIcon = ({ status }: { status: 'success' | 'error' | 'pending' }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const testButtons = [
    { key: 'connection', label: 'API连接测试', icon: Database, action: testConnection },
    { key: 'phone', label: '手机号验证', icon: Send, action: testPhoneVerification },
    { key: 'register', label: '用户注册', icon: User, action: testRegistration },
    { key: 'login', label: '用户登录', icon: User, action: testLogin },
    { key: 'profile', label: '用户资料', icon: User, action: testUserProfile },
    { key: 'logout', label: '用户登出', icon: User, action: testLogout },
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">真实API集成测试</h1>
        <p className="text-gray-600">测试与后端API的连接和认证功能</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 测试控制面板 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                连接测试
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testConnection}
                disabled={loading}
                className="w-full"
              >
                {selectedTest === 'connection' ? '测试中...' : '测试API连接'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                手机号验证
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="输入手机号"
                />
              </div>
              <Button 
                onClick={testPhoneVerification}
                disabled={loading}
                className="w-full"
              >
                {selectedTest === 'phone' ? '验证中...' : '验证手机号'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                用户注册
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="reg-username">用户名</Label>
                  <Input
                    id="reg-username"
                    value={registerData.username}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="用户名"
                  />
                </div>
                <div>
                  <Label htmlFor="reg-password">密码</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="密码"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reg-email">邮箱</Label>
                <Input
                  id="reg-email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="邮箱"
                />
              </div>
              <div>
                <Label htmlFor="reg-phone">手机号</Label>
                <Input
                  id="reg-phone"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="手机号"
                />
              </div>
              <Button 
                onClick={testRegistration}
                disabled={loading}
                className="w-full"
              >
                {selectedTest === 'register' ? '注册中...' : '注册用户'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                用户登录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="用户名"
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="密码"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={testLogin}
                  disabled={loading}
                  className="flex-1"
                >
                  {selectedTest === 'login' ? '登录中...' : '登录'}
                </Button>
                <Button 
                  onClick={testUserProfile}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {selectedTest === 'profile' ? '获取中...' : '获取资料'}
                </Button>
              </div>
              <Button 
                onClick={testLogout}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {selectedTest === 'logout' ? '登出中...' : '登出'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 测试结果 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  测试结果
                </div>
                <Button 
                  onClick={clearResults}
                  variant="outline"
                  size="sm"
                >
                  清除
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无测试结果</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusIcon status={result.status} />
                        <span className="font-medium">{result.name}</span>
                        <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                          {result.status === 'success' ? '成功' : result.status === 'error' ? '失败' : '处理中'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                      {result.response && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-blue-600">查看响应详情</summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}