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
import { Eye, Monitor, Grid, ArrowRight } from 'lucide-react';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // 只在访问根路径时进行认证检测和自动跳转
    if (window.location.pathname === '/') {
    checkAuthenticationStatus();
    } else {
      // 如果不是根路径，直接显示预览页面（虽然这个组件通常不会在其他路径显示）
      setIsLoading(false);
      setShowPreview(true);
    }
  }, []);

  const checkAuthenticationStatus = async () => {
    try {
      setIsLoading(true);

      // 检查本地存储中的认证信息
      const token = localStorage.getItem('auth_token');
      const userInfo = localStorage.getItem('user_info');

      if (token && userInfo) {
        try {
          const userData = JSON.parse(userInfo);

          // 根据用户角色重定向到相应页面
          if (userData.role?.level === 0 || userData.role?.name === 'PLATFORM_ADMIN' || userData.username === 'super_admin') {
            console.log(`✅ 平台超级管理员登录 - 重定向到平台管理:`, userData.name || userData.username);
            router.push('/platform');
          } else {
            console.log(`✅ 工厂用户登录 - 重定向到模块选择器:`, userData.name || userData.username);
            router.push('/home/selector');
          }
        } catch (error) {
          console.error('用户信息解析失败:', error);
          // 清除无效的认证信息
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
          // 显示预览选项而不是直接跳转
          setShowPreview(true);
        }
      } else {
        // 未认证用户显示预览选项
        console.log('🔒 未认证用户 - 显示登录和预览选项');
        setShowPreview(true);
      }
    } catch (error) {
      console.error('身份验证检查失败:', error);
      // 发生错误时显示预览选项
      setShowPreview(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 如果显示预览选项
  if (showPreview && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* 应用Logo和标题 */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <i className="fas fa-leaf text-white text-3xl"></i>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                食品溯源系统
              </h1>
              <p className="text-gray-600">
                安全可信的食品溯源管理平台
              </p>
            </div>
          </div>

          {/* 功能卡片 */}
          <div className="space-y-4">
            {/* 预览系统卡片 - 主要入口 */}
            <Card className="p-6 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all duration-300 cursor-pointer group"
                  onClick={() => router.push('/preview')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      🎭 系统预览
                    </h3>
                    <p className="text-sm text-gray-600">
                      查看102个页面完整预览
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
              </div>

              {/* 预览功能说明 */}
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Grid className="w-3 h-3" />
                    <span>5种预览模式</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Monitor className="w-3 h-3" />
                    <span>响应式设计</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span>无需登录</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                    <span>实时演示</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 工厂管理登录入口 */}
            <Card className="p-4 border-2 border-green-200 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition-all duration-300 cursor-pointer"
                  onClick={() => router.push('/login')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <i className="fas fa-sign-in-alt text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">工厂管理登录</h3>
                    <p className="text-sm text-gray-500">访问完整系统功能</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-green-400" />
              </div>
            </Card>
          </div>

          {/* 系统信息 */}
          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>🚀 Phase-3 现代化预览系统</p>
            <p>基于 Next.js 15.3.2 构建</p>
          </div>
        </div>
      </div>
    );
  }

  // 原来的加载页面
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center space-y-4">
        {/* 应用Logo */}
        <div className="w-16 h-16 bg-[#1677FF] rounded-full flex items-center justify-center mx-auto">
          <i className="fas fa-leaf text-white text-2xl"></i>
        </div>

        {/* 应用标题 */}
        <h1 className="text-2xl font-bold text-[#00467F]">
          食品溯源系统
        </h1>
        <p className="text-gray-600 text-sm">
          安全可信的食品溯源管理平台
        </p>

        {/* 加载指示器 */}
        <div className="space-y-3">
          <Loading />
          <p className="text-sm text-gray-500">
            正在验证身份...
          </p>
        </div>
      </div>
    </div>
  );
}
