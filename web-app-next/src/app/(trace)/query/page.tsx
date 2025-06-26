'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';

interface TraceRecord {
  id: string;
  productName: string;
  productType: string;
  batchNumber: string;
  productionDate: string;
  expiryDate: string;
  status: 'active' | 'completed' | 'expired' | 'recalled';
  qrCode: string;
  producer: {
    name: string;
    license: string;
    address: string;
  };
  stages: {
    farming: {
      completed: boolean;
      date?: string;
      location?: string;
      operator?: string;
    };
    processing: {
      completed: boolean;
      date?: string;
      facility?: string;
      inspector?: string;
    };
    logistics: {
      completed: boolean;
      date?: string;
      carrier?: string;
      destination?: string;
    };
  };
  certificates: string[];
  qualityGrade: 'A' | 'B' | 'C' | 'D';
  safetyStatus: 'safe' | 'warning' | 'danger';
}

interface SearchHistory {
  query: string;
  type: 'batch' | 'qr' | 'product';
  timestamp: string;
}

export default function TraceQueryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'batch' | 'qr' | 'product'>('batch');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TraceRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TraceRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // 加载搜索历史
    const history = localStorage.getItem('trace_search_history');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, [router]);

  const saveSearchHistory = (query: string, type: string) => {
    const newHistory: SearchHistory = {
      query,
      type: type as 'batch' | 'qr' | 'product',
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [newHistory, ...searchHistory.slice(0, 9)]; // 保留最近10条
    setSearchHistory(updatedHistory);
    localStorage.setItem('trace_search_history', JSON.stringify(updatedHistory));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('请输入搜索内容');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock数据 - 基于真实业务场景
      const mockResults: TraceRecord[] = [
        {
          id: 'TR2024001',
          productName: '有机黑猪肉',
          productType: '猪肉制品',
          batchNumber: 'PIG2024001',
          productionDate: '2024-06-01',
          expiryDate: '2024-06-15',
          status: 'active',
          qrCode: 'QR2024001',
          producer: {
            name: '绿源生态农场',
            license: 'SC10611010400123',
            address: '山东省济南市章丘区'
          },
          stages: {
            farming: {
              completed: true,
              date: '2024-05-01',
              location: '绿源生态农场A区',
              operator: '张师傅'
            },
            processing: {
              completed: true,
              date: '2024-06-01',
              facility: '济南肉类加工厂',
              inspector: '李检验员'
            },
            logistics: {
              completed: false,
              date: undefined,
              carrier: undefined,
              destination: undefined
            }
          },
          certificates: ['有机产品认证', '食品安全认证', 'HACCP认证'],
          qualityGrade: 'A',
          safetyStatus: 'safe'
        }
      ];

      // 根据搜索类型和内容过滤
      const filtered = mockResults.filter(record => {
        const query = searchQuery.toLowerCase();
        switch (searchType) {
          case 'batch':
            return record.batchNumber.toLowerCase().includes(query);
          case 'qr':
            return record.qrCode.toLowerCase().includes(query);
          case 'product':
            return record.productName.toLowerCase().includes(query) ||
                   record.productType.toLowerCase().includes(query);
          default:
            return false;
        }
      });

      setSearchResults(filtered);

      // 保存搜索历史
      saveSearchHistory(searchQuery, searchType);

    } catch (error) {
      console.error('Search error:', error);
      alert('搜索失败，请稍后重试');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecordClick = (record: TraceRecord) => {
    setSelectedRecord(record);
    setShowDetails(true);
  };

  const handleHistoryClick = (historyItem: SearchHistory) => {
    setSearchQuery(historyItem.query);
    setSearchType(historyItem.type);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#E6F7FF', text: '#1677FF', label: '流通中', icon: 'fas fa-play-circle' };
      case 'completed':
        return { bg: '#F6FFED', text: '#52C41A', label: '已完成', icon: 'fas fa-check-circle' };
      case 'expired':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '已过期', icon: 'fas fa-exclamation-circle' };
      case 'recalled':
        return { bg: '#FFF0F6', text: '#EB2F96', label: '已召回', icon: 'fas fa-ban' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知', icon: 'fas fa-question-circle' };
    }
  };

  const getSafetyInfo = (status: string) => {
    switch (status) {
      case 'safe':
        return { bg: '#F6FFED', text: '#52C41A', label: '安全', icon: 'fas fa-shield-alt' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告', icon: 'fas fa-exclamation-triangle' };
      case 'danger':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '危险', icon: 'fas fa-times-circle' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知', icon: 'fas fa-question' };
    }
  };

  const getStageProgress = (stages: TraceRecord['stages']) => {
    const stageList = Object.values(stages);
    const completed = stageList.filter(stage => stage.completed).length;
    return Math.round((completed / stageList.length) * 100);
  };

  const getQualityColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#52C41A';
      case 'B': return '#1677FF';
      case 'C': return '#FA8C16';
      case 'D': return '#FF4D4F';
      default: return '#8C8C8C';
    }
  };

  if (showDetails && selectedRecord) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        {/* 详情页顶部导航 */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
            <button
              onClick={() => setShowDetails(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 className="text-lg font-semibold">溯源详情</h1>
            <button
              onClick={() => {
                // 分享功能
                if (navigator.share) {
                  navigator.share({
                    title: `${selectedRecord.productName} - 溯源信息`,
                    text: `批次号：${selectedRecord.batchNumber}`,
                    url: window.location.href
                  });
                } else {
                  alert('分享功能暂不支持');
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <i className="fas fa-share-alt"></i>
            </button>
          </div>
        </header>

        {/* 详情内容 */}
        <main className="flex-1 pt-20 pb-4">
          <div className="max-w-[390px] mx-auto px-4 space-y-4">

            {/* 产品基本信息 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1677FF] to-[#4096FF] rounded-lg flex items-center justify-center text-white text-2xl">
                  <i className="fas fa-box"></i>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-[#262626] mb-1">
                    {selectedRecord.productName}
                  </h2>
                  <p className="text-sm text-[#8c8c8c] mb-2">{selectedRecord.productType}</p>
                  <div className="flex items-center space-x-2">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: getStatusInfo(selectedRecord.status).bg,
                        color: getStatusInfo(selectedRecord.status).text
                      }}
                    >
                      <i className={`${getStatusInfo(selectedRecord.status).icon} mr-1`}></i>
                      {getStatusInfo(selectedRecord.status).label}
                    </span>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: getSafetyInfo(selectedRecord.safetyStatus).bg,
                        color: getSafetyInfo(selectedRecord.safetyStatus).text
                      }}
                    >
                      <i className={`${getSafetyInfo(selectedRecord.safetyStatus).icon} mr-1`}></i>
                      {getSafetyInfo(selectedRecord.safetyStatus).label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#8c8c8c]">批次号：</span>
                  <span className="font-medium">{selectedRecord.batchNumber}</span>
                </div>
                <div>
                  <span className="text-[#8c8c8c]">质量等级：</span>
                  <span
                    className="font-bold"
                    style={{ color: getQualityColor(selectedRecord.qualityGrade) }}
                  >
                    {selectedRecord.qualityGrade}级
                  </span>
                </div>
                <div>
                  <span className="text-[#8c8c8c]">生产日期：</span>
                  <span className="font-medium">{selectedRecord.productionDate}</span>
                </div>
                <div>
                  <span className="text-[#8c8c8c]">保质期至：</span>
                  <span className="font-medium">{selectedRecord.expiryDate}</span>
                </div>
              </div>
            </Card>

            {/* 生产商信息 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-[#262626] mb-3 flex items-center">
                <i className="fas fa-industry text-[#1677FF] mr-2"></i>
                生产商信息
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">企业名称：</span>
                  <span className="font-medium">{selectedRecord.producer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">生产许可：</span>
                  <span className="font-medium">{selectedRecord.producer.license}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8c8c8c]">生产地址：</span>
                  <span className="font-medium">{selectedRecord.producer.address}</span>
                </div>
              </div>
            </Card>

            {/* 溯源流程 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#262626] flex items-center">
                  <i className="fas fa-route text-[#1677FF] mr-2"></i>
                  溯源流程
                </h3>
                <span className="text-sm text-[#8c8c8c]">
                  {getStageProgress(selectedRecord.stages)}% 完成
                </span>
              </div>

              <div className="space-y-3">
                {/* 养殖阶段 */}
                <div className={`p-3 rounded-lg border-l-4 ${
                  selectedRecord.stages.farming.completed
                    ? 'bg-[#F6FFED] border-[#52C41A]'
                    : 'bg-[#F5F5F5] border-[#D9D9D9]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#262626]">
                      <i className="fas fa-seedling mr-2"></i>
                      养殖阶段
                    </span>
                    {selectedRecord.stages.farming.completed && (
                      <i className="fas fa-check-circle text-[#52C41A]"></i>
                    )}
                  </div>
                  {selectedRecord.stages.farming.completed && (
                    <div className="text-sm text-[#8c8c8c] space-y-1">
                      <div>时间：{selectedRecord.stages.farming.date}</div>
                      <div>地点：{selectedRecord.stages.farming.location}</div>
                      <div>负责人：{selectedRecord.stages.farming.operator}</div>
                    </div>
                  )}
                </div>

                {/* 加工阶段 */}
                <div className={`p-3 rounded-lg border-l-4 ${
                  selectedRecord.stages.processing.completed
                    ? 'bg-[#FFF7E6] border-[#FA8C16]'
                    : 'bg-[#F5F5F5] border-[#D9D9D9]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#262626]">
                      <i className="fas fa-industry mr-2"></i>
                      加工阶段
                    </span>
                    {selectedRecord.stages.processing.completed && (
                      <i className="fas fa-check-circle text-[#FA8C16]"></i>
                    )}
                  </div>
                  {selectedRecord.stages.processing.completed && (
                    <div className="text-sm text-[#8c8c8c] space-y-1">
                      <div>时间：{selectedRecord.stages.processing.date}</div>
                      <div>工厂：{selectedRecord.stages.processing.facility}</div>
                      <div>检验员：{selectedRecord.stages.processing.inspector}</div>
                    </div>
                  )}
                </div>

                {/* 物流阶段 */}
                <div className={`p-3 rounded-lg border-l-4 ${
                  selectedRecord.stages.logistics.completed
                    ? 'bg-[#F9F0FF] border-[#722ED1]'
                    : 'bg-[#F5F5F5] border-[#D9D9D9]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#262626]">
                      <i className="fas fa-truck mr-2"></i>
                      物流阶段
                    </span>
                    {selectedRecord.stages.logistics.completed && (
                      <i className="fas fa-check-circle text-[#722ED1]"></i>
                    )}
                  </div>
                  {selectedRecord.stages.logistics.completed && (
                    <div className="text-sm text-[#8c8c8c] space-y-1">
                      <div>时间：{selectedRecord.stages.logistics.date}</div>
                      <div>承运商：{selectedRecord.stages.logistics.carrier}</div>
                      <div>目的地：{selectedRecord.stages.logistics.destination}</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* 认证证书 */}
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-[#262626] mb-3 flex items-center">
                <i className="fas fa-certificate text-[#1677FF] mr-2"></i>
                认证证书
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedRecord.certificates.map((cert, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-[#E6F7FF] text-[#1677FF] rounded-full text-sm font-medium"
                  >
                    <i className="fas fa-award mr-1"></i>
                    {cert}
                  </span>
                ))}
              </div>
            </Card>

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => {
                  // 下载证书功能
                  alert('证书下载功能开发中');
                }}
                className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
              >
                <i className="fas fa-download mr-2"></i>
                下载证书
              </Button>
              <Button
                onClick={() => {
                  // 举报功能
                  alert('举报功能开发中');
                }}
                variant="secondary"
                className="h-12"
              >
                <i className="fas fa-flag mr-2"></i>
                举报问题
              </Button>
            </div>
          </div>
        </main>
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
          <h1 className="text-lg font-semibold">溯源查询</h1>
          <button
            onClick={() => router.push('/(dashboard)/home/selector')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4 space-y-4">

          {/* 搜索区域 */}
          <Card className="bg-white rounded-lg shadow-sm p-4">
            <div className="space-y-4">
              {/* 搜索类型选择 */}
              <div className="flex space-x-2">
                {[
                  { key: 'batch', label: '批次号', icon: 'fas fa-barcode' },
                  { key: 'qr', label: '二维码', icon: 'fas fa-qrcode' },
                  { key: 'product', label: '产品名', icon: 'fas fa-box' }
                ].map((type) => (
                  <button
                    key={type.key}
                    onClick={() => setSearchType(type.key as typeof searchType)}
                    className={`
                      flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                      ${searchType === type.key
                        ? 'bg-[#1677FF] text-white shadow-sm'
                        : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                      }
                    `}
                  >
                    <i className={`${type.icon} mr-1`}></i>
                    {type.label}
                  </button>
                ))}
              </div>

              {/* 搜索输入框 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={`请输入${searchType === 'batch' ? '批次号' : searchType === 'qr' ? '二维码' : '产品名称'}`}
                  className="w-full h-12 pl-4 pr-12 border border-[#d9d9d9] rounded-md text-base focus:border-[#1677FF] focus:outline-none focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)] transition-all"
                  disabled={isSearching}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#1677FF] text-white rounded-md flex items-center justify-center hover:bg-[#4096FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSearching ? (
                    <i className="fas fa-spinner fa-spin text-sm"></i>
                  ) : (
                    <i className="fas fa-search text-sm"></i>
                  )}
                </button>
              </div>

              {/* 快捷操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    // 扫码功能
                    alert('扫码功能开发中，请使用手动输入');
                  }}
                  className="h-10 bg-[#52C41A] hover:bg-[#73D13D] text-white text-sm"
                >
                  <i className="fas fa-camera mr-2"></i>
                  扫码查询
                </Button>
                <Button
                  onClick={() => router.push('/trace/list')}
                  variant="secondary"
                  className="h-10 text-sm"
                >
                  <i className="fas fa-list mr-2"></i>
                  记录列表
                </Button>
              </div>
            </div>
          </Card>

          {/* 搜索历史 */}
          {searchHistory.length > 0 && !hasSearched && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-[#262626] mb-3 flex items-center">
                <i className="fas fa-history text-[#8c8c8c] mr-2"></i>
                搜索历史
              </h3>
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(item)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[#f5f5f5] transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <i className={`fas ${
                        item.type === 'batch' ? 'fa-barcode' :
                        item.type === 'qr' ? 'fa-qrcode' : 'fa-box'
                      } text-[#8c8c8c]`}></i>
                      <span className="text-sm">{item.query}</span>
                    </div>
                    <span className="text-xs text-[#8c8c8c]">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* 搜索结果 */}
          {isSearching && (
                <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Loading />
              <p className="text-[#8c8c8c] mt-4">正在搜索溯源信息...</p>
                </Card>
          )}

          {hasSearched && !isSearching && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#262626]">搜索结果</h3>
                <span className="text-sm text-[#8c8c8c]">
                  找到 {searchResults.length} 条记录
                </span>
                  </div>

              {searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-search text-4xl text-[#d9d9d9] mb-4"></i>
                  <p className="text-[#8c8c8c] mb-2">未找到相关溯源信息</p>
                  <p className="text-sm text-[#bfbfbf]">请检查输入内容或尝试其他搜索方式</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((record) => {
                    const statusInfo = getStatusInfo(record.status);
                    const safetyInfo = getSafetyInfo(record.safetyStatus);
                    const progress = getStageProgress(record.stages);

                    return (
                      <div
                        key={record.id}
                        onClick={() => handleRecordClick(record)}
                        className="p-4 border border-[#f0f0f0] rounded-lg hover:border-[#1677FF] hover:shadow-sm cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                            <h4 className="font-semibold text-[#262626] mb-1">
                              {record.productName}
                            </h4>
                            <p className="text-sm text-[#8c8c8c] mb-2">
                              批次：{record.batchNumber} | {record.productType}
                            </p>
                            <div className="flex items-center space-x-2">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: statusInfo.bg,
                                  color: statusInfo.text
                                }}
                              >
                                <i className={`${statusInfo.icon} mr-1`}></i>
                              {statusInfo.label}
                              </span>
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: safetyInfo.bg,
                                  color: safetyInfo.text
                                }}
                              >
                                <i className={`${safetyInfo.icon} mr-1`}></i>
                                {safetyInfo.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-[#262626] mb-1">
                              {progress}%
                            </div>
                            <div className="w-16 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#1677FF] transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                              </div>

                        <div className="flex items-center justify-between text-sm text-[#8c8c8c]">
                          <span>生产日期：{record.productionDate}</span>
                          <span className="flex items-center">
                            查看详情 <i className="fas fa-chevron-right ml-1"></i>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* 使用说明 */}
          {!hasSearched && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-[#262626] mb-3 flex items-center">
                <i className="fas fa-info-circle text-[#1677FF] mr-2"></i>
                使用说明
              </h3>
              <div className="space-y-2 text-sm text-[#8c8c8c]">
                <div className="flex items-start space-x-2">
                  <i className="fas fa-dot-circle text-xs mt-1.5 text-[#1677FF]"></i>
                  <span>支持批次号、二维码、产品名称三种查询方式</span>
                </div>
                <div className="flex items-start space-x-2">
                  <i className="fas fa-dot-circle text-xs mt-1.5 text-[#1677FF]"></i>
                  <span>可查看完整的养殖、加工、物流溯源流程</span>
                </div>
                <div className="flex items-start space-x-2">
                  <i className="fas fa-dot-circle text-xs mt-1.5 text-[#1677FF]"></i>
                  <span>支持下载产品认证证书和质检报告</span>
                </div>
                <div className="flex items-start space-x-2">
                  <i className="fas fa-dot-circle text-xs mt-1.5 text-[#1677FF]"></i>
                  <span>发现问题可直接举报，保障食品安全</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
