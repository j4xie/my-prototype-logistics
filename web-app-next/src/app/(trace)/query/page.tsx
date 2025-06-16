'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface TraceRecord {
  id: string;
  productName: string;
  batchNumber: string;
  productionDate: string;
  status: 'active' | 'completed' | 'expired';
  qrCode: string;
  stages: {
    farming: boolean;
    processing: boolean;
    logistics: boolean;
  };
}

export default function TraceQueryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'batch' | 'qr' | 'product'>('batch');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TraceRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // 预留：后续可以使用溯源Hook获取数据
  // const { useTraces } = useTrace();
  // const { data: allTraces, loading: tracesLoading } = useTraces();

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth/login');
    }
  }, [router]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 模拟搜索延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock数据
      const mockResults: TraceRecord[] = [
        {
          id: 'TR001',
          productName: '有机猪肉',
          batchNumber: 'PIG2024001',
          productionDate: '2024-06-01',
          status: 'active',
          qrCode: 'QR2024001',
          stages: {
            farming: true,
            processing: true,
            logistics: false
          }
        }
      ];

      // 根据搜索类型过滤
      const filtered = mockResults.filter(record => {
        switch (searchType) {
          case 'batch':
            return record.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
          case 'qr':
            return record.qrCode.toLowerCase().includes(searchQuery.toLowerCase());
          case 'product':
            return record.productName.toLowerCase().includes(searchQuery.toLowerCase());
          default:
            return false;
        }
      });

      setSearchResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#E6F7FF', text: '#1677FF', label: '进行中' };
      case 'completed':
        return { bg: '#F6FFED', text: '#52C41A', label: '已完成' };
      case 'expired':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '已过期' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getStageProgress = (stages: TraceRecord['stages']) => {
    const total = Object.keys(stages).length;
    const completed = Object.values(stages).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  };

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
          
          {/* 搜索区域 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
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

              {/* 快捷搜索按钮 */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => router.push('/trace/scan')}
                  className="flex-1 h-10 bg-[#52C41A] hover:bg-[#73D13D] text-white text-sm"
                >
                  <i className="fas fa-camera mr-2"></i>
                  扫码查询
                </Button>
                <Button
                  onClick={() => router.push('/trace/list')}
                  className="flex-1 h-10 bg-[#FA8C16] hover:bg-[#FFA940] text-white text-sm"
                >
                  <i className="fas fa-list mr-2"></i>
                  查看列表
                </Button>
              </div>
            </div>
          </Card>

          {/* 搜索结果 */}
          {hasSearched && (
            <div className="space-y-3">
              {isSearching ? (
                <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <i className="fas fa-spinner fa-spin text-[#1677FF] text-2xl mb-3"></i>
                  <p className="text-[#8c8c8c]">正在搜索...</p>
                </Card>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-[#262626]">搜索结果</h3>
                    <span className="text-sm text-[#8c8c8c]">共 {searchResults.length} 条</span>
                  </div>
                  
                  {searchResults.map((record) => {
                    const statusInfo = getStatusColor(record.status);
                    const progress = getStageProgress(record.stages);
                    
                    return (
                      <Card
                        key={record.id}
                        className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/trace/detail/${record.id}`)}
                      >
                        <div className="space-y-3">
                          {/* 产品信息 */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-[#262626] mb-1">{record.productName}</h4>
                              <p className="text-sm text-[#8c8c8c]">批次: {record.batchNumber}</p>
                              <p className="text-sm text-[#8c8c8c]">生产: {record.productionDate}</p>
                            </div>
                            <div
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </div>
                          </div>

                          {/* 进度条 */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[#8c8c8c]">溯源进度</span>
                              <span className="text-sm font-medium text-[#262626]">{progress}%</span>
                            </div>
                            <div className="w-full bg-[#f5f5f5] rounded-full h-2">
                              <div
                                className="bg-[#1677FF] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* 阶段状态 */}
                          <div className="flex items-center space-x-4">
                            {[
                              { key: 'farming', label: '养殖', icon: 'fas fa-seedling' },
                              { key: 'processing', label: '加工', icon: 'fas fa-industry' },
                              { key: 'logistics', label: '物流', icon: 'fas fa-truck' }
                            ].map((stage) => (
                              <div key={stage.key} className="flex items-center space-x-1">
                                <i
                                  className={`${stage.icon} text-sm ${
                                    record.stages[stage.key as keyof typeof record.stages]
                                      ? 'text-[#52C41A]'
                                      : 'text-[#d9d9d9]'
                                  }`}
                                ></i>
                                <span className="text-xs text-[#8c8c8c]">{stage.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </>
              ) : (
                <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <i className="fas fa-search text-[#d9d9d9] text-3xl mb-3"></i>
                  <p className="text-[#8c8c8c] mb-2">未找到相关记录</p>
                  <p className="text-sm text-[#bfbfbf]">请检查搜索条件或尝试其他关键词</p>
                </Card>
              )}
            </div>
          )}

          {/* 使用说明 */}
          {!hasSearched && (
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-info-circle text-[#1677FF] mr-2"></i>
                使用说明
              </h3>
              <div className="space-y-2 text-sm text-[#8c8c8c]">
                <p>• 选择搜索类型：批次号、二维码或产品名称</p>
                <p>• 输入关键词进行精确或模糊搜索</p>
                <p>• 点击搜索结果查看详细溯源信息</p>
                <p>• 支持扫码快速查询功能</p>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
} 