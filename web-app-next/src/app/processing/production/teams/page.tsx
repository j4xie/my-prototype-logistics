'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import { AdvancedTable } from '@/components/ui/advanced-table'
import { useProcessing } from '@/hooks/useApi-simple'

export default function ProductionTeamsPage() {
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
  const mockTeams = [
    {
      id: 'TEAM001',
      teamName: '生产一组',
      teamLeader: '张师傅',
      memberCount: 8,
      shift: '早班',
      status: 'working',
      todayOutput: 450,
      targetOutput: 500,
      efficiency: '90%',
      workArea: '屠宰线A',
      startTime: '06:00',
      endTime: '14:00'
    },
    {
      id: 'TEAM002',
      teamName: '生产二组',
      teamLeader: '李组长',
      memberCount: 6,
      shift: '中班',
      status: 'working',
      todayOutput: 380,
      targetOutput: 400,
      efficiency: '95%',
      workArea: '分割车间',
      startTime: '14:00',
      endTime: '22:00'
    },
    {
      id: 'TEAM003',
      teamName: '深加工组',
      teamLeader: '王师傅',
      memberCount: 5,
      shift: '早班',
      status: 'break',
      todayOutput: 180,
      targetOutput: 200,
      efficiency: '90%',
      workArea: '熟食车间',
      startTime: '08:00',
      endTime: '16:00'
    },
    {
      id: 'TEAM004',
      teamName: '质检组',
      teamLeader: '陈主管',
      memberCount: 4,
      shift: '全天',
      status: 'working',
      todayOutput: 0,
      targetOutput: 0,
      efficiency: '100%',
      workArea: '质检中心',
      startTime: '06:00',
      endTime: '22:00'
    },
    {
      id: 'TEAM005',
      teamName: '维护组',
      teamLeader: '刘技师',
      memberCount: 3,
      shift: '夜班',
      status: 'off-duty',
      todayOutput: 0,
      targetOutput: 0,
      efficiency: '100%',
      workArea: '设备维护',
      startTime: '22:00',
      endTime: '06:00'
    }
  ]

  const columns = [
    { key: 'teamName', title: '班组名称' },
    { key: 'teamLeader', title: '班组长' },
    { key: 'memberCount', title: '成员数' },
    { key: 'shift', title: '班次' },
    {
      key: 'status',
      title: '状态',
      render: (value: string) => {
        const statusMap = {
          'working': { variant: 'success' as const, text: '工作中' },
          'break': { variant: 'warning' as const, text: '休息中' },
          'off-duty': { variant: 'default' as const, text: '下班' },
          'meeting': { variant: 'info' as const, text: '会议中' }
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
      key: 'todayOutput',
      title: '今日产量',
      render: (value: number) =>
        value > 0 ? `${value} kg` : '-'
    },
    { key: 'efficiency', title: '效率' },
    { key: 'workArea', title: '工作区域' }
  ]

  // 统计数据
  const totalTeams = mockTeams.length
  const workingTeams = mockTeams.filter(team => team.status === 'working').length
  const totalMembers = mockTeams.reduce((sum, team) => sum + team.memberCount, 0)
  const totalTodayOutput = mockTeams.reduce((sum, team) => sum + team.todayOutput, 0)

  return (
    <div className="max-w-[390px] mx-auto p-4">
      <Card className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-semibold text-gray-900">班组管理</h1>
          <Button size="small" className="bg-[#1890FF] hover:bg-[#146ACC]">
            排班管理
          </Button>
        </div>

        {/* 班组概览 */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="bg-[#E6F7FF] p-3 rounded">
            <div className="text-[#1890FF] text-xs font-medium">在岗班组</div>
            <div className="text-lg font-semibold">{workingTeams}/{totalTeams}</div>
            <div className="text-xs text-gray-500">班组状态正常</div>
          </div>
          <div className="bg-[#F6FFED] p-3 rounded">
            <div className="text-[#52C41A] text-xs font-medium">总员工数</div>
            <div className="text-lg font-semibold">{totalMembers}人</div>
            <div className="text-xs text-gray-500">全员到岗</div>
          </div>
          <div className="bg-[#FFF7E6] p-3 rounded">
            <div className="text-[#FA8C16] text-xs font-medium">今日产量</div>
            <div className="text-lg font-semibold">{totalTodayOutput} kg</div>
            <div className="text-xs text-green-600">目标完成度 92%</div>
          </div>
          <div className="bg-[#FFF2F0] p-3 rounded">
            <div className="text-[#FF4D4F] text-xs font-medium">平均效率</div>
            <div className="text-lg font-semibold">95%</div>
            <div className="text-xs text-green-600">优秀水平</div>
          </div>
        </div>

        {/* 班次安排 */}
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <h3 className="text-sm font-medium mb-2">当前班次安排</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">早班 (06:00-14:00):</span>
              <div className="flex gap-1">
                <Badge variant="success" size="small">生产一组</Badge>
                <Badge variant="warning" size="small">深加工组</Badge>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">中班 (14:00-22:00):</span>
              <div className="flex gap-1">
                <Badge variant="success" size="small">生产二组</Badge>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">夜班 (22:00-06:00):</span>
              <div className="flex gap-1">
                <Badge variant="default" size="small">维护组</Badge>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">全天班:</span>
              <div className="flex gap-1">
                <Badge variant="success" size="small">质检组</Badge>
              </div>
            </div>
          </div>
        </div>

        <AdvancedTable
          data={data?.teams || mockTeams}
          columns={columns}
          searchable={true}
          pagination={true}
          pageSize={6}
        />
      </Card>
    </div>
  )
}
