'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Loading } from '@/components/ui';

// 溯源记录数据类型
interface TraceRecord {
  id: string;
  productName: string;
  productCode: string;
  batchNumber: string;
  origin: string;
  productionDate: string;
  status: 'completed' | 'pending' | 'error' | 'draft';
  operator: string;
  updateTime: string;
  icon: string;
}

// 统计数据类型
interface TraceStats {
  total: number;
  completed: number;
  pending: number;
  error: number;
  draft: number;
}

// Mock数据
const mockTraceRecords: TraceRecord[] = [
  {
    id: 'WG25031701',
    productName: '和牛肉',
    productCode: 'WG25031701',
    batchNumber: 'WG-2503-A',
    origin: '北海道',
    productionDate: '2025-03-15',
    status: 'completed',
    operator: '张主管',
    updateTime: '2025-03-17 14:30',
    icon: '🥩'
  },
  {
    id: 'DZX25031602',
    productName: '大闸蟹',
    productCode: 'DZX25031602',
    batchNumber: 'DZX-0316-B',
    origin: '阳澄湖',
    productionDate: '2025-03-16',
    status: 'pending',
    operator: '李检验员',
    updateTime: '2025-03-16 16:45',
    icon: '🦀'
  },
  {
    id: 'YZ25031503',
    productName: '有机鸭蛋',
    productCode: 'YZ25031503',
    batchNumber: 'YZ-0315-C',
    origin: '江苏高邮',
    productionDate: '2025-03-15',
    status: 'completed',
    operator: '王养殖员',
    updateTime: '2025-03-15 09:20',
    icon: '🥚'
  },
  {
    id: 'HZ25031404',
    productName: '黑猪肉',
    productCode: 'HZ25031404',
    batchNumber: 'HZ-0314-D',
    origin: '浙江金华',
    productionDate: '2025-03-14',
    status: 'error',
    operator: '陈检验员',
    updateTime: '2025-03-14 11:15',
    icon: '🐷'
  },
  {
    id: 'LY25031305',
    productName: '绿叶蔬菜',
    productCode: 'LY25031305',
    batchNumber: 'LY-0313-E',
    origin: '山东寿光',
    productionDate: '2025-03-13',
    status: 'draft',
    operator: '赵农户',
    updateTime: '2025-03-13 08:30',
    icon: '🥬'
  },
  {
    id: 'JG25031206',
    productName: '精品大米',
    productCode: 'JG25031206',
    batchNumber: 'JG-0312-F',
    origin: '东北五常',
    productionDate: '2025-03-12',
    status: 'completed',
    operator: '孙农场主',
    updateTime: '2025-03-12 15:45',
    icon: '🌾'
  }
];

const mockStats: TraceStats = {
  total: 248,
  completed: 183,
  pending: 42,
  error: 23,
  draft: 0
};

