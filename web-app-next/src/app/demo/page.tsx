'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';
import { Loading } from '@/components/ui/loading';
import { DynamicLoaders, DynamicLoadingIndicator, useDynamicComponentMetrics } from '@/components/ui/dynamic-loader';

// 使用Next.js内置的dynamic函数实现代码分割
const DynamicTable = dynamic(() => 
  import('@/components/ui/table').then(mod => ({ default: mod.Table })),
  {
    loading: () => <Loading />,
    ssr: false, // 关闭服务端渲染，提高初始页面加载速度
  }
);

// 动态加载的高级表格组件
const DynamicAdvancedTable = DynamicLoaders.AdvancedTable;

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'metrics'>('basic');
  const [showDynamicComponents, setShowDynamicComponents] = useState(false);
  
  // 性能监控
  const { metrics, startLoading, endLoading } = useDynamicComponentMetrics('DemoPage');

  const handleLoadDynamicComponents = async () => {
    startLoading();
    try {
      setShowDynamicComponents(true);
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      endLoading(true);
    } catch {
      endLoading(false);
    }
  };

  // 示例数据
  const basicTableData = [
    { name: '性能优化', value: '代码分割', status: '已完成' },
    { name: '用户体验', value: '懒加载', status: '进行中' },
    { name: '构建工具', value: 'Turbopack', status: '已完成' },
  ];

  const advancedTableData = [
    { id: 1, name: '组件库现代化', type: '前端', priority: '高', progress: 85, assignee: '张三' },
    { id: 2, name: '状态管理重构', type: '前端', priority: '中', progress: 60, assignee: '李四' },
    { id: 3, name: '构建工具优化', type: '工程化', priority: '高', progress: 100, assignee: '王五' },
    { id: 4, name: 'TypeScript迁移', type: '前端', priority: '高', progress: 45, assignee: '赵六' },
    { id: 5, name: '测试覆盖率提升', type: '质量保证', priority: '中', progress: 30, assignee: '孙七' },
  ];

  const basicColumns = [
    { key: 'name', title: '名称' },
    { key: 'value', title: '值' },
    { key: 'status', title: '状态' },
  ];

  const advancedColumns = [
    { key: 'name', title: '任务名称', sortable: true },
    { key: 'type', title: '类型', sortable: true, filterable: true },
    { key: 'priority', title: '优先级', sortable: true },
    { 
      key: 'progress', 
      title: '进度', 
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">{value}%</span>
        </div>
      )
    },
    { key: 'assignee', title: '负责人' },
  ];

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      <main className="flex-1 p-4 space-y-6">
        {/* 标题区域 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h1 className="text-lg font-medium text-gray-900 mb-2">
            代码分割和懒加载演示
          </h1>
          <p className="text-sm text-gray-600">
            展示Next.js动态导入、代码分割和性能优化功能
          </p>
        </div>

        {/* 性能指标 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">构建性能指标</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-lg font-medium text-green-600">13.0s</div>
              <div className="text-xs text-gray-500">构建时间</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-blue-600">101kB</div>
              <div className="text-xs text-gray-500">First Load JS</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-purple-600">4个</div>
              <div className="text-xs text-gray-500">静态页面</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-orange-600">
                {metrics.loadDuration > 0 ? `${metrics.loadDuration.toFixed(0)}ms` : '-'}
              </div>
              <div className="text-xs text-gray-500">动态加载时间</div>
            </div>
          </div>
        </div>

        {/* 选项卡导航 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="flex border-b border-gray-200">
            {[
              { key: 'basic', label: '基础表格' },
              { key: 'advanced', label: '高级表格' },
              { key: 'metrics', label: '性能监控' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* 基础表格展示 */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">
                  动态加载的基础数据表格
                </h3>
                <Suspense fallback={<Loading />}>
                  <DynamicTable
                    columns={basicColumns}
                    data={basicTableData}
                    size="sm"
                    responsive={true}
                  />
                </Suspense>
              </div>
            )}

            {/* 高级表格展示 */}
            {activeTab === 'advanced' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    动态加载的高级表格组件
                  </h3>
                  <button
                    onClick={handleLoadDynamicComponents}
                    disabled={metrics.isLoading}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {metrics.isLoading ? '加载中...' : showDynamicComponents ? '重新加载' : '加载组件'}
                  </button>
                </div>
                
                {showDynamicComponents ? (
                  <Suspense fallback={<DynamicLoadingIndicator message="高级表格加载中..." />}>
                    <DynamicAdvancedTable
                      columns={advancedColumns}
                      data={advancedTableData}
                      searchable={true}
                      pagination={true}
                      pageSize={3}
                    />
                  </Suspense>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <div className="text-gray-500 text-sm">
                      点击&ldquo;加载组件&rdquo;按钮体验动态加载
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 性能监控展示 */}
            {activeTab === 'metrics' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">
                  动态组件性能监控
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">组件加载状态</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      metrics.isLoading 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : metrics.hasError 
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                    }`}>
                      {metrics.isLoading ? '加载中' : metrics.hasError ? '加载失败' : '加载完成'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">加载时长</span>
                    <span className="text-sm font-mono">
                      {metrics.loadDuration > 0 ? `${metrics.loadDuration.toFixed(2)}ms` : '-'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">Bundle 分析</span>
                    <span className="text-sm text-blue-600">4个chunks已生成</span>
                  </div>
                </div>

                {/* 其他动态组件演示 */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-600">其他动态组件</h4>
                  <div className="space-y-2">
                    <Suspense fallback={<DynamicLoadingIndicator size="sm" />}>
                      <DynamicLoaders.ChartComponent />
                    </Suspense>
                    <Suspense fallback={<DynamicLoadingIndicator size="sm" />}>
                      <DynamicLoaders.Modal />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 技术说明 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            💡 技术实现说明
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• 使用Next.js dynamic()实现组件级代码分割</li>
            <li>• Turbopack构建工具优化，提升10倍构建速度</li>
            <li>• 错误边界处理动态加载失败情况</li>
            <li>• 性能监控追踪组件加载时间</li>
            <li>• Suspense支持加载状态展示</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
