'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useProcessing } from '@/hooks/useApi-simple'

export default function ProductionPlanningPage() {
  const { useProductionSchedule } = useProcessing()
  const { data, loading, error } = useProductionSchedule()

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
  const mockPlans = [
    {
      id: 'PP001',
      productName: '精品猪肉',
      quantity: 500,
      unit: 'kg',
      plannedStartDate: '2025-02-04',
      plannedEndDate: '2025-02-06',
      status: 'scheduled',
      priority: 'high',
      responsible: '生产一组'
    },
    {
      id: 'PP002',
      productName: '优质牛肉',
      quantity: 300,
      unit: 'kg',
      plannedStartDate: '2025-02-05',
      plannedEndDate: '2025-02-07',
      status: 'in-progress',
      priority: 'medium',
      responsible: '生产二组'
    },
    {
      id: 'PP003',
      productName: '熟食制品',
      quantity: 200,
      unit: 'kg',
      plannedStartDate: '2025-02-06',
      plannedEndDate: '2025-02-08',
      status: 'pending',
      priority: 'low',
      responsible: '深加工组'
    }
  ]

  const columns = [
    { key: 'id', title: '计划编号' },
    { key: 'productName', title: '产品名称' },
    {
      key: 'quantity',
      title: '计划产量',
      render: (value: number, row: any) => `${value} ${row.unit}`
    },
    { key: 'plannedStartDate', title: '计划开始' },
    { key: 'plannedEndDate', title: '计划结束' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => {
        const statusMap = {
          'scheduled': { variant: 'warning' as const, text: '已排期' },
          'in-progress': { variant: 'info' as const, text: '进行中' },
          'pending': { variant: 'default' as const, text: '待开始' },
          'completed': { variant: 'success' as const, text: '已完成' }
        }
        const config = statusMap[value as keyof typeof statusMap] || { variant: 'default' as const, text: value }
        return (
          <Badge variant={config.variant}>
            {config.text}
          </Badge>
        )
      }
    },
    {
      key: 'priority',
      title: '优先级',
      render: (value: string) => {
        const priorityMap = {
          'high': { variant: 'error' as const, text: '高' },
          'medium': { variant: 'warning' as const, text: '中' },
          'low': { variant: 'default' as const, text: '低' }
        }
        const config = priorityMap[value as keyof typeof priorityMap] || { variant: 'default' as const, text: value }
        return (
          <Badge variant={config.variant}>
            {config.text}
          </Badge>
        )
      }
    },
    { key: 'responsible', title: '负责人' }
  ]

  return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">生产计划制定</h1>
          <Button size="small" className="bg-[#1890FF] hover:bg-[#146ACC]">
            新建计划
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
          <div className="bg-[#E6F7FF] p-2 rounded">
            <div className="text-[#1890FF] font-medium">本周计划</div>
            <div className="text-lg font-semibold">12个</div>
          </div>
          <div className="bg-[#F6FFED] p-2 rounded">
            <div className="text-[#52C41A] font-medium">进行中</div>
            <div className="text-lg font-semibold">5个</div>
          </div>
          <div className="bg-[#FFF7E6] p-2 rounded">
            <div className="text-[#FA8C16] font-medium">待开始</div>
            <div className="text-lg font-semibold">7个</div>
          </div>
        </div>

        <AdvancedTable
          data={data?.plans || mockPlans}
          columns={columns}
          searchable={true}
          pagination={true}
          pageSize={5}
        />
      </Card>
    </div>
  )
}