// 生成扩展的Mock数据，提供更多样化的测试数据
const generateExtendedMockRecords = (): TraceRecord[] => {
  const products = [
    { name: '有机黑猪肉', code: 'HZR', origin: '四川成都', icon: '🐷' },
    { name: 'A5级和牛肉', code: 'WG', origin: '日本北海道', icon: '🥩' },
    { name: '生态白鸡肉', code: 'BJR', origin: '江苏南京', icon: '🐔' },
    { name: '野生三文鱼', code: 'SMY', origin: '挪威海域', icon: '🐟' },
    { name: '有机蔬菜组合', code: 'YJC', origin: '山东寿光', icon: '🥬' },
    { name: '天然蜂蜜', code: 'FM', origin: '新疆伊犁', icon: '🍯' },
    { name: '有机大米', code: 'YJD', origin: '东北五常', icon: '🌾' },
    { name: '阳澄湖大闸蟹', code: 'DZX', origin: '江苏苏州', icon: '🦀' }
  ];

  const statuses: Array<'completed' | 'pending' | 'error' | 'draft'> = ['completed', 'pending', 'error', 'draft'];
  const operators = ['张主管', '李检验员', '王养殖员', '陈检验员', '赵农户', '孙农场主', '刘技术员', '周质检员'];

  const extendedRecords: TraceRecord[] = [];

  // 添加原有的Mock数据
  extendedRecords.push(...mockTraceRecords);

  // 生成额外的Mock数据
  for (let i = 7; i < 20; i++) {
    const product = products[i % products.length];
    const status = statuses[i % statuses.length];
    const operator = operators[i % operators.length];

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - (i % 30)); // 过去30天内的记录

    const record: TraceRecord = {
      id: `${product.code}${baseDate.getFullYear()}${String(baseDate.getMonth() + 1).padStart(2, '0')}${String(baseDate.getDate()).padStart(2, '0')}${String(i).padStart(2, '0')}`,
      productName: product.name,
      productCode: `${product.code}${baseDate.getFullYear()}${String(baseDate.getMonth() + 1).padStart(2, '0')}${String(baseDate.getDate()).padStart(2, '0')}${String(i).padStart(2, '0')}`,
      batchNumber: `${product.code}-${String(baseDate.getMonth() + 1).padStart(2, '0')}${String(baseDate.getDate()).padStart(2, '0')}-${String.fromCharCode(65 + (i % 26))}`,
      origin: product.origin,
      productionDate: baseDate.toISOString().split('T')[0],
      status: status,
      operator: operator,
      updateTime: `${baseDate.toISOString().split('T')[0]} ${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
      icon: product.icon
    };

    extendedRecords.push(record);
  }

  return extendedRecords;
};

export default function TraceListPage() {
  const router = useRouter();
  const [records, setRecords] = useState<TraceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TraceRecord[]>([]);
  const [stats] = useState<TraceStats>(mockStats);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('today');

  useEffect(() => {
    const fetchTraceRecords = async () => {
      setLoading(true);
      try {
        // 首先尝试调用真实API获取溯源记录列表
        const response = await fetch('/api/trace/records', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setRecords(data.data);
            setFilteredRecords(data.data);
            return;
          }
        }

        // API不存在或失败时，使用扩展的Mock数据
        const extendedMockRecords = generateExtendedMockRecords();
        setRecords(extendedMockRecords);
        setFilteredRecords(extendedMockRecords);
      } catch (error) {
        console.error('获取溯源记录失败:', error);
        // 即使出错也提供Mock数据，确保用户体验
        setRecords(mockTraceRecords);
        setFilteredRecords(mockTraceRecords);
      } finally {
        setLoading(false);
      }
    };

    fetchTraceRecords();
  }, []);

  // 搜索和筛选逻辑
  useEffect(() => {
    let filtered = records;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.batchNumber.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 状态筛选
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(record => record.status === selectedStatus);
    }

    // 日期筛选（简化实现）
    if (selectedDateRange !== 'all') {
      const today = new Date();
      const filterDate = new Date();

      switch (selectedDateRange) {
        case 'today':
          filterDate.setDate(today.getDate());
          break;
        case '7days':
          filterDate.setDate(today.getDate() - 7);
          break;
        case '30days':
          filterDate.setDate(today.getDate() - 30);
          break;
      }

      filtered = filtered.filter(record => {
        const recordDate = new Date(record.productionDate);
        return recordDate >= filterDate;
      });
    }

    setFilteredRecords(filtered);
  }, [records, searchQuery, selectedStatus, selectedDateRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'pending': return '待审核';
      case 'error': return '异常';
      case 'draft': return '草稿';
      default: return '未知';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'pending': return '⏳';
      case 'error': return '⚠';
      case 'draft': return '📝';
      default: return '?';
    }
  };

  const handleRecordClick = (recordId: string) => {
    router.push(`/trace/detail/${recordId}`);
  };

  const handleQRCode = (recordId: string) => {
    // 生成二维码逻辑
    console.log('生成二维码:', recordId);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex items-center justify-center flex-1">
          <Loading size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 固定头部导航 */}
      <div className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[390px] bg-white shadow-sm z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold">溯源记录</h1>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <span className="text-[#1677FF]">🔍</span>
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <span className="text-[#1677FF]">📊</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 pt-[80px] pb-4">
        {/* 搜索与日期筛选 */}
        <div className="bg-white shadow-sm p-4 mb-4">
          <div className="mb-3">
            <Input
              placeholder="搜索批次号、产品名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-50"
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">📅</span>
              <span>日期筛选</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedDateRange('today')}
                className={`px-3 py-1 text-xs rounded border ${
                  selectedDateRange === 'today'
                    ? 'bg-blue-50 text-[#1677FF] border-blue-100'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                今日
              </button>
              <button
                onClick={() => setSelectedDateRange('7days')}
                className={`px-3 py-1 text-xs rounded border ${
                  selectedDateRange === '7days'
                    ? 'bg-blue-50 text-[#1677FF] border-blue-100'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setSelectedDateRange('30days')}
                className={`px-3 py-1 text-xs rounded border ${
                  selectedDateRange === '30days'
                    ? 'bg-blue-50 text-[#1677FF] border-blue-100'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                近30天
              </button>
            </div>
          </div>
        </div>

        {/* 状态筛选标签 */}
        <div className="px-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full ${
                selectedStatus === 'all'
                  ? 'bg-[#1677FF] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full ${
                selectedStatus === 'completed'
                  ? 'bg-[#1677FF] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-green-500 mr-1">●</span> 已完成
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full ${
                selectedStatus === 'pending'
                  ? 'bg-[#1677FF] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-orange-500 mr-1">●</span> 待审核
            </button>
            <button
              onClick={() => setSelectedStatus('error')}
              className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full ${
                selectedStatus === 'error'
                  ? 'bg-[#1677FF] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-red-500 mr-1">●</span> 异常
            </button>
            <button
              onClick={() => setSelectedStatus('draft')}
              className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full ${
                selectedStatus === 'draft'
                  ? 'bg-[#1677FF] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-gray-400 mr-1">●</span> 草稿
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="px-4 mb-4">
          <Card className="p-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
                  <span className="text-[#1677FF] text-xs">📋</span>
                </div>
                <div className="text-lg font-bold text-[#1677FF]">{stats.total}</div>
                <div className="text-xs text-gray-500">全部</div>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1.5">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <div className="text-lg font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-gray-500">已完成</div>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-1.5">
                  <span className="text-orange-600 text-xs">⏳</span>
                </div>
                <div className="text-lg font-bold text-orange-600">{stats.pending}</div>
                <div className="text-xs text-gray-500">待审核</div>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-1.5">
                  <span className="text-red-600 text-xs">⚠</span>
                </div>
                <div className="text-lg font-bold text-red-600">{stats.error}</div>
                <div className="text-xs text-gray-500">异常</div>
              </div>
            </div>
          </Card>
        </div>

        {/* 列表标题 */}
        <div className="px-4 mb-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-800">列表记录</h3>
            <div className="text-xs text-gray-500">共{filteredRecords.length}条</div>
          </div>
        </div>

        {/* 记录列表 */}
        <div className="px-4 space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium mb-2">暂无记录</h3>
              <p className="text-gray-600">请调整筛选条件或创建新的溯源记录</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <Card
                key={record.id}
                className="p-4 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleRecordClick(record.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      <span className="text-sm">{record.icon}</span>
                    </div>
                    <span className="font-medium">{record.productName} #{record.productCode}</span>
                  </div>
                  <Badge className={getStatusColor(record.status)}>
                    {getStatusIcon(record.status)} {getStatusText(record.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-gray-500">批次</div>
                    <div className="font-medium">{record.batchNumber}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">产地</div>
                    <div className="font-medium">{record.origin}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">日期</div>
                    <div className="font-medium">{record.productionDate}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="mr-4">👤 {record.operator}</span>
                    <span>🕒 {record.updateTime}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQRCode(record.id);
                      }}
                    >
                      📱 二维码
                    </Button>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordClick(record.id);
                      }}
                    >
                      👁 查看详情
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
