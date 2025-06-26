'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useProcessing } from '@/hooks/useApi-simple'

export default function ProductionReportsPage() {
  const { useProcessingRecords } = useProcessing()
  const { data, loading, error } = useProcessingRecords()

  if (loading) return (
    <div className="max-w-[390px] mx-auto p-4">
      <div className="text-center py-8">加载中...</div>
    </div>
  )

  if (error) return (
    <div className="max-w-[390px] mx-auto p-4">
      <div className="text-center py-8 text-red-500">加载失败: {error.message}</div>
    </div>
  )

  // Mock数据处理
  const mockReports = [
    {
      id: 'RPT001',
      reportType: '日产量报表',
      period: '2025-02-03',
      totalOutput: 1250,
      unit: 'kg',
      efficiency: '94%',
      qualityPass: '99.2%',
      status: 'completed',
      generatedAt: '2025-02-03 18:00'
    },
    {
      id: 'RPT002',
      reportType: '周效率分析',
      period: '2025-01-27 ~ 2025-02-02',
      totalOutput: 8750,
      unit: 'kg',
      efficiency: '92%',
      qualityPass: '98.8%',
      status: 'completed',
      generatedAt: '2025-02-02 17:30'
    },
    {
      id: 'RPT003',
      reportType: '月度总结',
      period: '2025-01',
      totalOutput: 35600,
      unit: 'kg',
      efficiency: '91%',
      qualityPass: '98.5%',
      status: 'completed',
      generatedAt: '2025-02-01 10:00'
    },
    {
      id: 'RPT004',
      reportType: '设备利用率',
      period: '2025-02-03',
      totalOutput: 0,
      unit: '-',
      efficiency: '87%',
      qualityPass: '-',
      status: 'generating',
      generatedAt: '生成中...'
    }
  ]

  const columns = [
    { key: 'id', title: '报表编号' },
    { key: 'reportType', title: '报表类型' },
    { key: 'period', title: '统计周期' },
    {
      key: 'totalOutput',
      title: '总产量',
      render: (value: number, row: any) =>
        value > 0 ? `${value} ${row.unit}` : '-'
    },
    { key: 'efficiency', title: '生产效率' },
    { key: 'qualityPass', title: '合格率' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => {
        const statusMap = {
          'completed': { variant: 'success' as const, text: '已完成' },
          'generating': { variant: 'warning' as const, text: '生成中' },
          'failed': { variant: 'error' as const, text: '失败' },
          'pending': { variant: 'default' as const, text: '待生成' }
        }
        const config = statusMap[value as keyof typeof statusMap] || { variant: 'default' as const, text: value }
        return (
          <Badge variant={config.variant}>
            {config.text}
          </Badge>
        )
      }
    },
    { key: 'generatedAt', title: '生成时间' }
  ]

  return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">生产报表统计</h1>
          <Button size="small" className="bg-[#1890FF] hover:bg-[#146ACC]">
            生成报表
          </Button>
        </div>

        {/* 关键指标概览 */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="bg-[#E6F7FF] p-3 rounded">
            <div className="text-[#1890FF] text-xs font-medium">今日产量</div>
            <div className="text-lg font-semibold">1,250 kg</div>
            <div className="text-xs text-green-600">↑ 5.2% vs 昨日</div>
          </div>
          <div className="bg-[#F6FFED] p-3 rounded">
            <div className="text-[#52C41A] text-xs font-medium">生产效率</div>
            <div className="text-lg font-semibold">94%</div>
            <div className="text-xs text-green-600">↑ 2.1% vs 昨日</div>
          </div>
          <div className="bg-[#FFF2F0] p-3 rounded">
            <div className="text-[#FF4D4F] text-xs font-medium">质量合格率</div>
            <div className="text-lg font-semibold">99.2%</div>
            <div className="text-xs text-green-600">↑ 0.3% vs 昨日</div>
          </div>
          <div className="bg-[#FFF7E6] p-3 rounded">
            <div className="text-[#FA8C16] text-xs font-medium">设备利用率</div>
            <div className="text-lg font-semibold">87%</div>
            <div className="text-xs text-red-600">↓ 1.5% vs 昨日</div>
          </div>
        </div>

        {/* 趋势分析 */}
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <h3 className="text-sm font-medium mb-2">本周趋势分析</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">平均日产量:</span>
              <span className="font-medium">1,246 kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">平均效率:</span>
              <span className="font-medium text-[#52C41A]">92.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">最高单日产量:</span>
              <span className="font-medium">1,380 kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">质量波动范围:</span>
              <span className="font-medium">±0.5%</span>
            </div>
          </div>
        </div>

        <AdvancedTable
          data={data?.reports || mockReports}
          columns={columns}
          searchable={true}
          pagination={true}
          pageSize={5}
        />
      </Card>
    </div>
  )
}
