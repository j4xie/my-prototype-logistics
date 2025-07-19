'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 农场活动数据接口
interface FarmActivity {
  id: string;
  activityName: string;
  type: 'planting' | 'harvesting' | 'maintenance' | 'irrigation' | 'fertilization' | 'pestControl';
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  fieldId: string;
  fieldName: string;
  cropType: string;
  startDate: string;
  endDate: string;
  estimatedDuration: number;
  actualDuration?: number;
  assignedWorkers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  resources: Array<{
    type: string;
    amount: number;
    unit: string;
    cost: number;
  }>;
  description: string;
  completionNotes?: string;
}

// Mock 农场活动数据
const mockFarmActivityData: FarmActivity[] = [
  {
    id: '1',
    activityName: '白菜追肥作业',
    type: 'fertilization',
    status: 'ongoing',
    priority: 'high',
    fieldId: 'field-1',
    fieldName: 'A区田地',
    cropType: '有机白菜',
    startDate: '2025-02-03',
    endDate: '2025-02-03',
    estimatedDuration: 4,
    actualDuration: 3,
    assignedWorkers: [
      { id: '1', name: '张师傅', role: '施肥专员' },
      { id: '2', name: '李强', role: '助手' }
    ],
    resources: [
      { type: '有机肥', amount: 50, unit: 'kg', cost: 300 },
      { type: '喷洒设备', amount: 1, unit: '台', cost: 0 }
    ],
    description: '对A区白菜进行第二次追肥，促进叶片生长',
    completionNotes: '施肥均匀，叶片反应良好'
  },
  {
    id: '2',
    activityName: '萝卜收获准备',
    type: 'harvesting',
    status: 'planned',
    priority: 'medium',
    fieldId: 'field-2',
    fieldName: 'B区田地',
    cropType: '有机萝卜',
    startDate: '2025-02-05',
    endDate: '2025-02-05',
    estimatedDuration: 6,
    assignedWorkers: [
      { id: '3', name: '王师傅', role: '收获专员' },
      { id: '4', name: '陈明', role: '助手' },
      { id: '5', name: '刘华', role: '助手' }
    ],
    resources: [
      { type: '收获工具', amount: 3, unit: '套', cost: 0 },
      { type: '包装箱', amount: 50, unit: '个', cost: 100 }
    ],
    description: '萝卜已达收获标准，准备进行收获作业'
  },
  {
    id: '3',
    activityName: 'C区灌溉维护',
    type: 'irrigation',
    status: 'completed',
    priority: 'high',
    fieldId: 'field-3',
    fieldName: 'C区田地',
    cropType: '有机青菜',
    startDate: '2025-02-01',
    endDate: '2025-02-01',
    estimatedDuration: 3,
    actualDuration: 2,
    assignedWorkers: [
      { id: '6', name: '赵师傅', role: '灌溉技术员' }
    ],
    resources: [
      { type: '管道材料', amount: 10, unit: 'm', cost: 200 },
      { type: '维修工具', amount: 1, unit: '套', cost: 0 }
    ],
    description: '修复C区损坏的灌溉管道，确保正常供水',
    completionNotes: '管道修复完成，水压正常'
  },
  {
    id: '4',
    activityName: '菠菜病虫害防治',
    type: 'pestControl',
    status: 'ongoing',
    priority: 'high',
    fieldId: 'field-4',
    fieldName: 'D区田地',
    cropType: '有机菠菜',
    startDate: '2025-02-02',
    endDate: '2025-02-04',
    estimatedDuration: 8,
    actualDuration: 6,
    assignedWorkers: [
      { id: '7', name: '孙师傅', role: '植保专员' },
      { id: '8', name: '周涛', role: '助手' }
    ],
    resources: [
      { type: '生物农药', amount: 5, unit: 'L', cost: 250 },
      { type: '喷雾器', amount: 2, unit: '台', cost: 0 }
    ],
    description: '发现菠菜叶片有蚜虫，使用生物防治方法',
    completionNotes: '防治效果显著，蚜虫数量明显减少'
  },
  {
    id: '5',
    activityName: '新田地土壤改良',
    type: 'maintenance',
    status: 'planned',
    priority: 'low',
    fieldId: 'field-6',
    fieldName: 'F区田地',
    cropType: '预备田地',
    startDate: '2025-02-10',
    endDate: '2025-02-15',
    estimatedDuration: 20,
    assignedWorkers: [
      { id: '9', name: '马师傅', role: '土壤专员' },
      { id: '10', name: '杨强', role: '操作员' }
    ],
    resources: [
      { type: '有机肥料', amount: 200, unit: 'kg', cost: 1200 },
      { type: '土壤改良剂', amount: 50, unit: 'kg', cost: 400 },
      { type: '耕作设备', amount: 1, unit: '台', cost: 0 }
    ],
    description: '为F区新田地进行土壤改良，提高土壤肥力'
  }
];

