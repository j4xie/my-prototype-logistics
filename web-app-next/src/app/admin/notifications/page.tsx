'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'warning' | 'info' | 'success';
  priority: 'high' | 'medium' | 'low';
  status: 'sent' | 'draft' | 'scheduled';
  targetUsers: 'all' | 'role' | 'specific';
  targetValue?: string;
  sentCount: number;
  readCount: number;
  createdAt: string;
  sentAt?: string;
  scheduledAt?: string;
}

interface NotificationStats {
  totalSent: number;
  totalRead: number;
  pendingCount: number;
  readRate: number;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'system' | 'warning' | 'info' | 'success'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'draft' | 'scheduled'>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const mockNotifications: Notification[] = [
          {
            id: '1',
            title: '系统维护通知',
            content: '系统将于今晚22:00-24:00进行维护升级，期间服务可能中断，请提前保存工作。',
            type: 'system',
            priority: 'high',
            status: 'sent',
            targetUsers: 'all',
            sentCount: 1247,
            readCount: 892,
            createdAt: '2025-02-02T10:00:00Z',
            sentAt: '2025-02-02T10:15:00Z'
          },
          {
            id: '2',
            title: '新功能上线',
            content: '溯源查询新增批量导出功能，支持Excel和PDF格式导出。',
            type: 'info',
            priority: 'medium',
            status: 'sent',
            targetUsers: 'role',
            targetValue: 'manager',
            sentCount: 425,
            readCount: 312,
            createdAt: '2025-02-01T14:30:00Z',
            sentAt: '2025-02-01T15:00:00Z'
          },
          {
            id: '3',
            title: '安全警告',
            content: '检测到异常登录尝试，请检查账户安全设置。',
            type: 'warning',
            priority: 'high',
            status: 'sent',
            targetUsers: 'specific',
            targetValue: '管理员组',
            sentCount: 12,
            readCount: 8,
            createdAt: '2025-02-02T16:00:00Z',
            sentAt: '2025-02-02T16:05:00Z'
          },
          {
            id: '4',
            title: '每周数据报告',
            content: '本周系统运行状况良好，溯源查询量较上周增长15%。',
            type: 'success',
            priority: 'low',
            status: 'scheduled',
            targetUsers: 'role',
            targetValue: 'admin',
            sentCount: 0,
            readCount: 0,
            createdAt: '2025-02-02T17:00:00Z',
            scheduledAt: '2025-02-05T09:00:00Z'
          },
          {
            id: '5',
            title: '培训通知草稿',
            content: '下周将组织系统操作培训，请相关人员准时参加。',
            type: 'info',
            priority: 'medium',
            status: 'draft',
            targetUsers: 'role',
            targetValue: 'operator',
            sentCount: 0,
            readCount: 0,
            createdAt: '2025-02-02T18:00:00Z'
          }
        ];

        setNotifications(mockNotifications);

        const mockStats: NotificationStats = {
          totalSent: 1684,
          totalRead: 1212,
          pendingCount: 2,
          readRate: 71.9
        };

