'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { platformApi, CreateFactoryRequest } from '@/lib/api/platform';
import type { SubscriptionPlan } from '@/mocks/data/platform-data';

interface CreateFactoryModalProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * 创建工厂模态框组件
 * 支持新建工厂的表单输入和提交
 */
export default function CreateFactoryModal({ onSuccess, onCancel }: CreateFactoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateFactoryRequest>({
    name: '',
    industry: '',
    address: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    subscriptionPlan: 'basic' as SubscriptionPlan,
    employeeCount: 1
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateFactoryRequest, string>>>({});

  // 打开/关闭对话框
  const handleOpen = () => {
    setIsOpen(true);
    // 重置表单
    setFormData({
      name: '',
      industry: '',
      address: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      subscriptionPlan: 'basic' as SubscriptionPlan,
      employeeCount: 1
    });
    setErrors({});
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel?.();
  };

    // 表单输入处理
  const handleInputChange = (field: keyof CreateFactoryRequest) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    let value: any = e.target.value;

    if (field === 'employeeCount') {
      value = parseInt(e.target.value) || 1;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    } as CreateFactoryRequest));

    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateFactoryRequest, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入工厂名称';
    }
    if (!formData.industry.trim()) {
      newErrors.industry = '请输入所属行业';
    }
    if (!formData.address.trim()) {
      newErrors.address = '请输入工厂地址';
    }
    if (!formData.contactName.trim()) {
      newErrors.contactName = '请输入联系人姓名';
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = '请输入联系电话';
    } else if (!/^1[3-9]\d{9}$/.test(formData.contactPhone)) {
      newErrors.contactPhone = '请输入正确的手机号码';
    }
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = '请输入联系邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = '请输入正确的邮箱地址';
    }
    if (formData.employeeCount < 1) {
      newErrors.employeeCount = '员工数量必须大于0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      await platformApi.factory.createFactory(formData);

      alert('工厂创建成功！');
      setIsOpen(false);
      onSuccess?.();
    } catch (err) {
      console.error('创建工厂失败:', err);
      alert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 触发按钮 */}
      <Button
        variant="primary"
        onClick={handleOpen}
        className="flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        新建工厂
      </Button>

      {/* 模态框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={handleClose}
          />

          {/* 对话框内容 */}
          <Card className="relative w-full max-w-md mx-4 bg-white max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>新建工厂</CardTitle>
              <Button
                variant="ghost"
                size="small"
                className="h-8 w-8 p-0"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 工厂名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工厂名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={handleInputChange('name')}
                    placeholder="请输入工厂名称"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                {/* 所属行业 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属行业 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.industry}
                    onChange={handleInputChange('industry')}
                    placeholder="如：食品加工、农产品加工等"
                    className={errors.industry ? 'border-red-500' : ''}
                  />
                  {errors.industry && (
                    <p className="text-sm text-red-500 mt-1">{errors.industry}</p>
                  )}
                </div>

                {/* 工厂地址 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工厂地址 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.address}
                    onChange={handleInputChange('address')}
                    placeholder="请输入详细地址"
                    className={errors.address ? 'border-red-500' : ''}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500 mt-1">{errors.address}</p>
                  )}
                </div>

                {/* 负责人姓名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    负责人姓名 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.contactName}
                    onChange={handleInputChange('contactName')}
                    placeholder="请输入负责人姓名"
                    className={errors.contactName ? 'border-red-500' : ''}
                  />
                  {errors.contactName && (
                    <p className="text-sm text-red-500 mt-1">{errors.contactName}</p>
                  )}
                </div>

                {/* 联系电话 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    联系电话 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.contactPhone}
                    onChange={handleInputChange('contactPhone')}
                    placeholder="请输入手机号码"
                    className={errors.contactPhone ? 'border-red-500' : ''}
                  />
                  {errors.contactPhone && (
                    <p className="text-sm text-red-500 mt-1">{errors.contactPhone}</p>
                  )}
                </div>

                {/* 联系邮箱 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    联系邮箱 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={formData.contactEmail}
                    onChange={handleInputChange('contactEmail')}
                    placeholder="请输入邮箱地址"
                    className={errors.contactEmail ? 'border-red-500' : ''}
                  />
                  {errors.contactEmail && (
                    <p className="text-sm text-red-500 mt-1">{errors.contactEmail}</p>
                  )}
                </div>

                {/* 员工数量 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    员工数量 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.employeeCount.toString()}
                    onChange={handleInputChange('employeeCount')}
                    placeholder="请输入员工数量"
                    className={errors.employeeCount ? 'border-red-500' : ''}
                  />
                  {errors.employeeCount && (
                    <p className="text-sm text-red-500 mt-1">{errors.employeeCount}</p>
                  )}
                </div>

                {/* 订阅套餐 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    订阅套餐 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subscriptionPlan}
                    onChange={handleInputChange('subscriptionPlan')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1890FF] focus:border-[#1890FF]"
                  >
                    <option value="trial">试用版 - 免费</option>
                    <option value="basic">基础版 - ¥299/月</option>
                    <option value="premium">专业版 - ¥599/月</option>
                    <option value="enterprise">企业版 - ¥1299/月</option>
                  </select>
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '创建中...' : '创建工厂'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
