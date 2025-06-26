'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Loading } from '@/components/ui';

// 数据录入表单接口
interface DataEntry {
  type: string;
  category: string;
  value: number | string;
  unit: string;
  location: string;
  note: string;
  timestamp: string;
}

export default function ManualCollectionPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DataEntry>({
    type: '',
    category: '',
    value: '',
    unit: '',
    location: '',
    note: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });

  // 数据类型选项
  const dataTypes = [
    { id: 'soil', name: '土壤数据', icon: '🌱', categories: ['pH值', '湿度', '有机质', '氮磷钾'] },
    { id: 'weather', name: '气象数据', icon: '🌤️', categories: ['温度', '湿度', '风速', '降雨量'] },
    { id: 'crop', name: '作物数据', icon: '🌾', categories: ['生长高度', '叶片数量', '病虫害', '产量'] },
    { id: 'water', name: '水质数据', icon: '💧', categories: ['pH值', '溶解氧', '浊度', '重金属'] }
  ];

  // 单位选项
  const getUnitsForCategory = (category: string) => {
    const unitMap: { [key: string]: string[] } = {
      'pH值': ['pH'],
      '湿度': ['%'],
      '有机质': ['g/kg'],
      '氮磷钾': ['mg/kg'],
      '温度': ['°C'],
      '风速': ['m/s'],
      '降雨量': ['mm'],
      '生长高度': ['cm'],
      '叶片数量': ['片'],
      '病虫害': ['级'],
      '产量': ['kg'],
      '溶解氧': ['mg/L'],
      '浊度': ['NTU'],
      '重金属': ['mg/kg']
    };
    return unitMap[category] || [''];
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 模拟API提交
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 成功提示和跳转
      alert('数据录入成功！');
      router.back();
    } catch (error) {
      console.error('数据提交失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        return formData.type && formData.category;
      case 2:
        return formData.value && formData.unit;
      case 3:
        return formData.location;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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
              <h1 className="text-lg font-semibold text-gray-900">手动录入数据</h1>
            </div>
            <span className="text-sm text-gray-500">{currentStep}/4</span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full ${
                  step <= currentStep
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>选择类型</span>
            <span>输入数值</span>
            <span>位置信息</span>
            <span>确认提交</span>
          </div>
        </div>

        <div className="p-4">
          {/* 步骤1: 选择数据类型 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">选择数据类型</h2>
                <p className="text-gray-600 text-sm">请选择要录入的数据类型和分类</p>
              </div>

              <div className="space-y-3">
                {dataTypes.map((type) => (
                  <Card key={type.id} className={`p-4 cursor-pointer transition-all ${
                    formData.type === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFormData({...formData, type: type.id, category: ''})}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{type.name}</h3>
                        <p className="text-sm text-gray-600">
                          {type.categories.join(', ')}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {formData.type && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    具体分类
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value, unit: ''})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择分类</option>
                    {dataTypes.find(t => t.id === formData.type)?.categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 步骤2: 输入数值 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">输入数值</h2>
                <p className="text-gray-600 text-sm">请输入 {formData.category} 的具体数值</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    数值
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    placeholder="请输入数值"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    单位
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">选择单位</option>
                    {getUnitsForCategory(formData.category).map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    测量时间
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.timestamp}
                    onChange={(e) => setFormData({...formData, timestamp: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 步骤3: 位置信息 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">位置信息</h2>
                <p className="text-gray-600 text-sm">请标注数据采集的具体位置</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    位置标识
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="如：A区1号田地、温室2号、仓库东南角等"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    备注 (可选)
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                    placeholder="记录特殊情况、测量条件等"
                  />
                </div>

                <Card className="p-3 bg-blue-50 border-blue-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600">📍</span>
                    <span className="text-sm text-blue-800">
                      建议使用GPS定位获取精确坐标
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* 步骤4: 确认提交 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">确认提交</h2>
                <p className="text-gray-600 text-sm">请确认录入信息是否正确</p>
              </div>

              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">数据类型</span>
                    <span className="text-gray-900">
                      {dataTypes.find(t => t.id === formData.type)?.name} - {formData.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">数值</span>
                    <span className="text-gray-900 font-semibold">
                      {formData.value} {formData.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">位置</span>
                    <span className="text-gray-900">{formData.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">时间</span>
                    <span className="text-gray-900">
                      {new Date(formData.timestamp).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  {formData.note && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-gray-600 block mb-1">备注</span>
                      <span className="text-gray-900 text-sm">{formData.note}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* 底部按钮 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-[390px] mx-auto flex space-x-3">
              {currentStep > 1 && (
                <Button
                  variant="secondary"
                  onClick={prevStep}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  上一步
                </Button>
              )}

              {currentStep < 4 ? (
                <Button
                  onClick={nextStep}
                  disabled={!validateStep(currentStep)}
                  className="flex-1"
                >
                  下一步
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? <Loading size="sm" /> : '提交数据'}
                </Button>
              )}
            </div>
          </div>

          {/* 底部占位 */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
