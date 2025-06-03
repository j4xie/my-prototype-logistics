import React, { useState, useEffect } from 'react';
import { 
  Button,
  Badge
} from '@/components/ui';
import { TraceRecordView, TraceRecordForm } from '@/components/modules/trace';

/**
 * 追溯模块演示页面
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const TraceDemo = () => {
  const [currentView, setCurrentView] = useState('list'); // 'list', 'form', 'detail'
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  // 模拟数据
  const mockRecords = [
    {
      id: 'trace_001',
      productName: '有机苹果',
      productType: 'fruit',
      batchNumber: 'AP2025052101',
      stage: 'retail',
      location: '北京市朝阳区超市',
      status: 'completed',
      timestamp: '2025-05-21T10:30:00Z',
      handlerName: '张三',
      description: '有机苹果零售阶段，产品质量良好，包装完整。',
      attachments: [
        { name: '质检报告.pdf', size: 1024 },
        { name: '产品照片.jpg', size: 2048 }
      ],
      timeline: [
        {
          operation: '种植',
          timestamp: '2025-03-01T08:00:00Z',
          location: '山东烟台果园',
          description: '有机苹果种植开始'
        },
        {
          operation: '采摘',
          timestamp: '2025-04-15T14:00:00Z',
          location: '山东烟台果园',
          description: '苹果成熟采摘'
        },
        {
          operation: '包装',
          timestamp: '2025-04-16T09:00:00Z',
          location: '烟台包装厂',
          description: '产品清洗包装'
        },
        {
          operation: '运输',
          timestamp: '2025-04-17T06:00:00Z',
          location: '物流中心',
          description: '冷链运输至北京'
        },
        {
          operation: '零售',
          timestamp: '2025-05-21T10:30:00Z',
          location: '北京市朝阳区超市',
          description: '产品上架销售'
        }
      ]
    },
    {
      id: 'trace_002',
      productName: '草饲牛肉',
      productType: 'meat',
      batchNumber: 'BF2025052102',
      stage: 'processing',
      location: '内蒙古加工厂',
      status: 'pending',
      timestamp: '2025-05-20T16:45:00Z',
      handlerName: '李四',
      description: '草饲牛肉加工阶段，正在进行质量检测。',
      attachments: [
        { name: '检疫证明.pdf', size: 1536 }
      ]
    },
    {
      id: 'trace_003',
      productName: '有机大米',
      productType: 'grain',
      batchNumber: 'RC2025052103',
      stage: 'storage',
      location: '黑龙江仓储中心',
      status: 'review',
      timestamp: '2025-05-19T11:20:00Z',
      handlerName: '王五',
      description: '有机大米储存阶段，温湿度控制良好。'
    }
  ];

  const handleRecordClick = (record) => {
    setSelectedRecord(record);
    setCurrentView('detail');
  };

  const handleCreateNew = () => {
    setSelectedRecord(null);
    setCurrentView('form');
  };

  const handleEditRecord = (record) => {
    setSelectedRecord(record);
    setCurrentView('form');
  };

  const handleFormSubmit = async (formData) => {
    setLoading(true);
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('提交数据:', formData);
    setLoading(false);
    setCurrentView('list');
  };

  const handleFormCancel = () => {
    setCurrentView('list');
    setSelectedRecord(null);
  };

  const renderViewSelector = () => (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">追溯模块演示</h3>
        <Badge variant="info" size="small">Phase-2</Badge>
      </div>
      
      {/* 使用grid-cols-3 gap-4布局 */}
      <div className="grid grid-cols-3 gap-4">
        <Button
          variant={currentView === 'list' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => setCurrentView('list')}
          className="text-xs"
        >
          记录列表
        </Button>
        <Button
          variant={currentView === 'form' ? 'primary' : 'secondary'}
          size="small"
          onClick={handleCreateNew}
          className="text-xs"
        >
          新建记录
        </Button>
        <Button
          variant={currentView === 'detail' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => selectedRecord && setCurrentView('detail')}
          disabled={!selectedRecord}
          className="text-xs"
        >
          记录详情
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'form':
        return (
          <TraceRecordForm
            initialData={selectedRecord}
            mode={selectedRecord ? 'edit' : 'create'}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            loading={loading}
          />
        );
      
      case 'detail':
        return (
          <div className="space-y-4">
            {selectedRecord && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">记录详情</h3>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleEditRecord(selectedRecord)}
                  >
                    编辑
                  </Button>
                </div>
              </div>
            )}
            <TraceRecordView
              viewMode="detail"
              selectedRecord={selectedRecord}
              showTimeline={true}
            />
          </div>
        );
      
      case 'list':
      default:
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">溯源记录</h3>
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleCreateNew}
                >
                  <i className="fas fa-plus mr-1"></i>
                  新建
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                展示响应式列表和表格视图，移动端自动转换为卡片布局
              </p>
            </div>
            
            {/* 移动端列表视图 */}
            <div className="block md:hidden">
              <TraceRecordView
                records={mockRecords}
                viewMode="list"
                onRecordClick={handleRecordClick}
                loading={loading}
              />
            </div>
            
            {/* 桌面端表格视图 */}
            <div className="hidden md:block">
              <TraceRecordView
                records={mockRecords}
                viewMode="table"
                onRecordClick={handleRecordClick}
                loading={loading}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 固定顶部导航 - 遵循UI设计系统规则 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between p-4">
          <div className="flex items-center">
            <button
              onClick={() => window.history.back()}
              className="mr-3 text-white hover:text-gray-200"
              aria-label="返回"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 className="text-lg font-medium">追溯模块演示</h1>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-white hover:text-gray-200"
            aria-label="刷新"
          >
            <i className="fas fa-refresh"></i>
          </button>
        </div>
      </div>

      {/* 主要内容区域 - 遵循UI设计系统规则 */}
      <div className="pt-[80px] pb-[80px] max-w-[390px] mx-auto w-full">
        {renderViewSelector()}
        {renderContent()}
        
        {/* 功能说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm p-4 mt-6">
          <h4 className="text-lg font-medium text-blue-900 mb-2">
            <i className="fas fa-info-circle mr-2"></i>
            移动端适配特性
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 响应式布局：桌面端表格，移动端卡片</li>
            <li>• 触摸友好：大按钮，易点击的交互元素</li>
            <li>• 表单优化：防止iOS缩放，优化虚拟键盘体验</li>
            <li>• 内容适配：文字截断，合理的信息层次</li>
            <li>• 导航优化：移动端专用导航和返回按钮</li>
          </ul>
        </div>
      </div>

      {/* 底部导航 - 遵循UI设计系统规则 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-[390px] mx-auto flex justify-around">
          <div className="flex flex-col items-center py-2 px-3">
            <i className="fas fa-home text-gray-400 mb-1"></i>
            <span className="text-xs text-gray-400">首页</span>
          </div>
          <div className="flex flex-col items-center py-2 px-3">
            <i className="fas fa-search text-[#1890FF] mb-1"></i>
            <span className="text-xs text-[#1890FF]">查询</span>
          </div>
          <div className="flex flex-col items-center py-2 px-3">
            <i className="fas fa-plus text-gray-400 mb-1"></i>
            <span className="text-xs text-gray-400">录入</span>
          </div>
          <div className="flex flex-col items-center py-2 px-3">
            <i className="fas fa-chart-line text-gray-400 mb-1"></i>
            <span className="text-xs text-gray-400">报表</span>
          </div>
          <div className="flex flex-col items-center py-2 px-3">
            <i className="fas fa-user text-gray-400 mb-1"></i>
            <span className="text-xs text-gray-400">我的</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraceDemo; 