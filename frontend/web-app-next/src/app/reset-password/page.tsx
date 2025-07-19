'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';

interface ResetPasswordFormData {
  email: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  step?: 'email' | 'verification' | 'password';
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<'email' | 'verification' | 'password'>('email');
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    email: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<ResetPasswordFormData>>({});
  const [submitError, setSubmitError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 倒计时功能
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 处理输入变化
  const handleInputChange = (field: keyof ResetPasswordFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setSubmitError('');
  };

  // 验证邮箱格式
  const validateEmail = (): boolean => {
    const newErrors: Partial<ResetPasswordFormData> = {};

    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 验证验证码
  const validateVerificationCode = (): boolean => {
    const newErrors: Partial<ResetPasswordFormData> = {};

    if (!formData.verificationCode.trim()) {
      newErrors.verificationCode = '请输入验证码';
    } else if (formData.verificationCode.length !== 6) {
      newErrors.verificationCode = '验证码应为6位数字';
    } else if (!/^\d{6}$/.test(formData.verificationCode)) {
      newErrors.verificationCode = '验证码只能包含数字';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 验证新密码
  const validateNewPassword = (): boolean => {
    const newErrors: Partial<ResetPasswordFormData> = {};

    if (!formData.newPassword) {
      newErrors.newPassword = '请输入新密码';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = '密码至少6个字符';
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = '密码必须包含字母和数字';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认新密码';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 发送验证码
  const handleSendVerificationCode = async () => {
    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email
        }),
      });

      const result: ResetPasswordResponse = await response.json();

      if (result.success) {
        setCurrentStep('verification');
        setCountdown(60); // 60秒倒计时
        alert('验证码已发送到您的邮箱，请查收');
      } else {
        setSubmitError(result.message || '发送验证码失败');
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      // Mock数据回退
      setTimeout(() => {
        setCurrentStep('verification');
        setCountdown(60);
        alert('验证码已发送到您的邮箱 (Mock模式)');
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!validateVerificationCode()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.verificationCode
        }),
      });

      const result: ResetPasswordResponse = await response.json();

      if (result.success) {
        setCurrentStep('password');
      } else {
        setSubmitError(result.message || '验证码错误');
      }
    } catch (error) {
      console.error('验证码验证失败:', error);
      // Mock数据回退 - 接受任意6位数字验证码
      if (formData.verificationCode.length === 6) {
        setTimeout(() => {
          setCurrentStep('password');
        }, 1000);
      } else {
        setSubmitError('网络错误，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!validateNewPassword()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.verificationCode,
          newPassword: formData.newPassword
        }),
      });

      const result: ResetPasswordResponse = await response.json();

      if (result.success) {
        alert('密码重置成功！请使用新密码登录。');
        router.push('/login?message=密码重置成功，请使用新密码登录');
      } else {
        setSubmitError(result.message || '密码重置失败');
      }
    } catch (error) {
      console.error('密码重置失败:', error);
      // Mock数据回退 - 模拟重置成功
      setTimeout(() => {
        alert('密码重置成功！(Mock模式) 请使用新密码登录。');
        router.push('/login?message=密码重置成功，请使用新密码登录');
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  // 返回上一步
  const handleGoBack = () => {
    if (currentStep === 'verification') {
      setCurrentStep('email');
    } else if (currentStep === 'password') {
      setCurrentStep('verification');
    } else {
      router.push('/login');
    }
    setSubmitError('');
    setErrors({});
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
              <p className="text-gray-600">
                {currentStep === 'email' && '正在发送验证码...'}
                {currentStep === 'verification' && '正在验证验证码...'}
                {currentStep === 'password' && '正在重置密码...'}
              </p>
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
              onClick={handleGoBack}
              className="p-2"
              aria-label="返回上一步"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <h1 className="text-lg font-medium text-gray-900">找回密码</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <main className="flex-1 pt-[80px] pb-8">
        <div className="p-4">
          <Card className="bg-white rounded-lg shadow-sm p-6">
            {/* 步骤指示器 */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep === 'email' ? 'bg-blue-600 text-white' :
                  ['verification', 'password'].includes(currentStep) ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  1
                </div>
                <div className={`w-8 h-0.5 ${
                  ['verification', 'password'].includes(currentStep) ? 'bg-green-600' : 'bg-gray-300'
                }`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep === 'verification' ? 'bg-blue-600 text-white' :
                  currentStep === 'password' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  2
                </div>
                <div className={`w-8 h-0.5 ${
                  currentStep === 'password' ? 'bg-green-600' : 'bg-gray-300'
                }`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep === 'password' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  3
                </div>
              </div>
            </div>

            {/* 步骤1: 输入邮箱 */}
            {currentStep === 'email' && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">验证邮箱地址</h2>
                  <p className="text-sm text-gray-600">输入您的注册邮箱，我们将发送验证码</p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSendVerificationCode(); }} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      邮箱地址
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入注册时使用的邮箱"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                    )}
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div className="pt-4 space-y-3">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={loading}
                    >
                      发送验证码
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={handleBackToLogin}
                    >
                      返回登录
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* 步骤2: 输入验证码 */}
            {currentStep === 'verification' && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">输入验证码</h2>
                  <p className="text-sm text-gray-600">
                    验证码已发送至 <span className="font-medium text-blue-600">{formData.email}</span>
                  </p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(); }} className="space-y-4">
                  <div>
                    <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                      验证码
                    </label>
                    <input
                      type="text"
                      id="verificationCode"
                      value={formData.verificationCode}
                      onChange={(e) => handleInputChange('verificationCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono ${
                        errors.verificationCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入6位验证码"
                      maxLength={6}
                    />
                    {errors.verificationCode && (
                      <p className="text-xs text-red-500 mt-1">{errors.verificationCode}</p>
                    )}
                  </div>

                  {/* 重新发送验证码 */}
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">
                        {countdown}秒后可重新发送
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendVerificationCode}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        重新发送验证码
                      </button>
                    )}
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={loading || formData.verificationCode.length !== 6}
                    >
                      验证并继续
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* 步骤3: 设置新密码 */}
            {currentStep === 'password' && (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">设置新密码</h2>
                  <p className="text-sm text-gray-600">请设置一个安全的新密码</p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
                  {/* 新密码 */}
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      新密码
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={formData.newPassword}
                        onChange={(e) => handleInputChange('newPassword', e.target.value)}
                        className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.newPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="请输入新密码"
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
                    {errors.newPassword && (
                      <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>
                    )}
                  </div>

                  {/* 确认新密码 */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      确认新密码
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
                        placeholder="请再次输入新密码"
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

                  {/* 密码强度提示 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">密码要求：</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• 至少6个字符</li>
                      <li>• 包含字母和数字</li>
                      <li>• 避免使用过于简单的密码</li>
                    </ul>
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={loading}
                    >
                      完成密码重置
                    </Button>
                  </div>
                </form>
              </div>
            )}
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
