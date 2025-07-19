'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { AdvancedTable } from '@/components/ui/advanced-table';

export default function WarehouseConfigPage() {
  // Mock data for demonstration
  const mockConfigData = {
    overview: {
      totalZones: 8,
      activeZones: 7,
      users: 15,
      alertRules: 12
    },
    storageZones: [
      {
        id: 'Z001',
        name: '原料存储区A',
        type: '常温仓库',
        capacity: '500m³',
        usage: '75%',
        temperatureRange: '15-25°C',
        humidityRange: '50-70%',
        status: '运行中',
        manager: '李管理员'
      },
      {
        id: 'Z002',
        name: '冷藏区B',
        type: '冷藏仓库',
        capacity: '200m³',
        usage: '80%',
        temperatureRange: '0-4°C',
        humidityRange: '80-90%',
        status: '运行中',
        manager: '王管理员'
      }
    ],
    storageConditions: [
      {
        id: 'SC001',
        zoneName: '原料存储区A',
        parameter: '温度',
        minValue: '15°C',
        maxValue: '25°C',
        currentValue: '18°C',
        alertThreshold: '±2°C',
        status: '正常'
      },
      {
        id: 'SC002',
        zoneName: '冷藏区B',
        parameter: '温度',
        minValue: '0°C',
        maxValue: '4°C',
        currentValue: '2.5°C',
        alertThreshold: '±1°C',
        status: '正常'
      }
    ],
    userPermissions: [
      {
        id: 'UP001',
        username: '张操作员',
        role: '仓库操作员',
        zones: '原料区A, 成品区C',
        permissions: '入库、出库、查询',
        status: '启用',
        lastLogin: '2024-02-25 14:30'
      },
      {
        id: 'UP002',
        username: '李管理员',
        role: '仓库管理员',
        zones: '全部区域',
        permissions: '全部权限',
        status: '启用',
        lastLogin: '2024-02-25 15:20'
      }
    ],
    systemParams: [
      {
        id: 'SP001',
        category: '温度监控',
        parameter: '数据采集频率',
        value: '5分钟',
        description: '传感器数据采集间隔',
        lastModified: '2024-02-20'
      },
      {
        id: 'SP002',
        category: '库存管理',
        parameter: '库存预警阈值',
        value: '10%',
        description: '库存低于此比例时预警',
        lastModified: '2024-02-18'
      }
    ]
  };

  const zonesColumns = [
    { key: 'id', title: '区域编号' },
    { key: 'name', title: '区域名称' },
    { key: 'type', title: '仓库类型' },
    { key: 'capacity', title: '容量' },
    { key: 'usage', title: '使用率' },
    { key: 'temperatureRange', title: '温度范围' },
    { key: 'humidityRange', title: '湿度范围' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '运行中' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'manager', title: '负责人' }
  ];

  const conditionsColumns = [
    { key: 'zoneName', title: '存储区域' },
    { key: 'parameter', title: '参数' },
    { key: 'minValue', title: '最小值' },
    { key: 'maxValue', title: '最大值' },
    { key: 'currentValue', title: '当前值' },
    { key: 'alertThreshold', title: '报警阈值' },
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

  const permissionsColumns = [
    { key: 'username', title: '用户名' },
    { key: 'role', title: '角色' },
    { key: 'zones', title: '授权区域' },
    { key: 'permissions', title: '权限' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === '启用' ? 'success' : 'error'}>
          {value}
        </Badge>
      )
    },
    { key: 'lastLogin', title: '最后登录' }
  ];

  const paramsColumns = [
    { key: 'category', title: '参数分类' },
    { key: 'parameter', title: '参数名称' },
    { key: 'value', title: '参数值' },
    { key: 'description', title: '描述' },
    { key: 'lastModified', title: '最后修改' }
  ];

  return (
    <div className="max-w-[390px] mx-auto space-y-4 p-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-gray-900">仓库配置</h1>
        <p className="text-sm text-gray-600 mt-1">仓库系统配置与管理</p>
      </div>

      {/* 配置概览 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">配置概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{mockConfigData.overview.totalZones}</div>
            <div className="text-xs text-gray-600">存储区域</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{mockConfigData.overview.activeZones}</div>
            <div className="text-xs text-gray-600">运行区域</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{mockConfigData.overview.users}</div>
            <div className="text-xs text-gray-600">授权用户</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{mockConfigData.overview.alertRules}</div>
            <div className="text-xs text-gray-600">报警规则</div>
          </div>
        </div>
      </Card>

      {/* 存储区域配置 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">存储区域配置</h2>
          <Button size="small">新增区域</Button>
        </div>
        <AdvancedTable
          data={mockConfigData.storageZones}
          columns={zonesColumns}
        />
      </Card>

      {/* 存储条件设置 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">存储条件设置</h2>
          <Button size="small">修改设置</Button>
        </div>
        <AdvancedTable
          data={mockConfigData.storageConditions}
          columns={conditionsColumns}
        />
      </Card>

      {/* 用户权限管理 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">用户权限管理</h2>
          <Button size="small">新增用户</Button>
        </div>
        <AdvancedTable
          data={mockConfigData.userPermissions}
          columns={permissionsColumns}
        />
      </Card>

      {/* 系统参数配置 */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">系统参数配置</h2>
          <Button size="small">修改参数</Button>
        </div>
        <AdvancedTable
          data={mockConfigData.systemParams}
          columns={paramsColumns}
        />
      </Card>

      {/* 快速操作 */}
      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">快速操作</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">🏭</div>
            <div className="text-xs">区域管理</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">⚙️</div>
            <div className="text-xs">系统设置</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">👥</div>
            <div className="text-xs">权限管理</div>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center p-4 h-auto">
            <div className="text-lg mb-1">📋</div>
            <div className="text-xs">备份配置</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
