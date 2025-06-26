'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading, Input, Select } from '@/components/ui';

// 配置数据接口
interface PredictionConfig {
  id: string;
  name: string;
  type: 'yield' | 'disease' | 'weather' | 'quality';
  algorithm: string;
  status: 'active' | 'training' | 'inactive';
  accuracy: number;
  lastTrained: string;
  parameters: {
    learningRate: number;
    epochs: number;
    batchSize: number;
    validationSplit: number;
    features: string[];
  };
  dataSource: {
    tables: string[];
    dateRange: string;
    recordCount: number;
  };
}

// Mock 配置数据
const mockConfigs: PredictionConfig[] = [
  {
    id: '1',
    name: '白菜产量预测',
    type: 'yield',
    algorithm: 'LSTM神经网络',
    status: 'active',
    accuracy: 87.5,
    lastTrained: '2025-02-01',
    parameters: {
      learningRate: 0.001,
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      features: ['温度', '湿度', '光照', '土壤pH', '施肥量']
    },
    dataSource: {
      tables: ['环境数据', '种植记录', '产量记录'],
      dateRange: '2024-01-01 至 2025-01-31',
      recordCount: 15680
    }
  },
  {
    id: '2',
    name: '病害风险评估',
    type: 'disease',
    algorithm: '随机森林',
    status: 'training',
    accuracy: 92.1,
    lastTrained: '2025-01-28',
    parameters: {
      learningRate: 0.01,
      epochs: 150,
      batchSize: 64,
      validationSplit: 0.25,
      features: ['湿度', '温度', '通风', '密度', '历史病害']
    },
    dataSource: {
      tables: ['病害记录', '环境监测', '种植密度'],
      dateRange: '2023-06-01 至 2025-01-28',
      recordCount: 8924
    }
  }
];

const algorithmOptions = [
  { value: 'lstm', label: 'LSTM神经网络' },
  { value: 'random_forest', label: '随机森林' },
  { value: 'svm', label: '支持向量机' },
  { value: 'xgboost', label: 'XGBoost' },
  { value: 'linear_regression', label: '线性回归' }
];

const predictionTypes = [
  { value: 'yield', label: '产量预测', icon: '🌾' },
  { value: 'disease', label: '病害预测', icon: '🦠' },
  { value: 'weather', label: '天气预测', icon: '🌤️' },
  { value: 'quality', label: '品质预测', icon: '⭐' }
];

