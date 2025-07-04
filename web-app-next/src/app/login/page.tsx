'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Shield, Building2, Users, ArrowRight, Eye, EyeOff, Copy, CheckCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface LoginForm {
  username: string;
  password: string;
}

type LoginMode = 'platform' | 'factory';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuthStore();
  const [loginMode, setLoginMode] = useState<LoginMode>('factory');
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<LoginForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      return;
    }

    try {
      await login({
        username: form.username,
        password: form.password
      });

      // 登录成功后跳转
      const { user } = useAuthStore.getState();
      if (user?.role?.level === 0) {
        // 超级管理员跳转到平台管理
        router.push('/platform');
      } else if (user?.role?.level === 1) {
        // 系统管理员跳转到管理后台
        router.push('/admin/dashboard');
      } else {
        // 普通用户跳转到工厂业务系统
        router.push('/farming');
      }
    } catch (error) {
      console.error('登录失败:', error);
      const errorMessage = error instanceof Error ? error.message : '登录失败，请检查用户名和密码';
      setErrors({ username: errorMessage });
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

  // 快速填充建议账号
  const fillSuggestedAccount = () => {
    if (loginMode === 'platform') {
      setForm({ username: 'super_admin', password: 'super123' });
    } else {
      setForm({ username: 'admin', password: 'admin123' });
    }
    setErrors({});
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };



  if (!mounted) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="text-white text-3xl w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            食品溯源系统
          </h1>
          <p className="text-gray-600 text-sm">
            安全可信的食品溯源管理平台
          </p>
        </div>

        {/* 登录模式切换 */}
        <div className="mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setLoginMode('factory')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                loginMode === 'factory'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              工厂用户登录
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('platform')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                loginMode === 'platform'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              平台管理员
            </button>
          </div>
        </div>

                  {/* 登录信息提示 */}
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            loginMode === 'platform'
              ? 'bg-purple-50 border-purple-400'
              : 'bg-blue-50 border-blue-400'
          }`}>
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${
                loginMode === 'platform' ? 'text-purple-600' : 'text-blue-600'
              }`}>
                {loginMode === 'platform' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  loginMode === 'platform' ? 'text-purple-800' : 'text-blue-800'
                }`}>
                  {loginMode === 'platform' ? '平台超级管理员登录' : '工厂用户登录'}
                </h3>
                <div className={`mt-1 text-xs ${
                  loginMode === 'platform' ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  {loginMode === 'platform' ? (
                    <>
                      <p>管理所有工厂租户和平台运营数据</p>
                      <div className="mt-2 p-3 bg-purple-100 rounded-lg border border-purple-200">
                        <p className="font-medium text-purple-800 mb-2">🔑 超级管理员账号：</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white rounded p-2 border">
                            <div className="flex items-center space-x-2">
                              <span className="text-purple-600 text-xs">用户名：</span>
                              <span className="font-mono text-sm font-medium">super_admin</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard('super_admin', 'username')}
                              className="text-purple-600 hover:text-purple-800 transition-colors p-1"
                              title="复制用户名"
                            >
                              {copiedField === 'username' ? (
                                <CheckCheck className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded p-2 border">
                            <div className="flex items-center space-x-2">
                              <span className="text-purple-600 text-xs">密码：</span>
                              <span className="font-mono text-sm font-medium">super123</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard('super123', 'password')}
                              className="text-purple-600 hover:text-purple-800 transition-colors p-1"
                              title="复制密码"
                            >
                              {copiedField === 'password' ? (
                                <CheckCheck className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-purple-600">权限：Level 0 (最高权限)</p>
                          <span className="text-xs text-purple-500">点击图标复制</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>工厂内部业务系统登录</p>
                                            <div className="mt-2 p-3 bg-blue-100 rounded-lg border border-blue-200">
                        <p className="font-medium text-blue-800 mb-2">🔑 可用账号：</p>
                        <div className="space-y-2">
                          <div className="bg-white rounded p-2 border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-blue-600 text-xs font-medium">管理员账号：</span>
                              <span className="text-xs text-blue-500">Level 1</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm">admin / admin123</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard('admin', 'admin-user')}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                title="复制管理员账号"
                              >
                                {copiedField === 'admin-user' ? (
                                  <CheckCheck className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-blue-600 text-xs font-medium">普通用户：</span>
                              <span className="text-xs text-blue-500">Level 3</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm">user / user123</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard('user', 'normal-user')}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                title="复制普通用户账号"
                              >
                                {copiedField === 'normal-user' ? (
                                  <CheckCheck className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        {/* 登录表单 */}
        <Card className={`bg-white rounded-xl shadow-xl p-6 border-0 ${
          loginMode === 'platform'
            ? 'ring-2 ring-purple-100'
            : 'ring-2 ring-blue-100'
        }`}>
          <form onSubmit={handleLogin} className="space-y-5">
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
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="请输入密码"
                  className={`w-full h-12 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className={`w-full h-12 font-medium rounded-lg transition-all duration-300 hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-2 ${
                loginMode === 'platform'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loading className="w-4 h-4" />
                  登录中...
                </>
              ) : (
                <>
                  {loginMode === 'platform' ? '进入平台管理' : '进入工厂系统'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

                    {/* 快速登录提示 */}
          {loginMode === 'platform' && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="text-xs text-purple-700">
                  <p className="font-medium">💡 快速登录提示：</p>
                  <p className="mt-1">平台超级管理员可管理所有工厂租户、订阅套餐和平台运营数据</p>
                </div>
                <button
                  type="button"
                  onClick={fillSuggestedAccount}
                  className="text-xs text-purple-600 hover:text-purple-800 underline ml-2 flex-shrink-0"
                >
                  快速填充
                </button>
              </div>
            </div>
          )}

          {loginMode === 'factory' && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="text-xs text-blue-700">
                  <p className="font-medium">💡 快速登录提示：</p>
                  <p className="mt-1">工厂用户可使用溯源查询、农业监控、加工管理等业务功能</p>
                </div>
                <button
                  type="button"
                  onClick={fillSuggestedAccount}
                  className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 flex-shrink-0"
                >
                  快速填充
                </button>
              </div>
            </div>
          )}

          {/* 其他操作链接 */}
          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              className={`text-sm hover:underline transition-colors ${
                loginMode === 'platform' ? 'text-purple-600' : 'text-blue-600'
              }`}
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
        <div className="mt-8 text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p>© 2025 食品溯源系统</p>
            <p className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              多租户SaaS平台 | 工业级安全认证
            </p>
          </div>

          {/* 版本信息 */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span>v2.1.0</span>
            <span>•</span>
            <span>MSW Mock API</span>
            <span>•</span>
            <span>Next.js 15</span>
          </div>
        </div>
      </div>
    </div>
  );
}
