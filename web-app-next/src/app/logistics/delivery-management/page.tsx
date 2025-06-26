'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDeliveryTime: string;
  actualDeliveryTime?: string;
  orderWeight: number; // in kg
  orderValue: number; // in yuan
  distance: number; // in km
  createdAt: string;
  updatedAt: string;
  notes?: string;
  productList: Array<{
    productName: string;
    quantity: number;
    unit: string;
  }>;
  trackingHistory: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
}

interface DeliveryStatistics {
  totalOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  deliveredToday: number;
  averageDeliveryTime: number; // in hours
  successRate: number; // percentage
}

interface Vehicle {
  id: string;
  plateNumber: string;
  driverName: string;
  status: 'available' | 'busy' | 'maintenance';
  currentLocation: string;
  capacity: number; // in kg
  currentLoad: number; // in kg
  lastUpdated: string;
}

export default function DeliveryManagementPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [statistics, setStatistics] = useState<DeliveryStatistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<'orders' | 'tracking' | 'vehicles'>('orders');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Mock配送订单数据
      const mockOrders: DeliveryOrder[] = [
        {
          id: 'delivery-001',
          orderNumber: 'DL-2025020201',
          status: 'in_transit',
          customerName: '张先生',
          customerPhone: '13800138001',
          pickupAddress: '河北省张家口市崇礼区绿野生态农场',
          deliveryAddress: '北京市朝阳区国贸大厦A座',
          driverName: '李师傅',
          driverPhone: '13900139001',
          vehicleNumber: '京A12345',
          priority: 'high',
          estimatedDeliveryTime: '2025-02-02 18:00:00',
          orderWeight: 50,
          orderValue: 2500,
          distance: 180,
          createdAt: '2025-02-02 08:00:00',
          updatedAt: '2025-02-02 14:30:00',
          notes: '客户要求当日送达，注意保温',
          productList: [
            { productName: '有机牛肉', quantity: 20, unit: 'kg' },
            { productName: '包装盒', quantity: 20, unit: '个' }
          ],
          trackingHistory: [
            {
              timestamp: '2025-02-02 08:00:00',
              location: '绿野生态农场',
              status: 'pickup',
              description: '已从农场取货'
            },
            {
              timestamp: '2025-02-02 12:30:00',
              location: '京张高速服务区',
              status: 'in_transit',
              description: '运输中，预计17:30到达'
            }
          ]
        },
        {
          id: 'delivery-002',
          orderNumber: 'DL-2025020202',
          status: 'pending',
          customerName: '王女士',
          customerPhone: '13700137002',
          pickupAddress: '山东省潍坊市寿光市现代养殖示范场',
          deliveryAddress: '天津市河西区友谊路',
          driverName: '未分配',
          driverPhone: '',
          vehicleNumber: '',
          priority: 'medium',
          estimatedDeliveryTime: '2025-02-03 16:00:00',
          orderWeight: 80,
          orderValue: 3200,
          distance: 220,
          createdAt: '2025-02-02 10:30:00',
          updatedAt: '2025-02-02 10:30:00',
          productList: [
            { productName: '冷鲜猪肉', quantity: 60, unit: 'kg' },
            { productName: '保鲜包装', quantity: 30, unit: '套' }
          ],
          trackingHistory: [
            {
              timestamp: '2025-02-02 10:30:00',
              location: '待配送',
              status: 'pending',
              description: '订单已创建，等待分配车辆'
            }
          ]
        },
        {
          id: 'delivery-003',
          orderNumber: 'DL-2025020203',
          status: 'delivered',
          customerName: '刘总',
          customerPhone: '13600136003',
          pickupAddress: '江苏省南京市江宁区科技蛋鸡养殖场',
          deliveryAddress: '上海市浦东新区陆家嘴金融贸易区',
          driverName: '赵师傅',
          driverPhone: '13500135003',
          vehicleNumber: '苏A67890',
          priority: 'low',
          estimatedDeliveryTime: '2025-02-01 14:00:00',
          actualDeliveryTime: '2025-02-01 13:45:00',
          orderWeight: 30,
          orderValue: 1800,
          distance: 320,
          createdAt: '2025-02-01 06:00:00',
          updatedAt: '2025-02-01 13:45:00',
          productList: [
            { productName: '新鲜鸡蛋', quantity: 500, unit: '个' },
            { productName: '包装盒', quantity: 10, unit: '箱' }
          ],
          trackingHistory: [
            {
              timestamp: '2025-02-01 06:00:00',
              location: '科技蛋鸡养殖场',
              status: 'pickup',
              description: '已从养殖场取货'
            },
            {
              timestamp: '2025-02-01 13:45:00',
              location: '上海市浦东新区',
              status: 'delivered',
              description: '已送达客户，配送完成'
            }
          ]
        }
      ];

      // Mock车辆数据
      const mockVehicles: Vehicle[] = [
        {
          id: 'vehicle-001',
          plateNumber: '京A12345',
          driverName: '李师傅',
          status: 'busy',
          currentLocation: '京张高速',
          capacity: 500,
          currentLoad: 50,
          lastUpdated: '2025-02-02 14:30:00'
        },
        {
          id: 'vehicle-002',
          plateNumber: '津B23456',
          driverName: '王师傅',
          status: 'available',
          currentLocation: '天津物流中心',
          capacity: 800,
          currentLoad: 0,
          lastUpdated: '2025-02-02 15:00:00'
        },
        {
          id: 'vehicle-003',
          plateNumber: '苏A67890',
          driverName: '赵师傅',
          status: 'available',
          currentLocation: '南京配送站',
          capacity: 300,
          currentLoad: 0,
          lastUpdated: '2025-02-02 14:00:00'
        }
      ];

      // Mock统计数据
      const mockStats: DeliveryStatistics = {
        totalOrders: 156,
        pendingOrders: 23,
        inTransitOrders: 12,
        deliveredToday: 8,
        averageDeliveryTime: 6.5,
        successRate: 98.7
      };

      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      setOrders(mockOrders);
      setVehicles(mockVehicles);
      setStatistics(mockStats);
    } catch (error) {
      console.error('获取配送数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in_transit':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待配送';
      case 'in_transit':
        return '配送中';
      case 'delivered':
        return '已送达';
      case 'failed':
        return '配送失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '普通';
    }
  };

  const getVehicleStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'busy':
        return 'warning';
      case 'maintenance':
        return 'error';
      default:
        return 'default';
    }
  };

  const getVehicleStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return '可用';
      case 'busy':
        return '忙碌';
      case 'maintenance':
        return '维护中';
      default:
        return '未知';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.driverName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || order.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleOrderSelect = (order: DeliveryOrder) => {
    setSelectedOrder(order);
    setCurrentView('tracking');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="返回"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">配送管理</h1>
          <div className="w-8 h-8"></div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 统计概览 */}
        {statistics && currentView === 'orders' && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.totalOrders}
                </p>
                <p className="text-sm text-gray-600">总订单数</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {statistics.pendingOrders}
                </p>
                <p className="text-sm text-gray-600">待配送</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {statistics.inTransitOrders}
                </p>
                <p className="text-sm text-gray-600">配送中</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {statistics.deliveredToday}
                </p>
                <p className="text-sm text-gray-600">今日完成</p>
              </div>
            </Card>
          </div>
        )}

        {/* 视图切换 */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant={currentView === 'orders' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('orders')}
            className="flex-1 text-sm"
          >
            配送订单
          </Button>
          <Button
            variant={currentView === 'tracking' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('tracking')}
            className="flex-1 text-sm"
            disabled={!selectedOrder}
          >
            订单跟踪
          </Button>
          <Button
            variant={currentView === 'vehicles' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('vehicles')}
            className="flex-1 text-sm"
          >
            车辆调度
          </Button>
        </div>

        {/* 配送订单视图 */}
        {currentView === 'orders' && (
          <>
            {/* 筛选和搜索 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="space-y-3">
                <Input
                  placeholder="搜索订单号、客户或司机..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: 'all', label: '全部状态' },
                      { value: 'pending', label: '待配送' },
                      { value: 'in_transit', label: '配送中' },
                      { value: 'delivered', label: '已送达' },
                      { value: 'failed', label: '配送失败' },
                      { value: 'cancelled', label: '已取消' }
                    ]}
                  />
                  <Select
                    value={filterPriority}
                    onChange={setFilterPriority}
                    options={[
                      { value: 'all', label: '全部优先级' },
                      { value: 'high', label: '高优先级' },
                      { value: 'medium', label: '中优先级' },
                      { value: 'low', label: '低优先级' }
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* 订单列表 */}
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOrderSelect(order)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant={getPriorityColor(order.priority)}>
                        {getPriorityText(order.priority)}
                      </Badge>
                      <Badge variant={getStatusColor(order.status)}>
                        {getStatusText(order.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">取货地址：</span>
                      <span className="text-xs">{order.pickupAddress}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">配送地址：</span>
                      <span className="text-xs">{order.deliveryAddress}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">预计送达：</span>
                        <span className="text-xs">{order.estimatedDeliveryTime}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">重量：</span>
                        <span>{order.orderWeight}kg</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600">司机：</span>
                        <span>{order.driverName || '未分配'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">车牌：</span>
                        <span>{order.vehicleNumber || '未分配'}</span>
                      </div>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                      <span className="text-gray-600">备注：</span>
                      {order.notes}
                    </div>
                  )}

                  {/* 产品列表 */}
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">配送产品：</p>
                    <div className="flex flex-wrap gap-2">
                      {order.productList.map((product, index) => (
                        <Badge key={index} variant="default" className="text-xs">
                          {product.productName} × {product.quantity}{product.unit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* 订单跟踪视图 */}
        {currentView === 'tracking' && selectedOrder && (
          <div className="space-y-4">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{selectedOrder.orderNumber}</h3>
                <Badge variant={getStatusColor(selectedOrder.status)}>
                  {getStatusText(selectedOrder.status)}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">客户：</span>
                  <span>{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">联系方式：</span>
                  <span>{selectedOrder.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">司机：</span>
                  <span>{selectedOrder.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">车牌号：</span>
                  <span>{selectedOrder.vehicleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">预计送达：</span>
                  <span>{selectedOrder.estimatedDeliveryTime}</span>
                </div>
                {selectedOrder.actualDeliveryTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">实际送达：</span>
                    <span>{selectedOrder.actualDeliveryTime}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* 跟踪历史 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h4 className="font-semibold mb-3">配送轨迹</h4>
              <div className="space-y-3">
                {selectedOrder.trackingHistory.map((track, index) => (
                  <div key={index} className="border-l-2 border-blue-200 pl-4 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{track.location}</p>
                        <p className="text-xs text-gray-600">{track.description}</p>
                      </div>
                      <span className="text-xs text-gray-500">{track.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* 车辆调度视图 */}
        {currentView === 'vehicles' && (
          <div className="grid grid-cols-1 gap-4">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{vehicle.plateNumber}</h3>
                    <p className="text-sm text-gray-600">{vehicle.driverName}</p>
                  </div>
                  <Badge variant={getVehicleStatusColor(vehicle.status)}>
                    {getVehicleStatusText(vehicle.status)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">当前位置：</span>
                    <span>{vehicle.currentLocation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">载重：</span>
                    <span>{vehicle.currentLoad}/{vehicle.capacity}kg</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(vehicle.currentLoad / vehicle.capacity) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">最后更新：</span>
                    <span>{vehicle.lastUpdated}</span>
                  </div>
                </div>

                                 <div className="flex space-x-2 mt-4">
                   <Button size="small" variant="secondary" className="flex-1">
                     分配订单
                   </Button>
                   <Button size="small" variant="secondary" className="flex-1">
                     查看详情
                   </Button>
                 </div>
              </Card>
            ))}
          </div>
        )}

        {/* 跟踪空状态 */}
        {currentView === 'tracking' && !selectedOrder && (
          <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">请先选择一个订单查看跟踪信息</p>
          </Card>
        )}
      </main>
    </div>
  );
}
