'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LogisticsOrder {
  id: string;
  orderNumber: string;
  productName: string;
  origin: string;
  destination: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed';
  driver: string;
  vehicle: string;
  estimatedTime: string;
  actualTime?: string;
  progress: number;
}

interface LogisticsMetrics {
  totalOrders: number;
  inTransitOrders: number;
  deliveredToday: number;
  onTimeRate: number;
}

export default function LogisticsTrackingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [metrics, setMetrics] = useState<LogisticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

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
      
      const mockOrders: LogisticsOrder[] = [
        {
          id: 'LO001',
          orderNumber: 'ORDER2024001',
          productName: '有机猪肉制品',
          origin: '济南加工厂',
          destination: '青岛配送中心',
          status: 'in_transit',
          driver: '李师傅',
          vehicle: '鲁A12345',
          estimatedTime: '2024-06-14 16:00',
          progress: 65
        },
        {
          id: 'LO002',
          orderNumber: 'ORDER2024002',
          productName: '优质牛肉制品',
          origin: '烟台加工厂',
          destination: '威海超市',
          status: 'delivered',
          driver: '张师傅',
          vehicle: '鲁B67890',
          estimatedTime: '2024-06-14 14:00',
          actualTime: '2024-06-14 13:45',
          progress: 100
        },
        {
          id: 'LO003',
          orderNumber: 'ORDER2024003',
          productName: '精品羊肉制品',
          origin: '潍坊加工厂',
          destination: '济宁配送中心',
          status: 'delayed',
          driver: '王师傅',
          vehicle: '鲁C11111',
          estimatedTime: '2024-06-14 15:30',
          progress: 45
        }
      ];

      const mockMetrics: LogisticsMetrics = {
        totalOrders: 25,
        inTransitOrders: 8,
        deliveredToday: 12,
        onTimeRate: 94.5
      };

      setOrders(mockOrders);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return { bg: '#F6FFED', text: '#52C41A', label: '已送达' };
      case 'in_transit':
        return { bg: '#E6F7FF', text: '#1677FF', label: '运输中' };
      case 'pending':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '待发货' };
      case 'delayed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '延误' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const filteredOrders = selectedStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedStatus);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载物流数据...'}
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
          <h1 className="text-lg font-semibold">物流跟踪</h1>
          <button
            onClick={() => router.push('/home/selector')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">
          
          {/* 统计概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-truck text-[#1677FF] mr-2"></i>
                物流概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.totalOrders}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总订单</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.inTransitOrders}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">运输中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.deliveredToday}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日送达</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {metrics.onTimeRate}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">准点率</div>
                </div>
              </div>
            </Card>
          )}

          {/* 状态筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部', count: orders.length },
                { key: 'pending', label: '待发货', count: orders.filter(o => o.status === 'pending').length },
                { key: 'in_transit', label: '运输中', count: orders.filter(o => o.status === 'in_transit').length },
                { key: 'delivered', label: '已送达', count: orders.filter(o => o.status === 'delivered').length },
                { key: 'delayed', label: '延误', count: orders.filter(o => o.status === 'delayed').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedStatus(filter.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedStatus === filter.key
                      ? 'bg-[#1677FF] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                    }
                  `}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className="ml-1 text-xs">({filter.count})</span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/logistics/dispatch')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-plus mr-2"></i>
              新建订单
            </Button>
            <Button
              onClick={() => router.push('/logistics/vehicles')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-car mr-2"></i>
              车辆管理
            </Button>
          </div>

          {/* 物流订单列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">运输订单</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredOrders.length} 条</span>
            </div>

            {filteredOrders.map((order) => {
              const statusInfo = getStatusColor(order.status);
              
              return (
                <Card
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/logistics/detail/${order.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1">{order.productName}</h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-barcode mr-1"></i>
                          订单: {order.orderNumber}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-route mr-1"></i>
                          {order.origin} → {order.destination}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* 运输进度 */}
                    {order.status === 'in_transit' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#8c8c8c]">运输进度</span>
                          <span className="text-sm font-medium text-[#262626]">{order.progress}%</span>
                        </div>
                        <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                          <div
                            className="bg-[#1677FF] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${order.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* 运输信息 */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                      <div className="text-center">
                        <div className="text-sm font-medium text-[#262626] mb-1">
                          {order.driver}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">司机</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-[#262626] mb-1">
                          {order.vehicle}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">车牌</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          order.status === 'delivered' ? 'text-[#52C41A]' :
                          order.status === 'delayed' ? 'text-[#FF4D4F]' : 'text-[#262626]'
                        }`}>
                          {order.actualTime || order.estimatedTime.split(' ')[1]}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">
                          {order.actualTime ? '实际送达' : '预计送达'}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredOrders.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-truck text-[#d9d9d9] text-3xl mb-3"></i>
                <p className="text-[#8c8c8c] mb-2">暂无相关订单</p>
                <p className="text-sm text-[#bfbfbf]">请选择其他状态或创建新的运输订单</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 