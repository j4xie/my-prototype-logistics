'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface Customer {
  id: string;
  name: string;
  code: string;
  type: 'enterprise' | 'individual' | 'government';
  level: 'vip' | 'gold' | 'silver' | 'bronze';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  registrationDate: string;
  lastOrderDate: string;
  totalOrders: number;
  totalAmount: number;
  creditLimit: number;
  paymentTerms: string;
  salesPerson: string;
  status: 'active' | 'inactive' | 'suspended';
  tags: string[];
  recentOrders: Array<{
    orderNumber: string;
    date: string;
    amount: number;
    status: string;
  }>;
}

const mockCustomers: Customer[] = [
  {
    id: 'CUS001',
    name: '北京餐饮连锁有限公司',
    code: 'BJ-CHAIN-001',
    type: 'enterprise',
    level: 'vip',
    contactPerson: '李经理',
    phone: '400-800-8888',
    email: 'li.manager@bjchain.com',
    address: '北京市朝阳区建国路88号商务大厦',
    registrationDate: '2023-03-15',
    lastOrderDate: '2024-02-02',
    totalOrders: 156,
    totalAmount: 2680000,
    creditLimit: 500000,
    paymentTerms: '月结30天',
    salesPerson: '张销售',
    status: 'active',
    tags: ['大客户', '连锁企业', '稳定合作'],
    recentOrders: [
      { orderNumber: 'SO20240202001', date: '2024-02-02', amount: 8960, status: '已确认' },
      { orderNumber: 'SO20240131005', date: '2024-01-31', amount: 15600, status: '已发货' },
      { orderNumber: 'SO20240130008', date: '2024-01-30', amount: 12300, status: '已送达' }
    ]
  },
  {
    id: 'CUS002',
    name: '上海美食广场',
    code: 'SH-FOOD-002',
    type: 'enterprise',
    level: 'gold',
    contactPerson: '王总',
    phone: '021-6666-7777',
    email: 'wang@shfoodcourt.com',
    address: '上海市浦东新区陆家嘴金融区美食广场',
    registrationDate: '2023-06-20',
    lastOrderDate: '2024-02-01',
    totalOrders: 89,
    totalAmount: 1450000,
    creditLimit: 300000,
    paymentTerms: '现金结算',
    salesPerson: '李销售',
    status: 'active',
    tags: ['美食广场', '高频订单'],
    recentOrders: [
      { orderNumber: 'SO20240202002', date: '2024-02-01', amount: 4580, status: '处理中' },
      { orderNumber: 'SO20240130012', date: '2024-01-30', amount: 6700, status: '已送达' }
    ]
  },
  {
    id: 'CUS003',
    name: '深圳酒店集团',
    code: 'SZ-HOTEL-003',
    type: 'enterprise',
    level: 'vip',
    contactPerson: '陈总监',
    phone: '0755-8888-9999',
    email: 'chen@szhotelgroup.com',
    address: '深圳市南山区科技园高新大厦',
    registrationDate: '2022-11-10',
    lastOrderDate: '2024-01-31',
    totalOrders: 234,
    totalAmount: 4250000,
    creditLimit: 800000,
    paymentTerms: '月结45天',
    salesPerson: '王销售',
    status: 'active',
    tags: ['酒店集团', '高端客户', '品质要求高'],
    recentOrders: [
      { orderNumber: 'SO20240131003', date: '2024-01-31', amount: 12350, status: '已发货' },
      { orderNumber: 'SO20240129007', date: '2024-01-29', amount: 18900, status: '已送达' }
    ]
  },
  {
    id: 'CUS004',
    name: '广州家庭客户',
    code: 'GZ-FAMILY-004',
    type: 'individual',
    level: 'silver',
    contactPerson: '赵女士',
    phone: '020-1234-5678',
    email: 'zhao.family@gmail.com',
    address: '广州市天河区珠江新城花园小区',
    registrationDate: '2023-08-05',
    lastOrderDate: '2024-01-30',
    totalOrders: 45,
    totalAmount: 86000,
    creditLimit: 10000,
    paymentTerms: '货到付款',
    salesPerson: '赵销售',
    status: 'active',
    tags: ['家庭客户', '有机偏好'],
    recentOrders: [
      { orderNumber: 'SO20240131004', date: '2024-01-30', amount: 1260, status: '已送达' },
      { orderNumber: 'SO20240125011', date: '2024-01-25', amount: 890, status: '已送达' }
    ]
  },
  {
    id: 'CUS005',
    name: '成都政府采购中心',
    code: 'CD-GOV-005',
    type: 'government',
    level: 'gold',
    contactPerson: '刘处长',
    phone: '028-8888-6666',
    email: 'liu@cdgov.cn',
    address: '成都市武侯区政务服务中心',
    registrationDate: '2023-01-20',
    lastOrderDate: '2024-01-25',
    totalOrders: 67,
    totalAmount: 980000,
    creditLimit: 200000,
    paymentTerms: '政府结算',
    salesPerson: '孙销售',
    status: 'active',
    tags: ['政府客户', '集中采购'],
    recentOrders: [
      { orderNumber: 'SO20240125015', date: '2024-01-25', amount: 25600, status: '已送达' }
    ]
  },
  {
    id: 'CUS006',
    name: '杭州小餐馆',
    code: 'HZ-SMALL-006',
    type: 'individual',
    level: 'bronze',
    contactPerson: '老板娘',
    phone: '0571-7777-8888',
    email: 'xiaocantan@163.com',
    address: '杭州市西湖区文三路小餐馆',
    registrationDate: '2023-12-01',
    lastOrderDate: '2023-12-20',
    totalOrders: 8,
    totalAmount: 15600,
    creditLimit: 5000,
    paymentTerms: '现金结算',
    salesPerson: '钱销售',
    status: 'inactive',
    tags: ['小餐馆', '不活跃'],
    recentOrders: [
      { orderNumber: 'SO20231220003', date: '2023-12-20', amount: 680, status: '已送达' }
    ]
  }
];

