'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Settings, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// 导入子组件
import OverviewCards from './components/OverviewCards';
import FactoriesTable from './components/FactoriesTable';
import CreateFactoryModal from './components/CreateFactoryModal';
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

          // 检查是否为平台管理员 - 修复判断逻辑
          if (userData.role?.name === 'PLATFORM_ADMIN' ||
              userData.username === 'platform_admin' ||
              userData.username === 'super_admin') {
            console.log('✅ 平台管理员权限验证通过:', userData.username);
            setIsInitializing(false);
            return;
          } else {
            console.log('❌ 非平台管理员，跳转到登录页面:', userData.username);
            router.push('/login');
            return;
          }
        } else {
          console.log('❌ 未登录，跳转到登录页面');
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('认证信息解析失败:', error);
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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                平台管理控制台
              </h1>
              <p className="text-gray-600 mt-1">
                管理所有工厂租户、订阅套餐和平台运营
              </p>
            </div>
            <div className="flex gap-3">
              {/* 新增工厂按钮已移到FactoriesTable组件内 */}
                             <Button variant="secondary" className="flex items-center gap-2">
                 <BarChart3 className="w-4 h-4" />
                 数据导出
               </Button>
               <Button variant="secondary" className="flex items-center gap-2">
                 <Settings className="w-4 h-4" />
                 平台设置
               </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <TabsContent value="dashboard" className="space-y-6">
            <OverviewCards />

            {/* 快速操作区域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    工厂管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">
                    创建、管理和监控所有工厂租户
                  </p>
                                     <Button
                     variant="secondary"
                     className="w-full"
                     onClick={() => setActiveTab('factories')}
                   >
                     查看工厂列表
                   </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-green-600" />
                    订阅套餐
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">
                    配置和管理各种订阅套餐方案
                  </p>
                                     <Button
                     variant="secondary"
                     className="w-full"
                     onClick={() => setActiveTab('plans')}
                   >
                     管理套餐
                   </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    系统日志
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">
                    查看平台所有操作和审计日志
                  </p>
                                     <Button
                     variant="secondary"
                     className="w-full"
                     onClick={() => setActiveTab('logs')}
                   >
                     查看日志
                   </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 工厂管理Tab */}
          <TabsContent value="factories">
            <FactoriesTable />
          </TabsContent>

          {/* 订阅套餐Tab */}
          <TabsContent value="plans">
            <PlansTable />
          </TabsContent>

          {/* 操作日志Tab */}
          <TabsContent value="logs">
                              <OperationLogTable />
          </TabsContent>
        </Tabs>
      </div>

      {/* 创建工厂弹窗 */}
      <CreateFactoryModal
        onSuccess={() => {
          // 刷新数据
          window.location.reload();
        }}
      />
    </div>
  );
}
