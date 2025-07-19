'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 收获记录数据接口
interface HarvestRecord {
  id: string;
  batchNumber: string;
  cropType: string;
  variety: string;
  fieldId: string;
  fieldName: string;
  harvestDate: string;
  harvestArea: number;
  totalYield: number;
  yieldPerArea: number;
  quality: {
    grade: 'A' | 'B' | 'C' | 'D';
    score: number;
    defectRate: number;
    notes: string;
  };
  weather: {
    temperature: number;
    humidity: number;
    condition: string;
  };
  laborInfo: {
    workers: number;
    hours: number;
    supervisor: string;
  };
  storage: {
    method: string;
    location: string;
    temperature: number;
    expectedShelfLife: number;
  };
  sales: {
    status: 'pending' | 'partial' | 'sold' | 'processing';
    soldAmount: number;
    remainingAmount: number;
    averagePrice: number;
  };
  certification: {
    organic: boolean;
    traceable: boolean;
    certNumber: string;
  };
}

// Mock 收获记录数据
const mockHarvestRecordData: HarvestRecord[] = [
  {
    id: '1',
    batchNumber: 'HR2025020301',
    cropType: '有机青菜',
    variety: '上海青',
    fieldId: 'field-3',
    fieldName: 'C区田地',
    harvestDate: '2025-02-03',
    harvestArea: 3.2,
    totalYield: 3200,
    yieldPerArea: 1000,
    quality: {
      grade: 'A',
      score: 95,
      defectRate: 2,
      notes: '品质优良，色泽鲜绿，无病虫害'
    },
    weather: {
      temperature: 18,
      humidity: 65,
      condition: '晴朗'
    },
    laborInfo: {
      workers: 8,
      hours: 6,
      supervisor: '张师傅'
    },
    storage: {
      method: '冷藏保鲜',
      location: '1号冷库',
      temperature: 2,
      expectedShelfLife: 7
    },
    sales: {
      status: 'partial',
      soldAmount: 2800,
      remainingAmount: 400,
      averagePrice: 8.5
    },
    certification: {
      organic: true,
      traceable: true,
      certNumber: 'ORG-2025-001'
    }
  },
  {
    id: '2',
    batchNumber: 'HR2025020201',
    cropType: '有机白菜',
    variety: '小白菜',
    fieldId: 'field-1',
    fieldName: 'A区田地',
    harvestDate: '2025-02-02',
    harvestArea: 2.5,
    totalYield: 2850,
    yieldPerArea: 1140,
    quality: {
      grade: 'A',
      score: 92,
      defectRate: 3,
      notes: '叶片厚实，口感脆嫩'
    },
    weather: {
      temperature: 16,
      humidity: 70,
      condition: '多云'
    },
    laborInfo: {
      workers: 6,
      hours: 5,
      supervisor: '李师傅'
    },
    storage: {
      method: '冷藏保鲜',
      location: '2号冷库',
      temperature: 3,
      expectedShelfLife: 5
    },
    sales: {
      status: 'sold',
      soldAmount: 2850,
      remainingAmount: 0,
      averagePrice: 7.8
    },
    certification: {
      organic: true,
      traceable: true,
      certNumber: 'ORG-2025-002'
    }
  },
  {
    id: '3',
    batchNumber: 'HR2025013001',
    cropType: '有机萝卜',
    variety: '白萝卜',
    fieldId: 'field-2',
    fieldName: 'B区田地',
    harvestDate: '2025-01-30',
    harvestArea: 1.8,
    totalYield: 1950,
    yieldPerArea: 1083,
    quality: {
      grade: 'B',
      score: 88,
      defectRate: 5,
      notes: '个头均匀，部分表皮有轻微划痕'
    },
    weather: {
      temperature: 14,
      humidity: 75,
      condition: '阴天'
    },
    laborInfo: {
      workers: 5,
      hours: 7,
      supervisor: '王师傅'
    },
    storage: {
      method: '地窖储存',
      location: '地下储藏室',
      temperature: 8,
      expectedShelfLife: 30
    },
    sales: {
      status: 'processing',
      soldAmount: 0,
      remainingAmount: 1950,
      averagePrice: 6.2
    },
    certification: {
      organic: true,
      traceable: true,
      certNumber: 'ORG-2025-003'
    }
  },
  {
    id: '4',
    batchNumber: 'HR2025012801',
    cropType: '有机胡萝卜',
    variety: '红胡萝卜',
    fieldId: 'field-5',
    fieldName: 'E区田地',
    harvestDate: '2025-01-28',
    harvestArea: 2.0,
    totalYield: 1600,
    yieldPerArea: 800,
    quality: {
      grade: 'B',
      score: 85,
      defectRate: 8,
      notes: '甜度适中，部分出现分叉现象'
    },
    weather: {
      temperature: 12,
      humidity: 80,
      condition: '小雨'
    },
    laborInfo: {
      workers: 4,
      hours: 8,
      supervisor: '陈师傅'
    },
    storage: {
      method: '沙藏',
      location: '地下储藏室',
      temperature: 5,
      expectedShelfLife: 60
    },
    sales: {
      status: 'pending',
      soldAmount: 0,
      remainingAmount: 1600,
      averagePrice: 9.5
    },
    certification: {
      organic: true,
      traceable: true,
      certNumber: 'ORG-2025-004'
    }
  }
];

