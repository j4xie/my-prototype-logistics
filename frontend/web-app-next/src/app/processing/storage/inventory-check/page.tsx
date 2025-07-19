'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { AdvancedTable } from '@/components/ui/advanced-table';

export default function InventoryCheckPage() {
  // Mock data for demonstration
  const mockInventoryData = {
    overview: {
      totalPlans: 12,
      inProgress: 3,
      completed: 8,
      pending: 1
    },
    checkPlans: [
      {
        id: 'IC001',
        name: '月度库存盘点',
        type: '定期盘点',
        zone: '全库区',
        planDate: '2024-02-28',
        executor: '张盘点员',
        status: '进行中',
        progress: '65%'
      },
      {
        id: 'IC002',
        name: '原料区专项盘点',
        type: '专项盘点',
        zone: '原料存储区',
        planDate: '2024-03-05',
        executor: '李盘点员',
        status: '待开始',
        progress: '0%'
      }
    ],
    checkRecords: [
      {
        id: 'CR001',
        planId: 'IC001',
        itemName: '优质小麦',
        itemCode: 'RM001',
        bookQuantity: 500,
        actualQuantity: 495,
        difference: -5,
        unit: '吨',
        checker: '张盘点员',
        checkTime: '2024-02-25 14:30',
        status: '差异'
      },
      {
        id: 'CR002',
        planId: 'IC001',
        itemName: '有机大豆',
        itemCode: 'RM002',
        bookQuantity: 15,
        actualQuantity: 15,
        difference: 0,
        unit: '吨',
        checker: '张盘点员',
        checkTime: '2024-02-25 14:45',
        status: '正常'
      }
    ],
    differences: [
      {
        id: 'DF001',
        itemName: '优质小麦',
        itemCode: 'RM001',
        bookQuantity: 500,
        actualQuantity: 495,
        difference: -5,
        unit: '吨',
        differenceRate: '-1.0%',
        reason: '自然损耗',
        handler: '王管理员',
        handleTime: '2024-02-25 16:00',
        status: '已处理'
      }
    ],
    reports: [
      {
        id: 'RP001',
        planName: '1月库存盘点',
        checkDate: '2024-01-31',
        totalItems: 156,
        normalItems: 148,
        differenceItems: 8,
        accuracy: '94.9%',
        status: '已完成'
      }
    ]
  };

  const plansColumns = [
    { key: 'id', title: '计划编号' },
    { key: 'name', title: '盘点名称' },
    { key: 'type', title: '盘点类型' },
    { key: 'zone', title: '盘点区域' },
    { key: 'planDate', title: '计划日期' },
    { key: 'executor', title: '执行人' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '进行中' ? 'warning' : value === '已完成' ? 'success' : 'default'}>
          {value}
        </Badge>
      )
    },
    { key: 'progress', title: '进度' }
  ];

  const recordsColumns = [
    { key: 'itemName', title: '物品名称' },
    { key: 'itemCode', title: '物品编码' },
    { key: 'bookQuantity', title: '账面数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'actualQuantity', title: '实际数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'difference', title: '差异', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'checker', title: '盘点员' },
    { key: 'checkTime', title: '盘点时间' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '正常' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    }
  ];

  const differencesColumns = [
    { key: 'itemName', title: '物品名称' },
    { key: 'itemCode', title: '物品编码' },
    { key: 'difference', title: '差异数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'differenceRate', title: '差异率' },
    { key: 'reason', title: '差异原因' },
    { key: 'handler', title: '处理人' },
    { key: 'handleTime', title: '处理时间' },
    {
      key: 'status',
      title: '处理状态',
      render: (value: string) => (
        <Badge variant={value === '已处理' ? 'success' : 'warning'}>
          {value}
        </Badge>
      )
    }
  ];

  const reportsColumns = [
    { key: 'id', title: '报告编号' },
    { key: 'planName', title: '盘点名称' },
    { key: 'checkDate', title: '盘点日期' },
    { key: 'totalItems', title: '总盘点项' },
    { key: 'normalItems', title: '正常项' },
    { key: 'differenceItems', title: '差异项' },
    { key: 'accuracy', title: '准确率' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="success">{value}</Badge>
      )
    }
  ];

  return (
    <div className="max-w-[390px] mx-auto space-y-4 p-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">库存盘点</h1>
        <p className="text-sm text-gray-600 mt-1">库存盘点管理与分析</p>
      </div>

      {/* 盘点概览 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">盘点概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{mockInventoryData.overview.totalPlans}</div>
            <div className="text-xs text-gray-600">总计划数</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{mockInventoryData.overview.inProgress}</div>
            <div className="text-xs text-gray-600">进行中</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{mockInventoryData.overview.completed}</div>
            <div className="text-xs text-gray-600">已完成</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{mockInventoryData.overview.pending}</div>
            <div className="text-xs text-gray-600">待开始</div>
          </div>
        </div>
      </Card>

      {/* 盘点计划 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">盘点计划</h2>
          <Button size="small">新建计划</Button>
        </div>
        <AdvancedTable
          data={mockInventoryData.checkPlans}
          columns={plansColumns}
        />
      </Card>

      {/* 盘点记录 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">盘点记录</h2>
        <AdvancedTable
          data={mockInventoryData.checkRecords}
          columns={recordsColumns}
        />
      </Card>

      {/* 差异分析 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">差异分析</h2>
        <AdvancedTable
          data={mockInventoryData.differences}
          columns={differencesColumns}
        />
      </Card>

      {/* 盘点报告 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">盘点报告</h2>
        <AdvancedTable
          data={mockInventoryData.reports}
          columns={reportsColumns}
        />
      </Card>

      {/* 快速操作 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">快速操作</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📋</div>
            <div className="text-xs">新建盘点</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📱</div>
            <div className="text-xs">扫码盘点</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">⚠️</div>
            <div className="text-xs">差异处理</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📊</div>
            <div className="text-xs">盘点报告</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
