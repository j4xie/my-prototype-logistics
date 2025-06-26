'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useApi } from '@/hooks/useApi-simple'

interface TemperatureRecord {
  id: string
  deviceId: string
  deviceName: string
  location: string
  temperature: number
  humidity: number
  timestamp: string
  status: 'normal' | 'warning' | 'alarm'
  standardMin: number
  standardMax: number
  operator: string
  notes?: string
}

interface TemperatureDevice {
  id: string
  name: string
  location: string
  type: 'freezer' | 'refrigerator' | 'processing' | 'storage'
  status: 'online' | 'offline' | 'fault'
  lastUpdate: string
  currentTemp: number
  standardMin: number
  standardMax: number
}

export default function TemperatureMonitorPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<TemperatureRecord | null>(null)
  const [activeTab, setActiveTab] = useState<'records' | 'devices'>('records')
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'warning' | 'alarm'>('all')

  const { data: records, loading, error, refetch } = useApi(
    () => fetch('/api/processing/quality/temperature').then(res => res.json()),
    { cacheKey: 'temperature-records' }
  )

  const { data: devices } = useApi(
    () => fetch('/api/processing/quality/temperature/devices').then(res => res.json()),
    { cacheKey: 'temperature-devices' }
  )

  const recordsData = (records as { data: TemperatureRecord[] })?.data || []
  const devicesData = (devices as { data: TemperatureDevice[] })?.data || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'alarm': return 'bg-red-100 text-red-800'
      case 'online': return 'bg-green-100 text-green-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      case 'fault': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDeviceTypeColor = (type: string) => {
    switch (type) {
      case 'freezer': return 'bg-blue-100 text-blue-800'
      case 'refrigerator': return 'bg-cyan-100 text-cyan-800'
      case 'processing': return 'bg-purple-100 text-purple-800'
      case 'storage': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTempStatus = (temp: number, min: number, max: number) => {
    if (temp < min - 2 || temp > max + 2) return 'alarm'
    if (temp < min || temp > max) return 'warning'
    return 'normal'
  }

  const recordColumns = [
    {
      key: 'deviceName',
      title: '设备',
      width: '80px'
    },
    {
      key: 'location',
      title: '位置',
      width: '70px'
    },
    {
      key: 'temperature',
      title: '温度',
      width: '60px',
      render: (value: number, record: TemperatureRecord) => {
        const status = getTempStatus(value, record.standardMin, record.standardMax)
        return (
          <div className="text-center">
            <div className={`font-medium ${
              status === 'alarm' ? 'text-red-600' :
              status === 'warning' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {value}°C
            </div>
            <div className="text-xs text-gray-500">
              {record.standardMin}~{record.standardMax}°C
            </div>
          </div>
        )
      }
    },
    {
      key: 'humidity',
      title: '湿度',
      width: '50px',
      render: (value: number) => `${value}%`
    },
    {
      key: 'status',
      title: '状态',
      width: '60px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'normal' ? '正常' :
           value === 'warning' ? '预警' : '报警'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '60px',
      render: (value: any, record: TemperatureRecord) => (
        <Button
          onClick={() => {
            setSelectedRecord(record)
            setShowModal(true)
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
        >
          查看
        </Button>
      )
    }
  ]

  const deviceColumns = [
    {
      key: 'name',
      title: '设备名称',
      width: '80px'
    },
    {
      key: 'type',
      title: '类型',
      width: '60px',
      render: (value: string) => (
        <Badge className={getDeviceTypeColor(value)}>
          {value === 'freezer' ? '冷冻' :
           value === 'refrigerator' ? '冷藏' :
           value === 'processing' ? '加工' : '储存'}
        </Badge>
      )
    },
    {
      key: 'currentTemp',
      title: '当前温度',
      width: '70px',
      render: (value: number, record: TemperatureDevice) => {
        const status = getTempStatus(value, record.standardMin, record.standardMax)
        return (
          <div className={`text-center font-medium ${
            status === 'alarm' ? 'text-red-600' :
            status === 'warning' ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {value}°C
          </div>
        )
      }
    },
    {
      key: 'status',
      title: '状态',
      width: '60px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'online' ? '在线' :
           value === 'offline' ? '离线' : '故障'}
        </Badge>
      )
    },
    {
      key: 'location',
      title: '位置',
      width: '70px'
    }
  ]

  const filteredRecords = recordsData.filter(record => {
    if (statusFilter === 'all') return true
    const tempStatus = getTempStatus(record.temperature, record.standardMin, record.standardMax)
    return tempStatus === statusFilter
  })

  if (loading) return <Loading size="lg" text="加载温度监控数据中..." />
  if (error) return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-center text-red-500">
          加载失败
          <Button onClick={() => refetch()} className="ml-2 bg-blue-500 text-white">
            重试
          </Button>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">温度监控</h1>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            导出报告
          </Button>
        </div>

        <div className="flex space-x-1 mb-4">
          {[
            { key: 'records', label: '监控记录' },
            { key: 'devices', label: '设备管理' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'records' && (
          <div className="flex space-x-1 mb-4">
            {[
              { key: 'all', label: '全部', count: recordsData.length },
              { key: 'normal', label: '正常', count: recordsData.filter(r => getTempStatus(r.temperature, r.standardMin, r.standardMax) === 'normal').length },
              { key: 'warning', label: '预警', count: recordsData.filter(r => getTempStatus(r.temperature, r.standardMin, r.standardMax) === 'warning').length },
              { key: 'alarm', label: '报警', count: recordsData.filter(r => getTempStatus(r.temperature, r.standardMin, r.standardMax) === 'alarm').length }
            ].map(status => (
              <button
                key={status.key}
                onClick={() => setStatusFilter(status.key as any)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  statusFilter === status.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.label} ({status.count})
              </button>
            ))}
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
            <div className="bg-green-50 rounded-lg p-2">
              <div className="font-semibold text-green-600">在线</div>
              <div className="text-green-800">
                {devicesData.filter(d => d.status === 'online').length}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="font-semibold text-gray-600">离线</div>
              <div className="text-gray-800">
                {devicesData.filter(d => d.status === 'offline').length}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <div className="font-semibold text-red-600">故障</div>
              <div className="text-red-800">
                {devicesData.filter(d => d.status === 'fault').length}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-white rounded-lg shadow-sm p-4">
        <AdvancedTable
          data={activeTab === 'records' ? filteredRecords : devicesData}
          columns={activeTab === 'records' ? recordColumns : deviceColumns}
          pagination={true}
          searchable={true}
          pageSize={8}
        />
      </Card>

      {showModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-[360px] w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">温度记录详情</h2>
                <Button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 text-sm"
                >
                  关闭
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">监控信息</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">设备名称：</span>
                    <span className="font-medium">{selectedRecord.deviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">位置：</span>
                    <span className="font-medium">{selectedRecord.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">记录时间：</span>
                    <span className="font-medium">{selectedRecord.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作员：</span>
                    <span className="font-medium">{selectedRecord.operator}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">温湿度数据</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedRecord.temperature}°C
                    </div>
                    <div className="text-xs text-blue-700">当前温度</div>
                    <div className="text-xs text-gray-500 mt-1">
                      标准: {selectedRecord.standardMin}~{selectedRecord.standardMax}°C
                    </div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-cyan-600">
                      {selectedRecord.humidity}%
                    </div>
                    <div className="text-xs text-cyan-700">当前湿度</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">状态评估</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-center">
                    <Badge className={getStatusColor(getTempStatus(selectedRecord.temperature, selectedRecord.standardMin, selectedRecord.standardMax))}>
                      {getTempStatus(selectedRecord.temperature, selectedRecord.standardMin, selectedRecord.standardMax) === 'normal' ? '温度正常' :
                       getTempStatus(selectedRecord.temperature, selectedRecord.standardMin, selectedRecord.standardMax) === 'warning' ? '温度预警' : '温度报警'}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedRecord.notes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">备注信息</h3>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-sm text-yellow-700 leading-relaxed">
                      {selectedRecord.notes}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                  查看历史
                </Button>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  导出数据
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-4"></div>
    </div>
  )
}
