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
  Select
} from '@/components/ui';

interface QualityReport {
  id: string;
  batchNumber: string;
  productName: string;
  testDate: string;
  status: 'pending' | 'passed' | 'failed' | 'reviewing';
  score: number;
  testType: string;
  inspector: string;
  testItems: {
    item: string;
    standard: string;
    result: string;
    status: 'pass' | 'fail' | 'warning';
  }[];
  conclusion: string;
  createdAt: string;
}

interface ReportStats {
  totalReports: number;
  passedReports: number;
  failedReports: number;
  pendingReports: number;
  averageScore: number;
  monthlyTrend: number;
}

export default function QualityReportsPage() {
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/processing/quality-tests');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        // Fallback mock data
        setReports(generateMockReports());
      }
    } catch (error) {
      console.error('获取质检报告失败:', error);
      setReports(generateMockReports());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [fetchReports]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/processing/quality-tests?type=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        setStats({
          totalReports: 156,
          passedReports: 142,
          failedReports: 8,
          pendingReports: 6,
          averageScore: 87.5,
          monthlyTrend: 12
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({
        totalReports: 156,
        passedReports: 142,
        failedReports: 8,
        pendingReports: 6,
        averageScore: 87.5,
        monthlyTrend: 12
      });
    }
  };

  const generateMockReports = (): QualityReport[] => {
    return [
      {
        id: 'QR001',
        batchNumber: 'PC-2025-001',
        productName: '优质猪肉',
        testDate: '2025-02-02',
        status: 'passed',
        score: 92,
        testType: '成品检测',
        inspector: '张质检',
        testItems: [
          { item: '蛋白质含量', standard: '≥18%', result: '19.2%', status: 'pass' },
          { item: '脂肪含量', standard: '≤15%', result: '12.8%', status: 'pass' },
          { item: '水分含量', standard: '≤77%', result: '74.5%', status: 'pass' },
          { item: '细菌总数', standard: '≤10⁴CFU/g', result: '8.2×10³CFU/g', status: 'pass' }
        ],
        conclusion: '产品质量合格，各项指标均符合标准要求',
        createdAt: '2025-02-02T09:30:00Z'
      },
      {
        id: 'QR002',
        batchNumber: 'PC-2025-002',
        productName: '精选牛肉',
        testDate: '2025-02-01',
        status: 'reviewing',
        score: 88,
        testType: '原料检测',
        inspector: '李检验',
        testItems: [
          { item: '新鲜度', standard: '一级', result: '一级', status: 'pass' },
          { item: 'pH值', standard: '5.8-6.2', result: '6.0', status: 'pass' },
          { item: '大肠杆菌', standard: '未检出', result: '未检出', status: 'pass' },
          { item: '重金属', standard: '≤0.5mg/kg', result: '0.3mg/kg', status: 'pass' }
        ],
        conclusion: '原料质量良好，建议继续加工',
        createdAt: '2025-02-01T14:20:00Z'
      },
      {
        id: 'QR003',
        batchNumber: 'PC-2025-003',
        productName: '有机鸡肉',
        testDate: '2025-01-31',
        status: 'failed',
        score: 65,
        testType: '卫生检测',
        inspector: '王卫检',
        testItems: [
          { item: '沙门氏菌', standard: '未检出', result: '检出', status: 'fail' },
          { item: '温度记录', standard: '≤4℃', result: '6℃', status: 'fail' },
          { item: '包装完整性', standard: '完好', result: '部分破损', status: 'warning' },
          { item: '保质期', standard: '7天', result: '5天', status: 'pass' }
        ],
        conclusion: '产品不合格，需要重新处理',
        createdAt: '2025-01-31T16:45:00Z'
      },
      {
        id: 'QR004',
        batchNumber: 'PC-2025-004',
        productName: '冷冻羊肉',
        testDate: '2025-01-30',
        status: 'pending',
        score: 0,
        testType: '初检',
        inspector: '赵初检',
        testItems: [
          { item: '外观检查', standard: '无异常', result: '待检测', status: 'pass' },
          { item: '重量检查', standard: '±2%', result: '待检测', status: 'pass' },
          { item: '温度检查', standard: '-18℃', result: '待检测', status: 'pass' },
          { item: '包装检查', standard: '密封良好', result: '待检测', status: 'pass' }
        ],
        conclusion: '等待检测结果',
        createdAt: '2025-01-30T11:15:00Z'
      }
    ];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'reviewing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'passed':
        return '合格';
      case 'failed':
        return '不合格';
      case 'reviewing':
        return '审核中';
      case 'pending':
        return '待检测';
      default:
        return '未知';
    }
  };

  const getTestItemStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'text-green-600';
      case 'fail':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.inspector.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <PageLayout title="质检报告" className="flex items-center justify-center min-h-screen">
        <Loading text="加载质检报告中..." />
      </PageLayout>
    );
  }

  if (showDetails && selectedReport) {
    return (
      <PageLayout
        title="报告详情"
        showBack={true}
        onBack={() => setShowDetails(false)}
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
        <main className="flex-1 pt-[80px] pb-[20px] px-4">
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedReport.productName}
              </h2>
              <Badge className={getStatusColor(selectedReport.status)}>
                {getStatusText(selectedReport.status)}
              </Badge>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">批次号:</span>
                <span className="font-medium">{selectedReport.batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">检测日期:</span>
                <span className="font-medium">{selectedReport.testDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">检测类型:</span>
                <span className="font-medium">{selectedReport.testType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">检测员:</span>
                <span className="font-medium">{selectedReport.inspector}</span>
              </div>
              {selectedReport.score > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">综合评分:</span>
                  <span className="font-medium text-blue-600">{selectedReport.score}分</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3">检测项目</h3>
            <div className="space-y-3">
              {selectedReport.testItems.map((item, index) => (
                <div key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-800">{item.item}</span>
                    <span className={`text-sm font-medium ${getTestItemStatusColor(item.status)}`}>
                      {item.status === 'pass' ? '✓' : item.status === 'fail' ? '✗' : '⚠'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>标准: {item.standard}</div>
                    <div>结果: {item.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3">检测结论</h3>
            <p className="text-gray-700 leading-relaxed">{selectedReport.conclusion}</p>
          </Card>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="质检报告"
      showBack={true}
      onBack={() => window.history.back()}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        {stats && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">质检概览</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard
                title="总报告"
                value={stats.totalReports}
                className="bg-blue-50 border-blue-200"
              />
              <StatCard
                title="合格率"
                value={Math.round((stats.passedReports / stats.totalReports) * 100)}
                formatValue={(value) => `${value}%`}
                trend={{ value: stats.monthlyTrend, direction: "up", label: "较上月" }}
                className="bg-green-50 border-green-200"
              />
              <StatCard
                title="不合格"
                value={stats.failedReports}
                className="bg-red-50 border-red-200"
              />
              <StatCard
                title="平均分"
                value={stats.averageScore}
                formatValue={(value) => `${value}分`}
                className="bg-purple-50 border-purple-200"
              />
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="space-y-3">
            <Input
              label="搜索报告"
              placeholder="产品名称、批次号或检测员"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select
              label="状态筛选"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待检测' },
                { value: 'reviewing', label: '审核中' },
                { value: 'passed', label: '合格' },
                { value: 'failed', label: '不合格' }
              ]}
            />
          </div>
        </Card>

        {/* 报告列表 */}
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-gray-800">质检报告 ({filteredReports.length})</h3>

          {filteredReports.length === 0 ? (
            <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500 mb-4">暂无符合条件的报告</p>
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
            filteredReports.map((report) => (
              <Card
                key={report.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedReport(report);
                  setShowDetails(true);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{report.productName}</h4>
                  <Badge className={getStatusColor(report.status)}>
                    {getStatusText(report.status)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>批次号:</span>
                    <span>{report.batchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>检测日期:</span>
                    <span>{report.testDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>检测员:</span>
                    <span>{report.inspector}</span>
                  </div>
                  {report.score > 0 && (
                    <div className="flex justify-between">
                      <span>评分:</span>
                      <span className="font-medium text-blue-600">{report.score}分</span>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* 快速操作 */}
        <div className="mt-6">
          <Button
            onClick={() => window.location.href = '/processing/quality-tests/create'}
            variant="primary"
            className="w-full"
          >
            + 新建质检报告
          </Button>
        </div>
      </main>
    </PageLayout>
  );
}
