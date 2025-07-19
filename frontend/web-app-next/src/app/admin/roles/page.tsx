"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  PageLayout,
  Input,
  Badge,
  StatCard,
  Modal
} from '@/components/ui';
import { AdminLayoutWrapper } from '@/components/admin';

interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  permissions: number[];
  userCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  level: 'admin' | 'manager' | 'operator' | 'viewer';
}

export default function AdminRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // 模拟权限数据
  useEffect(() => {
    setPermissions([
      { id: 1, name: '用户查看', code: 'user_view', module: 'user', description: '查看用户列表和详情' },
      { id: 2, name: '用户编辑', code: 'user_edit', module: 'user', description: '编辑用户信息' },
      { id: 3, name: '用户删除', code: 'user_delete', module: 'user', description: '删除用户账户' },
      { id: 4, name: '产品查看', code: 'product_view', module: 'product', description: '查看产品列表' },
      { id: 5, name: '产品管理', code: 'product_manage', module: 'product', description: '管理产品信息' },
      { id: 6, name: '溯源查看', code: 'trace_view', module: 'trace', description: '查看溯源信息' },
      { id: 7, name: '溯源编辑', code: 'trace_edit', module: 'trace', description: '编辑溯源数据' },
      { id: 8, name: '报表查看', code: 'report_view', module: 'report', description: '查看系统报表' },
      { id: 9, name: '系统设置', code: 'system_config', module: 'system', description: '系统配置管理' },
      { id: 10, name: '角色管理', code: 'role_manage', module: 'admin', description: '角色权限管理' }
    ]);

    setRoles([
      {
        id: 1,
        name: '超级管理员',
        code: 'super_admin',
        description: '拥有系统所有权限，可以管理所有功能',
        permissions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        userCount: 2,
        status: 'active',
        level: 'admin',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15'
      },
      {
        id: 2,
        name: '业务经理',
        code: 'business_manager',
        description: '管理业务流程，拥有大部分业务权限',
        permissions: [1, 2, 4, 5, 6, 7, 8],
        userCount: 5,
        status: 'active',
        level: 'manager',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-20'
      },
      {
        id: 3,
        name: '养殖操作员',
        code: 'farming_operator',
        description: '负责养殖相关的数据录入和管理',
        permissions: [4, 6, 7],
        userCount: 12,
        status: 'active',
        level: 'operator',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-18'
      },
      {
        id: 4,
        name: '数据查看员',
        code: 'data_viewer',
        description: '只能查看数据，不能编辑',
        permissions: [1, 4, 6, 8],
        userCount: 8,
        status: 'active',
        level: 'viewer',
        createdAt: '2024-01-04',
        updatedAt: '2024-01-16'
      },
      {
        id: 5,
        name: '测试角色',
        code: 'test_role',
        description: '用于测试的角色',
        permissions: [1],
        userCount: 0,
        status: 'inactive',
        level: 'viewer',
        createdAt: '2024-01-05',
        updatedAt: '2024-01-10'
      }
    ]);
  }, []);

  // 筛选角色
  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || role.status === filterStatus;
    const matchesLevel = filterLevel === 'all' || role.level === filterLevel;
    return matchesSearch && matchesStatus && matchesLevel;
  });

  // 获取权限名称
  const getPermissionNames = (permissionIds: number[]) => {
    return permissions
      .filter(p => permissionIds.includes(p.id))
      .map(p => p.name);
  };

  // 获取级别配置
  const getLevelConfig = (level: string) => {
    const configs = {
      admin: { color: 'bg-red-100 text-red-800', text: '管理员', icon: '👑' },
      manager: { color: 'bg-blue-100 text-blue-800', text: '经理', icon: '👨‍💼' },
      operator: { color: 'bg-green-100 text-green-800', text: '操作员', icon: '👷' },
      viewer: { color: 'bg-gray-100 text-gray-800', text: '查看员', icon: '👁️' }
    };
    return configs[level as keyof typeof configs] || configs.viewer;
  };

  // 删除角色
  const handleDeleteRole = async (roleId: number) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    if (role.userCount > 0) {
      alert(`无法删除角色"${role.name}"，还有 ${role.userCount} 个用户使用此角色`);
      return;
    }

    if (!confirm(`确定要删除角色"${role.name}"吗？`)) return;

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRoles(roles.filter(r => r.id !== roleId));
      alert('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 切换角色状态
  const handleToggleStatus = async (roleId: number) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRoles(roles.map(role =>
        role.id === roleId
          ? { ...role, status: role.status === 'active' ? 'inactive' : 'active' }
          : role
      ));
      alert('状态更新成功');
    } catch (error) {
      console.error('状态更新失败:', error);
      alert('状态更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 编辑角色
  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setShowRoleModal(true);
  };

  const FilterSelect = ({
    value,
    onChange,
    options,
    placeholder
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder: string
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
    >
      <option value="all">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );

  return (
    <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
      <PageLayout
        title="角色管理"
        showBack={true}
        onBack={() => router.back()}
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            title="总角色"
            value={roles.length}
            className="bg-blue-50 border-blue-200"
          />
          <StatCard
            title="活跃角色"
            value={roles.filter(r => r.status === 'active').length}
            className="bg-green-50 border-green-200"
          />
          <StatCard
            title="管理员角色"
            value={roles.filter(r => r.level === 'admin').length}
            className="bg-red-50 border-red-200"
          />
          <StatCard
            title="总用户数"
            value={roles.reduce((sum, role) => sum + role.userCount, 0)}
            className="bg-purple-50 border-purple-200"
          />
        </div>

        {/* 搜索和筛选 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="space-y-3">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索角色名称或描述..."
              className="w-full"
            />

            <div className="grid grid-cols-2 gap-3">
              <FilterSelect
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="全部状态"
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '禁用' }
                ]}
              />

              <FilterSelect
                value={filterLevel}
                onChange={setFilterLevel}
                placeholder="全部级别"
                options={[
                  { value: 'admin', label: '管理员' },
                  { value: 'manager', label: '经理' },
                  { value: 'operator', label: '操作员' },
                  { value: 'viewer', label: '查看员' }
                ]}
              />
            </div>

            <div className="text-right">
              <Badge className="bg-gray-100 text-gray-800">
                共 {filteredRoles.length} 个角色
              </Badge>
            </div>
          </div>
        </Card>

        {/* 添加角色按钮 */}
        <div className="mb-4">
          <Button
            onClick={() => {
              setEditingRole(null);
              setShowRoleModal(true);
            }}
            className="w-full hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="mr-2">➕</span>
            添加新角色
          </Button>
        </div>

        {/* 角色列表 */}
        <div className="space-y-3">
          {filteredRoles.map(role => {
            const levelConfig = getLevelConfig(role.level);
            const permissionNames = getPermissionNames(role.permissions);

            return (
              <Card key={role.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md hover:scale-[1.01] transition-all">
                <div className="space-y-3">
                  {/* 角色基本信息 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                        <span className="text-xl">{levelConfig.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{role.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">代码: {role.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={levelConfig.color}>
                        {levelConfig.text}
                      </Badge>
                      <Badge className={role.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {role.status === 'active' ? '启用' : '禁用'}
                      </Badge>
                    </div>
                  </div>

                  {/* 角色描述 */}
                  <p className="text-xs text-gray-600 line-clamp-2">{role.description}</p>

                  {/* 用户统计 */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-gray-500">权限数</div>
                      <div className="font-medium text-blue-600">{role.permissions.length}</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-gray-500">用户数</div>
                      <div className="font-medium text-green-600">{role.userCount}</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-gray-500">更新时间</div>
                      <div className="font-medium text-gray-600">{role.updatedAt}</div>
                    </div>
                  </div>

                  {/* 权限列表 */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-2">拥有权限:</div>
                    <div className="flex flex-wrap gap-1">
                      {permissionNames.length > 0 ? (
                        permissionNames.slice(0, 4).map((name, index) => (
                          <Badge key={index} className="bg-blue-100 text-blue-800 text-xs">
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">暂无权限</span>
                      )}
                      {permissionNames.length > 4 && (
                        <Badge className="bg-gray-100 text-gray-600 text-xs">
                          +{permissionNames.length - 4}个
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handleEditRole(role)}
                      variant="secondary"
                      className="flex-1 text-xs"
                    >
                      <span className="mr-1">✏️</span>
                      编辑
                    </Button>
                    <Button
                      onClick={() => handleToggleStatus(role.id)}
                      disabled={loading}
                      variant="secondary"
                      className="flex-1 text-xs"
                    >
                      <span className="mr-1">{role.status === 'active' ? '⏸️' : '▶️'}</span>
                      {role.status === 'active' ? '禁用' : '启用'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteRole(role.id)}
                      disabled={loading || role.userCount > 0}
                      variant="danger"
                      className="flex-1 text-xs"
                    >
                      <span className="mr-1">🗑️</span>
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredRoles.length === 0 && (
            <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500 mb-4">暂无匹配的角色</p>
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterLevel('all');
                }}
                variant="secondary"
              >
                清除筛选条件
              </Button>
            </Card>
          )}
        </div>
      </main>

      {/* 角色编辑弹窗 */}
      {showRoleModal && (
        <Modal
          isOpen={showRoleModal}
          onClose={() => setShowRoleModal(false)}
          title={editingRole ? '编辑角色' : '添加角色'}
        >
          <div className="p-4 space-y-4">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🚧</div>
              <p className="text-gray-600">角色编辑功能正在开发中...</p>
              <p className="text-xs text-gray-500 mt-2">敬请期待完整的权限配置功能</p>
            </div>
            <Button
              onClick={() => setShowRoleModal(false)}
              variant="secondary"
              className="w-full"
            >
              关闭
            </Button>
          </div>
        </Modal>
      )}
    </PageLayout>
    </AdminLayoutWrapper>
  );
}