const getTypeText = (type: Customer['type']) => {
  switch (type) {
    case 'enterprise': return '企业客户';
    case 'individual': return '个人客户';
    case 'government': return '政府客户';
    default: return '未知';
  }
};

const getLevelText = (level: Customer['level']) => {
  switch (level) {
    case 'vip': return 'VIP';
    case 'gold': return '金牌';
    case 'silver': return '银牌';
    case 'bronze': return '铜牌';
    default: return '未知';
  }
};

const getLevelColor = (level: Customer['level']) => {
  switch (level) {
    case 'vip': return 'error';
    case 'gold': return 'warning';
    case 'silver': return 'info';
    case 'bronze': return 'default';
    default: return 'default';
  }
};

const getStatusText = (status: Customer['status']) => {
  switch (status) {
    case 'active': return '活跃';
    case 'inactive': return '不活跃';
    case 'suspended': return '暂停';
    default: return '未知';
  }
};

const getStatusColor = (status: Customer['status']) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'warning';
    case 'suspended': return 'error';
    default: return 'default';
  }
};

const getTypeIcon = (type: Customer['type']) => {
  switch (type) {
    case 'enterprise': return '🏢';
    case 'individual': return '👤';
    case 'government': return '🏛️';
    default: return '👥';
  }
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomers(mockCustomers);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'all' || customer.level === filterLevel;

    return matchesSearch && matchesLevel;
  });

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载客户信息...</p>
        </div>
      </div>
    );
  }

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalAmount, 0);
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const vipCustomers = customers.filter(c => c.level === 'vip').length;

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">客户管理</h1>
        <Button size="small">新增客户</Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalCustomers}</div>
            <div className="text-sm text-gray-600">总客户数</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">¥{(totalRevenue / 10000).toFixed(0)}万</div>
            <div className="text-sm text-gray-600">总营收</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{activeCustomers}</div>
            <div className="text-sm text-gray-600">活跃客户</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{vipCustomers}</div>
            <div className="text-sm text-gray-600">VIP客户</div>
          </div>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card className="p-4 space-y-3">
        <Input
          placeholder="搜索客户名称、编码、联系人..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="flex space-x-2 overflow-x-auto">
          <Button
            size="small"
            variant={filterLevel === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilterLevel('all')}
          >
            全部
          </Button>
          <Button
            size="small"
            variant={filterLevel === 'vip' ? 'primary' : 'secondary'}
            onClick={() => setFilterLevel('vip')}
          >
            VIP
          </Button>
          <Button
            size="small"
            variant={filterLevel === 'gold' ? 'primary' : 'secondary'}
            onClick={() => setFilterLevel('gold')}
          >
            金牌
          </Button>
          <Button
            size="small"
            variant={filterLevel === 'silver' ? 'primary' : 'secondary'}
            onClick={() => setFilterLevel('silver')}
          >
            银牌
          </Button>
        </div>
      </Card>

      {/* 客户列表 */}
      <div className="space-y-3">
        {filteredCustomers.map(customer => (
          <Card key={customer.id} className="p-4 hover:shadow-md hover:scale-[1.03] transition-all">
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getTypeIcon(customer.type)}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{customer.name}</h3>
                    <p className="text-sm text-gray-600">{customer.code}</p>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <Badge variant={getLevelColor(customer.level)}>
                    {getLevelText(customer.level)}
                  </Badge>
                  <Badge variant={getStatusColor(customer.status)}>
                    {getStatusText(customer.status)}
                  </Badge>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">👤 {customer.contactPerson}</span>
                  <span className="text-sm text-gray-400">|</span>
                  <span className="text-sm text-gray-600">📱 {customer.phone}</span>
                </div>
                <div className="text-sm text-gray-600">
                  📧 {customer.email}
                </div>
                <div className="text-sm text-gray-600">
                  📍 {customer.address}
                </div>
              </div>

              {/* 客户类型和销售员 */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div className="text-sm">
                  <span className="text-gray-600">类型: </span>
                  <span className="font-medium text-gray-900">{getTypeText(customer.type)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">销售: </span>
                  <span className="font-medium text-gray-900">{customer.salesPerson}</span>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">总订单</div>
                  <div className="text-lg font-bold text-gray-900">{customer.totalOrders}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">总金额</div>
                  <div className="text-sm font-semibold text-green-600">
                    ¥{(customer.totalAmount / 10000).toFixed(1)}万
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">信用额度</div>
                  <div className="text-sm font-semibold text-blue-600">
                    ¥{(customer.creditLimit / 10000).toFixed(1)}万
                  </div>
                </div>
              </div>

              {/* 标签 */}
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {customer.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 最近订单 */}
              {customer.recentOrders.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-2">最近订单:</div>
                  <div className="space-y-1">
                    {customer.recentOrders.slice(0, 2).map((order, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="text-gray-700">{order.orderNumber}</span>
                        <span className="text-gray-600">¥{order.amount.toLocaleString()}</span>
                        <span className="text-gray-500">{order.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 业务信息 */}
              <div className="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
                <div>
                  <div className="text-sm text-gray-600">付款方式</div>
                  <div className="text-sm font-semibold text-gray-900">{customer.paymentTerms}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">最后订单</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {new Date(customer.lastOrderDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-2 pt-2">
                <Button size="small" className="flex-1">查看详情</Button>
                <Button size="small" variant="secondary" className="flex-1">创建订单</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {filteredCustomers.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="font-medium text-gray-900 mb-2">暂无客户</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm ? '未找到符合条件的客户' : '还没有任何客户信息'}
          </p>
          <Button>新增客户</Button>
        </Card>
      )}
    </div>
  );
}