export default function FarmActivitiesPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<FarmActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1200));
        setActivities(mockFarmActivityData);
        setSelectedActivity(mockFarmActivityData[0]);
      } catch (error) {
        console.error('获取农场活动失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'ongoing': return 'text-blue-600 bg-blue-50';
      case 'planned': return 'text-gray-600 bg-gray-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'ongoing': return '进行中';
      case 'planned': return '计划中';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高优先级';
      case 'medium': return '中优先级';
      case 'low': return '低优先级';
      default: return '未知';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'planting': return 'text-green-600 bg-green-50';
      case 'harvesting': return 'text-orange-600 bg-orange-50';
      case 'maintenance': return 'text-gray-600 bg-gray-50';
      case 'irrigation': return 'text-blue-600 bg-blue-50';
      case 'fertilization': return 'text-purple-600 bg-purple-50';
      case 'pestControl': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'planting': return '种植';
      case 'harvesting': return '收获';
      case 'maintenance': return '维护';
      case 'irrigation': return '灌溉';
      case 'fertilization': return '施肥';
      case 'pestControl': return '防治';
      default: return '其他';
    }
  };

  const filteredActivities = filterStatus === 'all'
    ? activities
    : activities.filter(activity => activity.status === filterStatus);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载农场活动..." />
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
              <h1 className="text-lg font-semibold text-gray-900">农场活动</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => router.push('/farming/farm-activities/add')}
            >
              ＋
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 统计概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">活动概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {activities.length} 项活动
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {activities.filter(a => a.status === 'ongoing').length}
                </div>
                <div className="text-sm text-gray-600">进行中</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {activities.filter(a => a.status === 'planned').length}
                </div>
                <div className="text-sm text-gray-600">计划中</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {activities.filter(a => a.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">已完成</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {activities.filter(a => a.priority === 'high').length}
                </div>
                <div className="text-sm text-gray-600">高优先级</div>
              </div>
            </div>
          </Card>

          {/* 筛选器 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'ongoing', label: '进行中' },
              { key: 'planned', label: '计划中' },
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

          {/* 活动列表 */}
          <div className="space-y-3">
            {filteredActivities.map((activity) => (
              <Card
                key={activity.id}
                className="p-4 hover:shadow-md hover:scale-[1.03] transition-all cursor-pointer"
                onClick={() => setSelectedActivity(activity)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{activity.activityName}</h3>
                    <Badge className={getTypeColor(activity.type)}>
                      {getTypeText(activity.type)}
                    </Badge>
                  </div>
                  <Badge className={getStatusColor(activity.status)}>
                    {getStatusText(activity.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <Badge className={getPriorityColor(activity.priority)}>
                      {getPriorityText(activity.priority)}
                    </Badge>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      {activity.estimatedDuration}h
                    </div>
                    <div className="text-xs text-gray-600">预计时长</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-gray-600">
                    <span className="font-medium">田地:</span> {activity.fieldName}
                  </div>
                  <div className="text-gray-600">
                    <span className="font-medium">作物:</span> {activity.cropType}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    开始: {activity.startDate}
                  </div>
                  <div className="text-blue-600">
                    结束: {activity.endDate}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    负责人: {activity.assignedWorkers.map(w => w.name).join(', ')}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredActivities.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">🚜</div>
              <div className="text-gray-500">暂无符合条件的农场活动</div>
            </div>
          )}

          {/* 详情模态 */}
          {selectedActivity && (
            <Card className="p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedActivity.activityName}
                </h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedActivity(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">活动类型:</span>
                    <div className="font-medium">{getTypeText(selectedActivity.type)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">优先级:</span>
                    <div className="font-medium">{getPriorityText(selectedActivity.priority)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">田地:</span>
                    <div className="font-medium">{selectedActivity.fieldName}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">作物:</span>
                    <div className="font-medium">{selectedActivity.cropType}</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">时间安排</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">开始时间:</span>
                      <span className="ml-1">{selectedActivity.startDate}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">结束时间:</span>
                      <span className="ml-1">{selectedActivity.endDate}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">预计时长:</span>
                      <span className="ml-1">{selectedActivity.estimatedDuration}小时</span>
                    </div>
                    {selectedActivity.actualDuration && (
                      <div>
                        <span className="text-gray-500">实际时长:</span>
                        <span className="ml-1">{selectedActivity.actualDuration}小时</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">分配人员</h4>
                  <div className="space-y-2">
                    {selectedActivity.assignedWorkers.map((worker, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">{worker.name}</span>
                          <span className="text-gray-600">{worker.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">资源使用</h4>
                  <div className="space-y-2">
                    {selectedActivity.resources.map((resource, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{resource.type}</span>
                          <span className="text-blue-600">¥{resource.cost}</span>
                        </div>
                        <div className="text-gray-600">
                          用量: {resource.amount} {resource.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <h4 className="font-medium text-gray-900 mb-2">活动描述</h4>
                  <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                    {selectedActivity.description}
                  </div>
                </div>

                {selectedActivity.completionNotes && (
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">完成备注</h4>
                    <div className="text-sm text-gray-600 p-2 bg-green-50 rounded">
                      {selectedActivity.completionNotes}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-3">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => router.push(`/farming/farm-activities/${selectedActivity.id}/edit`)}
                  >
                    编辑活动
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => router.push(`/farming/farm-activities/${selectedActivity.id}/progress`)}
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
