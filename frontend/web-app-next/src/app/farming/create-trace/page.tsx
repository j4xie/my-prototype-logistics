'use client';

import { useState } from 'react';
import { Card, Button, Input, Select, PageLayout, Badge } from '@/components/ui';

export default function CreateTracePage() {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    productType: '',
    farm: '',
    farmer: '',
    breed: '',
    birthDate: '',
    feedType: '',
    growthPeriod: 0,
    slaughterDate: '',
    processingLocation: '',
    temperature: 0,
    hygieneCertificate: '',
    healthCheck: false,
    qualityGrade: '',
    packageDate: '',
    packageType: '',
    weight: 0,
    expiryDate: ''
  });

  const steps = [
    { id: 1, title: '基本信息', desc: '产品和农场' },
    { id: 2, title: '养殖记录', desc: '养殖过程' },
    { id: 3, title: '加工记录', desc: '屠宰加工' },
    { id: 4, title: '质量检测', desc: '质量认证' },
    { id: 5, title: '包装配送', desc: '包装信息' }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateBatchNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TR${date}${random}`;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const batchNumber = generateBatchNumber();
      console.log('创建溯源记录:', { ...formData, batchNumber });
      alert(`溯源记录创建成功！\n批次号: ${batchNumber}`);
      setCurrentStep(1);
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">基本信息</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                产品类型 *
              </label>
              <Select
                value={formData.productType}
                onChange={(value) => handleInputChange('productType', value)}
                placeholder="选择产品类型"
                options={[
                  { value: "黑猪肉", label: "黑猪肉" },
                  { value: "牛肉", label: "牛肉" },
                  { value: "羊肉", label: "羊肉" },
                  { value: "鸡肉", label: "鸡肉" }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                农场 *
              </label>
              <Select
                value={formData.farm}
                onChange={(value) => handleInputChange('farm', value)}
                placeholder="选择农场"
                options={[
                  { value: "优质农场合作社", label: "优质农场合作社" },
                  { value: "黑猪养殖专业合作社", label: "黑猪养殖专业合作社" },
                  { value: "绿色有机农场", label: "绿色有机农场" },
                  { value: "山地牧场", label: "山地牧场" }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                养殖员 *
              </label>
              <Input
                value={formData.farmer}
                onChange={(e) => handleInputChange('farmer', e.target.value)}
                placeholder="输入养殖员姓名"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">养殖记录</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                品种 *
              </label>
              <Input
                value={formData.breed}
                onChange={(e) => handleInputChange('breed', e.target.value)}
                placeholder="输入品种名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出生日期 *
              </label>
              <Input
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleInputChange('birthDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                饲料类型 *
              </label>
              <Select
                value={formData.feedType}
                onChange={(value) => handleInputChange('feedType', value)}
                placeholder="选择饲料类型"
                options={[
                  { value: "有机玉米饲料", label: "有机玉米饲料" },
                  { value: "天然草料", label: "天然草料" },
                  { value: "混合营养饲料", label: "混合营养饲料" },
                  { value: "绿色无污染饲料", label: "绿色无污染饲料" }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生长周期 (天) *
              </label>
              <Input
                type="number"
                value={formData.growthPeriod}
                onChange={(e) => handleInputChange('growthPeriod', parseInt(e.target.value))}
                placeholder="输入生长周期"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">加工记录</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                屠宰日期 *
              </label>
              <Input
                type="date"
                value={formData.slaughterDate}
                onChange={(e) => handleInputChange('slaughterDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                加工地点 *
              </label>
              <Input
                value={formData.processingLocation}
                onChange={(e) => handleInputChange('processingLocation', e.target.value)}
                placeholder="输入加工地点"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">质量检测</h3>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="healthCheck"
                checked={formData.healthCheck}
                onChange={(e) => handleInputChange('healthCheck', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="healthCheck" className="text-sm font-medium text-gray-700">
                已通过健康检查
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                质量等级 *
              </label>
              <Select
                value={formData.qualityGrade}
                onChange={(value) => handleInputChange('qualityGrade', value)}
                placeholder="选择质量等级"
                options={[
                  { value: "特级", label: "特级" },
                  { value: "一级", label: "一级" },
                  { value: "二级", label: "二级" },
                  { value: "合格", label: "合格" }
                ]}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">包装配送</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                包装日期 *
              </label>
              <Input
                type="date"
                value={formData.packageDate}
                onChange={(e) => handleInputChange('packageDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                包装类型 *
              </label>
              <Select
                value={formData.packageType}
                onChange={(value) => handleInputChange('packageType', value)}
                placeholder="选择包装类型"
                options={[
                  { value: "真空包装", label: "真空包装" },
                  { value: "冷冻包装", label: "冷冻包装" },
                  { value: "保鲜包装", label: "保鲜包装" },
                  { value: "托盘包装", label: "托盘包装" }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                净重 (kg) *
              </label>
              <Input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', parseFloat(e.target.value))}
                placeholder="输入净重"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <PageLayout>
      <div className="max-w-[390px] mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">创建溯源记录</h1>
          <p className="text-gray-600 mt-1">建立完整的产品溯源档案</p>
        </div>

        <div className="mb-6 relative">
          <div className="flex justify-between items-center">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step.id}
                </div>
                <div className="text-xs text-center mt-1">
                  <div className="font-medium text-gray-900">{step.title}</div>
                  <div className="text-gray-500">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-4 mb-6">
          {renderStepContent()}
        </Card>

        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            上一步
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            >
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '创建中...' : '创建溯源记录'}
            </Button>
          )}
        </div>

        <div className="mt-4 text-center">
          <Badge variant="default">
            第 {currentStep} 步，共 {steps.length} 步
          </Badge>
        </div>
      </div>
    </PageLayout>
  );
}
