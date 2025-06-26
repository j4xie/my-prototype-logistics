'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 田地数据接口
interface Field {
  id: string;
  name: string;
  area: number;
  location: string;
  soilType: string;
  cropType: string;
  plantingDate: string;
  harvestDate: string;
  status: 'idle' | 'planted' | 'growing' | 'harvesting' | 'maintenance';
  healthScore: number;
  yieldEstimate: number;
  irrigation: {
    type: string;
    lastWatering: string;
    nextWatering: string;
    moistureLevel: number;
  };
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    reportDate: string;
  }>;
}

// Mock 田地数据
const mockFieldData: Field[] = [
  {
    id: '1',
    name: 'A区田地',
    area: 2.5,
    location: '东区A栋',
    soilType: '壤土',
    cropType: '有机白菜',
    plantingDate: '2025-01-15',
    harvestDate: '2025-03-15',
    status: 'growing',
    healthScore: 92,
    yieldEstimate: 2850,
    irrigation: {
      type: '滴灌系统',
      lastWatering: '2025-02-02 06:00',
      nextWatering: '2025-02-03 06:00',
      moistureLevel: 78
    },
    issues: [
      {
        type: '病虫害风险',
        severity: 'low',
        description: '发现少量蚜虫，已安排生物防治',
        reportDate: '2025-02-01'
      }
    ]
  },
  {
    id: '2',
    name: 'B区田地',
    area: 1.8,
    location: '西区B栋',
    soilType: '砂壤土',
    cropType: '有机萝卜',
    plantingDate: '2025-01-20',
    harvestDate: '2025-03-20',
    status: 'growing',
    healthScore: 88,
    yieldEstimate: 1950,
    irrigation: {
      type: '喷淋系统',
      lastWatering: '2025-02-02 07:30',
      nextWatering: '2025-02-03 07:30',
      moistureLevel: 72
    },
    issues: []
  },
  {
    id: '3',
    name: 'C区田地',
    area: 3.2,
    location: '南区C栋',
    soilType: '黏土',
    cropType: '有机青菜',
    plantingDate: '2025-01-10',
    harvestDate: '2025-03-10',
    status: 'harvesting',
    healthScore: 95,
    yieldEstimate: 3200,
    irrigation: {
      type: '滴灌系统',
      lastWatering: '2025-02-01 18:00',
      nextWatering: '2025-02-03 18:00',
      moistureLevel: 65
    },
    issues: []
  },
  {
    id: '4',
    name: 'D区田地',
    area: 2.0,
    location: '北区D栋',
    soilType: '壤土',
    cropType: '待种植',
    plantingDate: '',
    harvestDate: '',
    status: 'idle',
    healthScore: 85,
    yieldEstimate: 0,
    irrigation: {
      type: '滴灌系统',
      lastWatering: '2025-01-30 12:00',
      nextWatering: '按需灌溉',
      moistureLevel: 55
    },
    issues: [
      {
        type: '土壤改良',
        severity: 'medium',
        description: '需要补充有机肥料',
        reportDate: '2025-01-28'
      }
    ]
  }
];

export default function FieldsPage() {
  const router = useRouter();
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchFields = async () => {
      setIsLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1200));
        setFields(mockFieldData);
        setSelectedField(mockFieldData[0]);
      } catch (error) {
        console.error('获取田地数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFields();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'growing': return 'text-green-600 bg-green-50';
      case 'harvesting': return 'text-orange-600 bg-orange-50';
      case 'idle': return 'text-gray-600 bg-gray-50';
      case 'planted': return 'text-blue-600 bg-blue-50';
      case 'maintenance': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'growing': return '生长中';
      case 'harvesting': return '收获中';
      case 'idle': return '待种植';
      case 'planted': return '已种植';
      case 'maintenance': return '维护中';
      default: return '未知';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMoistureColor = (level: number) => {
    if (level >= 70) return 'text-blue-600';
    if (level >= 50) return 'text-green-600';
    if (level >= 30) return 'text-yellow-600';
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

  const filteredFields = filterStatus === 'all'
    ? fields
    : fields.filter(field => field.status === filterStatus);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载田地数据..." />
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
              <h1 className="text-lg font-semibold text-gray-900">田地管理</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => router.push('/farming/fields/add')}
            >
              ＋
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 统计概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">田地概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {fields.length} 块田地
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {fields.filter(f => f.status === 'growing').length}
                </div>
                <div className="text-sm text-gray-600">生长中</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {fields.filter(f => f.status === 'harvesting').length}
                </div>
                <div className="text-sm text-gray-600">收获中</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {fields.filter(f => f.status === 'idle').length}
                </div>
                <div className="text-sm text-gray-600">待种植</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {fields.reduce((sum, f) => sum + f.area, 0).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">总面积(亩)</div>
              </div>
            </div>
          </Card>

          {/* 筛选器 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'growing', label: '生长中' },
              { key: 'harvesting', label: '收获中' },
              { key: 'idle', label: '待种植' },
              { key: 'maintenance', label: '维护中' }
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={filterStatus === filter.key ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setFilterStatus(filter.key)}
                className="whitespace-nowrap"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* 田地列表 */}
          <div className="space-y-3">
            {filteredFields.map((field) => (
              <Card
                key={field.id}
                className="p-4 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer"
                onClick={() => setSelectedField(field)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{field.name}</h3>
                    <Badge className={getStatusColor(field.status)}>
                      {getStatusText(field.status)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{field.area} 亩</div>
                    <div className="text-sm text-gray-500">{field.location}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`text-lg font-bold ${getHealthScoreColor(field.healthScore)}`}>
                      {field.healthScore}分
                    </div>
                    <div className="text-xs text-gray-600">健康度</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`text-lg font-bold ${getMoistureColor(field.irrigation.moistureLevel)}`}>
                      {field.irrigation.moistureLevel}%
                    </div>
                    <div className="text-xs text-gray-600">土壤湿度</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <span className="font-medium">作物:</span> {field.cropType}
                  </div>
                  {field.yieldEstimate > 0 && (
                    <div className="text-blue-600">
                      预产 {field.yieldEstimate}kg
                    </div>
                  )}
                </div>

                {field.issues.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">问题:</span>
                      {field.issues.map((issue, index) => (
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

          {filteredFields.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">📋</div>
              <div className="text-gray-500">暂无符合条件的田地</div>
            </div>
          )}

          {/* 详情模态 */}
          {selectedField && (
            <Card className="p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedField.name} 详情
                </h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedField(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">位置:</span>
                    <div className="font-medium">{selectedField.location}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">土壤:</span>
                    <div className="font-medium">{selectedField.soilType}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">种植日期:</span>
                    <div className="font-medium">
                      {selectedField.plantingDate || '未种植'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">预计收获:</span>
                    <div className="font-medium">
                      {selectedField.harvestDate || '待定'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">灌溉信息</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">系统类型:</span>
                      <span>{selectedField.irrigation.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">上次灌溉:</span>
                      <span>{selectedField.irrigation.lastWatering}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">下次灌溉:</span>
                      <span>{selectedField.irrigation.nextWatering}</span>
                    </div>
                  </div>
                </div>

                {selectedField.issues.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">问题记录</h4>
                    <div className="space-y-2">
                      {selectedField.issues.map((issue, index) => (
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
                    onClick={() => router.push(`/farming/fields/${selectedField.id}/edit`)}
                  >
                    编辑田地
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => router.push(`/farming/fields/${selectedField.id}/history`)}
                  >
                    查看历史
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
