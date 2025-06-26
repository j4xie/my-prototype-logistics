'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  StatCard,
  PageLayout,
  Loading,
  Badge,
  Input,
  Select,
  Modal
} from '@/components/ui';

interface TransportOrder {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  origin: string;
  destination: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'assigned' | 'picked-up' | 'in-transit' | 'delivered' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  driverName?: string;
  vehicleNumber?: string;
  estimatedTime: string;
  actualPickupTime?: string;
  actualDeliveryTime?: string;
  distance: number;
  cost: number;
  notes: string;
  timeline: {
    status: string;
    time: string;
    location?: string;
    operator: string;
    notes?: string;
  }[];
  createdAt: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  onTimeRate: number;
}

export default function TransportOrdersPage() {
  const [orders, setOrders] = useState<TransportOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<TransportOrder | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logistics/transport-orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        // Fallback mock data
        setOrders(generateMockOrders());
      }
    } catch (error) {
      console.error('获取运输订单失败:', error);
      setOrders(generateMockOrders());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/logistics/transport-orders?type=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        setStats({
          totalOrders: 89,
          pendingOrders: 12,
          inTransitOrders: 25,
          deliveredOrders: 48,
          cancelledOrders: 4,
          onTimeRate: 94.5
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({
        totalOrders: 89,
        pendingOrders: 12,
        inTransitOrders: 25,
        deliveredOrders: 48,
        cancelledOrders: 4,
        onTimeRate: 94.5
      });
    }
  };

  const generateMockOrders = (): TransportOrder[] => {
    return [
      {
        id: 'TO001',
        orderNumber: 'LG-2025-001',
        productName: '优质猪肉制品',
        quantity: 500,
        unit: 'kg',
        origin: '北京加工厂',
        destination: '上海销售点',
        customerName: '张经理',
        customerPhone: '138****1234',
        status: 'in-transit',
        priority: 'high',
        driverName: '李师傅',
        vehicleNumber: '京A12345',
        estimatedTime: '2025-02-03 14:00',
        actualPickupTime: '2025-02-02 08:30',
        distance: 1200,
        cost: 1800,
        notes: '易腐商品，需冷链运输',
        timeline: [
          { status: '订单创建', time: '2025-02-01 09:00', operator: '系统', notes: '客户下单' },
          { status: '分配司机', time: '2025-02-01 10:30', operator: '调度员小王', notes: '分配李师傅' },
          { status: '开始取货', time: '2025-02-02 08:00', location: '北京加工厂', operator: '李师傅' },
          { status: '取货完成', time: '2025-02-02 08:30', location: '北京加工厂', operator: '李师傅' },
          { status: '运输中', time: '2025-02-02 09:00', location: '京津高速', operator: '李师傅', notes: '正常行驶中' }
        ],
        createdAt: '2025-02-01T09:00:00Z'
      },
      {
        id: 'TO002',
        orderNumber: 'LG-2025-002',
        productName: '精选牛肉系列',
        quantity: 300,
        unit: 'kg',
        origin: '天津加工厂',
        destination: '广州批发市场',
        customerName: '王总',
        customerPhone: '139****5678',
        status: 'pending',
        priority: 'medium',
        estimatedTime: '2025-02-04 16:00',
        distance: 1800,
        cost: 2500,
        notes: '需要温控运输，客户要求当日达',
        timeline: [
          { status: '订单创建', time: '2025-02-02 14:00', operator: '系统', notes: '客户下单' }
        ],
        createdAt: '2025-02-02T14:00:00Z'
      },
      {
        id: 'TO003',
        orderNumber: 'LG-2025-003',
        productName: '有机鸡肉',
        quantity: 200,
        unit: 'kg',
        origin: '河北养殖基地',
        destination: '深圳餐饮公司',
        customerName: '陈主厨',
        customerPhone: '136****9012',
        status: 'delivered',
        priority: 'low',
        driverName: '张师傅',
        vehicleNumber: '冀B67890',
        estimatedTime: '2025-02-01 18:00',
        actualPickupTime: '2025-01-31 10:00',
        actualDeliveryTime: '2025-02-01 16:30',
        distance: 1500,
        cost: 2200,
        notes: '有机认证产品，包装完好',
        timeline: [
          { status: '订单创建', time: '2025-01-30 16:00', operator: '系统' },
          { status: '分配司机', time: '2025-01-30 17:00', operator: '调度员小李' },
          { status: '开始取货', time: '2025-01-31 09:30', location: '河北养殖基地', operator: '张师傅' },
          { status: '取货完成', time: '2025-01-31 10:00', location: '河北养殖基地', operator: '张师傅' },
          { status: '运输中', time: '2025-01-31 11:00', location: '京港澳高速', operator: '张师傅' },
          { status: '配送完成', time: '2025-02-01 16:30', location: '深圳餐饮公司', operator: '张师傅', notes: '客户签收确认' }
        ],
        createdAt: '2025-01-30T16:00:00Z'
      },
      {
        id: 'TO004',
        orderNumber: 'LG-2025-004',
        productName: '冷冻羊肉',
        quantity: 400,
        unit: 'kg',
        origin: '内蒙古屠宰场',
        destination: '西安销售网点',
        customerName: '赵老板',
        customerPhone: '137****3456',
        status: 'assigned',
        priority: 'urgent',
        driverName: '王师傅',
        vehicleNumber: '蒙C11111',
        estimatedTime: '2025-02-03 12:00',
        distance: 800,
        cost: 1200,
        notes: '急单，客户催货较紧',
        timeline: [
          { status: '订单创建', time: '2025-02-02 11:00', operator: '系统' },
          { status: '分配司机', time: '2025-02-02 11:30', operator: '调度员小张', notes: '优先级高，快速分配' }
        ],
        createdAt: '2025-02-02T11:00:00Z'
      }
    ];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'picked-up':
        return 'bg-purple-100 text-purple-800';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered':
        return '已送达';
      case 'in-transit':
        return '运输中';
      case 'picked-up':
        return '已取货';
      case 'assigned':
        return '已分配';
      case 'pending':
        return '待分配';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '紧急';
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '一般';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.driverName && order.driverName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <PageLayout title="运输订单" className="flex items-center justify-center min-h-screen">
        <Loading text="加载运输订单中..." />
      </PageLayout>
    );
  }

  if (showDetails && selectedOrder) {
    return (
      <PageLayout
        title="订单详情"
        showBack={true}
        onBack={() => setShowDetails(false)}
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
        <main className="flex-1 pt-[80px] pb-[20px] px-4">
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedOrder.orderNumber}
              </h2>
              <div className="flex space-x-2">
                <Badge className={getPriorityColor(selectedOrder.priority)}>
                  {getPriorityText(selectedOrder.priority)}
                </Badge>
                <Badge className={getStatusColor(selectedOrder.status)}>
                  {getStatusText(selectedOrder.status)}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">产品:</span>
                <span className="font-medium">{selectedOrder.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">数量:</span>
                <span className="font-medium">{selectedOrder.quantity}{selectedOrder.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">起点:</span>
                <span className="font-medium">{selectedOrder.origin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">终点:</span>
                <span className="font-medium">{selectedOrder.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">客户:</span>
                <span className="font-medium">{selectedOrder.customerName} ({selectedOrder.customerPhone})</span>
              </div>
              {selectedOrder.driverName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">司机:</span>
                  <span className="font-medium">{selectedOrder.driverName}</span>
                </div>
              )}
              {selectedOrder.vehicleNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">车牌:</span>
                  <span className="font-medium">{selectedOrder.vehicleNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">距离:</span>
                <span className="font-medium">{selectedOrder.distance}km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">运费:</span>
                <span className="font-medium text-blue-600">¥{selectedOrder.cost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">预计送达:</span>
                <span className="font-medium">{selectedOrder.estimatedTime}</span>
              </div>
            </div>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3">运输时间线</h3>
            <div className="space-y-3">
              {selectedOrder.timeline.map((event, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-3 h-3 rounded-full mt-2 ${
                    index === selectedOrder.timeline.length - 1 ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-800">{event.status}</span>
                      <span className="text-xs text-gray-500">{event.time}</span>
                    </div>
                    {event.location && (
                      <div className="text-sm text-gray-600 mb-1">地点: {event.location}</div>
                    )}
                    <div className="text-sm text-gray-600 mb-1">操作员: {event.operator}</div>
                    {event.notes && (
                      <div className="text-xs text-gray-500">备注: {event.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {selectedOrder.notes && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-md font-semibold text-gray-900 mb-3">订单备注</h3>
              <p className="text-gray-700 leading-relaxed">{selectedOrder.notes}</p>
            </Card>
          )}
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="运输订单"
      showBack={true}
      onBack={() => window.history.back()}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        {stats && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">订单概览</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard
                title="总订单"
                value={stats.totalOrders}
                className="bg-blue-50 border-blue-200"
              />
              <StatCard
                title="运输中"
                value={stats.inTransitOrders}
                className="bg-orange-50 border-orange-200"
              />
              <StatCard
                title="准时率"
                value={stats.onTimeRate}
                formatValue={(value) => `${value}%`}
                trend={{ value: 2.5, direction: "up", label: "较上月" }}
                className="bg-green-50 border-green-200"
              />
              <StatCard
                title="待分配"
                value={stats.pendingOrders}
                className="bg-red-50 border-red-200"
              />
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="space-y-3">
            <Input
              label="搜索订单"
              placeholder="订单号、产品、客户或司机"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="状态筛选"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'pending', label: '待分配' },
                  { value: 'assigned', label: '已分配' },
                  { value: 'picked-up', label: '已取货' },
                  { value: 'in-transit', label: '运输中' },
                  { value: 'delivered', label: '已送达' },
                  { value: 'cancelled', label: '已取消' }
                ]}
              />
              <Select
                label="优先级"
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value)}
                options={[
                  { value: 'all', label: '全部优先级' },
                  { value: 'urgent', label: '紧急' },
                  { value: 'high', label: '高' },
                  { value: 'medium', label: '中' },
                  { value: 'low', label: '低' }
                ]}
              />
            </div>
          </div>
        </Card>

        {/* 订单列表 */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-gray-800">
              运输订单 ({filteredOrders.length})
            </h3>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="text-sm px-3 py-1"
            >
              + 新建
            </Button>
          </div>

          {filteredOrders.length === 0 ? (
            <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500 mb-4">暂无符合条件的订单</p>
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                variant="secondary"
              >
                清除筛选
              </Button>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedOrder(order);
                  setShowDetails(true);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{order.orderNumber}</h4>
                  <div className="flex space-x-1">
                    <Badge className={getPriorityColor(order.priority)}>
                      {getPriorityText(order.priority)}
                    </Badge>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>产品:</span>
                    <span>{order.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>路线:</span>
                    <span>{order.origin} → {order.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>客户:</span>
                    <span>{order.customerName}</span>
                  </div>
                  {order.driverName && (
                    <div className="flex justify-between">
                      <span>司机:</span>
                      <span>{order.driverName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>预计送达:</span>
                    <span>{order.estimatedTime}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* 新建订单模态框 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建运输订单"
        className="max-w-[350px]"
      >
        <div className="space-y-4">
          <Input
            label="产品名称"
            placeholder="请输入产品名称"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="数量"
              placeholder="数量"
              type="number"
            />
            <Select
              label="单位"
              options={[
                { value: 'kg', label: 'kg' },
                { value: '箱', label: '箱' },
                { value: '件', label: '件' },
                { value: '吨', label: '吨' }
              ]}
            />
          </div>
          <Input
            label="起点"
            placeholder="请输入起始地点"
          />
          <Input
            label="终点"
            placeholder="请输入目的地"
          />
          <Input
            label="客户姓名"
            placeholder="请输入客户姓名"
          />
          <Input
            label="客户电话"
            placeholder="请输入客户电话"
          />
          <Select
            label="优先级"
            options={[
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
              { value: 'urgent', label: '紧急' }
            ]}
          />
          <Input
            label="预计送达时间"
            type="datetime-local"
          />
          <div className="flex space-x-2 pt-4">
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="secondary"
              className="flex-1"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                // TODO: 实现创建订单逻辑
                setShowCreateModal(false);
              }}
              variant="primary"
              className="flex-1"
            >
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
