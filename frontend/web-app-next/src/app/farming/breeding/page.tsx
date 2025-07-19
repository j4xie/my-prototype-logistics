"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BreedingRecord {
  id: number;
  femaleId: string;
  femaleTag: string;
  maleId: string;
  maleTag: string;
  breedingDate: string;
  method: string;
  expectedDate: string;
  actualDate: string;
  status: string;
  pregnancyCheck: string;
  offspring: number;
  notes: string;
  veterinarian: string;
}

interface AnimalInfo {
  id: string;
  tag: string;
  breed: string;
  age: string;
  weight: string;
  gender: string;
  status: string;
  healthStatus: string;
  bloodline: string;
}

export default function BreedingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('records'); // records, animals, plans
  const [records, setRecords] = useState<BreedingRecord[]>([]);
  const [animals, setAnimals] = useState<AnimalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // 模拟数据
  useEffect(() => {
    setRecords([
      {
        id: 1,
        femaleId: 'F001',
        femaleTag: 'F001',
        maleId: 'M001',
        maleTag: 'M001',
        breedingDate: '2024-01-15',
        method: '自然配种',
        expectedDate: '2024-10-15',
        actualDate: '',
        status: 'pregnant',
        pregnancyCheck: 'confirmed',
        offspring: 0,
        notes: '第一次配种，母牛状态良好',
        veterinarian: '张兽医'
      },
      {
        id: 2,
        femaleId: 'F002',
        femaleTag: 'F002',
        maleId: 'M002',
        maleTag: 'M002',
        breedingDate: '2023-12-20',
        method: '人工授精',
        expectedDate: '2024-09-20',
        actualDate: '2024-09-18',
        status: 'completed',
        pregnancyCheck: 'confirmed',
        offspring: 1,
        notes: '顺利产犊，母子平安',
        veterinarian: '李兽医'
      },
      {
        id: 3,
        femaleId: 'F003',
        femaleTag: 'F003',
        maleId: 'M001',
        maleTag: 'M001',
        breedingDate: '2024-02-01',
        method: '自然配种',
        expectedDate: '2024-11-01',
        actualDate: '',
        status: 'breeding',
        pregnancyCheck: 'pending',
        offspring: 0,
        notes: '配种中，待观察',
        veterinarian: '王兽医'
      },
      {
        id: 4,
        femaleId: 'F004',
        femaleTag: 'F004',
        maleId: 'M003',
        maleTag: 'M003',
        breedingDate: '2024-01-10',
        method: '人工授精',
        expectedDate: '2024-10-10',
        actualDate: '',
        status: 'failed',
        pregnancyCheck: 'negative',
        offspring: 0,
        notes: '配种失败，需要重新安排',
        veterinarian: '张兽医'
      }
    ]);

    setAnimals([
      {
        id: 'F001',
        tag: 'F001',
        breed: '安格斯牛',
        age: '3岁',
        weight: '450kg',
        gender: '母',
        status: 'breeding',
        healthStatus: 'healthy',
        bloodline: 'A系'
      },
      {
        id: 'F002',
        tag: 'F002',
        breed: '和牛',
        age: '4岁',
        weight: '480kg',
        gender: '母',
        status: 'lactating',
        healthStatus: 'healthy',
        bloodline: 'B系'
      },
      {
        id: 'F003',
        tag: 'F003',
        breed: '荷斯坦牛',
        age: '2岁',
        weight: '380kg',
        gender: '母',
        status: 'available',
        healthStatus: 'healthy',
        bloodline: 'C系'
      },
      {
        id: 'M001',
        tag: 'M001',
        breed: '安格斯牛',
        age: '5岁',
        weight: '800kg',
        gender: '公',
        status: 'active',
        healthStatus: 'healthy',
        bloodline: 'A系'
      },
      {
        id: 'M002',
        tag: 'M002',
        breed: '和牛',
        age: '6岁',
        weight: '850kg',
        gender: '公',
        status: 'active',
        healthStatus: 'healthy',
        bloodline: 'B系'
      },
      {
        id: 'M003',
        tag: 'M003',
        breed: '荷斯坦牛',
        age: '4岁',
        weight: '750kg',
        gender: '公',
        status: 'retired',
        healthStatus: 'healthy',
        bloodline: 'C系'
      }
    ]);
  }, []);

  // 筛选繁育记录
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.femaleTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.maleTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.veterinarian.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    const matchesMethod = filterMethod === 'all' || record.method === filterMethod;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  // 筛选动物
  const filteredAnimals = animals.filter(animal => {
    const matchesSearch = animal.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          animal.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          animal.bloodline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || animal.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // 获取可繁育的母牛
  const availableFemales = animals.filter(animal =>
    animal.gender === '母' &&
    ['available', 'ready'].includes(animal.status) &&
    animal.healthStatus === 'healthy'
  );

  // 获取活跃的种公牛
  const activeMales = animals.filter(animal =>
    animal.gender === '公' &&
    animal.status === 'active' &&
    animal.healthStatus === 'healthy'
  );

  // 添加繁育记录
  const handleAddRecord = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('繁育记录添加成功');
      setShowAddModal(false);
    } catch {
      alert('添加失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      breeding: 'bg-blue-100 text-blue-800',
      pregnant: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      available: 'bg-green-100 text-green-800',
      lactating: 'bg-yellow-100 text-yellow-800',
      active: 'bg-blue-100 text-blue-800',
      retired: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts = {
      breeding: '配种中',
      pregnant: '已怀孕',
      completed: '已完成',
      failed: '配种失败',
      available: '可配种',
      lactating: '哺乳期',
      active: '活跃',
      retired: '已退役'
    };
    return texts[status as keyof typeof texts] || status;
  };

  const getHealthColor = (status: string) => {
    const colors = {
      healthy: 'text-green-600',
      sick: 'text-red-600',
      recovering: 'text-yellow-600'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-[390px] mx-auto">
      {/* 导航栏 */}
      <header className="bg-white shadow-sm border-b fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[390px] z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">繁育管理</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            新增配种
          </button>
        </div>
      </header>

      {/* 标签栏 */}
      <div className="bg-white border-b px-4 pt-[60px]">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'records'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            繁育记录
          </button>
          <button
            onClick={() => setActiveTab('animals')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'animals'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            种畜管理
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'plans'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            配种计划
          </button>
        </div>
      </div>

      {/* 主要内容 */}
      <main className="flex-1 pt-4 pb-4">
        {/* 搜索和筛选 */}
        <div className="px-4 mb-4">
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder={activeTab === 'records' ? "搜索母牛、公牛耳标或兽医师..." : "搜索耳标、品种或血统..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex space-x-2">
              {activeTab === 'records' ? (
                <>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部状态</option>
                    <option value="breeding">配种中</option>
                    <option value="pregnant">已怀孕</option>
                    <option value="completed">已完成</option>
                    <option value="failed">配种失败</option>
                  </select>
                  <select
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部方式</option>
                    <option value="自然配种">自然配种</option>
                    <option value="人工授精">人工授精</option>
                    <option value="胚胎移植">胚胎移植</option>
                  </select>
                </>
              ) : (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部状态</option>
                  <option value="available">可配种</option>
                  <option value="breeding">配种中</option>
                  <option value="pregnant">怀孕中</option>
                  <option value="lactating">哺乳期</option>
                  <option value="active">活跃</option>
                  <option value="retired">已退役</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* 繁育记录标签页 */}
        {activeTab === 'records' && (
          <div className="px-4 space-y-3">
            {filteredRecords.map(record => (
              <div key={record.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {record.femaleTag} × {record.maleTag}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {getStatusText(record.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">配种方式: {record.method}</p>
                    <p className="text-sm text-gray-600">负责兽医: {record.veterinarian}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">配种日期:</span>
                    <span className="ml-1 font-medium">{record.breedingDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">预产期:</span>
                    <span className="ml-1 font-medium">{record.expectedDate}</span>
                  </div>
                  {record.actualDate && (
                    <div>
                      <span className="text-gray-500">实际产期:</span>
                      <span className="ml-1 font-medium">{record.actualDate}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">妊娠检查:</span>
                    <span className={`ml-1 font-medium ${
                      record.pregnancyCheck === 'confirmed' ? 'text-green-600' :
                      record.pregnancyCheck === 'negative' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {record.pregnancyCheck === 'confirmed' ? '已确认' :
                       record.pregnancyCheck === 'negative' ? '未怀孕' : '待检查'}
                    </span>
                  </div>
                  {record.offspring > 0 && (
                    <div>
                      <span className="text-gray-500">产仔数:</span>
                      <span className="ml-1 font-medium text-green-600">{record.offspring} 只</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm">
                        查看详情
                      </button>
                      <button className="text-gray-600 hover:bg-gray-50 px-2 py-1 rounded text-sm">
                        编辑
                      </button>
                      {record.status === 'pregnant' && (
                        <button className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-sm">
                          产仔记录
                        </button>
                      )}
                    </div>
                  </div>
                  {record.notes && (
                    <p className="text-sm text-gray-600 mt-2">备注: {record.notes}</p>
                  )}
                </div>
              </div>
            ))}

            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>暂无繁育记录</p>
              </div>
            )}
          </div>
        )}

        {/* 种畜管理标签页 */}
        {activeTab === 'animals' && (
          <div className="px-4 space-y-3">
            {/* 种畜统计 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-semibold text-gray-900">
                  {animals.filter(a => a.gender === '母').length}
                </div>
                <div className="text-xs text-gray-500">母畜数量</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-semibold text-blue-600">
                  {animals.filter(a => a.gender === '公').length}
                </div>
                <div className="text-xs text-gray-500">种公畜</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-semibold text-green-600">
                  {availableFemales.length}
                </div>
                <div className="text-xs text-gray-500">可配种</div>
              </div>
            </div>

            {filteredAnimals.map(animal => (
              <div key={animal.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{animal.tag}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        animal.gender === '公' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                      }`}>
                        {animal.gender}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(animal.status)}`}>
                        {getStatusText(animal.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">品种: {animal.breed}</p>
                    <p className="text-sm text-gray-600">血统: {animal.bloodline}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">年龄:</span>
                    <span className="ml-1 font-medium">{animal.age}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">体重:</span>
                    <span className="ml-1 font-medium">{animal.weight}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">健康状况:</span>
                    <span className={`ml-1 font-medium ${getHealthColor(animal.healthStatus)}`}>
                      {animal.healthStatus === 'healthy' ? '健康' :
                       animal.healthStatus === 'sick' ? '患病' : '康复中'}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm">
                        查看谱系
                      </button>
                      <button className="text-gray-600 hover:bg-gray-50 px-2 py-1 rounded text-sm">
                        健康档案
                      </button>
                      {animal.gender === '母' && animal.status === 'available' && (
                        <button className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-sm">
                          安排配种
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredAnimals.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>暂无种畜信息</p>
              </div>
            )}
          </div>
        )}

        {/* 配种计划标签页 */}
        {activeTab === 'plans' && (
          <div className="px-4 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h2m0-13h10a2 2 0 012 2v11a2 2 0 01-2 2H9m0-13v13" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800">配种计划</p>
                  <p className="text-sm text-blue-700">
                    有 {availableFemales.length} 头母畜可配种，{activeMales.length} 头种公畜可用
                  </p>
                </div>
              </div>
            </div>

            {/* 推荐配种组合 */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">推荐配种组合</h3>

              {availableFemales.slice(0, 3).map(female => {
                const suitableMale = activeMales.find(male => male.bloodline !== female.bloodline);

                return (
                  <div key={`plan-${female.id}`} className="border border-gray-200 rounded-lg p-3 mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-900">{female.tag}</span>
                        <span className="text-gray-500">×</span>
                        <span className="font-medium text-gray-900">{suitableMale?.tag || '待定'}</span>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        推荐
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-2">
                      <div>母畜: {female.breed} ({female.bloodline})</div>
                      <div>公畜: {suitableMale?.breed || '待选择'} ({suitableMale?.bloodline || '—'})</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        预期优势: 杂交优势明显，后代适应性强
                      </span>
                      <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors">
                        安排配种
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 配种日历 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">本月配种日历</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <span className="font-medium text-gray-900">2月15日</span>
                    <span className="text-sm text-gray-500 ml-2">F005 × M001</span>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    已安排
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <span className="font-medium text-gray-900">2月20日</span>
                    <span className="text-sm text-gray-500 ml-2">F006 × M002</span>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    计划中
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-gray-900">2月25日</span>
                    <span className="text-sm text-gray-500 ml-2">F007 × 待定</span>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                    待安排
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 添加配种记录模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">新增配种记录</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">母畜耳标</label>
                  <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">请选择母畜</option>
                    {availableFemales.map(female => (
                      <option key={female.id} value={female.id}>
                        {female.tag} - {female.breed}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">种公畜耳标</label>
                  <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">请选择公畜</option>
                    {activeMales.map(male => (
                      <option key={male.id} value={male.id}>
                        {male.tag} - {male.breed}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配种方式</label>
                  <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">请选择方式</option>
                    <option value="自然配种">自然配种</option>
                    <option value="人工授精">人工授精</option>
                    <option value="胚胎移植">胚胎移植</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配种日期</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">负责兽医</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入兽医师姓名"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入备注信息"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddRecord}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
