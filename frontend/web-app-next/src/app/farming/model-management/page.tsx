'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 模型数据接口
interface ModelVersion {
  id: string;
  version: string;
  accuracy: number;
  deployedAt: string;
  isActive: boolean;
  size: string;
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    inferenceTime: number;
  };
}

interface AIModel {
  id: string;
  name: string;
  type: 'production' | 'testing' | 'archived';
  category: string;
  description: string;
  currentVersion: string;
  totalVersions: number;
  status: 'active' | 'inactive' | 'error' | 'updating';
  createdAt: string;
  lastUpdated: string;
  usage: {
    dailyPredictions: number;
    monthlyPredictions: number;
    successRate: number;
  };
  versions: ModelVersion[];
}

// Mock 模型数据
const mockModels: AIModel[] = [
  {
    id: '1',
    name: '有机白菜产量预测模型',
    type: 'production',
    category: '产量预测',
    description: '基于环境数据和历史产量预测有机白菜产量',
    currentVersion: 'v2.1.3',
    totalVersions: 8,
    status: 'active',
    createdAt: '2024-06-15',
    lastUpdated: '2025-02-01',
    usage: {
      dailyPredictions: 342,
      monthlyPredictions: 8756,
      successRate: 94.2
    },
    versions: [
      {
        id: '1-3',
        version: 'v2.1.3',
        accuracy: 87.5,
        deployedAt: '2025-02-01',
        isActive: true,
        size: '24.3 MB',
        metrics: {
          precision: 0.89,
          recall: 0.86,
          f1Score: 0.875,
          inferenceTime: 12
        }
      },
      {
        id: '1-2',
        version: 'v2.1.2',
        accuracy: 85.2,
        deployedAt: '2025-01-15',
        isActive: false,
        size: '23.8 MB',
        metrics: {
          precision: 0.87,
          recall: 0.84,
          f1Score: 0.852,
          inferenceTime: 15
        }
      }
    ]
  },
  {
    id: '2',
    name: '病害风险评估模型',
    type: 'production',
    category: '病害预测',
    description: '实时监测环境因素预测农作物病害风险',
    currentVersion: 'v1.5.2',
    totalVersions: 5,
    status: 'active',
    createdAt: '2024-08-20',
    lastUpdated: '2025-01-28',
    usage: {
      dailyPredictions: 156,
      monthlyPredictions: 4234,
      successRate: 91.8
    },
    versions: [
      {
        id: '2-2',
        version: 'v1.5.2',
        accuracy: 92.1,
        deployedAt: '2025-01-28',
        isActive: true,
        size: '18.7 MB',
        metrics: {
          precision: 0.94,
          recall: 0.89,
          f1Score: 0.915,
          inferenceTime: 8
        }
      },
      {
        id: '2-1',
        version: 'v1.5.1',
        accuracy: 90.3,
        deployedAt: '2025-01-10',
        isActive: false,
        size: '17.9 MB',
        metrics: {
          precision: 0.92,
          recall: 0.88,
          f1Score: 0.899,
          inferenceTime: 10
        }
      }
    ]
  },
  {
    id: '3',
    name: '品质评估实验模型',
    type: 'testing',
    category: '品质预测',
    description: '基于图像和传感器数据评估农产品品质',
    currentVersion: 'v0.8.1',
    totalVersions: 3,
    status: 'inactive',
    createdAt: '2025-01-05',
    lastUpdated: '2025-01-30',
    usage: {
      dailyPredictions: 0,
      monthlyPredictions: 245,
      successRate: 76.4
    },
    versions: [
      {
        id: '3-1',
        version: 'v0.8.1',
        accuracy: 76.4,
        deployedAt: '2025-01-30',
        isActive: false,
        size: '31.2 MB',
        metrics: {
          precision: 0.78,
          recall: 0.75,
          f1Score: 0.764,
          inferenceTime: 25
        }
      }
    ]
  }
];

