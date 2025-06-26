'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  resource: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed' | 'warning';
  risk: 'low' | 'medium' | 'high';
}

interface AuditMetrics {
  totalLogs: number;
  todayLogs: number;
  failedActions: number;
  riskEvents: number;
}

interface SecurityEvent {
  id: string;
  type: 'login_failed' | 'permission_denied' | 'suspicious_activity' | 'data_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  userId: string;
  description: string;
  resolved: boolean;
}

export default function AuditPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'logs' | 'security' | 'reports'>('logs');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证，开发环境已通过useMockAuth自动处理
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockLogs: AuditLog[] = [
        {
          id: 'AL001',
          timestamp: '2024-06-14 14:23:15',
          userId: 'U001',
          userName: '张三',
          action: '用户登录',
          module: '认证系统',
          resource: '/auth/login',
          details: '管理员用户成功登录系统',
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome 124.0.0.0',
          status: 'success',
          risk: 'low'
        },
        {
          id: 'AL002',
          timestamp: '2024-06-14 14:20:33',
          userId: 'U002',
          userName: '李四',
          action: '修改用户权限',
          module: '权限管理',
          resource: '/admin/permissions/user/U003',
          details: '将用户权限从"操作员"提升至"管理员"',
          ipAddress: '192.168.1.101',
          userAgent: 'Chrome 124.0.0.0',
          status: 'success',
          risk: 'high'
        },
        {
          id: 'AL003',
          timestamp: '2024-06-14 14:18:45',
          userId: 'U004',
          userName: '王五',
          action: '登录失败',
          module: '认证系统',
          resource: '/auth/login',
          details: '密码错误，连续失败3次',
          ipAddress: '192.168.1.102',
          userAgent: 'Chrome 124.0.0.0',
          status: 'failed',
          risk: 'medium'
        },
        {
          id: 'AL004',
          timestamp: '2024-06-14 14:15:22',
          userId: 'U001',
          userName: '张三',
          action: '导出数据',
          module: '数据管理',
          resource: '/admin/export/users',
          details: '导出用户列表数据（共156条记录）',
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome 124.0.0.0',
          status: 'success',
          risk: 'medium'
        },
        {
          id: 'AL005',
          timestamp: '2024-06-14 14:12:10',
          userId: 'U005',
          userName: '赵六',
          action: '删除产品',
          module: '产品管理',
          resource: '/products/P001',
          details: '删除产品"优质猪肉"及相关数据',
          ipAddress: '192.168.1.103',
          userAgent: 'Safari 17.4.1',
          status: 'success',
          risk: 'high'
        }
      ];

      const mockSecurityEvents: SecurityEvent[] = [
        {
          id: 'SE001',
          type: 'login_failed',
          severity: 'medium',
          timestamp: '2024-06-14 14:18:45',
          userId: 'U004',
          description: '用户连续登录失败3次，IP: 192.168.1.102',
          resolved: false
        },
        {
          id: 'SE002',
          type: 'suspicious_activity',
          severity: 'high',
          timestamp: '2024-06-14 13:45:30',
          userId: 'U006',
          description: '异常IP地址访问管理界面，IP: 203.45.67.89',
          resolved: true
        },
        {
          id: 'SE003',
          type: 'permission_denied',
          severity: 'low',
          timestamp: '2024-06-14 13:30:15',
          userId: 'U007',
          description: '普通用户尝试访问管理员功能',
          resolved: true
        },
        {
          id: 'SE004',
          type: 'data_access',
          severity: 'critical',
          timestamp: '2024-06-14 12:15:20',
          userId: 'U008',
          description: '非授权用户尝试访问敏感数据',
          resolved: false
        }
      ];

      const mockMetrics: AuditMetrics = {
        totalLogs: 1250,
        todayLogs: 45,
        failedActions: 8,
        riskEvents: 12
      };

      setAuditLogs(mockLogs);
      setSecurityEvents(mockSecurityEvents);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return { bg: '#F6FFED', text: '#52C41A', label: '成功' };
      case 'failed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '失败' };
      case 'warning':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '警告' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return { bg: '#F6FFED', text: '#52C41A', label: '低风险' };
      case 'medium':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '中风险' };
      case 'high':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '高风险' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return { bg: '#F6FFED', text: '#52C41A', label: '低' };
      case 'medium':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '中' };
      case 'high':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '高' };
      case 'critical':
        return { bg: '#FF4D4F', text: '#FFFFFF', label: '严重' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('登录')) return 'fas fa-sign-in-alt';
    if (action.includes('修改') || action.includes('编辑')) return 'fas fa-edit';
    if (action.includes('删除')) return 'fas fa-trash';
    if (action.includes('导出')) return 'fas fa-download';
    if (action.includes('创建') || action.includes('新建')) return 'fas fa-plus';
    return 'fas fa-cog';
  };

  const filteredLogs = filterStatus === 'all'
    ? auditLogs
    : auditLogs.filter(log => log.status === filterStatus);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-shield-alt fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载审计数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">审计追踪</h1>
          <button
            onClick={() => router.push('/admin')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 审计概览 */}
          {metrics && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#1677FF] mr-2"></i>
                审计概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {metrics.totalLogs.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总日志数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {metrics.todayLogs}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日日志</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {metrics.failedActions}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">失败操作</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {metrics.riskEvents}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">风险事件</div>
                </div>
              </div>
            </Card>
          )}

          {/* 标签页切换 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setSelectedTab('logs')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'logs'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-list mr-1"></i>
                操作日志
              </button>
              <button
                onClick={() => setSelectedTab('security')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'security'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-shield-alt mr-1"></i>
                安全事件
              </button>
              <button
                onClick={() => setSelectedTab('reports')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'reports'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-file-alt mr-1"></i>
                报告
              </button>
            </div>
          </Card>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/admin/audit/export')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-download mr-2"></i>
              导出日志
            </Button>
            <Button
              onClick={() => router.push('/admin/audit/settings')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-cog mr-2"></i>
              审计设置
            </Button>
          </div>

          {/* 操作日志标签页 */}
          {selectedTab === 'logs' && (
            <div className="space-y-3">
              {/* 状态筛选 */}
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex space-x-2 overflow-x-auto">
                  {[
                    { key: 'all', label: '全部', count: auditLogs.length },
                    { key: 'success', label: '成功', count: auditLogs.filter(l => l.status === 'success').length },
                    { key: 'failed', label: '失败', count: auditLogs.filter(l => l.status === 'failed').length },
                    { key: 'warning', label: '警告', count: auditLogs.filter(l => l.status === 'warning').length }
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setFilterStatus(filter.key)}
                      className={`
                        flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-all
                        ${filterStatus === filter.key
                          ? 'bg-[#1677FF] text-white shadow-sm'
                          : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                        }
                      `}
                    >
                      {filter.label}
                      {filter.count > 0 && (
                        <span className="ml-1 text-xs">({filter.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">操作日志</h3>
                <span className="text-sm text-[#8c8c8c]">共 {filteredLogs.length} 条记录</span>
              </div>

              {filteredLogs.map((log) => {
                const statusInfo = getStatusColor(log.status);
                const riskInfo = getRiskColor(log.risk);

                return (
                  <Card
                    key={log.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/audit/log/${log.id}`)}
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className={`${getActionIcon(log.action)} text-[#1677FF] mr-2`}></i>
                            {log.action}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            <i className="fas fa-user mr-1"></i>
                            {log.userName} ({log.userId})
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-clock mr-1"></i>
                            {log.timestamp}
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className="px-2 py-1 rounded text-xs font-medium mb-2"
                            style={{ backgroundColor: riskInfo.bg, color: riskInfo.text }}
                          >
                            {riskInfo.label}
                          </div>
                          <div className="text-xs text-[#8c8c8c]">
                            {log.module}
                          </div>
                        </div>
                      </div>

                      {/* 详细信息 */}
                      <div className="space-y-2 pt-3 border-t border-[#f0f0f0]">
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-info-circle mr-1"></i>
                          {log.details}
                        </p>
                        <div className="flex items-center justify-between text-xs text-[#bfbfbf]">
                          <span>
                            <i className="fas fa-map-marker-alt mr-1"></i>
                            {log.ipAddress}
                          </span>
                          <span>{log.userAgent.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 安全事件标签页 */}
          {selectedTab === 'security' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">安全事件</h3>
                <span className="text-sm text-[#8c8c8c]">共 {securityEvents.length} 个事件</span>
              </div>

              {securityEvents.map((event) => {
                const severityInfo = getSeverityColor(event.severity);

                return (
                  <Card
                    key={event.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/audit/security/${event.id}`)}
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className="fas fa-exclamation-triangle text-[#FA8C16] mr-2"></i>
                            {event.type.replace(/_/g, ' ').toUpperCase()}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: severityInfo.bg, color: severityInfo.text }}
                            >
                              {severityInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            <i className="fas fa-user mr-1"></i>
                            用户ID: {event.userId}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-clock mr-1"></i>
                            {event.timestamp}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            event.resolved
                              ? 'bg-[#F6FFED] text-[#52C41A]'
                              : 'bg-[#FFF2F0] text-[#FF4D4F]'
                          }`}>
                            {event.resolved ? '已处理' : '待处理'}
                          </div>
                        </div>
                      </div>

                      {/* 详细描述 */}
                      <div className="pt-3 border-t border-[#f0f0f0]">
                        <p className="text-sm text-[#8c8c8c]">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 报告标签页 */}
          {selectedTab === 'reports' && (
            <div className="space-y-4">
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3">审计报告</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/admin/audit/reports/daily')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">日报</div>
                        <div className="text-sm text-[#8c8c8c]">每日操作统计和异常分析</div>
                      </div>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/admin/audit/reports/weekly')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">周报</div>
                        <div className="text-sm text-[#8c8c8c]">周度安全趋势和风险评估</div>
                      </div>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/admin/audit/reports/compliance')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">合规报告</div>
                        <div className="text-sm text-[#8c8c8c]">法规合规性检查和证明</div>
                      </div>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
