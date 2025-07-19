'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { AdvancedTable } from '@/components/ui/advanced-table';

interface ProductPrice {
  productId: string;
  productName: string;
  category: string;
  basePrice: number;
  currentPrice: number;
  unit: string;
  costPrice: number;
  profit: number;
  profitMargin: number;
  status: 'active' | 'inactive' | 'pending';
  lastUpdated: string;
}

interface PriceStrategy {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'volume' | 'seasonal';
  description: string;
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive' | 'expired';
  applicableProducts: string[];
}

interface DiscountRule {
  id: string;
  name: string;
  type: 'quantity' | 'amount' | 'customer' | 'seasonal';
  condition: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  priority: number;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  usageCount: number;
  maxUsage?: number;
}

const mockProductPrices: ProductPrice[] = [
  {
    productId: 'P001',
    productName: '黑猪里脊肉',
    category: '肉类',
    basePrice: 28.00,
    currentPrice: 26.50,
    unit: 'kg',
    costPrice: 18.20,
    profit: 8.30,
    profitMargin: 31.3,
    status: 'active',
    lastUpdated: '2024-02-02'
  },
  {
    productId: 'P002',
    productName: '有机白菜',
    category: '蔬菜',
    basePrice: 8.50,
    currentPrice: 8.50,
    unit: 'kg',
    costPrice: 4.20,
    profit: 4.30,
    profitMargin: 50.6,
    status: 'active',
    lastUpdated: '2024-02-01'
  },
  {
    productId: 'P003',
    productName: '红富士苹果',
    category: '水果',
    basePrice: 12.80,
    currentPrice: 11.20,
    unit: 'kg',
    costPrice: 7.50,
    profit: 3.70,
    profitMargin: 33.0,
    status: 'active',
    lastUpdated: '2024-01-31'
  },
  {
    productId: 'P004',
    productName: '草鸡蛋',
    category: '蛋类',
    basePrice: 3.20,
    currentPrice: 3.20,
    unit: '个',
    costPrice: 1.80,
    profit: 1.40,
    profitMargin: 43.8,
    status: 'active',
    lastUpdated: '2024-01-30'
  },
  {
    productId: 'P005',
    productName: '新鲜牛奶',
    category: '乳制品',
    basePrice: 18.00,
    currentPrice: 18.00,
    unit: '升',
    costPrice: 12.50,
    profit: 5.50,
    profitMargin: 30.6,
    status: 'inactive',
    lastUpdated: '2024-01-25'
  }
];

const mockPriceStrategies: PriceStrategy[] = [
  {
    id: 'PS001',
    name: '大客户折扣',
    type: 'percentage',
    description: '月采购金额超过10万元享受5%折扣',
    value: 5,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'active',
    applicableProducts: ['P001', 'P002', 'P003']
  },
  {
    id: 'PS002',
    name: '批量采购优惠',
    type: 'volume',
    description: '单次采购超过100kg享受8%折扣',
    value: 8,
    minQuantity: 100,
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    status: 'active',
    applicableProducts: ['P001', 'P003']
  },
  {
    id: 'PS003',
    name: '春节促销',
    type: 'seasonal',
    description: '春节期间所有产品9折优惠',
    value: 10,
    startDate: '2024-02-08',
    endDate: '2024-02-18',
    status: 'expired',
    applicableProducts: ['P001', 'P002', 'P003', 'P004', 'P005']
  }
];

const mockDiscountRules: DiscountRule[] = [
  {
    id: 'DR001',
    name: 'VIP客户专享',
    type: 'customer',
    condition: 'VIP等级客户',
    discount: 3,
    discountType: 'percentage',
    priority: 1,
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    usageCount: 156,
    maxUsage: 1000
  },
  {
    id: 'DR002',
    name: '满额减免',
    type: 'amount',
    condition: '单笔订单满5000元',
    discount: 200,
    discountType: 'fixed',
    priority: 2,
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    usageCount: 89,
    maxUsage: 500
  },
  {
    id: 'DR003',
    name: '月末清仓',
    type: 'seasonal',
    condition: '每月最后三天',
    discount: 15,
    discountType: 'percentage',
    priority: 3,
    status: 'inactive',
    startDate: '2024-01-29',
    endDate: '2024-01-31',
    usageCount: 34
  }
];

