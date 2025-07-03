'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { AdminLayoutWrapper } from '@/components/admin';

interface DashboardStats {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    userGrowthRate: number;
  };
  systemStats: {
    totalProducts: number;
    tracedProducts: number;
    certificates: number;
    systemHealth: 'healthy' | 'warning' | 'error';
  };
  businessStats: {
    dailyQueries: number;
    totalQueries: number;
    avgResponseTime: number;
    successRate: number;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 模拟加载数据
        await new Promise(resolve => setTimeout(resolve, 1000));

        setStats({
          userStats: {
            totalUsers: 1247,
            activeUsers: 892,
            newUsersToday: 23,
            userGrowthRate: 12.5
          },
          systemStats: {
            totalProducts: 5628,
            tracedProducts: 5425,
            certificates: 4892,
            systemHealth: 'healthy'
          },
          businessStats: {
            dailyQueries: 342,
            totalQueries: 28765,
            avgResponseTime: 245,
            successRate: 99.7
          }
        });
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
        <div className="flex justify-center items-center min-h-screen">
          <Loading />
        </div>
      </AdminLayoutWrapper>
    );
  }

  if (!stats) {
    return (
      <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-lg text-red-600">加载数据失败</div>
        </div>
      </AdminLayoutWrapper>
    );
  }

  return (
    <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">管理仪表板</h1>
          <div className="w-8 h-8"></div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 用户统计 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">用户统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1890FF]">{stats.userStats.totalUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-600">总用户数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.userStats.activeUsers.toLocaleString()}</p>
              <p className="text-sm text-gray-600">活跃用户</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.userStats.newUsersToday}</p>
              <p className="text-sm text-gray-600">今日新增</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">+{stats.userStats.userGrowthRate}%</p>
              <p className="text-sm text-gray-600">增长率</p>
            </div>
          </div>
        </Card>

        {/* 系统统计 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">系统统计</h3>
            <Badge variant="success">正常</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xl font-bold text-[#1890FF]">{stats.systemStats.totalProducts.toLocaleString()}</p>
              <p className="text-xs text-gray-600">产品总数</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{stats.systemStats.tracedProducts.toLocaleString()}</p>
              <p className="text-xs text-gray-600">可溯源</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-600">{stats.systemStats.certificates.toLocaleString()}</p>
              <p className="text-xs text-gray-600">证书数</p>
            </div>
          </div>
        </Card>

        {/* 业务统计 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">业务统计</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">今日查询量</span>
              <span className="text-lg font-semibold text-[#1890FF]">{stats.businessStats.dailyQueries.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">累计查询量</span>
              <span className="text-lg font-semibold text-green-600">{stats.businessStats.totalQueries.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">平均响应时间</span>
              <span className="text-lg font-semibold text-orange-600">{stats.businessStats.avgResponseTime}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">成功率</span>
              <span className="text-lg font-semibold text-green-600">{stats.businessStats.successRate}%</span>
            </div>
          </div>
        </Card>

        {/* 快速操作 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => router.push('/admin/users')}
              variant="primary"
              className="text-sm"
            >
              用户管理
            </Button>
            <Button
              onClick={() => router.push('/admin/system')}
              variant="secondary"
              className="text-sm"
            >
              系统设置
            </Button>
            <Button
              onClick={() => router.push('/admin/reports')}
              variant="secondary"
              className="text-sm"
            >
              数据报表
            </Button>
            <Button
              onClick={() => router.push('/admin/monitoring')}
              variant="secondary"
              className="text-sm"
            >
              系统监控
            </Button>
          </div>
        </Card>
      </main>
    </div>
    </AdminLayoutWrapper>
  );
}
