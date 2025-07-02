/**
 * @module HomePage
 * @description 食品溯源系统 - 根页面路由控制
 * @version 3.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkAuthenticationStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuthenticationStatus = async () => {
    try {
      setIsLoading(true);
      setAuthStatus('checking');

      // 检查本地存储中的认证信息
      const token = localStorage.getItem('auth_token');
      const userInfo = localStorage.getItem('user_info');

      if (token && userInfo) {
        try {
          const userData = JSON.parse(userInfo);
          setUser(userData);
          setAuthStatus('authenticated');

          // 根据用户角色重定向到相应页面
          await handleAuthenticatedRedirect(userData);
        } catch (error) {
          console.error('用户信息解析失败:', error);
          // 清除无效的认证信息
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
          setAuthStatus('unauthenticated');
          handleUnauthenticatedRedirect();
        }
      } else {
        setAuthStatus('unauthenticated');
        handleUnauthenticatedRedirect();
      }
    } catch (error) {
      console.error('身份验证检查失败:', error);
      setAuthStatus('unauthenticated');
      handleUnauthenticatedRedirect();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthenticatedRedirect = async (userData: User) => {
    // 添加短暂延迟以显示欢迎信息
    setTimeout(() => {
      if (userData.role === 'admin') {
        console.log(`✅ 管理员登录 - 重定向到仪表板:`, userData.name);
        router.push('/admin/dashboard');
      } else {
        console.log(`✅ 用户登录 - 重定向到主页选择器:`, userData.name);
        router.push('/home/selector');
      }
    }, 1500);
  };

  const handleUnauthenticatedRedirect = () => {
    // 添加短暂延迟以显示提示信息
    setTimeout(() => {
      console.log('🔒 未认证用户 - 重定向到登录页面');
      router.push('/login');
    }, 1000);
  };

  const handleQuickAccess = (path: string) => {
    router.push(path);
  };

  // 加载状态
  if (isLoading || authStatus === 'checking') {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center space-y-6">
            {/* 应用Logo */}
            <div className="w-20 h-20 bg-[#1677FF] rounded-full flex items-center justify-center mx-auto">
              <div className="text-white text-3xl">🥬</div>
            </div>
            
            {/* 应用标题 */}
            <div>
              <h1 className="text-2xl font-bold text-[#00467F] mb-2">
                食品溯源系统
              </h1>
              <p className="text-sm text-gray-600">
                安全可信的食品溯源管理平台
              </p>
            </div>

            {/* 加载指示器 */}
            <div className="space-y-3">
              <Loading />
              <p className="text-sm text-gray-500">
                {authStatus === 'checking' ? '正在验证身份...' : '系统加载中...'}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 已认证用户 - 显示欢迎页面和重定向提示
  if (authStatus === 'authenticated' && user) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
        <main className="flex-1 bg-gradient-to-br from-green-50 to-blue-50 p-4">
          <div className="space-y-6 pt-16">
            {/* 欢迎卡片 */}
            <Card className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-green-600 text-2xl">✓</div>
              </div>
              
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                欢迎回来，{user.name}！
              </h2>
              
              <p className="text-sm text-gray-600 mb-1">
                身份验证成功
              </p>
              
              <div className="inline-block bg-[#E6F7FF] text-[#1890FF] text-xs px-2 py-1 rounded-full">
                {user.role === 'admin' ? '系统管理员' : '用户'}
              </div>
            </Card>

            {/* 重定向提示 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-3">
                <Loading className="w-4 h-4" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    正在跳转到工作台...
                  </p>
                  <p className="text-xs text-gray-500">
                    {user.role === 'admin' ? '管理员仪表板' : '功能选择页面'}
                  </p>
                </div>
              </div>
            </Card>

            {/* 快速访问选项 */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">或者直接访问：</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleQuickAccess('/demo')}
                  className="hover:shadow-md hover:scale-[1.03]"
                  aria-label="查看技术演示"
                >
                  🚀 技术演示
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleQuickAccess('/preview')}
                  className="hover:shadow-md hover:scale-[1.03]"
                  aria-label="查看预览系统"
                >
                  👁️ 预览系统
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 未认证用户 - 显示登录引导页面
  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      <main className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="space-y-6 pt-16">
          {/* 应用介绍卡片 */}
          <Card className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="w-20 h-20 bg-[#1677FF] rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-white text-3xl">🥬</div>
            </div>
            
            <h1 className="text-2xl font-bold text-[#00467F] mb-2">
              食品溯源系统
            </h1>
            
            <p className="text-sm text-gray-600 mb-6">
              安全可信的食品溯源管理平台
              <br />
              从农场到餐桌的全链路追踪
            </p>

            <div className="space-y-3">
              <Button
                variant="primary"
                size="large"
                onClick={() => handleQuickAccess('/login')}
                className="w-full hover:shadow-md hover:scale-[1.03]"
                aria-label="前往登录页面"
              >
                立即登录
              </Button>
              
              <Button
                variant="secondary"
                size="medium"
                onClick={() => handleQuickAccess('/register')}
                className="w-full hover:shadow-md hover:scale-[1.03]"
                aria-label="注册新账户"
              >
                注册账户
              </Button>
            </div>
          </Card>

          {/* 功能特色 */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🌱', title: '农业管理', desc: '种植跟踪' },
              { icon: '🏭', title: '加工管理', desc: '生产监控' },
              { icon: '🚛', title: '物流管理', desc: '运输追踪' },
              { icon: '🔍', title: '溯源查询', desc: '信息追溯' },
            ].map((feature, index) => (
              <Card key={index} className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="text-sm font-medium text-gray-900">{feature.title}</h3>
                <p className="text-xs text-gray-600">{feature.desc}</p>
              </Card>
            ))}
          </div>

          {/* 快速体验 */}
          <Card className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              🎯 快速体验
            </h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="small"
                onClick={() => handleQuickAccess('/demo')}
                className="w-full justify-start hover:shadow-md hover:scale-[1.03]"
                aria-label="查看技术演示"
              >
                🚀 技术栈演示
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() => handleQuickAccess('/preview')}
                className="w-full justify-start hover:shadow-md hover:scale-[1.03]"
                aria-label="查看预览系统"
              >
                👁️ 页面预览系统
              </Button>
            </div>
          </Card>

          {/* 系统状态 */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              🔒 正在重定向到登录页面...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
