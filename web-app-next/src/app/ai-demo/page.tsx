/**
 * AI数据分析演示页面 (简化版)
 *
 * 展示TASK-P3-016B实现的AI数据分析API优化与智能缓存功能
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

// 模拟AI分析结果
const generateMockAiResult = (scenario: string) => ({
  scenario,
  timestamp: new Date().toISOString(),
  analysis: {
    confidence: (Math.random() * 30 + 70).toFixed(1),
    recommendations: [
      `基于${scenario}数据分析，建议优化策略A`,
      `检测到${scenario}关键指标异常，建议采取措施B`,
      `预测${scenario}未来趋势，建议调整参数C`
    ],
    metrics: {
      efficiency: (Math.random() * 20 + 80).toFixed(1),
      quality: (Math.random() * 15 + 85).toFixed(1),
      risk: (Math.random() * 30 + 10).toFixed(1)
    }
  },
  cacheInfo: {
    cached: Math.random() > 0.5,
    source: Math.random() > 0.5 ? 'L1缓存' : 'L2缓存',
    responseTime: Math.floor(Math.random() * 500 + 100)
  }
});

// AI分析场景
const AI_SCENARIOS = [
  { id: 'farming', name: '🌱 农业数据分析', desc: '作物生长、土壤质量、气候预测' },
  { id: 'logistics', name: '🚛 物流优化分析', desc: '路线规划、库存管理、配送效率' },
  { id: 'processing', name: '🏭 加工质量分析', desc: '质量检测、工艺优化、风险评估' },
  { id: 'trace', name: '🔍 溯源预测分析', desc: '链路追踪、异常检测、合规分析' },
  { id: 'analytics', name: '📊 综合数据分析', desc: '多维度分析、趋势预测、决策支持' }
];

export default function AiDemoPage() {
  const [selectedScenario, setSelectedScenario] = useState(AI_SCENARIOS[0].id);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);

  // 执行单个AI分析
  const handleSingleAnalysis = async () => {
    setLoading(true);

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = generateMockAiResult(selectedScenario);
    setAnalysisResult(result);
    setLoading(false);
  };

  // 执行批量AI分析
  const handleBatchAnalysis = async () => {
    setLoading(true);

    // 模拟批量API调用
    await new Promise(resolve => setTimeout(resolve, 2500));

    const results = AI_SCENARIOS.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      result: generateMockAiResult(scenario.id),
      success: Math.random() > 0.1 // 90%成功率
    }));

    setBatchResults(results);
    setLoading(false);
  };

  const selectedScenarioInfo = AI_SCENARIOS.find(s => s.id === selectedScenario);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-[390px]">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI数据分析系统演示
          </h1>
          <p className="text-gray-600">
            TASK-P3-016B: AI数据分析API优化与智能缓存功能展示
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
            <div className="text-sm text-blue-800">
              ✅ 智能缓存系统 | ✅ 批量处理优化 | ✅ 错误处理增强 | ✅ 性能监控
            </div>
          </div>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI分析控制面板</h2>

          <div className="space-y-6">
            {/* 场景选择 */}
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-3">
                  选择AI分析场景
                </legend>
                <div className="space-y-2" role="radiogroup" aria-label="AI分析场景选择">
                {AI_SCENARIOS.map((scenario) => (
                  <label key={scenario.id} className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value={scenario.id}
                      checked={selectedScenario === scenario.id}
                      onChange={(e) => setSelectedScenario(e.target.value)}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{scenario.name}</div>
                      <div className="text-xs text-gray-500">{scenario.desc}</div>
                    </div>
                  </label>
                                  ))}
                </div>
              </fieldset>
            </div>

            {/* 操作按钮 */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">执行AI分析</h3>
                <div className="space-y-3">
                  <Button
                    onClick={handleSingleAnalysis}
                    variant="primary"
                    className="w-full"
                    disabled={loading}
                    aria-label={`执行${selectedScenarioInfo?.name}AI分析`}
                  >
                    {loading ? '分析中...' : `执行 ${selectedScenarioInfo?.name}`}
                  </Button>

                  <Button
                    onClick={handleBatchAnalysis}
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                    aria-label="执行全部AI分析场景的批量分析"
                  >
                    {loading ? '批量分析中...' : '执行全场景批量分析'}
                  </Button>
                </div>
              </div>

              {/* 功能特性展示 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-800 mb-2">核心功能特性</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">L1/L2双层缓存系统</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">智能批量请求处理</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-600">熔断器错误处理</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-600">实时性能监控</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 结果展示区域 */}
        <div className="space-y-8">

          {/* 单个分析结果 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI分析结果
            </h3>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">AI分析中...</span>
              </div>
            )}

            {analysisResult && !loading && (
              <div className="space-y-4">
                {/* 分析概览 */}
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <div className="text-green-800 text-sm font-medium">✅ 分析完成</div>
                    <div className="text-xs text-green-600">
                      置信度: {analysisResult.analysis.confidence}%
                    </div>
                  </div>
                </div>

                {/* 性能指标 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {analysisResult.analysis.metrics.efficiency}%
                    </div>
                    <div className="text-xs text-blue-600">效率评分</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {analysisResult.analysis.metrics.quality}%
                    </div>
                    <div className="text-xs text-green-600">质量评分</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold text-red-600">
                      {analysisResult.analysis.metrics.risk}%
                    </div>
                    <div className="text-xs text-red-600">风险评估</div>
                  </div>
                </div>

                {/* 建议列表 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-800 mb-2">AI建议</h4>
                  <div className="space-y-2">
                    {analysisResult.analysis.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                        {index + 1}. {rec}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 缓存信息 */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="text-xs text-blue-800">
                    💾 缓存状态: {analysisResult.cacheInfo.cached ? '命中' : '未命中'} |
                    来源: {analysisResult.cacheInfo.source} |
                    响应时间: {analysisResult.cacheInfo.responseTime}ms
                  </div>
                </div>
              </div>
            )}

            {!analysisResult && !loading && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">🤖</div>
                <div>选择场景并点击&ldquo;执行AI分析&rdquo;开始</div>
              </div>
            )}
          </div>

          {/* 批量分析结果 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">批量分析结果</h3>

            {batchResults.length > 0 && !loading && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="text-green-800 text-sm font-medium">
                    ✅ 批量分析完成 ({batchResults.filter(r => r.success).length}/{batchResults.length} 成功)
                  </div>
                </div>

                <div className="space-y-3">
                  {batchResults.map((result) => (
                    <div key={result.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {result.name}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          result.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {result.success ? '成功' : '失败'}
                        </span>
                      </div>

                      {result.success && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{result.result.analysis.metrics.efficiency}%</div>
                            <div className="text-gray-500">效率</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{result.result.analysis.metrics.quality}%</div>
                            <div className="text-gray-500">质量</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-red-600">{result.result.analysis.metrics.risk}%</div>
                            <div className="text-gray-500">风险</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {batchResults.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <div>点击&ldquo;执行全场景批量分析&rdquo;开始</div>
              </div>
            )}
          </div>
        </div>

        {/* 技术架构说明 */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">TASK-P3-016B技术架构</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-2xl mb-2">🧠</div>
              <div className="text-sm font-medium text-blue-800">智能缓存管理</div>
              <div className="text-xs text-blue-600 mt-1">
                L1内存 + L2本地存储<br/>
                四种AI缓存策略
              </div>
            </div>

            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-sm font-medium text-green-800">批量处理优化</div>
              <div className="text-xs text-green-600 mt-1">
                6并发限制<br/>
                优先队列 + 去重
              </div>
            </div>

            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <div className="text-2xl mb-2">🛡️</div>
              <div className="text-sm font-medium text-purple-800">错误处理增强</div>
              <div className="text-xs text-purple-600 mt-1">
                熔断器模式<br/>
                优雅降级策略
              </div>
            </div>

            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
              <div className="text-2xl mb-2">📈</div>
              <div className="text-sm font-medium text-yellow-800">性能监控</div>
              <div className="text-xs text-yellow-600 mt-1">
                实时指标收集<br/>
                系统健康评分
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
