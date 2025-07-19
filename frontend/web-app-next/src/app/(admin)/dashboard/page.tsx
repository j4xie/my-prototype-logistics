'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  totalOrders: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
  uptime: number;
}

interface RecentActivity {
  id: string;
  type: 'user_login' | 'order_created' | 'system_alert' | 'data_backup';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

interface SystemModule {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  users: number;
  icon: string;
  color: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    // 在开发环境下，可以跳过管理员权限检查，或者使用Mock用户的角色
    if (process.env.NODE_ENV !== 'development') {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo) {
    try {
      const user = JSON.parse(userInfo);
      if (user.role !== 'admin') {
        router.push('/home/selector');
        return;
      }
    } catch {
          router.push('/login');
      return;
        }
      }
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockMetrics: DashboardMetrics = {
        totalUsers: 1248,
        activeUsers: 892,
        totalProducts: 3567,
        totalOrders: 15234,
        systemHealth: 'good',
        uptime: 99.8
      };

      const mockActivities: RecentActivity[] = [
        {
          id: 'A001',
          type: 'user_login',
          message: '用户 张三 登录系统',
          timestamp: '2024-06-14 14:30:00',
          severity: 'info'
        },
        {
          id: 'A002',
          type: 'order_created',
          message: '新订单 ORDER2024001 已创建',
          timestamp: '2024-06-14 14:25:00',
          severity: 'info'
        },
        {
          id: 'A003',
          type: 'system_alert',
          message: '养殖场温度异常告警',
          timestamp: '2024-06-14 14:20:00',
          severity: 'warning'
        },
        {
          id: 'A004',
          type: 'data_backup',
          message: '数据备份任务完成',
          timestamp: '2024-06-14 14:15:00',
          severity: 'info'
        }
      ];

      const mockModules: SystemModule[] = [
        {
          id: 'farming',
          name: '养殖管理',
          status: 'online',
          users: 156,
          icon: 'fas fa-seedling',
          color: '#52C41A'
        },
        {
          id: 'processing',
          name: '生产加工',
          status: 'online',
          users: 89,
          icon: 'fas fa-industry',
          color: '#FA8C16'
        },
        {
          id: 'logistics',
          name: '物流配送',
          status: 'online',
          users: 234,
          icon: 'fas fa-truck',
          color: '#1677FF'
        },
        {
          id: 'trace',
          name: '溯源查询',
          status: 'maintenance',
          users: 0,
          icon: 'fas fa-search',
          color: '#722ED1'
        }
      ];

      setMetrics(mockMetrics);
      setActivities(mockActivities);
      setModules(mockModules);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return { bg: '#F6FFED', text: '#52C41A', label: '优秀' };
      case 'good':
        return { bg: '#E6F7FF', text: '#1677FF', label: '良好' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      case 'critical':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '严重' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return { bg: '#F6FFED', text: '#52C41A', label: '在线' };
      case 'offline':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '离线' };
      case 'maintenance':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '维护' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return '#1677FF';
      case 'warning':
        return '#FA8C16';
      case 'error':
        return '#FF4D4F';
      default:
        return '#8C8C8C';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-[#722ED1] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载管理数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#722ED1] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">管理后台</h1>
          <button
            onClick={() => router.push('/admin/settings')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 系统概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-tachometer-alt text-[#722ED1] mr-2"></i>
                系统概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {metrics.totalUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总用户数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.activeUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">活跃用户</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.totalProducts.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">产品总数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.totalOrders.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">订单总数</div>
                </div>
              </div>

              {/* 系统健康状态 */}
              <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8c8c8c]">系统健康度</span>
                  <div className="flex items-center space-x-2">
                    <div
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: getHealthColor(metrics.systemHealth).bg,
                        color: getHealthColor(metrics.systemHealth).text
                      }}
                    >
                      {getHealthColor(metrics.systemHealth).label}
                    </div>
                    <span className="text-sm font-medium text-[#262626]">{metrics.uptime}%</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/admin/users')}
              className="h-12 bg-[#1677FF] hover:bg-[#4096FF] text-white"
            >
              <i className="fas fa-users mr-2"></i>
              用户管理
            </Button>
            <Button
              onClick={() => router.push('/admin/system')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-server mr-2"></i>
              系统监控
            </Button>
          </div>

          {/* 模块状态 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="font-medium text-[#262626] mb-3 flex items-center">
              <i className="fas fa-th-large text-[#722ED1] mr-2"></i>
              模块状态
            </h3>
            <div className="space-y-3">
              {modules.map((module) => {
                const statusInfo = getStatusColor(module.status);

                return (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-3 bg-[#fafafa] rounded-md hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/modules/${module.id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${module.color}15` }}
                      >
                        <i className={`${module.icon} text-lg`} style={{ color: module.color }}></i>
                      </div>
                      <div>
                        <h4 className="font-medium text-[#262626]">{module.name}</h4>
                        <p className="text-sm text-[#8c8c8c]">{module.users} 在线用户</p>
                      </div>
                    </div>
                    <div
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                    >
                      {statusInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 最近活动 */}
          <Card className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-medium text-[#262626] mb-3 flex items-center">
              <i className="fas fa-history text-[#722ED1] mr-2"></i>
              最近活动
            </h3>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: getSeverityColor(activity.severity) }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#262626] mb-1">{activity.message}</p>
                    <p className="text-xs text-[#8c8c8c]">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
              <Button
                onClick={() => router.push('/admin/logs')}
                className="w-full h-10 bg-[#f5f5f5] hover:bg-[#e6f7ff] text-[#1677FF] border-0"
              >
                查看全部日志
                <i className="fas fa-chevron-right ml-2"></i>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