export default function PricingPage() {
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([]);
  const [priceStrategies, setPriceStrategies] = useState<PriceStrategy[]>([]);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'strategies' | 'discounts'>('products');

  useEffect(() => {
    const timer = setTimeout(() => {
      setProductPrices(mockProductPrices);
      setPriceStrategies(mockPriceStrategies);
      setDiscountRules(mockDiscountRules);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载价格信息中...</p>
        </div>
      </div>
    );
  }

  // 计算统计数据
  const activeProducts = productPrices.filter(p => p.status === 'active').length;
  const avgProfitMargin = productPrices.reduce((sum, p) => sum + p.profitMargin, 0) / productPrices.length;
  const activeStrategies = priceStrategies.filter(s => s.status === 'active').length;
  const activeDiscounts = discountRules.filter(d => d.status === 'active').length;

  const productColumns = [
    {
      key: 'productName',
      title: '产品名称',
      render: (item: ProductPrice) => (
        <div>
          <span className="font-medium text-gray-900">{item.productName}</span>
          <div className="text-xs text-gray-500">{item.category}</div>
        </div>
      )
    },
    {
      key: 'currentPrice',
      title: '现价',
      render: (item: ProductPrice) => (
        <div>
          <span className="text-green-600 font-medium">¥{item.currentPrice}</span>
          <div className="text-xs text-gray-500">/{item.unit}</div>
        </div>
      )
    },
    {
      key: 'profitMargin',
      title: '利润率',
      render: (item: ProductPrice) => (
        <Badge variant={item.profitMargin > 40 ? 'success' : item.profitMargin > 25 ? 'warning' : 'error'}>
          {item.profitMargin.toFixed(1)}%
        </Badge>
      )
    },
    {
      key: 'status',
      title: '状态',
      render: (item: ProductPrice) => (
        <Badge variant={item.status === 'active' ? 'success' : 'default'}>
          {item.status === 'active' ? '启用' : '停用'}
        </Badge>
      )
    }
  ];

  const strategyColumns = [
    {
      key: 'name',
      title: '策略名称',
      render: (item: PriceStrategy) => (
        <div>
          <span className="font-medium text-gray-900">{item.name}</span>
          <div className="text-xs text-gray-500">{item.description}</div>
        </div>
      )
    },
    {
      key: 'value',
      title: '优惠幅度',
      render: (item: PriceStrategy) => (
        <span className="text-orange-600 font-medium">
          {item.type === 'percentage' ? `${item.value}%` : `¥${item.value}`}
        </span>
      )
    },
    {
      key: 'status',
      title: '状态',
      render: (item: PriceStrategy) => (
        <Badge variant={item.status === 'active' ? 'success' : item.status === 'expired' ? 'error' : 'default'}>
          {item.status === 'active' ? '启用' : item.status === 'expired' ? '已过期' : '停用'}
        </Badge>
      )
    },
    {
      key: 'endDate',
      title: '截止日期',
      render: (item: PriceStrategy) => (
        <span className="text-gray-600 text-sm">{item.endDate}</span>
      )
    }
  ];

  const discountColumns = [
    {
      key: 'name',
      title: '规则名称',
      render: (item: DiscountRule) => (
        <div>
          <span className="font-medium text-gray-900">{item.name}</span>
          <div className="text-xs text-gray-500">{item.condition}</div>
        </div>
      )
    },
    {
      key: 'discount',
      title: '折扣',
      render: (item: DiscountRule) => (
        <span className="text-red-600 font-medium">
          {item.discountType === 'percentage' ? `${item.discount}%` : `¥${item.discount}`}
        </span>
      )
    },
    {
      key: 'usageCount',
      title: '使用次数',
      render: (item: DiscountRule) => (
        <div>
          <span className="text-blue-600">{item.usageCount}</span>
          {item.maxUsage && <span className="text-gray-500">/{item.maxUsage}</span>}
        </div>
      )
    },
    {
      key: 'status',
      title: '状态',
      render: (item: DiscountRule) => (
        <Badge variant={item.status === 'active' ? 'success' : 'default'}>
          {item.status === 'active' ? '启用' : '停用'}
        </Badge>
      )
    }
  ];

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">价格管理</h1>
        <Button size="small">价格设置</Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃产品</p>
              <p className="text-xl font-semibold text-blue-600">{activeProducts}</p>
              <p className="text-xs text-blue-500">共{productPrices.length}种产品</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xs">📦</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均利润率</p>
              <p className="text-xl font-semibold text-green-600">{avgProfitMargin.toFixed(1)}%</p>
              <p className="text-xs text-green-500">行业优秀</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">💰</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃策略</p>
              <p className="text-xl font-semibold text-orange-600">{activeStrategies}</p>
              <p className="text-xs text-orange-500">价格策略数</p>
            </div>
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xs">🎯</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">折扣规则</p>
              <p className="text-xl font-semibold text-purple-600">{activeDiscounts}</p>
              <p className="text-xs text-purple-500">有效规则数</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xs">🏷️</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 标签页切换 */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'products'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          产品定价
        </button>
        <button
          onClick={() => setActiveTab('strategies')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'strategies'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          价格策略
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'discounts'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          折扣规则
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'products' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">产品定价管理</h3>
          <AdvancedTable
            data={productPrices}
            columns={productColumns}
          />
        </Card>
      )}

      {activeTab === 'strategies' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">价格策略</h3>
          <AdvancedTable
            data={priceStrategies}
            columns={strategyColumns}
          />
        </Card>
      )}

      {activeTab === 'discounts' && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">折扣规则</h3>
          <AdvancedTable
            data={discountRules}
            columns={discountColumns}
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
            <span className="text-lg">💲</span>
            <span className="text-xs">批量调价</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">🎯</span>
            <span className="text-xs">新增策略</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">🏷️</span>
            <span className="text-xs">折扣管理</span>
          </Button>

          <Button
            variant="secondary"
            className="h-auto p-3 flex flex-col items-center space-y-1 hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="text-lg">📊</span>
            <span className="text-xs">价格分析</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
