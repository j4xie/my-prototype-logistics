'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useProcessing } from '@/hooks/useApi-simple'

export default function ProductionWorkflowPage() {
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
  const mockWorkflows = [
    {
      id: 'WF001',
      name: '猪肉屠宰标准流程',
      type: '标准屠宰',
      status: 'active',
      steps: 12,
      updated_at: '2025-01-15'
    },
    {
      id: 'WF002',
      name: '牛肉分割工艺',
      type: '精细分割',
      status: 'active',
      steps: 8,
      updated_at: '2025-01-14'
    },
    {
      id: 'WF003',
      name: '熟食加工流程',
      type: '深加工',
      status: 'inactive',
      steps: 15,
      updated_at: '2025-01-10'
    }
  ]

  const columns = [
    { key: 'id', title: '流程ID' },
    { key: 'name', title: '流程名称' },
    { key: 'type', title: '工艺类型' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => (
        <Badge variant={value === 'active' ? 'success' : 'default'}>
          {value === 'active' ? '启用' : '停用'}
        </Badge>
      )
    },
    { key: 'steps', title: '工序数量' },
    { key: 'updated_at', title: '更新时间' }
  ]

  return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">工艺流程管理</h1>
          <Button size="small" className="bg-[#1890FF] hover:bg-[#146ACC]">
            新建流程
          </Button>
        </div>

        <AdvancedTable
          data={data?.workflows || mockWorkflows}
          columns={columns}
          searchable={true}
        />
      </Card>
    </div>
  )
}
