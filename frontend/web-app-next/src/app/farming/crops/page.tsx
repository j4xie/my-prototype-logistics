'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 作物数据接口
interface Crop {
  id: string;
  name: string;
  variety: string;
  category: string;
  plantingDate: string;
  growthStage: string;
  expectedHarvest: string;
  totalArea: number;
  currentYield: number;
  expectedYield: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  environmentalData: {
    temperature: number;
    humidity: number;
    lightHours: number;
    soilPH: number;
  };
  nutritionSchedule: Array<{
    date: string;
    type: string;
    amount: string;
    applied: boolean;
  }>;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    reportDate: string;
  }>;
}

// Mock 作物数据
const mockCropData: Crop[] = [
  {
    id: '1',
    name: '有机白菜',
    variety: '小白菜',
    category: '叶菜类',
    plantingDate: '2025-01-15',
    growthStage: '成长期',
    expectedHarvest: '2025-03-15',
    totalArea: 4.2,
    currentYield: 85,
    expectedYield: 100,
    healthStatus: 'good',
    environmentalData: {
      temperature: 18,
      humidity: 75,
      lightHours: 8.5,
      soilPH: 6.8
    },
    nutritionSchedule: [
      {
        date: '2025-02-03',
        type: '有机肥',
        amount: '50kg/亩',
        applied: false
      },
      {
        date: '2025-02-01',
        type: '叶面肥',
        amount: '20L/亩',
        applied: true
      }
    ],
    issues: [
      {
        type: '轻微病虫害',
        severity: 'low',
        description: '发现少量蚜虫，已安排生物防治',
        reportDate: '2025-02-01'
      }
    ]
  },
  {
    id: '2',
    name: '有机萝卜',
    variety: '白萝卜',
    category: '根茎类',
    plantingDate: '2025-01-20',
    growthStage: '膨大期',
    expectedHarvest: '2025-03-20',
    totalArea: 3.5,
    currentYield: 78,
    expectedYield: 95,
    healthStatus: 'excellent',
    environmentalData: {
      temperature: 16,
      humidity: 70,
      lightHours: 9.0,
      soilPH: 7.1
    },
    nutritionSchedule: [
      {
        date: '2025-02-05',
        type: '复合肥',
        amount: '30kg/亩',
        applied: false
      }
    ],
    issues: []
  },
  {
    id: '3',
    name: '有机青菜',
    variety: '上海青',
    category: '叶菜类',
    plantingDate: '2025-01-10',
    growthStage: '收获期',
    expectedHarvest: '2025-03-10',
    totalArea: 2.8,
    currentYield: 95,
    expectedYield: 100,
    healthStatus: 'excellent',
    environmentalData: {
      temperature: 19,
      humidity: 72,
      lightHours: 8.8,
      soilPH: 6.9
    },
    nutritionSchedule: [],
    issues: []
  },
  {
    id: '4',
    name: '有机菠菜',
    variety: '圆叶菠菜',
    category: '叶菜类',
    plantingDate: '2025-01-25',
    growthStage: '幼苗期',
    expectedHarvest: '2025-03-25',
    totalArea: 1.5,
    currentYield: 25,
    expectedYield: 80,
    healthStatus: 'fair',
    environmentalData: {
      temperature: 17,
      humidity: 68,
      lightHours: 7.5,
      soilPH: 6.5
    },
    nutritionSchedule: [
      {
        date: '2025-02-04',
        type: '腐熟有机肥',
        amount: '40kg/亩',
        applied: false
      }
    ],
    issues: [
      {
        type: '营养不良',
        severity: 'medium',
        description: '叶片黄化，需要补充氮肥',
        reportDate: '2025-02-02'
      }
    ]
  }
];

