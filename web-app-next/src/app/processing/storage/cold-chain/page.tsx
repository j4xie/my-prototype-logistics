'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { AdvancedTable } from '@/components/ui/advanced-table';

export default function ColdChainStoragePage() {
  // Mock data for demonstration
  const mockColdChainData = {
    overview: {
      totalStorages: 6,
      normalTemp: 4,
      alertTemp: 2,
      totalCapacity: '850m³'
    },
    temperatureMonitor: [
      {
        zone: '冷藏区A',
        currentTemp: '2.5°C',
        targetTemp: '0-4°C',
        humidity: '85%',
        status: '正常',
        lastUpdate: '2024-02-25 15:30'
      },
      {
        zone: '冷冻区B',
        currentTemp: '-18.2°C',
        targetTemp: '-18°C',
        humidity: '90%',
        status: '正常',
        lastUpdate: '2024-02-25 15:30'
      },
      {
        zone: '冷藏区C',
        currentTemp: '6.8°C',
        targetTemp: '0-4°C',
        humidity: '88%',
        status: '温度偏高',
        lastUpdate: '2024-02-25 15:29'
      }
    ],
    coldStorages: [
      {
        id: 'CS001',
        name: '冷藏区A',
        type: '冷藏',
        capacity: '200m³',
        usage: '75%',
        products: '乳制品、肉类',
        status: '运行中',
        operator: '李管理员'
      },
      {
        id: 'CS002',
        name: '冷冻区B',
        type: '冷冻',
        capacity: '150m³',
        usage: '90%',
        products: '冷冻肉类',
        status: '运行中',
        operator: '王管理员'
      }
    ],
    equipment: [
      {
        id: 'EQ001',
        name: '制冷机组-1',
        zone: '冷藏区A',
        type: '压缩机',
        status: '正常运行',
        power: '12.5kW',
        lastMaintenance: '2024-01-15',
        nextMaintenance: '2024-04-15'
      },
      {
        id: 'EQ002',
        name: '制冷机组-2',
        zone: '冷冻区B',
        type: '压缩机',
        status: '正常运行',
        power: '18.2kW',
        lastMaintenance: '2024-01-20',
        nextMaintenance: '2024-04-20'
      }
    ],
    alerts: [
      {
        id: 'AL001',
        zone: '冷藏区C',
        type: '温度异常',
        message: '温度超出正常范围',
        currentValue: '6.8°C',
        threshold: '4°C',
        alertTime: '2024-02-25 15:25',
        status: '未处理'
      }
    ]
  };

  const temperatureColumns = [
    { key: 'zone', title: '区域' },
    { key: 'currentTemp', title: '当前温度' },
    { key: 'targetTemp', title: '目标温度' },
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
    { key: 'lastUpdate', title: '最后更新' }
  ];

  const storageColumns = [
    { key: 'id', title: '编号' },
    { key: 'name', title: '名称' },
    { key: 'type', title: '类型' },
    { key: 'capacity', title: '容量' },
    { key: 'usage', title: '使用率' },
    { key: 'products', title: '存储产品' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant="success">{value}</Badge>
      )
    },
    { key: 'operator', title: '负责人' }
  ];

  const equipmentColumns = [
    { key: 'id', title: '设备编号' },
    { key: 'name', title: '设备名称' },
    { key: 'zone', title: '所属区域' },
    { key: 'type', title: '设备类型' },
    {
      key: 'status',
      title: '运行状态',
      render: (value: string) => (
        <Badge variant={value === '正常运行' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'power', title: '功率' },
    { key: 'nextMaintenance', title: '下次保养' }
  ];

  const alertColumns = [
    { key: 'id', title: '报警编号' },
    { key: 'zone', title: '区域' },
    { key: 'type', title: '报警类型' },
    { key: 'message', title: '报警信息' },
    { key: 'currentValue', title: '当前值' },
    { key: 'threshold', title: '阈值' },
    { key: 'alertTime', title: '报警时间' },
    {
      key: 'status',
      title: '处理状态',
      render: (value: string) => (
        <Badge variant={value === '已处理' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    }
  ];

  return (
    <div className="max-w-[390px] mx-auto space-y-4 p-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">冷链存储管理</h1>
        <p className="text-sm text-gray-600 mt-1">温度监控与冷库管理</p>
      </div>

      {/* 冷链概览 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">冷链概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{mockColdChainData.overview.totalStorages}</div>
            <div className="text-xs text-gray-600">总存储区</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{mockColdChainData.overview.normalTemp}</div>
            <div className="text-xs text-gray-600">温度正常</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{mockColdChainData.overview.alertTemp}</div>
            <div className="text-xs text-gray-600">温度异常</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{mockColdChainData.overview.totalCapacity}</div>
            <div className="text-xs text-gray-600">总容量</div>
          </div>
        </div>
      </Card>

      {/* 温度监控 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">实时温度监控</h2>
          <Button size="small">刷新数据</Button>
        </div>
        <AdvancedTable
          data={mockColdChainData.temperatureMonitor}
          columns={temperatureColumns}
        />
      </Card>

      {/* 冷库管理 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">冷库管理</h2>
        <AdvancedTable
          data={mockColdChainData.coldStorages}
          columns={storageColumns}
        />
      </Card>

      {/* 设备状态 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">制冷设备状态</h2>
        <AdvancedTable
          data={mockColdChainData.equipment}
          columns={equipmentColumns}
        />
      </Card>

      {/* 温度报警 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">温度报警</h2>
        <AdvancedTable
          data={mockColdChainData.alerts}
          columns={alertColumns}
        />
      </Card>

      {/* 快速操作 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">快速操作</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🌡️</div>
            <div className="text-xs">温度校准</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🔧</div>
            <div className="text-xs">设备维护</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📊</div>
            <div className="text-xs">温度报告</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🚨</div>
            <div className="text-xs">报警设置</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
