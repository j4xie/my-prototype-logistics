'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { useApi } from '@/hooks/useApi-simple'

interface QualityInspectionItem {
  id: string
  name: string
  standardValue: string
  actualValue: string
  result: 'pass' | 'fail' | 'warning'
  tester: string
  testTime: string
  method: string
  unit: string
}

interface QualityReport {
  id: string
  productId: string
  productName: string
  batchId: string
  reportDate: string
  inspector: string
  status: 'pass' | 'fail' | 'pending'
  overallScore: number
  inspectionItems: QualityInspectionItem[]
  conclusions: string
  recommendations: string
  certificateNumber?: string
  nextInspectionDate: string
}

export default function QualityReportDetailPage() {
  const params = useParams()
  const { data: report, loading, error, refetch } = useApi(
    () => fetch(`/api/processing/quality/reports/${params.id}`).then(res => res.json()),
    { immediate: false }
  )

  useEffect(() => {
    if (params.id) {
      refetch()
    }
  }, [params.id, refetch])

  if (loading) return <Loading size="lg" text="加载质检报告中..." />
  if (error) return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-center text-red-500">
          质检报告加载失败
          <Button onClick={() => refetch()} className="ml-2 bg-blue-500 text-white">
            重试
          </Button>
        </div>
      </Card>
    </div>
  )

  const reportData = report as QualityReport

  if (!reportData) return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-center text-gray-500">未找到质检报告</div>
      </Card>
    </div>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-100 text-green-800'
      case 'fail': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'pass': return '✅'
      case 'fail': return '❌'
      case 'warning': return '⚠️'
      default: return '⭕'
    }
  }

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 报告基本信息 */}
      <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md hover:scale-[1.03] transition-all duration-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">
              质检报告 #{reportData.id}
            </h1>
            <div className="text-sm text-gray-600">
              {reportData.productName} - {reportData.batchId}
            </div>
          </div>
          <Badge className={getStatusColor(reportData.status)}>
            {reportData.status === 'pass' ? '合格' :
             reportData.status === 'fail' ? '不合格' : '待审核'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">检验员：</span>
            <span className="font-medium">{reportData.inspector}</span>
          </div>
          <div>
            <span className="text-gray-500">检验日期：</span>
            <span className="font-medium">{reportData.reportDate}</span>
          </div>
          <div>
            <span className="text-gray-500">综合评分：</span>
            <span className="font-medium text-blue-600">{reportData.overallScore}分</span>
          </div>
          <div>
            <span className="text-gray-500">证书编号：</span>
            <span className="font-medium">{reportData.certificateNumber || '待生成'}</span>
          </div>
        </div>
      </Card>

      {/* 检验项目详情 */}
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3">检验项目明细</h2>
        <div className="space-y-3">
          {reportData.inspectionItems?.map((item) => (
            <div
              key={item.id}
              className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="text-lg">{getResultIcon(item.result)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    检验方法：{item.method} | 检验员：{item.tester}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">标准值：</span>
                  <div className="font-medium">{item.standardValue} {item.unit}</div>
                </div>
                <div>
                  <span className="text-gray-500">实测值：</span>
                  <div className="font-medium text-blue-600">{item.actualValue} {item.unit}</div>
                </div>
                <div>
                  <span className="text-gray-500">检验时间：</span>
                  <div className="font-medium">{item.testTime}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 检验结论与建议 */}
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3">检验结论</h2>
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {reportData.conclusions}
          </p>
        </div>

        {reportData.recommendations && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">改进建议</h3>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700 leading-relaxed">
                {reportData.recommendations}
              </p>
            </div>
          </>
        )}
      </Card>

      {/* 操作按钮 */}
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => window.print()}
          >
            打印报告
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => {
              // 导出PDF功能
              alert('PDF导出功能开发中')
            }}
          >
            导出PDF
          </Button>
        </div>

        <div className="mt-3 text-center text-xs text-gray-500">
          下次检验日期：{reportData.nextInspectionDate}
        </div>
      </Card>

      {/* 底部间距 */}
      <div className="h-4"></div>
    </div>
  )
}
