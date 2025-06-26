'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMockAuth } from '@/hooks/useMockAuth';

interface QualityCheck {
  id: string;
  batchNumber: string;
  productName: string;
  checkDate: string;
  inspector: string;
  status: 'passed' | 'failed' | 'pending' | 'warning';
  score: number;
  tests: QualityTest[];
}

interface QualityTest {
  name: string;
  result: string;
  standard: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
}

interface QualityMetrics {
  totalChecks: number;
  passedToday: number;
  failureRate: number;
  averageScore: number;
}

export default function ProcessingQualityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证，开发环境已通过useMockAuth自动处理
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockChecks: QualityCheck[] = [
        {
          id: 'QC001',
          batchNumber: 'B2024061401',
          productName: '优质猪肉香肠',
          checkDate: '2024-06-14 14:30',
          inspector: '张质检',
          status: 'passed',
          score: 95,
          tests: [
            { name: '微生物检测', result: '合格', standard: '≤100 CFU/g', status: 'passed' },
            { name: '蛋白质含量', result: '18.5%', standard: '≥18%', status: 'passed' },
            { name: '脂肪含量', result: '12.3%', standard: '≤15%', status: 'passed' },
            { name: '水分含量', result: '65.2%', standard: '≤70%', status: 'passed' }
          ]
        },
        {
          id: 'QC002',
          batchNumber: 'B2024061402',
          productName: '精品牛肉干',
          checkDate: '2024-06-14 13:45',
          inspector: '李质检',
          status: 'warning',
          score: 78,
          tests: [
            { name: '微生物检测', result: '合格', standard: '≤100 CFU/g', status: 'passed' },
            { name: '蛋白质含量', result: '45.2%', standard: '≥45%', status: 'passed' },
            { name: '脂肪含量', result: '8.5%', standard: '≤10%', status: 'passed' },
            { name: '水分含量', result: '18.5%', standard: '≤20%', status: 'warning' }
          ]
        },
        {
          id: 'QC003',
          batchNumber: 'B2024061403',
          productName: '精品羊肉制品',
          checkDate: '2024-06-14 12:20',
          inspector: '王质检',
          status: 'pending',
          score: 0,
          tests: [
            { name: '微生物检测', result: '检测中', standard: '≤100 CFU/g', status: 'pending' },
            { name: '蛋白质含量', result: '检测中', standard: '≥20%', status: 'pending' },
            { name: '脂肪含量', result: '检测中', standard: '≤12%', status: 'pending' },
            { name: '水分含量', result: '检测中', standard: '≤65%', status: 'pending' }
          ]
        }
      ];

      const mockMetrics: QualityMetrics = {
        totalChecks: 15,
        passedToday: 12,
        failureRate: 2.5,
        averageScore: 89.5
      };

      setQualityChecks(mockChecks);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return { bg: '#F6FFED', text: '#52C41A', label: '合格' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      case 'failed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '不合格' };
      case 'pending':
        return { bg: '#E6F7FF', text: '#1677FF', label: '检测中' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-[#52C41A]';
    if (score >= 80) return 'text-[#FA8C16]';
    if (score >= 70) return 'text-[#FF4D4F]';
    return 'text-[#8c8c8c]';
  };

  const filteredChecks = selectedStatus === 'all'
    ? qualityChecks
    : qualityChecks.filter(check => check.status === selectedStatus);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-clipboard-check fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载质量数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">质量管理</h1>
          <button
            onClick={() => router.push('/processing')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 质量概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-award text-[#1677FF] mr-2"></i>
                质量概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.totalChecks}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总检测</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.passedToday}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日合格</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {metrics.failureRate}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">不合格率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {metrics.averageScore}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">平均得分</div>
                </div>
              </div>
            </Card>
          )}

          {/* 状态筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部', count: qualityChecks.length },
                { key: 'passed', label: '合格', count: qualityChecks.filter(c => c.status === 'passed').length },
                { key: 'warning', label: '警告', count: qualityChecks.filter(c => c.status === 'warning').length },
                { key: 'failed', label: '不合格', count: qualityChecks.filter(c => c.status === 'failed').length },
                { key: 'pending', label: '检测中', count: qualityChecks.filter(c => c.status === 'pending').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedStatus(filter.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedStatus === filter.key
                      ? 'bg-[#1677FF] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                    }
                  `}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className="ml-1 text-xs">({filter.count})</span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/processing/quality/new')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-plus mr-2"></i>
              新建检测
            </Button>
            <Button
              onClick={() => router.push('/processing/quality/report')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-chart-bar mr-2"></i>
              质量报告
            </Button>
          </div>

          {/* 质量检测列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">质量检测记录</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredChecks.length} 条</span>
            </div>

            {filteredChecks.map((check) => {
              const statusInfo = getStatusColor(check.status);

              return (
                <Card
                  key={check.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/processing/quality/${check.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1">{check.productName}</h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-barcode mr-1"></i>
                          批次: {check.batchNumber}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-user mr-1"></i>
                          检测员: {check.inspector}
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className="px-2 py-1 rounded text-xs font-medium mb-2"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                        >
                          {statusInfo.label}
                        </div>
                        {check.score > 0 && (
                          <div className={`text-lg font-semibold ${getScoreColor(check.score)}`}>
                            {check.score}分
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 检测项目 */}
                    <div className="space-y-2">
                      <div className="text-sm text-[#8c8c8c] mb-2">检测项目</div>
                      <div className="grid grid-cols-1 gap-2">
                        {check.tests.slice(0, 2).map((test, index) => {
                          const testStatusInfo = getStatusColor(test.status);
                          return (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-[#262626]">{test.name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-[#8c8c8c]">{test.result}</span>
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: testStatusInfo.text }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                        {check.tests.length > 2 && (
                          <div className="text-xs text-[#8c8c8c] text-center">
                            +{check.tests.length - 2} 更多项目
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 检测时间 */}
                    <div className="pt-3 border-t border-[#f0f0f0] flex items-center justify-between text-sm">
                      <span className="text-[#8c8c8c]">
                        <i className="fas fa-clock mr-1"></i>
                        检测时间: {check.checkDate}
                      </span>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredChecks.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-clipboard-check text-[#d9d9d9] text-3xl mb-3"></i>
                <p className="text-[#8c8c8c] mb-2">暂无相关检测记录</p>
                <p className="text-sm text-[#bfbfbf]">请选择其他状态或创建新的质量检测</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
