'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useProcessing } from '@/hooks/useApi-simple'

export default function EquipmentMonitorPage() {
  const { useEquipmentStatus } = useProcessing()
  const { data, loading, error } = useEquipmentStatus()

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
  const mockEquipment = [
    {
      id: 'EQ001',
      name: '屠宰线A',
      type: '主要设备',
      status: 'running',
      temperature: '2-4°C',
      speed: '85%',
      efficiency: '92%',
      lastMaintenance: '2025-01-20',
      nextMaintenance: '2025-02-20'
    },
    {
      id: 'EQ002',
      name: '冷冻库1号',
      type: '储存设备',
      status: 'normal',
      temperature: '-18°C',
      speed: '-',
      efficiency: '98%',
      lastMaintenance: '2025-01-15',
      nextMaintenance: '2025-02-15'
    },
    {
      id: 'EQ003',
      name: '包装机B',
      type: '包装设备',
      status: 'warning',
      temperature: '常温',
      speed: '65%',
      efficiency: '78%',
      lastMaintenance: '2025-01-10',
      nextMaintenance: '2025-02-10'
    },
    {
      id: 'EQ004',
      name: '清洗设备',
      type: '辅助设备',
      status: 'maintenance',
      temperature: '60°C',
      speed: '0%',
      efficiency: '0%',
      lastMaintenance: '2025-02-03',
      nextMaintenance: '2025-03-03'
    }
  ]

  const columns = [
    { key: 'id', title: '设备编号' },
    { key: 'name', title: '设备名称' },
    { key: 'type', title: '设备类型' },
    {
      key: 'status',
      title: '运行状态',
      render: (value: string) => {
        const statusMap = {
          'running': { variant: 'success' as const, text: '运行中' },
          'normal': { variant: 'success' as const, text: '正常' },
          'warning': { variant: 'warning' as const, text: '告警' },
          'error': { variant: 'error' as const, text: '故障' },
          'maintenance': { variant: 'default' as const, text: '维护中' },
          'stopped': { variant: 'default' as const, text: '停机' }
        }
        const config = statusMap[value as keyof typeof statusMap] || { variant: 'default' as const, text: value }
        return (
          <Badge variant={config.variant}>
            {config.text}
          </Badge>
        )
      }
    },
    { key: 'temperature', title: '温度' },
    { key: 'speed', title: '运行速度' },
    { key: 'efficiency', title: '效率' },
    { key: 'nextMaintenance', title: '下次维护' }
  ]

  // 统计数据
  const totalEquipment = mockEquipment.length
  const runningCount = mockEquipment.filter(eq => eq.status === 'running' || eq.status === 'normal').length
  const warningCount = mockEquipment.filter(eq => eq.status === 'warning').length

  return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">设备运行监控</h1>
          <Button size="small" className="bg-[#1890FF] hover:bg-[#146ACC]">
            刷新状态
          </Button>
        </div>

        {/* 实时状态卡片 */}
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div className="bg-[#F6FFED] p-3 rounded">
            <div className="text-[#52C41A] font-medium">正常运行</div>
            <div className="text-xl font-semibold">{runningCount}/{totalEquipment}</div>
            <div className="text-xs text-gray-500">设备状态良好</div>
          </div>
          <div className="bg-[#FFF7E6] p-3 rounded">
            <div className="text-[#FA8C16] font-medium">告警设备</div>
            <div className="text-xl font-semibold">{warningCount}</div>
            <div className="text-xs text-gray-500">需要关注</div>
          </div>
        </div>

        {/* 关键参数监控 */}
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <h3 className="text-sm font-medium mb-2">关键参数</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">平均效率:</span>
              <span className="ml-1 font-medium text-[#52C41A]">87.5%</span>
            </div>
            <div>
              <span className="text-gray-600">总能耗:</span>
              <span className="ml-1 font-medium">245.8 kWh</span>
            </div>
            <div>
              <span className="text-gray-600">运行时间:</span>
              <span className="ml-1 font-medium">16.5 小时</span>
            </div>
            <div>
              <span className="text-gray-600">停机时间:</span>
              <span className="ml-1 font-medium text-[#FF4D4F]">0.5 小时</span>
            </div>
          </div>
        </div>

        <AdvancedTable
          data={data?.equipment || mockEquipment}
          columns={columns}
          searchable={true}
          pagination={true}
          pageSize={5}
        />
      </Card>
    </div>
  )
}
