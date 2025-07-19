'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, Button, Badge, Loading, Modal } from '@/components/ui';

// 溯源详情数据类型
interface TraceDetail {
  id: string;
  productName: string;
  productCode: string;
  batchNumber: string;
  origin: string;
  productionDate: string;
  expiryDate: string;
  grade: string;
  status: 'completed' | 'processing' | 'pending';
  image: string;
  description: string;
  producer: {
    name: string;
    address: string;
    license: string;
    contact: string;
  };
  timeline: Array<{
    id: string;
    stage: string;
    title: string;
    status: 'completed' | 'processing' | 'pending';
    date: string;
    location: string;
    operator: string;
    details: Record<string, string>;
    description: string;
    images: string[];
    documents?: string[];
  }>;
  certificates: Array<{
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
    validUntil: string;
    status: 'valid' | 'expired' | 'pending';
    downloadUrl: string;
  }>;
  testResults: Array<{
    category: string;
    result: 'pass' | 'fail' | 'pending';
    details: string;
  }>;
}

// 辅助函数：根据ID生成产品名称
const getProductNameById = (id: string): string => {
  const products = [
    '有机黑猪肉', 'A5级和牛肉', '生态白鸡肉', '有机羊肉',
    '野生三文鱼', '有机蔬菜组合', '天然蜂蜜', '有机大米'
  ];
  const index = parseInt(id.slice(-1)) % products.length;
  return products[index] || '有机黑猪肉';
};

// 辅助函数：根据ID生成产品图片
const getProductImageById = (id: string): string => {
  const images = [
    'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    'https://images.unsplash.com/photo-1516467716199-8b365909d974?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80'
  ];
  const index = parseInt(id.slice(-1)) % images.length;
  return images[index] || images[0];
};

// 辅助函数：根据ID生成日期
const generateDateById = (id: string, stage: string): string => {
  const baseDate = new Date('2025-01-01');
  const idNumber = parseInt(id.slice(-2)) || 1;
  const stageOffsets = {
    farming: -120,
    processing: -10,
    testing: -8,
    logistics: -5
  };
  const offset = stageOffsets[stage as keyof typeof stageOffsets] || 0;
  baseDate.setDate(baseDate.getDate() + offset + (idNumber % 10));
  return baseDate.toISOString().split('T')[0];
};

// Mock数据
const mockTraceDetail: TraceDetail = {
  id: 'WG25031701',
  productName: 'A5级和牛肉',
  productCode: 'WG25031701',
  batchNumber: 'WG-2503-A',
  origin: '日本北海道',
  productionDate: '2025-03-15',
  expiryDate: '2025-06-15',
  grade: 'A5级',
  status: 'completed',
  image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
  description: '日本和牛是世界上最高级的牛肉，以其独特的大理石花纹、绝佳的风味和入口即化的口感而闻名。A5是日本官方和牛评级系统中的最高等级，表示肉质、肌内脂肪（雪花纹）、颜色、质地等各方面均达到顶级标准。',
  producer: {
    name: '北海道高级肉类加工厂',
    address: '日本北海道札幌市中央区北5条西2丁目',
    license: 'JPN-FOOD-5721093',
    contact: '+81-xx-xxxx-xxxx'
  },
  timeline: [
    {
      id: '1',
      stage: 'farming',
      title: '养殖阶段',
      status: 'completed',
      date: '2024-09-30',
      location: '北海道和牛牧场',
      operator: '山本牧场主',
      details: {
        '养殖基地': '北海道和牛牧场',
        '养殖周期': '36个月',
        '饲料类型': '有机草料+谷物',
        '检疫记录': '已通过'
      },
      description: '北海道天然草场饲养，采用传统喂养技术，保证肉质纹理分布均匀，脂肪含量适中，确保最佳品质。',
      images: ['https://images.unsplash.com/photo-1516467716199-8b365909d974?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80']
    },
    {
      id: '2',
      stage: 'processing',
      title: '屠宰加工',
      status: 'completed',
      date: '2025-03-10',
      location: '北海道高级肉类加工厂',
      operator: '田中检验员',
      details: {
        '加工厂': '北海道高级肉类加工厂',
        '加工日期': '2025-03-10',
        '卫生检查': '合格',
        '肉质评级': 'A5 (最高级)'
      },
      description: '脂肪交织度(BMS)：12分（满分12分），肉色：明亮鲜红，肌间脂肪分布均匀，肉质弹性佳，符合A5标准。',
      images: ['https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80']
    },
    {
      id: '3',
      stage: 'testing',
      title: '质量检验',
      status: 'completed',
      date: '2025-03-12',
      location: '日本食品安全检测中心',
      operator: '佐藤检测员',
      details: {
        '检验机构': '日本食品安全检测中心',
        '检验日期': '2025-03-12',
        '微生物检测': '合格',
        '兽药残留': '未检出'
      },
      description: '全面检测微生物、兽药残留、激素、寄生虫、重金属等指标，均符合国际食品安全标准。',
      images: [],
      documents: ['检测报告.pdf']
    },
    {
      id: '4',
      stage: 'logistics',
      title: '物流运输',
      status: 'completed',
      date: '2025-03-15',
      location: '全球冷链物流',
      operator: '物流配送员',
      details: {
        '物流公司': '全球冷链物流',
        '运输方式': '航空+冷藏车',
        '运输温度': '-18°C',
        '到达时间': '2025-03-16'
      },
      description: '采用全程冷链运输，确保产品在最佳温度条件下运输，保持新鲜度和品质。',
      images: []
    }
  ],
  certificates: [
    {
      id: '1',
      name: '有机认证证书',
      issuer: '日本有机认证机构',
      issueDate: '2024-01-15',
      validUntil: '2025-01-15',
      status: 'valid',
      downloadUrl: '/certificates/organic-cert.pdf'
    },
    {
      id: '2',
      name: '食品安全认证',
      issuer: '日本食品安全局',
      issueDate: '2024-06-01',
      validUntil: '2025-06-01',
      status: 'valid',
      downloadUrl: '/certificates/food-safety-cert.pdf'
    }
  ],
  testResults: [
    { category: '微生物', result: 'pass', details: '大肠杆菌、沙门氏菌等指标均合格' },
    { category: '兽药残留', result: 'pass', details: '未检出任何兽药残留' },
    { category: '激素检测', result: 'pass', details: '未检出生长激素' },
    { category: '寄生虫', result: 'pass', details: '未发现寄生虫' },
    { category: '重金属', result: 'pass', details: '铅、汞、镉等重金属含量符合标准' }
  ]
};

