'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsivePageContainer } from '@/components/layout/ResponsiveContainer';

interface StorageArea {
  id: string;
  name: string;
  type: 'cold_storage' | 'dry_storage' | 'frozen' | 'ambient';
  status: 'normal' | 'warning' | 'critical' | 'offline';
  temperature: number;
  humidity: number;
  capacity: number;
  occupied: number;
  products: StorageProduct[];
}

interface StorageProduct {
  id: string;
  name: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  location: string;
  status: 'fresh' | 'near_expiry' | 'expired';
}

interface StorageMetrics {
  totalCapacity: number;
  occupiedCapacity: number;
  nearExpiryItems: number;
  temperatureAlerts: number;
}

export default function ProcessingStoragePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');

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

      const mockAreas: StorageArea[] = [
        {
          id: 'SA001',
          name: '冷藏库A',
          type: 'cold_storage',
          status: 'normal',
          temperature: 4.2,
          humidity: 65,
          capacity: 5000,
          occupied: 3750,
          products: [
            {
              id: 'P001',
              name: '优质猪肉',
              batchNumber: 'B2024061401',
              quantity: 500,
              unit: 'kg',
              expiryDate: '2024-06-20',
              location: 'A-01-15',
              status: 'fresh'
            },
            {
              id: 'P002',
              name: '精品牛肉',
              batchNumber: 'B2024061402',
              quantity: 300,
              unit: 'kg',
              expiryDate: '2024-06-16',
              location: 'A-02-08',
              status: 'near_expiry'
            }
          ]
        },
        {
          id: 'SA002',
          name: '冷冻库B',
          type: 'frozen',
          status: 'warning',
          temperature: -18.5,
          humidity: 55,
          capacity: 8000,
          occupied: 6400,
          products: [
            {
              id: 'P003',
              name: '冷冻羊肉',
              batchNumber: 'B2024061403',
              quantity: 800,
              unit: 'kg',
              expiryDate: '2024-12-15',
              location: 'B-01-20',
              status: 'fresh'
            }
          ]
        },
        {
          id: 'SA003',
          name: '干燥仓库C',
          type: 'dry_storage',
          status: 'normal',
          temperature: 22.0,
          humidity: 45,
          capacity: 3000,
          occupied: 1200,
          products: [
            {
              id: 'P004',
              name: '包装材料',
              batchNumber: 'B2024061404',
              quantity: 5000,
              unit: '个',
              expiryDate: '2025-06-14',
              location: 'C-01-05',
              status: 'fresh'
            }
          ]
        }
      ];

      const mockMetrics: StorageMetrics = {
        totalCapacity: 16000,
        occupiedCapacity: 11350,
        nearExpiryItems: 12,
        temperatureAlerts: 1
      };

      setStorageAreas(mockAreas);
      setMetrics(mockMetrics);
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
      case 'critical':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '严重' };
      case 'offline':
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '离线' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cold_storage':
        return { bg: '#E6F7FF', text: '#1677FF', label: '冷藏' };
      case 'frozen':
        return { bg: '#F6FFED', text: '#52C41A', label: '冷冻' };
      case 'dry_storage':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '干燥' };
      case 'ambient':
        return { bg: '#F9F0FF', text: '#722ED1', label: '常温' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getTemperatureStatus = (type: string, temp: number) => {
    switch (type) {
      case 'cold_storage':
        return temp >= 0 && temp <= 6 ? 'normal' : 'critical';
      case 'frozen':
        return temp >= -20 && temp <= -15 ? 'normal' : 'critical';
      case 'dry_storage':
        return temp >= 18 && temp <= 25 ? 'normal' : 'warning';
      default:
        return 'normal';
    }
  };

  const filteredAreas = selectedType === 'all'
    ? storageAreas
    : storageAreas.filter(area => area.type === selectedType);

  if (authLoading || isLoading) {
    return (
      <ResponsivePageContainer bgColor="bg-[#f0f2f5]" maxWidth="desktop">
        <div className="w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-warehouse fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载存储数据...'}
            </p>
          </div>
        </div>
      </ResponsivePageContainer>
    );
  }

  return (
    <ResponsivePageContainer bgColor="bg-[#f0f2f5]" maxWidth="desktop">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">存储管理</h1>
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

          {/* 存储概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-cubes text-[#1677FF] mr-2"></i>
                存储概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {((metrics.occupiedCapacity / metrics.totalCapacity) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">库存占用率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {(metrics.totalCapacity - metrics.occupiedCapacity).toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">剩余容量(kg)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.nearExpiryItems}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">临期商品</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {metrics.temperatureAlerts}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">温度预警</div>
                </div>
              </div>
            </Card>
          )}

          {/* 存储类型筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部', count: storageAreas.length },
                { key: 'cold_storage', label: '冷藏', count: storageAreas.filter(a => a.type === 'cold_storage').length },
                { key: 'frozen', label: '冷冻', count: storageAreas.filter(a => a.type === 'frozen').length },
                { key: 'dry_storage', label: '干燥', count: storageAreas.filter(a => a.type === 'dry_storage').length },
                { key: 'ambient', label: '常温', count: storageAreas.filter(a => a.type === 'ambient').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedType(filter.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedType === filter.key
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
              onClick={() => router.push('/processing/storage/inventory-check')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-clipboard-list mr-2"></i>
              库存盘点
            </Button>
            <Button
              onClick={() => router.push('/processing/storage/warehouse-config')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-cog mr-2"></i>
              仓库配置
            </Button>
          </div>

          {/* 存储区域列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">存储区域</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredAreas.length} 个区域</span>
            </div>

            {filteredAreas.map((area) => {
              const statusInfo = getStatusColor(area.status);
              const typeInfo = getTypeColor(area.type);
              const tempStatus = getTemperatureStatus(area.type, area.temperature);
              const occupancyRate = (area.occupied / area.capacity) * 100;

              return (
                <Card
                  key={area.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                  onClick={() => router.push(`/processing/storage/${area.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                          {area.name}
                          <span
                            className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: typeInfo.bg, color: typeInfo.text }}
                          >
                            {typeInfo.label}
                          </span>
                        </h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          <i className="fas fa-box mr-1"></i>
                          容量: {area.occupied.toLocaleString()} / {area.capacity.toLocaleString()} kg
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-layer-group mr-1"></i>
                          存储商品: {area.products.length} 种
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className="px-2 py-1 rounded text-xs font-medium mb-2"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                        >
                          {statusInfo.label}
                        </div>
                        <div className="text-lg font-semibold text-[#262626]">
                          {occupancyRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* 库存占用进度 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#8c8c8c]">库存占用</span>
                        <span className="text-sm font-medium text-[#262626]">{occupancyRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            occupancyRate >= 90 ? 'bg-[#FF4D4F]' :
                            occupancyRate >= 75 ? 'bg-[#FA8C16]' : 'bg-[#52C41A]'
                          }`}
                          style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* 环境监控 */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          tempStatus === 'normal' ? 'text-[#52C41A]' :
                          tempStatus === 'warning' ? 'text-[#FA8C16]' : 'text-[#FF4D4F]'
                        }`}>
                          {area.temperature}°C
                        </div>
                        <div className="text-xs text-[#8c8c8c]">温度</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium mb-1 ${
                          area.humidity >= 40 && area.humidity <= 70 ? 'text-[#52C41A]' : 'text-[#FA8C16]'
                        }`}>
                          {area.humidity}%
                        </div>
                        <div className="text-xs text-[#8c8c8c]">湿度</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-[#262626] mb-1">
                          {area.products.filter(p => p.status === 'near_expiry').length}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">临期商品</div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredAreas.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-warehouse text-[#d9d9d9] text-3xl mb-3"></i>
                <p className="text-[#8c8c8c] mb-2">暂无相关存储区域</p>
                <p className="text-sm text-[#bfbfbf]">请选择其他类型或创建新的存储区域</p>
              </Card>
            )}
        </div>
      </main>
    </ResponsivePageContainer>
  );
}
