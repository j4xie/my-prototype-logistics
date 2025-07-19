'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

interface DataPoint {
  id: string;
  type: 'temperature' | 'humidity' | 'ph' | 'oxygen' | 'feed' | 'weight';
  value: number;
  unit: string;
  timestamp: string;
  source: 'auto' | 'manual' | 'sensor';
  status: 'normal' | 'warning' | 'critical';
  deviceId?: string;
  location: string;
}

interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'camera' | 'scale';
  status: 'online' | 'offline' | 'maintenance';
  location: string;
  lastUpdate: string;
  batteryLevel?: number;
}

export default function DataCollectionCenterPage() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'devices' | 'manual' | 'history'>('realtime');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [realtimeData, setRealtimeData] = useState<DataPoint[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 使用useMemo优化Mock数据，避免每次渲染重新创建
  const mockRealtimeData = useMemo((): DataPoint[] => [
    {
      id: '1',
      type: 'temperature',
      value: 24.5,
      unit: '°C',
      timestamp: '2025-02-02 14:30:15',
      source: 'auto',
      status: 'normal',
      deviceId: 'sensor-001',
      location: 'A区-1号圈舍'
    },
    {
      id: '2',
      type: 'humidity',
      value: 68,
      unit: '%',
      timestamp: '2025-02-02 14:30:10',
      source: 'auto',
      status: 'normal',
      deviceId: 'sensor-001',
      location: 'A区-1号圈舍'
    },
    {
      id: '3',
      type: 'ph',
      value: 7.2,
      unit: 'pH',
      timestamp: '2025-02-02 14:29:45',
      source: 'auto',
      status: 'warning',
      deviceId: 'sensor-002',
      location: 'B区-饮水系统'
    },
    {
      id: '4',
      type: 'oxygen',
      value: 8.5,
      unit: 'mg/L',
      timestamp: '2025-02-02 14:29:30',
      source: 'auto',
      status: 'normal',
      deviceId: 'sensor-003',
      location: 'C区-水池'
    },
    {
      id: '5',
      type: 'weight',
      value: 245.8,
      unit: 'kg',
      timestamp: '2025-02-02 14:25:00',
      source: 'manual',
      status: 'normal',
      location: 'A区-称重台'
    }
  ], []);

  const mockDevices = useMemo((): Device[] => [
    {
      id: 'sensor-001',
      name: '环境传感器-01',
      type: 'sensor',
      status: 'online',
      location: 'A区-1号圈舍',
      lastUpdate: '2025-02-02 14:30:15',
      batteryLevel: 85
    },
    {
      id: 'sensor-002',
      name: '水质传感器-01',
      type: 'sensor',
      status: 'online',
      location: 'B区-饮水系统',
      lastUpdate: '2025-02-02 14:29:45',
      batteryLevel: 72
    },
    {
      id: 'sensor-003',
      name: '溶氧传感器-01',
      type: 'sensor',
      status: 'online',
      location: 'C区-水池',
      lastUpdate: '2025-02-02 14:29:30',
      batteryLevel: 90
    },
    {
      id: 'camera-001',
      name: '监控摄像头-01',
      type: 'camera',
      status: 'online',
      location: 'A区-全景',
      lastUpdate: '2025-02-02 14:30:20'
    },
    {
      id: 'scale-001',
      name: '电子秤-01',
      type: 'scale',
      status: 'offline',
      location: 'A区-称重台',
      lastUpdate: '2025-02-02 12:15:30',
      batteryLevel: 15
    }
  ], []);

  const displayRealtimeData = realtimeData || mockRealtimeData;
  const displayDevices = devices || mockDevices;

  // 刷新实时数据
  const refreshRealtime = useCallback(async () => {
    setIsLoading(true);
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 500));
             // 设置实时数据
        setRealtimeData(mockRealtimeData);
    } catch (error) {
      console.error('刷新实时数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mockRealtimeData]);

  // 刷新设备状态
  const refreshDevices = useCallback(async () => {
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 300));
      // 设置设备数据
      setDevices(mockDevices);
    } catch (error) {
      console.error('刷新设备状态失败:', error);
    }
  }, [mockDevices]);

  // 获取数据类型名称
  const getDataTypeName = (type: string) => {
    switch (type) {
      case 'temperature': return '环境温度';
      case 'humidity': return '相对湿度';
      case 'ph': return 'pH值';
      case 'oxygen': return '溶氧量';
      case 'weight': return '重量';
      case 'feed': return '饲料';
      default: return '数据';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // 获取设备状态
  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-red-600 bg-red-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 自动刷新
  useEffect(() => {
    // 初始化数据
    refreshRealtime();
    refreshDevices();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshRealtime();
      refreshDevices();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, refreshRealtime, refreshDevices]);

  // 手动数据录入
  const handleManualEntry = () => {
    window.location.href = '/farming/manual-collection';
  };

  // 二维码采集
  const handleQrCodeCollection = () => {
    window.location.href = '/farming/qrcode-collection';
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1 hover:bg-white/20 rounded"
              aria-label="返回"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-medium">数据采集中心</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded transition-colors ${
                autoRefresh ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              aria-label={autoRefresh ? '关闭自动刷新' : '开启自动刷新'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => {
                refreshRealtime();
                refreshDevices();
              }}
              className="p-2 hover:bg-white/20 rounded"
              aria-label="手动刷新"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[80px]">
        {/* 标签导航 */}
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'realtime', label: '实时数据' },
              { key: 'devices', label: '设备状态' },
              { key: 'manual', label: '手动录入' },
              { key: 'history', label: '历史记录' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-white text-[#1890FF] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 实时数据标签 */}
        {activeTab === 'realtime' && (
          <div className="px-4 space-y-4 mt-4">
            {/* 统计概览 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4 border">
                <div className="text-center">
                  <p className="text-sm text-gray-600">在线设备</p>
                  <p className="text-2xl font-medium text-gray-900">
                    {displayDevices.filter(d => d.status === 'online').length}
                  </p>
                  <p className="text-xs text-green-600">设备运行正常</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border">
                <div className="text-center">
                  <p className="text-sm text-gray-600">今日采集</p>
                  <p className="text-2xl font-medium text-gray-900">1,245</p>
                  <p className="text-xs text-blue-600">数据点</p>
                </div>
              </div>
            </div>

            {/* 设备筛选 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择设备
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
              >
                <option value="all">全部设备</option>
                {displayDevices.filter(d => d.status === 'online').map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} - {device.location}
                  </option>
                ))}
              </select>
            </div>

            {/* 实时数据列表 */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1890FF] mx-auto"></div>
                  <p className="text-gray-600 mt-2">加载中...</p>
                </div>
              ) : (
                displayRealtimeData
                  .filter(data => selectedDevice === 'all' || data.deviceId === selectedDevice)
                  .map((dataPoint) => (
                  <div key={dataPoint.id} className={`bg-white rounded-lg shadow-sm p-4 border ${getStatusColor(dataPoint.status)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {getDataTypeName(dataPoint.type)}
                        </h3>
                        <p className="text-sm text-gray-600">{dataPoint.location}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {dataPoint.source === 'auto' ? '自动' : '手动'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {dataPoint.timestamp}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-semibold text-gray-900">
                            {dataPoint.value}
                          </span>
                          <span className="text-sm text-gray-600">
                            {dataPoint.unit}
                          </span>
                        </div>
                        {dataPoint.status !== 'normal' && (
                          <span className="text-xs mt-1 block">
                            {dataPoint.status === 'warning' ? '异常' : '严重'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 设备状态标签 */}
        {activeTab === 'devices' && (
          <div className="px-4 space-y-4 mt-4">
            {/* 设备统计 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-3 text-center border">
                <p className="text-lg font-medium text-gray-900">
                  {displayDevices.filter(d => d.status === 'online').length}
                </p>
                <p className="text-xs text-green-600">在线</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-3 text-center border">
                <p className="text-lg font-medium text-gray-900">
                  {displayDevices.filter(d => d.status === 'offline').length}
                </p>
                <p className="text-xs text-red-600">离线</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-3 text-center border">
                <p className="text-lg font-medium text-gray-900">
                  {displayDevices.filter(d => d.status === 'maintenance').length}
                </p>
                <p className="text-xs text-yellow-600">维护</p>
              </div>
            </div>

            {/* 设备列表 */}
            <div className="space-y-3">
              {displayDevices.map((device) => (
                <div key={device.id} className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{device.name}</h3>
                      <p className="text-sm text-gray-600">{device.location}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        类型: {device.type === 'sensor' ? '传感器' : device.type === 'camera' ? '摄像头' : '秤'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${getDeviceStatusColor(device.status)}`}>
                        {device.status === 'online' && '在线'}
                        {device.status === 'offline' && '离线'}
                        {device.status === 'maintenance' && '维护中'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {device.lastUpdate}
                      </p>
                    </div>
                  </div>

                  {device.batteryLevel !== undefined && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">电池电量</span>
                        <span className={`${
                          device.batteryLevel > 30 ? 'text-green-600' :
                          device.batteryLevel > 15 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {device.batteryLevel}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            device.batteryLevel > 30 ? 'bg-green-500' :
                            device.batteryLevel > 15 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${device.batteryLevel}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 手动录入标签 */}
        {activeTab === 'manual' && (
          <div className="px-4 space-y-4 mt-4">
            {/* 快速录入 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <h2 className="text-lg font-medium text-gray-900 mb-4">快速数据录入</h2>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleManualEntry}
                  className="p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-[#1890FF] hover:bg-blue-50 transition-colors"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      📱
                    </div>
                    <p className="text-sm font-medium text-gray-900">手动录入</p>
                    <p className="text-xs text-gray-600">输入环境数据</p>
                  </div>
                </button>

                <button
                  onClick={handleQrCodeCollection}
                  className="p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-[#1890FF] hover:bg-blue-50 transition-colors"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      📷
                    </div>
                    <p className="text-sm font-medium text-gray-900">扫码采集</p>
                    <p className="text-xs text-gray-600">二维码数据</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 常用数据模板 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <h3 className="font-medium text-gray-900 mb-3">常用模板</h3>

              <div className="space-y-2">
                {[
                  { name: '环境监测', fields: ['温度', '湿度', 'pH值'] },
                  { name: '体重测量', fields: ['个体重量', '称重时间'] },
                  { name: '饲料投喂', fields: ['饲料类型', '投喂量', '时间'] },
                  { name: '疫苗接种', fields: ['疫苗类型', '接种剂量', '接种部位'] }
                ].map((template, index) => (
                  <button
                    key={index}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-[#1890FF] hover:bg-blue-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-600">
                      {template.fields.join('、')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 历史记录标签 */}
        {activeTab === 'history' && (
          <div className="px-4 space-y-4 mt-4">
            {/* 时间筛选 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <h3 className="font-medium text-gray-900 mb-3">时间范围</h3>
              <div className="grid grid-cols-3 gap-2">
                {['今天', '本周', '本月'].map((period) => (
                  <button
                    key={period}
                    className="py-2 px-3 text-sm border border-gray-200 rounded-lg hover:border-[#1890FF] hover:bg-blue-50 transition-colors"
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* 数据趋势 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <h3 className="font-medium text-gray-900 mb-3">数据趋势</h3>
              <div className="space-y-3">
                {[
                  { name: '平均温度', value: '24.2°C', trend: 'up', change: '+0.8°C' },
                  { name: '平均湿度', value: '65%', trend: 'down', change: '-3%' },
                  { name: 'pH均值', value: '7.1', trend: 'stable', change: '±0.1' }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.value}</span>
                      <span className={`text-xs ${
                        item.trend === 'up' ? 'text-green-600' :
                        item.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {item.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
