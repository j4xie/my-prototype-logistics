'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 预测数据接口
interface PredictionData {
  id: string;
  type: string;
  target: string;
  algorithm: string;
  accuracy: number;
  confidence: number;
  prediction: {
    value: number;
    unit: string;
    timeRange: string;
    trend: 'up' | 'down' | 'stable';
  };
  factors: Array<{
    name: string;
    influence: number;
    description: string;
  }>;
  historicalData: Array<{
    date: string;
    actual: number;
    predicted?: number;
  }>;
}

// Mock 预测数据
const mockPredictionData: PredictionData[] = [
  {
    id: '1',
    type: '产量预测',
    target: '有机白菜',
    algorithm: 'LSTM神经网络',
    accuracy: 87.5,
    confidence: 92.3,
    prediction: {
      value: 2850,
      unit: 'kg',
      timeRange: '未来7天',
      trend: 'up'
    },
    factors: [
      { name: '温度', influence: 0.35, description: '当前温度适宜作物生长' },
      { name: '湿度', influence: 0.28, description: '土壤湿度略偏高' },
      { name: '光照', influence: 0.22, description: '光照时间充足' },
      { name: '营养', influence: 0.15, description: '土壤养分充足' }
    ],
    historicalData: [
      { date: '2025-01-27', actual: 2650, predicted: 2680 },
      { date: '2025-01-28', actual: 2720, predicted: 2700 },
      { date: '2025-01-29', actual: 2780, predicted: 2750 },
      { date: '2025-01-30', actual: 2800, predicted: 2820 },
      { date: '2025-01-31', actual: 2830, predicted: 2850 },
      { date: '2025-02-01', actual: 2850, predicted: 2880 },
      { date: '2025-02-02', actual: 2870, predicted: 2850 }
    ]
  },
  {
    id: '2',
    type: '病害风险',
    target: 'A区田地',
    algorithm: '随机森林',
    accuracy: 92.1,
    confidence: 88.7,
    prediction: {
      value: 15,
      unit: '%',
      timeRange: '未来3天',
      trend: 'down'
    },
    factors: [
      { name: '湿度', influence: 0.42, description: '高湿度增加病害风险' },
      { name: '温度', influence: 0.31, description: '温度变化频繁' },
      { name: '通风', influence: 0.16, description: '通风条件良好' },
      { name: '历史', influence: 0.11, description: '历史病害记录' }
    ],
    historicalData: [
      { date: '2025-01-27', actual: 12, predicted: 10 },
      { date: '2025-01-28', actual: 18, predicted: 15 },
      { date: '2025-01-29', actual: 22, predicted: 20 },
      { date: '2025-01-30', actual: 19, predicted: 18 },
      { date: '2025-01-31', actual: 16, predicted: 17 },
      { date: '2025-02-01', actual: 14, predicted: 15 },
      { date: '2025-02-02', actual: 15, predicted: 14 }
    ]
  }
];

export default function PredictionAnalyticsPage() {
  const router = useRouter();
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchPredictions = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPredictions(mockPredictionData);
        setSelectedPrediction(mockPredictionData[0]);
      } catch (error) {
        console.error('获取预测数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();
  }, []);

  const generateNewPrediction = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      // 模拟生成新的预测结果
      alert('预测分析已更新！');
    } catch (error) {
      console.error('生成预测失败:', error);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600 bg-green-50';
    if (accuracy >= 80) return 'text-blue-600 bg-blue-50';
    if (accuracy >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载预测分析..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[390px] mx-auto bg-white min-h-screen">
        {/* 头部 */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="small"
                onClick={() => router.back()}
                className="p-1"
              >
                ←
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">AI预测分析</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={generateNewPrediction}
              disabled={isGenerating}
            >
              {isGenerating ? <Loading size="sm" /> : '🔄'}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 预测概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">预测概览</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {predictions.length} 个模型
              </Badge>
            </div>

            <div className="space-y-3">
              {predictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedPrediction?.id === prediction.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPrediction(prediction)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{prediction.type}</h3>
                    <Badge className={getAccuracyColor(prediction.accuracy)}>
                      {prediction.accuracy}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{prediction.target}</span>
                    <span className="text-gray-500">{prediction.algorithm}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 详细预测结果 */}
          {selectedPrediction && (
            <>
              {/* 预测值 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">预测结果</h3>
                <div className="text-center py-4">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {selectedPrediction.prediction.value}
                    </span>
                    <span className="text-gray-500">{selectedPrediction.prediction.unit}</span>
                    <span className="text-2xl">{getTrendIcon(selectedPrediction.prediction.trend)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {selectedPrediction.prediction.timeRange} · 置信度 {selectedPrediction.confidence}%
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">模型准确率</p>
                      <p className="font-semibold text-gray-900">{selectedPrediction.accuracy}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">算法</p>
                      <p className="font-semibold text-gray-900">{selectedPrediction.algorithm}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 影响因素 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">影响因素分析</h3>
                <div className="space-y-3">
                  {selectedPrediction.factors.map((factor, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">{factor.name}</span>
                        <span className="text-sm text-gray-600">
                          {(factor.influence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${factor.influence * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{factor.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 历史对比 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">历史预测对比</h3>
                <div className="space-y-2">
                  {selectedPrediction.historicalData.slice(-5).map((data, index) => (
                    <div key={index} className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600">{data.date}</span>
                      <div className="flex space-x-4">
                        <span className="text-gray-900">
                          实际: {data.actual}{selectedPrediction.prediction.unit}
                        </span>
                        {data.predicted && (
                          <span className="text-blue-600">
                            预测: {data.predicted}{selectedPrediction.prediction.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">平均误差</span>
                    <span className="text-gray-900 font-medium">±3.2%</span>
                  </div>
                </div>
              </Card>

              {/* 操作按钮 */}
              <div className="flex space-x-3">
                <Button className="flex-1">
                  📊 导出报告
                </Button>
                <Button variant="secondary" className="flex-1">
                  ⚙️ 调整参数
                </Button>
              </div>
            </>
          )}

          {/* 快速操作 */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">快速操作</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" className="flex flex-col items-center py-4">
                <span className="text-xl mb-1">🎯</span>
                <span className="text-sm">新建预测</span>
              </Button>
              <Button variant="secondary" className="flex flex-col items-center py-4">
                <span className="text-xl mb-1">📈</span>
                <span className="text-sm">趋势分析</span>
              </Button>
              <Button variant="secondary" className="flex flex-col items-center py-4">
                <span className="text-xl mb-1">🔧</span>
                <span className="text-sm">模型管理</span>
              </Button>
              <Button variant="secondary" className="flex flex-col items-center py-4">
                <span className="text-xl mb-1">📋</span>
                <span className="text-sm">历史记录</span>
              </Button>
            </div>
          </Card>

          {/* 使用提示 */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">AI预测说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 预测结果基于历史数据和机器学习算法</p>
              <p>• 置信度越高表示预测结果越可靠</p>
              <p>• 建议结合实际情况进行决策判断</p>
              <p>• 模型会根据新数据持续优化改进</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
