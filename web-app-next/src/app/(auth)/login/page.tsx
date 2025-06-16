'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { login } from '@/hooks/useApi-simple';
import type { BaseResponse, UserInfo } from '@/types/api';

// 认证响应类型
type AuthResponse = BaseResponse<{
  token: string;
  user: UserInfo;
}>;

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少6位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await login(formData) as AuthResponse;
      
      if (response?.success) {
        // 存储认证信息
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
        
        // 跳转到首页选择器
        router.push('/home/selector');
      } else {
        setErrors({ general: response?.message || '登录失败，请重试' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: '网络错误，请检查连接后重试' });
    } finally {
      setIsLoading(false);
    }
  };

  // 检查是否已登录
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      router.push('/home/selector');
    }
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 页面容器 */}
      <div className="max-w-[390px] mx-auto w-full min-h-screen flex flex-col justify-center p-4">
        
        {/* Logo区域 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1677FF] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-leaf text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-semibold text-[#1677FF] mb-2">食品溯源系统</h1>
          <p className="text-[#8c8c8c] text-sm">安全可信的食品追溯平台</p>
        </div>

        {/* 登录表单卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 全局错误提示 */}
            {errors.general && (
              <div className="bg-[#fff2f0] border border-[#ffccc7] rounded-md p-3 text-[#ff4d4f] text-sm">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {errors.general}
              </div>
            )}

            {/* 用户名输入 */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-[#262626]">
                用户名
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`w-full h-12 px-4 border rounded-md text-base transition-all duration-300 ${
                  errors.username 
                    ? 'border-[#ff4d4f] focus:border-[#ff4d4f] focus:shadow-[0_0_0_2px_rgba(245,34,45,0.2)]' 
                    : 'border-[#d9d9d9] hover:border-[#69b1ff] focus:border-[#1677FF] focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'
                } focus:outline-none`}
                placeholder="请输入用户名"
                disabled={isLoading}
              />
              {errors.username && (
                <p className="text-[#ff4d4f] text-xs mt-1">
                  <i className="fas fa-exclamation-circle mr-1"></i>
                  {errors.username}
                </p>
              )}
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#262626]">
                密码
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full h-12 px-4 border rounded-md text-base transition-all duration-300 ${
                  errors.password 
                    ? 'border-[#ff4d4f] focus:border-[#ff4d4f] focus:shadow-[0_0_0_2px_rgba(245,34,45,0.2)]' 
                    : 'border-[#d9d9d9] hover:border-[#69b1ff] focus:border-[#1677FF] focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'
                } focus:outline-none`}
                placeholder="请输入密码"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-[#ff4d4f] text-xs mt-1">
                  <i className="fas fa-exclamation-circle mr-1"></i>
                  {errors.password}
                </p>
              )}
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#1677FF] hover:bg-[#4096FF] active:bg-[#0958D9] text-white font-medium rounded-md transition-all duration-300 shadow-[0_2px_5px_rgba(22,119,255,0.15)] hover:shadow-[0_2px_8px_rgba(22,119,255,0.25)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  登录中...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  登录
                </>
              )}
            </Button>

            {/* 其他操作链接 */}
            <div className="flex justify-between items-center text-sm pt-2">
              <button
                type="button"
                className="text-[#1677FF] hover:text-[#4096FF] transition-colors"
                onClick={() => router.push('/auth/register')}
              >
                注册账号
              </button>
              <button
                type="button"
                className="text-[#8c8c8c] hover:text-[#1677FF] transition-colors"
                onClick={() => router.push('/auth/forgot-password')}
              >
                忘记密码？
              </button>
            </div>
          </form>
        </Card>

        {/* 底部信息 */}
        <div className="text-center mt-8 text-xs text-[#8c8c8c]">
          <p>© 2024 食品溯源系统. 保留所有权利.</p>
          <p className="mt-1">安全 · 可信 · 透明</p>
        </div>
      </div>
    </div>
  );
} 