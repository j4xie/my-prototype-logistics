'use client';

import { useState } from 'react';

interface User {
  id: string;
  username: string;
  realName: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  department: string;
  lastLogin: string;
  createdAt: string;
}

export default function UsersManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mock数据
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'admin001',
      realName: '张三',
      email: 'zhangsan@company.com',
      phone: '13800138001',
      role: 'admin',
      status: 'active',
      department: '系统管理部',
      lastLogin: '2025-02-02 14:30:00',
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      username: 'manager001',
      realName: '李四',
      email: 'lisi@company.com',
      phone: '13800138002',
      role: 'manager',
      status: 'active',
      department: '养殖管理部',
      lastLogin: '2025-02-02 10:15:00',
      createdAt: '2024-02-20'
    },
    {
      id: '3',
      username: 'operator001',
      realName: '王五',
      email: 'wangwu@company.com',
      phone: '13800138003',
      role: 'operator',
      status: 'active',
      department: '生产操作部',
      lastLogin: '2025-02-01 16:45:00',
      createdAt: '2024-03-10'
    },
    {
      id: '4',
      username: 'viewer001',
      realName: '赵六',
      email: 'zhaoliu@company.com',
      phone: '13800138004',
      role: 'viewer',
      status: 'inactive',
      department: '质量监督部',
      lastLogin: '2025-01-28 09:20:00',
      createdAt: '2024-04-05'
    },
    {
      id: '5',
      username: 'manager002',
      realName: '孙七',
      email: 'sunqi@company.com',
      phone: '13800138005',
      role: 'manager',
      status: 'suspended',
      department: '物流管理部',
      lastLogin: '2025-01-25 14:10:00',
      createdAt: '2024-05-12'
    }
  ];

  const displayUsers = mockUsers;

  // 过滤用户
  const filteredUsers = displayUsers.filter(user => {
    const matchesSearch = user.realName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // 获取角色显示名
  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return '系统管理员';
      case 'manager': return '部门管理员';
      case 'operator': return '操作员';
      case 'viewer': return '只读用户';
      default: return role;
    }
  };

  // 获取角色颜色
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'manager': return 'bg-blue-100 text-blue-700';
      case 'operator': return 'bg-green-100 text-green-700';
      case 'viewer': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 获取状态显示名
  const getStatusName = (status: string) => {
    switch (status) {
      case 'active': return '正常';
      case 'inactive': return '未激活';
      case 'suspended': return '已停用';
      default: return status;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-yellow-100 text-yellow-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 切换用户选择
  const toggleUserSelect = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  // 修改用户状态
  const changeUserStatus = async (userId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      // 刷新用户列表
    } catch (error) {
      console.error('修改用户状态失败:', error);
    }
  };

  // 批量操作
  const handleBatchAction = async (action: string) => {
    try {
      await fetch('/api/admin/users/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUsers, action })
      });
      setSelectedUsers([]);
      // 刷新用户列表
    } catch (error) {
      console.error('批量操作失败:', error);
    }
  };

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
            <h1 className="text-lg font-medium">用户管理</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30"
          >
            新增用户
          </button>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[80px]">
        {/* 搜索和筛选 */}
        <div className="px-4 py-3 border-b bg-white space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索用户名、姓名或邮箱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* 筛选器 */}
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
            >
              <option value="all">全部角色</option>
              <option value="admin">系统管理员</option>
              <option value="manager">部门管理员</option>
              <option value="operator">操作员</option>
              <option value="viewer">只读用户</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">未激活</option>
              <option value="suspended">已停用</option>
            </select>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-medium text-gray-900">{displayUsers.length}</p>
              <p className="text-xs text-gray-600">总用户</p>
            </div>
            <div>
              <p className="text-lg font-medium text-green-600">
                {displayUsers.filter(u => u.status === 'active').length}
              </p>
              <p className="text-xs text-gray-600">正常</p>
            </div>
            <div>
              <p className="text-lg font-medium text-yellow-600">
                {displayUsers.filter(u => u.status === 'inactive').length}
              </p>
              <p className="text-xs text-gray-600">未激活</p>
            </div>
            <div>
              <p className="text-lg font-medium text-red-600">
                {displayUsers.filter(u => u.status === 'suspended').length}
              </p>
              <p className="text-xs text-gray-600">已停用</p>
            </div>
          </div>
        </div>

        {/* 批量操作 */}
        {selectedUsers.length > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                已选择 {selectedUsers.length} 个用户
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBatchAction('activate')}
                  className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  激活
                </button>
                <button
                  onClick={() => handleBatchAction('suspend')}
                  className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  停用
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className="px-4 space-y-3 mt-4">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                👥
              </div>
              <p className="text-gray-600">暂无用户数据</p>
            </div>
          ) : (
            <>
              {/* 全选控制 */}
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                  全选 ({filteredUsers.length})
                </label>
              </div>

              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`bg-white rounded-lg shadow-sm p-4 border transition-all ${
                    selectedUsers.includes(user.id) ? 'ring-2 ring-[#1890FF] ring-opacity-30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelect(user.id)}
                      className="mt-1 rounded"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{user.realName}</h3>
                          <p className="text-sm text-gray-600">@{user.username}</p>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getRoleColor(user.role)}`}>
                            {getRoleName(user.role)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(user.status)}`}>
                            {getStatusName(user.status)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-600">
                          📧 {user.email}
                        </p>
                        <p className="text-xs text-gray-600">
                          📱 {user.phone}
                        </p>
                        <p className="text-xs text-gray-600">
                          🏢 {user.department}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          最后登录: {user.lastLogin}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {/* 编辑用户 */}}
                            className="text-xs text-[#1890FF] hover:underline"
                          >
                            编辑
                          </button>

                          {user.status === 'active' ? (
                            <button
                              onClick={() => changeUserStatus(user.id, 'suspended')}
                              className="text-xs text-red-500 hover:underline"
                            >
                              停用
                            </button>
                          ) : (
                            <button
                              onClick={() => changeUserStatus(user.id, 'active')}
                              className="text-xs text-green-500 hover:underline"
                            >
                              激活
                            </button>
                          )}

                          <button
                            onClick={() => {/* 重置密码 */}}
                            className="text-xs text-orange-500 hover:underline"
                          >
                            重置密码
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
        {filteredUsers.length >= 10 && (
          <div className="px-4 py-6 text-center">
            <button className="px-6 py-2 text-[#1890FF] border border-[#1890FF] rounded-lg hover:bg-[#1890FF] hover:text-white transition-colors">
              加载更多
            </button>
          </div>
        )}
      </main>

      {/* 创建用户模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">新增用户</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用户名 *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  真实姓名 *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                  placeholder="请输入真实姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱 *
                </label>
                <input
                  type="email"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                  placeholder="请输入邮箱"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  手机号 *
                </label>
                <input
                  type="tel"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                  placeholder="请输入手机号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色 *
                </label>
                <select className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent">
                  <option value="">请选择角色</option>
                  <option value="admin">系统管理员</option>
                  <option value="manager">部门管理员</option>
                  <option value="operator">操作员</option>
                  <option value="viewer">只读用户</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  部门 *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                  placeholder="请输入部门"
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 创建用户逻辑
                  setShowCreateModal(false);
                }}
                className="flex-1 py-2 bg-[#1890FF] text-white rounded-lg hover:bg-[#1677FF]"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
