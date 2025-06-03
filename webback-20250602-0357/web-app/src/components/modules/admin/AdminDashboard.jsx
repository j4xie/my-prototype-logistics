import React, { useState, useEffect } from 'react';
import { 
  Badge, 
  Button,
  Loading 
} from '@/components/ui';

/**
 * 管理员仪表板组件 - React现代化版本
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const AdminDashboard = ({ 
  loading = false,
  userInfo = null,
  systemStats = {},
  recentActivities = [],
  onNavigate,
  onRefresh
}) => {
  const [refreshing, setRefreshing] = useState(false);

  // 权限配置
  const permissionConfig = {
    super_admin: { variant: 'error', text: '超级管理员', color: '#FF4D4F' },
    admin: { variant: 'warning', text: '管理员', color: '#FA8C16' },
    operator: { variant: 'info', text: '操作员', color: '#1890FF' },
    viewer: { variant: 'default', text: '查看者', color: '#9CA3AF' }
  };

  // 快速操作配置
  const quickActions = [
    {
      id: 'user_management',
      title: '用户管理',
      icon: 'fas fa-users',
      color: 'bg-blue-100',
      iconColor: 'text-blue-600',
      permission: ['super_admin', 'admin'],
      path: '/admin/users'
    },
    {
      id: 'system_settings',
      title: '系统设置',
      icon: 'fas fa-cog',
      color: 'bg-gray-100',
      iconColor: 'text-gray-600',
      permission: ['super_admin', 'admin'],
      path: '/admin/settings'
    },
    {
      id: 'data_backup',
      title: '数据备份',
      icon: 'fas fa-database',
      color: 'bg-green-100',
      iconColor: 'text-green-600',
      permission: ['super_admin'],
      path: '/admin/backup'
    },
    {
      id: 'audit_logs',
      title: '审计日志',
      icon: 'fas fa-clipboard-list',
      color: 'bg-purple-100',
      iconColor: 'text-purple-600',
      permission: ['super_admin', 'admin'],
      path: '/admin/audit'
    },
    {
      id: 'system_monitor',
      title: '系统监控',
      icon: 'fas fa-chart-line',
      color: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      permission: ['super_admin', 'admin'],
      path: '/admin/monitor'
    },
    {
      id: 'notification',
      title: '通知管理',
      icon: 'fas fa-bell',
      color: 'bg-red-100',
      iconColor: 'text-red-600',
      permission: ['super_admin', 'admin', 'operator'],
      path: '/admin/notifications'
    }
  ];

  const getPermissionInfo = (permission) => {
    return permissionConfig[permission] || permissionConfig.viewer;
  };

  const hasPermission = (requiredPermissions) => {
    if (!userInfo || !userInfo.permission) return false;
    return requiredPermissions.includes(userInfo.permission);
  };

  const handleQuickAction = (action) => {
    if (!hasPermission(action.permission)) {
      return;
    }
    
    if (onNavigate) {
      onNavigate(action.path);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-[390px] mx-auto space-y-6">
      {/* 用户信息卡片 - 遵循UI设计系统规则 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-[#E6F7FF] rounded-full flex items-center justify-center mr-4">
              <i className="fas fa-user-shield text-[#1890FF] text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                你好，{userInfo?.name || '管理员'}
              </h2>
              <p className="text-sm text-gray-600">
                {userInfo?.department || '系统管理部'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {userInfo?.permission && (
              <Badge 
                variant={getPermissionInfo(userInfo.permission).variant}
                size="small"
              >
                {getPermissionInfo(userInfo.permission).text}
              </Badge>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {userInfo?.lastLogin ? `上次登录: ${formatTime(userInfo.lastLogin)}` : '首次登录'}
            </p>
          </div>
        </div>
      </div>

      {/* 系统统计 - 使用grid-cols-2 gap-4布局 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">系统概览</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[#1890FF] hover:text-[#4096FF] disabled:opacity-50"
            aria-label="刷新数据"
          >
            <i className={`fas fa-sync-alt ${refreshing ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">在线用户</div>
                <div className="text-2xl font-medium text-gray-900">
                  {systemStats.onlineUsers || 0}
                </div>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <i className="fas fa-users text-green-600 text-sm"></i>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">今日记录</div>
                <div className="text-2xl font-medium text-gray-900">
                  {systemStats.todayRecords || 0}
                </div>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="fas fa-file-alt text-blue-600 text-sm"></i>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">系统负载</div>
                <div className="text-2xl font-medium text-gray-900">
                  {systemStats.systemLoad || '0%'}
                </div>
              </div>
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <i className="fas fa-tachometer-alt text-yellow-600 text-sm"></i>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">存储使用</div>
                <div className="text-2xl font-medium text-gray-900">
                  {systemStats.storageUsage || '0%'}
                </div>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <i className="fas fa-hdd text-purple-600 text-sm"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作 - 使用grid-cols-2 gap-4布局 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">快速操作</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const hasAccess = hasPermission(action.permission);
            
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={!hasAccess}
                className={`
                  p-4 rounded-lg text-left transition-all duration-200
                  ${hasAccess 
                    ? 'hover:shadow-md hover:scale-[1.03] cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                  }
                  ${action.color}
                `}
                aria-label={action.title}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${action.color}`}>
                    <i className={`${action.icon} ${action.iconColor}`}></i>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {action.title}
                  </span>
                  {!hasAccess && (
                    <i className="fas fa-lock text-gray-400 text-xs mt-1"></i>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 最近活动 */}
      {recentActivities && recentActivities.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">最近活动</h3>
          
          <div className="space-y-3">
            {recentActivities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-[#1890FF] rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.action || '未知操作'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {activity.description || '无描述'}
                  </p>
                  {activity.user && (
                    <p className="text-xs text-gray-500">
                      操作人: {activity.user.name || activity.userName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {recentActivities.length > 5 && (
            <div className="mt-4 text-center">
              <Button
                variant="secondary"
                size="small"
                onClick={() => onNavigate && onNavigate('/admin/activities')}
              >
                查看更多活动
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 系统状态指示器 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统状态</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">数据库连接</span>
            <Badge variant="success" size="small">
              <i className="fas fa-circle mr-1 text-xs"></i>
              正常
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">API服务</span>
            <Badge variant="success" size="small">
              <i className="fas fa-circle mr-1 text-xs"></i>
              正常
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">文件存储</span>
            <Badge variant="success" size="small">
              <i className="fas fa-circle mr-1 text-xs"></i>
              正常
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">缓存服务</span>
            <Badge variant="warning" size="small">
              <i className="fas fa-circle mr-1 text-xs"></i>
              警告
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 