export default function TraceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [traceDetail, setTraceDetail] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'process' | 'cert'>('info');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTraceDetail = async () => {
      setLoading(true);
      try {
        // 首先尝试调用真实API
        const response = await fetch(`/api/trace/${params.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTraceDetail(data.data);
            return;
          }
        }

        // API不存在或失败时，使用基于ID的Mock数据
        const mockData = {
          ...mockTraceDetail,
          id: params.id as string,
          productCode: params.id as string,
          productName: getProductNameById(params.id as string),
          batchNumber: `BT-${params.id?.toString().slice(-4)}`,
          // 根据ID生成不同的产品数据
          image: getProductImageById(params.id as string),
          timeline: mockTraceDetail.timeline.map(stage => ({
            ...stage,
            date: generateDateById(params.id as string, stage.stage)
          }))
        };

        setTraceDetail(mockData);
      } catch (error) {
        console.error('获取溯源详情失败:', error);
        // 即使出错也提供Mock数据，确保用户体验
        setTraceDetail({
          ...mockTraceDetail,
          id: params.id as string,
          productCode: params.id as string,
        });
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchTraceDetail();
    }
  }, [params.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'processing': return '⏳';
      case 'pending': return '⏸';
      default: return '?';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'farming': return '🌱';
      case 'processing': return '🔪';
      case 'testing': return '🔬';
      case 'logistics': return '🚛';
      default: return '📋';
    }
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

  if (!traceDetail) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-xl font-semibold mb-2">未找到溯源信息</h2>
            <p className="text-gray-600 mb-4">请检查产品编号是否正确</p>
            <Button onClick={() => router.back()}>返回</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 固定头部导航 */}
      <div className="fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[390px] bg-white shadow-sm z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <span className="text-[#1677FF] text-xl">←</span>
          </button>
          <h1 className="text-lg font-semibold">溯源详情</h1>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <span className="text-[#1677FF]">📤</span>
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <span className="text-[#1677FF]">📱</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 pt-[80px] pb-4">
        {/* 产品基本信息卡片 */}
        <Card className="mx-4 mb-4 p-0 overflow-hidden">
          <div className="relative h-40">
            <Image
              src={traceDetail.image}
              alt={traceDetail.productName}
              fill
              className="object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{traceDetail.productName} #{traceDetail.productCode}</h2>
                  <p className="text-sm text-white/80">{traceDetail.grade} {traceDetail.origin}产</p>
                </div>
                <Badge className={getStatusColor(traceDetail.status)}>
                  {getStatusIcon(traceDetail.status)} 已完成
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">批次号</div>
                <div className="text-sm font-medium">{traceDetail.batchNumber}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">产地</div>
                <div className="text-sm font-medium">{traceDetail.origin}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">生产日期</div>
                <div className="text-sm font-medium">{traceDetail.productionDate}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* 标签导航 */}
        <div className="sticky top-[80px] bg-white shadow-sm z-40 mb-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-[#1677FF] text-[#1677FF]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 基本信息
            </button>
            <button
              onClick={() => setActiveTab('process')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'process'
                  ? 'border-[#1677FF] text-[#1677FF]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🔄 溯源流程
            </button>
            <button
              onClick={() => setActiveTab('cert')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cert'
                  ? 'border-[#1677FF] text-[#1677FF]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🏆 证书检测
            </button>
          </div>
        </div>

        {/* 标签内容 */}
        <div className="px-4">
          {/* 基本信息标签 */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-medium mb-3">产品详情</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">产品名称</div>
                    <div className="font-medium">{traceDetail.productName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">产品编号</div>
                    <div className="font-medium">{traceDetail.productCode}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">产品等级</div>
                    <div className="font-medium">{traceDetail.grade}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">肉质分数</div>
                    <div className="font-medium">BMS 12分（满分12分）</div>
                  </div>
                  <div>
                    <div className="text-gray-500">保质期</div>
                    <div className="font-medium">{traceDetail.expiryDate}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">储存温度</div>
                    <div className="font-medium">-18°C 以下冷冻保存</div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-lg font-medium mb-3">生产商信息</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-500">生产商</div>
                    <div className="font-medium">{traceDetail.producer.name}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">地址</div>
                    <div className="font-medium">{traceDetail.producer.address}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">许可证号</div>
                    <div className="font-medium">{traceDetail.producer.license}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">联系方式</div>
                    <div className="font-medium">{traceDetail.producer.contact}</div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-lg font-medium mb-3">产品说明</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {traceDetail.description}
                </p>
              </Card>
            </div>
          )}

          {/* 溯源流程标签 */}
          {activeTab === 'process' && (
            <div className="space-y-4">
              {traceDetail.timeline.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{getStageIcon(item.stage)}</span>
                      <h3 className="text-lg font-medium">{item.title}</h3>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {getStatusIcon(item.status)} 已完成
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    {Object.entries(item.details).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-gray-500">{key}</div>
                        <div className="font-medium">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 mb-3">
                    <div className="font-medium mb-1">详细说明</div>
                    <p>{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center">
                      <span className="mr-4">👤 {item.operator}</span>
                      <span>🕒 {item.date}</span>
                    </div>
                  </div>

                  {item.images.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => setSelectedImage(item.images[0])}
                      >
                        📷 查看照片({item.images.length})
                      </Button>
                    </div>
                  )}

                  {item.documents && item.documents.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <Button variant="ghost" size="small">
                        📄 查看检测报告
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* 证书检测标签 */}
          {activeTab === 'cert' && (
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-medium mb-3">检测结果</h3>
                <div className="grid grid-cols-2 gap-2">
                  {traceDetail.testResults.map((test, testIndex) => (
                    <div
                      key={testIndex}
                      className={`p-2 rounded text-center text-sm ${
                        test.result === 'pass'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      <div className="font-medium">
                        {test.result === 'pass' ? '✓' : '✗'} {test.category}
                      </div>
                      <div className="text-xs mt-1">{test.details}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-lg font-medium mb-3">认证证书</h3>
                <div className="space-y-3">
                  {traceDetail.certificates.map((cert) => (
                    <div key={cert.id} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{cert.name}</h4>
                        <Badge className={cert.status === 'valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {cert.status === 'valid' ? '有效' : '已过期'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>颁发机构：{cert.issuer}</div>
                        <div>颁发日期：{cert.issueDate}</div>
                        <div>有效期至：{cert.validUntil}</div>
                      </div>
                      <Button variant="ghost" size="small" className="mt-2">
                        📄 下载证书
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 图片查看模态框 */}
      {selectedImage && (
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          title="查看图片"
        >
          <div className="p-4">
            <Image
              src={selectedImage}
              alt="溯源图片"
              width={400}
              height={300}
              className="w-full h-auto rounded"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
