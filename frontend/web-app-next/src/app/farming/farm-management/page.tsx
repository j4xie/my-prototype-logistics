'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';

interface Farm {
  id: string;
  name: string;
  location: string;
  area: number;
  status: 'active' | 'maintenance' | 'inactive';
  animals: number;
  workers: number;
  established: string;
  type: 'cattle' | 'pig' | 'chicken' | 'mixed';
  manager: string;
  contact: string;
  lastInspection: string;
  certifications: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface EnvironmentalData {
  temperature: number;
  humidity: number;
  airQuality: number;
  windSpeed: number;
  soilMoisture: number;
  timestamp: string;
}

interface FarmStatistics {
  totalFarms: number;
  activeFarms: number;
  totalAnimals: number;
  totalWorkers: number;
  averageProductivity: number;
  certificationRate: number;
}

export default function FarmManagementPage() {
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData[]>([]);
  const [statistics, setStatistics] = useState<FarmStatistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<'list' | 'details' | 'environment'>('list');

  useEffect(() => {
    fetchFarms();
    fetchStatistics();
  }, []);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      // Mock数据
      const mockFarms: Farm[] = [
        {
          id: 'farm-001',
          name: '绿野生态农场',
          location: '河北省张家口市崇礼区',
          area: 500,
          status: 'active',
          animals: 1200,
          workers: 25,
          established: '2018-03-15',
          type: 'cattle',
          manager: '张明华',
          contact: '13800138001',
          lastInspection: '2025-01-15',
          certifications: ['有机认证', 'ISO22000', '绿色食品'],
          coordinates: { lat: 40.9645, lng: 115.2909 }
        },
        {
          id: 'farm-002',
          name: '现代养殖示范场',
          location: '山东省潍坊市寿光市',
          area: 800,
          status: 'active',
          animals: 2500,
          workers: 45,
          established: '2020-06-20',
          type: 'pig',
          manager: '李建国',
          contact: '13900139002',
          lastInspection: '2025-01-20',
          certifications: ['有机认证', 'HACCP'],
          coordinates: { lat: 36.8642, lng: 118.7353 }
        },
        {
          id: 'farm-003',
          name: '科技蛋鸡养殖场',
          location: '江苏省南京市江宁区',
          area: 300,
          status: 'maintenance',
          animals: 8000,
          workers: 20,
          established: '2019-09-10',
          type: 'chicken',
          manager: '王小红',
          contact: '13700137003',
          lastInspection: '2025-01-10',
          certifications: ['有机认证'],
          coordinates: { lat: 31.9531, lng: 118.8062 }
        },
        {
          id: 'farm-004',
          name: '综合农业园区',
          location: '四川省成都市新津区',
          area: 1200,
          status: 'active',
          animals: 3500,
          workers: 60,
          established: '2017-12-01',
          type: 'mixed',
          manager: '刘强东',
          contact: '13600136004',
          lastInspection: '2025-01-25',
          certifications: ['有机认证', 'ISO22000', '绿色食品', 'GAP'],
          coordinates: { lat: 30.4097, lng: 103.8245 }
        }
      ];

      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      setFarms(mockFarms);
    } catch (error) {
      console.error('获取农场数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      // Mock统计数据
      const mockStats: FarmStatistics = {
        totalFarms: 4,
        activeFarms: 3,
        totalAnimals: 15200,
        totalWorkers: 150,
        averageProductivity: 87.5,
        certificationRate: 95.0
      };

      setStatistics(mockStats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const fetchEnvironmentalData = async () => {
    try {
      // Mock环境数据
      const mockEnvData: EnvironmentalData[] = [
        {
          temperature: 22.5,
          humidity: 65,
          airQuality: 85,
          windSpeed: 2.3,
          soilMoisture: 45,
          timestamp: '2025-02-02 14:30:00'
        }
      ];

      setEnvironmentalData(mockEnvData);
    } catch (error) {
      console.error('获取环境数据失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'maintenance':
        return 'warning';
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '运营中';
      case 'maintenance':
        return '维护中';
      case 'inactive':
        return '停运';
      default:
        return '未知';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'cattle':
        return '牛类养殖';
      case 'pig':
        return '猪类养殖';
      case 'chicken':
        return '禽类养殖';
      case 'mixed':
        return '综合养殖';
      default:
        return '其他';
    }
  };

  const filteredFarms = farms.filter(farm => {
    const matchesSearch = farm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         farm.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         farm.manager.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || farm.status === filterStatus;
    const matchesType = filterType === 'all' || farm.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleFarmSelect = (farm: Farm) => {
    setSelectedFarm(farm);
    fetchEnvironmentalData();
    setCurrentView('details');
  };

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
          <h1 className="text-lg font-medium">农场管理</h1>
          <div className="w-8 h-8"></div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 统计概览 */}
        {statistics && currentView === 'list' && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {statistics.totalFarms}
                </p>
                <p className="text-sm text-gray-600">总农场数</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.activeFarms}
                </p>
                <p className="text-sm text-gray-600">运营农场</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {statistics.totalWorkers}
                </p>
                <p className="text-sm text-gray-600">总员工数</p>
              </div>
            </Card>
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {statistics.totalAnimals.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">总动物数</p>
              </div>
            </Card>
          </div>
        )}

        {/* 视图切换 */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant={currentView === 'list' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('list')}
            className="flex-1 text-sm"
          >
            农场列表
          </Button>
          <Button
            variant={currentView === 'details' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('details')}
            className="flex-1 text-sm"
            disabled={!selectedFarm}
          >
            农场详情
          </Button>
          <Button
            variant={currentView === 'environment' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('environment')}
            className="flex-1 text-sm"
            disabled={!selectedFarm}
          >
            环境监控
          </Button>
        </div>

        {/* 农场列表视图 */}
        {currentView === 'list' && (
          <>
            {/* 筛选和搜索 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="space-y-3">
                <Input
                  placeholder="搜索农场名称、位置或管理员..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: 'all', label: '全部状态' },
                      { value: 'active', label: '运营中' },
                      { value: 'maintenance', label: '维护中' },
                      { value: 'inactive', label: '停运' }
                    ]}
                  />
                  <Select
                    value={filterType}
                    onChange={setFilterType}
                    options={[
                      { value: 'all', label: '全部类型' },
                      { value: 'cattle', label: '牛类养殖' },
                      { value: 'pig', label: '猪类养殖' },
                      { value: 'chicken', label: '禽类养殖' },
                      { value: 'mixed', label: '综合养殖' }
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* 农场列表 */}
            <div className="space-y-4">
              {filteredFarms.map((farm) => (
                <Card
                  key={farm.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleFarmSelect(farm)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{farm.name}</h3>
                      <p className="text-sm text-gray-600">{farm.location}</p>
                    </div>
                    <Badge variant={getStatusColor(farm.status)}>
                      {getStatusText(farm.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">类型：</span>
                      {getTypeText(farm.type)}
                    </div>
                    <div>
                      <span className="text-gray-600">面积：</span>
                      {farm.area}亩
                    </div>
                    <div>
                      <span className="text-gray-600">动物：</span>
                      {farm.animals.toLocaleString()}头/只
                    </div>
                    <div>
                      <span className="text-gray-600">员工：</span>
                      {farm.workers}人
                    </div>
                  </div>

                  <div className="text-sm mt-2">
                    <span className="text-gray-600">管理员：</span>
                    {farm.manager}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {farm.certifications.slice(0, 2).map((cert, index) => (
                      <Badge key={index} variant="default" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                    {farm.certifications.length > 2 && (
                      <Badge variant="default" className="text-xs">
                        +{farm.certifications.length - 2}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* 农场详情视图 */}
        {currentView === 'details' && selectedFarm && (
          <Card className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{selectedFarm.name}</h3>
              <Badge variant={getStatusColor(selectedFarm.status)}>
                {getStatusText(selectedFarm.status)}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">位置：</span>
                <span>{selectedFarm.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">面积：</span>
                <span>{selectedFarm.area}亩</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">类型：</span>
                <span>{getTypeText(selectedFarm.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">建立时间：</span>
                <span>{selectedFarm.established}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">管理员：</span>
                <span>{selectedFarm.manager}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">联系方式：</span>
                <span>{selectedFarm.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">动物数量：</span>
                <span>{selectedFarm.animals.toLocaleString()}头/只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">员工数量：</span>
                <span>{selectedFarm.workers}人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最后检查：</span>
                <span>{selectedFarm.lastInspection}</span>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold mb-2">认证证书</h4>
              <div className="flex flex-wrap gap-2">
                {selectedFarm.certifications.map((cert, index) => (
                  <Badge key={index} variant="default">
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* 环境监控视图 */}
        {currentView === 'environment' && selectedFarm && environmentalData.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {environmentalData[0].temperature}°C
                </p>
                <p className="text-sm text-gray-600">温度</p>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {environmentalData[0].humidity}%
                </p>
                <p className="text-sm text-gray-600">湿度</p>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {environmentalData[0].airQuality}
                </p>
                <p className="text-sm text-gray-600">空气质量</p>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {environmentalData[0].windSpeed}m/s
                </p>
                <p className="text-sm text-gray-600">风速</p>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {environmentalData[0].soilMoisture}%
                </p>
                <p className="text-sm text-gray-600">土壤湿度</p>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-center">
                <p className="text-sm font-medium">更新时间</p>
                <p className="text-xs text-gray-600">
                  {environmentalData[0].timestamp}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* 环境监控空状态 */}
        {currentView === 'environment' && !selectedFarm && (
          <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">请先选择一个农场查看环境监控数据</p>
          </Card>
        )}
      </main>
    </div>
  );
}
