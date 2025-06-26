'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 种植计划数据接口
interface PlantingPlan {
  id: string;
  planName: string;
  cropType: string;
  variety: string;
  fieldId: string;
  fieldName: string;
  plannedArea: number;
  actualArea: number;
  plannedStartDate: string;
  actualStartDate: string;
  plannedHarvestDate: string;
  estimatedHarvestDate: string;
  status: 'planned' | 'preparing' | 'planting' | 'growing' | 'completed' | 'cancelled';
  progress: number;
  resources: {
    seeds: { planned: number; used: number; unit: string };
    fertilizer: { planned: number; used: number; unit: string };
    labor: { planned: number; used: number; unit: string };
    water: { planned: number; used: number; unit: string };
  };
  milestones: Array<{
    id: string;
    name: string;
    plannedDate: string;
    actualDate: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delayed';
    description: string;
  }>;
  notes: string;
}

// Mock 种植计划数据
const mockPlantingPlanData: PlantingPlan[] = [
  {
    id: '1',
    planName: '春季白菜种植计划',
    cropType: '有机白菜',
    variety: '小白菜',
    fieldId: 'field-1',
    fieldName: 'A区田地',
    plannedArea: 2.5,
    actualArea: 2.5,
    plannedStartDate: '2025-01-15',
    actualStartDate: '2025-01-15',
    plannedHarvestDate: '2025-03-15',
    estimatedHarvestDate: '2025-03-18',
    status: 'growing',
    progress: 65,
    resources: {
      seeds: { planned: 50, used: 50, unit: 'kg' },
      fertilizer: { planned: 100, used: 75, unit: 'kg' },
      labor: { planned: 40, used: 28, unit: '工时' },
      water: { planned: 1000, used: 650, unit: 'm³' }
    },
    milestones: [
      {
        id: '1',
        name: '土地准备',
        plannedDate: '2025-01-10',
        actualDate: '2025-01-10',
        status: 'completed',
        description: '深耕、施底肥、整地'
      },
      {
        id: '2',
        name: '播种',
        plannedDate: '2025-01-15',
        actualDate: '2025-01-15',
        status: 'completed',
        description: '播种小白菜种子'
      },
      {
        id: '3',
        name: '幼苗管理',
        plannedDate: '2025-01-25',
        actualDate: '2025-01-25',
        status: 'completed',
        description: '间苗、补苗、施肥'
      },
      {
        id: '4',
        name: '中期管理',
        plannedDate: '2025-02-05',
        actualDate: '2025-02-03',
        status: 'in_progress',
        description: '追肥、浇水、病虫害防治'
      },
      {
        id: '5',
        name: '收获准备',
        plannedDate: '2025-03-10',
        actualDate: '',
        status: 'pending',
        description: '收获前准备工作'
      }
    ],
    notes: '生长情况良好，需要注意病虫害防治'
  },
  {
    id: '2',
    planName: '有机萝卜种植计划',
    cropType: '有机萝卜',
    variety: '白萝卜',
    fieldId: 'field-2',
    fieldName: 'B区田地',
    plannedArea: 1.8,
    actualArea: 1.8,
    plannedStartDate: '2025-01-20',
    actualStartDate: '2025-01-20',
    plannedHarvestDate: '2025-03-20',
    estimatedHarvestDate: '2025-03-20',
    status: 'growing',
    progress: 58,
    resources: {
      seeds: { planned: 30, used: 30, unit: 'kg' },
      fertilizer: { planned: 80, used: 50, unit: 'kg' },
      labor: { planned: 35, used: 20, unit: '工时' },
      water: { planned: 800, used: 460, unit: 'm³' }
    },
    milestones: [
      {
        id: '1',
        name: '土地准备',
        plannedDate: '2025-01-18',
        actualDate: '2025-01-18',
        status: 'completed',
        description: '深耕、施底肥'
      },
      {
        id: '2',
        name: '播种',
        plannedDate: '2025-01-20',
        actualDate: '2025-01-20',
        status: 'completed',
        description: '直播萝卜种子'
      },
      {
        id: '3',
        name: '苗期管理',
        plannedDate: '2025-01-30',
        actualDate: '2025-01-30',
        status: 'completed',
        description: '间苗、除草、浇水'
      },
      {
        id: '4',
        name: '膨大期管理',
        plannedDate: '2025-02-10',
        actualDate: '',
        status: 'in_progress',
        description: '追肥、灌溉管理'
      }
    ],
    notes: '萝卜膨大期需要充足水分'
  },
  {
    id: '3',
    planName: '夏季青菜轮作计划',
    cropType: '有机青菜',
    variety: '上海青',
    fieldId: 'field-3',
    fieldName: 'C区田地',
    plannedArea: 3.2,
    actualArea: 0,
    plannedStartDate: '2025-04-01',
    actualStartDate: '',
    plannedHarvestDate: '2025-06-01',
    estimatedHarvestDate: '2025-06-01',
    status: 'planned',
    progress: 15,
    resources: {
      seeds: { planned: 60, used: 0, unit: 'kg' },
      fertilizer: { planned: 120, used: 0, unit: 'kg' },
      labor: { planned: 50, used: 5, unit: '工时' },
      water: { planned: 1200, used: 0, unit: 'm³' }
    },
    milestones: [
      {
        id: '1',
        name: '收获前茬作物',
        plannedDate: '2025-03-10',
        actualDate: '',
        status: 'in_progress',
        description: '收获C区现有青菜'
      },
      {
        id: '2',
        name: '土地休整',
        plannedDate: '2025-03-15',
        actualDate: '',
        status: 'pending',
        description: '清理田地、土壤改良'
      },
      {
        id: '3',
        name: '土地准备',
        plannedDate: '2025-03-25',
        actualDate: '',
        status: 'pending',
        description: '深耕、施底肥、做畦'
      }
    ],
    notes: '待前茬作物收获完成后开始'
  },
  {
    id: '4',
    planName: '有机菠菜试验种植',
    cropType: '有机菠菜',
    variety: '圆叶菠菜',
    fieldId: 'field-4',
    fieldName: 'D区田地',
    plannedArea: 1.5,
    actualArea: 1.5,
    plannedStartDate: '2025-01-25',
    actualStartDate: '2025-01-25',
    plannedHarvestDate: '2025-03-25',
    estimatedHarvestDate: '2025-03-28',
    status: 'preparing',
    progress: 25,
    resources: {
      seeds: { planned: 25, used: 25, unit: 'kg' },
      fertilizer: { planned: 60, used: 15, unit: 'kg' },
      labor: { planned: 30, used: 8, unit: '工时' },
      water: { planned: 600, used: 150, unit: 'm³' }
    },
    milestones: [
      {
        id: '1',
        name: '土地准备',
        plannedDate: '2025-01-23',
        actualDate: '2025-01-23',
        status: 'completed',
        description: '土壤改良、施有机肥'
      },
      {
        id: '2',
        name: '播种',
        plannedDate: '2025-01-25',
        actualDate: '2025-01-25',
        status: 'completed',
        description: '直播菠菜种子'
      },
      {
        id: '3',
        name: '出苗管理',
        plannedDate: '2025-02-05',
        actualDate: '',
        status: 'delayed',
        description: '出苗率检查、补种'
      }
    ],
    notes: '试验性种植，观察品种适应性'
  }
];

