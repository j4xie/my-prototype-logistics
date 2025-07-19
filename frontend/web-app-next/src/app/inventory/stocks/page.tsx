'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface Stock {
  id: string;
  productId: string;
  productName: string;
  category: string;
  sku: string;
  currentStock: number;
  safetyStock: number;
  maxStock: number;
  unit: string;
  location: string;
  lastUpdated: string;
  status: 'normal' | 'low' | 'out' | 'excess';
  batchInfo: Array<{
    batchNumber: string;
    quantity: number;
    expiryDate: string;
    location: string;
  }>;
  avgCost: number;
  totalValue: number;
  turnoverRate: number;
}

const mockStocks: Stock[] = [
  {
    id: 'STK001',
    productId: 'PRD001',
    productName: '黑猪里脊肉',
    category: '肉类',
    sku: 'MEAT-PORK-001',
    currentStock: 45,
    safetyStock: 20,
    maxStock: 100,
    unit: 'kg',
    location: '冷藏库A区',
    lastUpdated: '2024-02-02 14:30',
    status: 'normal',
    batchInfo: [
      { batchNumber: 'BATCH20240201', quantity: 25, expiryDate: '2024-02-10', location: 'A1-001' },
      { batchNumber: 'BATCH20240131', quantity: 20, expiryDate: '2024-02-09', location: 'A1-002' }
    ],
    avgCost: 280,
    totalValue: 12600,
    turnoverRate: 8.5
  },
  {
    id: 'STK002',
    productId: 'PRD002',
    productName: '有机白菜',
    category: '蔬菜',
    sku: 'VEG-CABBAGE-001',
    currentStock: 12,
    safetyStock: 30,
    maxStock: 200,
    unit: 'kg',
    location: '保鲜库B区',
    lastUpdated: '2024-02-02 13:45',
    status: 'low',
    batchInfo: [
      { batchNumber: 'BATCH20240202', quantity: 12, expiryDate: '2024-02-05', location: 'B2-003' }
    ],
    avgCost: 12,
    totalValue: 144,
    turnoverRate: 15.2
  },
  {
    id: 'STK003',
    productId: 'PRD003',
    productName: '深海三文鱼',
    category: '海鲜',
    sku: 'FISH-SALMON-001',
    currentStock: 0,
    safetyStock: 15,
    maxStock: 80,
    unit: 'kg',
    location: '冷冻库C区',
    lastUpdated: '2024-02-01 16:20',
    status: 'out',
    batchInfo: [],
    avgCost: 320,
    totalValue: 0,
    turnoverRate: 12.8
  },
  {
    id: 'STK004',
    productId: 'PRD004',
    productName: '红富士苹果',
    category: '水果',
    sku: 'FRUIT-APPLE-001',
    currentStock: 180,
    safetyStock: 50,
    maxStock: 150,
    unit: 'kg',
    location: '常温库D区',
    lastUpdated: '2024-02-02 10:15',
    status: 'excess',
    batchInfo: [
      { batchNumber: 'BATCH20240130', quantity: 100, expiryDate: '2024-02-15', location: 'D1-001' },
      { batchNumber: 'BATCH20240131', quantity: 80, expiryDate: '2024-02-20', location: 'D1-002' }
    ],
    avgCost: 18,
    totalValue: 3240,
    turnoverRate: 6.5
  }
];

const getStatusText = (status: Stock['status']) => {
  switch (status) {
    case 'normal': return '正常';
    case 'low': return '库存不足';
    case 'out': return '缺货';
    case 'excess': return '库存过多';
    default: return '未知';
  }
};

