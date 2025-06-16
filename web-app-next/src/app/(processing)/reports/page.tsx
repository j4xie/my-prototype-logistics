'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProcessingReport {
  id: string;
  batchNumber: string;
  productName: string;
  processDate: string;
  quantity: number;
  status: 'processing' | 'completed' | 'quality_check' | 'failed';
  qualityScore: number;
  operator: string;
}

interface ProcessingMetrics {
  totalBatches: number;
  completedBatches: number;
  qualityPassRate: number;
  avgProcessingTime: number;
}

export default function ProcessingReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ProcessingReport[]>([]);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockReports: ProcessingReport[] = [
        {
          id: 'PR001',
          batchNumber: 'BATCH2024001',
          productName: '有机猪肉制品',
          processDate: '2024-06-14',
          quantity: 500,
          status: 'completed',
          qualityScore: 95,
          operator: '张师傅'
        },
        {
          id: 'PR002',
          batchNumber: 'BATCH2024002',
          productName: '优质牛肉制品',
          processDate: '2024-06-14',
          quantity: 300,
          status: 'quality_check',
          qualityScore: 88,
          operator: '李师傅'
        },
        {
          id: 'PR003',
          batchNumber: 'BATCH2024003',
          productName: '精品羊肉制品',
          processDate: '2024-06-13',
          quantity: 200,
          status: 'processing',
          qualityScore: 0,
          operator: '王师傅'
        }
      ];

      const mockMetrics: ProcessingMetrics = {
        totalBatches: 15,
        completedBatches: 12,
        qualityPassRate: 92.5,
        avgProcessingTime: 4.2
      };

      setReports(mockReports);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#F6FFED', text: '#52C41A', label: '已完成' };
      case 'processing':
        return { bg: '#E6F7FF', text: '#1677FF', label: '加工中' };
      case 'quality_check':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '质检中' };
      case 'failed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '不合格' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return '#52C41A';
    if (score >= 80) return '#FA8C16';
    if (score >= 70) return '#FF4D4F';
    return '#8C8C8C';
  };

  const filteredReports = selectedStatus === 'all' 
    ? reports 
    : reports.filter(report => report.status === selectedStatus);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-[#FA8C16] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">加载加工数据...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#FA8C16] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">生产加工</h1>
          <button
            onClick={() => router.push('/home/selector')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">
          
          {/* 统计概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-industry text-[#FA8C16] mr-2"></i>
                加工概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.totalBatches}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总批次</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.completedBatches}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">已完成</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.qualityPassRate}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">合格率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {metrics.avgProcessingTime}h
                  </div>
                  <div className="text-sm text-[#8c8c8c]">平均时长</div>
                </div>
              </div>
            </Card>
          )}

          {/* 状态筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部', count: reports.length },
                { key: 'processing', label: '加工中', count: reports.filter(r => r.status === 'processing').length },
                { key: 'quality_check', label: '质检中', count: reports.filter(r => r.status === 'quality_check').length },
                { key: 'completed', label: '已完成', count: reports.filter(r => r.status === 'completed').length },
                { key: 'failed', label: '不合格', count: reports.filter(r => r.status === 'failed').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedStatus(filter.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedStatus === filter.key
                      ? 'bg-[#FA8C16] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#fff7e6] hover:text-[#FA8C16]'
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
              onClick={() => router.push('/processing/quality')}
              className="h-12 bg-[#1677FF] hover:bg-[#4096FF] text-white"
            >
              <i className="fas fa-microscope mr-2"></i>
              质量检测
            </Button>
            <Button
              onClick={() => router.push('/processing/batch')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-plus mr-2"></i>
              新建批次
            </Button>
          </div>

          {/* 加工报告列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">加工报告</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredReports.length} 条</span>
            </div>

            {filteredReports.map((report) => {
              const statusInfo = getStatusColor(report.status);
              const qualityColor = getQualityColor(report.qualityScore);
              
              return (
                <Card
                  key={report.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/processing/detail/${report.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1">{report.productName}</h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-barcode mr-1"></i>
                          批次: {report.batchNumber}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-user mr-1"></i>
                          操作员: {report.operator}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* 加工数据 */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-[#262626] mb-1">
                          {report.quantity}kg
                        </div>
                        <div className="text-xs text-[#8c8c8c]">加工量</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-[#8c8c8c] mb-1">
                          {report.processDate}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">加工日期</div>
                      </div>
                      <div className="text-center">
                        {report.qualityScore > 0 ? (
                          <>
                            <div 
                              className="text-lg font-semibold mb-1"
                              style={{ color: qualityColor }}
                            >
                              {report.qualityScore}分
                            </div>
                            <div className="text-xs text-[#8c8c8c]">质量评分</div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-semibold text-[#d9d9d9] mb-1">
                              --
                            </div>
                            <div className="text-xs text-[#8c8c8c]">待评分</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredReports.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-inbox text-[#d9d9d9] text-3xl mb-3"></i>
                <p className="text-[#8c8c8c] mb-2">暂无相关记录</p>
                <p className="text-sm text-[#bfbfbf]">请选择其他状态或创建新的加工批次</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 