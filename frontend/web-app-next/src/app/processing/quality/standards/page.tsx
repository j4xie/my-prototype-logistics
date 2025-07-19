'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useApi } from '@/hooks/useApi-simple'

interface QualityStandard {
  id: string
  standardCode: string
  standardName: string
  category: 'meat' | 'processing' | 'packaging' | 'storage'
  version: string
  status: 'active' | 'draft' | 'archived'
  effectiveDate: string
  expiryDate: string
  creator: string
  createDate: string
  description: string
}

export default function QualityStandardsPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedStandard, setSelectedStandard] = useState<QualityStandard | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'draft'>('all')

  const { data: standards, loading, error, refetch } = useApi(
    () => fetch('/api/processing/quality/standards').then(res => res.json()),
    { cacheKey: 'quality-standards' }
  )

  const standardsData = (standards as { data: QualityStandard[] })?.data || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'meat': return 'bg-red-100 text-red-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'packaging': return 'bg-purple-100 text-purple-800'
      case 'storage': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    {
      key: 'standardCode',
      title: '标准编号',
      width: '100px'
    },
    {
      key: 'standardName',
      title: '标准名称',
      width: '120px'
    },
    {
      key: 'category',
      title: '类别',
      width: '80px',
      render: (value: string) => (
        <Badge className={getCategoryColor(value)}>
          {value === 'meat' ? '肉质' :
           value === 'processing' ? '加工' :
           value === 'packaging' ? '包装' :
           value === 'storage' ? '储存' : value}
        </Badge>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: '70px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'active' ? '生效' :
           value === 'draft' ? '草稿' : '归档'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '60px',
      render: (value: any, record: QualityStandard) => (
        <Button
          onClick={() => {
            setSelectedStandard(record)
            setShowModal(true)
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
        >
          查看
        </Button>
      )
    }
  ]

  if (loading) return <Loading size="lg" text="加载质检标准中..." />
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
          <h1 className="text-lg font-semibold text-gray-900">质检标准配置</h1>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            新增标准
          </Button>
        </div>

        <div className="flex space-x-1 mb-4">
          {[
            { key: 'all', label: '全部', count: standardsData.length },
            { key: 'active', label: '生效中', count: standardsData.filter(s => s.status === 'active').length },
            { key: 'draft', label: '草稿', count: standardsData.filter(s => s.status === 'draft').length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-red-50 rounded-lg p-2">
            <div className="font-semibold text-red-600">肉质</div>
            <div className="text-red-800">
              {standardsData.filter(s => s.category === 'meat').length}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-semibold text-blue-600">加工</div>
            <div className="text-blue-800">
              {standardsData.filter(s => s.category === 'processing').length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="font-semibold text-purple-600">包装</div>
            <div className="text-purple-800">
              {standardsData.filter(s => s.category === 'packaging').length}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="font-semibold text-orange-600">储存</div>
            <div className="text-orange-800">
              {standardsData.filter(s => s.category === 'storage').length}
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm p-4">
        <AdvancedTable
          data={standardsData.filter(standard => {
            if (activeTab === 'all') return true
            return standard.status === activeTab
          })}
          columns={columns}
          pagination={true}
          searchable={true}
          pageSize={8}
        />
      </Card>

      {showModal && selectedStandard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-[360px] w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">质检标准详情</h2>
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
                    <span className="text-gray-600">标准编号：</span>
                    <span className="font-medium">{selectedStandard.standardCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">标准名称：</span>
                    <span className="font-medium">{selectedStandard.standardName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">版本：</span>
                    <span className="font-medium">v{selectedStandard.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">生效日期：</span>
                    <span className="font-medium">{selectedStandard.effectiveDate}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">标准描述</h3>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700 leading-relaxed">
                    {selectedStandard.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                  编辑标准
                </Button>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  复制标准
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
