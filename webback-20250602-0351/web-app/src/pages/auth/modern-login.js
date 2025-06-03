import React, { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Loading,
  PageLayout
} from '../../components/ui';

/**
 * 现代化登录页面
 * 使用新的UI组件库，支持移动端适配
 */
const ModernLogin = () => {
  // 状态管理
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState('user'); // 'user' | 'admin'

  // 处理输入变化
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少需要3个字符';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理登录
  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟登录成功
      console.log('登录成功:', { ...formData, type: loginType });
      
      // 重定向到相应页面
      if (loginType === 'admin') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/user/dashboard';
      }
    } catch (error) {
      setErrors({
        general: '登录失败，请检查用户名和密码'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="w-full max-w-md">
          {/* 系统标题 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#1890FF] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              食品溯源系统
            </h1>
            <p className="text-gray-600">
              安全可信的食品追溯平台
            </p>
          </div>

          {/* 登录卡片 */}
          <Card className="shadow-xl">
            <div className="p-6">
              {/* 登录类型切换 */}
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setLoginType('user')}
                  className={`
                    flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200
                    ${loginType === 'user' 
                      ? 'bg-white text-[#1890FF] shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  用户登录
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('admin')}
                  className={`
                    flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200
                    ${loginType === 'admin' 
                      ? 'bg-white text-[#1890FF] shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  管理员登录
                </button>
              </div>

              {/* 登录表单 */}
              <div className="space-y-4">
                {/* 用户名输入 */}
                <Input
                  label="用户名"
                  value={formData.username}
                  onChange={(value) => handleInputChange('username', value)}
                  placeholder={loginType === 'admin' ? '请输入管理员账号' : '请输入用户名'}
                  required
                  error={errors.username}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />

                {/* 密码输入 */}
                <Input
                  label="密码"
                  type="password"
                  value={formData.password}
                  onChange={(value) => handleInputChange('password', value)}
                  placeholder="请输入密码"
                  required
                  error={errors.password}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />

                {/* 通用错误信息 */}
                {errors.general && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errors.general}</p>
                  </div>
                )}

                {/* 登录按钮 */}
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleLogin}
                  loading={isLoading}
                  disabled={isLoading}
                  className="w-full mt-6"
                >
                  {isLoading ? '登录中...' : '登录'}
                </Button>

                {/* 其他操作 */}
                <div className="flex justify-between items-center mt-4 text-sm">
                  <button
                    type="button"
                    className="text-[#1890FF] hover:text-[#4096FF] transition-colors duration-200"
                    disabled={isLoading}
                  >
                    忘记密码？
                  </button>
                  <button
                    type="button"
                    className="text-[#1890FF] hover:text-[#4096FF] transition-colors duration-200"
                    disabled={isLoading}
                  >
                    注册账号
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* 系统信息 */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>© 2025 食品溯源系统. 保留所有权利.</p>
            <p className="mt-1">
              <a href="/privacy" className="hover:text-gray-700 transition-colors duration-200">
                隐私政策
              </a>
              {' · '}
              <a href="/terms" className="hover:text-gray-700 transition-colors duration-200">
                服务条款
              </a>
            </p>
          </div>

          {/* 演示账号信息 */}
          <Card className="mt-6 bg-blue-50 border-blue-200">
            <div className="p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                演示账号
              </h3>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>用户账号：</strong> demo / 123456</p>
                <p><strong>管理员账号：</strong> admin / admin123</p>
              </div>
            </div>
          </Card>
        </div>

        {/* 全屏加载遮罩 */}
        {isLoading && (
          <Loading
            overlay
            type="spinner"
            text="正在验证登录信息..."
            size="lg"
          />
        )}
      </div>
    </PageLayout>
  );
};

export default ModernLogin; 