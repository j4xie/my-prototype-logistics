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

interface ProcessingStats {
  totalBatches: number;
  activeBatches: number;
  qualityTests: number;
  finishedProducts: number;
  monthlyOutput: number;
  pendingInspections: number;
}

export default function ProcessingPage() {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcessingStats();
  }, []);

  const fetchProcessingStats = async () => {
    try {
      const response = await fetch('/api/processing');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        // Fallback mock data
        setStats({
          totalBatches: 45,
          activeBatches: 12,
          qualityTests: 28,
          finishedProducts: 156,
          monthlyOutput: 3200,
          pendingInspections: 5
        });
      }
    } catch (error) {
      console.error('获取加工统计数据失败:', error);
      // Fallback mock data
      setStats({
        totalBatches: 45,
        activeBatches: 12,
        qualityTests: 28,
        finishedProducts: 156,
        monthlyOutput: 3200,
        pendingInspections: 5
      });
    } finally {
      setLoading(false);
    }
  };

  const navigationItems = [
    {
      title: '原料管理',
      description: '管理加工原料和库存',
      href: '/processing/raw-materials',
      icon: '🥩',
      count: '15种原料'
    },
    {
      title: '生产批次',
      description: '生产批次管理和跟踪',
      href: '/processing/production-batches',
      icon: '🏭',
      count: stats?.activeBatches
    },
    {
      title: '质量检测',
      description: '质检报告和测试管理',
      href: '/processing/quality-tests',
      icon: '🔬',
      count: stats?.qualityTests
    },
    {
      title: '成品管理',
      description: '成品库存和出库管理',
      href: '/processing/finished-products',
      icon: '📦',
      count: stats?.finishedProducts
    },
    {
      title: '质检报告',
      description: '查看和管理质检报告',
      href: '/processing/reports',
      icon: '📋',
      primary: true
    },
    {
      title: '加工拍照',
      description: '加工过程拍照记录',
      href: '/processing/photos',
      icon: '📷'
    }
  ];

  if (loading) {
    return (
      <PageLayout title="加工管理" className="flex items-center justify-center min-h-screen">
        <Loading text="加载加工数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="加工管理"
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <MobileNav
        title="加工管理"
      />

      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">加工概览</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              title="总批次"
              value={stats?.totalBatches || 0}
              trend={{ value: 8, direction: "up", label: "较上月" }}
              className="bg-blue-50 border-blue-200"
            />
            <StatCard
              title="生产中"
              value={stats?.activeBatches || 0}
              className="bg-orange-50 border-orange-200"
            />
            <StatCard
              title="质检完成"
              value={stats?.qualityTests || 0}
              trend={{ value: 12, direction: "up", label: "较上月" }}
              className="bg-green-50 border-green-200"
            />
            <StatCard
              title="本月产量"
              value={stats?.monthlyOutput || 0}
              trend={{ value: 20, direction: "up", label: "较上月%" }}
              className="bg-purple-50 border-purple-200"
            />
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => window.location.href = '/processing/production-batches'}
              variant="primary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">🏭</span>
              <span className="text-sm">新建批次</span>
            </Button>
            <Button
              onClick={() => window.location.href = '/processing/quality-tests'}
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">🔬</span>
              <span className="text-sm">质量检测</span>
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

        {/* 质检提醒 */}
        {stats?.pendingInspections && stats.pendingInspections > 0 && (
          <Card className="bg-red-50 border-red-200 p-4 mt-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚨</span>
              <div>
                <h4 className="font-medium text-red-800">质检提醒</h4>
                <p className="text-sm text-red-700">
                  有 {stats.pendingInspections} 个批次待质检
                </p>
              </div>
              <Button
                variant="danger"
                size="small"
                onClick={() => window.location.href = '/processing/quality-tests'}
                className="ml-auto"
              >
                立即处理
              </Button>
            </div>
          </Card>
        )}

        {/* 生产状态 */}
        <Card className="bg-blue-50 border-blue-200 p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-800">生产状态</h4>
              <p className="text-sm text-blue-700">
                当前有 {stats?.activeBatches || 0} 个批次正在生产
              </p>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => window.location.href = '/processing/production-batches'}
            >
              查看详情
            </Button>
          </div>
        </Card>
      </main>
    </PageLayout>
  );
}
