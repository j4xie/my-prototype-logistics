'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, Database } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { PlatformOverview } from '@/mocks/data/platform-data';

/**
 * 平台概览卡片组件
 * 显示工厂数量、用户总数、收入统计等关键指标
 */
export default function OverviewCards() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await platformApi.overview.getOverview();
        setOverview(response.data);
      } catch (err) {
        console.error('获取概览数据失败:', err);
        setError(err instanceof Error ? err.message : '获取数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
  }, []);

  // 加载状态
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-6 w-6 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <span className="text-sm">⚠️ 加载失败: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 正常显示
  if (!overview) return null;

  const stats = [
    {
      title: '工厂总数',
      value: overview.total_factories,
      icon: Building2,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      change: `活跃: ${overview.active_factories} | 待审: ${overview.pending_factories}`,
      trend: 'neutral' as const
    },
    {
      title: '用户总数',
      value: overview.total_users,
      icon: Users,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      change: `月增长: ${overview.monthly_growth_rate}%`,
      trend: overview.monthly_growth_rate > 0 ? 'up' as const : 'down' as const
    },
    {
      title: '月收入',
      value: '功能尚未实现',
      icon: TrendingUp,
      iconColor: 'text-gray-400',
      iconBg: 'bg-gray-100',
      change: '统计功能开发中',
      trend: 'neutral' as const
    },
    {
      title: '数据使用量',
      value: '功能尚未实现',
      icon: Database,
      iconColor: 'text-gray-400',
      iconBg: 'bg-gray-100',
      change: '统计功能开发中',
      trend: 'neutral' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <Card
            key={index}
            className="hover:shadow-md transition-shadow duration-200"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.iconBg}`}>
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </div>
              <div className="flex items-center gap-1">
                {stat.trend === 'up' && (
                  <span className="text-green-600 text-sm">↗</span>
                )}
                {stat.trend === 'down' && (
                  <span className="text-red-600 text-sm">↘</span>
                )}
                <p className="text-xs text-gray-600">{stat.change}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