        setStats(mockStats);
      } catch (error) {
        console.error('加载通知数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch =
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || notification.type === filterType;
    const matchesStatus = filterStatus === 'all' || notification.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'system': return <Badge variant="primary">系统</Badge>;
      case 'warning': return <Badge variant="error">警告</Badge>;
      case 'info': return <Badge variant="default">信息</Badge>;
      case 'success': return <Badge variant="success">成功</Badge>;
      default: return <Badge variant="default">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge variant="success">已发送</Badge>;
      case 'draft': return <Badge variant="default">草稿</Badge>;
      case 'scheduled': return <Badge variant="primary">定时</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="error">高</Badge>;
      case 'medium': return <Badge variant="primary">中</Badge>;
      case 'low': return <Badge variant="default">低</Badge>;
      default: return <Badge variant="default">{priority}</Badge>;
    }
  };

  const handleCreateNotification = () => {
    router.push('/admin/notifications/create');
  };

  const handleResend = (notificationId: string) => {
    alert(`重新发送通知 ${notificationId}`);
  };

  const handleEdit = (notificationId: string) => {
    router.push(`/admin/notifications/edit/${notificationId}`);
  };

  const handleDelete = (notificationId: string) => {
    if (confirm('确定要删除这条通知吗？')) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      alert('通知已删除');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-red-600">加载数据失败</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="返回"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">通知管理</h1>
          <button
            onClick={handleCreateNotification}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="创建通知"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 统计概览 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">通知统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1890FF]">{stats.totalSent.toLocaleString()}</p>
              <p className="text-sm text-gray-600">总发送数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.readRate}%</p>
              <p className="text-sm text-gray-600">阅读率</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.totalRead.toLocaleString()}</p>
              <p className="text-sm text-gray-600">已阅读</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.pendingCount}</p>
              <p className="text-sm text-gray-600">待发送</p>
            </div>
          </div>
        </Card>

        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索通知标题或内容..."
            className="w-full"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
              <Select
                value={filterType}
                onChange={(value) => setFilterType(value as any)}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'system', label: '系统' },
                  { value: 'warning', label: '警告' },
                  { value: 'info', label: '信息' },
                  { value: 'success', label: '成功' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <Select
                value={filterStatus}
                onChange={(value) => setFilterStatus(value as any)}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'sent', label: '已发送' },
                  { value: 'draft', label: '草稿' },
                  { value: 'scheduled', label: '定时' }
                ]}
              />
            </div>
          </div>
        </Card>

        {/* 通知列表 */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <Card className="bg-white rounded-lg shadow-sm p-6 text-center">
              <p className="text-gray-600">未找到匹配的通知</p>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card key={notification.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="space-y-3">
                  {/* 标题和徽章 */}
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-gray-900 flex-1 mr-2">
                      {notification.title}
                    </h3>
                    <div className="flex space-x-1">
                      {getTypeBadge(notification.type)}
                      {getPriorityBadge(notification.priority)}
                    </div>
                  </div>

                  {/* 内容 */}
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {notification.content}
                  </p>

                  {/* 状态和统计 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(notification.status)}
                      <span className="text-xs text-gray-500">
                        {notification.targetUsers === 'all' ? '所有用户' :
                         notification.targetUsers === 'role' ? `角色: ${notification.targetValue}` :
                         `指定: ${notification.targetValue}`}
                      </span>
                    </div>

                    {notification.status === 'sent' && (
                      <div className="text-xs text-gray-500">
                        {notification.readCount}/{notification.sentCount} 已读
                      </div>
                    )}
                  </div>

                  {/* 时间信息 */}
                  <div className="text-xs text-gray-500">
                    创建: {new Date(notification.createdAt).toLocaleDateString()}
                    {notification.sentAt && ` | 发送: ${new Date(notification.sentAt).toLocaleDateString()}`}
                    {notification.scheduledAt && ` | 计划: ${new Date(notification.scheduledAt).toLocaleDateString()}`}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end space-x-2">
                    {notification.status === 'sent' && (
                      <Button
                        onClick={() => handleResend(notification.id)}
                        variant="secondary"
                        className="text-xs px-3 py-1 h-7"
                      >
                        重发
                      </Button>
                    )}

                    {(notification.status === 'draft' || notification.status === 'scheduled') && (
                      <Button
                        onClick={() => handleEdit(notification.id)}
                        variant="primary"
                        className="text-xs px-3 py-1 h-7"
                      >
                        编辑
                      </Button>
                    )}

                    <Button
                      onClick={() => handleDelete(notification.id)}
                      variant="danger"
                      className="text-xs px-3 py-1 h-7"
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* 快速操作 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCreateNotification}
              variant="primary"
              className="text-sm"
            >
              创建通知
            </Button>
            <Button
              onClick={() => alert('批量操作功能开发中...')}
              variant="secondary"
              className="text-sm"
            >
              批量操作
            </Button>
            <Button
              onClick={() => alert('模板管理功能开发中...')}
              variant="secondary"
              className="text-sm"
            >
              通知模板
            </Button>
            <Button
              onClick={() => alert('推送设置功能开发中...')}
              variant="secondary"
              className="text-sm"
            >
              推送设置
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
