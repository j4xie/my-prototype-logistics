'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { AdvancedTable } from '@/components/ui/advanced-table';

interface SalesData {
  period: string;
  revenue: number;
  orders: number;
  customers: number;
  avgOrderValue: number;
  growthRate: number;
}

interface TopProduct {
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
  growth: number;
}

interface SalesRep {
  name: string;
  revenue: number;
  orders: number;
  customers: number;
  target: number;
  achievement: number;
}

const mockSalesData: SalesData[] = [
  { period: '2024年1月', revenue: 2850000, orders: 456, customers: 234, avgOrderValue: 6250, growthRate: 12.5 },
  { period: '2024年2月', revenue: 3120000, orders: 523, customers: 267, avgOrderValue: 5965, growthRate: 18.2 },
  { period: '2023年12月', revenue: 2650000, orders: 412, customers: 198, avgOrderValue: 6433, growthRate: 8.7 },
  { period: '2023年11月', revenue: 2430000, orders: 387, customers: 189, avgOrderValue: 6279, growthRate: 5.3 },
  { period: '2023年10月', revenue: 2280000, orders: 356, customers: 167, avgOrderValue: 6404, growthRate: 3.1 }
];

const mockTopProducts: TopProduct[] = [
  { productName: '黑猪里脊肉', category: '肉类', quantity: 2340, revenue: 468000, growth: 25.3 },
  { productName: '有机白菜', category: '蔬菜', quantity: 5680, revenue: 284000, growth: 18.7 },
  { productName: '红富士苹果', category: '水果', quantity: 4520, revenue: 316400, growth: 15.2 },
  { productName: '草鸡蛋', category: '蛋类', quantity: 8960, revenue: 268800, growth: 22.8 },
  { productName: '新鲜牛奶', category: '乳制品', quantity: 3420, revenue: 239400, growth: 12.5 }
];

const mockSalesReps: SalesRep[] = [
  { name: '张销售', revenue: 1250000, orders: 156, customers: 45, target: 1200000, achievement: 104.2 },
  { name: '李销售', revenue: 980000, orders: 134, customers: 38, target: 1000000, achievement: 98.0 },
  { name: '王销售', revenue: 1150000, orders: 142, customers: 41, target: 1100000, achievement: 104.5 },
  { name: '赵销售', revenue: 750000, orders: 89, customers: 28, target: 800000, achievement: 93.8 },
  { name: '孙销售', revenue: 690000, orders: 78, customers: 25, target: 700000, achievement: 98.6 }
];

export default function SalesReportsPage() {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'performance'>('overview');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSalesData(mockSalesData);
      setTopProducts(mockTopProducts);
      setSalesReps(mockSalesReps);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载销售报表中...</p>
        </div>
      </div>
    );
  }

  const currentMonthData = salesData[1]; // 2024年2月数据

    const salesDataColumns = [
    {
      key: 'period',
      title: '期间',
      render: (item: SalesData) => (
        <span className="font-medium text-gray-900">{item.period}</span>
      )
    },
    {
      key: 'revenue',
      title: '营收',
      render: (item: SalesData) => (
        <span className="text-green-600 font-medium">¥{(item.revenue / 10000).toFixed(1)}万</span>
      )
    },
    {
      key: 'orders',
      title: '订单数',
      render: (item: SalesData) => (
        <span className="text-blue-600">{item.orders}</span>
      )
    },
    {
      key: 'growthRate',
      title: '增长率',
      render: (item: SalesData) => (
        <Badge variant={item.growthRate > 10 ? 'success' : item.growthRate > 5 ? 'warning' : 'default'}>
          {item.growthRate}%
        </Badge>
      )
    }
  ];

    const productColumns = [
    {
      key: 'productName',
      title: '产品名称',
      render: (item: TopProduct) => (
        <div>
          <span className="font-medium text-gray-900">{item.productName}</span>
          <div className="text-xs text-gray-500">{item.category}</div>
        </div>
      )
    },
    {
      key: 'quantity',
      title: '销量',
      render: (item: TopProduct) => (
        <span className="text-blue-600">{item.quantity.toLocaleString()}</span>
      )
    },
    {
      key: 'revenue',
      title: '营收',
      render: (item: TopProduct) => (
        <span className="text-green-600 font-medium">¥{(item.revenue / 10000).toFixed(1)}万</span>
      )
    },
    {
      key: 'growth',
      title: '增长',
      render: (item: TopProduct) => (
        <Badge variant={item.growth > 20 ? 'success' : item.growth > 10 ? 'warning' : 'default'}>
          +{item.growth}%
        </Badge>
      )
    }
  ];

    const salesRepColumns = [
    {
      key: 'name',
      title: '销售代表',
      render: (item: SalesRep) => (
        <span className="font-medium text-gray-900">{item.name}</span>
      )
    },
    {
      key: 'revenue',
      title: '业绩',
      render: (item: SalesRep) => (
        <span className="text-green-600 font-medium">¥{(item.revenue / 10000).toFixed(1)}万</span>
      )
    },
    {
      key: 'achievement',
      title: '完成率',
      render: (item: SalesRep) => (
        <div className="flex items-center space-x-2">
          <Badge variant={item.achievement >= 100 ? 'success' : item.achievement >= 95 ? 'warning' : 'error'}>
            {item.achievement}%
          </Badge>
        </div>
      )
    },
    {
      key: 'customers',
      title: '客户数',
      render: (item: SalesRep) => (
        <span className="text-blue-600">{item.customers}</span>
      )
    }
  ];

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">销售报表</h1>
        <Button size="small">导出报表</Button>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">本月营收</p>
              <p className="text-xl font-semibold text-green-600">¥{(currentMonthData.revenue / 10000).toFixed(1)}万</p>
              <p className="text-xs text-green-500">+{currentMonthData.growthRate}%</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">订单数量</p>
              <p className="text-xl font-semibold text-blue-600">{currentMonthData.orders}</p>
              <p className="text-xs text-blue-500">较上月 +67</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xs">📋</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">客户数量</p>
              <p className="text-xl font-semibold text-purple-600">{currentMonthData.customers}</p>
              <p className="text-xs text-purple-500">较上月 +33</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xs">👥</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均订单</p>
              <p className="text-xl font-semibold text-orange-600">¥{currentMonthData.avgOrderValue.toLocaleString()}</p>
              <p className="text-xs text-orange-500">-285</p>
            </div>
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xs">📊</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 标签页切换 */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          营收趋势
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'products'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          热销产品
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'performance'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          销售业绩
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'overview' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">营收趋势分析</h3>
          <AdvancedTable
            data={salesData}
            columns={salesDataColumns}
          />
        </Card>
      )}

      {activeTab === 'products' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">热销产品排行</h3>
          <AdvancedTable
            data={topProducts}
            columns={productColumns}
          />
        </Card>
      )}

      {activeTab === 'performance' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">销售代表业绩</h3>
          <AdvancedTable
            data={salesReps}
            columns={salesRepColumns}
          />
        </Card>
      )}

      {/* 快速操作 */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">快速操作</h3>
                <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">📈</span>
            <span className="text-xs">趋势分析</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">📊</span>
            <span className="text-xs">数据对比</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">📄</span>
            <span className="text-xs">详细报告</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">⚙️</span>
            <span className="text-xs">报表设置</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
