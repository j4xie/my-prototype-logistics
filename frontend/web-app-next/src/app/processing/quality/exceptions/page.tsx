'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useApi } from '@/hooks/useApi-simple'

interface QualityException {
  id: string
  exceptionType: 'product' | 'process' | 'equipment' | 'environment'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  batchNumber: string
  productName: string
  location: string
  detectedBy: string
  detectedTime: string
  status: 'pending' | 'investigating' | 'resolved' | 'closed'
  assignedTo: string
  resolvedTime?: string
  correctionAction?: string
  preventiveAction?: string
  impact: string
  priority: number
}

export default function QualityExceptionsPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedException, setSelectedException] = useState<QualityException | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'closed'>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')

  const { data: exceptions, loading, error, refetch } = useApi(
    () => fetch('/api/processing/quality/exceptions').then(res => res.json()),
    { cacheKey: 'quality-exceptions' }
  )

  const exceptionsData = (exceptions as { data: QualityException[] })?.data || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'investigating': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getExceptionTypeColor = (type: string) => {
    switch (type) {
      case 'product': return 'bg-red-100 text-red-800'
      case 'process': return 'bg-blue-100 text-blue-800'
      case 'equipment': return 'bg-purple-100 text-purple-800'
      case 'environment': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredData = exceptionsData.filter(exception => {
    const statusMatch = statusFilter === 'all' || exception.status === statusFilter
    const severityMatch = severityFilter === 'all' || exception.severity === severityFilter
    return statusMatch && severityMatch
  })

  const columns = [
    {
      key: 'title',
      title: '异常标题',
      width: '120px'
    },
    {
      key: 'exceptionType',
      title: '类型',
      width: '60px',
      render: (value: string) => (
        <Badge className={getExceptionTypeColor(value)}>
          {value === 'product' ? '产品' :
           value === 'process' ? '工艺' :
           value === 'equipment' ? '设备' : '环境'}
        </Badge>
      )
    },
    {
      key: 'severity',
      title: '严重度',
      width: '60px',
      render: (value: string) => (
        <Badge className={getSeverityColor(value)}>
          {value === 'low' ? '低' :
           value === 'medium' ? '中' :
           value === 'high' ? '高' : '严重'}
        </Badge>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: '60px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'pending' ? '待处理' :
           value === 'investigating' ? '调查中' :
           value === 'resolved' ? '已解决' : '已关闭'}
        </Badge>
      )
    },
    {
      key: 'detectedTime',
      title: '发现时间',
      width: '80px',
      render: (value: string) => (
        <span className="text-xs">{value}</span>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '60px',
      render: (value: any, record: QualityException) => (
        <Button
          onClick={() => {
            setSelectedException(record)
            setShowModal(true)
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
        >
          查看
        </Button>
      )
    }
  ]

  if (loading) return <Loading size="lg" text="加载异常数据中..." />
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
          <h1 className="text-lg font-semibold text-gray-900">质检异常</h1>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            新增异常
          </Button>
        </div>

        <div className="flex space-x-1 mb-4 overflow-x-auto">
          {[
            { key: 'all', label: '全部', count: exceptionsData.length },
            { key: 'pending', label: '待处理', count: exceptionsData.filter(e => e.status === 'pending').length },
            { key: 'investigating', label: '调查中', count: exceptionsData.filter(e => e.status === 'investigating').length },
            { key: 'resolved', label: '已解决', count: exceptionsData.filter(e => e.status === 'resolved').length }
          ].map(status => (
            <button
              key={status.key}
              onClick={() => setStatusFilter(status.key as any)}
              className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                statusFilter === status.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.label} ({status.count})
            </button>
          ))}
        </div>

        <div className="flex space-x-1 mb-4">
          {[
            { key: 'all', label: '全部严重度', count: exceptionsData.length },
            { key: 'critical', label: '严重', count: exceptionsData.filter(e => e.severity === 'critical').length },
            { key: 'high', label: '高', count: exceptionsData.filter(e => e.severity === 'high').length },
            { key: 'medium', label: '中', count: exceptionsData.filter(e => e.severity === 'medium').length }
          ].map(severity => (
            <button
              key={severity.key}
              onClick={() => setSeverityFilter(severity.key as any)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                severityFilter === severity.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {severity.label} ({severity.count})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-red-50 rounded-lg p-2">
            <div className="font-semibold text-red-600">产品</div>
            <div className="text-red-800">
              {exceptionsData.filter(e => e.exceptionType === 'product').length}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-semibold text-blue-600">工艺</div>
            <div className="text-blue-800">
              {exceptionsData.filter(e => e.exceptionType === 'process').length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="font-semibold text-purple-600">设备</div>
            <div className="text-purple-800">
              {exceptionsData.filter(e => e.exceptionType === 'equipment').length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="font-semibold text-green-600">环境</div>
            <div className="text-green-800">
              {exceptionsData.filter(e => e.exceptionType === 'environment').length}
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm p-4">
        <AdvancedTable
          data={filteredData}
          columns={columns}
          pagination={true}
          searchable={true}
          pageSize={8}
        />
      </Card>

      {showModal && selectedException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-[360px] w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">异常详情</h2>
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
                <h3 className="font-semibold text-gray-900 mb-2">基本信息</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">异常标题：</span>
                    <span className="font-medium">{selectedException.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">产品批次：</span>
                    <span className="font-medium">{selectedException.batchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">产品名称：</span>
                    <span className="font-medium">{selectedException.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">发现位置：</span>
                    <span className="font-medium">{selectedException.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">发现人：</span>
                    <span className="font-medium">{selectedException.detectedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">发现时间：</span>
                    <span className="font-medium">{selectedException.detectedTime}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">异常分类</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <Badge className={getExceptionTypeColor(selectedException.exceptionType)}>
                      {selectedException.exceptionType === 'product' ? '产品异常' :
                       selectedException.exceptionType === 'process' ? '工艺异常' :
                       selectedException.exceptionType === 'equipment' ? '设备异常' : '环境异常'}
                    </Badge>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <Badge className={getSeverityColor(selectedException.severity)}>
                      {selectedException.severity === 'low' ? '低严重度' :
                       selectedException.severity === 'medium' ? '中严重度' :
                       selectedException.severity === 'high' ? '高严重度' : '严重'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">异常描述</h3>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 leading-relaxed">
                    {selectedException.description}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">影响评估</h3>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-sm text-orange-700 leading-relaxed">
                    {selectedException.impact}
                  </p>
                </div>
              </div>

              {selectedException.correctionAction && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">纠正措施</h3>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-green-700 leading-relaxed">
                      {selectedException.correctionAction}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">处理状态</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(selectedException.status)}>
                      {selectedException.status === 'pending' ? '等待处理' :
                       selectedException.status === 'investigating' ? '调查中' :
                       selectedException.status === 'resolved' ? '已解决' : '已关闭'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      负责人：{selectedException.assignedTo}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                  更新状态
                </Button>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  添加措施
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
