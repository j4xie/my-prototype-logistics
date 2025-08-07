'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Settings, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { showUnderDevelopment } from '@/components/ui/under-development';

// 导入子组件
import OverviewCards from './components/OverviewCards';
import FactoriesTable from './components/FactoriesTable';
import PlansTable from './components/PlansTable';
import OperationLogTable from './components/OperationLog';

/**
 * 平台超级管理员控制台
 * 仅限 platform 级别用户访问
 */
export default function PlatformPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);

  // 权限检查 - 修复版本，支持平台管理员访问
  useEffect(() => {
    const initializeAuth = async () => {
      // 检查 localStorage 来确定认证状态
      const token = localStorage.getItem('auth_token');
      const userInfo = localStorage.getItem('user_info');

      try {
        if (token && userInfo) {
          const userData = JSON.parse(userInfo);

          console.log('🔍 [Platform] 权限验证开始:', {
            hasToken: !!token,
            hasUserInfo: !!userInfo,
            userData: userData,
            userDataKeys: Object.keys(userData || {}),
            roleStructure: {
              'role': userData.role,
              'role.name': userData.role?.name,
              'role.id': userData.role?.id,
              'username': userData.username,
              'permissions': userData.permissions,
              'permissions.modules': userData.permissions?.modules,
              'permissions.role': userData.permissions?.role,
              'platform_access': userData.permissions?.modules?.platform_access
            }
          });

          // 检查是否为平台管理员或开发者
          const conditions = {
            roleNamePlatform: userData.role?.name === 'PLATFORM_ADMIN',
            roleNameDeveloper: userData.role?.name === 'DEVELOPER',
            usernameAdmin: userData.username === 'platform_admin',
            usernameDev: userData.username === 'developer',
            permissionsPlatform: userData.permissions?.modules?.platform_access === true,
            permissionsRolePlatform: userData.permissions?.role === 'PLATFORM_ADMIN',
            permissionsRoleDeveloper: userData.permissions?.role === 'DEVELOPER'
          };

          console.log('🔍 [Platform] 权限条件检查:', conditions);

          const hasPermission = conditions.roleNamePlatform ||
                                conditions.roleNameDeveloper ||
                                conditions.usernameAdmin ||
                                conditions.usernameDev ||
                                conditions.permissionsPlatform ||
                                conditions.permissionsRolePlatform ||
                                conditions.permissionsRoleDeveloper;

          if (hasPermission) {
            console.log('✅ [Platform] 平台管理权限验证通过:', {
              username: userData.username,
              role: userData.role,
              permissions: userData.permissions,
              passedConditions: Object.entries(conditions).filter(([key, value]) => value).map(([key]) => key)
            });
            setIsInitializing(false);
            return;
          } else {
            console.log('❌ [Platform] 无平台管理权限，跳转到登录页面:', {
              username: userData.username,
              role: userData.role,
              permissions: userData.permissions,
              failedConditions: Object.entries(conditions).filter(([key, value]) => !value).map(([key]) => key),
              recommendedFix: '检查用户角色和权限配置'
            });
            router.push('/login');
            return;
          }
        } else {
          console.log('❌ [Platform] 未登录，跳转到登录页面:', {
            hasToken: !!token,
            hasUserInfo: !!userInfo,
            tokenLength: token?.length || 0,
            userInfoLength: userInfo?.length || 0
          });
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('❌ [Platform] 认证信息解析失败:', {
          error: error,
          errorMessage: error instanceof Error ? error.message : '未知错误',
          token: token ? '存在' : '不存在',
          userInfo: userInfo ? '存在' : '不存在',
          userInfoPreview: userInfo ? userInfo.substring(0, 100) + '...' : null
        });
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        router.push('/login');
        return;
      }
    };

    // 延迟一点时间确保状态正确初始化
    const timer = setTimeout(initializeAuth, 100);

    return () => clearTimeout(timer);
  }, [router]);

  // 如果还在初始化，显示loading
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证平台管理员权限...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 mt-16 md:mt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center py-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                平台管理控制台
              </h1>
              <p className="text-gray-600 mt-1">
                管理所有工厂租户、订阅套餐和平台运营
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex items-center gap-2 w-full sm:w-auto"
                onClick={() => {
                  showUnderDevelopment({
                    feature: '数据导出功能',
                    message: '数据导出功能正在开发中，包括工厂数据、用户统计和平台概览的导出。敬请期待！'
                  });
                }}
              >
                <BarChart3 className="w-4 h-4" />
                数据导出
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab导航 */}
          <TabsList className="grid w-full grid-cols-4 bg-white rounded-lg shadow-sm border">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <BarChart3 className="w-4 h-4" />
              概览仪表板
            </TabsTrigger>
            <TabsTrigger
              value="factories"
              className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <Building2 className="w-4 h-4" />
              工厂管理
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <Settings className="w-4 h-4" />
              订阅套餐
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              <Settings className="w-4 h-4" />
              操作日志
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6 mt-8">
            <OverviewCards />
          </TabsContent>

          {/* 工厂管理Tab */}
          <TabsContent value="factories" className="mt-8">
            <FactoriesTable />
          </TabsContent>

          {/* 订阅套餐Tab */}
          <TabsContent value="plans" className="mt-8">
            <PlansTable />
          </TabsContent>

          {/* 操作日志Tab */}
          <TabsContent value="logs" className="mt-8">
            <OperationLogTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
