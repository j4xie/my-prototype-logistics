'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProductionLine {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'maintenance' | 'error';
  product: string;
  batchNumber: string;
  progress: number;
  output: number;
  target: number;
  efficiency: number;
  temperature: number;
  humidity: number;
}

interface ProductionMetrics {
  totalLines: number;
  activeLines: number;
  dailyOutput: number;
  efficiency: number;
}

export default function ProcessingProductionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [metrics, setMetrics] = useState<ProductionMetrics | null>(null);
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

      const mockLines: ProductionLine[] = [
        {
          id: 'PL001',
          name: '肉制品生产线A',
          status: 'running',
          product: '优质猪肉香肠',
          batchNumber: 'B2024061401',
          progress: 75,
          output: 1500,
          target: 2000,
          efficiency: 85,
          temperature: 4.2,
          humidity: 65
        },
        {
          id: 'PL002',
          name: '肉制品生产线B',
          status: 'running',
          product: '精品牛肉干',
          batchNumber: 'B2024061402',
          progress: 45,
          output: 800,
          target: 1500,
          efficiency: 78,
          temperature: 3.8,
          humidity: 68
        },
        {
          id: 'PL003',
          name: '包装生产线',
          status: 'maintenance',
          product: '暂停生产',
          batchNumber: '-',
          progress: 0,
          output: 0,
          target: 1000,
          efficiency: 0,
          temperature: 25.0,
          humidity: 45
        }
      ];

      const mockMetrics: ProductionMetrics = {
        totalLines: 3,
        activeLines: 2,
        dailyOutput: 2300,
        efficiency: 81.5
      };

      setProductionLines(mockLines);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return { bg: '#F6FFED', text: '#52C41A', label: '运行中' };
      case 'stopped':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '已停止' };
      case 'maintenance':
        return { bg: '#E6F7FF', text: '#1677FF', label: '维护中' };
      case 'error':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '故障' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const filteredLines = selectedStatus === 'all'
    ? productionLines
    : productionLines.filter(line => line.status === selectedStatus);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-cog fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载生产数据...'}
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
          <h1 className="text-lg font-semibold">生产管理</h1>
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

          {/* 生产概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-industry text-[#1677FF] mr-2"></i>
                生产概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.totalLines}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">生产线</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.activeLines}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">运行中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.dailyOutput.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日产量(kg)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {metrics.efficiency}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">平均效率</div>
                </div>
              </div>
            </Card>
          )}

          {/* 状态筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部', count: productionLines.length },
                { key: 'running', label: '运行中', count: productionLines.filter(l => l.status === 'running').length },
                { key: 'stopped', label: '已停止', count: productionLines.filter(l => l.status === 'stopped').length },
                { key: 'maintenance', label: '维护中', count: productionLines.filter(l => l.status === 'maintenance').length },
                { key: 'error', label: '故障', count: productionLines.filter(l => l.status === 'error').length }
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
              onClick={() => router.push('/processing/batch')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-plus mr-2"></i>
              新建批次
            </Button>
            <Button
              onClick={() => router.push('/processing/quality')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-check-circle mr-2"></i>
              质量检测
            </Button>
          </div>

          {/* 生产线列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">生产线状态</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredLines.length} 条</span>
            </div>

            {filteredLines.map((line) => {
              const statusInfo = getStatusColor(line.status);

              return (
                <Card
                  key={line.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/processing/line/${line.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1">{line.name}</h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-tag mr-1"></i>
                          产品: {line.product}
                        </p>
                        {line.batchNumber !== '-' && (
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-barcode mr-1"></i>
                            批次: {line.batchNumber}
                          </p>
                        )}
                      </div>
                      <div
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* 生产进度 */}
                    {line.status === 'running' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#8c8c8c]">生产进度</span>
                          <span className="text-sm font-medium text-[#262626]">{line.progress}%</span>
                        </div>
                        <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                          <div
                            className="bg-[#1677FF] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${line.progress}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#8c8c8c]">产量: {line.output}/{line.target} kg</span>
                          <span className="text-[#262626] font-medium">效率: {line.efficiency}%</span>
                        </div>
                      </div>
                    )}

                    {/* 环境监控 */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          line.temperature <= 5 ? 'text-[#52C41A]' : 'text-[#FF4D4F]'
                        }`}>
                          {line.temperature}°C
                        </div>
                        <div className="text-xs text-[#8c8c8c]">温度</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          line.humidity >= 60 && line.humidity <= 70 ? 'text-[#52C41A]' : 'text-[#FA8C16]'
                        }`}>
                          {line.humidity}%
                        </div>
                        <div className="text-xs text-[#8c8c8c]">湿度</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          line.efficiency >= 80 ? 'text-[#52C41A]' :
                          line.efficiency >= 60 ? 'text-[#FA8C16]' : 'text-[#FF4D4F]'
                        }`}>
                          {line.efficiency}%
                        </div>
                        <div className="text-xs text-[#8c8c8c]">效率</div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredLines.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-industry text-[#d9d9d9] text-3xl mb-3"></i>
                <p className="text-[#8c8c8c] mb-2">暂无相关生产线</p>
                <p className="text-sm text-[#bfbfbf]">请选择其他状态或启动新的生产线</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