export default function HarvestRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HarvestRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState<string>('all');

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1500));
        setRecords(mockHarvestRecordData);
        setSelectedRecord(mockHarvestRecordData[0]);
      } catch (error) {
        console.error('获取收获记录失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-50';
      case 'B': return 'text-blue-600 bg-blue-50';
      case 'C': return 'text-yellow-600 bg-yellow-50';
      case 'D': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSalesStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return 'text-green-600 bg-green-50';
      case 'partial': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-yellow-600 bg-yellow-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSalesStatusText = (status: string) => {
    switch (status) {
      case 'sold': return '已售完';
      case 'partial': return '部分销售';
      case 'processing': return '加工中';
      case 'pending': return '待销售';
      default: return '未知';
    }
  };

  const getYieldColor = (yieldPerArea: number) => {
    if (yieldPerArea >= 1000) return 'text-green-600';
    if (yieldPerArea >= 800) return 'text-blue-600';
    if (yieldPerArea >= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredRecords = filterGrade === 'all'
    ? records
    : records.filter(record => record.quality.grade === filterGrade);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载收获记录..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[390px] mx-auto bg-white min-h-screen">
        {/* 头部 */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="small"
                onClick={() => router.back()}
                className="p-1"
              >
                ←
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">收获记录</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => router.push('/farming/harvest-records/add')}
            >
              ＋
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 统计概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">收获概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {records.length} 批次
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {records.filter(r => r.quality.grade === 'A').length}
                </div>
                <div className="text-sm text-gray-600">A级品质</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {records.reduce((sum, r) => sum + r.totalYield, 0).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">总产量(kg)</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {records.reduce((sum, r) => sum + r.harvestArea, 0).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">收获面积(亩)</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(records.reduce((sum, r) => sum + r.yieldPerArea, 0) / records.length)}
                </div>
                <div className="text-sm text-gray-600">平均产量(kg/亩)</div>
              </div>
            </div>
          </Card>

          {/* 筛选器 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'A', label: 'A级' },
              { key: 'B', label: 'B级' },
              { key: 'C', label: 'C级' },
              { key: 'D', label: 'D级' }
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={filterGrade === filter.key ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setFilterGrade(filter.key)}
                className="whitespace-nowrap"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* 收获记录列表 */}
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <Card
                key={record.id}
                className="p-4 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer"
                onClick={() => setSelectedRecord(record)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{record.batchNumber}</h3>
                    <Badge className={getGradeColor(record.quality.grade)}>
                      {record.quality.grade}级
                    </Badge>
                  </div>
                  <Badge className={getSalesStatusColor(record.sales.status)}>
                    {getSalesStatusText(record.sales.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`text-lg font-bold ${getYieldColor(record.yieldPerArea)}`}>
                      {record.yieldPerArea}
                    </div>
                    <div className="text-xs text-gray-600">产量(kg/亩)</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {record.totalYield} kg
                    </div>
                    <div className="text-xs text-gray-600">总产量</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-gray-600">
                    <span className="font-medium">作物:</span> {record.cropType}
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">田地:</span> {record.fieldName}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-gray-600">
                    收获: {record.harvestDate}
                  </div>
                  <div className="text-blue-600">
                    面积: {record.harvestArea} 亩
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <span className="font-medium">品质分:</span> {record.quality.score}分
                  </div>
                  <div className="text-green-600">
                    <span className="font-medium">均价:</span> ¥{record.sales.averagePrice}/kg
                  </div>
                </div>

                {record.certification.organic && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Badge className="text-green-600 bg-green-50 text-xs">
                        有机认证
                      </Badge>
                      <Badge className="text-blue-600 bg-blue-50 text-xs">
                        可追溯
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">🌾</div>
              <div className="text-gray-500">暂无符合条件的收获记录</div>
            </div>
          )}

          {/* 详情模态 */}
          {selectedRecord && (
            <Card className="p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedRecord.batchNumber} 详情
                </h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedRecord(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">作物品种:</span>
                    <div className="font-medium">{selectedRecord.cropType} - {selectedRecord.variety}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">收获田地:</span>
                    <div className="font-medium">{selectedRecord.fieldName}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">收获日期:</span>
                    <div className="font-medium">{selectedRecord.harvestDate}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">收获面积:</span>
                    <div className="font-medium">{selectedRecord.harvestArea} 亩</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">品质信息</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">品质等级:</span>
                      <span className="ml-1 font-medium">{selectedRecord.quality.grade}级</span>
                    </div>
                    <div>
                      <span className="text-gray-500">品质评分:</span>
                      <span className="ml-1 font-medium">{selectedRecord.quality.score}分</span>
                    </div>
                    <div>
                      <span className="text-gray-500">次品率:</span>
                      <span className="ml-1 font-medium">{selectedRecord.quality.defectRate}%</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-500">品质备注:</span>
                    <div className="text-sm text-gray-600 mt-1">{selectedRecord.quality.notes}</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">收获条件</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">天气:</span>
                      <span className="ml-1">{selectedRecord.weather.condition}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">温度:</span>
                      <span className="ml-1">{selectedRecord.weather.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-gray-500">湿度:</span>
                      <span className="ml-1">{selectedRecord.weather.humidity}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">工人数:</span>
                      <span className="ml-1">{selectedRecord.laborInfo.workers}人</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">储存信息</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">储存方式:</span>
                      <span className="ml-1">{selectedRecord.storage.method}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">储存地点:</span>
                      <span className="ml-1">{selectedRecord.storage.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">储存温度:</span>
                      <span className="ml-1">{selectedRecord.storage.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-gray-500">保质期:</span>
                      <span className="ml-1">{selectedRecord.storage.expectedShelfLife}天</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">销售情况</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">已售:</span>
                      <span className="ml-1">{selectedRecord.sales.soldAmount} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500">剩余:</span>
                      <span className="ml-1">{selectedRecord.sales.remainingAmount} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500">均价:</span>
                      <span className="ml-1">¥{selectedRecord.sales.averagePrice}/kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500">状态:</span>
                      <span className="ml-1">{getSalesStatusText(selectedRecord.sales.status)}</span>
                    </div>
                  </div>
                </div>

                {selectedRecord.certification.organic && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">认证信息</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">有机认证:</span>
                        <span className="text-green-600">已认证</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">可追溯性:</span>
                        <span className="text-blue-600">完整</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">认证编号:</span>
                        <span>{selectedRecord.certification.certNumber}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-3">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => router.push(`/farming/harvest-records/${selectedRecord.id}/edit`)}
                  >
                    编辑记录
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => router.push(`/trace/detail/${selectedRecord.batchNumber}`)}
                  >
                    查看溯源
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
