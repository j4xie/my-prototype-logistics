'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminLayoutWrapper } from '@/components/admin';

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string;
  level: 'read' | 'write' | 'admin';
  status: 'active' | 'inactive';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  status: 'active' | 'inactive';
  level: 'basic' | 'advanced' | 'admin';
}

interface PermissionMetrics {
  totalRoles: number;
  activeRoles: number;
  totalPermissions: number;
  assignedUsers: number;
}

export default function PermissionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [metrics, setMetrics] = useState<PermissionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'roles' | 'permissions'>('roles');

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

      const mockRoles: Role[] = [
        {
          id: 'R001',
          name: '系统管理员',
          description: '拥有系统所有权限',
          permissions: ['user_manage', 'role_manage', 'system_config', 'data_export', 'audit_view'],
          userCount: 2,
          status: 'active',
          level: 'admin'
        },
        {
          id: 'R002',
          name: '业务管理员',
          description: '管理日常业务操作',
          permissions: ['product_manage', 'order_manage', 'customer_manage', 'report_view'],
          userCount: 8,
          status: 'active',
          level: 'advanced'
        },
        {
          id: 'R003',
          name: '操作员',
          description: '基础操作权限',
          permissions: ['product_view', 'order_view', 'basic_operation'],
          userCount: 25,
          status: 'active',
          level: 'basic'
        },
        {
          id: 'R004',
          name: '访客',
          description: '只读访问权限',
          permissions: ['view_only'],
          userCount: 5,
          status: 'inactive',
          level: 'basic'
        }
      ];

      const mockPermissions: Permission[] = [
        {
          id: 'P001',
          name: '用户管理',
          code: 'user_manage',
          module: '系统管理',
          description: '创建、编辑、删除用户',
          level: 'admin',
          status: 'active'
        },
        {
          id: 'P002',
          name: '角色管理',
          code: 'role_manage',
          module: '系统管理',
          description: '管理用户角色和权限',
          level: 'admin',
          status: 'active'
        },
        {
          id: 'P003',
          name: '产品管理',
          code: 'product_manage',
          module: '业务模块',
          description: '管理产品信息',
          level: 'write',
          status: 'active'
        },
        {
          id: 'P004',
          name: '订单管理',
          code: 'order_manage',
          module: '业务模块',
          description: '处理订单信息',
          level: 'write',
          status: 'active'
        },
        {
          id: 'P005',
          name: '数据查看',
          code: 'view_only',
          module: '基础权限',
          description: '只读访问数据',
          level: 'read',
          status: 'active'
        }
      ];

      const mockMetrics: PermissionMetrics = {
        totalRoles: 4,
        activeRoles: 3,
        totalPermissions: 15,
        assignedUsers: 40
      };

      setRoles(mockRoles);
      setPermissions(mockPermissions);
      setMetrics(mockMetrics);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '管理员' };
      case 'advanced':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '高级' };
      case 'basic':
        return { bg: '#F6FFED', text: '#52C41A', label: '基础' };
      case 'read':
        return { bg: '#E6F7FF', text: '#1677FF', label: '只读' };
      case 'write':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '读写' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#F6FFED', text: '#52C41A', label: '启用' };
      case 'inactive':
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '禁用' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知' };
    }
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-shield-alt fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载权限数据...'}
            </p>
          </div>
        </div>
      </AdminLayoutWrapper>
    );
  }

  return (
    <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
    <div className="min-h-screen bg-gray-50">
      {/* PC端顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="fas fa-arrow-left text-lg"></i>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">权限管理</h1>
              <nav className="flex mt-1" aria-label="Breadcrumb">
                <ol className="inline-flex items-center space-x-1 md:space-x-3">
                  <li>
                    <button onClick={() => router.push('/admin/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
                      管理后台
                    </button>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <i className="fas fa-chevron-right text-gray-400 text-xs mx-2"></i>
                      <span className="text-sm font-medium text-gray-700">权限管理</span>
                    </div>
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.push('/admin/permissions/new-role')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2"
            >
              <i className="fas fa-plus mr-2"></i>
              新建角色
            </Button>
            <Button
              onClick={() => router.push('/admin/permissions/audit')}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2"
            >
              <i className="fas fa-eye mr-2"></i>
              权限审计
            </Button>
          </div>
        </div>
      </header>

      {/* PC端主内容区域 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 左侧：权限概览卡片 */}
          <div className="lg:col-span-1">
            {metrics && (
              <Card className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                  <i className="fas fa-chart-pie text-indigo-600 mr-3"></i>
                  权限概览
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-3xl font-bold text-indigo-600 mb-2">
                      {metrics.totalRoles}
                    </div>
                    <div className="text-sm text-gray-600">总角色数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {metrics.activeRoles}
                    </div>
                    <div className="text-sm text-gray-600">启用角色</div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <div className="text-3xl font-bold text-amber-600 mb-2">
                      {metrics.totalPermissions}
                    </div>
                    <div className="text-sm text-gray-600">总权限数</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {metrics.assignedUsers}
                    </div>
                    <div className="text-sm text-gray-600">分配用户</div>
                  </div>
                </div>
              </Card>
            )}

            {/* 快捷操作 */}
            <Card className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fas fa-bolt text-amber-600 mr-3"></i>
                快捷操作
              </h3>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/admin/permissions/new-role')}
                  className="w-full justify-start bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  <i className="fas fa-plus mr-3"></i>
                  新建角色
                </Button>
                <Button
                  onClick={() => router.push('/admin/permissions/audit')}
                  className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white py-3"
                >
                  <i className="fas fa-eye mr-3"></i>
                  权限审计
                </Button>
                <Button
                  onClick={() => router.push('/admin/permissions/matrix')}
                  className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white py-3"
                >
                  <i className="fas fa-table mr-3"></i>
                  权限矩阵
                </Button>
              </div>
            </Card>
          </div>

          {/* 右侧：主要内容区域 */}
          <div className="lg:col-span-2">
            {/* 标签页切换 */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setSelectedTab('roles')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      selectedTab === 'roles'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <i className="fas fa-users mr-2"></i>
                    角色管理
                  </button>
                  <button
                    onClick={() => setSelectedTab('permissions')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      selectedTab === 'permissions'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <i className="fas fa-key mr-2"></i>
                    权限列表
                  </button>
                </nav>
              </div>
            </div>

          {/* 角色管理标签页 */}
          {selectedTab === 'roles' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">系统角色</h3>
                <span className="text-sm text-[#8c8c8c]">共 {roles.length} 个角色</span>
              </div>

              {roles.map((role) => {
                const levelInfo = getLevelColor(role.level);
                const statusInfo = getStatusColor(role.status);

                return (
                  <Card
                    key={role.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/permissions/role/${role.id}`)}
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            {role.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: levelInfo.bg, color: levelInfo.text }}
                            >
                              {levelInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            {role.description}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-users mr-1"></i>
                            用户数量: {role.userCount}
                          </p>
                        </div>
                        <div
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                        >
                          {statusInfo.label}
                        </div>
                      </div>

                      {/* 权限统计 */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
                        <span className="text-sm text-[#8c8c8c]">
                          <i className="fas fa-key mr-1"></i>
                          权限数量: {role.permissions.length}
                        </span>
                        <i className="fas fa-chevron-right text-[#d9d9d9]"></i>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 权限列表标签页 */}
          {selectedTab === 'permissions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">系统权限</h3>
                <span className="text-sm text-[#8c8c8c]">共 {permissions.length} 个权限</span>
              </div>

              {permissions.map((permission) => {
                const levelInfo = getLevelColor(permission.level);
                const statusInfo = getStatusColor(permission.status);

                return (
                  <Card
                    key={permission.id}
                    className="bg-white rounded-lg shadow-sm p-4"
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            {permission.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: levelInfo.bg, color: levelInfo.text }}
                            >
                              {levelInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            <i className="fas fa-tag mr-1"></i>
                            代码: {permission.code}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-folder mr-1"></i>
                            模块: {permission.module}
                          </p>
                        </div>
                        <div
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                        >
                          {statusInfo.label}
                        </div>
                      </div>

                      {/* 描述 */}
                      <div className="pt-3 border-t border-[#f0f0f0]">
                        <p className="text-sm text-[#8c8c8c]">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          </div> {/* 结束 lg:col-span-2 div */}
        </div> {/* 结束 grid div */}
      </main>
    </div>
    </AdminLayoutWrapper>
  );
}
