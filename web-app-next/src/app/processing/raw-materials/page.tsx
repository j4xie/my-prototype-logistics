'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import PageLayout from '@/components/ui/page-layout';
import { Loading } from '@/components/ui/loading';

// 原料数据接口定义
interface RawMaterial {
  id: string;
  name: string;
  category: 'meat' | 'vegetable' | 'dairy' | 'seasoning' | 'packaging';
  supplier: string;
  stockQuantity: number;
  unit: string;
  safetyStock: number;
  lastRestockDate: string;
  expiryDate?: string;
  batchNumber: string;
  qualityGrade: 'A' | 'B' | 'C';
  storageLocation: string;
  pricePerUnit: number;
  totalValue: number;
  status: 'available' | 'low_stock' | 'expired' | 'reserved';
  certifications: string[];
}

// 入库记录接口定义
interface StockInRecord {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string;
  batchNumber: string;
  arrivalDate: string;
  inspectionStatus: 'pending' | 'passed' | 'failed';
  inspectorName?: string;
  notes?: string;
}

// 获取分类图标
const getCategoryIcon = (category: string) => {
  const icons = {
    meat: '🥩',
    vegetable: '🥬',
    dairy: '🥛',
    seasoning: '🧂',
    packaging: '📦'
  };
  return icons[category as keyof typeof icons] || '📦';
};

// 获取分类名称
const getCategoryName = (category: string) => {
  const names = {
    meat: '肉类',
    vegetable: '蔬菜',
    dairy: '乳制品',
    seasoning: '调料',
    packaging: '包装材料'
  };
  return names[category as keyof typeof names] || category;
};

// 获取状态配置
const getStatusConfig = (status: string) => {
  const configs = {
    available: { variant: 'success' as const, text: '库存充足', color: '#52C41A' },
    low_stock: { variant: 'warning' as const, text: '库存不足', color: '#FA8C16' },
    expired: { variant: 'error' as const, text: '已过期', color: '#FF4D4F' },
    reserved: { variant: 'info' as const, text: '已预留', color: '#1890FF' }
  };
  return configs[status as keyof typeof configs] || configs.available;
};

// 获取质量等级配置
const getGradeConfig = (grade: string) => {
  const configs = {
    A: { variant: 'success' as const, text: 'A级', color: '#52C41A' },
    B: { variant: 'warning' as const, text: 'B级', color: '#FA8C16' },
    C: { variant: 'default' as const, text: 'C级', color: '#9CA3AF' }
  };
  return configs[grade as keyof typeof configs] || configs.A;
};

