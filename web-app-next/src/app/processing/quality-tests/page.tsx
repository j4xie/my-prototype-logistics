'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Badge from '@/components/ui/badge';
import PageLayout from '@/components/ui/page-layout';

// Mock数据
const mockTestCategories = [
  { id: '1', name: '微生物检测', count: 12, color: 'bg-red-100 text-red-800' },
  { id: '2', name: '化学成分检测', count: 8, color: 'bg-blue-100 text-blue-800' },
  { id: '3', name: '营养成分检测', count: 15, color: 'bg-green-100 text-green-800' },
  { id: '4', name: '重金属检测', count: 6, color: 'bg-yellow-100 text-yellow-800' },
  { id: '5', name: '农药残留检测', count: 10, color: 'bg-purple-100 text-purple-800' },
];

const mockTestRecords = [
  {
    id: '1',
    sampleId: 'SP-001',
    productName: '有机大米',
    testType: '农药残留检测',
    status: '检测中',
    priority: '高',
    submittedDate: '2024-01-15',
    expectedDate: '2024-01-18',
    inspector: '李检测',
    statusColor: 'bg-yellow-100 text-yellow-800',
  },
  {
    id: '2',
    sampleId: 'SP-002',
    productName: '草莓',
    testType: '微生物检测',
    status: '已完成',
    priority: '中',
    submittedDate: '2024-01-14',
    expectedDate: '2024-01-17',
    inspector: '张质检',
    statusColor: 'bg-green-100 text-green-800',
  },
  {
    id: '3',
    sampleId: 'SP-003',
    productName: '牛肉',
    testType: '化学成分检测',
    status: '待审核',
    priority: '高',
    submittedDate: '2024-01-13',
    expectedDate: '2024-01-16',
    inspector: '王分析',
    statusColor: 'bg-orange-100 text-orange-800',
  },
  {
    id: '4',
    sampleId: 'SP-004',
    productName: '蔬菜沙拉',
    testType: '营养成分检测',
    status: '已完成',
    priority: '低',
    submittedDate: '2024-01-12',
    expectedDate: '2024-01-15',
    inspector: '赵营养师',
    statusColor: 'bg-green-100 text-green-800',
  },
];

const mockQualityStandards = [
  {
    id: '1',
    name: 'GB 2762-2017 食品安全国家标准',
    category: '重金属限量',
    status: '有效',
    updateDate: '2024-01-01',
  },
  {
    id: '2',
    name: 'GB 2763-2021 食品安全国家标准',
    category: '农药最大残留限量',
    status: '有效',
    updateDate: '2024-01-01',
  },
  {
    id: '3',
    name: 'GB 29921-2021 食品安全国家标准',
    category: '预包装食品中致病菌限量',
    status: '有效',
    updateDate: '2024-01-01',
  },
];

export default function QualityTestsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('tests');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = mockTestRecords.filter(record =>
    record.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.sampleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.testType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TestsTab = () => (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <Input
          placeholder="搜索样品ID、产品名称或检测类型..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* 检测统计 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">检测类型统计</h3>
        <div className="grid grid-cols-2 gap-3">
          {mockTestCategories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{category.name}</p>
                <p className="text-xs text-gray-500">进行中</p>
              </div>
              <Badge className={category.color}>{category.count}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* 检测记录列表 */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-900">检测记录</h3>
        {filteredRecords.map((record) => (
          <Card
            key={record.id}
            className="bg-white p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/processing/quality-tests/${record.id}`)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{record.sampleId}</p>
                <p className="text-sm text-gray-600">{record.productName}</p>
              </div>
              <Badge className={record.statusColor}>{record.status}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{record.testType}</span>
              <span className={`px-2 py-1 rounded-full ${
                record.priority === '高' ? 'bg-red-100 text-red-600' :
                record.priority === '中' ? 'bg-yellow-100 text-yellow-600' :
                'bg-gray-100 text-gray-600'
              }`}>
                {record.priority}优先级
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>检测员: {record.inspector}</span>
              <span>预计完成: {record.expectedDate}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const StandardsTab = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">质量标准管理</h3>
        <div className="space-y-3">
          {mockQualityStandards.map((standard) => (
            <div key={standard.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{standard.name}</p>
                <p className="text-sm text-gray-600 mt-1">{standard.category}</p>
                <p className="text-xs text-gray-500 mt-1">更新时间: {standard.updateDate}</p>
              </div>
              <Badge className="bg-green-100 text-green-800">{standard.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">检测数据分析</h3>

        {/* 数据统计 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">89%</p>
            <p className="text-sm text-blue-600">合格率</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">234</p>
            <p className="text-sm text-green-600">本月检测</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">12</p>
            <p className="text-sm text-yellow-600">待处理</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">3</p>
            <p className="text-sm text-red-600">不合格</p>
          </div>
        </div>

        {/* 趋势分析 */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">检测趋势</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">本周检测数量</span>
              <span className="text-sm font-medium">+15% ↗</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">合格率趋势</span>
              <span className="text-sm font-medium text-green-600">+2.3% ↗</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">平均检测时间</span>
              <span className="text-sm font-medium text-blue-600">-0.5天 ↘</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout
      title="质量检测"
      showBack={true}
      onBack={() => router.push('/processing')}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[90px] px-4">
        {/* 标签页导航 */}
        <div className="bg-white rounded-lg shadow-sm p-1 mb-4 flex">
          <button
            onClick={() => setActiveTab('tests')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tests'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            检测记录
          </button>
          <button
            onClick={() => setActiveTab('standards')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'standards'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            质量标准
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            数据分析
          </button>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'tests' && <TestsTab />}
        {activeTab === 'standards' && <StandardsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </main>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-[390px] mx-auto">
        <div className="flex space-x-3">
          <Button
            onClick={() => router.push('/processing/quality-tests/new')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            新建检测
          </Button>
          <Button
            onClick={() => router.push('/processing/quality-tests/reports')}
            variant="secondary"
            className="flex-1"
          >
            查看报告
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