export default function PredictionConfigPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<PredictionConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PredictionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<PredictionConfig>>({});

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1200));
        setConfigs(mockConfigs);
        setSelectedConfig(mockConfigs[0]);
      } catch (error) {
        console.error('获取配置失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  const startTraining = async (configId: string) => {
    setIsTraining(true);
    try {
      // 更新状态为训练中
      setConfigs(prev => prev.map(config =>
        config.id === configId
          ? { ...config, status: 'training' as const }
          : config
      ));

      await new Promise(resolve => setTimeout(resolve, 5000));

      // 模拟训练完成
      setConfigs(prev => prev.map(config =>
        config.id === configId
          ? {
              ...config,
              status: 'active' as const,
              accuracy: Math.round((config.accuracy + Math.random() * 5) * 10) / 10,
              lastTrained: new Date().toISOString().split('T')[0]
            }
          : config
      ));

      alert('模型训练完成！');
    } catch (error) {
      console.error('训练失败:', error);
      alert('训练失败，请重试');
    } finally {
      setIsTraining(false);
    }
  };

  const saveConfig = async () => {
    try {
      if (editingConfig.id) {
        // 更新现有配置
        setConfigs(prev => prev.map(config =>
          config.id === editingConfig.id
            ? { ...config, ...editingConfig }
            : config
        ));
      } else {
        // 创建新配置
        const newConfig: PredictionConfig = {
          id: Date.now().toString(),
          name: editingConfig.name || '新预测模型',
          type: editingConfig.type || 'yield',
          algorithm: editingConfig.algorithm || 'lstm',
          status: 'inactive',
          accuracy: 0,
          lastTrained: '',
          parameters: {
            learningRate: 0.001,
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            features: []
          },
          dataSource: {
            tables: [],
            dateRange: '',
            recordCount: 0
          }
        };
        setConfigs(prev => [...prev, newConfig]);
      }

      setShowCreateForm(false);
      setEditingConfig({});
      alert('配置已保存！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'training': return 'text-blue-600 bg-blue-50';
      case 'inactive': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '运行中';
      case 'training': return '训练中';
      case 'inactive': return '未激活';
      default: return '未知';
    }
  };

  const getTypeIcon = (type: string) => {
    const typeObj = predictionTypes.find(t => t.value === type);
    return typeObj?.icon || '🤖';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载预测配置..." />
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
              <h1 className="text-lg font-semibold text-gray-900">预测配置</h1>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setShowCreateForm(true)}
            >
              ➕
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 创建/编辑表单 */}
          {showCreateForm && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                {editingConfig.id ? '编辑配置' : '新建配置'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
                  <Input
                    value={editingConfig.name || ''}
                    onChange={(e) => setEditingConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入模型名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">预测类型</label>
                  <Select
                    value={editingConfig.type || 'yield'}
                    onChange={(value) => setEditingConfig(prev => ({ ...prev, type: value as any }))}
                    options={predictionTypes.map(type => ({
                      value: type.value,
                      label: `${type.icon} ${type.label}`
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">算法选择</label>
                  <Select
                    value={editingConfig.algorithm || 'lstm'}
                    onChange={(value) => setEditingConfig(prev => ({ ...prev, algorithm: value }))}
                    options={algorithmOptions}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button onClick={saveConfig} className="flex-1">
                    保存
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingConfig({});
                    }}
                    className="flex-1"
                  >
                    取消
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 配置列表 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">模型配置</h2>
              <Badge className="text-blue-600 bg-blue-50">
                {configs.length} 个模型
              </Badge>
            </div>

            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedConfig?.id === config.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedConfig(config)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getTypeIcon(config.type)}</span>
                      <h3 className="font-semibold text-gray-900">{config.name}</h3>
                    </div>
                    <Badge className={getStatusColor(config.status)}>
                      {getStatusText(config.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{config.algorithm}</span>
                    {config.accuracy > 0 && (
                      <span className="text-gray-900 font-medium">准确率: {config.accuracy}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 详细配置 */}
          {selectedConfig && (
            <>
              {/* 基本信息 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">基本信息</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">模型类型</p>
                      <p className="font-medium text-gray-900">
                        {getTypeIcon(selectedConfig.type)} {predictionTypes.find(t => t.value === selectedConfig.type)?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">算法</p>
                      <p className="font-medium text-gray-900">{selectedConfig.algorithm}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">最后训练</p>
                      <p className="font-medium text-gray-900">
                        {selectedConfig.lastTrained || '从未训练'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">模型准确率</p>
                      <p className="font-medium text-gray-900">
                        {selectedConfig.accuracy > 0 ? `${selectedConfig.accuracy}%` : '未测试'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 参数配置 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">训练参数</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">学习率</p>
                      <p className="font-medium text-gray-900">{selectedConfig.parameters.learningRate}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">训练轮次</p>
                      <p className="font-medium text-gray-900">{selectedConfig.parameters.epochs}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">批次大小</p>
                      <p className="font-medium text-gray-900">{selectedConfig.parameters.batchSize}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">验证比例</p>
                      <p className="font-medium text-gray-900">{(selectedConfig.parameters.validationSplit * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-2">特征变量</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedConfig.parameters.features.map((feature, index) => (
                        <Badge key={index} className="text-xs text-blue-600 bg-blue-50">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 数据源 */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">数据源</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-600 mb-2">数据表</p>
                    <div className="space-y-1">
                      {selectedConfig.dataSource.tables.map((table, index) => (
                        <div key={index} className="text-sm text-gray-900">• {table}</div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">时间范围</p>
                      <p className="font-medium text-gray-900">{selectedConfig.dataSource.dateRange}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">记录数量</p>
                      <p className="font-medium text-gray-900">{selectedConfig.dataSource.recordCount.toLocaleString()} 条</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 操作按钮 */}
              <div className="space-y-3">
                <div className="flex space-x-3">
                  <Button
                    onClick={() => startTraining(selectedConfig.id)}
                    disabled={isTraining || selectedConfig.status === 'training'}
                    className="flex-1"
                  >
                    {isTraining || selectedConfig.status === 'training' ? (
                      <>
                        <Loading size="sm" />
                        <span className="ml-2">训练中...</span>
                      </>
                    ) : (
                      '🚀 开始训练'
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingConfig(selectedConfig);
                      setShowCreateForm(true);
                    }}
                    className="flex-1"
                  >
                    ⚙️ 编辑
                  </Button>
                </div>

                <div className="flex space-x-3">
                  <Button variant="secondary" className="flex-1">
                    📊 测试模型
                  </Button>
                  <Button variant="secondary" className="flex-1">
                    📤 导出配置
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* 使用提示 */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">配置说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 新建模型需要先配置参数再开始训练</p>
              <p>• 训练时间取决于数据量和算法复杂度</p>
              <p>• 建议定期重新训练以保持模型准确性</p>
              <p>• 可通过调整参数来优化模型性能</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
