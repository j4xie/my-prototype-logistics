'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered';
  orderDate: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    quantity: number;
    unit: string;
  }>;
}

const mockOrders: Order[] = [
  {
    id: 'ORD001',
    orderNumber: 'SO20240202001',
    customerName: '北京餐饮连锁有限公司',
    status: 'confirmed',
    orderDate: '2024-02-02',
    totalAmount: 8960,
    items: [
      { productName: '黑猪里脊肉', quantity: 20, unit: 'kg' },
      { productName: '有机白菜', quantity: 50, unit: 'kg' }
    ]
  },
  {
    id: 'ORD002',
    orderNumber: 'SO20240202002',
    customerName: '上海美食广场',
    status: 'processing',
    orderDate: '2024-02-01',
    totalAmount: 4580,
    items: [
      { productName: '红富士苹果', quantity: 100, unit: 'kg' }
    ]
  }
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrders(mockOrders);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载订单中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">销售订单</h1>
        <Button size="small">新建订单</Button>
      </div>

      <div className="space-y-3">
        {orders.map(order => (
          <Card key={order.id} className="p-4 hover:shadow-md hover:scale-[1.03] transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{order.orderNumber}</h3>
                  <p className="text-sm text-gray-600">{order.customerName}</p>
                </div>
                <Badge variant="info">{order.status}</Badge>
              </div>
              <div className="text-sm text-gray-600">
                金额: ¥{order.totalAmount.toLocaleString()}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
