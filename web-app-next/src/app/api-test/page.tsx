'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService, AuthApiError } from '@/services/auth.service';
import { getApiEnvironment } from '@/config/api-endpoints';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

export default function ApiTestPage() {
  // 登录状态
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    username: '',
    password: ''
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResult, setLoginResult] = useState<any>(null);
  const [loginError, setLoginError] = useState<string>('');

  // 注册状态
  const [registerForm, setRegisterForm] = useState<RegisterRequest>({
    username: '',
    password: '',
    email: '',
    confirmPassword: ''
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerResult, setRegisterResult] = useState<any>(null);
  const [registerError, setRegisterError] = useState<string>('');

  // 当前API环境
  const apiEnvironment = authService.getEnvironment();

  // 处理登录
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setLoginError('请填写用户名和密码');
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    setLoginResult(null);

    try {
      const response = await authService.login(loginForm);
      setLoginResult(response);
      console.log('登录成功:', response);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setLoginError(error.message);
      } else {
        setLoginError('登录失败');
      }
      console.error('登录失败:', error);
    } finally {
      setLoginLoading(false);
    }
  };

  // 处理注册
  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.password || !registerForm.email) {
      setRegisterError('请填写所有必填字段');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('密码确认不匹配');
      return;
    }

    setRegisterLoading(true);
    setRegisterError('');
    setRegisterResult(null);

    try {
      const response = await authService.register(registerForm);
      setRegisterResult(response);
      console.log('注册成功:', response);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setRegisterError(error.message);
      } else {
        setRegisterError('注册失败');
      }
      console.error('注册失败:', error);
    } finally {
      setRegisterLoading(false);
    }
  };

  // 测试环境切换
  const handleEnvironmentTest = () => {
    const currentUrl = new URL(window.location.href);
    const currentMock = currentUrl.searchParams.get('mock');
    
    if (currentMock === 'false') {
      currentUrl.searchParams.set('mock', 'true');
    } else {
      currentUrl.searchParams.set('mock', 'false');
    }
    
    window.location.href = currentUrl.toString();
  };

  return (
    <div className="max-w-[390px] mx-auto min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium">API 接口测试</h1>
            <div className="text-xs bg-white/20 rounded px-2 py-1">
              {apiEnvironment === 'real' ? '真实API' : 'Mock API'}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="pt-[80px] p-4 space-y-6">
        
        {/* 环境信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-center space-y-3">
            <h2 className="text-lg font-medium text-gray-900">API 环境状态</h2>
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${apiEnvironment === 'real' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
              <span className="text-sm text-gray-600">
                当前使用: {apiEnvironment === 'real' ? '真实API (47.251.121.76:10010)' : 'Mock API (本地)'}
              </span>
            </div>
            <Button 
              onClick={handleEnvironmentTest}
              className="w-full hover:shadow-md hover:scale-[1.03]"
              variant="secondary"
            >
              切换到 {apiEnvironment === 'real' ? 'Mock' : '真实'} API
            </Button>
          </div>
        </Card>

        {/* 登录测试卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">登录接口测试</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="login-username" className="text-sm font-medium text-gray-700">
                用户名
              </Label>
              <Input
                id="login-username"
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="请输入用户名"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                密码
              </Label>
              <Input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
                className="mt-1"
              />
            </div>

            {loginError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {loginError}
              </div>
            )}

            <Button 
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full hover:shadow-md hover:scale-[1.03]"
            >
              {loginLoading ? '登录中...' : '测试登录'}
            </Button>

            {loginResult && (
              <div className="text-xs bg-green-50 p-3 rounded border">
                <div className="font-medium text-green-800 mb-2">登录成功 ✅</div>
                <pre className="text-green-700 overflow-x-auto">
                  {JSON.stringify(loginResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* 注册测试卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">注册接口测试</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="register-username" className="text-sm font-medium text-gray-700">
                用户名
              </Label>
              <Input
                id="register-username"
                type="text"
                value={registerForm.username}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="请输入用户名"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">
                邮箱
              </Label>
              <Input
                id="register-email"
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="请输入邮箱"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">
                密码
              </Label>
              <Input
                id="register-password"
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="register-confirm-password" className="text-sm font-medium text-gray-700">
                确认密码
              </Label>
              <Input
                id="register-confirm-password"
                type="password"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="请再次输入密码"
                className="mt-1"
              />
            </div>

            {registerError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {registerError}
              </div>
            )}

            <Button 
              onClick={handleRegister}
              disabled={registerLoading}
              className="w-full hover:shadow-md hover:scale-[1.03]"
            >
              {registerLoading ? '注册中...' : '测试注册'}
            </Button>

            {registerResult && (
              <div className="text-xs bg-green-50 p-3 rounded border">
                <div className="font-medium text-green-800 mb-2">注册成功 ✅</div>
                <pre className="text-green-700 overflow-x-auto">
                  {JSON.stringify(registerResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* 测试建议卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">测试建议</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500">•</span>
              <span>可以先测试注册功能创建新用户</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500">•</span>
              <span>然后使用注册的用户名和密码测试登录</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500">•</span>
              <span>可以切换API环境对比Mock和真实API的响应</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500">•</span>
              <span>查看浏览器控制台获取更详细的日志信息</span>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
} 