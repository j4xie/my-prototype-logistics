'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface Supplier {
  id: string;
  name: string;
  code: string;
  type: 'manufacturer' | 'distributor' | 'farmer' | 'processor';
  category: string[];
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  registrationDate: string;
  lastTransactionDate: string;
  totalTransactions: number;
  totalAmount: number;
  rating: number;
  status: 'active' | 'suspended' | 'blacklisted';
  certifications: string[];
  paymentTerms: string;
  deliveryTime: number;
  qualityScore: number;
  serviceScore: number;
  priceScore: number;
  recentOrders: Array<{
    orderNumber: string;
    date: string;
    amount: number;
    status: string;
  }>;
  products: string[];
}

const mockSuppliers: Supplier[] = [
  {
    id: 'SUP001',
    name: '优质农场合作社',
    code: 'FARM-COOP-001',
    type: 'farmer',
    category: ['有机蔬菜', '水果'],
    contactPerson: '张农夫',
    phone: '138-0000-1111',
    email: 'zhang@farmcoop.com',
    address: '山东省寿光市蔬菜基地A区',
    registrationDate: '2022-05-10',
    lastTransactionDate: '2024-02-01',
    totalTransactions: 189,
    totalAmount: 1850000,
    rating: 4.8,
    status: 'active',
    certifications: ['有机认证', '绿色食品', 'GAP认证'],
    paymentTerms: '货到付款',
    deliveryTime: 2,
    qualityScore: 9.5,
    serviceScore: 9.2,
    priceScore: 8.8,
    recentOrders: [
      { orderNumber: 'PO20240201001', date: '2024-02-01', amount: 12500, status: '已收货' },
      { orderNumber: 'PO20240130003', date: '2024-01-30', amount: 8900, status: '已收货' },
      { orderNumber: 'PO20240128005', date: '2024-01-28', amount: 15600, status: '已收货' }
    ],
    products: ['有机白菜', '红富士苹果', '胡萝卜', '西红柿']
  },
  {
    id: 'SUP002',
    name: '黑猪养殖专业合作社',
    code: 'PIG-FARM-002',
    type: 'farmer',
    category: ['畜牧肉类'],
    contactPerson: '李养殖',
    phone: '139-0000-2222',
    email: 'li@pigfarm.com',
    address: '黑龙江省哈尔滨市养殖基地',
    registrationDate: '2021-08-15',
    lastTransactionDate: '2024-02-02',
    totalTransactions: 134,
    totalAmount: 3200000,
    rating: 4.6,
    status: 'active',
    certifications: ['无公害认证', '绿色食品', '动物福利认证'],
    paymentTerms: '月结15天',
    deliveryTime: 1,
    qualityScore: 9.3,
    serviceScore: 8.9,
    priceScore: 8.5,
    recentOrders: [
      { orderNumber: 'PO20240202004', date: '2024-02-02', amount: 28000, status: '已收货' },
      { orderNumber: 'PO20240131008', date: '2024-01-31', amount: 32000, status: '已收货' }
    ],
    products: ['黑猪里脊肉', '黑猪五花肉', '黑猪排骨']
  },
  {
    id: 'SUP003',
    name: '深海水产有限公司',
    code: 'SEAFOOD-003',
    type: 'distributor',
    category: ['海鲜水产'],
    contactPerson: '王海员',
    phone: '136-0000-3333',
    email: 'wang@seafood.com',
    address: '福建省厦门市海鲜批发市场',
    registrationDate: '2020-12-20',
    lastTransactionDate: '2024-01-29',
    totalTransactions: 267,
    totalAmount: 4500000,
    rating: 4.2,
    status: 'active',
    certifications: ['HACCP认证', 'ISO22000', '海洋管理委员会认证'],
    paymentTerms: '现金结算',
    deliveryTime: 1,
    qualityScore: 8.8,
    serviceScore: 8.5,
    priceScore: 9.0,
    recentOrders: [
      { orderNumber: 'PO20240129012', date: '2024-01-29', amount: 16800, status: '已收货' },
      { orderNumber: 'PO20240125018', date: '2024-01-25', amount: 22400, status: '已收货' }
    ],
    products: ['深海三文鱼', '海虾', '海蟹', '带鱼']
  },
  {
    id: 'SUP004',
    name: '食品加工厂',
    code: 'PROCESSOR-004',
    type: 'processor',
    category: ['加工食品'],
    contactPerson: '赵厂长',
    phone: '137-0000-4444',
    email: 'zhao@processor.com',
    address: '河南省郑州市食品工业园区',
    registrationDate: '2023-02-28',
    lastTransactionDate: '2024-01-20',
    totalTransactions: 45,
    totalAmount: 890000,
    rating: 3.8,
    status: 'active',
    certifications: ['QS认证', 'ISO9001'],
    paymentTerms: '先款后货',
    deliveryTime: 3,
    qualityScore: 7.5,
    serviceScore: 7.8,
    priceScore: 8.2,
    recentOrders: [
      { orderNumber: 'PO20240120025', date: '2024-01-20', amount: 8900, status: '已收货' },
      { orderNumber: 'PO20240115028', date: '2024-01-15', amount: 12300, status: '已收货' }
    ],
    products: ['冷冻蔬菜包', '肉类加工品']
  },
  {
    id: 'SUP005',
    name: '问题供应商',
    code: 'PROBLEM-005',
    type: 'distributor',
    category: ['蔬菜'],
    contactPerson: '有问题',
    phone: '135-0000-5555',
    email: 'problem@supplier.com',
    address: '某地址',
    registrationDate: '2023-10-01',
    lastTransactionDate: '2023-12-15',
    totalTransactions: 12,
    totalAmount: 45000,
    rating: 2.1,
    status: 'suspended',
    certifications: [],
    paymentTerms: '现金结算',
    deliveryTime: 5,
    qualityScore: 4.2,
    serviceScore: 3.8,
    priceScore: 6.5,
    recentOrders: [
      { orderNumber: 'PO20231215035', date: '2023-12-15', amount: 2800, status: '质量问题' }
    ],
    products: ['普通蔬菜']
  }
];

