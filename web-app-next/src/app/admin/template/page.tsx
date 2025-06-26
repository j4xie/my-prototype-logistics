'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'document' | 'form' | 'report' | 'certificate';
  status: 'active' | 'draft' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  fileSize: string;
  tags: string[];
  preview?: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  templateCount: number;
  icon: string;
}

interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  totalUsage: number;
  popularTemplate: string;
}

export default function TemplatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证，开发环境已通过useMockAuth自动处理
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockCategories: TemplateCategory[] = [
        {
          id: 'CAT001',
          name: '农业生产',
          description: '农业生产相关模板',
          templateCount: 8,
          icon: 'fas fa-seedling'
        },
        {
          id: 'CAT002',
          name: '食品加工',
          description: '食品加工流程模板',
          templateCount: 12,
          icon: 'fas fa-industry'
        },
        {
          id: 'CAT003',
          name: '质量检测',
          description: '质量检测报告模板',
          templateCount: 6,
          icon: 'fas fa-clipboard-check'
        },
        {
          id: 'CAT004',
          name: '物流运输',
          description: '物流运输单据模板',
          templateCount: 5,
          icon: 'fas fa-truck'
        },
        {
          id: 'CAT005',
          name: '证书证明',
          description: '各类证书证明模板',
          templateCount: 4,
          icon: 'fas fa-certificate'
        }
      ];

      const mockTemplates: Template[] = [
        {
          id: 'TPL001',
          name: '农产品种植记录表',
          description: '用于记录农产品种植全过程的标准化表格',
          category: '农业生产',
          type: 'form',
          status: 'active',
          createdBy: '张农夫',
          createdAt: '2024-05-15',
          updatedAt: '2024-06-10',
          usageCount: 245,
          fileSize: '1.2MB',
          tags: ['种植', '记录', '标准化'],
          preview: '包含播种、施肥、浇水、收获等关键环节'
        },
        {
          id: 'TPL002',
          name: '食品安全检测报告',
          description: '食品安全检测结果的标准化报告模板',
          category: '质量检测',
          type: 'report',
          status: 'active',
          createdBy: '李检测师',
          createdAt: '2024-05-20',
          updatedAt: '2024-06-12',
          usageCount: 189,
          fileSize: '2.5MB',
          tags: ['检测', '安全', '报告'],
          preview: '包含微生物、农药残留、重金属等检测项目'
        },
        {
          id: 'TPL003',
          name: '产品追溯证书',
          description: '产品全程追溯信息的证书模板',
          category: '证书证明',
          type: 'certificate',
          status: 'active',
          createdBy: '王质量员',
          createdAt: '2024-04-25',
          updatedAt: '2024-06-08',
          usageCount: 156,
          fileSize: '800KB',
          tags: ['追溯', '证书', '质量'],
          preview: '包含产地、生产、加工、流通各环节信息'
        },
        {
          id: 'TPL004',
          name: '物流运输单',
          description: '货物运输过程的标准单据模板',
          category: '物流运输',
          type: 'document',
          status: 'active',
          createdBy: '赵物流',
          createdAt: '2024-05-01',
          updatedAt: '2024-06-05',
          usageCount: 298,
          fileSize: '650KB',
          tags: ['物流', '运输', '单据'],
          preview: '包含发货人、收货人、货物信息、运输路线'
        },
        {
          id: 'TPL005',
          name: '肉类加工记录表',
          description: '肉类产品加工过程的详细记录表格',
          category: '食品加工',
          type: 'form',
          status: 'draft',
          createdBy: '钱屠夫',
          createdAt: '2024-06-01',
          updatedAt: '2024-06-14',
          usageCount: 0,
          fileSize: '1.8MB',
          tags: ['肉类', '加工', '记录'],
          preview: '包含屠宰、分割、包装、冷藏等工序'
        },
        {
          id: 'TPL006',
          name: '有机认证申请书',
          description: '有机产品认证申请的标准文件模板',
          category: '证书证明',
          type: 'document',
          status: 'active',
          createdBy: '孙认证员',
          createdAt: '2024-03-15',
          updatedAt: '2024-05-20',
          usageCount: 67,
          fileSize: '3.2MB',
          tags: ['有机', '认证', '申请'],
          preview: '包含申请主体、产品信息、生产过程等'
        }
      ];

      const mockStats: TemplateStats = {
        totalTemplates: 35,
        activeTemplates: 28,
        totalUsage: 1456,
        popularTemplate: '物流运输单'
      };

      setCategories(mockCategories);
      setTemplates(mockTemplates);
      setStats(mockStats);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document':
        return { bg: '#E6F7FF', text: '#1677FF', label: '文档' };
      case 'form':
        return { bg: '#F6FFED', text: '#52C41A', label: '表格' };
      case 'report':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '报告' };
      case 'certificate':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '证书' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '其他' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#F6FFED', text: '#52C41A', label: '启用' };
      case 'draft':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '草稿' };
      case 'archived':
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '已归档' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesType = selectedType === 'all' || template.type === selectedType;
    const matchesSearch = searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesType && matchesSearch;
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-file-alt fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载模板数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">模板管理</h1>
          <button
            onClick={() => router.push('/admin')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 统计概览 */}
          {stats && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#1677FF] mr-2"></i>
                模板统计
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {stats.totalTemplates}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总模板数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {stats.activeTemplates}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">启用模板</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {stats.totalUsage.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总使用次数</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-[#FF4D4F] mb-1 truncate">
                    {stats.popularTemplate}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">热门模板</div>
                </div>
              </div>
            </Card>
          )}

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/admin/template/create')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-plus mr-2"></i>
              新建模板
            </Button>
            <Button
              onClick={() => router.push('/admin/template/import')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-upload mr-2"></i>
              导入模板
            </Button>
          </div>

          {/* 搜索框 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索模板名称、描述或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#d9d9d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1677FF] focus:border-transparent"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c8c8c]"></i>
            </div>
          </Card>

          {/* 分类筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h4 className="font-medium text-[#262626] mb-3">模板分类</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`
                  p-3 rounded-lg text-sm font-medium transition-all
                  ${selectedCategory === 'all'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-th-large mr-2"></i>
                全部类别
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`
                    p-3 rounded-lg text-sm font-medium transition-all text-left
                    ${selectedCategory === category.name
                      ? 'bg-[#1677FF] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <i className={`${category.icon} mr-2`}></i>
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs opacity-75">{category.templateCount} 个模板</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* 类型筛选 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-2 overflow-x-auto">
              {[
                { key: 'all', label: '全部类型', count: templates.length },
                { key: 'document', label: '文档', count: templates.filter(t => t.type === 'document').length },
                { key: 'form', label: '表格', count: templates.filter(t => t.type === 'form').length },
                { key: 'report', label: '报告', count: templates.filter(t => t.type === 'report').length },
                { key: 'certificate', label: '证书', count: templates.filter(t => t.type === 'certificate').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedType(filter.key)}
                  className={`
                    flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${selectedType === filter.key
                      ? 'bg-[#1677FF] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                    }
                  `}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className="ml-1 text-xs">({filter.count})</span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* 模板列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#262626]">模板列表</h3>
              <span className="text-sm text-[#8c8c8c]">共 {filteredTemplates.length} 个模板</span>
            </div>

            {filteredTemplates.map((template) => {
              const typeInfo = getTypeColor(template.type);
              const statusInfo = getStatusColor(template.status);

              return (
                <Card
                  key={template.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                  onClick={() => router.push(`/admin/template/${template.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                          <i className="fas fa-file-alt text-[#1677FF] mr-2"></i>
                          {template.name}
                          <span
                            className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: typeInfo.bg, color: typeInfo.text }}
                          >
                            {typeInfo.label}
                          </span>
                        </h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          {template.description}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-user mr-1"></i>
                          {template.createdBy} · {template.createdAt}
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className="px-2 py-1 rounded text-xs font-medium mb-2"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                        >
                          {statusInfo.label}
                        </div>
                        <div className="text-xs text-[#8c8c8c]">
                          {template.category}
                        </div>
                      </div>
                    </div>

                    {/* 预览信息 */}
                    {template.preview && (
                      <div className="p-3 bg-[#f9f9f9] rounded-md">
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-eye mr-1"></i>
                          {template.preview}
                        </p>
                      </div>
                    )}

                    {/* 标签 */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[#f0f0f0] text-[#8c8c8c] text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 统计信息 */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0] text-xs text-[#bfbfbf]">
                      <span>
                        <i className="fas fa-download mr-1"></i>
                        使用 {template.usageCount} 次
                      </span>
                      <span>
                        <i className="fas fa-hdd mr-1"></i>
                        {template.fileSize}
                      </span>
                      <span>
                        <i className="fas fa-clock mr-1"></i>
                        {template.updatedAt}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* 空状态 */}
            {filteredTemplates.length === 0 && (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <i className="fas fa-search text-[#d9d9d9] text-4xl mb-4"></i>
                <h3 className="font-medium text-[#8c8c8c] mb-2">没有找到匹配的模板</h3>
                <p className="text-sm text-[#bfbfbf] mb-4">
                  请尝试调整搜索条件或筛选选项
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedType('all');
                  }}
                  className="bg-[#1677FF] hover:bg-[#4096FF] text-white"
                >
                  清除筛选条件
                </Button>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
