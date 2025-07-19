'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  User,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit,
  Lock,
  UserCheck,
  UserX,
  Shield,
  Trash2,
  UserCog
} from 'lucide-react';

// 导入用户管理服务
import { 
  userService, 
  User as UserType, 
  UserRole, 
  Department, 
  UserListParams,
  UpdateUserParams,
  UserStats,
  UserApiError 
} from '@/services/user.service';

type TabType = 'active' | 'pending';
type ModalModeType = 'view' | 'edit' | 'activate' | 'permissions';

export default function UserManagementPage() {
  // 状态管理
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [users, setUsers] = useState<UserType[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserType[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // 模态框状态
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [modalMode, setModalMode] = useState<ModalModeType>('view');
  const [updateData, setUpdateData] = useState<UpdateUserParams>({});
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // 加载活跃用户数据
  const loadActiveUsers = async () => {
    try {
      setLoading(true);
      
      const params: UserListParams = {
        page: currentPage,
        pageSize,
        isActive: true,
        search: searchQuery || undefined,
        roleCode: roleFilter === 'all' ? undefined : roleFilter as UserRole,
        department: departmentFilter === 'all' ? undefined : departmentFilter as Department
      };

      const [listResponse, statsResponse] = await Promise.all([
        userService.getUserList(params),
        userService.getUserStats()
      ]);

      setUsers(listResponse.items);
      setTotalPages(listResponse.pagination.totalPages);
      setTotalRecords(listResponse.pagination.total);
      setStats(statsResponse);

    } catch (error) {
      console.error('加载用户数据失败:', error);
      if (error instanceof UserApiError) {
        alert(`加载失败: ${error.message}`);
      } else {
        alert('加载用户数据失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 加载待激活用户数据
  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getPendingUsers();
      setPendingUsers(response.items);
    } catch (error) {
      console.error('加载待激活用户失败:', error);
      if (error instanceof UserApiError) {
        alert(`加载失败: ${error.message}`);
      } else {
        alert('加载待激活用户失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'active') {
      loadActiveUsers();
    } else {
      loadPendingUsers();
    }
  }, [activeTab, currentPage, searchQuery, roleFilter, departmentFilter]);

  // 打开用户详情模态框
  const openUserModal = (user: UserType, mode: ModalModeType) => {
    setSelectedUser(user);
    setModalMode(mode);
    setUpdateData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      department: user.department,
      position: user.position,
      roleCode: user.roleCode,
      roleLevel: user.roleLevel
    });
    setSelectedPermissions([...user.permissions]);
    setShowUserModal(true);
  };

  // 更新用户信息
  const handleUpdateUser = async () => {
    if (!selectedUser || (modalMode !== 'edit' && modalMode !== 'permissions')) return;

    try {
      let finalUpdateData = { ...updateData };
      
      // 如果是权限编辑模式，包含权限信息
      if (modalMode === 'permissions') {
        finalUpdateData.permissions = selectedPermissions;
        
        // 如果更改了部门或角色，重新计算权限
        if (updateData.department && updateData.department !== selectedUser.department) {
          const departmentPermissions = userService.getDepartmentPermissions(updateData.department);
          finalUpdateData.permissions = [...new Set([...selectedPermissions, ...departmentPermissions])];
        }
        
        if (updateData.roleCode && updateData.roleCode !== selectedUser.roleCode) {
          finalUpdateData.roleLevel = userService.getRoleLevel(updateData.roleCode);
        }
      }

      await userService.updateUser(selectedUser.id, finalUpdateData);
      
      // 重新加载数据
      if (activeTab === 'active') {
        await loadActiveUsers();
      }
      
      setShowUserModal(false);
      alert('用户信息更新成功');
    } catch (error) {
      console.error('更新用户信息失败:', error);
      if (error instanceof UserApiError) {
        alert(`更新失败: ${error.message}`);
      } else {
        alert('更新用户信息失败，请重试');
      }
    }
  };

  // 切换用户状态
  const handleToggleUserStatus = async (user: UserType) => {
    const action = user.isActive ? '停用' : '启用';
    if (!confirm(`确定要${action}用户 ${user.fullName} 吗？`)) return;

    try {
      await userService.toggleUserStatus(user.id, !user.isActive);
      
      // 重新加载数据
      await loadActiveUsers();
      alert(`用户${action}成功`);
    } catch (error) {
      console.error('切换用户状态失败:', error);
      if (error instanceof UserApiError) {
        alert(`${action}失败: ${error.message}`);
      } else {
        alert(`用户${action}失败，请重试`);
      }
    }
  };

  // 重置用户密码
  const handleResetPassword = async (user: UserType) => {
    if (!confirm(`确定要重置用户 ${user.fullName} 的密码吗？`)) return;

    try {
      const result = await userService.resetUserPassword(user.id);
      alert(`密码重置成功！临时密码：${result.tempPassword}\n请让用户使用此密码登录并及时修改。`);
    } catch (error) {
      console.error('重置密码失败:', error);
      if (error instanceof UserApiError) {
        alert(`重置密码失败: ${error.message}`);
      } else {
        alert('重置密码失败，请重试');
      }
    }
  };

  // 激活用户
  const handleActivateUser = async (user: UserType) => {
    openUserModal(user, 'activate');
  };

  // 删除用户
  const handleDeleteUser = async (user: UserType) => {
    const confirmMessage = `确定要删除用户 ${user.fullName} (@${user.username}) 吗？\n\n⚠️ 此操作不可恢复！`;
    if (!confirm(confirmMessage)) return;

    try {
      await userService.deleteUser(user.id);
      
      // 重新加载数据
      await loadActiveUsers();
      alert('用户删除成功');
    } catch (error) {
      console.error('删除用户失败:', error);
      if (error instanceof UserApiError) {
        alert(`删除失败: ${error.message}`);
      } else {
        alert('删除用户失败，请重试');
      }
    }
  };

  // 获取角色显示名称
  const getRoleDisplayName = (roleCode: UserRole) => {
    return userService.getRoleDisplayName(roleCode);
  };

  // 获取部门显示名称
  const getDepartmentDisplayName = (department?: Department) => {
    return department ? userService.getDepartmentDisplayName(department) : '未分配';
  };

  // 获取状态显示信息
  const getStatusInfo = (user: UserType) => {
    if (!user.isActive) {
      return { label: '已停用', color: 'bg-red-100 text-red-700', icon: XCircle };
    }
    if (user.roleCode === 'unactivated') {
      return { label: '待激活', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
    }
    return { label: '正常', color: 'bg-green-100 text-green-700', icon: CheckCircle };
  };

  const currentUsers = activeTab === 'active' ? users : pendingUsers;
  const filteredUsers = currentUsers.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.phone && user.phone.includes(searchQuery)) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-[390px] mx-auto space-y-4">
        {/* 页面标题 */}
        <div className="text-center py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-2">用户管理</h1>
          <p className="text-sm text-gray-600">管理系统用户和权限</p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-lg font-bold text-green-600">
                  {stats.activeUsers}
                </div>
                <div className="text-xs text-gray-600">活跃用户</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-lg font-bold text-yellow-600">
                  {stats.pendingUsers}
                </div>
                <div className="text-xs text-gray-600">待激活</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-lg font-bold text-blue-600">
                  {stats.totalUsers}
                </div>
                <div className="text-xs text-gray-600">总用户</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 选项卡 */}
        <Card>
          <CardContent className="p-0">
            <div className="flex">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 p-3 text-sm font-medium ${
                  activeTab === 'active'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                活跃用户
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 p-3 text-sm font-medium ${
                  activeTab === 'pending'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                待激活用户
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={() => activeTab === 'active' ? loadActiveUsers() : loadPendingUsers()}
            variant="secondary"
            className="flex items-center gap-1 flex-1 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            刷新列表
          </Button>
        </div>

        {/* 搜索和过滤 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索用户名、姓名、手机号或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {activeTab === 'active' && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="p-2 border rounded-md text-sm"
                >
                  <option value="all">全部角色</option>
                  <option value="user">普通用户</option>
                  <option value="department_admin">部门管理员</option>
                  <option value="permission_admin">权限管理员</option>
                  <option value="super_admin">超级管理员</option>
                </select>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="p-2 border rounded-md text-sm"
                >
                  <option value="all">全部部门</option>
                  <option value="farming">养殖部门</option>
                  <option value="processing">生产部门</option>
                  <option value="logistics">物流部门</option>
                  <option value="quality">质检部门</option>
                  <option value="management">管理部门</option>
                  <option value="admin">系统管理</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              {activeTab === 'active' ? '活跃用户' : '待激活用户'} ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>暂无用户</p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredUsers.map((user, index) => {
                  const statusInfo = getStatusInfo(user);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={user.id}
                      className={`p-4 ${
                        index !== filteredUsers.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{user.fullName}</span>
                            <span className="text-xs text-gray-500">(@{user.username})</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {getRoleDisplayName(user.roleCode)}
                            </span>
                          </div>

                          {user.department && (
                            <div className="text-xs text-gray-600 mb-1">
                              部门：{getDepartmentDisplayName(user.department)}
                            </div>
                          )}

                          {user.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                              <Phone className="w-3 h-3" />
                              {user.phone}
                            </div>
                          )}

                          {user.email && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            创建时间：{new Date(user.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 ml-2">
                          <Button
                            onClick={() => openUserModal(user, 'view')}
                            variant="ghost"
                            size="small"
                            className="p-1 h-auto"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          
                          {activeTab === 'active' ? (
                            <>
                              <Button
                                onClick={() => openUserModal(user, 'edit')}
                                variant="ghost"
                                size="small"
                                className="p-1 h-auto"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => handleToggleUserStatus(user)}
                                variant="ghost"
                                size="small"
                                className="p-1 h-auto"
                              >
                                {user.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                              </Button>
                              <Button
                                onClick={() => handleResetPassword(user)}
                                variant="ghost"
                                size="small"
                                className="p-1 h-auto"
                              >
                                <Lock className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => openUserModal(user, 'permissions')}
                                variant="ghost"
                                size="small"
                                className="p-1 h-auto text-blue-600"
                              >
                                <UserCog className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteUser(user)}
                                variant="ghost"
                                size="small"
                                className="p-1 h-auto text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleActivateUser(user)}
                              variant="ghost"
                              size="small"
                              className="p-1 h-auto text-green-600"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分页控件 */}
        {activeTab === 'active' && totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  第 {currentPage} 页，共 {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs"
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 用户详情/编辑模态框 */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-center">
                  {modalMode === 'view' ? '用户详情' : 
                   modalMode === 'edit' ? '编辑用户' : 
                   modalMode === 'permissions' ? '权限管理' : '激活用户'}
                </CardTitle>
                <div className="text-sm text-gray-600 text-center">
                  {selectedUser.fullName} (@{selectedUser.username})
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {modalMode === 'view' ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm"><strong>角色：</strong>{getRoleDisplayName(selectedUser.roleCode)}</div>
                      <div className="text-sm"><strong>部门：</strong>{getDepartmentDisplayName(selectedUser.department)}</div>
                      <div className="text-sm"><strong>职位：</strong>{selectedUser.position || '未设置'}</div>
                      <div className="text-sm"><strong>邮箱：</strong>{selectedUser.email || '未设置'}</div>
                      <div className="text-sm"><strong>手机：</strong>{selectedUser.phone || '未设置'}</div>
                      <div className="text-sm"><strong>状态：</strong>{selectedUser.isActive ? '正常' : '已停用'}</div>
                      <div className="text-sm"><strong>创建时间：</strong>{new Date(selectedUser.createdAt).toLocaleString('zh-CN')}</div>
                      <div className="text-sm"><strong>权限：</strong></div>
                      <div className="text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                        {selectedUser.permissions.join(', ') || '无权限'}
                      </div>
                    </div>
                  </>
                ) : modalMode === 'edit' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">姓名</label>
                      <Input
                        value={updateData.fullName || ''}
                        onChange={(e) => setUpdateData(prev => ({ ...prev, fullName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">邮箱</label>
                      <Input
                        type="email"
                        value={updateData.email || ''}
                        onChange={(e) => setUpdateData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">手机号</label>
                      <Input
                        value={updateData.phone || ''}
                        onChange={(e) => setUpdateData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">职位</label>
                      <Input
                        value={updateData.position || ''}
                        onChange={(e) => setUpdateData(prev => ({ ...prev, position: e.target.value }))}
                      />
                    </div>
                  </>
                ) : modalMode === 'permissions' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">角色</label>
                      <select
                        value={updateData.roleCode || selectedUser.roleCode}
                        onChange={(e) => setUpdateData(prev => ({ 
                          ...prev, 
                          roleCode: e.target.value as UserRole 
                        }))}
                        className="w-full p-2 border rounded-md text-sm"
                      >
                        <option value="user">普通用户</option>
                        <option value="department_admin">部门管理员</option>
                        <option value="permission_admin">权限管理员</option>
                        <option value="super_admin">超级管理员</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">部门</label>
                      <select
                        value={updateData.department || selectedUser.department || ''}
                        onChange={(e) => setUpdateData(prev => ({ 
                          ...prev, 
                          department: e.target.value as Department 
                        }))}
                        className="w-full p-2 border rounded-md text-sm"
                      >
                        <option value="">请选择部门</option>
                        <option value="farming">养殖部门</option>
                        <option value="processing">生产部门</option>
                        <option value="logistics">物流部门</option>
                        <option value="quality">质检部门</option>
                        <option value="management">管理部门</option>
                        <option value="admin">系统管理</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">权限</label>
                      <div className="text-xs text-gray-500 mb-2">
                        当前权限 ({selectedPermissions.length} 个)
                      </div>
                      <div className="bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                        <div className="text-xs space-y-1">
                          {selectedPermissions.map((permission, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span>{permission}</span>
                              <button
                                onClick={() => setSelectedPermissions(prev => 
                                  prev.filter((_, i) => i !== index)
                                )}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {updateData.department && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const departmentPermissions = userService.getDepartmentPermissions(updateData.department!);
                              setSelectedPermissions(prev => 
                                [...new Set([...prev, ...departmentPermissions])]
                              );
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            + 添加 {userService.getDepartmentDisplayName(updateData.department)} 默认权限
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-600">
                    激活功能需要进一步实现...
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowUserModal(false)}
                    className="flex-1"
                  >
                    {modalMode === 'view' ? '关闭' : '取消'}
                  </Button>
                  {(modalMode === 'edit' || modalMode === 'permissions') && (
                    <Button
                      onClick={handleUpdateUser}
                      className="flex-1"
                    >
                      {modalMode === 'permissions' ? '保存权限' : '保存更改'}
                    </Button>
                  )}
                  {modalMode === 'activate' && (
                    <Button
                      onClick={() => {/* 实现激活逻辑 */}}
                      className="flex-1"
                    >
                      确认激活
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}