export default function ModelManagementPage() {
  const router = useRouter();
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ModelVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setModels(mockModels);
        setSelectedModel(mockModels[0]);
        setSelectedVersion(mockModels[0].versions[0]);
      } catch (error) {
        console.error('获取模型失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const deployVersion = async (modelId: string, versionId: string) => {
    setIsDeploying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 更新模型状态
      setModels(prev => prev.map(model => {
        if (model.id === modelId) {
          const newVersions = model.versions.map(v => ({
            ...v,
            isActive: v.id === versionId
          }));
          const activeVersion = newVersions.find(v => v.id === versionId);
          return {
            ...model,
            currentVersion: activeVersion?.version || model.currentVersion,
            lastUpdated: new Date().toISOString().split('T')[0],
            status: 'active' as const,
            versions: newVersions
          };
        }
        return model;
      }));

      alert('模型部署成功！');
    } catch (error) {
      console.error('部署失败:', error);
      alert('部署失败，请重试');
    } finally {
      setIsDeploying(false);
    }
  };

  const archiveModel = async (modelId: string) => {
    try {
      setModels(prev => prev.map(model =>
        model.id === modelId
          ? { ...model, type: 'archived' as const, status: 'inactive' as const }
          : model
      ));
      alert('模型已归档');
    } catch (error) {
      console.error('归档失败:', error);
      alert('归档失败，请重试');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'inactive': return 'text-gray-600 bg-gray-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'updating': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'production': return 'text-green-600 bg-green-50';
      case 'testing': return 'text-yellow-600 bg-yellow-50';
      case 'archived': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '运行中';
      case 'inactive': return '未激活';
      case 'error': return '错误';
      case 'updating': return '更新中';
      default: return '未知';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'production': return '生产环境';
      case 'testing': return '测试环境';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载模型管理..." />
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
              <h1 className="text-lg font-semibold text-gray-900">模型管理</h1>
            </div>
            <Button variant="secondary" size="small">
              📊
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 模型概览 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">AI模型</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {models.length} 个模型
              </Badge>
            </div>

            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedModel?.id === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedModel(model);
                    setSelectedVersion(model.versions[0]);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    <div className="flex space-x-1">
                      <Badge className={getTypeColor(model.type)}>
                        {getTypeText(model.type)}
                      </Badge>
                      <Badge className={getStatusColor(model.status)}>
                        {getStatusText(model.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{model.category}</span>
                    <span className="text-gray-500">v{model.currentVersion}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>成功率: {model.usage.successRate}%</span>
                    <span>月预测: {model.usage.monthlyPredictions.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 模型详情 */}
          {selectedModel && (
            <>
              {/* 基本信息 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">模型信息</h3>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{selectedModel.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">创建时间</p>
                      <p className="font-medium text-gray-900">{selectedModel.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">最后更新</p>
                      <p className="font-medium text-gray-900">{selectedModel.lastUpdated}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">当前版本</p>
                      <p className="font-medium text-gray-900">{selectedModel.currentVersion}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">总版本数</p>
                      <p className="font-medium text-gray-900">{selectedModel.totalVersions}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 使用统计 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">使用统计</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{selectedModel.usage.dailyPredictions}</p>
                    <p className="text-xs text-gray-600">今日预测</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{selectedModel.usage.monthlyPredictions.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">月度预测</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{selectedModel.usage.successRate}%</p>
                    <p className="text-xs text-gray-600">成功率</p>
                  </div>
                </div>
              </Card>

              {/* 版本管理 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">版本历史</h3>
                <div className="space-y-3">
                  {selectedModel.versions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedVersion?.id === version.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{version.version}</h4>
                          {version.isActive && (
                            <Badge className="text-green-600 bg-green-50">当前版本</Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-600">{version.accuracy}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>部署: {version.deployedAt}</span>
                        <span>大小: {version.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 版本详情 */}
              {selectedVersion && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">版本详情</h3>
                  <div className="space-y-4">
                    {/* 性能指标 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">性能指标</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">精确率</span>
                          <span className="font-medium text-gray-900">
                            {(selectedVersion.metrics.precision * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">召回率</span>
                          <span className="font-medium text-gray-900">
                            {(selectedVersion.metrics.recall * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">F1分数</span>
                          <span className="font-medium text-gray-900">
                            {selectedVersion.metrics.f1Score.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">推理时间</span>
                          <span className="font-medium text-gray-900">
                            {selectedVersion.metrics.inferenceTime}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="space-y-2">
                      {!selectedVersion.isActive && (
                        <Button
                          onClick={() => deployVersion(selectedModel.id, selectedVersion.id)}
                          disabled={isDeploying}
                          className="w-full"
                        >
                          {isDeploying ? (
                            <>
                              <Loading size="sm" />
                              <span className="ml-2">部署中...</span>
                            </>
                          ) : (
                            '🚀 部署此版本'
                          )}
                        </Button>
                      )}

                      <div className="flex space-x-2">
                        <Button variant="secondary" className="flex-1">
                          📊 性能报告
                        </Button>
                        <Button variant="secondary" className="flex-1">
                          📥 下载模型
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* 模型操作 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">模型操作</h3>
                <div className="space-y-3">
                  <div className="flex space-x-3">
                    <Button variant="secondary" className="flex-1">
                      📈 训练新版本
                    </Button>
                    <Button variant="secondary" className="flex-1">
                      🔧 调整参数
                    </Button>
                  </div>

                  <div className="flex space-x-3">
                    <Button variant="secondary" className="flex-1">
                      📋 导出配置
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => archiveModel(selectedModel.id)}
                    >
                      📦 归档模型
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* 使用提示 */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">管理说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 生产环境模型支持实时预测功能</p>
              <p>• 测试环境用于验证新模型性能</p>
              <p>• 建议定期备份重要模型版本</p>
              <p>• 归档不再使用的模型释放资源</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
