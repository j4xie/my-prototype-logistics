'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Shield, Users, ArrowRight, Eye, EyeOff, Copy, CheckCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuthStore();
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

                  // 登录成功后根据用户角色跳转
      const { user } = useAuthStore.getState();

      console.log('🔍 [Login] 登录成功，分析用户数据:', {
        user: user,
        userKeys: user ? Object.keys(user) : [],
        role: user?.role,
        permissions: user?.permissions,
        username: user?.username
      });

      // 检查是否为开发者
      const isDeveloper = user?.role?.name === 'DEVELOPER' || user?.permissions?.role === 'DEVELOPER';
      const isPlatformAdmin = user?.username === 'platform_admin' || user?.role?.name === 'PLATFORM_ADMIN' || user?.permissions?.role === 'PLATFORM_ADMIN';

      console.log('🔍 [Login] 角色判断结果:', {
        isDeveloper,
        isPlatformAdmin,
        conditions: {
          'user.role.name === DEVELOPER': user?.role?.name === 'DEVELOPER',
          'user.permissions.role === DEVELOPER': user?.permissions?.role === 'DEVELOPER',
          'username === platform_admin': user?.username === 'platform_admin',
          'user.role.name === PLATFORM_ADMIN': user?.role?.name === 'PLATFORM_ADMIN',
          'user.permissions.role === PLATFORM_ADMIN': user?.permissions?.role === 'PLATFORM_ADMIN'
        }
      });

      if (isDeveloper) {
        console.log('✅ [Login] 开发者登录成功，跳转到模块选择器（默认页面）');
        router.push('/home/selector');
      }
      // 检查是否为平台管理员
      else if (isPlatformAdmin) {
        console.log('✅ [Login] 平台管理员登录成功，跳转到平台管理页面');
        router.push('/platform');
      } else {
        console.log('✅ [Login] 工厂用户登录成功，跳转到模块选择器');
        router.push('/home/selector');
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

  // 快速填充账号
  const quickFill = (username: string, password: string) => {
    setForm({ username, password });
    setErrors({});
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

        {/* 账号信息提示 */}
        <div className="mb-6 p-4 rounded-lg border-l-4 bg-blue-50 border-blue-400">
          <div className="flex items-start">
            <div className="flex-shrink-0 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                可用账号信息
              </h3>
              <p className="mt-1 text-xs text-blue-700">
                系统提供完整的权限等级账号
              </p>

              <div className="mt-3 space-y-3">
                {/* 开发者账号 */}
                <div className="p-3 bg-yellow-100 rounded-lg border border-yellow-200">
                  <p className="font-medium text-yellow-800 mb-2 flex items-center">
                    🛠️ 系统开发者
                  </p>
                  <div className="text-xs text-yellow-700 mb-2">拥有所有权限，可在平台管理和工厂管理间切换</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-600 text-xs">用户名：</span>
                        <code className="font-mono text-sm text-yellow-800">developer</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('developer', 'developer_username')}
                          className="p-1 text-yellow-600 hover:text-yellow-800 transition-colors"
                        >
                          {copiedField === 'developer_username' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-600 text-xs">密码：</span>
                        <code className="font-mono text-sm text-yellow-800">FactoryAdmin@123456</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('FactoryAdmin@123456', 'developer_password')}
                          className="p-1 text-yellow-600 hover:text-yellow-800 transition-colors"
                        >
                          {copiedField === 'developer_password' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickFill('developer', 'FactoryAdmin@123456')}
                      className="w-full text-xs text-yellow-600 hover:text-yellow-800 py-1 hover:bg-yellow-50 rounded transition-colors"
                    >
                      快速填充
                    </button>
                  </div>
                </div>

                {/* 平台管理员 */}
                <div className="p-3 bg-purple-100 rounded-lg border border-purple-200">
                  <p className="font-medium text-purple-800 mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-1" />
                    平台管理员
                  </p>
                  <div className="text-xs text-purple-700 mb-2">平台最高权限，可管理所有工厂租户和平台运营</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-600 text-xs">用户名：</span>
                        <code className="font-mono text-sm text-purple-800">platform_admin</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('platform_admin', 'platform_admin_username')}
                          className="p-1 text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          {copiedField === 'platform_admin_username' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-600 text-xs">密码：</span>
                        <code className="font-mono text-sm text-purple-800">Admin@123456</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('Admin@123456', 'platform_admin_password')}
                          className="p-1 text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          {copiedField === 'platform_admin_password' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickFill('platform_admin', 'Admin@123456')}
                      className="w-full text-xs text-purple-600 hover:text-purple-800 py-1 hover:bg-purple-50 rounded transition-colors"
                    >
                      快速填充
                    </button>
                  </div>
                </div>

                {/* 工厂超级管理员 */}
                <div className="p-3 bg-green-100 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800 mb-2 flex items-center">
                    🏭 工厂超级管理员
                  </p>
                  <div className="text-xs text-green-700 mb-2">工厂最高权限，可管理工厂内所有用户和数据</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 text-xs">用户名：</span>
                        <code className="font-mono text-sm text-green-800">factory_admin</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('factory_admin', 'factory_admin_username')}
                          className="p-1 text-green-600 hover:text-green-800 transition-colors"
                        >
                          {copiedField === 'factory_admin_username' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 text-xs">密码：</span>
                        <code className="font-mono text-sm text-green-800">FactoryAdmin@123456</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('FactoryAdmin@123456', 'factory_admin_password')}
                          className="p-1 text-green-600 hover:text-green-800 transition-colors"
                        >
                          {copiedField === 'factory_admin_password' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickFill('factory_admin', 'FactoryAdmin@123456')}
                      className="w-full text-xs text-green-600 hover:text-green-800 py-1 hover:bg-green-50 rounded transition-colors"
                    >
                      快速填充
                    </button>
                    <div className="text-xs text-green-600 mt-1">
                      黑牛食品测试工厂 - 超级管理员
                    </div>
                  </div>
                </div>

                {/* 权限管理员账号 */}
                <div className="p-3 bg-blue-100 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-2 flex items-center">
                    🔐 权限管理员
                  </p>
                  <div className="text-xs text-blue-700 mb-2">负责用户权限管理和角色分配</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600 text-xs">用户名：</span>
                        <code className="font-mono text-sm text-blue-800">perm_admin001</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('perm_admin001', 'perm_admin_username')}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {copiedField === 'perm_admin_username' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-600 text-xs">密码：</span>
                        <code className="font-mono text-sm text-blue-800">PermAdmin@123456</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('PermAdmin@123456', 'perm_admin_password')}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {copiedField === 'perm_admin_password' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickFill('perm_admin001', 'PermAdmin@123456')}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 py-1 hover:bg-blue-50 rounded transition-colors"
                    >
                      快速填充
                    </button>
                    <div className="text-xs text-blue-600 mt-1">
                      黑牛食品测试工厂 - 权限管理员
                    </div>
                  </div>
                </div>

                {/* 普通工厂用户账号 */}
                <div className="p-3 bg-orange-100 rounded-lg border border-orange-200">
                  <p className="font-medium text-orange-800 mb-2 flex items-center">
                    👤 普通工厂用户
                  </p>
                  <div className="text-xs text-orange-700 mb-2">普通操作员权限，可查看和操作分配的功能模块</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-600 text-xs">用户名：</span>
                        <code className="font-mono text-sm text-orange-800">viewer_001</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('viewer_001', 'viewer_username')}
                          className="p-1 text-orange-600 hover:text-orange-800 transition-colors"
                        >
                          {copiedField === 'viewer_username' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded p-2 border">
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-600 text-xs">密码：</span>
                        <code className="font-mono text-sm text-orange-800">Viewer@123456</code>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard('Viewer@123456', 'viewer_password')}
                          className="p-1 text-orange-600 hover:text-orange-800 transition-colors"
                        >
                          {copiedField === 'viewer_password' ? (
                            <CheckCheck className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quickFill('viewer_001', 'Viewer@123456')}
                      className="w-full text-xs text-orange-600 hover:text-orange-800 py-1 hover:bg-orange-50 rounded transition-colors"
                    >
                      快速填充
                    </button>
                    <div className="text-xs text-orange-600 mt-1">
                      黑牛食品测试工厂 - 查看者
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>
        </div>

        {/* 登录表单 */}
        <Card className="p-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 用户名输入 */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-700">
                用户名
              </label>
              <Input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="请输入用户名"
                className={`transition-all ${
                  errors.username
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username}</p>
              )}
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="请输入密码"
                  className={`pr-10 transition-all ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                  }`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>


            {/* 登录按钮 */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  登录中...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  登录
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              )}
            </Button>
          </form>
        </Card>

        {/* 注册链接 */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            还没有账号？
            <button
              onClick={() => router.push('/register')}
              className="ml-1 text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
            >
              立即注册
            </button>
          </p>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p>食品溯源系统 v2.0.0</p>
            <p>基于 Next.js + TypeScript + TailwindCSS</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>系统运行正常</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
