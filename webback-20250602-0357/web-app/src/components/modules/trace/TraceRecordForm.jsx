import React, { useState, useEffect } from 'react';
import { 
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  Loading
} from '@/components/ui';

/**
 * 溯源记录表单组件 - React现代化版本
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const TraceRecordForm = ({ 
  initialData = null,
  mode = 'create', // 'create', 'edit'
  onSubmit,
  onCancel,
  loading = false,
  productTypes = [],
  locations = [],
  stages = []
}) => {
  const [formData, setFormData] = useState({
    productName: '',
    productType: '',
    batchNumber: '',
    stage: '',
    location: '',
    description: '',
    handlerName: '',
    attachments: [],
    status: 'draft'
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 默认选项数据
  const defaultProductTypes = [
    { value: 'meat', label: '肉类' },
    { value: 'poultry', label: '禽类' },
    { value: 'dairy', label: '乳制品' },
    { value: 'fish', label: '水产' },
    { value: 'fruit', label: '水果' },
    { value: 'vegetable', label: '蔬菜' },
    { value: 'grain', label: '谷物' }
  ];

  const defaultStages = [
    { value: 'breeding', label: '养殖' },
    { value: 'processing', label: '加工' },
    { value: 'packaging', label: '包装' },
    { value: 'storage', label: '储存' },
    { value: 'transport', label: '运输' },
    { value: 'retail', label: '零售' }
  ];

  const statusOptions = [
    { value: 'draft', label: '草稿' },
    { value: 'pending', label: '待处理' },
    { value: 'review', label: '审核中' },
    { value: 'completed', label: '已完成' }
  ];

  useEffect(() => {
    if (initialData) {
      setFormData({
        productName: initialData.productName || '',
        productType: initialData.productType || '',
        batchNumber: initialData.batchNumber || '',
        stage: initialData.stage || '',
        location: initialData.location || '',
        description: initialData.description || '',
        handlerName: initialData.handlerName || initialData.handler?.name || '',
        attachments: initialData.attachments || [],
        status: initialData.status || 'draft'
      });
    }
  }, [initialData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.productName.trim()) {
      newErrors.productName = '产品名称不能为空';
    }

    if (!formData.productType) {
      newErrors.productType = '请选择产品类型';
    }

    if (!formData.batchNumber.trim()) {
      newErrors.batchNumber = '批次号不能为空';
    }

    if (!formData.stage) {
      newErrors.stage = '请选择阶段';
    }

    if (!formData.handlerName.trim()) {
      newErrors.handlerName = '操作人不能为空';
    }

    if (formData.description.length > 500) {
      newErrors.description = '描述不能超过500字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submitData = {
        ...formData,
        timestamp: new Date().toISOString(),
        id: initialData?.id || `trace_${Date.now()}`
      };

      if (onSubmit) {
        await onSubmit(submitData);
      }
    } catch (error) {
      console.error('提交失败:', error);
      // 这里可以添加错误提示
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }));

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const getStatusBadgeVariant = (status) => {
    const variants = {
      draft: 'default',
      pending: 'warning',
      review: 'info',
      completed: 'success'
    };
    return variants[status] || 'default';
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 固定顶部导航 - 遵循UI设计系统规则 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between p-4">
          <div className="flex items-center">
            <button
              onClick={handleCancel}
              className="mr-3 text-white hover:text-gray-200"
              aria-label="返回"
              tabIndex="0"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 className="text-lg font-medium">
              {mode === 'create' ? '新建溯源记录' : '编辑溯源记录'}
            </h1>
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 遵循UI设计系统规则 */}
      <div className="pt-[80px] pb-[80px] max-w-[390px] mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 - 使用标准卡片样式 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">基本信息</h3>
            
            <div className="space-y-4">
              <Input
                label="产品名称"
                placeholder="请输入产品名称"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                error={errors.productName}
                required
              />

              <Select
                label="产品类型"
                placeholder="请选择产品类型"
                value={formData.productType}
                onChange={(value) => handleInputChange('productType', value)}
                options={productTypes.length > 0 ? productTypes : defaultProductTypes}
                error={errors.productType}
                required
              />

              {/* 使用grid-cols-2 gap-4布局 */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="批次号"
                  placeholder="请输入批次号"
                  value={formData.batchNumber}
                  onChange={(e) => handleInputChange('batchNumber', e.target.value)}
                  error={errors.batchNumber}
                  required
                />

                <Select
                  label="阶段"
                  placeholder="请选择阶段"
                  value={formData.stage}
                  onChange={(value) => handleInputChange('stage', value)}
                  options={stages.length > 0 ? stages : defaultStages}
                  error={errors.stage}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="位置"
                  placeholder="请输入位置信息"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  error={errors.location}
                />

                <Input
                  label="操作人"
                  placeholder="请输入操作人姓名"
                  value={formData.handlerName}
                  onChange={(e) => handleInputChange('handlerName', e.target.value)}
                  error={errors.handlerName}
                  required
                />
              </div>
            </div>
          </div>

          {/* 详细信息 - 使用标准卡片样式 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">详细信息</h3>
            
            <div className="space-y-4">
              <Textarea
                label="描述"
                placeholder="请输入详细描述信息..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={errors.description}
                rows={4}
                maxLength={500}
              />

              <Select
                label="状态"
                value={formData.status}
                onChange={(value) => handleInputChange('status', value)}
                options={statusOptions}
              />

              {/* 状态预览 */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">当前状态:</span>
                <Badge variant={getStatusBadgeVariant(formData.status)}>
                  {statusOptions.find(opt => opt.value === formData.status)?.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* 附件上传 - 使用标准卡片样式 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">附件</h3>
            
            <div className="space-y-4">
              {/* 文件上传区域 */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                  tabIndex="0"
                  aria-label="上传文件"
                >
                  <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                  <span className="text-sm text-gray-600">
                    点击上传文件或拖拽文件到此处
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    支持图片、PDF、Word、Excel文件
                  </span>
                </label>
              </div>

              {/* 已上传文件列表 */}
              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">已上传文件</h4>
                  <div className="space-y-2">
                    {formData.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <i className="fas fa-paperclip text-[#1890FF] mr-3"></i>
                          <span className="text-sm font-medium truncate">
                            {attachment.name}
                          </span>
                          {attachment.size && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({Math.round(attachment.size / 1024)}KB)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-700 ml-2"
                          aria-label="删除附件"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 - 使用标准卡片样式和grid-cols-2布局 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
                className="w-full"
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full"
              >
                {mode === 'create' ? '创建记录' : '保存修改'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TraceRecordForm; 