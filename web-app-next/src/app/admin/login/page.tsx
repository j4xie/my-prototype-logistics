'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button } from '@/components/ui';
import { Loading } from '@/components/ui/loading';
import { authService, AuthApiError } from '@/services/auth.service';
import type { LoginRequest } from '@/types/auth';

interface AdminLoginForm {
  username: string;
  password: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<AdminLoginForm>({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<AdminLoginForm>>({});

  useEffect(() => {
    setMounted(true);
    // 检查是否已有管理员会话
    checkAdminSession();
  }, []);

  const checkAdminSession = () => {
    const token = localStorage.getItem('admin_auth_token');
    const userInfo = localStorage.getItem('admin_user_info');
    
    if (token && userInfo) {
      try {
        const user = JSON.parse(userInfo);
        if (user.level >= 5) {
          router.push('/admin/dashboard');
          return;
        }
      } catch (error) {
        console.warn('管理员会话验证失败:', error);
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_user_info');
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<AdminLoginForm> = {};

    if (!form.username.trim()) {
      newErrors.username = '请输入管理员用户名';
    }

    if (!form.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (form.password.length < 6) {
      newErrors.password = '密码长度至少6位';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const credentials: LoginRequest = {
        username: form.username,
        password: form.password
      };

      console.log('[AdminLogin] 发送管理员登录请求:', credentials.username);
      const response = await authService.login(credentials);
      
      // 处理响应格式
      let userData;
      let authToken;
      
      if (response.state === 200 && response.data) {
        userData = response.data;
        authToken = `admin_api_${userData.uid}_${Date.now()}`;
      } else {
        const data = response.data || response;
        authToken = data.token || response.token;
        userData = data.user || response.user || data;
      }

      if (userData && userData.username) {
        // 验证管理员级别
        const userLevel = userData.level || userData.admin_level || 0;
        
        if (userLevel < 5) {
          alert('权限不足：只有权限管理员(level 5)和超级管理员(level 6)可以访问管理后台');
          return;
        }

        // 存储管理员会话信息
        localStorage.setItem('admin_auth_token', authToken);
        localStorage.setItem('admin_user_info', JSON.stringify({
          ...userData,
          loginTime: new Date().toISOString(),
          userType: userLevel === 6 ? 'super_admin' : 'permission_admin'
        }));

        const adminType = userLevel === 6 ? '超级管理员' : '权限管理员';
        const userName = userData.name || userData.username;
        
        console.log(`[AdminLogin] ${adminType}登录成功:`, userName);
        alert(`${adminType}登录成功！欢迎，${userName}！`);

        // 跳转到管理员仪表板
        router.push('/admin/dashboard');
      } else {
        alert('登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('[AdminLogin] 登录错误:', error);
      
      if (error instanceof AuthApiError) {
        let errorMsg = error.message;
        if (error.code === 'USER_NOT_FOUND') {
          errorMsg = '管理员账户不存在，请检查用户名';
        } else if (error.code === 'INVALID_PASSWORD') {
          errorMsg = '管理员密码错误，请重新输入';
        }
        alert(errorMsg);
      } else {
        alert('网络连接错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AdminLoginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!mounted) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      {/* PC端宽屏布局 */}
      <div className="w-full max-w-md">
        {/* 系统标识 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <i className="fas fa-shield-alt text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            管理员后台
          </h1>
          <p className="text-slate-600">
            系统管理与权限控制中心
          </p>
          <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              仅限权限管理员(Level 5)和超级管理员(Level 6)访问
            </p>
          </div>
        </div>

        {/* 登录表单 */}
        <Card className="bg-white rounded-xl shadow-xl p-8 border-0">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                管理员用户名
              </label>
              <Input
                type="text"
                value={form.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="请输入管理员用户名"
                className={`w-full h-12 px-4 text-base ${errors.username ? 'border-red-500' : 'border-slate-300'} 
                           focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg`}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-2">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                密码
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="请输入管理员密码"
                className={`w-full h-12 px-4 text-base ${errors.password ? 'border-red-500' : 'border-slate-300'} 
                           focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg`}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-2">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 
                         hover:to-purple-700 text-white font-semibold text-base rounded-lg transition-all 
                         duration-300 hover:shadow-lg transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loading className="w-5 h-5 mr-3" />
                  验证管理员权限中...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-3"></i>
                  管理员登录
                </>
              )}
            </Button>
          </form>

          {/* 安全提示 */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              <i className="fas fa-info-circle mr-2 text-blue-500"></i>
              安全提醒
            </h3>
            <ul className="text-xs text-slate-600 space-y-1">
              <li>• 管理员账户无法自助注册，由系统分配</li>
              <li>• 登录失败多次将触发安全锁定</li>
              <li>• 建议使用专用设备和安全网络环境</li>
            </ul>
          </div>

          {/* 返回链接 */}
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-slate-500 text-sm hover:text-indigo-600 hover:underline transition-colors"
              onClick={() => router.push('/login')}
            >
              <i className="fas fa-arrow-left mr-2"></i>
              返回普通用户登录
            </button>
          </div>
        </Card>

        {/* 系统信息 */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>© 2025 食品溯源系统 管理员后台 | 高级权限管理平台</p>
          <p className="mt-1">Version 1.0 | 仅限授权管理员访问</p>
        </div>
      </div>
    </div>
  );
} 