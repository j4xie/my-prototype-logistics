'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface Inspection {
  id: string;
  productName: string;
  batchNumber: string;
  inspectionType: 'incoming' | 'process' | 'final' | 'random';
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'rejected';
  inspector: string;
  inspectionDate: string;
  completedDate?: string;
  score: number;
  issues: string[];
  notes: string;
}

const mockInspections: Inspection[] = [
  {
    id: 'INS001',
    productName: '黑猪里脊肉',
    batchNumber: 'BP20240202001',
    inspectionType: 'incoming',
    status: 'passed',
    inspector: '李检验员',
    inspectionDate: '2024-02-02',
    completedDate: '2024-02-02',
    score: 95,
    issues: [],
    notes: '产品质量优秀，无发现问题'
  },
  {
    id: 'INS002',
    productName: '有机白菜',
    batchNumber: 'VG20240202002',
    inspectionType: 'final',
    status: 'in_progress',
    inspector: '王检验员',
    inspectionDate: '2024-02-02',
    score: 0,
    issues: [],
    notes: '正在进行最终检验'
  },
  {
    id: 'INS003',
    productName: '深海三文鱼',
    batchNumber: 'SF20240201003',
    inspectionType: 'process',
    status: 'failed',
    inspector: '张检验员',
    inspectionDate: '2024-02-01',
    completedDate: '2024-02-01',
    score: 72,
    issues: ['温度控制不当', '包装轻微破损'],
    notes: '需要重新处理包装并调整温控'
  },
  {
    id: 'INS004',
    productName: '红富士苹果',
    batchNumber: 'AP20240131004',
    inspectionType: 'random',
    status: 'pending',
    inspector: '赵检验员',
    inspectionDate: '2024-02-03',
    score: 0,
    issues: [],
    notes: '待进行随机抽检'
  }
];

const getInspectionTypeText = (type: Inspection['inspectionType']) => {
  switch (type) {
    case 'incoming': return '进货检验';
    case 'process': return '过程检验';
    case 'final': return '最终检验';
    case 'random': return '随机抽检';
    default: return '未知';
  }
};

const getInspectionTypeColor = (type: Inspection['inspectionType']) => {
  switch (type) {
    case 'incoming': return 'info';
    case 'process': return 'warning';
    case 'final': return 'primary';
    case 'random': return 'default';
    default: return 'default';
  }
};

const getStatusText = (status: Inspection['status']) => {
  switch (status) {
    case 'pending': return '待检验';
    case 'in_progress': return '检验中';
    case 'passed': return '合格';
    case 'failed': return '不合格';
    case 'rejected': return '已拒收';
    default: return '未知';
  }
};

const getStatusColor = (status: Inspection['status']) => {
  switch (status) {
    case 'pending': return 'default';
    case 'in_progress': return 'warning';
    case 'passed': return 'success';
    case 'failed': return 'error';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-yellow-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setInspections(mockInspections);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredInspections = inspections.filter(inspection => {
    return inspection.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           inspection.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           inspection.inspector.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载检验记录中...</p>
        </div>
      </div>
    );
  }

  const pendingCount = inspections.filter(i => i.status === 'pending').length;
  const inProgressCount = inspections.filter(i => i.status === 'in_progress').length;
  const passedCount = inspections.filter(i => i.status === 'passed').length;
  const failedCount = inspections.filter(i => i.status === 'failed' || i.status === 'rejected').length;

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">质量检验</h1>
        <Button size="small">新建检验</Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{inspections.length}</div>
            <div className="text-sm text-gray-600">总检验数</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
            <div className="text-sm text-gray-600">合格数</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{pendingCount + inProgressCount}</div>
            <div className="text-sm text-gray-600">待处理</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-sm text-gray-600">不合格</div>
          </div>
        </Card>
      </div>

      {/* 搜索 */}
      <Card className="p-4">
        <Input
          placeholder="搜索产品名称、批次号、检验员..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Card>

      {/* 检验列表 */}
      <div className="space-y-3">
        {filteredInspections.map(inspection => (
          <Card key={inspection.id} className="p-4 hover:shadow-md hover:scale-[1.03] transition-all">
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{inspection.productName}</h3>
                    <p className="text-sm text-gray-600">批次: {inspection.batchNumber}</p>
                  </div>
                </div>
                <Badge variant={getStatusColor(inspection.status)}>
                  {getStatusText(inspection.status)}
                </Badge>
              </div>

              {/* 检验类型和检验员 */}
              <div className="flex items-center justify-between">
                <Badge variant={getInspectionTypeColor(inspection.inspectionType)}>
                  {getInspectionTypeText(inspection.inspectionType)}
                </Badge>
                <div className="text-sm text-gray-600">
                  👤 {inspection.inspector}
                </div>
              </div>

              {/* 检验信息 */}
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-sm text-gray-600">检验日期</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">评分</div>
                  <div className={`text-sm font-semibold ${getScoreColor(inspection.score)}`}>
                    {inspection.score > 0 ? `${inspection.score}分` : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">问题数</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {inspection.issues.length}个
                  </div>
                </div>
              </div>

              {/* 问题列表 */}
              {inspection.issues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="text-sm text-red-600 font-medium mb-1">发现问题:</div>
                  <div className="text-xs text-red-700">
                    {inspection.issues.join(', ')}
                  </div>
                </div>
              )}

              {/* 备注 */}
              {inspection.notes && (
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-600">{inspection.notes}</div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex space-x-2 pt-2">
                <Button size="small" className="flex-1">查看详情</Button>
                {inspection.status === 'pending' && (
                  <Button size="small" variant="secondary" className="flex-1">开始检验</Button>
                )}
                {inspection.status === 'in_progress' && (
                  <Button size="small" variant="secondary" className="flex-1">完成检验</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {filteredInspections.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="font-medium text-gray-900 mb-2">暂无检验记录</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm ? '未找到符合条件的检验记录' : '还没有任何检验记录'}
          </p>
          <Button>新建检验</Button>
        </Card>
      )}
    </div>
  );
}
