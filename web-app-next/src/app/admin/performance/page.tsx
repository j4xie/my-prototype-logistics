'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  threshold: number;
  description: string;
}

interface SystemResource {
  id: string;
  name: string;
  type: 'cpu' | 'memory' | 'disk' | 'network';
  usage: number;
  capacity: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  processes: number;
}

interface PerformanceOverview {
  totalRequests: number;
  responseTime: number;
  uptime: string;
  activeUsers: number;
}

export default function PerformancePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [resources, setResources] = useState<SystemResource[]>([]);
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'resources' | 'metrics'>('overview');

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证，开发环境已通过useMockAuth自动处理
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockMetrics: PerformanceMetric[] = [
        {
          id: 'M001',
          name: '响应时间',
          value: 245,
          unit: 'ms',
          status: 'good',
          trend: 'stable',
          threshold: 500,
          description: '平均API响应时间'
        },
        {
          id: 'M002',
          name: '吞吐量',
          value: 1280,
          unit: 'req/min',
          status: 'good',
          trend: 'up',
          threshold: 1000,
          description: '每分钟请求处理数量'
        },
        {
          id: 'M003',
          name: '错误率',
          value: 2.3,
          unit: '%',
          status: 'warning',
          trend: 'up',
          threshold: 1.0,
          description: '请求错误率'
        },
        {
          id: 'M004',
          name: '数据库响应',
          value: 89,
          unit: 'ms',
          status: 'good',
          trend: 'stable',
          threshold: 200,
          description: '数据库查询平均响应时间'
        }
      ];

      const mockResources: SystemResource[] = [
        {
          id: 'R001',
          name: 'CPU使用率',
          type: 'cpu',
          usage: 45.8,
          capacity: 100,
          unit: '%',
          status: 'healthy',
          processes: 156
        },
        {
          id: 'R002',
          name: '内存使用',
          type: 'memory',
          usage: 6.2,
          capacity: 8.0,
          unit: 'GB',
          status: 'warning',
          processes: 45
        },
        {
          id: 'R003',
          name: '磁盘使用',
          type: 'disk',
          usage: 128,
          capacity: 500,
          unit: 'GB',
          status: 'healthy',
          processes: 8
        },
        {
          id: 'R004',
          name: '网络流量',
          type: 'network',
          usage: 85.6,
          capacity: 1000,
          unit: 'Mbps',
          status: 'healthy',
          processes: 23
        }
      ];

      const mockOverview: PerformanceOverview = {
        totalRequests: 45673,
        responseTime: 245,
        uptime: '15天 8小时',
        activeUsers: 128
      };

      setMetrics(mockMetrics);
      setResources(mockResources);
      setOverview(mockOverview);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return { bg: '#F6FFED', text: '#52C41A', label: '正常' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      case 'critical':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '严重' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'fas fa-arrow-up text-[#52C41A]';
      case 'down':
        return 'fas fa-arrow-down text-[#FF4D4F]';
      case 'stable':
        return 'fas fa-minus text-[#8C8C8C]';
      default:
        return 'fas fa-minus text-[#8C8C8C]';
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'cpu':
        return 'fas fa-microchip';
      case 'memory':
        return 'fas fa-memory';
      case 'disk':
        return 'fas fa-hdd';
      case 'network':
        return 'fas fa-network-wired';
      default:
        return 'fas fa-server';
    }
  };

  const getUsagePercentage = (usage: number, capacity: number) => {
    return (usage / capacity) * 100;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-chart-line fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载性能数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">性能监控</h1>
          <button
            onClick={() => router.push('/admin')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 系统概览 */}
          {overview && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-tachometer-alt text-[#1677FF] mr-2"></i>
                系统概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {overview.totalRequests.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总请求数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {overview.responseTime}ms
                  </div>
                  <div className="text-sm text-[#8c8c8c]">响应时间</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {overview.uptime}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">运行时间</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {overview.activeUsers}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">活跃用户</div>
                </div>
              </div>
            </Card>
          )}

          {/* 标签页切换 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'overview'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-eye mr-1"></i>
                概览
              </button>
              <button
                onClick={() => setSelectedTab('resources')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'resources'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-server mr-1"></i>
                资源
              </button>
              <button
                onClick={() => setSelectedTab('metrics')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'metrics'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-chart-bar mr-1"></i>
                指标
              </button>
            </div>
          </Card>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/admin/performance/alerts')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-bell mr-2"></i>
              告警设置
            </Button>
            <Button
              onClick={() => router.push('/admin/performance/reports')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-file-alt mr-2"></i>
              性能报告
            </Button>
          </div>

          {/* 概览标签页 */}
          {selectedTab === 'overview' && (
            <div className="space-y-4">
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3">实时状态</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8c8c8c]">
                      <i className="fas fa-signal mr-2"></i>
                      服务状态
                    </span>
                    <span className="px-2 py-1 bg-[#F6FFED] text-[#52C41A] rounded text-xs font-medium">
                      运行中
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8c8c8c]">
                      <i className="fas fa-database mr-2"></i>
                      数据库状态
                    </span>
                    <span className="px-2 py-1 bg-[#F6FFED] text-[#52C41A] rounded text-xs font-medium">
                      正常
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8c8c8c]">
                      <i className="fas fa-shield-alt mr-2"></i>
                      安全状态
                    </span>
                    <span className="px-2 py-1 bg-[#F6FFED] text-[#52C41A] rounded text-xs font-medium">
                      安全
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3">今日统计</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-[#1677FF] mb-1">
                      2,845
                    </div>
                    <div className="text-sm text-[#8c8c8c]">今日请求</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-[#52C41A] mb-1">
                      99.2%
                    </div>
                    <div className="text-sm text-[#8c8c8c]">可用性</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-[#FA8C16] mb-1">
                      23
                    </div>
                    <div className="text-sm text-[#8c8c8c]">错误数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-[#722ED1] mb-1">
                      89
                    </div>
                    <div className="text-sm text-[#8c8c8c]">峰值用户</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 资源监控标签页 */}
          {selectedTab === 'resources' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">系统资源</h3>
                <span className="text-sm text-[#8c8c8c]">实时监控</span>
              </div>

              {resources.map((resource) => {
                const statusInfo = getStatusColor(resource.status);
                const usagePercentage = getUsagePercentage(resource.usage, resource.capacity);

                return (
                  <Card
                    key={resource.id}
                    className="bg-white rounded-lg shadow-sm p-4"
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className={`${getResourceIcon(resource.type)} text-[#1677FF] mr-2`}></i>
                            {resource.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c]">
                            使用: {resource.usage} / {resource.capacity} {resource.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-[#262626]">
                            {usagePercentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-[#8c8c8c]">
                            {resource.processes} 进程
                          </div>
                        </div>
                      </div>

                      {/* 使用率进度条 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#8c8c8c]">使用率</span>
                          <span className="text-sm font-medium text-[#262626]">{usagePercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              usagePercentage >= 90 ? 'bg-[#FF4D4F]' :
                              usagePercentage >= 75 ? 'bg-[#FA8C16]' : 'bg-[#52C41A]'
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 性能指标标签页 */}
          {selectedTab === 'metrics' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">性能指标</h3>
                <span className="text-sm text-[#8c8c8c]">共 {metrics.length} 个指标</span>
              </div>

              {metrics.map((metric) => {
                const statusInfo = getStatusColor(metric.status);
                const isExceedsThreshold = metric.value > metric.threshold;

                return (
                  <Card
                    key={metric.id}
                    className="bg-white rounded-lg shadow-sm p-4"
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            {metric.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            {metric.description}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            阈值: {metric.threshold} {metric.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-semibold mb-1 ${
                            isExceedsThreshold ? 'text-[#FF4D4F]' : 'text-[#262626]'
                          }`}>
                            {metric.value} {metric.unit}
                          </div>
                          <i className={getTrendIcon(metric.trend)}></i>
                        </div>
                      </div>

                      {/* 进度条（相对于阈值） */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#8c8c8c]">相对阈值</span>
                          <span className="text-sm font-medium text-[#262626]">
                            {((metric.value / metric.threshold) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isExceedsThreshold ? 'bg-[#FF4D4F]' :
                              (metric.value / metric.threshold) > 0.8 ? 'bg-[#FA8C16]' : 'bg-[#52C41A]'
                            }`}
                            style={{ width: `${Math.min((metric.value / metric.threshold) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
