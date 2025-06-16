'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FarmData {
  id: string;
  name: string;
  location: string;
  animalCount: number;
  temperature: number;
  humidity: number;
  status: 'normal' | 'warning' | 'alert';
  lastUpdate: string;
}

interface MonitoringMetrics {
  totalAnimals: number;
  healthyAnimals: number;
  alertCount: number;
  avgTemperature: number;
  avgHumidity: number;
}

export default function FarmingMonitorPage() {
  const router = useRouter();
  const [farms, setFarms] = useState<FarmData[]>([]);
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    // 模拟加载数据
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockFarms: FarmData[] = [
        {
          id: 'F001',
          name: '东区养殖场',
          location: '山东省济南市',
          animalCount: 1250,
          temperature: 22.5,
          humidity: 65,
          status: 'normal',
          lastUpdate: '2024-06-14 14:30:00'
        },
        {
          id: 'F002',
          name: '西区养殖场',
          location: '山东省青岛市',
          animalCount: 980,
          temperature: 25.8,
          humidity: 72,
          status: 'warning',
          lastUpdate: '2024-06-14 14:28:00'
        },
        {
          id: 'F003',
          name: '南区养殖场',
          location: '山东省烟台市',
          animalCount: 1580,
          temperature: 18.2,
          humidity: 58,
          status: 'alert',
          lastUpdate: '2024-06-14 14:25:00'
        }
      ];

      const mockMetrics: MonitoringMetrics = {
        totalAnimals: 3810,
        healthyAnimals: 3650,
        alertCount: 3,
        avgTemperature: 22.2,
        avgHumidity: 65
      };

      setFarms(mockFarms);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return { bg: '#F6FFED', text: '#52C41A', label: '正常' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      case 'alert':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '告警' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getTemperatureStatus = (temp: number) => {
    if (temp < 18 || temp > 26) return 'alert';
    if (temp < 20 || temp > 24) return 'warning';
    return 'normal';
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity < 50 || humidity > 80) return 'alert';
    if (humidity < 55 || humidity > 75) return 'warning';
    return 'normal';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-[#52C41A] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">加载监控数据...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#52C41A] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">养殖监控</h1>
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
          
          {/* 总览统计 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#52C41A] mr-2"></i>
                监控总览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.totalAnimals.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总存栏数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.healthyAnimals.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">健康数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {metrics.alertCount}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">告警数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.avgTemperature}°C
                  </div>
                  <div className="text-sm text-[#8c8c8c]">平均温度</div>
                </div>
              </div>
            </Card>
          )}

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/farming/vaccine')}
              className="h-12 bg-[#1677FF] hover:bg-[#4096FF] text-white"
            >
              <i className="fas fa-syringe mr-2"></i>
              疫苗管理
            </Button>
            <Button
              onClick={() => router.push('/farming/data-collection')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-clipboard-list mr-2"></i>
              数据采集
            </Button>
          </div>

          {/* 养殖场列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">养殖场监控</h3>
              <span className="text-sm text-[#8c8c8c]">共 {farms.length} 个场区</span>
            </div>

            {farms.map((farm) => {
              const statusInfo = getStatusColor(farm.status);
              const tempStatus = getTemperatureStatus(farm.temperature);
              const humidityStatus = getHumidityStatus(farm.humidity);
              
              return (
                <Card
                  key={farm.id}
                  className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedFarm === farm.id ? 'ring-2 ring-[#52C41A]' : ''
                  }`}
                  onClick={() => setSelectedFarm(selectedFarm === farm.id ? null : farm.id)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1">{farm.name}</h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-map-marker-alt mr-1"></i>
                          {farm.location}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-clock mr-1"></i>
                          {farm.lastUpdate}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* 监控数据 */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-[#262626] mb-1">
                          {farm.animalCount.toLocaleString()}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">存栏数</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold mb-1 ${
                          tempStatus === 'normal' ? 'text-[#52C41A]' :
                          tempStatus === 'warning' ? 'text-[#FA8C16]' : 'text-[#FF4D4F]'
                        }`}>
                          {farm.temperature}°C
                        </div>
                        <div className="text-xs text-[#8c8c8c]">温度</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold mb-1 ${
                          humidityStatus === 'normal' ? 'text-[#52C41A]' :
                          humidityStatus === 'warning' ? 'text-[#FA8C16]' : 'text-[#FF4D4F]'
                        }`}>
                          {farm.humidity}%
                        </div>
                        <div className="text-xs text-[#8c8c8c]">湿度</div>
                      </div>
                    </div>

                    {/* 展开的详细信息 */}
                    {selectedFarm === farm.id && (
                      <div className="pt-3 border-t border-[#f0f0f0] space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/farming/detail/${farm.id}`);
                            }}
                            className="h-10 bg-[#52C41A] hover:bg-[#73D13D] text-white text-sm"
                          >
                            <i className="fas fa-eye mr-2"></i>
                            查看详情
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/farming/alert/${farm.id}`);
                            }}
                            className="h-10 bg-[#FF4D4F] hover:bg-[#FF7875] text-white text-sm"
                          >
                            <i className="fas fa-exclamation-triangle mr-2"></i>
                            告警处理
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* 底部操作区 */}
          <div className="mt-6 space-y-3">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#F6FFED] rounded-full flex items-center justify-center">
                    <i className="fas fa-plus text-[#52C41A]"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-[#262626]">添加养殖场</h4>
                    <p className="text-xs text-[#8c8c8c]">新增监控场区</p>
                  </div>
                </div>
                <button 
                  className="text-[#52C41A] hover:text-[#73D13D] transition-colors"
                  onClick={() => router.push('/farming/add')}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#E6F7FF] rounded-full flex items-center justify-center">
                    <i className="fas fa-chart-line text-[#1677FF]"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-[#262626]">数据分析</h4>
                    <p className="text-xs text-[#8c8c8c]">查看历史趋势</p>
                  </div>
                </div>
                <button 
                  className="text-[#1677FF] hover:text-[#4096FF] transition-colors"
                  onClick={() => router.push('/farming/analytics')}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
} 