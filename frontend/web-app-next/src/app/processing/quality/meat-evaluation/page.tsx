'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useApi } from '@/hooks/useApi-simple'

interface MeatEvaluationRecord {
  id: string
  batchId: string
  productName: string
  evaluationDate: string
  evaluator: string
  meatGrade: 'Premium' | 'Grade A' | 'Grade B' | 'Grade C'
  overallScore: number
  sensoryEvaluation: {
    color: number
    texture: number
    marbling: number
    smell: number
    elasticity: number
  }
  physicalChemical: {
    pH: number
    moisture: number
    fat: number
    protein: number
    waterActivity: number
  }
  microbiological: {
    totalCount: number
    ecoli: string
    salmonella: string
    listeria: string
  }
  status: 'pending' | 'approved' | 'rejected'
  notes: string
}

export default function MeatEvaluationPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MeatEvaluationRecord | null>(null)

  const { data: records, loading, error, refetch } = useApi(
    () => fetch('/api/processing/quality/meat-evaluation').then(res => res.json()),
    { cacheKey: 'meat-evaluation-records' }
  )

  const evaluationRecords = (records as { data: MeatEvaluationRecord[] })?.data || []

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'Premium': return 'bg-purple-100 text-purple-800'
      case 'Grade A': return 'bg-green-100 text-green-800'
      case 'Grade B': return 'bg-yellow-100 text-yellow-800'
      case 'Grade C': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    {
      key: 'batchId',
      title: '批次号',
      width: '80px',
      render: (value: string) => (
        <span className="font-mono text-xs">{value}</span>
      )
    },
    {
      key: 'productName',
      title: '产品名称',
      width: '100px'
    },
    {
      key: 'meatGrade',
      title: '肉质等级',
      width: '80px',
      render: (value: string) => (
        <Badge className={getGradeColor(value)}>
          {value}
        </Badge>
      )
    },
    {
      key: 'overallScore',
      title: '综合评分',
      width: '70px',
      render: (value: number) => (
        <span className="font-semibold text-blue-600">{value}</span>
      )
    },
    {
      key: 'evaluationDate',
      title: '评定日期',
      width: '80px',
      render: (value: string) => (
        <span className="text-xs">{value}</span>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: '60px',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'approved' ? '已批准' :
           value === 'pending' ? '待审核' : '已拒绝'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '60px',
      render: (value: any, record: MeatEvaluationRecord) => (
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



  if (loading) return <Loading size="lg" text="加载肉质评定记录中..." />
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
      {/* 页面标题和操作 */}
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">肉质评定管理</h1>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            新增评定
          </Button>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="font-semibold text-purple-600">Premium</div>
            <div className="text-purple-800">
              {evaluationRecords.filter(r => r.meatGrade === 'Premium').length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="font-semibold text-green-600">Grade A</div>
            <div className="text-green-800">
              {evaluationRecords.filter(r => r.meatGrade === 'Grade A').length}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2">
            <div className="font-semibold text-yellow-600">Grade B</div>
            <div className="text-yellow-800">
              {evaluationRecords.filter(r => r.meatGrade === 'Grade B').length}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="font-semibold text-orange-600">Grade C</div>
            <div className="text-orange-800">
              {evaluationRecords.filter(r => r.meatGrade === 'Grade C').length}
            </div>
          </div>
        </div>
      </Card>

      {/* 评定记录列表 */}
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <AdvancedTable
          data={evaluationRecords}
          columns={columns}
          pagination={true}
          searchable={true}
          pageSize={8}
        />
      </Card>

      {/* 详情模态框 */}
      {showModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-[360px] w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">肉质评定详情</h2>
                <Button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 text-sm"
                >
                  关闭
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">基本信息</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">批次号：</span>
                    <span className="font-medium">{selectedRecord.batchId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">产品名称：</span>
                    <span className="font-medium">{selectedRecord.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">评定员：</span>
                    <span className="font-medium">{selectedRecord.evaluator}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">评定日期：</span>
                    <span className="font-medium">{selectedRecord.evaluationDate}</span>
                  </div>
                </div>
              </div>

              {/* 感官评价 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">感官评价 (满分10分)</h3>
                <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm">
                  {Object.entries(selectedRecord.sensoryEvaluation).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">
                        {key === 'color' ? '色泽' :
                         key === 'texture' ? '质地' :
                         key === 'marbling' ? '大理石纹' :
                         key === 'smell' ? '气味' :
                         key === 'elasticity' ? '弹性' : key}：
                      </span>
                      <span className="font-medium text-blue-600">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 理化指标 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">理化指标</h3>
                <div className="bg-green-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">pH值：</span>
                    <span className="font-medium">{selectedRecord.physicalChemical.pH}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">水分 (%)：</span>
                    <span className="font-medium">{selectedRecord.physicalChemical.moisture}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">脂肪 (%)：</span>
                    <span className="font-medium">{selectedRecord.physicalChemical.fat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">蛋白质 (%)：</span>
                    <span className="font-medium">{selectedRecord.physicalChemical.protein}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">水分活度：</span>
                    <span className="font-medium">{selectedRecord.physicalChemical.waterActivity}</span>
                  </div>
                </div>
              </div>

              {/* 微生物指标 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">微生物检测</h3>
                <div className="bg-yellow-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">菌落总数：</span>
                    <span className="font-medium">{selectedRecord.microbiological.totalCount} CFU/g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">大肠杆菌：</span>
                    <span className="font-medium">{selectedRecord.microbiological.ecoli}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">沙门氏菌：</span>
                    <span className="font-medium">{selectedRecord.microbiological.salmonella}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">李斯特菌：</span>
                    <span className="font-medium">{selectedRecord.microbiological.listeria}</span>
                  </div>
                </div>
              </div>

              {/* 评定结果 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">评定结果</h3>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {selectedRecord.meatGrade}
                  </div>
                  <div className="text-lg font-semibold text-purple-800">
                    综合评分: {selectedRecord.overallScore}分
                  </div>
                </div>
              </div>

              {/* 备注 */}
              {selectedRecord.notes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">备注</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                    {selectedRecord.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部间距 */}
      <div className="h-4"></div>
    </div>
  )
}
