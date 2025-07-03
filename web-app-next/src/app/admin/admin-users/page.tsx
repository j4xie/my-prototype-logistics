'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminLayoutWrapper } from '@/components/admin';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'operator' | 'auditor';
  status: 'active' | 'inactive' | 'locked' | 'pending';
  lastLogin: string;
  loginCount: number;
  createdAt: string;
  permissions: string[];
  avatar?: string;
  department: string;
  phone: string;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  newUsersToday: number;
}

interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'users' | 'activities' | 'permissions'>('users');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

      const mockUsers: AdminUser[] = [
        {
          id: 'U001',
          username: 'admin',
          email: 'admin@foodtrace.com',
          fullName: '系统管理员',
          role: 'super_admin',
          status: 'active',
          lastLogin: '2024-06-14 16:30:00',
          loginCount: 1250,
          createdAt: '2024-01-15',
          permissions: ['*'],
          department: '信息技术部',
          phone: '13800138000'
        },
        {
          id: 'U002',
          username: 'zhang.san',
          email: 'zhang.san@foodtrace.com',
          fullName: '张三',
          role: 'admin',
          status: 'active',
          lastLogin: '2024-06-14 15:45:30',
          loginCount: 456,
          createdAt: '2024-02-20',
          permissions: ['user.manage', 'system.config', 'backup.manage'],
          department: '运营管理部',
          phone: '13900139001'
        },
        {
          id: 'U003',
          username: 'li.si',
          email: 'li.si@foodtrace.com',
          fullName: '李四',
          role: 'operator',
          status: 'active',
          lastLogin: '2024-06-14 14:20:15',
          loginCount: 89,
          createdAt: '2024-03-10',
          permissions: ['product.manage', 'quality.check'],
          department: '质量管理部',
          phone: '13700137002'
        },
        {
          id: 'U004',
          username: 'wang.wu',
          email: 'wang.wu@foodtrace.com',
          fullName: '王五',
          role: 'auditor',
          status: 'locked',
          lastLogin: '2024-06-10 09:30:00',
          loginCount: 23,
          createdAt: '2024-04-05',
          permissions: ['audit.view', 'report.generate'],
          department: '审计监察部',
          phone: '13600136003'
        },
        {
          id: 'U005',
          username: 'zhao.liu',
          email: 'zhao.liu@foodtrace.com',
          fullName: '赵六',
          role: 'operator',
          status: 'pending',
          lastLogin: '从未登录',
          loginCount: 0,
          createdAt: '2024-06-12',
          permissions: ['logistics.manage'],
          department: '物流运输部',
          phone: '13500135004'
        }
      ];

      const mockActivities: UserActivity[] = [
        {
          id: 'ACT001',
          userId: 'U001',
          userName: '系统管理员',
          action: '用户登录',
          timestamp: '2024-06-14 16:30:00',
          ipAddress: '192.168.1.100',
          userAgent: 'Chrome 124.0.0.0',
          details: '成功登录管理后台'
        },
        {
          id: 'ACT002',
          userId: 'U002',
          userName: '张三',
          action: '修改用户权限',
          timestamp: '2024-06-14 15:45:30',
          ipAddress: '192.168.1.101',
          userAgent: 'Firefox 126.0',
          details: '为用户"李四"添加了产品管理权限'
        },
        {
          id: 'ACT003',
          userId: 'U003',
          userName: '李四',
          action: '数据导出',
          timestamp: '2024-06-14 14:20:15',
          ipAddress: '192.168.1.102',
          userAgent: 'Chrome 124.0.0.0',
          details: '导出了产品质量检测报告'
        },
        {
          id: 'ACT004',
          userId: 'U004',
          userName: '王五',
          action: '登录失败',
          timestamp: '2024-06-14 13:15:45',
          ipAddress: '192.168.1.103',
          userAgent: 'Safari 17.4.1',
          details: '密码错误，账户已被锁定'
        }
      ];

      const mockStats: UserStats = {
        totalUsers: 25,
        activeUsers: 18,
        onlineUsers: 5,
        newUsersToday: 2
      };

      setUsers(mockUsers);
      setActivities(mockActivities);
      setStats(mockStats);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return { bg: '#FF4D4F', text: '#FFFFFF', label: '超级管理员' };
      case 'admin':
        return { bg: '#1677FF', text: '#FFFFFF', label: '管理员' };
      case 'operator':
        return { bg: '#52C41A', text: '#FFFFFF', label: '操作员' };
      case 'auditor':
        return { bg: '#FA8C16', text: '#FFFFFF', label: '审计员' };
      default:
        return { bg: '#8C8C8C', text: '#FFFFFF', label: '未知' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#F6FFED', text: '#52C41A', label: '正常', icon: 'fas fa-check-circle' };
      case 'inactive':
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未激活', icon: 'fas fa-minus-circle' };
      case 'locked':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '已锁定', icon: 'fas fa-lock' };
      case 'pending':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '待审核', icon: 'fas fa-clock' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知', icon: 'fas fa-question-circle' };
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    const matchesSearch = searchQuery === '' ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesRole && matchesStatus && matchesSearch;
  });

  const handleUserAction = (userId: string, action: 'activate' | 'deactivate' | 'lock' | 'unlock' | 'delete') => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        switch (action) {
          case 'activate':
            return { ...user, status: 'active' as const };
          case 'deactivate':
            return { ...user, status: 'inactive' as const };
          case 'lock':
            return { ...user, status: 'locked' as const };
          case 'unlock':
            return { ...user, status: 'active' as const };
          case 'delete':
            return user; // 在实际应用中，这里会从数组中移除用户
          default:
            return user;
        }
      }
      return user;
    }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-users fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载用户数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
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
          <h1 className="text-lg font-semibold">管理员用户</h1>
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

          {/* 用户统计 */}
          {stats && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#1677FF] mr-2"></i>
                用户统计
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {stats.totalUsers}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总用户数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {stats.activeUsers}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">活跃用户</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {stats.onlineUsers}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">在线用户</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {stats.newUsersToday}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日新增</div>
                </div>
              </div>
            </Card>
          )}

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={() => router.push('/admin/admin-users/create')}
              className="h-12 bg-[#52C41A] hover:bg-[#73D13D] text-white"
            >
              <i className="fas fa-user-plus mr-2"></i>
              新建用户
            </Button>
            <Button
              onClick={() => router.push('/admin/admin-users/batch')}
              className="h-12 bg-[#FA8C16] hover:bg-[#FFA940] text-white"
            >
              <i className="fas fa-users-cog mr-2"></i>
              批量操作
            </Button>
          </div>

          {/* 标签页切换 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setSelectedTab('users')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'users'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-users mr-1"></i>
                用户管理
              </button>
              <button
                onClick={() => setSelectedTab('activities')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'activities'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-history mr-1"></i>
                操作日志
              </button>
              <button
                onClick={() => setSelectedTab('permissions')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'permissions'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-key mr-1"></i>
                权限管理
              </button>
            </div>
          </Card>

          {/* 用户管理标签页 */}
          {selectedTab === 'users' && (
            <div className="space-y-4">
              {/* 搜索和筛选 */}
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <div className="space-y-3">
                  {/* 搜索框 */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="搜索用户名、姓名、邮箱或部门..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-[#d9d9d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1677FF] focus:border-transparent"
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c8c8c]"></i>
                  </div>

                  {/* 角色筛选 */}
                  <div className="flex space-x-2 overflow-x-auto">
                    {[
                      { key: 'all', label: '全部角色', count: users.length },
                      { key: 'super_admin', label: '超级管理员', count: users.filter(u => u.role === 'super_admin').length },
                      { key: 'admin', label: '管理员', count: users.filter(u => u.role === 'admin').length },
                      { key: 'operator', label: '操作员', count: users.filter(u => u.role === 'operator').length },
                      { key: 'auditor', label: '审计员', count: users.filter(u => u.role === 'auditor').length }
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => setFilterRole(filter.key)}
                        className={`
                          flex-shrink-0 px-3 py-1 rounded-md text-sm font-medium transition-all
                          ${filterRole === filter.key
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

                  {/* 状态筛选 */}
                  <div className="flex space-x-2 overflow-x-auto">
                    {[
                      { key: 'all', label: '全部状态', count: users.length },
                      { key: 'active', label: '正常', count: users.filter(u => u.status === 'active').length },
                      { key: 'inactive', label: '未激活', count: users.filter(u => u.status === 'inactive').length },
                      { key: 'locked', label: '已锁定', count: users.filter(u => u.status === 'locked').length },
                      { key: 'pending', label: '待审核', count: users.filter(u => u.status === 'pending').length }
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => setFilterStatus(filter.key)}
                        className={`
                          flex-shrink-0 px-3 py-1 rounded-md text-sm font-medium transition-all
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
                </div>
              </Card>

              {/* 用户列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[#262626]">用户列表</h3>
                  <span className="text-sm text-[#8c8c8c]">共 {filteredUsers.length} 个用户</span>
                </div>

                {filteredUsers.map((user) => {
                  const roleInfo = getRoleColor(user.role);
                  const statusInfo = getStatusColor(user.status);

                  return (
                    <Card
                      key={user.id}
                      className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                      onClick={() => router.push(`/admin/admin-users/${user.id}`)}
                    >
                      <div className="space-y-3">
                        {/* 基本信息 */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-12 h-12 bg-[#1677FF] rounded-full flex items-center justify-center text-white font-semibold mr-3">
                              {user.fullName.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                                {user.fullName}
                                <span
                                  className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: roleInfo.bg, color: roleInfo.text }}
                                >
                                  {roleInfo.label}
                                </span>
                              </h4>
                              <p className="text-sm text-[#8c8c8c] mb-1">
                                <i className="fas fa-user mr-1"></i>
                                {user.username} | {user.email}
                              </p>
                              <p className="text-sm text-[#8c8c8c]">
                                <i className="fas fa-building mr-1"></i>
                                {user.department}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className="px-2 py-1 rounded text-xs font-medium mb-2 flex items-center"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              <i className={`${statusInfo.icon} mr-1`}></i>
                              {statusInfo.label}
                            </div>
                          </div>
                        </div>

                        {/* 详细信息 */}
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#f0f0f0] text-sm">
                          <div>
                            <div className="text-[#8c8c8c] mb-1">上次登录</div>
                            <div className="font-medium text-[#262626]">{user.lastLogin}</div>
                          </div>
                          <div>
                            <div className="text-[#8c8c8c] mb-1">登录次数</div>
                            <div className="font-medium text-[#262626]">{user.loginCount} 次</div>
                          </div>
                          <div>
                            <div className="text-[#8c8c8c] mb-1">创建时间</div>
                            <div className="font-medium text-[#262626]">{user.createdAt}</div>
                          </div>
                          <div>
                            <div className="text-[#8c8c8c] mb-1">联系电话</div>
                            <div className="font-medium text-[#262626]">{user.phone}</div>
                          </div>
                        </div>

                        {/* 权限标签 */}
                        <div className="space-y-2">
                          <div className="text-sm text-[#8c8c8c]">权限：</div>
                          <div className="flex flex-wrap gap-1">
                            {user.permissions.map((permission, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-[#f0f0f0] text-[#8c8c8c] text-xs rounded"
                              >
                                {permission === '*' ? '所有权限' : permission}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#f0f0f0]">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/admin-users/edit/${user.id}`);
                            }}
                            className="bg-[#1677FF] hover:bg-[#4096FF] text-white text-sm h-8"
                          >
                            <i className="fas fa-edit mr-1"></i>
                            编辑
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              const action = user.status === 'locked' ? 'unlock' : 'lock';
                              if (confirm(`确定要${action === 'lock' ? '锁定' : '解锁'}此用户吗？`)) {
                                handleUserAction(user.id, action);
                              }
                            }}
                            className={`text-sm h-8 ${
                              user.status === 'locked'
                                ? 'bg-[#52C41A] hover:bg-[#73D13D] text-white'
                                : 'bg-[#FA8C16] hover:bg-[#FFA940] text-white'
                            }`}
                          >
                            <i className={`fas ${user.status === 'locked' ? 'fa-unlock' : 'fa-lock'} mr-1`}></i>
                            {user.status === 'locked' ? '解锁' : '锁定'}
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/admin-users/logs/${user.id}`);
                            }}
                            className="bg-[#8C8C8C] hover:bg-[#A6A6A6] text-white text-sm h-8"
                          >
                            <i className="fas fa-history mr-1"></i>
                            日志
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {/* 空状态 */}
                {filteredUsers.length === 0 && (
                  <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <i className="fas fa-search text-[#d9d9d9] text-4xl mb-4"></i>
                    <h3 className="font-medium text-[#8c8c8c] mb-2">没有找到匹配的用户</h3>
                    <p className="text-sm text-[#bfbfbf] mb-4">
                      请尝试调整搜索条件或筛选选项
                    </p>
                    <Button
                      onClick={() => {
                        setSearchQuery('');
                        setFilterRole('all');
                        setFilterStatus('all');
                      }}
                      className="bg-[#1677FF] hover:bg-[#4096FF] text-white"
                    >
                      清除筛选条件
                    </Button>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* 操作日志标签页 */}
          {selectedTab === 'activities' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">操作日志</h3>
                <span className="text-sm text-[#8c8c8c]">共 {activities.length} 条记录</span>
              </div>

              {activities.map((activity) => (
                <Card
                  key={activity.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                  onClick={() => router.push(`/admin/admin-users/activity/${activity.id}`)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                          <i className="fas fa-user-circle text-[#1677FF] mr-2"></i>
                          {activity.userName} - {activity.action}
                        </h4>
                        <p className="text-sm text-[#8c8c8c] mb-1">
                          {activity.details}
                        </p>
                        <p className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-clock mr-1"></i>
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0] text-xs text-[#bfbfbf]">
                      <span>
                        <i className="fas fa-map-marker-alt mr-1"></i>
                        {activity.ipAddress}
                      </span>
                      <span>{activity.userAgent.split(' ')[0]}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* 权限管理标签页 */}
          {selectedTab === 'permissions' && (
            <div className="space-y-4">
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3">权限管理</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/admin/permissions/roles')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">角色管理</div>
                        <div className="text-sm text-[#8c8c8c]">管理系统角色和权限分配</div>
                      </div>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/admin/permissions/resources')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">资源权限</div>
                        <div className="text-sm text-[#8c8c8c]">管理系统资源访问权限</div>
                      </div>
                      <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/admin/permissions/matrix')}
                    className="w-full p-3 text-left bg-[#f5f5f5] rounded-lg hover:bg-[#e6f7ff] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#262626]">权限矩阵</div>
                        <div className="text-sm text-[#8c8c8c]">查看角色与权限对应关系</div>
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
    </AdminLayoutWrapper>
  );
}