export default function PlantingPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlantingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlantingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1300));
        setPlans(mockPlantingPlanData);
        setSelectedPlan(mockPlantingPlanData[0]);
      } catch (error) {
        console.error('获取种植计划失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'text-gray-600 bg-gray-50';
      case 'preparing': return 'text-yellow-600 bg-yellow-50';
      case 'planting': return 'text-blue-600 bg-blue-50';
      case 'growing': return 'text-green-600 bg-green-50';
      case 'completed': return 'text-purple-600 bg-purple-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planned': return '计划中';
      case 'preparing': return '准备中';
      case 'planting': return '种植中';
      case 'growing': return '生长中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'delayed': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getMilestoneStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'delayed': return '延迟';
      case 'pending': return '待开始';
      default: return '未知';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600';
    if (progress >= 60) return 'text-blue-600';
    if (progress >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResourceUsageColor = (used: number, planned: number) => {
    const percentage = (used / planned) * 100;
    if (percentage <= 75) return 'text-green-600';
    if (percentage <= 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredPlans = filterStatus === 'all'
    ? plans
    : plans.filter(plan => plan.status === filterStatus);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载种植计划..." />
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
              <h1 className="text-lg font-semibold text-gray-900">种植计划</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => router.push('/farming/planting-plans/add')}
            >
              ＋
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 统计概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">计划概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {plans.length} 个计划
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {plans.filter(p => p.status === 'growing').length}
                </div>
                <div className="text-sm text-gray-600">进行中</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {plans.filter(p => p.status === 'planned').length}
                </div>
                <div className="text-sm text-gray-600">计划中</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {plans.reduce((sum, p) => sum + p.plannedArea, 0).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">计划面积(亩)</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(plans.reduce((sum, p) => sum + p.progress, 0) / plans.length)}%
                </div>
                <div className="text-sm text-gray-600">平均进度</div>
              </div>
            </div>
          </Card>

          {/* 筛选器 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'planned', label: '计划中' },
              { key: 'preparing', label: '准备中' },
              { key: 'growing', label: '生长中' },
              { key: 'completed', label: '已完成' }
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

          {/* 计划列表 */}
          <div className="space-y-3">
            {filteredPlans.map((plan) => (
              <Card
                key={plan.id}
                className="p-4 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer"
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{plan.planName}</h3>
                    <Badge className={getStatusColor(plan.status)}>
                      {getStatusText(plan.status)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{plan.plannedArea} 亩</div>
                    <div className="text-sm text-gray-500">{plan.fieldName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`text-lg font-bold ${getProgressColor(plan.progress)}`}>
                      {plan.progress}%
                    </div>
                    <div className="text-xs text-gray-600">完成进度</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {plan.milestones.filter(m => m.status === 'completed').length}/{plan.milestones.length}
                    </div>
                    <div className="text-xs text-gray-600">里程碑</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-gray-600">
                    <span className="font-medium">作物:</span> {plan.cropType}
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">品种:</span> {plan.variety}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    开始: {plan.plannedStartDate}
                  </div>
                  <div className="text-blue-600">
                    预计收获: {plan.plannedHarvestDate}
                  </div>
                </div>

                {plan.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500">备注: {plan.notes}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {filteredPlans.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">📅</div>
              <div className="text-gray-500">暂无符合条件的种植计划</div>
            </div>
          )}

          {/* 详情模态 */}
          {selectedPlan && (
            <Card className="p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedPlan.planName}
                </h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedPlan(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">作物品种:</span>
                    <div className="font-medium">{selectedPlan.cropType} - {selectedPlan.variety}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">种植田地:</span>
                    <div className="font-medium">{selectedPlan.fieldName}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">计划面积:</span>
                    <div className="font-medium">{selectedPlan.plannedArea} 亩</div>
                  </div>
                  <div>
                    <span className="text-gray-500">实际面积:</span>
                    <div className="font-medium">{selectedPlan.actualArea || '未开始'} 亩</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">资源使用情况</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">种子:</span>
                      <span className={`ml-1 ${getResourceUsageColor(selectedPlan.resources.seeds.used, selectedPlan.resources.seeds.planned)}`}>
                        {selectedPlan.resources.seeds.used}/{selectedPlan.resources.seeds.planned} {selectedPlan.resources.seeds.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">肥料:</span>
                      <span className={`ml-1 ${getResourceUsageColor(selectedPlan.resources.fertilizer.used, selectedPlan.resources.fertilizer.planned)}`}>
                        {selectedPlan.resources.fertilizer.used}/{selectedPlan.resources.fertilizer.planned} {selectedPlan.resources.fertilizer.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">人工:</span>
                      <span className={`ml-1 ${getResourceUsageColor(selectedPlan.resources.labor.used, selectedPlan.resources.labor.planned)}`}>
                        {selectedPlan.resources.labor.used}/{selectedPlan.resources.labor.planned} {selectedPlan.resources.labor.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">水资源:</span>
                      <span className={`ml-1 ${getResourceUsageColor(selectedPlan.resources.water.used, selectedPlan.resources.water.planned)}`}>
                        {selectedPlan.resources.water.used}/{selectedPlan.resources.water.planned} {selectedPlan.resources.water.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">里程碑进度</h4>
                  <div className="space-y-2">
                    {selectedPlan.milestones.map((milestone) => (
                      <div key={milestone.id} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{milestone.name}</span>
                          <Badge className={getMilestoneStatusColor(milestone.status)}>
                            {getMilestoneStatusText(milestone.status)}
                          </Badge>
                        </div>
                        <div className="text-gray-600">{milestone.description}</div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>计划: {milestone.plannedDate}</span>
                          {milestone.actualDate && (
                            <span>实际: {milestone.actualDate}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPlan.notes && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">备注</h4>
                    <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                      {selectedPlan.notes}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-3">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => router.push(`/farming/planting-plans/${selectedPlan.id}/edit`)}
                  >
                    编辑计划
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => router.push(`/farming/planting-plans/${selectedPlan.id}/progress`)}
                  >
                    更新进度
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
