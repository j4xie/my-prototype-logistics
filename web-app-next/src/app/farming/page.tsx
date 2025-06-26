'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  StatCard,
  PageLayout,
  MobileNav,
  Loading
} from '@/components/ui';

interface FarmingStats {
  totalFields: number;
  activeCrops: number;
  harvestReady: number;
  totalActivities: number;
  monthlyYield: number;
  pendingTasks: number;
}

export default function FarmingPage() {
  const [stats, setStats] = useState<FarmingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarmingStats();
  }, []);

  const fetchFarmingStats = async () => {
    try {
      const response = await fetch('/api/farming');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        // Fallback mock data
        setStats({
          totalFields: 12,
          activeCrops: 8,
          harvestReady: 3,
          totalActivities: 25,
          monthlyYield: 2450,
          pendingTasks: 7
        });
      }
    } catch (error) {
      console.error('获取农业统计数据失败:', error);
      // Fallback mock data
      setStats({
        totalFields: 12,
        activeCrops: 8,
        harvestReady: 3,
        totalActivities: 25,
        monthlyYield: 2450,
        pendingTasks: 7
      });
    } finally {
      setLoading(false);
    }
  };

  const navigationItems = [
    {
      title: '田地管理',
      description: '管理农田信息和状态',
      href: '/farming/fields',
      icon: '🌾',
      count: stats?.totalFields
    },
    {
      title: '作物管理',
      description: '作物种类和生长状态',
      href: '/farming/crops',
      icon: '🌱',
      count: stats?.activeCrops
    },
    {
      title: '种植计划',
      description: '制定和管理种植计划',
      href: '/farming/planting-plans',
      icon: '📋',
      count: '5个计划'
    },
    {
      title: '农事活动',
      description: '记录日常农事活动',
      href: '/farming/farm-activities',
      icon: '🚜',
      count: stats?.totalActivities
    },
    {
      title: '收获记录',
      description: '收获数据和质量记录',
      href: '/farming/harvest-records',
      icon: '📦',
      count: stats?.harvestReady
    },
    {
      title: '创建溯源',
      description: '创建新的溯源记录',
      href: '/farming/create-trace',
      icon: '🏷️',
      primary: true
    }
  ];

  if (loading) {
    return (
      <PageLayout title="农业管理" className="flex items-center justify-center min-h-screen">
        <Loading text="加载农业数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="农业管理"
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
            <MobileNav
        title="农业管理"
      />

      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">农业概览</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              title="田地总数"
              value={stats?.totalFields || 0}
              trend={{ value: 5, direction: "up", label: "较上月" }}
              className="bg-green-50 border-green-200"
            />
            <StatCard
              title="活跃作物"
              value={stats?.activeCrops || 0}
              trend={{ value: 2, direction: "up", label: "新增" }}
              className="bg-blue-50 border-blue-200"
            />
            <StatCard
              title="待收获"
              value={stats?.harvestReady || 0}
              className="bg-orange-50 border-orange-200"
            />
            <StatCard
              title="本月产量"
              value={stats?.monthlyYield || 0}
              trend={{ value: 15, direction: "up", label: "较上月%" }}
              className="bg-purple-50 border-purple-200"
            />
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => window.location.href = '/farming/create-trace'}
              variant="primary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">🏷️</span>
              <span className="text-sm">创建溯源</span>
            </Button>
            <Button
              onClick={() => window.location.href = '/farming/farm-activities'}
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">📝</span>
              <span className="text-sm">记录活动</span>
            </Button>
          </div>
        </div>

        {/* 功能导航 */}
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-gray-800 mb-3">功能模块</h3>
          {navigationItems.map((item, index) => (
            <Card
              key={index}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => window.location.href = item.href}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {item.count && (
                    <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {item.count}
                    </span>
                  )}
                  <span className="text-gray-400">›</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 待办事项提醒 */}
        {stats?.pendingTasks && stats.pendingTasks > 0 && (
          <Card className="bg-yellow-50 border-yellow-200 p-4 mt-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-medium text-yellow-800">待办提醒</h4>
                <p className="text-sm text-yellow-700">
                  您有 {stats.pendingTasks} 个待处理的农事任务
                </p>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => window.location.href = '/farming/farm-activities'}
                className="ml-auto border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                查看
              </Button>
            </div>
          </Card>
        )}
      </main>
    </PageLayout>
  );
}
