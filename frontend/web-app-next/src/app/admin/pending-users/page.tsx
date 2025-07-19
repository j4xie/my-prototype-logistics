'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Users,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  User,
  Settings,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

// 导入用户管理服务
import { 
  userService, 
  User as UserType, 
  UserRole, 
  Department, 
  ActivateUserParams,
  UserApiError 
} from '@/services/user.service';

export default function PendingUsersPage() {
  // 状态管理
  const [pendingUsers, setPendingUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [activationData, setActivationData] = useState<ActivateUserParams>({
    roleCode: 'user',
    roleLevel: 50,
    department: undefined,
    position: '',
    permissions: []
  });
  const [activationLoading, setActivationLoading] = useState(false);

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
    loadPendingUsers();
  }, []);

  // 过滤用户
  const filteredUsers = pendingUsers.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.phone && user.phone.includes(searchQuery))
  );

  // 打开激活模态框
  const openActivateModal = (user: UserType) => {
    setSelectedUser(user);
    setActivationData({
      roleCode: 'user',
      roleLevel: 50,
      department: undefined,
      position: '',
      permissions: []
    });
    setShowActivateModal(true);
  };

  // 激活用户
  const handleActivateUser = async () => {
    if (!selectedUser) return;

    // 验证必填字段
    if (!activationData.department) {
      alert('请选择部门');
      return;
    }

    setActivationLoading(true);
    try {
      // 根据部门和角色自动设置权限
      const permissions = userService.getDepartmentPermissions(activationData.department);
      const roleLevel = userService.getRoleLevel(activationData.roleCode);

      const finalActivationData: ActivateUserParams = {
        ...activationData,
        roleLevel,
        permissions
      };

      await userService.activateUser(selectedUser.id, finalActivationData);
      
      // 重新加载数据
      await loadPendingUsers();
      
      setShowActivateModal(false);
      setSelectedUser(null);
      alert('用户激活成功');
    } catch (error) {
      console.error('用户激活失败:', error);
      if (error instanceof UserApiError) {
        alert(`激活失败: ${error.message}`);
      } else {
        alert('用户激活失败，请重试');
      }
    } finally {
      setActivationLoading(false);
    }
  };

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
          <h1 className="text-xl font-bold text-gray-900 mb-2">待激活用户管理</h1>
          <p className="text-sm text-gray-600">审核并激活新注册的用户</p>
        </div>

        {/* 统计信息 */}
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <span className="text-lg font-bold text-orange-600">{pendingUsers.length}</span>
            </div>
            <div className="text-sm text-gray-600">待激活用户</div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={loadPendingUsers}
            variant="secondary"
            className="flex items-center gap-1 flex-1 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            刷新列表
          </Button>
        </div>

        {/* 搜索 */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索用户名、姓名或手机号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              待激活用户列表 ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>暂无待激活用户</p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className={`p-4 flex items-center justify-between ${
                      index !== filteredUsers.length - 1 ? 'border-b' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{user.fullName}</span>
                        <span className="text-xs text-gray-500">(@{user.username})</span>
                      </div>
                      
                      {user.phone && (
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-600">{user.phone}</span>
                        </div>
                      )}
                      
                      {user.email && (
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-600">{user.email}</span>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        注册时间：{new Date(user.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => openActivateModal(user)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <CheckCircle className="w-3 h-3" />
                      激活
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户激活模态框 */}
        {showActivateModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-center">激活用户</CardTitle>
                <div className="text-sm text-gray-600 text-center">
                  {selectedUser.fullName} (@{selectedUser.username})
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    角色 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={activationData.roleCode}
                    onChange={(e) => setActivationData(prev => ({ 
                      ...prev, 
                      roleCode: e.target.value as UserRole 
                    }))}
                    className="w-full p-2 border rounded-md text-sm"
                  >
                    <option value="user">普通用户</option>
                    <option value="department_admin">部门管理员</option>
                    <option value="permission_admin">权限管理员</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    部门 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={activationData.department || ''}
                    onChange={(e) => setActivationData(prev => ({ 
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
                  <label className="block text-sm font-medium mb-1">职位</label>
                  <Input
                    placeholder="请输入职位"
                    value={activationData.position}
                    onChange={(e) => setActivationData(prev => ({ 
                      ...prev, 
                      position: e.target.value 
                    }))}
                  />
                </div>

                {activationData.department && (
                  <div>
                    <label className="block text-sm font-medium mb-1">权限预览</label>
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {userService.getDepartmentPermissions(activationData.department).join(', ')}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowActivateModal(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleActivateUser}
                    disabled={activationLoading || !activationData.department}
                    className="flex-1"
                  >
                    {activationLoading ? '激活中...' : '确认激活'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}