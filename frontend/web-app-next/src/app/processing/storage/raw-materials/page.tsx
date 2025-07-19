'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { AdvancedTable } from '@/components/ui/advanced-table';

export default function RawMaterialsStoragePage() {
  // Mock data for demonstration
  const mockStorageData = {
    overview: {
      totalItems: 1245,
      lowStock: 8,
      expiringSoon: 3,
      totalValue: 125600
    },
    inventory: [
      {
        id: 'RM001',
        name: '优质小麦',
        category: '谷物',
        quantity: 500,
        unit: '吨',
        location: 'A区-01',
        status: '正常',
        expiryDate: '2024-06-15',
        supplier: '金田农业'
      },
      {
        id: 'RM002',
        name: '有机大豆',
        category: '豆类',
        quantity: 15,
        unit: '吨',
        location: 'B区-03',
        status: '库存不足',
        expiryDate: '2024-05-20',
        supplier: '绿色农场'
      }
    ],
    inboundRecords: [
      {
        id: 'IN001',
        materialName: '优质小麦',
        quantity: 100,
        unit: '吨',
        supplier: '金田农业',
        receivedDate: '2024-02-15',
        inspector: '李检验员',
        status: '已验收'
      }
    ],
    outboundRecords: [
      {
        id: 'OUT001',
        materialName: '优质小麦',
        quantity: 50,
        unit: '吨',
        purpose: '生产批次PB2024001',
        issuedDate: '2024-02-20',
        operator: '王仓管员',
        status: '已出库'
      }
    ],
    storageConditions: [
      {
        zone: 'A区',
        temperature: '18°C',
        humidity: '65%',
        status: '正常',
        lastCheck: '2024-02-25 14:30'
      },
      {
        zone: 'B区',
        temperature: '16°C',
        humidity: '70%',
        status: '湿度偏高',
        lastCheck: '2024-02-25 14:35'
      }
    ]
  };

  const inventoryColumns = [
    { key: 'id', title: '编号' },
    { key: 'name', title: '原料名称' },
    { key: 'category', title: '类别' },
    { key: 'quantity', title: '数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'location', title: '存储位置' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '正常' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'expiryDate', title: '到期日期' },
    { key: 'supplier', title: '供应商' }
  ];

  const inboundColumns = [
    { key: 'id', title: '入库单号' },
    { key: 'materialName', title: '原料名称' },
    { key: 'quantity', title: '数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'supplier', title: '供应商' },
    { key: 'receivedDate', title: '入库日期' },
    { key: 'inspector', title: '验收员' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="primary">{value}</Badge>
      )
    }
  ];

  const outboundColumns = [
    { key: 'id', title: '出库单号' },
    { key: 'materialName', title: '原料名称' },
    { key: 'quantity', title: '数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'purpose', title: '用途' },
    { key: 'issuedDate', title: '出库日期' },
    { key: 'operator', title: '操作员' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="primary">{value}</Badge>
      )
    }
  ];

  const conditionColumns = [
    { key: 'zone', title: '区域' },
    { key: 'temperature', title: '温度' },
    { key: 'humidity', title: '湿度' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '正常' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'lastCheck', title: '最后检查' }
  ];

  return (
    <div className="max-w-[390px] mx-auto space-y-4 p-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">原料存储管理</h1>
        <p className="text-sm text-gray-600 mt-1">原料库存监控与管理</p>
      </div>

      {/* 存储概览 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">存储概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{mockStorageData.overview.totalItems}</div>
            <div className="text-xs text-gray-600">总库存数</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{mockStorageData.overview.lowStock}</div>
            <div className="text-xs text-gray-600">库存不足</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{mockStorageData.overview.expiringSoon}</div>
            <div className="text-xs text-gray-600">即将过期</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">¥{mockStorageData.overview.totalValue.toLocaleString()}</div>
            <div className="text-xs text-gray-600">库存价值</div>
          </div>
        </div>
      </Card>

      {/* 库存清单 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">库存清单</h2>
          <Button size="small">新增入库</Button>
        </div>
        <AdvancedTable
          data={mockStorageData.inventory}
          columns={inventoryColumns}
        />
      </Card>

      {/* 入库记录 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">入库记录</h2>
        <AdvancedTable
          data={mockStorageData.inboundRecords}
          columns={inboundColumns}
        />
      </Card>

      {/* 出库记录 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">出库记录</h2>
        <AdvancedTable
          data={mockStorageData.outboundRecords}
          columns={outboundColumns}
        />
      </Card>

      {/* 存储条件监控 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">存储条件监控</h2>
        <AdvancedTable
          data={mockStorageData.storageConditions}
          columns={conditionColumns}
        />
      </Card>

      {/* 快速操作 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">快速操作</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📦</div>
            <div className="text-xs">入库登记</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📤</div>
            <div className="text-xs">出库申请</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🌡️</div>
            <div className="text-xs">环境检查</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📊</div>
            <div className="text-xs">库存盘点</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
