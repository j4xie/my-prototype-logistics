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

// 成品数据接口定义
interface FinishedProduct {
  id: string;
  name: string;
  category: 'meat_products' | 'vegetable_products' | 'dairy_products' | 'bakery' | 'beverages';
  batchNumber: string;
  productionDate: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  status: 'available' | 'sold' | 'expired' | 'recalled' | 'quality_issue';
  qualityGrade: 'A' | 'B' | 'C';
  storageLocation: string;
  sellPrice: number;
  totalValue: number;
  productionBatchId: string;
  qualityTestId?: string;
  packagingType: string;
  barcode: string;
  certifications: string[];
  nutritionInfo?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
}

// 销售记录接口定义
interface SalesRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  sellPrice: number;
  totalAmount: number;
  customer: string;
  saleDate: string;
  paymentMethod: 'cash' | 'card' | 'online' | 'bank_transfer';
  notes?: string;
}

// 获取分类图标
const getCategoryIcon = (category: string) => {
  const icons = {
    meat_products: '🥩',
    vegetable_products: '🥗',
    dairy_products: '🥛',
    bakery: '🍞',
    beverages: '🧃'
  };
  return icons[category as keyof typeof icons] || '🏭';
};

// 获取分类名称
const getCategoryName = (category: string) => {
  const names = {
    meat_products: '肉制品',
    vegetable_products: '蔬菜制品',
    dairy_products: '乳制品',
    bakery: '烘焙食品',
    beverages: '饮品'
  };
  return names[category as keyof typeof names] || category;
};

