"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Syringe, RefreshCw, MoreVertical, Calendar, Shield, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ResponsivePageContainer } from '@/components/layout/ResponsiveContainer';

interface VaccineRecord {
  id: string;
  batchNumber: string;
  livestockType: string;
  vaccineType: string;
  manufacturer: string;
  batchCode: string;
  vaccineDate: string;
  operator: string;
  amount: number;
  remarks?: string;
  status: 'completed' | 'scheduled' | 'pending';
  highEndInfo?: {
    vaccineOrigin?: string;
    veterinarianName?: string;
    veterinarianLicense?: string;
    specialMeasures?: string;
    hasSignature?: boolean;
  };
}

interface FormData {
  batchNumber: string;
  livestockType: string;
  vaccineType: string;
  manufacturer: string;
  batchCode: string;
  vaccineDate: string;
  operator: string;
  amount: string;
  remarks: string;
  // 高端畜禽扩展字段
  vaccineOrigin: string;
  veterinarianName: string;
  veterinarianLicense: string;
  specialMeasures: string;
}

export default function VaccinePage() {
  const router = useRouter();
  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHighEndFields, setShowHighEndFields] = useState(false);
  const [isHighEndExpanded, setIsHighEndExpanded] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    batchNumber: '',
    livestockType: '',
    vaccineType: '',
    manufacturer: '',
    batchCode: '',
    vaccineDate: new Date().toISOString().split('T')[0],
    operator: '',
    amount: '',
    remarks: '',
    vaccineOrigin: '',
    veterinarianName: '',
    veterinarianLicense: '',
    specialMeasures: ''
  });

  // 使用useMemo优化高端畜禽类型数组
  const highEndTypes = useMemo(() => ['和牛', '藏香猪', '伊比利亚猪', '安格斯牛'], []);

  // 模拟数据
  const mockRecords: VaccineRecord[] = [
    {
      id: 'V202304001',
      batchNumber: 'B202304001',
      livestockType: '和牛',
      vaccineType: '口蹄疫疫苗',
      manufacturer: '中牧生物技术有限公司',
      batchCode: 'VM20230415001',
      vaccineDate: '2025-01-10',
      operator: '李医生',
      amount: 50,
      status: 'completed',
      highEndInfo: {
        vaccineOrigin: '进口澳洲',
        veterinarianName: '李建国',
        veterinarianLicense: 'VET20230001',
        specialMeasures: '低温储存，专人监护',
        hasSignature: true
      }
    },
    {
      id: 'V202304002',
      batchNumber: 'B202304002',
      livestockType: '普通猪',
      vaccineType: '猪瘟疫苗',
      manufacturer: '金宇生物技术股份有限公司',
      batchCode: 'VM20230418001',
      vaccineDate: '2025-01-08',
      operator: '王技术员',
      amount: 120,
      status: 'completed'
    },
    {
      id: 'V202304003',
      batchNumber: 'B202304003',
      livestockType: '肉牛',
      vaccineType: '牛结核疫苗',
      manufacturer: '海利生物技术股份有限公司',
      batchCode: 'VM20230420001',
      vaccineDate: '2025-01-15',
      operator: '张医生',
      amount: 180,
      status: 'scheduled'
    }
  ];

  // 初始化数据
  useEffect(() => {
    setRecords(mockRecords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 检查是否为高端畜禽类型
  useEffect(() => {
    const isHighEnd = highEndTypes.includes(formData.livestockType);
    setShowHighEndFields(isHighEnd);
  }, [formData.livestockType, highEndTypes]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 表单验证
    if (!formData.batchNumber || !formData.livestockType || !formData.vaccineType ||
        !formData.manufacturer || !formData.batchCode || !formData.operator || !formData.amount) {
      alert('请填写所有必填字段');
      setIsLoading(false);
      return;
    }

    try {
      // 模拟API提交
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newRecord: VaccineRecord = {
        id: `V${Date.now()}`,
        batchNumber: formData.batchNumber,
        livestockType: formData.livestockType,
        vaccineType: formData.vaccineType,
        manufacturer: formData.manufacturer,
        batchCode: formData.batchCode,
        vaccineDate: formData.vaccineDate,
        operator: formData.operator,
        amount: parseInt(formData.amount),
        remarks: formData.remarks,
        status: 'completed',
        ...(showHighEndFields && {
          highEndInfo: {
            vaccineOrigin: formData.vaccineOrigin,
            veterinarianName: formData.veterinarianName,
            veterinarianLicense: formData.veterinarianLicense,
            specialMeasures: formData.specialMeasures,
            hasSignature: hasSignature
          }
        })
      };

      setRecords(prev => [newRecord, ...prev]);

      // 重置表单
      setFormData({
        batchNumber: '',
        livestockType: '',
        vaccineType: '',
        manufacturer: '',
        batchCode: '',
        vaccineDate: new Date().toISOString().split('T')[0],
        operator: '',
        amount: '',
        remarks: '',
        vaccineOrigin: '',
        veterinarianName: '',
        veterinarianLicense: '',
        specialMeasures: ''
      });
      setHasSignature(false);

      alert('疫苗记录提交成功');
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setRecords(mockRecords);
      setIsLoading(false);
      alert('数据已更新');
    }, 1000);
  };

  const resetForm = () => {
    setFormData({
      batchNumber: '',
      livestockType: '',
      vaccineType: '',
      manufacturer: '',
      batchCode: '',
      vaccineDate: new Date().toISOString().split('T')[0],
      operator: '',
      amount: '',
      remarks: '',
      vaccineOrigin: '',
      veterinarianName: '',
      veterinarianLicense: '',
      specialMeasures: ''
    });
    setHasSignature(false);
    alert('表单已重置');
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'scheduled': return '待接种';
      case 'pending': return '进行中';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'scheduled': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <ResponsivePageContainer bgColor="bg-gray-50" maxWidth="desktop">
      {/* 顶部导航栏 */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-3 p-1 hover:bg-blue-700 rounded"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-medium">疫苗录入</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-blue-700 rounded"
            disabled={isLoading}
            aria-label="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1 hover:bg-blue-700 rounded"
            aria-label="更多"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="p-4 space-y-4">
        {/* 疫苗录入表单 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="border-b border-gray-200 pb-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Syringe className="w-5 h-5 text-blue-600 mr-2" />
              疫苗接种录入
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 批次编号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                批次编号 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.batchNumber}
                onChange={(value: string) => handleInputChange('batchNumber', value)}
                placeholder="选择养殖批次"
                required
                options={[
                  { value: '', label: '选择养殖批次' },
                  { value: 'B202304001', label: 'B202304001 - 猪群A区' },
                  { value: 'B202304002', label: 'B202304002 - 猪群B区' },
                  { value: 'B202304003', label: 'B202304003 - 牛群A区' }
                ]}
              />
            </div>

            {/* 畜禽类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                畜禽类型 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.livestockType}
                onChange={(value: string) => handleInputChange('livestockType', value)}
                placeholder="请选择畜禽类型"
                required
                options={[
                  { value: '', label: '请选择畜禽类型' },
                  { value: '普通猪', label: '普通猪' },
                  { value: '肉牛', label: '肉牛' },
                  { value: '肉羊', label: '肉羊' },
                  { value: '家禽', label: '家禽' },
                  { value: '和牛', label: '和牛' },
                  { value: '藏香猪', label: '藏香猪' },
                  { value: '伊比利亚猪', label: '伊比利亚猪' },
                  { value: '安格斯牛', label: '安格斯牛' }
                ]}
              />
            </div>

            {/* 疫苗类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                疫苗类型 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.vaccineType}
                onChange={(value: string) => handleInputChange('vaccineType', value)}
                placeholder="选择疫苗类型"
                required
                options={[
                  { value: '', label: '选择疫苗类型' },
                  { value: '口蹄疫疫苗', label: '口蹄疫疫苗' },
                  { value: '猪瘟疫苗', label: '猪瘟疫苗' },
                  { value: '牛结核疫苗', label: '牛结核疫苗' },
                  { value: '蓝耳病疫苗', label: '蓝耳病疫苗' }
                ]}
              />
            </div>

            {/* 生产厂家 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                生产厂家 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                placeholder="输入疫苗生产厂家"
                required
              />
            </div>

            {/* 疫苗批号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                疫苗批号 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.batchCode}
                onChange={(e) => handleInputChange('batchCode', e.target.value)}
                placeholder="输入疫苗批号"
                required
              />
            </div>

            {/* 接种日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                接种日期 <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.vaccineDate}
                onChange={(e) => handleInputChange('vaccineDate', e.target.value)}
                required
              />
            </div>

            {/* 接种人员 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                接种人员 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.operator}
                onChange={(e) => handleInputChange('operator', e.target.value)}
                placeholder="输入接种人员姓名"
                required
              />
            </div>

            {/* 接种数量 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                接种数量 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="输入接种动物数量"
                required
              />
            </div>

            {/* 备注 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                备注信息
              </label>
              <Input
                type="text"
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                placeholder="输入备注信息（可选）"
              />
            </div>

            {/* 高端畜禽扩展字段 */}
            {showHighEndFields && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-purple-600 mr-2" />
                    <h3 className="text-base font-medium text-purple-600">高端畜禽疫苗扩展信息</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHighEndExpanded(!isHighEndExpanded)}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    {isHighEndExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {isHighEndExpanded && (
                  <div className="space-y-4">
                    {/* 疫苗产地要求 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        疫苗产地要求
                      </label>
                      <Select
                        value={formData.vaccineOrigin}
                        onChange={(value: string) => handleInputChange('vaccineOrigin', value)}
                        placeholder="请选择产地要求"
                        options={[
                          { value: '', label: '请选择产地要求' },
                          { value: '国产认证', label: '国产认证' },
                          { value: '进口澳洲', label: '进口澳洲' },
                          { value: '进口欧盟', label: '进口欧盟' },
                          { value: '进口美国', label: '进口美国' }
                        ]}
                      />
                    </div>

                    {/* 执业兽医师 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        执业兽医师
                      </label>
                      <Input
                        type="text"
                        value={formData.veterinarianName}
                        onChange={(e) => handleInputChange('veterinarianName', e.target.value)}
                        placeholder="输入执业兽医师姓名"
                      />
                    </div>

                    {/* 兽医执业证号 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        兽医执业证号
                      </label>
                      <Input
                        type="text"
                        value={formData.veterinarianLicense}
                        onChange={(e) => handleInputChange('veterinarianLicense', e.target.value)}
                        placeholder="输入兽医执业证号"
                      />
                    </div>

                    {/* 特殊防护措施 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        特殊防护措施
                      </label>
                      <Input
                        type="text"
                        value={formData.specialMeasures}
                        onChange={(e) => handleInputChange('specialMeasures', e.target.value)}
                        placeholder="输入特殊防护措施"
                      />
                    </div>

                    {/* 电子签名区域 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        兽医电子签名
                      </label>
                      <div
                        className={`h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                          hasSignature
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                        }`}
                        onClick={() => setHasSignature(!hasSignature)}
                      >
                        {hasSignature ? (
                          <div className="text-center">
                            <div className="text-green-600 font-medium">✓ 签名已完成</div>
                            <div className="text-xs text-gray-500 mt-1">点击清除签名</div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500">
                            <div>点击此处进行电子签名</div>
                            <div className="text-xs mt-1">兽医确认接种操作</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                onClick={resetForm}
                variant="secondary"
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                重置
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? '提交中...' : '提交记录'}
              </Button>
            </div>
          </form>
        </Card>

        {/* 疫苗记录列表 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="border-b border-gray-200 pb-3 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">疫苗接种记录</h2>
              <Button variant="secondary" size="small">
                查看全部
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {records.slice(0, 3).map((record) => (
              <div key={record.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* 记录头部 */}
                <div className="bg-blue-50 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <Syringe className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="font-medium text-blue-600 text-sm">{record.vaccineType}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(record.status)}`}>
                    {getStatusText(record.status)}
                  </span>
                </div>

                {/* 记录详情 */}
                <div className="p-3 space-y-2">
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">批次:</span>
                    <span className="flex-1 text-gray-900">{record.batchNumber}</span>
                  </div>
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">类型:</span>
                    <span className="flex-1 text-gray-900">{record.livestockType}</span>
                  </div>
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">厂家:</span>
                    <span className="flex-1 text-gray-900">{record.manufacturer}</span>
                  </div>
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">日期:</span>
                    <span className="flex-1 text-gray-900">{record.vaccineDate}</span>
                  </div>
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">操作员:</span>
                    <span className="flex-1 text-gray-900">{record.operator}</span>
                  </div>
                  <div className="flex text-sm">
                    <span className="w-16 text-gray-500">数量:</span>
                    <span className="flex-1 text-gray-900">{record.amount}头</span>
                  </div>

                  {/* 高端畜禽信息 */}
                  {record.highEndInfo && (
                    <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                      <div className="text-xs font-medium text-purple-600 mb-2">高端畜禽信息</div>
                      {record.highEndInfo.vaccineOrigin && (
                        <div className="flex text-xs">
                          <span className="w-16 text-gray-500">产地:</span>
                          <span className="flex-1 text-gray-900">{record.highEndInfo.vaccineOrigin}</span>
                        </div>
                      )}
                      {record.highEndInfo.veterinarianName && (
                        <div className="flex text-xs">
                          <span className="w-16 text-gray-500">兽医:</span>
                          <span className="flex-1 text-gray-900">{record.highEndInfo.veterinarianName}</span>
                        </div>
                      )}
                      {record.highEndInfo.hasSignature && (
                        <div className="flex items-center text-xs mt-1">
                          <span className="w-16 text-gray-500">签名:</span>
                          <span className="flex-1 text-green-600">✓ 已签名确认</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 近期接种安排 */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-900 mb-2">近期接种安排:</div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-blue-600 mr-1" />
                    <span className="text-sm font-medium text-blue-600">04月26日</span>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-medium text-blue-600 bg-blue-100">
                    待接种
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  牛群A区 - 牛结核疫苗 (计划接种180头)
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </ResponsivePageContainer>
  );
}
