'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface ProductionPlan {
  id: string;
  planNumber: string;
  productName: string;
  productCode: string;
  plannedQuantity: number;
  completedQuantity: number;
  status: 'planning' | 'in_progress' | 'completed' | 'paused' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  endDate: string;
  estimatedDuration: number;
  assignedWorkers: number;
  supervisorName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductionStatistics {
  activePlans: number;
  completedToday: number;
  totalWorkers: number;
  averageEfficiency: number;
}

export default function ProductionPlanningPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<ProductionStatistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Mock生产计划数据
      const mockPlans: ProductionPlan[] = [
        {
          id: 'plan-001',
          planNumber: 'PP-2025020201',
          productName: '有机牛肉精装礼盒',
          productCode: 'ORG-BEEF-001',
          plannedQuantity: 500,
          completedQuantity: 320,
          status: 'in_progress',
          priority: 'high',
          startDate: '2025-02-01',
          endDate: '2025-02-05',
          estimatedDuration: 96,
          assignedWorkers: 12,
          supervisorName: '张主管',
          notes: '春节期间特殊订单，需要加急处理',
          createdAt: '2025-01-28',
          updatedAt: '2025-02-02'
        },
        {
          id: 'plan-002',
          planNumber: 'PP-2025020202',
          productName: '冷鲜鸡肉分割',
          productCode: 'FRESH-CHICK-002',
          plannedQuantity: 2000,
          completedQuantity: 0,
          status: 'planning',
          priority: 'medium',
          startDate: '2025-02-03',
          endDate: '2025-02-07',
          estimatedDuration: 80,
          assignedWorkers: 8,
          supervisorName: '李主管',
          createdAt: '2025-01-30',
          updatedAt: '2025-02-01'
        },
        {
          id: 'plan-003',
          planNumber: 'PP-2025020203',
          productName: '有机蔬菜净菜包',
          productCode: 'ORG-VEG-003',
          plannedQuantity: 1500,
          completedQuantity: 1500,
          status: 'completed',
          priority: 'low',
          startDate: '2025-01-28',
          endDate: '2025-02-01',
          estimatedDuration: 60,
          assignedWorkers: 6,
          supervisorName: '王主管',
          createdAt: '2025-01-25',
          updatedAt: '2025-02-01'
        }
      ];

      // Mock统计数据
      const mockStats: ProductionStatistics = {
        activePlans: 15,
        completedToday: 3,
        totalWorkers: 45,
        averageEfficiency: 87.5
      };

      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      setPlans(mockPlans);
      setStatistics(mockStats);
    } catch (error) {
      console.error('获取生产计划数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'primary';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'paused':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning':
        return '计划中';
      case 'in_progress':
        return '生产中';
      case 'completed':
        return '已完成';
      case 'paused':
        return '暂停';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '未知';
    }
  };

  const getProgressPercentage = (plan: ProductionPlan) => {
    return Math.round((plan.completedQuantity / plan.plannedQuantity) * 100);
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.planNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.supervisorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || plan.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || plan.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="返回"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">生产计划管理</h1>
          <div className="w-8 h-8"></div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 统计概览 */}
        {statistics && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.activePlans}
                </p>
                <p className="text-sm text-gray-600">活跃计划</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {statistics.completedToday}
                </p>
                <p className="text-sm text-gray-600">今日完成</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {statistics.totalWorkers}
                </p>
                <p className="text-sm text-gray-600">总工人数</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {statistics.averageEfficiency}%
                </p>
                <p className="text-sm text-gray-600">平均效率</p>
              </div>
            </Card>
          </div>
        )}

        {/* 筛选和搜索 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="space-y-3">
            <Input
              placeholder="搜索计划号、产品或主管..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'planning', label: '计划中' },
                  { value: 'in_progress', label: '生产中' },
                  { value: 'completed', label: '已完成' },
                  { value: 'paused', label: '暂停' },
                  { value: 'cancelled', label: '已取消' }
                ]}
              />
              <Select
                value={filterPriority}
                onChange={setFilterPriority}
                options={[
                  { value: 'all', label: '全部优先级' },
                  { value: 'high', label: '高优先级' },
                  { value: 'medium', label: '中优先级' },
                  { value: 'low', label: '低优先级' }
                ]}
              />
            </div>
            <Button variant="primary" className="w-full">新建计划</Button>
          </div>
        </Card>

        {/* 计划列表 */}
        <div className="space-y-4">
          {filteredPlans.map((plan) => (
            <Card
              key={plan.id}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{plan.planNumber}</h3>
                  <p className="text-sm text-gray-600">{plan.productName} ({plan.productCode})</p>
                </div>
                <div className="flex space-x-2">
                  <Badge variant={getPriorityColor(plan.priority)}>
                    {getPriorityText(plan.priority)}
                  </Badge>
                  <Badge variant={getStatusColor(plan.status)}>
                    {getStatusText(plan.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">生产进度：</span>
                  <span className="font-medium">
                    {plan.completedQuantity}/{plan.plannedQuantity} ({getProgressPercentage(plan)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${getProgressPercentage(plan)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">计划时间：</span>
                  <span>{plan.startDate} - {plan.endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">负责人：</span>
                  <span>{plan.supervisorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">工人数量：</span>
                  <span>{plan.assignedWorkers}人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">预估用时：</span>
                  <span>{plan.estimatedDuration}小时</span>
                </div>
              </div>

              {plan.notes && (
                <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                  <span className="text-gray-600">备注：</span>
                  {plan.notes}
                </div>
              )}

              <div className="flex space-x-2 mt-4">
                <Button size="small" variant="secondary" className="flex-1">
                  查看详情
                </Button>
                <Button size="small" variant="secondary" className="flex-1">
                  编辑计划
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
