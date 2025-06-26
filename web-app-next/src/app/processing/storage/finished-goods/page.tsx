'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { AdvancedTable } from '@/components/ui/advanced-table';

export default function FinishedGoodsStoragePage() {
  // Mock data for demonstration
  const mockStorageData = {
    overview: {
      totalProducts: 856,
      readyToShip: 234,
      pendingQc: 12,
      totalValue: 892600
    },
    inventory: [
      {
        id: 'FG001',
        name: '优质面粉',
        batch: 'PB2024001',
        quantity: 500,
        unit: '袋',
        location: '成品区-A01',
        status: '待出货',
        productionDate: '2024-02-20',
        expiryDate: '2024-08-20',
        qcStatus: '已检验'
      },
      {
        id: 'FG002',
        name: '有机豆浆粉',
        batch: 'PB2024002',
        quantity: 200,
        unit: '袋',
        location: '成品区-B02',
        status: '质检中',
        productionDate: '2024-02-22',
        expiryDate: '2024-08-22',
        qcStatus: '待检验'
      }
    ],
    packaging: [
      {
        id: 'PK001',
        productName: '优质面粉',
        packageType: '25kg袋装',
        quantity: 100,
        operator: '张包装员',
        packageDate: '2024-02-21',
        status: '已完成'
      }
    ],
    shipments: [
      {
        id: 'SH001',
        productName: '优质面粉',
        quantity: 50,
        unit: '袋',
        customer: '华联超市',
        shipDate: '2024-02-23',
        operator: '李发货员',
        status: '已发货'
      }
    ],
    qualityCheck: [
      {
        batch: 'PB2024001',
        productName: '优质面粉',
        checkDate: '2024-02-21',
        inspector: '王质检员',
        testItems: '外观、水分、蛋白质',
        result: '合格',
        notes: '各项指标正常'
      }
    ]
  };

  const inventoryColumns = [
    { key: 'id', title: '编号' },
    { key: 'name', title: '产品名称' },
    { key: 'batch', title: '批次号' },
    { key: 'quantity', title: '数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'location', title: '存储位置' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '待出货' ? 'success' : value === '质检中' ? 'warning' : 'default'}>
          {value}
        </Badge>
      )
    },
    { key: 'expiryDate', title: '保质期' },
    {
      key: 'qcStatus',
      title: '质检状态',
      render: (value: string) => (
        <Badge variant={value === '已检验' ? 'success' : 'warning'}>
          {value}
        </Badge>
      )
    }
  ];

  const packagingColumns = [
    { key: 'id', title: '包装单号' },
    { key: 'productName', title: '产品名称' },
    { key: 'packageType', title: '包装规格' },
    { key: 'quantity', title: '包装数量' },
    { key: 'operator', title: '操作员' },
    { key: 'packageDate', title: '包装日期' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="success">{value}</Badge>
      )
    }
  ];

  const shipmentColumns = [
    { key: 'id', title: '发货单号' },
    { key: 'productName', title: '产品名称' },
    { key: 'quantity', title: '数量', render: (value: number, row: any) => `${value} ${row.unit}` },
    { key: 'customer', title: '客户' },
    { key: 'shipDate', title: '发货日期' },
    { key: 'operator', title: '操作员' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="success">{value}</Badge>
      )
    }
  ];

  const qualityColumns = [
    { key: 'batch', title: '批次号' },
    { key: 'productName', title: '产品名称' },
    { key: 'checkDate', title: '检验日期' },
    { key: 'inspector', title: '检验员' },
    { key: 'testItems', title: '检验项目' },
    {
      key: 'result',
      title: '检验结果',
      render: (value: string) => (
        <Badge variant={value === '合格' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'notes', title: '备注' }
  ];

  return (
    <div className="max-w-[390px] mx-auto space-y-4 p-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">成品存储管理</h1>
        <p className="text-sm text-gray-600 mt-1">成品库存与出货管理</p>
      </div>

      {/* 存储概览 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">存储概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{mockStorageData.overview.totalProducts}</div>
            <div className="text-xs text-gray-600">总产品数</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{mockStorageData.overview.readyToShip}</div>
            <div className="text-xs text-gray-600">待出货</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{mockStorageData.overview.pendingQc}</div>
            <div className="text-xs text-gray-600">待质检</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">¥{mockStorageData.overview.totalValue.toLocaleString()}</div>
            <div className="text-xs text-gray-600">库存价值</div>
          </div>
        </div>
      </Card>

      {/* 成品库存 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">成品库存</h2>
          <Button size="small">入库登记</Button>
        </div>
        <AdvancedTable
          data={mockStorageData.inventory}
          columns={inventoryColumns}
        />
      </Card>

      {/* 包装管理 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">包装管理</h2>
        <AdvancedTable
          data={mockStorageData.packaging}
          columns={packagingColumns}
        />
      </Card>

      {/* 出货管理 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">出货管理</h2>
        <AdvancedTable
          data={mockStorageData.shipments}
          columns={shipmentColumns}
        />
      </Card>

      {/* 质量保证 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">质量保证</h2>
        <AdvancedTable
          data={mockStorageData.qualityCheck}
          columns={qualityColumns}
        />
      </Card>

      {/* 快速操作 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">快速操作</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📦</div>
            <div className="text-xs">成品入库</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🏷️</div>
            <div className="text-xs">包装标签</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🚚</div>
            <div className="text-xs">发货出库</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🔍</div>
            <div className="text-xs">质量检验</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
