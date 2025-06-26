'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Button } from '@/components/ui/button';

interface IndicatorData {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'danger';
  trend: 'up' | 'down' | 'stable';
  lastUpdate: string;
  threshold: { min: number; max: number };
  history: { time: string; value: number }[];
}

interface EnvironmentMetrics {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightIntensity: number;
}

export default function FarmingIndicatorDetailPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('24h');

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockIndicators: IndicatorData[] = [
        {
          id: 'IND001',
          name: '土壤pH值',
          value: 6.8,
          unit: 'pH',
          status: 'normal',
          trend: 'stable',
          lastUpdate: '2024-06-14 14:30',
          threshold: { min: 6.0, max: 7.5 },
          history: [
            { time: '12:00', value: 6.7 },
            { time: '13:00', value: 6.8 },
            { time: '14:00', value: 6.8 },
            { time: '15:00', value: 6.9 }
          ]
        },
        {
          id: 'IND002',
          name: '氮含量',
          value: 85,
          unit: 'mg/kg',
          status: 'warning',
          trend: 'down',
          lastUpdate: '2024-06-14 14:25',
          threshold: { min: 80, max: 120 },
          history: [
            { time: '12:00', value: 90 },
            { time: '13:00', value: 88 },
            { time: '14:00', value: 85 },
            { time: '15:00', value: 85 }
          ]
        },
        {
          id: 'IND003',
          name: '磷含量',
          value: 45,
          unit: 'mg/kg',
          status: 'normal',
          trend: 'up',
          lastUpdate: '2024-06-14 14:20',
          threshold: { min: 30, max: 60 },
          history: [
            { time: '12:00', value: 42 },
            { time: '13:00', value: 43 },
            { time: '14:00', value: 44 },
            { time: '15:00', value: 45 }
          ]
        }
      ];

      const mockEnvironment: EnvironmentMetrics = {
        temperature: 24.5,
        humidity: 65,
        soilMoisture: 78,
        lightIntensity: 85
      };

      setIndicators(mockIndicators);
      setEnvironment(mockEnvironment);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return { bg: '#F6FFED', text: '#52C41A', label: '正常' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      case 'danger':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '危险' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'fas fa-arrow-up text-[#52C41A]';
      case 'down':
        return 'fas fa-arrow-down text-[#FF4D4F]';
      case 'stable':
        return 'fas fa-minus text-[#8c8c8c]';
      default:
        return 'fas fa-question text-[#8c8c8c]';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-chart-line fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载指标数据...'}
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
          <h1 className="text-lg font-semibold">农业指标详情</h1>
          <button
            onClick={() => router.push('/farming')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 环境概览 */}
          {environment && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-thermometer-half text-[#1677FF] mr-2"></i>
                环境监控
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {environment.temperature}°C
                  </div>
                  <div className="text-sm text-[#8c8c8c]">环境温度</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {environment.humidity}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">空气湿度</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {environment.soilMoisture}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">土壤湿度</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#722ED1] mb-1">
                    {environment.lightIntensity}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">光照强度</div>
                </div>
              </div>
            </Card>
          )}

          {/* 时间筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: '1h', label: '1小时' },
                { key: '24h', label: '24小时' },
                { key: '7d', label: '7天' },
                { key: '30d', label: '30天' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => setSelectedPeriod(period.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedPeriod === period.key
                      ? 'bg-[#1677FF] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                    }
                  `}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </Card>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/farming/video-monitoring')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-video mr-2"></i>
              实时监控
            </Button>
            <Button
              onClick={() => router.push('/farming/alerts')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-bell mr-2"></i>
              预警设置
            </Button>
          </div>

          {/* 指标详情列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">土壤指标</h3>
              <span className="text-sm text-[#8c8c8c]">共 {indicators.length} 项</span>
            </div>

            {indicators.map((indicator) => {
              const statusInfo = getStatusColor(indicator.status);
              const progressPercentage = ((indicator.value - indicator.threshold.min) / (indicator.threshold.max - indicator.threshold.min)) * 100;

              return (
                <Card
                  key={indicator.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/farming/indicator/${indicator.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                          {indicator.name}
                          <i className={`ml-2 ${getTrendIcon(indicator.trend)}`}></i>
                        </h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-clock mr-1"></i>
                          更新时间: {indicator.lastUpdate}
                        </p>
                        <p className="text-lg font-semibold text-[#262626]">
                          {indicator.value} {indicator.unit}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* 阈值范围 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#8c8c8c]">安全范围</span>
                        <span className="text-sm font-medium text-[#262626]">
                          {indicator.threshold.min} - {indicator.threshold.max} {indicator.unit}
                        </span>
                      </div>
                      <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            indicator.status === 'normal' ? 'bg-[#52C41A]' :
                            indicator.status === 'warning' ? 'bg-[#FA8C16]' : 'bg-[#FF4D4F]'
                          }`}
                          style={{ width: `${Math.min(Math.max(progressPercentage, 0), 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* 历史数据 */}
                    <div className="pt-3 border-t border-[#f0f0f0]">
                      <div className="flex items-center justify-between text-sm text-[#8c8c8c] mb-2">
                        <span>历史趋势</span>
                        <span>最近4小时</span>
                      </div>
                      <div className="flex items-end space-x-2">
                        {indicator.history.map((point, index) => (
                          <div key={index} className="flex-1 text-center">
                            <div className="text-xs text-[#8c8c8c] mb-1">{point.time}</div>
                            <div
                              className="bg-[#1677FF] rounded-t"
                              style={{
                                height: `${(point.value / indicator.threshold.max) * 30}px`,
                                minHeight: '4px'
                              }}
                            ></div>
                            <div className="text-xs text-[#262626] mt-1">{point.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