const getStatusColor = (status: Stock['status']) => {
  switch (status) {
    case 'normal': return 'success';
    case 'low': return 'warning';
    case 'out': return 'error';
    case 'excess': return 'info';
    default: return 'default';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case '肉类': return '🥩';
    case '蔬菜': return '🥬';
    case '海鲜': return '🐟';
    case '水果': return '🍎';
    default: return '📦';
  }
};

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setStocks(mockStocks);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stock.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stock.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || stock.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载库存信息...</p>
        </div>
      </div>
    );
  }

  const totalProducts = stocks.length;
  const totalValue = stocks.reduce((sum, stock) => sum + stock.totalValue, 0);
  const lowStockCount = stocks.filter(s => s.status === 'low').length;
  const outOfStockCount = stocks.filter(s => s.status === 'out').length;

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">库存管理</h1>
        <Button size="small">盘点</Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalProducts}</div>
            <div className="text-sm text-gray-600">商品种类</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">¥{(totalValue / 10000).toFixed(1)}万</div>
            <div className="text-sm text-gray-600">库存价值</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
            <div className="text-sm text-gray-600">库存不足</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
            <div className="text-sm text-gray-600">缺货商品</div>
          </div>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="p-4 space-y-3">
        <Input
          placeholder="搜索商品名称、SKU、分类..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="flex space-x-2 overflow-x-auto">
          <Button
            size="small"
            variant={filterStatus === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('all')}
          >
            全部
          </Button>
          <Button
            size="small"
            variant={filterStatus === 'normal' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('normal')}
          >
            正常
          </Button>
          <Button
            size="small"
            variant={filterStatus === 'low' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('low')}
          >
            库存不足
          </Button>
          <Button
            size="small"
            variant={filterStatus === 'out' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('out')}
          >
            缺货
          </Button>
        </div>
      </Card>

      {/* 库存列表 */}
      <div className="space-y-3">
        {filteredStocks.map(stock => (
          <Card key={stock.id} className="p-4 hover:shadow-md hover:scale-[1.03] transition-all">
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getCategoryIcon(stock.category)}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{stock.productName}</h3>
                    <p className="text-sm text-gray-600">{stock.sku}</p>
                  </div>
                </div>
                <Badge variant={getStatusColor(stock.status)}>
                  {getStatusText(stock.status)}
                </Badge>
              </div>

              {/* 库存信息 */}
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">当前库存</div>
                  <div className="text-lg font-bold text-gray-900">
                    {stock.currentStock} {stock.unit}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">安全库存</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {stock.safetyStock} {stock.unit}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">最大库存</div>
                  <div className="text-sm font-semibold text-gray-700">
                    {stock.maxStock} {stock.unit}
                  </div>
                </div>
              </div>

              {/* 库存进度条 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>库存占比</span>
                  <span>{((stock.currentStock / stock.maxStock) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      stock.status === 'out' ? 'bg-red-500' :
                      stock.status === 'low' ? 'bg-orange-500' :
                      stock.status === 'excess' ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((stock.currentStock / stock.maxStock) * 100, 100)}%` }}
                  />
                </div>
                {/* 安全库存线 */}
                <div className="relative">
                  <div
                    className="absolute top-0 w-px h-2 bg-red-400"
                    style={{ left: `${(stock.safetyStock / stock.maxStock) * 100}%` }}
                  />
                </div>
              </div>

              {/* 位置和价值 */}
              <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
                <div>
                  <div className="text-sm text-gray-600">库位</div>
                  <div className="text-sm font-semibold text-gray-900">{stock.location}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">库存价值</div>
                  <div className="text-sm font-semibold text-gray-900">¥{stock.totalValue.toLocaleString()}</div>
                </div>
              </div>

              {/* 批次信息 */}
              {stock.batchInfo.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-2">批次信息:</div>
                  <div className="space-y-1">
                    {stock.batchInfo.map((batch, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="text-gray-700">{batch.batchNumber}</span>
                        <span className="text-gray-600">{batch.quantity}{stock.unit}</span>
                        <span className="text-gray-500">{batch.expiryDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 性能指标 */}
              <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
                <div>
                  <div className="text-sm text-gray-600">周转率</div>
                  <div className="text-sm font-semibold text-gray-900">{stock.turnoverRate}次/月</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">平均成本</div>
                  <div className="text-sm font-semibold text-gray-900">¥{stock.avgCost}/{stock.unit}</div>
                </div>
              </div>

              {/* 最后更新时间 */}
              <div className="text-xs text-gray-500">
                📅 最后更新: {stock.lastUpdated}
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-2 pt-2">
                <Button size="small" className="flex-1">查看详情</Button>
                {stock.status === 'low' && (
                  <Button size="small" variant="secondary" className="flex-1">补货</Button>
                )}
                {stock.status === 'out' && (
                  <Button size="small" variant="secondary" className="flex-1">紧急采购</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {filteredStocks.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="font-medium text-gray-900 mb-2">暂无库存信息</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm ? '未找到符合条件的商品' : '还没有任何库存记录'}
          </p>
          <Button>添加商品</Button>
        </Card>
      )}
    </div>
  );
}
