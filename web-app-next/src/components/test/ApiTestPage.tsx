/**
 * API Hook测试页面 - MVP功能全覆盖测试
 * 
 * @description 测试所有业务Hook功能，包括farming、processing和AI analytics
 * @updated 支持MVP生产加工AI分析测试
 */

'use client';

import React, { useState } from 'react';
import { 
  useAuth, 
  useTrace, 
  useProduct, 
  useUser,
  useFarming,
  useProcessing,
  useAIAnalytics,
  useBatchDataProcessing,
  login,
  clearCache,
  clearModuleCache,
  getCacheStats,
  ApiStatus
} from '@/hooks/useApi-simple';

interface TestSectionProps {
  title: string;
  children: React.ReactNode;
}

const TestSection: React.FC<TestSectionProps> = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
    {children}
  </div>
);

interface DataDisplayProps {
  data: any;
  loading: boolean;
  error: Error | null;
  status: ApiStatus;
  onRefetch: () => void;
}

const DataDisplay: React.FC<DataDisplayProps> = ({ data, loading, error, status, onRefetch }) => (
  <div className="space-y-2">
    <div className="flex items-center space-x-2">
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        status === 'loading' ? 'bg-yellow-100 text-yellow-800' :
        status === 'success' ? 'bg-green-100 text-green-800' :
        status === 'error' ? 'bg-red-100 text-red-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {status.toUpperCase()}
      </span>
      <button 
        onClick={onRefetch}
        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        disabled={loading}
      >
        {loading ? '刷新中...' : '刷新'}
      </button>
    </div>
    
    {error && (
      <div className="bg-red-50 border border-red-200 rounded p-3">
        <p className="text-red-800 text-sm">错误: {error.message}</p>
      </div>
    )}
    
    {data && (
      <div className="bg-gray-50 border border-gray-200 rounded p-3">
        <pre className="text-xs text-gray-700 overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    )}
  </div>
);

export default function ApiTestPage() {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);

  // 基础功能Hook
  const { useCurrentUser } = useAuth();
  const currentUser = useCurrentUser();
  
  const { useTraces, useTraceById } = useTrace();
  const traces = useTraces({ page: 1, limit: 10 });
  const traceDetail = useTraceById('test-trace-001');

  const { useProducts, useProductById } = useProduct();
  const products = useProducts({ category: 'meat' });
  const productDetail = useProductById('test-product-001');

  const { useProfile } = useUser();
  const userProfile = useProfile();

  // MVP核心功能Hook - Farming
  const { 
    useBatchData, 
    useEnvironmentData, 
    useHealthMetrics,
    useVaccineRecords,
    useBreedingInfo
  } = useFarming();
  
  const farmingBatches = useBatchData();
  const farmingBatchDetail = useBatchData('batch-001');
  const environmentData = useEnvironmentData('24h');
  const healthMetrics = useHealthMetrics('batch-001');
  const vaccineRecords = useVaccineRecords();
  const breedingInfo = useBreedingInfo();

  // MVP核心功能Hook - Processing
  const {
    useQualityReports,
    useProductionSchedule,
    useEquipmentStatus,
    useProcessingRecords,
    usePackagingInfo,
    useTemperatureLogs
  } = useProcessing();

  const qualityReports = useQualityReports({ status: 'completed' });
  const productionSchedule = useProductionSchedule('this-week');
  const equipmentStatus = useEquipmentStatus();
  const processingRecords = useProcessingRecords();
  const packagingInfo = usePackagingInfo('batch-001');
  const temperatureLogs = useTemperatureLogs('12h');

  // MVP关键功能Hook - AI Analytics
  const {
    useProductionInsights,
    useOptimizationSuggestions,
    usePredictiveAnalysis,
    useDataAggregation,
    useRealtimeAnalysis
  } = useAIAnalytics();

  const productionInsights = useProductionInsights({
    batchId: 'batch-001',
    timeRange: '7d',
    analysisType: 'all'
  });

  const optimizationSuggestions = useOptimizationSuggestions({
    processType: 'processing',
    currentData: { efficiency: 85, quality: 92 },
    targetMetrics: ['efficiency', 'cost']
  });

  const predictiveAnalysis = usePredictiveAnalysis({
    type: 'yield',
    inputData: { temperature: 23, humidity: 65 },
    predictionPeriod: '30d'
  });

  const dataAggregation = useDataAggregation({
    sources: ['farming', 'processing'],
    timeRange: '30d',
    aggregationType: 'summary'
  });

  const realtimeAnalysis = useRealtimeAnalysis({
    modules: ['farming', 'processing'],
    alertThresholds: { temperature: 30, efficiency: 80 }
  });

  // 批量数据处理Hook
  const { useBatchHistoricalData, useDataPreprocessing } = useBatchDataProcessing();
  
  const batchHistoricalData = useBatchHistoricalData({
    modules: ['farming', 'processing'],
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    batchSize: 100
  });

  const dataPreprocessing = useDataPreprocessing({
    dataSource: 'farming-batch-001',
    processingRules: { normalize: true, removeOutliers: true },
    outputFormat: 'json'
  });

  // 登录处理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      await login(loginForm);
      alert('登录成功！');
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  // 缓存管理
  const handleClearCache = (module?: string) => {
    if (module) {
      clearModuleCache(module as any);
      alert(`${module} 模块缓存已清空`);
    } else {
      clearCache();
      alert('所有缓存已清空');
    }
  };

  const handleGetCacheStats = () => {
    const stats = getCacheStats();
    setCacheStats(stats);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">API Hook系统测试 - MVP功能全覆盖</h1>
        
        {/* 登录测试 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">登录测试</h3>
          <form onSubmit={handleLogin} className="flex space-x-2">
            <input
              type="text"
              placeholder="用户名"
              value={loginForm.username}
              onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              className="border rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="密码"
              value={loginForm.password}
              onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
              className="border rounded px-3 py-2"
            />
            <button 
              type="submit" 
              disabled={loginLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loginLoading ? '登录中...' : '登录'}
            </button>
          </form>
          {loginError && (
            <p className="text-red-600 text-sm mt-2">错误: {loginError}</p>
          )}
        </div>

        {/* 缓存管理 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">缓存管理</h3>
          <div className="flex space-x-2 mb-3">
            <button onClick={() => handleClearCache()} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
              清空所有缓存
            </button>
            <button onClick={() => handleClearCache('farming')} className="bg-orange-500 text-white px-3 py-1 rounded text-sm">
              清空farming缓存
            </button>
            <button onClick={() => handleClearCache('processing')} className="bg-orange-500 text-white px-3 py-1 rounded text-sm">
              清空processing缓存
            </button>
            <button onClick={() => handleClearCache('ai')} className="bg-orange-500 text-white px-3 py-1 rounded text-sm">
              清空AI缓存
            </button>
            <button onClick={handleGetCacheStats} className="bg-green-500 text-white px-3 py-1 rounded text-sm">
              获取缓存统计
            </button>
          </div>
          {cacheStats && (
            <div className="bg-gray-50 border rounded p-3">
              <pre className="text-xs">{JSON.stringify(cacheStats, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* 基础功能测试 */}
      <TestSection title="基础功能测试">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">当前用户</h4>
            <DataDisplay {...currentUser} onRefetch={currentUser.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">用户资料</h4>
            <DataDisplay {...userProfile} onRefetch={userProfile.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">溯源列表</h4>
            <DataDisplay {...traces} onRefetch={traces.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">溯源详情</h4>
            <DataDisplay {...traceDetail} onRefetch={traceDetail.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">产品列表</h4>
            <DataDisplay {...products} onRefetch={products.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">产品详情</h4>
            <DataDisplay {...productDetail} onRefetch={productDetail.refetch} />
          </div>
        </div>
      </TestSection>

      {/* MVP核心功能 - 养殖管理测试 */}
      <TestSection title="MVP核心功能 - 养殖管理">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium mb-2">养殖批次列表</h4>
            <DataDisplay {...farmingBatches} onRefetch={farmingBatches.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">批次详情</h4>
            <DataDisplay {...farmingBatchDetail} onRefetch={farmingBatchDetail.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">环境数据</h4>
            <DataDisplay {...environmentData} onRefetch={environmentData.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">健康指标</h4>
            <DataDisplay {...healthMetrics} onRefetch={healthMetrics.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">疫苗记录</h4>
            <DataDisplay {...vaccineRecords} onRefetch={vaccineRecords.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">繁育信息</h4>
            <DataDisplay {...breedingInfo} onRefetch={breedingInfo.refetch} />
          </div>
        </div>
      </TestSection>

      {/* MVP核心功能 - 生产加工测试 */}
      <TestSection title="MVP核心功能 - 生产加工">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium mb-2">质量报告</h4>
            <DataDisplay {...qualityReports} onRefetch={qualityReports.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">生产计划</h4>
            <DataDisplay {...productionSchedule} onRefetch={productionSchedule.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">设备状态</h4>
            <DataDisplay {...equipmentStatus} onRefetch={equipmentStatus.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">加工记录</h4>
            <DataDisplay {...processingRecords} onRefetch={processingRecords.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">包装信息</h4>
            <DataDisplay {...packagingInfo} onRefetch={packagingInfo.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">温度日志</h4>
            <DataDisplay {...temperatureLogs} onRefetch={temperatureLogs.refetch} />
          </div>
        </div>
      </TestSection>

      {/* MVP关键功能 - AI数据分析测试 */}
      <TestSection title="MVP关键功能 - AI数据分析">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">生产数据洞察</h4>
            <DataDisplay {...productionInsights} onRefetch={productionInsights.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">优化建议</h4>
            <DataDisplay {...optimizationSuggestions} onRefetch={optimizationSuggestions.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">预测分析</h4>
            <DataDisplay {...predictiveAnalysis} onRefetch={predictiveAnalysis.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">数据聚合</h4>
            <DataDisplay {...dataAggregation} onRefetch={dataAggregation.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">实时分析</h4>
            <DataDisplay {...realtimeAnalysis} onRefetch={realtimeAnalysis.refetch} />
          </div>
        </div>
      </TestSection>

      {/* 批量数据处理测试 */}
      <TestSection title="批量数据处理">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">批量历史数据</h4>
            <DataDisplay {...batchHistoricalData} onRefetch={batchHistoricalData.refetch} />
          </div>
          <div>
            <h4 className="font-medium mb-2">数据预处理</h4>
            <DataDisplay {...dataPreprocessing} onRefetch={dataPreprocessing.refetch} />
          </div>
        </div>
      </TestSection>
    </div>
  );
} 