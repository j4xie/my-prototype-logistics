'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  realName: string;
  phone: string;
  department: string;
  role: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    username: string;
    email: string;
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    realName: '',
    phone: '',
    department: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<RegisterFormData>>({});
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 部门选项
  const departments = [
    { value: 'farming', label: '养殖部门' },
    { value: 'processing', label: '加工部门' },
    { value: 'logistics', label: '物流部门' },
    { value: 'quality', label: '质检部门' },
    { value: 'management', label: '管理部门' },
    { value: 'other', label: '其他部门' }
  ];

  // 角色选项
  const roles = [
    { value: 'user', label: '普通用户' },
    { value: 'operator', label: '操作员' },
    { value: 'manager', label: '管理员' },
    { value: 'admin', label: '系统管理员' }
  ];

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Partial<RegisterFormData> = {};

    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字和下划线';
    }

    // 邮箱验证
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = '密码必须包含字母和数字';
    }

    // 确认密码验证
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    // 真实姓名验证
    if (!formData.realName.trim()) {
      newErrors.realName = '请输入真实姓名';
    } else if (formData.realName.length < 2) {
      newErrors.realName = '姓名至少2个字符';
    }

    // 手机号验证
    if (!formData.phone.trim()) {
      newErrors.phone = '请输入手机号码';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '请输入有效的手机号码';
    }

    // 部门验证
    if (!formData.department) {
      newErrors.department = '请选择部门';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理输入变化
  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setSubmitError('');
  };

  // 处理注册提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      // 使用认证服务（支持真实API）
      const { authService } = await import('@/services/auth.service');
      
      const registerData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        department: formData.department,
        position: formData.role, // 将role映射为position
        confirmPassword: formData.confirmPassword
      };

      const response = await authService.register(registerData);
      
      console.log('注册响应:', response);

      // 注册成功，跳转到登录页面
      alert('注册成功！请使用新账户登录。');
      router.push('/login?message=注册成功，请登录');

    } catch (error) {
      console.error('注册失败:', error);
      
      // 检查是否为认证API错误
      if (error && typeof error === 'object' && 'message' in error) {
        setSubmitError(error.message as string);
      } else {
        setSubmitError('网络错误，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <Card className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <Loading size="lg" className="mx-auto mb-4" />
              <p className="text-gray-600">正在注册账户...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-white shadow-sm">
        <div className="max-w-[390px] mx-auto">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              onClick={handleBackToLogin}
              className="p-2"
              aria-label="返回登录"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <h1 className="text-lg font-medium text-gray-900">用户注册</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <main className="flex-1 pt-[80px] pb-8">
        <div className="p-4">
          <Card className="bg-white rounded-lg shadow-sm p-6">
            {/* 页面标题 */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">创建新账户</h2>
              <p className="text-sm text-gray-600">填写以下信息完成注册</p>
            </div>

            {/* 注册表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 用户名 */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  用户名 *
                </label>
                <input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.username ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入用户名"
                />
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1">{errors.username}</p>
                )}
              </div>

              {/* 邮箱 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址 *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入邮箱地址"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* 密码 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  密码 *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                )}
              </div>

              {/* 确认密码 */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码 *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请再次输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showConfirmPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              {/* 真实姓名 */}
              <div>
                <label htmlFor="realName" className="block text-sm font-medium text-gray-700 mb-1">
                  真实姓名 *
                </label>
                <input
                  type="text"
                  id="realName"
                  value={formData.realName}
                  onChange={(e) => handleInputChange('realName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.realName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入真实姓名"
                />
                {errors.realName && (
                  <p className="text-xs text-red-500 mt-1">{errors.realName}</p>
                )}
              </div>

              {/* 手机号码 */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  手机号码 *
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入手机号码"
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                )}
              </div>

              {/* 部门选择 */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  所属部门 *
                </label>
                <select
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.department ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择部门</option>
                  {departments.map((dept) => (
                    <option key={dept.value} value={dept.value}>
                      {dept.label}
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <p className="text-xs text-red-500 mt-1">{errors.department}</p>
                )}
              </div>

              {/* 角色选择 */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  账户角色
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 错误提示 */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

              {/* 提交按钮 */}
              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? '注册中...' : '注册账户'}
                </Button>
              </div>

              {/* 登录链接 */}
              <div className="text-center pt-4">
                <p className="text-sm text-gray-600">
                  已有账户？
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-blue-600 hover:text-blue-700 font-medium ml-1"
                  >
                    立即登录
                  </button>
                </p>
              </div>
            </form>
          </Card>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="text-center text-gray-500 text-sm p-4">
        <p>© 2025 食品溯源系统 版权所有</p>
      </footer>
    </div>
  );
}