// 获取状态配置
const getStatusConfig = (status: string) => {
  const configs = {
    available: { variant: 'success' as const, text: '可销售', color: '#52C41A' },
    sold: { variant: 'info' as const, text: '已售出', color: '#1890FF' },
    expired: { variant: 'error' as const, text: '已过期', color: '#FF4D4F' },
    recalled: { variant: 'warning' as const, text: '已召回', color: '#FA8C16' },
    quality_issue: { variant: 'error' as const, text: '质量问题', color: '#FF4D4F' }
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

export default function FinishedProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<FinishedProduct[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'sales'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<FinishedProduct | null>(null);

  // 模拟数据加载
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 模拟成品数据
        const mockProducts: FinishedProduct[] = [
          {
            id: 'fp001',
            name: '精装牛肉干',
            category: 'meat_products',
            batchNumber: 'MB240202001',
            productionDate: '2025-02-02',
            expiryDate: '2025-08-02',
            quantity: 200,
            unit: '袋',
            status: 'available',
            qualityGrade: 'A',
            storageLocation: '成品仓A-01',
            sellPrice: 28.8,
            totalValue: 5760,
            productionBatchId: 'PB240202001',
            qualityTestId: 'qt001',
            packagingType: '真空包装',
            barcode: '6901234567890',
            certifications: ['有机认证', '无防腐剂认证'],
            nutritionInfo: {
              calories: 325,
              protein: 55.2,
              fat: 8.1,
              carbs: 5.3
            }
          },
          {
            id: 'fp002',
            name: '有机蔬菜沙拉',
            category: 'vegetable_products',
            batchNumber: 'VS240201001',
            productionDate: '2025-02-01',
            expiryDate: '2025-02-05',
            quantity: 50,
            unit: '盒',
            status: 'available',
            qualityGrade: 'A',
            storageLocation: '冷藏仓B-03',
            sellPrice: 18.5,
            totalValue: 925,
            productionBatchId: 'PB240201001',
            packagingType: '环保餐盒',
            barcode: '6901234567891',
            certifications: ['有机认证', '绿色食品认证'],
            nutritionInfo: {
              calories: 45,
              protein: 2.8,
              fat: 1.2,
              carbs: 8.5
            }
          },
          {
            id: 'fp003',
            name: '纯天然酸奶',
            category: 'dairy_products',
            batchNumber: 'YG240130001',
            productionDate: '2025-01-30',
            expiryDate: '2025-02-13',
            quantity: 120,
            unit: '瓶',
            status: 'available',
            qualityGrade: 'A',
            storageLocation: '冷藏仓C-02',
            sellPrice: 12.8,
            totalValue: 1536,
            productionBatchId: 'PB240130001',
            qualityTestId: 'qt003',
            packagingType: '玻璃瓶装',
            barcode: '6901234567892',
            certifications: ['无添加认证', 'ISO9001认证']
          },
          {
            id: 'fp004',
            name: '全麦面包',
            category: 'bakery',
            batchNumber: 'BR240201001',
            productionDate: '2025-02-01',
            expiryDate: '2025-02-08',
            quantity: 80,
            unit: '个',
            status: 'available',
            qualityGrade: 'B',
            storageLocation: '常温仓D-01',
            sellPrice: 8.5,
            totalValue: 680,
            productionBatchId: 'PB240201002',
            packagingType: '纸袋包装',
            barcode: '6901234567893',
            certifications: ['全麦认证'],
            nutritionInfo: {
              calories: 247,
              protein: 8.2,
              fat: 3.6,
              carbs: 49.8
            }
          },
          {
            id: 'fp005',
            name: '天然果汁',
            category: 'beverages',
            batchNumber: 'JU240128001',
            productionDate: '2025-01-28',
            expiryDate: '2025-02-04',
            quantity: 15,
            unit: '瓶',
            status: 'expired',
            qualityGrade: 'A',
            storageLocation: '常温仓E-02',
            sellPrice: 15.8,
            totalValue: 237,
            productionBatchId: 'PB240128001',
            packagingType: '玻璃瓶装',
            barcode: '6901234567894',
            certifications: ['100%纯果汁认证', '无糖添加认证'],
            nutritionInfo: {
              calories: 54,
              protein: 0.8,
              fat: 0.2,
              carbs: 13.1
            }
          },
          {
            id: 'fp006',
            name: '香草奶昔',
            category: 'beverages',
            batchNumber: 'MS240202001',
            productionDate: '2025-02-02',
            expiryDate: '2025-02-09',
            quantity: 60,
            unit: '杯',
            status: 'available',
            qualityGrade: 'A',
            storageLocation: '冷藏仓C-05',
            sellPrice: 22.0,
            totalValue: 1320,
            productionBatchId: 'PB240202002',
            packagingType: '密封杯装',
            barcode: '6901234567895',
            certifications: ['天然香料认证']
          }
        ];

        // 模拟销售记录数据
        const mockSalesRecords: SalesRecord[] = [
          {
            id: 'sr001',
            productId: 'fp001',
            productName: '精装牛肉干',
            quantity: 50,
            unit: '袋',
            sellPrice: 28.8,
            totalAmount: 1440,
            customer: '张先生',
            saleDate: '2025-02-01',
            paymentMethod: 'card',
            notes: '批发订单'
          },
          {
            id: 'sr002',
            productId: 'fp002',
            productName: '有机蔬菜沙拉',
            quantity: 20,
            unit: '盒',
            sellPrice: 18.5,
            totalAmount: 370,
            customer: '健康餐厅',
            saleDate: '2025-02-01',
            paymentMethod: 'bank_transfer',
            notes: '连锁餐厅订单'
          },
          {
            id: 'sr003',
            productId: 'fp003',
            productName: '纯天然酸奶',
            quantity: 30,
            unit: '瓶',
            sellPrice: 12.8,
            totalAmount: 384,
            customer: '李女士',
            saleDate: '2025-01-31',
            paymentMethod: 'online',
            notes: '在线商城订单'
          }
        ];

        setProducts(mockProducts);
        setFilteredProducts(mockProducts);
        setSalesRecords(mockSalesRecords);
      } catch (error) {
        console.error('加载成品数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 搜索和筛选处理
  useEffect(() => {
    let filtered = products;

    // 文本搜索
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 分类筛选
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // 状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => product.status === statusFilter);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, categoryFilter, statusFilter]);

  // 成品卡片组件
  const ProductCard = ({ product }: { product: FinishedProduct }) => {
    const statusConfig = getStatusConfig(product.status);
    const gradeConfig = getGradeConfig(product.qualityGrade);

    // 检查是否临近过期
    const isNearExpiry = new Date(product.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const isExpired = new Date(product.expiryDate) < new Date();

    return (
      <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedProduct(product)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#E6F7FF] rounded-full flex items-center justify-center">
              <span className="text-lg">{getCategoryIcon(product.category)}</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{product.name}</h3>
              <p className="text-sm text-gray-600">{getCategoryName(product.category)}</p>
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
            <span className="ml-1 font-medium">{product.quantity} {product.unit}</span>
          </div>
          <div>
            <span className="text-gray-600">售价:</span>
            <span className="ml-1 font-medium text-green-600">¥{product.sellPrice}</span>
          </div>
          <div>
            <span className="text-gray-600">生产日期:</span>
            <span className="ml-1 font-medium">{product.productionDate}</span>
          </div>
          <div>
            <span className="text-gray-600">条形码:</span>
            <span className="ml-1 font-medium text-xs">{product.barcode}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">批次号:</span>
            <span className="ml-1 font-medium">{product.batchNumber}</span>
          </div>
          <div>
            <span className="text-gray-600">总价值:</span>
            <span className="ml-1 font-medium text-green-600">¥{product.totalValue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">存储位置:</span>
            <span className="ml-1 font-medium">{product.storageLocation}</span>
          </div>
          <div>
            <span className="text-gray-600">包装类型:</span>
            <span className="ml-1 font-medium">{product.packagingType}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">保质期至:</span>
            <span className={`font-medium ${
              isExpired ? 'text-red-600' : isNearExpiry ? 'text-yellow-600' : 'text-gray-900'
            }`}>
              {product.expiryDate}
            </span>
          </div>
          {(isExpired || isNearExpiry) && (
            <div className="mt-2">
              <Badge variant={isExpired ? 'error' : 'warning'} className="text-xs">
                {isExpired ? '已过期' : '即将过期'}
              </Badge>
            </div>
          )}
        </div>

        {product.certifications.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-sm">
              <span className="text-gray-600">认证:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {product.certifications.slice(0, 2).map((cert, index) => (
                  <Badge key={index} variant="info" className="text-xs">
                    {cert}
                  </Badge>
                ))}
                {product.certifications.length > 2 && (
                  <Badge variant="default" className="text-xs">
                    +{product.certifications.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  // 销售记录卡片组件
  const SalesCard = ({ record }: { record: SalesRecord }) => {
    const getPaymentMethodName = (method: string) => {
      const methods = {
        cash: '现金',
        card: '刷卡',
        online: '在线支付',
        bank_transfer: '银行转账'
      };
      return methods[method as keyof typeof methods] || method;
    };

    return (
      <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-900">{record.productName}</h3>
            <p className="text-sm text-gray-600">客户: {record.customer}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-600">¥{record.totalAmount}</div>
            <div className="text-xs text-gray-500">{record.saleDate}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">销售数量:</span>
            <span className="ml-1 font-medium">{record.quantity} {record.unit}</span>
          </div>
          <div>
            <span className="text-gray-600">单价:</span>
            <span className="ml-1 font-medium">¥{record.sellPrice}</span>
          </div>
          <div>
            <span className="text-gray-600">支付方式:</span>
            <span className="ml-1 font-medium">{getPaymentMethodName(record.paymentMethod)}</span>
          </div>
          <div>
            <span className="text-gray-600">销售日期:</span>
            <span className="ml-1 font-medium">{record.saleDate}</span>
          </div>
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
      <PageLayout title="成品管理" className="flex items-center justify-center min-h-screen">
        <Loading text="加载成品数据中..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="成品管理"
      showBack={true}
      onBack={() => router.push('/processing')}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-blue-50 border-blue-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{products.length}</div>
              <div className="text-sm text-blue-700">成品种类</div>
            </div>
          </Card>
          <Card className="bg-green-50 border-green-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {products.filter(p => p.status === 'available').length}
              </div>
              <div className="text-sm text-green-700">可销售</div>
            </div>
          </Card>
          <Card className="bg-red-50 border-red-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {products.filter(p => p.status === 'expired').length}
              </div>
              <div className="text-sm text-red-700">已过期</div>
            </div>
          </Card>
          <Card className="bg-orange-50 border-orange-200 p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                ¥{products.filter(p => p.status === 'available').reduce((sum, p) => sum + p.totalValue, 0).toLocaleString()}
              </div>
              <div className="text-sm text-orange-700">可售总值</div>
            </div>
          </Card>
        </div>

        {/* 标签页切换 */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
          <Button
            variant={activeTab === 'products' ? 'primary' : 'ghost'}
            className="flex-1 text-sm py-2"
            onClick={() => setActiveTab('products')}
          >
            成品库存
          </Button>
          <Button
            variant={activeTab === 'sales' ? 'primary' : 'ghost'}
            className="flex-1 text-sm py-2"
            onClick={() => setActiveTab('sales')}
          >
            销售记录
          </Button>
        </div>

        {activeTab === 'products' && (
          <>
            {/* 搜索和筛选 */}
            <div className="space-y-3 mb-4">
              <Input
                placeholder="搜索产品名称、批次号或条形码..."
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
                    { value: 'meat_products', label: '肉制品' },
                    { value: 'vegetable_products', label: '蔬菜制品' },
                    { value: 'dairy_products', label: '乳制品' },
                    { value: 'bakery', label: '烘焙食品' },
                    { value: 'beverages', label: '饮品' }
                  ]}
                  className="w-[140px]"
                />

                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'available', label: '可销售' },
                    { value: 'sold', label: '已售出' },
                    { value: 'expired', label: '已过期' },
                    { value: 'recalled', label: '已召回' },
                    { value: 'quality_issue', label: '质量问题' }
                  ]}
                  className="w-[120px]"
                />
              </div>
            </div>

            {/* 成品列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">成品库存</h3>
                <span className="text-sm text-gray-600">共 {filteredProducts.length} 种</span>
              </div>

              {filteredProducts.length === 0 ? (
                <Card className="bg-white p-6 text-center">
                  <span className="text-4xl mb-3 block">🏭</span>
                  <p className="text-gray-500">暂无成品数据</p>
                </Card>
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'sales' && (
          <>
            {/* 销售记录 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">销售记录</h3>
                <span className="text-sm text-gray-600">共 {salesRecords.length} 条</span>
              </div>

              {salesRecords.length === 0 ? (
                <Card className="bg-white p-6 text-center">
                  <span className="text-4xl mb-3 block">📊</span>
                  <p className="text-gray-500">暂无销售记录</p>
                </Card>
              ) : (
                salesRecords.map((record) => (
                  <SalesCard key={record.id} record={record} />
                ))
              )}
            </div>
          </>
        )}

        {/* 成品详情模态框 */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="bg-white rounded-lg p-6 max-w-[350px] w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">成品详情</h3>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setSelectedProduct(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">{selectedProduct.name}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>分类: {getCategoryName(selectedProduct.category)}</div>
                    <div>批次号: {selectedProduct.batchNumber}</div>
                    <div>条形码: {selectedProduct.barcode}</div>
                    <div>包装类型: {selectedProduct.packagingType}</div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">库存信息</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>当前库存: {selectedProduct.quantity} {selectedProduct.unit}</div>
                    <div>单价: ¥{selectedProduct.sellPrice}</div>
                    <div>总价值: ¥{selectedProduct.totalValue.toLocaleString()}</div>
                    <div>存储位置: {selectedProduct.storageLocation}</div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">生产信息</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>生产日期: {selectedProduct.productionDate}</div>
                    <div>保质期至: {selectedProduct.expiryDate}</div>
                    <div>生产批次ID: {selectedProduct.productionBatchId}</div>
                    {selectedProduct.qualityTestId && (
                      <div>质检ID: {selectedProduct.qualityTestId}</div>
                    )}
                  </div>
                </div>

                {selectedProduct.nutritionInfo && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">营养信息</h5>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>热量: {selectedProduct.nutritionInfo.calories} kcal</div>
                      <div>蛋白质: {selectedProduct.nutritionInfo.protein}g</div>
                      <div>脂肪: {selectedProduct.nutritionInfo.fat}g</div>
                      <div>碳水化合物: {selectedProduct.nutritionInfo.carbs}g</div>
                    </div>
                  </div>
                )}

                {selectedProduct.certifications.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">认证信息</h5>
                    <div className="flex flex-wrap gap-1">
                      {selectedProduct.certifications.map((cert, index) => (
                        <Badge key={index} variant="info" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 过期提醒 */}
        {products.some(p => p.status === 'expired' || new Date(p.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) && (
          <Card className="bg-yellow-50 border-yellow-200 p-4 mt-6">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-medium text-yellow-800">过期提醒</h4>
                <p className="text-sm text-yellow-700">
                  有 {products.filter(p => p.status === 'expired').length} 种成品已过期，
                  {products.filter(p => new Date(p.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && p.status !== 'expired').length} 种成品即将过期
                </p>
              </div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setStatusFilter('expired')}
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