const getTypeText = (type: Supplier['type']) => {
  switch (type) {
    case 'manufacturer': return '生产商';
    case 'distributor': return '经销商';
    case 'farmer': return '农户';
    case 'processor': return '加工厂';
    default: return '未知';
  }
};

const getStatusText = (status: Supplier['status']) => {
  switch (status) {
    case 'active': return '活跃';
    case 'suspended': return '暂停';
    case 'blacklisted': return '黑名单';
    default: return '未知';
  }
};

const getStatusColor = (status: Supplier['status']) => {
  switch (status) {
    case 'active': return 'success';
    case 'suspended': return 'warning';
    case 'blacklisted': return 'error';
    default: return 'default';
  }
};

const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 4.0) return 'text-blue-600';
  if (rating >= 3.0) return 'text-orange-600';
  return 'text-red-600';
};

const getTypeIcon = (type: Supplier['type']) => {
  switch (type) {
    case 'manufacturer': return '🏭';
    case 'distributor': return '🚚';
    case 'farmer': return '👨‍🌾';
    case 'processor': return '⚙️';
    default: return '🏢';
  }
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuppliers(mockSuppliers);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || supplier.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载供应商信息...</p>
        </div>
      </div>
    );
  }

  const totalSuppliers = suppliers.length;
  const totalAmount = suppliers.reduce((sum, supplier) => sum + supplier.totalAmount, 0);
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const avgRating = suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length;

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">供应商管理</h1>
        <Button size="small">新增供应商</Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalSuppliers}</div>
            <div className="text-sm text-gray-600">总供应商</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">¥{(totalAmount / 10000).toFixed(0)}万</div>
            <div className="text-sm text-gray-600">总采购额</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{activeSuppliers}</div>
            <div className="text-sm text-gray-600">活跃供应商</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{avgRating.toFixed(1)}</div>
            <div className="text-sm text-gray-600">平均评分</div>
          </div>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="p-4 space-y-3">
        <Input
          placeholder="搜索供应商名称、编码、联系人..."
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
            variant={filterStatus === 'active' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('active')}
          >
            活跃
          </Button>
          <Button
            size="small"
            variant={filterStatus === 'suspended' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('suspended')}
          >
            暂停
          </Button>
          <Button
            size="small"
            variant={filterStatus === 'blacklisted' ? 'primary' : 'secondary'}
            onClick={() => setFilterStatus('blacklisted')}
          >
            黑名单
          </Button>
        </div>
      </Card>

      {/* 供应商列表 */}
      <div className="space-y-3">
        {filteredSuppliers.map(supplier => (
          <Card key={supplier.id} className="p-4 hover:shadow-md hover:scale-[1.03] transition-all">
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getTypeIcon(supplier.type)}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{supplier.name}</h3>
                    <p className="text-sm text-gray-600">{supplier.code}</p>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <Badge variant={getStatusColor(supplier.status)}>
                    {getStatusText(supplier.status)}
                  </Badge>
                  <div className={`text-sm font-semibold ${getRatingColor(supplier.rating)}`}>
                    ⭐ {supplier.rating.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">👤 {supplier.contactPerson}</span>
                  <span className="text-sm text-gray-400">|</span>
                  <span className="text-sm text-gray-600">📱 {supplier.phone}</span>
                </div>
                <div className="text-sm text-gray-600">
                  📧 {supplier.email}
                </div>
                <div className="text-sm text-gray-600">
                  📍 {supplier.address}
                </div>
              </div>

              {/* 供应商类型和分类 */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div className="text-sm">
                  <span className="text-gray-600">类型: </span>
                  <span className="font-medium text-gray-900">{getTypeText(supplier.type)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">配送: </span>
                  <span className="font-medium text-gray-900">{supplier.deliveryTime}天</span>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">总交易</div>
                  <div className="text-lg font-bold text-gray-900">{supplier.totalTransactions}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">总金额</div>
                  <div className="text-sm font-semibold text-green-600">
                    ¥{(supplier.totalAmount / 10000).toFixed(1)}万
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">付款条件</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {supplier.paymentTerms}
                  </div>
                </div>
              </div>

              {/* 评分详情 */}
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">质量</div>
                  <div className="text-sm font-bold text-blue-600">{supplier.qualityScore}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">服务</div>
                  <div className="text-sm font-bold text-green-600">{supplier.serviceScore}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">价格</div>
                  <div className="text-sm font-bold text-orange-600">{supplier.priceScore}</div>
                </div>
              </div>

              {/* 分类标签 */}
              <div className="flex flex-wrap gap-1">
                {supplier.category.map((cat, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* 认证信息 */}
              {supplier.certifications.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 mb-1">认证资质:</div>
                  <div className="flex flex-wrap gap-1">
                    {supplier.certifications.map((cert, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
                      >
                        ✓ {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 最近交易 */}
              {supplier.recentOrders.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-2">最近交易:</div>
                  <div className="space-y-1">
                    {supplier.recentOrders.slice(0, 2).map((order, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="text-gray-700">{order.orderNumber}</span>
                        <span className="text-gray-600">¥{order.amount.toLocaleString()}</span>
                        <span className="text-gray-500">{order.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 主要产品 */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600 mb-1">主要产品:</div>
                <div className="text-xs text-blue-700">
                  {supplier.products.join(', ')}
                </div>
              </div>

              {/* 业务信息 */}
              <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
                <div>
                  <div className="text-sm text-gray-600">注册时间</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {new Date(supplier.registrationDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">最近交易</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {new Date(supplier.lastTransactionDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-2 pt-2">
                <Button size="small" className="flex-1">查看详情</Button>
                {supplier.status === 'active' && (
                  <Button size="small" variant="secondary" className="flex-1">创建采购单</Button>
                )}
                {supplier.status === 'suspended' && (
                  <Button size="small" variant="secondary" className="flex-1">恢复合作</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {filteredSuppliers.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="font-medium text-gray-900 mb-2">暂无供应商</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm ? '未找到符合条件的供应商' : '还没有任何供应商信息'}
          </p>
          <Button>新增供应商</Button>
        </Card>
      )}
    </div>
  );
}
