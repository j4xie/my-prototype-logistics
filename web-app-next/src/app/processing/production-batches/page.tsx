'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  StatCard,
  PageLayout,
  Loading,
  Badge,
  Input,
  Select,
  Modal
} from '@/components/ui';

interface ProductionBatch {
  id: string;
  batchNumber: string;
  productName: string;
  rawMaterial: string;
  plannedQuantity: number;
  actualQuantity: number;
  status: 'planning' | 'production' | 'quality-check' | 'packaging' | 'completed' | 'paused';
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  supervisor: string;
  qualityScore?: number;
  notes: string;
  timeline: {
    stage: string;
    startTime: string;
    endTime?: string;
    status: 'completed' | 'in-progress' | 'pending';
    operator: string;
  }[];
  createdAt: string;
}

interface BatchStats {
  totalBatches: number;
  activeBatches: number;
  completedBatches: number;
  delayedBatches: number;
  averageCompletionTime: number;
  productionEfficiency: number;
}

export default function ProductionBatchesPage() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/processing/production-batches');
      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches || []);
      } else {
        // Fallback mock data
        setBatches(generateMockBatches());
      }
    } catch (error) {
      console.error('获取生产批次失败:', error);
      setBatches(generateMockBatches());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchStats();
  }, [fetchBatches]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/processing/production-batches?type=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        setStats({
          totalBatches: 45,
          activeBatches: 12,
          completedBatches: 28,
          delayedBatches: 3,
          averageCompletionTime: 4.2,
          productionEfficiency: 87
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({
        totalBatches: 45,
        activeBatches: 12,
        completedBatches: 28,
        delayedBatches: 3,
        averageCompletionTime: 4.2,
        productionEfficiency: 87
      });
    }
  };

  const generateMockBatches = (): ProductionBatch[] => {
    return [
      {
        id: 'PB001',
        batchNumber: 'PC-2025-001',
        productName: '优质猪肉制品',
        rawMaterial: '新鲜猪肉',
        plannedQuantity: 1000,
        actualQuantity: 950,
        status: 'completed',
        startDate: '2025-01-28',
        expectedEndDate: '2025-02-01',
        actualEndDate: '2025-02-01',
        supervisor: '张生产',
        qualityScore: 92,
        notes: '生产顺利完成，质量优良',
        timeline: [
          { stage: '原料准备', startTime: '2025-01-28T08:00:00Z', endTime: '2025-01-28T10:00:00Z', status: 'completed', operator: '李准备' },
          { stage: '清洗处理', startTime: '2025-01-28T10:00:00Z', endTime: '2025-01-28T14:00:00Z', status: 'completed', operator: '王清洗' },
          { stage: '切割分装', startTime: '2025-01-29T08:00:00Z', endTime: '2025-01-29T16:00:00Z', status: 'completed', operator: '陈切割' },
          { stage: '质量检测', startTime: '2025-01-30T09:00:00Z', endTime: '2025-01-30T12:00:00Z', status: 'completed', operator: '张质检' },
          { stage: '包装入库', startTime: '2025-02-01T08:00:00Z', endTime: '2025-02-01T15:00:00Z', status: 'completed', operator: '孙包装' }
        ],
        createdAt: '2025-01-28T08:00:00Z'
      },
      {
        id: 'PB002',
        batchNumber: 'PC-2025-002',
        productName: '精选牛肉系列',
        rawMaterial: '进口牛肉',
        plannedQuantity: 800,
        actualQuantity: 0,
        status: 'production',
        startDate: '2025-02-01',
        expectedEndDate: '2025-02-04',
        supervisor: '李生产',
        notes: '正在进行切割分装工序',
        timeline: [
          { stage: '原料准备', startTime: '2025-02-01T08:00:00Z', endTime: '2025-02-01T10:00:00Z', status: 'completed', operator: '王准备' },
          { stage: '清洗处理', startTime: '2025-02-01T10:00:00Z', endTime: '2025-02-01T16:00:00Z', status: 'completed', operator: '李清洗' },
          { stage: '切割分装', startTime: '2025-02-02T08:00:00Z', endTime: '', status: 'in-progress', operator: '陈切割' },
          { stage: '质量检测', startTime: '', endTime: '', status: 'pending', operator: '' },
          { stage: '包装入库', startTime: '', endTime: '', status: 'pending', operator: '' }
        ],
        createdAt: '2025-02-01T08:00:00Z'
      },
      {
        id: 'PB003',
        batchNumber: 'PC-2025-003',
        productName: '有机鸡肉',
        rawMaterial: '有机散养鸡',
        plannedQuantity: 600,
        actualQuantity: 0,
        status: 'quality-check',
        startDate: '2025-01-30',
        expectedEndDate: '2025-02-02',
        supervisor: '王生产',
        notes: '已完成生产，正在进行质量检测',
        timeline: [
          { stage: '原料准备', startTime: '2025-01-30T08:00:00Z', endTime: '2025-01-30T09:00:00Z', status: 'completed', operator: '张准备' },
          { stage: '清洗处理', startTime: '2025-01-30T09:00:00Z', endTime: '2025-01-30T13:00:00Z', status: 'completed', operator: '李清洗' },
          { stage: '切割分装', startTime: '2025-01-31T08:00:00Z', endTime: '2025-01-31T17:00:00Z', status: 'completed', operator: '王切割' },
          { stage: '质量检测', startTime: '2025-02-01T09:00:00Z', endTime: '', status: 'in-progress', operator: '赵质检' },
          { stage: '包装入库', startTime: '', endTime: '', status: 'pending', operator: '' }
        ],
        createdAt: '2025-01-30T08:00:00Z'
      },
      {
        id: 'PB004',
        batchNumber: 'PC-2025-004',
        productName: '冷冻羊肉',
        rawMaterial: '新鲜羊肉',
        plannedQuantity: 500,
        actualQuantity: 0,
        status: 'paused',
        startDate: '2025-01-29',
        expectedEndDate: '2025-02-03',
        supervisor: '陈生产',
        notes: '设备维护暂停生产',
        timeline: [
          { stage: '原料准备', startTime: '2025-01-29T08:00:00Z', endTime: '2025-01-29T10:00:00Z', status: 'completed', operator: '孙准备' },
          { stage: '清洗处理', startTime: '2025-01-29T10:00:00Z', endTime: '', status: 'in-progress', operator: '钱清洗' },
          { stage: '切割分装', startTime: '', endTime: '', status: 'pending', operator: '' },
          { stage: '质量检测', startTime: '', endTime: '', status: 'pending', operator: '' },
          { stage: '包装入库', startTime: '', endTime: '', status: 'pending', operator: '' }
        ],
        createdAt: '2025-01-29T08:00:00Z'
      }
    ];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'production':
        return 'bg-blue-100 text-blue-800';
      case 'quality-check':
        return 'bg-yellow-100 text-yellow-800';
      case 'packaging':
        return 'bg-purple-100 text-purple-800';
      case 'paused':
        return 'bg-red-100 text-red-800';
      case 'planning':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'production':
        return '生产中';
      case 'quality-check':
        return '质检中';
      case 'packaging':
        return '包装中';
      case 'paused':
        return '已暂停';
      case 'planning':
        return '计划中';
      default:
        return '未知';
    }
  };

  const getTimelineStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'in-progress':
        return 'text-blue-600 bg-blue-50';
      case 'pending':
        return 'text-gray-500 bg-gray-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.supervisor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <PageLayout title="生产批次" className="flex items-center justify-center min-h-screen">
        <Loading text="加载生产批次中..." />
      </PageLayout>
    );
  }

  if (showDetails && selectedBatch) {
    return (
      <PageLayout
        title="批次详情"
        showBack={true}
        onBack={() => setShowDetails(false)}
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
        <main className="flex-1 pt-[80px] pb-[20px] px-4">
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedBatch.productName}
              </h2>
              <Badge className={getStatusColor(selectedBatch.status)}>
                {getStatusText(selectedBatch.status)}
              </Badge>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">批次号:</span>
                <span className="font-medium">{selectedBatch.batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">原料:</span>
                <span className="font-medium">{selectedBatch.rawMaterial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">计划数量:</span>
                <span className="font-medium">{selectedBatch.plannedQuantity}kg</span>
              </div>
              {selectedBatch.actualQuantity > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">实际数量:</span>
                  <span className="font-medium">{selectedBatch.actualQuantity}kg</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">开始日期:</span>
                <span className="font-medium">{selectedBatch.startDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">预计完成:</span>
                <span className="font-medium">{selectedBatch.expectedEndDate}</span>
              </div>
              {selectedBatch.actualEndDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">实际完成:</span>
                  <span className="font-medium">{selectedBatch.actualEndDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">负责人:</span>
                <span className="font-medium">{selectedBatch.supervisor}</span>
              </div>
              {selectedBatch.qualityScore && (
                <div className="flex justify-between">
                  <span className="text-gray-600">质量评分:</span>
                  <span className="font-medium text-blue-600">{selectedBatch.qualityScore}分</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3">生产时间线</h3>
            <div className="space-y-3">
              {selectedBatch.timeline.map((stage, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-3 h-3 rounded-full mt-2 ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-800">{stage.stage}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getTimelineStatusColor(stage.status)}`}>
                        {stage.status === 'completed' ? '已完成' :
                         stage.status === 'in-progress' ? '进行中' : '待开始'}
                      </span>
                    </div>
                    {stage.operator && (
                      <div className="text-sm text-gray-600 mb-1">负责人: {stage.operator}</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {stage.startTime && (
                        <div>开始: {new Date(stage.startTime).toLocaleString()}</div>
                      )}
                      {stage.endTime && (
                        <div>结束: {new Date(stage.endTime).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {selectedBatch.notes && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-md font-semibold text-gray-900 mb-3">备注信息</h3>
              <p className="text-gray-700 leading-relaxed">{selectedBatch.notes}</p>
            </Card>
          )}
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="生产批次"
      showBack={true}
      onBack={() => window.history.back()}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        {stats && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">生产概览</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard
                title="总批次"
                value={stats.totalBatches}
                className="bg-blue-50 border-blue-200"
              />
              <StatCard
                title="生产中"
                value={stats.activeBatches}
                className="bg-orange-50 border-orange-200"
              />
              <StatCard
                title="已完成"
                value={stats.completedBatches}
                trend={{ value: 15, direction: "up", label: "较上月" }}
                className="bg-green-50 border-green-200"
              />
              <StatCard
                title="生产效率"
                value={stats.productionEfficiency}
                formatValue={(value) => `${value}%`}
                className="bg-purple-50 border-purple-200"
              />
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="space-y-3">
            <Input
              label="搜索批次"
              placeholder="批次号、产品名称或负责人"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              label="状态筛选"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'planning', label: '计划中' },
                { value: 'production', label: '生产中' },
                { value: 'quality-check', label: '质检中' },
                { value: 'packaging', label: '包装中' },
                { value: 'completed', label: '已完成' },
                { value: 'paused', label: '已暂停' }
              ]}
            />
          </div>
        </Card>

        {/* 批次列表 */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-gray-800">
              生产批次 ({filteredBatches.length})
            </h3>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="primary"
              className="text-sm px-3 py-1"
            >
              + 新建
            </Button>
          </div>

          {filteredBatches.length === 0 ? (
            <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500 mb-4">暂无符合条件的批次</p>
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                variant="secondary"
              >
                清除筛选
              </Button>
            </Card>
          ) : (
            filteredBatches.map((batch) => (
              <Card
                key={batch.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedBatch(batch);
                  setShowDetails(true);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{batch.productName}</h4>
                  <Badge className={getStatusColor(batch.status)}>
                    {getStatusText(batch.status)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>批次号:</span>
                    <span>{batch.batchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>计划数量:</span>
                    <span>{batch.plannedQuantity}kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>开始日期:</span>
                    <span>{batch.startDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>负责人:</span>
                    <span>{batch.supervisor}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* 新建批次模态框 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建生产批次"
        className="max-w-[350px]"
      >
        <div className="space-y-4">
          <Input
            label="产品名称"
            placeholder="请输入产品名称"
          />
          <Input
            label="原料名称"
            placeholder="请输入原料名称"
          />
          <Input
            label="计划数量"
            placeholder="请输入计划数量(kg)"
            type="number"
          />
          <Select
            label="负责人"
            options={[
              { value: '', label: '请选择负责人' },
              { value: 'zhang', label: '张生产' },
              { value: 'li', label: '李生产' },
              { value: 'wang', label: '王生产' },
              { value: 'chen', label: '陈生产' }
            ]}
          />
          <Input
            label="预计完成日期"
            type="date"
          />
          <div className="flex space-x-2 pt-4">
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="secondary"
              className="flex-1"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                // TODO: 实现创建批次逻辑
                setShowCreateModal(false);
              }}
              variant="primary"
              className="flex-1"
            >
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
