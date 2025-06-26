'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';

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
      // 调用Mock API进行登录验证
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.token && data.user) {
        // 存储用户信息和token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_info', JSON.stringify(data.user));

        alert(`登录成功！欢迎回来，${data.user.name}！`);

        // 根据用户角色跳转到相应页面
        if (data.user.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/home/selector');
        }
      } else {
        alert(data.message || "用户名或密码错误");
      }
    } catch (error) {
      console.error('登录错误:', error);
      alert("网络连接错误，请稍后重试");
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

  // 快速登录（演示用）
  const handleQuickLogin = (role: 'admin' | 'user') => {
    const credentials = {
      admin: { username: 'admin', password: '123456' },
      user: { username: 'user', password: '123456' }
    };

    setForm(credentials[role]);
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

          {/* 快速登录按钮（演示用） */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">演示账号快速登录</p>
            <div className="flex gap-2">
                             <Button
                 type="button"
                 variant="secondary"
                 className="flex-1 h-10 text-sm"
                 onClick={() => handleQuickLogin('user')}
                 disabled={loading}
               >
                 普通用户
               </Button>
               <Button
                 type="button"
                 variant="secondary"
                 className="flex-1 h-10 text-sm"
                 onClick={() => handleQuickLogin('admin')}
                 disabled={loading}
               >
                 管理员
               </Button>
            </div>
          </div>

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
