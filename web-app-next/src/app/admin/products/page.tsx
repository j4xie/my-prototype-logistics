'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface Product {
  id: string;
  name: string;
  code: string;
  category: 'meat' | 'seafood' | 'vegetable' | 'fruit';
  status: 'active' | 'inactive';
  template: string;
  templateId: string;
  image: string;
  description: string;
  specifications: string;
  traceCount: number;
  createDate: string;
  updateDate: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // 产品类型选项
  const categoryOptions = [
    { value: '', label: '全部类型' },
    { value: 'meat', label: '肉类' },
    { value: 'seafood', label: '海鲜' },
    { value: 'vegetable', label: '蔬菜' },
    { value: 'fruit', label: '水果' }
  ];

  // 状态选项
  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'active', label: '启用' },
    { value: 'inactive', label: '停用' }
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/admin/products');

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      } else {
        // Mock数据回退
        const mockProducts: Product[] = [
          {
            id: 'prod_001',
            name: '黑猪里脊肉',
            code: 'P20240301001',
            category: 'meat',
            status: 'active',
            template: '肉类溯源模板',
            templateId: 'template1',
            image: '/images/product-placeholder.png',
            description: '优质黑猪里脊肉，肉质鲜美，营养丰富',
            specifications: '500g/包装',
            traceCount: 156,
            createDate: '2024-01-15',
            updateDate: '2024-02-01'
          },
          {
            id: 'prod_002',
            name: '有机白菜',
            code: 'P20240301002',
            category: 'vegetable',
            status: 'active',
            template: '蔬菜溯源模板',
            templateId: 'template3',
            image: '/images/product-placeholder.png',
            description: '有机种植白菜，无农药残留',
            specifications: '1kg/包装',
            traceCount: 89,
            createDate: '2024-01-20',
            updateDate: '2024-01-28'
          },
          {
            id: 'prod_003',
            name: '深海三文鱼',
            code: 'P20240301003',
            category: 'seafood',
            status: 'inactive',
            template: '海鲜溯源模板',
            templateId: 'template2',
            image: '/images/product-placeholder.png',
            description: '挪威进口三文鱼，新鲜冷冻',
            specifications: '300g/份',
            traceCount: 234,
            createDate: '2024-01-10',
            updateDate: '2024-01-25'
          },
          {
            id: 'prod_004',
            name: '红富士苹果',
            code: 'P20240301004',
            category: 'fruit',
            status: 'active',
            template: '水果溯源模板',
            templateId: 'template4',
            image: '/images/product-placeholder.png',
            description: '山东烟台红富士苹果，口感甜脆',
            specifications: '2kg/盒装',
            traceCount: 78,
            createDate: '2024-01-25',
            updateDate: '2024-02-02'
          }
        ];

        setProducts(mockProducts);
      }
    } catch (error) {
      console.error('获取产品列表失败:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // 过滤产品
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.category === filterCategory;
    const matchesStatus = !filterStatus || product.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleStatusChange = async (productId: string, newStatus: 'active' | 'inactive') => {
    try {
      // Mock操作成功
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, status: newStatus } : p
      ));
      alert(`产品${newStatus === 'active' ? '启用' : '停用'}成功`);
    } catch (error) {
      console.error('更新产品状态失败:', error);
      alert('操作失败，请重试');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;

    if (confirm(`确定要删除选中的${selectedProducts.length}个产品吗？`)) {
      try {
        // Mock删除成功
        setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id)));
        setSelectedProducts([]);
        alert('删除成功');
      } catch (error) {
        console.error('批量删除失败:', error);
        alert('删除失败，请重试');
      }
    }
  };

  const getCategoryText = (category: string) => {
    const option = categoryOptions.find(opt => opt.value === category);
    return option?.label || category;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'meat': return 'error';
      case 'seafood': return 'primary';
      case 'vegetable': return 'success';
      case 'fruit': return 'warning';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? '启用' : '停用';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="返回"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">产品管理</h1>
          <button
            onClick={() => router.push('/admin/products/create')}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="添加产品"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[20px] px-4 space-y-4">
        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="space-y-3">
            <Input
              placeholder="搜索产品名称或编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={filterCategory}
                onChange={setFilterCategory}
                options={categoryOptions}
              />
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                options={statusOptions}
              />
            </div>
          </div>
        </Card>

        {/* 统计信息 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-medium">产品统计</h3>
            {selectedProducts.length > 0 && (
              <div className="flex space-x-2">
                <Button size="small" variant="danger" onClick={handleBatchDelete}>
                  删除({selectedProducts.length})
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1890FF]">{filteredProducts.length}</p>
              <p className="text-sm text-gray-600">总产品数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {filteredProducts.filter(p => p.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600">启用产品</p>
            </div>
          </div>
        </Card>

        {/* 产品列表 */}
        <div className="space-y-3">
          {/* 全选操作 */}
          {filteredProducts.length > 0 && (
            <Card className="bg-white rounded-lg shadow-sm p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-[#1890FF] focus:ring-[#1890FF]"
                  />
                  <span className="ml-2 text-sm">全选 ({filteredProducts.length})</span>
                </label>
                <span className="text-sm text-gray-500">
                  已选择 {selectedProducts.length} 项
                </span>
              </div>
            </Card>
          )}

          {/* 产品卡片列表 */}
          {filteredProducts.map((product) => (
            <Card key={product.id} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start space-x-3">
                {/* 选择框 */}
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(product.id)}
                  onChange={() => handleSelectProduct(product.id)}
                  className="mt-1 rounded border-gray-300 text-[#1890FF] focus:ring-[#1890FF]"
                />

                {/* 产品图片 */}
                <div className="flex-shrink-0 w-12 h-12">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={48}
                    height={48}
                    className="rounded-lg object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = '/images/product-placeholder.png';
                    }}
                  />
                </div>

                {/* 产品信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-500">{product.code}</p>
                    </div>
                    <div className="flex space-x-1">
                      <Badge variant={getCategoryColor(product.category)} className="text-xs">
                        {getCategoryText(product.category)}
                      </Badge>
                      <Badge variant={getStatusColor(product.status)} className="text-xs">
                        {getStatusText(product.status)}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">{product.description}</p>

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>溯源记录: {product.traceCount}</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => router.push(`/admin/products/${product.id}`)}
                        className="text-[#1890FF] hover:text-[#1890FF]/80"
                        aria-label="查看详情"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => handleStatusChange(
                          product.id,
                          product.status === 'active' ? 'inactive' : 'active'
                        )}
                        className={`hover:opacity-80 ${
                          product.status === 'active'
                            ? 'text-gray-600'
                            : 'text-green-600'
                        }`}
                        aria-label={product.status === 'active' ? '停用' : '启用'}
                      >
                        {product.status === 'active' ? '停用' : '启用'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* 空状态 */}
          {filteredProducts.length === 0 && (
            <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">📦</div>
              <p className="text-gray-500 mb-4">暂无产品数据</p>
              <Button
                onClick={() => router.push('/admin/products/create')}
                variant="primary"
              >
                添加第一个产品
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