export default function CropsPage() {
  const router = useRouter();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    const fetchCrops = async () => {
      setIsLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1400));
        setCrops(mockCropData);
        setSelectedCrop(mockCropData[0]);
      } catch (error) {
        console.error('获取作物数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCrops();
  }, []);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'excellent': return '优秀';
      case 'good': return '良好';
      case 'fair': return '一般';
      case 'poor': return '较差';
      default: return '未知';
    }
  };

  const getGrowthStageColor = (stage: string) => {
    switch (stage) {
      case '收获期': return 'text-orange-600 bg-orange-50';
      case '成长期': return 'text-green-600 bg-green-50';
      case '膨大期': return 'text-blue-600 bg-blue-50';
      case '幼苗期': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getYieldPercentage = (current: number, expected: number) => {
    return Math.round((current / expected) * 100);
  };

  const getYieldColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredCrops = filterCategory === 'all'
    ? crops
    : crops.filter(crop => crop.category === filterCategory);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载作物数据..." />
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
              <h1 className="text-lg font-semibold text-gray-900">作物管理</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => router.push('/farming/crops/add')}
            >
              ＋
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 统计概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">作物概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {crops.length} 种作物
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {crops.filter(c => c.healthStatus === 'excellent').length}
                </div>
                <div className="text-sm text-gray-600">优秀健康</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {crops.filter(c => c.growthStage === '收获期').length}
                </div>
                <div className="text-sm text-gray-600">收获期</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {crops.reduce((sum, c) => sum + c.totalArea, 0).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">总面积(亩)</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(crops.reduce((sum, c) => sum + getYieldPercentage(c.currentYield, c.expectedYield), 0) / crops.length)}%
                </div>
                <div className="text-sm text-gray-600">平均产量率</div>
              </div>
            </div>
          </Card>

          {/* 筛选器 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '全部' },
              { key: '叶菜类', label: '叶菜类' },
              { key: '根茎类', label: '根茎类' },
              { key: '果实类', label: '果实类' }
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={filterCategory === filter.key ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setFilterCategory(filter.key)}
                className="whitespace-nowrap"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* 作物列表 */}
          <div className="space-y-3">
            {filteredCrops.map((crop) => (
              <Card
                key={crop.id}
                className="p-4 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer"
                onClick={() => setSelectedCrop(crop)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{crop.name}</h3>
                    <Badge className={getHealthStatusColor(crop.healthStatus)}>
                      {getHealthStatusText(crop.healthStatus)}
                    </Badge>
                  </div>
                  <Badge className={getGrowthStageColor(crop.growthStage)}>
                    {crop.growthStage}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`text-lg font-bold ${getYieldColor(getYieldPercentage(crop.currentYield, crop.expectedYield))}`}>
                      {getYieldPercentage(crop.currentYield, crop.expectedYield)}%
                    </div>
                    <div className="text-xs text-gray-600">产量进度</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {crop.totalArea} 亩
                    </div>
                    <div className="text-xs text-gray-600">种植面积</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-gray-600">
                    <span className="font-medium">品种:</span> {crop.variety}
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">类别:</span> {crop.category}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    种植: {crop.plantingDate}
                  </div>
                  <div className="text-blue-600">
                    预计收获: {crop.expectedHarvest}
                  </div>
                </div>

                {crop.issues.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">问题:</span>
                      {crop.issues.map((issue, index) => (
                        <Badge
                          key={index}
                          className={`text-xs ${getSeverityColor(issue.severity)}`}
                        >
                          {issue.type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {filteredCrops.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">🌱</div>
              <div className="text-gray-500">暂无符合条件的作物</div>
            </div>
          )}

          {/* 详情模态 */}
          {selectedCrop && (
            <Card className="p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedCrop.name} 详情
                </h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedCrop(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">品种:</span>
                    <div className="font-medium">{selectedCrop.variety}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">类别:</span>
                    <div className="font-medium">{selectedCrop.category}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">种植面积:</span>
                    <div className="font-medium">{selectedCrop.totalArea} 亩</div>
                  </div>
                  <div>
                    <span className="text-gray-500">产量进度:</span>
                    <div className="font-medium">
                      {selectedCrop.currentYield}/{selectedCrop.expectedYield}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">环境数据</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">温度:</span>
                      <span className="ml-1">{selectedCrop.environmentalData.temperature}°C</span>
                    </div>
                    <div>
                      <span className="text-gray-500">湿度:</span>
                      <span className="ml-1">{selectedCrop.environmentalData.humidity}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">光照:</span>
                      <span className="ml-1">{selectedCrop.environmentalData.lightHours}h</span>
                    </div>
                    <div>
                      <span className="text-gray-500">土壤pH:</span>
                      <span className="ml-1">{selectedCrop.environmentalData.soilPH}</span>
                    </div>
                  </div>
                </div>

                {selectedCrop.nutritionSchedule.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">营养计划</h4>
                    <div className="space-y-2">
                      {selectedCrop.nutritionSchedule.map((schedule, index) => (
                        <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{schedule.type}</span>
                            <Badge className={schedule.applied ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'}>
                              {schedule.applied ? '已施用' : '计划中'}
                            </Badge>
                          </div>
                          <div className="text-gray-600">用量: {schedule.amount}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            计划时间: {schedule.date}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCrop.issues.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">问题记录</h4>
                    <div className="space-y-2">
                      {selectedCrop.issues.map((issue, index) => (
                        <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{issue.type}</span>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity === 'high' ? '高' :
                               issue.severity === 'medium' ? '中' : '低'}
                            </Badge>
                          </div>
                          <div className="text-gray-600">{issue.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            报告时间: {issue.reportDate}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-3">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => router.push(`/farming/crops/${selectedCrop.id}/edit`)}
                  >
                    编辑作物
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => router.push(`/farming/crops/${selectedCrop.id}/nutrition`)}
                  >
                    营养管理
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