export default function RawMaterialsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<RawMaterial[]>([]);
  const [stockInRecords, setStockInRecords] = useState<StockInRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'materials' | 'stock-in'>('materials');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');


  // 模拟数据加载
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 模拟原料数据
        const mockMaterials: RawMaterial[] = [
          {
            id: 'rm001',
            name: '优质牛肉',
            category: 'meat',
            supplier: '草原牧场有限公司',
            stockQuantity: 150,
            unit: 'kg',
            safetyStock: 50,
            lastRestockDate: '2025-01-30',
            expiryDate: '2025-02-15',
            batchNumber: 'BF240130001',
            qualityGrade: 'A',
            storageLocation: '冷藏区A-01',
            pricePerUnit: 45.5,
            totalValue: 6825,
            status: 'available',
            certifications: ['有机认证', '无抗认证', 'HACCP']
          },
          {
            id: 'rm002',
            name: '新鲜生菜',
            category: 'vegetable',
            supplier: '绿色农场合作社',
            stockQuantity: 25,
            unit: 'kg',
            safetyStock: 30,
            lastRestockDate: '2025-02-01',
            expiryDate: '2025-02-05',
            batchNumber: 'VG240201001',
            qualityGrade: 'A',
            storageLocation: '冷藏区B-05',
            pricePerUnit: 12.5,
            totalValue: 312.5,
            status: 'low_stock',
            certifications: ['绿色食品认证']
          },
          {
            id: 'rm003',
            name: '纯牛奶',
            category: 'dairy',
            supplier: '阳光乳业股份有限公司',
            stockQuantity: 80,
            unit: 'L',
            safetyStock: 20,
            lastRestockDate: '2025-01-28',
            expiryDate: '2025-02-03',
            batchNumber: 'MK240128001',
            qualityGrade: 'A',
            storageLocation: '冷藏区C-03',
            pricePerUnit: 8.5,
            totalValue: 680,
            status: 'expired',
            certifications: ['无公害认证', '巴氏杀菌认证']
          },
          {
            id: 'rm004',
            name: '海盐',
            category: 'seasoning',
            supplier: '海洋调味品公司',
            stockQuantity: 200,
            unit: 'kg',
            safetyStock: 50,
            lastRestockDate: '2025-01-15',
            batchNumber: 'SL240115001',
            qualityGrade: 'A',
            storageLocation: '干货区D-01',
            pricePerUnit: 3.2,
            totalValue: 640,
            status: 'available',
            certifications: ['食品级认证']
          },
          {
            id: 'rm005',
            name: '环保包装盒',
            category: 'packaging',
            supplier: '绿色包装科技有限公司',
            stockQuantity: 500,
            unit: '个',
            safetyStock: 200,
            lastRestockDate: '2025-01-25',
            batchNumber: 'PK240125001',
            qualityGrade: 'B',
            storageLocation: '包装区E-02',
            pricePerUnit: 1.8,
            totalValue: 900,
            status: 'available',
            certifications: ['环保认证', 'FSC认证']
          },
          {
            id: 'rm006',
            name: '新鲜胡萝卜',
            category: 'vegetable',
            supplier: '有机农业基地',
            stockQuantity: 40,
            unit: 'kg',
            safetyStock: 30,
            lastRestockDate: '2025-01-29',
            expiryDate: '2025-02-08',
            batchNumber: 'VG240129001',
            qualityGrade: 'A',
            storageLocation: '冷藏区B-08',
            pricePerUnit: 5.8,
            totalValue: 232,
            status: 'available',
            certifications: ['有机认证']
          },
          {
            id: 'rm007',
            name: '天然香料混合料',
            category: 'seasoning',
            supplier: '香料大师工坊',
            stockQuantity: 15,
            unit: 'kg',
            safetyStock: 20,
            lastRestockDate: '2025-01-20',
            batchNumber: 'SP240120001',
            qualityGrade: 'A',
            storageLocation: '调料区D-05',
            pricePerUnit: 85.0,
            totalValue: 1275,
            status: 'low_stock',
            certifications: ['天然香料认证']
          },
          {
            id: 'rm008',
            name: '特级橄榄油',
            category: 'seasoning',
            supplier: '地中海进口贸易公司',
            stockQuantity: 60,
            unit: 'L',
            safetyStock: 20,
            lastRestockDate: '2025-01-22',
            expiryDate: '2026-01-22',
            batchNumber: 'OL240122001',
            qualityGrade: 'A',
            storageLocation: '调料区D-10',
            pricePerUnit: 45.0,
            totalValue: 2700,
            status: 'available',
            certifications: ['有机认证', 'DOP认证']
          }
        ];

        // 模拟入库记录数据
        const mockStockInRecords: StockInRecord[] = [
          {
            id: 'sir001',
            materialId: 'rm001',
            materialName: '优质牛肉',
            quantity: 50,
            unit: 'kg',
            supplier: '草原牧场有限公司',
            batchNumber: 'BF240130001',
            arrivalDate: '2025-01-30',
            inspectionStatus: 'passed',
            inspectorName: '张质检员',
            notes: '质量优良，符合A级标准'
          },
          {
            id: 'sir002',
            materialId: 'rm002',
            materialName: '新鲜生菜',
            quantity: 30,
            unit: 'kg',
            supplier: '绿色农场合作社',
            batchNumber: 'VG240201001',
            arrivalDate: '2025-02-01',
            inspectionStatus: 'passed',
            inspectorName: '李质检员',
            notes: '新鲜度良好，无病虫害'
          },
          {
            id: 'sir003',
            materialId: 'rm003',
            materialName: '纯牛奶',
            quantity: 100,
            unit: 'L',
            supplier: '阳光乳业股份有限公司',
            batchNumber: 'MK240128001',
            arrivalDate: '2025-01-28',
            inspectionStatus: 'failed',
            inspectorName: '王质检员',
            notes: '临近保质期，建议优先使用'
          }
        ];

        setMaterials(mockMaterials);
        setFilteredMaterials(mockMaterials);
        setStockInRecords(mockStockInRecords);
      } catch (error) {
        console.error('加载原料数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 搜索和筛选处理
  useEffect(() => {
    let filtered = materials;

    // 文本搜索
    if (searchTerm) {
      filtered = filtered.filter(material =>
        material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 分类筛选
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(material => material.category === categoryFilter);
    }

    // 状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(material => material.status === statusFilter);
    }

    setFilteredMaterials(filtered);
  }, [materials, searchTerm, categoryFilter, statusFilter]);

  // 原料卡片组件
  const MaterialCard = ({ material }: { material: RawMaterial }) => {
    const statusConfig = getStatusConfig(material.status);
    const gradeConfig = getGradeConfig(material.qualityGrade);

    // 计算库存百分比
    const stockPercentage = material.safetyStock > 0
      ? Math.min(100, (material.stockQuantity / material.safetyStock) * 100)
      : 100;

    return (
      <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#E6F7FF] rounded-full flex items-center justify-center">
              <span className="text-lg">{getCategoryIcon(material.category)}</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{material.name}</h3>
              <p className="text-sm text-gray-600">{getCategoryName(material.category)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <Badge variant={statusConfig.variant} className="text-xs">
              {statusConfig.text}
            </Badge>
            <Badge variant={gradeConfig.variant} className="text-xs">
              {gradeConfig.text}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div>
            <span className="text-gray-600">库存:</span>
            <span className="ml-1 font-medium">{material.stockQuantity} {material.unit}</span>
          </div>
          <div>
            <span className="text-gray-600">安全库存:</span>
            <span className="ml-1 font-medium">{material.safetyStock} {material.unit}</span>
          </div>
          <div>
            <span className="text-gray-600">供应商:</span>
            <span className="ml-1 font-medium">{material.supplier}</span>
          </div>
          <div>
            <span className="text-gray-600">批次号:</span>
            <span className="ml-1 font-medium">{material.batchNumber}</span>
          </div>
        </div>

        {/* 库存进度条 */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>库存水位</span>
            <span>{stockPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                stockPercentage >= 100 ? 'bg-green-500' :
                stockPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, stockPercentage)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">单价:</span>
            <span className="ml-1 font-medium text-green-600">¥{material.pricePerUnit}</span>
          </div>
          <div>
            <span className="text-gray-600">总价值:</span>
            <span className="ml-1 font-medium text-green-600">¥{material.totalValue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">存储位置:</span>
            <span className="ml-1 font-medium">{material.storageLocation}</span>
          </div>
          <div>
            <span className="text-gray-600">最后入库:</span>
            <span className="ml-1 font-medium">{material.lastRestockDate}</span>
          </div>
        </div>

        {material.expiryDate && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">保质期至:</span>
              <span className={`font-medium ${
                new Date(material.expiryDate) < new Date() ? 'text-red-600' :
                new Date(material.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'text-yellow-600' :
                'text-gray-900'
              }`}>
                {material.expiryDate}
              </span>
            </div>
          </div>
        )}

        {material.certifications.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-sm">
              <span className="text-gray-600">认证:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {material.certifications.slice(0, 3).map((cert, index) => (
                  <Badge key={index} variant="info" className="text-xs">
                    {cert}
                  </Badge>
                ))}
                {material.certifications.length > 3 && (
                  <Badge variant="default" className="text-xs">
                    +{material.certifications.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  // 入库记录卡片组件
  const StockInCard = ({ record }: { record: StockInRecord }) => {
    const getInspectionConfig = (status: string) => {
      const configs = {
        passed: { variant: 'success' as const, text: '检验合格', color: '#52C41A' },
        failed: { variant: 'error' as const, text: '检验不合格', color: '#FF4D4F' },
        pending: { variant: 'warning' as const, text: '待检验', color: '#FA8C16' }
      };
      return configs[status as keyof typeof configs] || configs.pending;
    };

    const inspectionConfig = getInspectionConfig(record.inspectionStatus);

    return (
      <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-900">{record.materialName}</h3>
            <p className="text-sm text-gray-600">批次: {record.batchNumber}</p>
          </div>
          <Badge variant={inspectionConfig.variant} className="text-xs">
            {inspectionConfig.text}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">入库数量:</span>
            <span className="ml-1 font-medium">{record.quantity} {record.unit}</span>
          </div>
          <div>
            <span className="text-gray-600">到货日期:</span>
            <span className="ml-1 font-medium">{record.arrivalDate}</span>
          </div>
          <div>
            <span className="text-gray-600">供应商:</span>
            <span className="ml-1 font-medium">{record.supplier}</span>
          </div>
          {record.inspectorName && (
            <div>
              <span className="text-gray-600">检验员:</span>
              <span className="ml-1 font-medium">{record.inspectorName}</span>
            </div>
          )}
        </div>

        {record.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-sm">
              <span className="text-gray-600">备注:</span>
              <p className="text-gray-900 mt-1">{record.notes}</p>
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <PageLayout title="原料管理" className="flex items-center justify-center min-h-screen">
        <Loading text="加载原料数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="原料管理"
      onBack={() => router.push('/processing')}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-blue-50 border-blue-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{materials.length}</div>
              <div className="text-sm text-blue-700">原料种类</div>
            </div>
          </Card>
          <Card className="bg-orange-50 border-orange-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {materials.filter(m => m.status === 'low_stock').length}
              </div>
              <div className="text-sm text-orange-700">库存不足</div>
            </div>
          </Card>
          <Card className="bg-red-50 border-red-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {materials.filter(m => m.status === 'expired').length}
              </div>
              <div className="text-sm text-red-700">已过期</div>
            </div>
          </Card>
          <Card className="bg-green-50 border-green-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ¥{materials.reduce((sum, m) => sum + m.totalValue, 0).toLocaleString()}
              </div>
              <div className="text-sm text-green-700">总价值</div>
            </div>
          </Card>
        </div>

        {/* 标签页切换 */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
          <Button
            variant={activeTab === 'materials' ? 'primary' : 'ghost'}
            className="flex-1 text-sm py-2"
            onClick={() => setActiveTab('materials')}
          >
            原料库存
          </Button>
          <Button
            variant={activeTab === 'stock-in' ? 'primary' : 'ghost'}
            className="flex-1 text-sm py-2"
            onClick={() => setActiveTab('stock-in')}
          >
            入库记录
          </Button>
        </div>

        {activeTab === 'materials' && (
          <>
            {/* 搜索和筛选 */}
            <div className="space-y-3 mb-4">
              <Input
                placeholder="搜索原料名称、供应商或批次号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />

              <div className="flex space-x-2">
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[
                    { value: 'all', label: '全部分类' },
                    { value: 'meat', label: '肉类' },
                    { value: 'vegetable', label: '蔬菜' },
                    { value: 'dairy', label: '乳制品' },
                    { value: 'seasoning', label: '调料' },
                    { value: 'packaging', label: '包装材料' }
                  ]}
                  className="w-[130px]"
                />

                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'available', label: '库存充足' },
                    { value: 'low_stock', label: '库存不足' },
                    { value: 'expired', label: '已过期' },
                    { value: 'reserved', label: '已预留' }
                  ]}
                  className="w-[130px]"
                />
              </div>
            </div>

            {/* 快速操作 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                onClick={() => {}}
                className="h-12 bg-[#1677FF] hover:bg-[#4096FF] text-white"
              >
                <span className="text-lg mr-2">➕</span>
                添加原料
              </Button>
              <Button
                onClick={() => router.push('/processing/raw-materials/stock-in')}
                className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
              >
                <span className="text-lg mr-2">📦</span>
                原料入库
              </Button>
            </div>

            {/* 原料列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">原料库存</h3>
                <span className="text-sm text-gray-600">共 {filteredMaterials.length} 种</span>
              </div>

              {filteredMaterials.length === 0 ? (
                <Card className="bg-white p-6 text-center">
                  <span className="text-4xl mb-3 block">📦</span>
                  <p className="text-gray-500">暂无原料数据</p>
                </Card>
              ) : (
                filteredMaterials.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'stock-in' && (
          <>
            {/* 入库记录 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">入库记录</h3>
                <span className="text-sm text-gray-600">共 {stockInRecords.length} 条</span>
              </div>

              {stockInRecords.length === 0 ? (
                <Card className="bg-white p-6 text-center">
                  <span className="text-4xl mb-3 block">📋</span>
                  <p className="text-gray-500">暂无入库记录</p>
                </Card>
              ) : (
                stockInRecords.map((record) => (
                  <StockInCard key={record.id} record={record} />
                ))
              )}
            </div>
          </>
        )}

        {/* 库存警告提醒 */}
        {materials.some(m => m.status === 'low_stock' || m.status === 'expired') && (
          <Card className="bg-yellow-50 border-yellow-200 p-4 mt-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-medium text-yellow-800">库存警告</h4>
                <p className="text-sm text-yellow-700">
                  有 {materials.filter(m => m.status === 'low_stock').length} 种原料库存不足，
                  {materials.filter(m => m.status === 'expired').length} 种原料已过期
                </p>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setStatusFilter('low_stock')}
                className="ml-auto border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                查看详情
              </Button>
            </div>
          </Card>
        )}
      </main>
    </PageLayout>
  );
}
