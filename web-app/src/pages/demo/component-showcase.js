import React, { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  Modal,
  Loading,
  PageLayout
} from '../../components/ui';

/**
 * 组件展示页面
 * 演示所有UI组件的功能和用法
 */
const ComponentShowcase = () => {
  // 状态管理
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 选项数据
  const categoryOptions = [
    { value: 'fruit', label: '水果' },
    { value: 'vegetable', label: '蔬菜' },
    { value: 'meat', label: '肉类' },
    { value: 'dairy', label: '乳制品' },
    { value: 'grain', label: '谷物' }
  ];

  // 处理表单变化
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '产品名称不能为空';
    }
    
    if (!formData.category) {
      newErrors.category = '请选择产品类别';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = '产品描述不能为空';
    } else if (formData.description.length < 10) {
      newErrors.description = '产品描述至少需要10个字符';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsLoading(false);
    setIsModalOpen(true);
  };

  // 重置表单
  const handleReset = () => {
    setFormData({
      name: '',
      category: '',
      description: ''
    });
    setErrors({});
  };

  return (
    <PageLayout>
      <div className="space-y-8">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            UI组件展示
          </h1>
          <p className="text-gray-600">
            演示食品溯源系统的标准化UI组件库
          </p>
        </div>

        {/* 按钮组件展示 */}
        <Card title="按钮组件 (Button)">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">不同变体</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">主要按钮</Button>
                <Button variant="secondary">次要按钮</Button>
                <Button variant="success">成功按钮</Button>
                <Button variant="warning">警告按钮</Button>
                <Button variant="danger">危险按钮</Button>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">不同尺寸</h4>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm">小按钮</Button>
                <Button size="md">中按钮</Button>
                <Button size="lg">大按钮</Button>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">特殊状态</h4>
              <div className="flex flex-wrap gap-2">
                <Button loading>加载中</Button>
                <Button disabled>禁用状态</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 表单组件展示 */}
        <Card title="表单组件展示">
          <div className="space-y-6">
            {/* 输入框 */}
            <Input
              label="产品名称"
              value={formData.name}
              onChange={(value) => handleInputChange('name', value)}
              placeholder="请输入产品名称"
              required
              error={errors.name}
            />

            {/* 选择框 */}
            <Select
              label="产品类别"
              value={formData.category}
              onChange={(value) => handleInputChange('category', value)}
              options={categoryOptions}
              placeholder="请选择产品类别"
              required
              error={errors.category}
            />

            {/* 文本域 */}
            <Textarea
              label="产品描述"
              value={formData.description}
              onChange={(value) => handleInputChange('description', value)}
              placeholder="请详细描述产品信息..."
              required
              maxLength={500}
              showCount
              error={errors.description}
            />

            {/* 操作按钮 */}
            <div className="flex space-x-4">
              <Button 
                variant="primary" 
                onClick={handleSubmit}
                loading={isLoading}
              >
                提交表单
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleReset}
                disabled={isLoading}
              >
                重置表单
              </Button>
            </div>
          </div>
        </Card>

        {/* 加载组件展示 */}
        <Card title="加载组件 (Loading)">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">不同类型</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded">
                  <Loading type="spinner" />
                  <p className="text-sm text-gray-600 mt-2">旋转加载</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <Loading type="dots" />
                  <p className="text-sm text-gray-600 mt-2">点状加载</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <Loading type="pulse" />
                  <p className="text-sm text-gray-600 mt-2">脉冲加载</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <Loading type="bars" />
                  <p className="text-sm text-gray-600 mt-2">条状加载</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">带文本</h4>
              <div className="text-center p-4 border rounded">
                <Loading type="spinner" text="正在加载数据..." />
              </div>
            </div>
          </div>
        </Card>

        {/* 卡片组件展示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="基础卡片">
            <p className="text-gray-600">
              这是一个基础的卡片组件，可以包含任意内容。
              支持标题、内容区域和可选的额外操作。
            </p>
          </Card>

          <Card 
            title="带操作的卡片"
            extra={
              <Button size="sm" variant="primary">
                操作按钮
              </Button>
            }
          >
            <p className="text-gray-600">
              这个卡片在标题区域包含了额外的操作按钮，
              适用于需要快速操作的场景。
            </p>
          </Card>
        </div>

        {/* 模态框触发按钮 */}
        <Card title="模态框组件 (Modal)">
          <div className="space-y-4">
            <p className="text-gray-600">
              点击下面的按钮打开模态框，演示模态框的各种功能。
            </p>
            <Button 
              variant="primary" 
              onClick={() => setIsModalOpen(true)}
            >
              打开模态框
            </Button>
          </div>
        </Card>
      </div>

      {/* 成功提交模态框 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="提交成功"
        footer={
          <Button 
            variant="primary" 
            onClick={() => setIsModalOpen(false)}
          >
            确定
          </Button>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            表单提交成功！
          </h3>
          <p className="text-gray-600">
            您的产品信息已成功保存到系统中。
          </p>
          
          {/* 显示提交的数据 */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
            <h4 className="font-medium text-gray-900 mb-2">提交的数据：</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>产品名称：</strong>{formData.name}</p>
              <p><strong>产品类别：</strong>{categoryOptions.find(opt => opt.value === formData.category)?.label}</p>
              <p><strong>产品描述：</strong>{formData.description}</p>
            </div>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
};

export default ComponentShowcase; 