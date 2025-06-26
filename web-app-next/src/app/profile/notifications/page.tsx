'use client';

import { useState } from 'react';

interface Notification {
  id: string;
  type: 'system' | 'task' | 'warning' | 'info';
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'system' | 'task' | 'warning'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Mock数据
  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'warning',
      title: '质量警告',
      content: '产品批次 BN-2025-001 检测发现异常指标，请立即处理',
      time: '2025-02-02 10:30',
      isRead: false,
      priority: 'high'
    },
    {
      id: '2',
      type: 'task',
      title: '任务提醒',
      content: '您有一个待完成的数据采集任务即将到期',
      time: '2025-02-02 09:15',
      isRead: false,
      priority: 'medium'
    },
    {
      id: '3',
      type: 'system',
      title: '系统维护通知',
      content: '系统将于今晚23:00-01:00进行例行维护，期间可能影响服务',
      time: '2025-02-01 15:20',
      isRead: true,
      priority: 'low'
    },
    {
      id: '4',
      type: 'info',
      title: '新功能上线',
      content: '移动端预测分析功能已上线，快来体验吧！',
      time: '2025-02-01 12:00',
      isRead: true,
      priority: 'low'
    },
    {
      id: '5',
      type: 'warning',
      title: '疫苗提醒',
      content: '养殖场A区有5头牲畜疫苗即将到期，请及时安排补种',
      time: '2025-01-31 16:45',
      isRead: false,
      priority: 'high'
    }
  ];

  const displayData = mockNotifications;

  // 过滤通知
  const filteredNotifications = displayData.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.isRead;
    return notification.type === filter;
  });

  // 获取通知类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning': return 'text-red-600 bg-red-50';
      case 'task': return 'text-blue-600 bg-blue-50';
      case 'system': return 'text-gray-600 bg-gray-50';
      case 'info': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 标记为已读
  const markAsRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 删除通知
  const deleteNotifications = async (ids: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      setSelectedIds([]);
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  // 切换选择
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const unreadCount = displayData.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1 hover:bg-white/20 rounded"
              aria-label="返回"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-medium">消息通知</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
              className="p-2 hover:bg-white/20 rounded"
              aria-label="过滤未读"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[80px]">
        {/* 过滤器 */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { key: 'all', label: '全部', count: displayData.length },
              { key: 'unread', label: '未读', count: unreadCount },
              { key: 'warning', label: '警告', count: displayData.filter(n => n.type === 'warning').length },
              { key: 'task', label: '任务', count: displayData.filter(n => n.type === 'task').length },
              { key: 'system', label: '系统', count: displayData.filter(n => n.type === 'system').length }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  filter === key
                    ? 'bg-[#1890FF] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* 批量操作 */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                已选择 {selectedIds.length} 项
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => markAsRead(selectedIds.filter(id =>
                    displayData.find(n => n.id === id && !n.isRead)
                  ))}
                  className="px-3 py-1.5 bg-[#1890FF] text-white rounded text-sm hover:bg-[#1677FF]"
                >
                  标记已读
                </button>
                <button
                  onClick={() => deleteNotifications(selectedIds)}
                  className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 通知列表 */}
        <div className="px-4 space-y-3 mt-4">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                📵
              </div>
              <p className="text-gray-600">暂无通知</p>
            </div>
          ) : (
            <>
              {/* 全选控制 */}
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                  全选
                </label>
                {selectedIds.length === 0 && unreadCount > 0 && (
                  <button
                    onClick={() => markAsRead(displayData.filter(n => !n.isRead).map(n => n.id))}
                    className="text-sm text-[#1890FF] hover:underline"
                  >
                    全部标记已读
                  </button>
                )}
              </div>

              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-sm p-4 border-l-4 transition-all ${
                    !notification.isRead ? 'border-l-[#1890FF] bg-blue-50/30' : 'border-l-gray-200'
                  } ${selectedIds.includes(notification.id) ? 'ring-2 ring-[#1890FF] ring-opacity-30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(notification.id)}
                      onChange={() => toggleSelect(notification.id)}
                      className="mt-1 rounded"
                    />

                    <div className={`p-2 rounded-lg ${getTypeColor(notification.type)}`}>
                      <div className="w-4 h-4">
                        {notification.type === 'warning' && '⚠️'}
                        {notification.type === 'task' && '📋'}
                        {notification.type === 'system' && '⚙️'}
                        {notification.type === 'info' && 'ℹ️'}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                          {!notification.isRead && (
                            <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>
                          )}
                        </h3>
                        {notification.priority === 'high' && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                            紧急
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.content}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {notification.time}
                        </span>

                        <div className="flex gap-2">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead([notification.id])}
                              className="text-xs text-[#1890FF] hover:underline"
                            >
                              标记已读
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotifications([notification.id])}
                            className="text-xs text-red-500 hover:underline"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* 加载更多 */}
        {filteredNotifications.length >= 10 && (
          <div className="px-4 py-6 text-center">
            <button className="px-6 py-2 text-[#1890FF] border border-[#1890FF] rounded-lg hover:bg-[#1890FF] hover:text-white transition-colors">
              加载更多
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
