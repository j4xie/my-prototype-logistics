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

interface LogisticsStats {
  totalWarehouses: number;
  activeVehicles: number;
  transportOrders: number;
  deliveryRate: number;
  monthlyVolume: number;
  pendingOrders: number;
}

export default function LogisticsPage() {
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogisticsStats();
  }, []);

  const fetchLogisticsStats = async () => {
    try {
      const response = await fetch('/api/logistics');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        // Fallback mock data
        setStats({
          totalWarehouses: 8,
          activeVehicles: 15,
          transportOrders: 89,
          deliveryRate: 96.5,
          monthlyVolume: 1560,
          pendingOrders: 12
        });
      }
    } catch (error) {
      console.error('获取物流统计数据失败:', error);
      // Fallback mock data
      setStats({
        totalWarehouses: 8,
        activeVehicles: 15,
        transportOrders: 89,
        deliveryRate: 96.5,
        monthlyVolume: 1560,
        pendingOrders: 12
      });
    } finally {
      setLoading(false);
    }
  };

  const navigationItems = [
    {
      title: '仓库管理',
      description: '仓库库存和存储管理',
      href: '/logistics/warehouses',
      icon: '🏪',
      count: stats?.totalWarehouses
    },
    {
      title: '车辆管理',
      description: '运输车辆和司机管理',
      href: '/logistics/vehicles',
      icon: '🚚',
      count: stats?.activeVehicles
    },
    {
      title: '运输订单',
      description: '物流订单管理和跟踪',
      href: '/logistics/transport-orders',
      icon: '📋',
      count: stats?.transportOrders
    },
    {
      title: '司机管理',
      description: '司机信息和调度管理',
      href: '/logistics/drivers',
      icon: '👨‍✈️',
      count: '25人'
    },
    {
      title: '库存管理',
      description: '库存查询和盘点管理',
      href: '/logistics/inventory',
      icon: '📦',
      primary: true
    },
    {
      title: '配送跟踪',
      description: '实时配送状态跟踪',
      href: '/logistics/tracking',
      icon: '📍'
    }
  ];

  if (loading) {
    return (
      <PageLayout title="物流管理" className="flex items-center justify-center min-h-screen">
        <Loading text="加载物流数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="物流管理"
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <MobileNav
        title="物流管理"
      />

      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">物流概览</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              title="仓库数量"
              value={stats?.totalWarehouses || 0}
              trend={{ value: 2, direction: "up", label: "新增" }}
              className="bg-blue-50 border-blue-200"
            />
            <StatCard
              title="运营车辆"
              value={stats?.activeVehicles || 0}
              className="bg-green-50 border-green-200"
            />
            <StatCard
              title="配送成功率"
              value={stats?.deliveryRate || 0}
              trend={{ value: 2.5, direction: "up", label: "较上月%" }}
              className="bg-purple-50 border-purple-200"
            />
            <StatCard
              title="月运输量"
              value={stats?.monthlyVolume || 0}
              trend={{ value: 18, direction: "up", label: "较上月%" }}
              className="bg-orange-50 border-orange-200"
            />
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => window.location.href = '/logistics/transport-orders'}
              variant="primary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">📋</span>
              <span className="text-sm">新建订单</span>
            </Button>
            <Button
              onClick={() => window.location.href = '/logistics/tracking'}
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center"
            >
              <span className="text-xl mb-1">📍</span>
              <span className="text-sm">配送跟踪</span>
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

        {/* 待处理订单提醒 */}
        {stats?.pendingOrders && stats.pendingOrders > 0 && (
          <Card className="bg-orange-50 border-orange-200 p-4 mt-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">📋</span>
              <div>
                <h4 className="font-medium text-orange-800">待处理订单</h4>
                <p className="text-sm text-orange-700">
                  有 {stats.pendingOrders} 个订单待安排配送
                </p>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => window.location.href = '/logistics/transport-orders'}
                className="ml-auto"
              >
                立即处理
              </Button>
            </div>
          </Card>
        )}

        {/* 车辆状态 */}
        <Card className="bg-green-50 border-green-200 p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-800">车辆状态</h4>
              <p className="text-sm text-green-700">
                {stats?.activeVehicles || 0} 辆车正在运营中
              </p>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => window.location.href = '/logistics/vehicles'}
            >
              查看详情
            </Button>
          </div>
        </Card>

        {/* 配送效率 */}
        <Card className="bg-purple-50 border-purple-200 p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-purple-800">配送效率</h4>
              <p className="text-sm text-purple-700">
                当前配送成功率 {stats?.deliveryRate || 0}%
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-purple-600">
                {stats?.deliveryRate || 0}%
              </span>
            </div>
          </div>
        </Card>
      </main>
    </PageLayout>
  );
}
