'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Phone, CheckCircle, User, Building2, Shield } from 'lucide-react';

// 注册步骤枚举
type RegisterStep = 'phone-verification' | 'complete-profile';

interface PhoneVerificationData {
  phone: string;
}

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

// 白名单验证响应
interface WhitelistVerificationResponse {
  success: boolean;
  message: string;
  data?: {
    phone: string;
    name: string;
    department: string;
    position: string;
    isValid: boolean;
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegisterStep>('phone-verification');
  const [loading, setLoading] = useState(false);
  const [phoneVerificationData, setPhoneVerificationData] = useState<PhoneVerificationData>({
    phone: ''
  });
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
  const [errors, setErrors] = useState<any>({});
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [whitelistInfo, setWhitelistInfo] = useState<any>(null);

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
    { value: 'manager', label: '管理员' }
  ];

  // 验证手机号格式
  const validatePhone = (phone: string): boolean => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  // 验证手机号是否在白名单中
  const handlePhoneVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneVerificationData.phone.trim()) {
      setErrors({ phone: '请输入手机号' });
      return;
    }

    if (!validatePhone(phoneVerificationData.phone)) {
      setErrors({ phone: '请输入有效的手机号' });
      return;
    }

    setLoading(true);
    setErrors({});
    setSubmitError('');

    try {
      // 使用真实API验证手机号
      const { authService } = await import('@/services/auth.service');
      
      const response = await authService.verifyPhone(phoneVerificationData.phone, 'TEST_2024_001');

      if (response.success && response.data) {
        // 手机号验证成功
        const { tempToken, message } = response.data;
        const whitelistEntry = response.data.metadata || {
          name: '待注册用户',
          department: '未分配',
          position: '待分配'
        };

        setWhitelistInfo({
          ...whitelistEntry,
          tempToken
        });
        
        setFormData(prev => ({
          ...prev,
          phone: phoneVerificationData.phone,
          realName: whitelistEntry.name || '',
          department: whitelistEntry.department === '养殖部门' ? 'farming' :
                    whitelistEntry.department === '加工部门' ? 'processing' :
                    whitelistEntry.department === '物流部门' ? 'logistics' :
                    whitelistEntry.department === '质检部门' ? 'quality' :
                    whitelistEntry.department === '管理部门' ? 'management' : 'other'
        }));
        setCurrentStep('complete-profile');
      } else {
        // 手机号验证失败
        setSubmitError(response.message || '该手机号未在注册白名单中，请联系管理员添加后重试');
      }
    } catch (error) {
      console.error('手机号验证失败:', error);
      setSubmitError('验证服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 第二步表单验证
  const validateCompleteForm = (): boolean => {
    const newErrors: any = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理完整注册提交
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCompleteForm()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      // 使用认证服务
      const { authService } = await import('@/services/auth.service');

      const registerData = {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        phoneNumber: formData.phone,
        fullName: formData.realName,
        tempToken: whitelistInfo?.tempToken,
        factoryId: 'TEST_2024_001',
        confirmPassword: formData.confirmPassword
      };

      const response = await authService.register(registerData);

      console.log('注册响应:', response);

      // 注册成功，显示等待审核提示
      alert('注册申请已提交！请等待管理员审核，审核通过后您将收到通知。');
      router.push('/login?message=注册申请已提交，等待审核');

    } catch (error) {
      console.error('注册失败:', error);

      if (error && typeof error === 'object' && 'message' in error) {
        setSubmitError(error.message as string);
      } else {
        setSubmitError('注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (field: string, value: string) => {
    if (currentStep === 'phone-verification') {
      setPhoneVerificationData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    // 清除对应字段的错误
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }));
    }
    setSubmitError('');
  };

  // 返回上一步
  const handleGoBack = () => {
    if (currentStep === 'complete-profile') {
      setCurrentStep('phone-verification');
      setErrors({});
      setSubmitError('');
    } else {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <Loading className="mx-auto mb-4" />
              <p className="text-gray-600">
                {currentStep === 'phone-verification' ? '验证手机号...' : '提交注册信息...'}
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
        <div className="max-w-[390px] mx-auto px-4 h-[60px] flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <h1 className="text-lg font-medium">
            {currentStep === 'phone-verification' ? '员工注册' : '完善资料'}
          </h1>
          <div className="w-16"></div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="pt-[80px] pb-[20px] px-4 flex-1">
        {currentStep === 'phone-verification' ? (
          /* 第一步：手机号验证 */
          <div className="space-y-6">
            {/* 步骤指示器 */}
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <span className="ml-2 text-sm font-medium text-blue-600">手机号验证</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <span className="ml-2 text-sm text-gray-500">完善资料</span>
              </div>
            </div>

            {/* 说明卡片 */}
            <Card className="bg-blue-50 border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800 mb-1">注册说明</h3>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• 只有已添加到白名单的手机号才能注册</p>
                    <p>• 请使用工厂管理员为您提供的手机号</p>
                    <p>• 注册后需要等待管理员审核</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* 手机号输入表单 */}
            <Card className="bg-white rounded-lg shadow-sm p-6">
              <form onSubmit={handlePhoneVerification} className="space-y-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    请输入您的手机号
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phoneVerificationData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="输入11位手机号码"
                    className={`text-center text-lg ${
                      errors.phone ? 'border-red-500' : ''
                    }`}
                    maxLength={11}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                  )}
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading}
                >
                  验证手机号
                </Button>
              </form>
            </Card>
          </div>
        ) : (
          /* 第二步：完善注册信息 */
          <div className="space-y-6">
            {/* 步骤指示器 */}
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="ml-2 text-sm font-medium text-green-600">手机号验证</span>
              </div>
              <div className="w-8 h-0.5 bg-blue-600"></div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <span className="ml-2 text-sm font-medium text-blue-600">完善资料</span>
              </div>
            </div>

            {/* 白名单信息确认 */}
            {whitelistInfo && (
              <Card className="bg-green-50 border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-green-800 mb-2">手机号验证成功</h3>
                    <div className="text-sm text-green-700 space-y-1">
                      <p><span className="font-medium">姓名：</span>{whitelistInfo.name}</p>
                      <p><span className="font-medium">部门：</span>{whitelistInfo.department}</p>
                      <p><span className="font-medium">职位：</span>{whitelistInfo.position}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 完整注册表单 */}
            <Card className="bg-white rounded-lg shadow-sm p-6">
              <form onSubmit={handleCompleteRegistration} className="space-y-4">
                {/* 用户名 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    用户名 *
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="请输入用户名"
                    className={errors.username ? 'border-red-500' : ''}
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
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="请输入邮箱地址"
                    className={errors.email ? 'border-red-500' : ''}
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
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="请输入密码（至少6位，包含字母和数字）"
                      className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
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
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="请再次输入密码"
                      className={`pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
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
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading}
                >
                  {loading ? '提交注册申请...' : '提交注册申请'}
                </Button>
              </form>
            </Card>

            {/* 提示信息 */}
            <Card className="bg-yellow-50 border-yellow-200 p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800 mb-1">审核说明</h3>
                  <p className="text-sm text-yellow-700">
                    提交注册申请后，您的账户将处于待审核状态。管理员审核通过后，您将收到邮件通知，届时可正常登录使用系统。
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
