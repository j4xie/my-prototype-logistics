'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { authService, AuthApiError } from '@/services/auth.service';
import type { LoginRequest } from '@/types/auth';

interface LoginForm {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    role: string;
    name: string;
  };
  message?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginForm>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Partial<LoginForm> = {};

    if (!form.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (form.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    }

    if (!form.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (form.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      alert('请检查输入信息');
      return;
    }

    setLoading(true);

    try {
      // 使用新的认证服务（支持真实API）
      const credentials: LoginRequest = {
        username: form.username,
        password: form.password
      };

      console.log('发送登录请求:', credentials);
      console.log('当前认证服务环境:', authService.getEnvironment());

      const response = await authService.login(credentials);
      
      console.log('登录响应:', response);

      // 处理响应格式
      let userData;
      let authToken;
      
      // 检测API响应格式并适配
      if (response.state === 200 && response.data) {
        // 真实API响应格式: { state: 200, data: { uid, username, ... } }
        userData = response.data;
        // 生成本地token（真实API没有返回token）
        authToken = `real_api_${userData.uid}_${Date.now()}`;
      } else {
        // Mock API响应格式
        const data = response.data || response;
        authToken = data.token || response.token;
        userData = data.user || response.user || data;
      }

      if (userData && userData.username) {
        // 存储用户信息和token
        localStorage.setItem('auth_token', authToken);
        localStorage.setItem('user_info', JSON.stringify(userData));
        localStorage.setItem('login_time', new Date().toISOString());

        const userName = userData.name || userData.username;
        console.log('登录成功，用户数据:', userData);
        alert(`登录成功！欢迎回来，${userName}！`);

        // 根据用户角色跳转到相应页面
        const userRole = userData.role || userData.position;
        if (userRole === 'admin' || userRole === '系统管理员' || userData.isAdmin) {
          console.log('跳转到管理员页面...');
          router.push('/admin/dashboard');
        } else {
          console.log('跳转到用户首页...');
          router.push('/farming');
        }
      } else {
        const errorMsg = response.message || response.data?.message || "登录失败，请检查用户名和密码";
        console.error('登录失败，响应数据:', response);
        alert(errorMsg);
      }
    } catch (error) {
      console.error('登录错误:', error);
      
      if (error instanceof AuthApiError) {
        // 显示更详细的错误信息
        const errorMsg = error.code === 'USER_NOT_FOUND' 
          ? `用户不存在：请检查用户名是否正确，或确认当前使用的是真实API (环境: ${authService.getEnvironment()})`
          : error.message;
        alert(errorMsg);
      } else {
        alert("网络连接错误，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (field: keyof LoginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };



  if (!mounted) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1677FF] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-leaf text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-[#00467F] mb-2">
            食品溯源系统
          </h1>
          <p className="text-gray-600 text-sm">
            安全可信的食品溯源管理平台
          </p>
        </div>

        {/* 登录表单 */}
        <Card className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名
              </label>
              <Input
                type="text"
                value={form.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="请输入用户名"
                className={`w-full h-12 ${errors.username ? 'border-red-500' : ''}`}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="请输入密码"
                className={`w-full h-12 ${errors.password ? 'border-red-500' : ''}`}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#1677FF] hover:bg-[#4096FF] text-white font-medium rounded-lg transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loading className="w-4 h-4 mr-2" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>



          {/* 其他操作链接 */}
          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              className="text-[#1677FF] text-sm hover:underline"
              onClick={() => router.push('/register')}
            >
              还没有账号？立即注册
            </button>
            <br />
            <button
              type="button"
              className="text-gray-500 text-sm hover:underline"
              onClick={() => router.push('/reset-password')}
            >
              忘记密码？
            </button>
          </div>
        </Card>

        {/* 系统信息 */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>© 2025 食品溯源系统 | 工业级管理平台</p>
          <p className="mt-1">支持多产品类型溯源流程管理</p>
        </div>
      </div>
    </div>
  );
}
