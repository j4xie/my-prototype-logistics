'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useApi } from '@/hooks/useApi-simple'

interface HACCPPoint {
  id: string
  pointName: string
  processStep: string
  hazardType: 'biological' | 'chemical' | 'physical'
  criticalLimit: string
  monitoringMethod: string
  frequency: string
  responsibility: string
  correctiveAction: string
  status: 'normal' | 'deviation' | 'critical'
  lastCheck: string
  nextCheck: string
}

export default function HACCPPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<HACCPPoint | null>(null)

  const { data: points, loading, error, refetch } = useApi(
    () => fetch('/api/processing/quality/haccp/points').then(res => res.json()),
    { cacheKey: 'haccp-points' }
  )

  const pointsData = (points as { data: HACCPPoint[] })?.data || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'deviation': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getHazardTypeColor = (type: string) => {
    switch (type) {
      case 'biological': return 'bg-red-100 text-red-800'
      case 'chemical': return 'bg-blue-100 text-blue-800'
      case 'physical': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    {
      key: 'pointName',
      title: 'CCP名称',
      width: '100px'
    },
    {
      key: 'processStep',
      title: '工艺步骤',
      width: '80px'
    },
    {
      key: 'hazardType',
      title: '危害类型',
      width: '70px',
      render: (value: string) => (
        <Badge className={getHazardTypeColor(value)}>
          {value === 'biological' ? '生物' :
           value === 'chemical' ? '化学' : '物理'}
        </Badge>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: '60px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'normal' ? '正常' :
           value === 'deviation' ? '偏差' : '严重'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '60px',
      render: (value: any, record: HACCPPoint) => (
        <Button
          onClick={() => {
            setSelectedPoint(record)
            setShowModal(true)
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1"
        >
          查看
        </Button>
      )
    }
  ]

  if (loading) return <Loading size="lg" text="加载HACCP数据中..." />
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
          <h1 className="text-lg font-semibold text-gray-900">HACCP管理</h1>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            新增CCP
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
          <div className="bg-green-50 rounded-lg p-2">
            <div className="font-semibold text-green-600">正常</div>
            <div className="text-green-800">
              {pointsData.filter(p => p.status === 'normal').length}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2">
            <div className="font-semibold text-yellow-600">偏差</div>
            <div className="text-yellow-800">
              {pointsData.filter(p => p.status === 'deviation').length}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <div className="font-semibold text-red-600">严重</div>
            <div className="text-red-800">
              {pointsData.filter(p => p.status === 'critical').length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
          <div className="bg-red-50 rounded-lg p-2">
            <div className="font-semibold text-red-600">生物</div>
            <div className="text-red-800">
              {pointsData.filter(p => p.hazardType === 'biological').length}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-semibold text-blue-600">化学</div>
            <div className="text-blue-800">
              {pointsData.filter(p => p.hazardType === 'chemical').length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="font-semibold text-purple-600">物理</div>
            <div className="text-purple-800">
              {pointsData.filter(p => p.hazardType === 'physical').length}
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white rounded-lg shadow-sm p-4">
        <AdvancedTable
          data={pointsData}
          columns={columns}
          pagination={true}
          searchable={true}
          pageSize={8}
        />
      </Card>

      {showModal && selectedPoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-[360px] w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">CCP详情</h2>
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
                    <span className="text-gray-600">CCP名称：</span>
                    <span className="font-medium">{selectedPoint.pointName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">工艺步骤：</span>
                    <span className="font-medium">{selectedPoint.processStep}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">责任人：</span>
                    <span className="font-medium">{selectedPoint.responsibility}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">关键限值</h3>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700 font-medium">
                    {selectedPoint.criticalLimit}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">监控方法</h3>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm text-purple-700">
                    {selectedPoint.monitoringMethod}
                  </p>
                  <div className="text-xs text-purple-600 mt-2">
                    监控频率：{selectedPoint.frequency}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">纠正措施</h3>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-sm text-orange-700 leading-relaxed">
                    {selectedPoint.correctiveAction}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                  编辑CCP
                </Button>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                  添加记录
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
