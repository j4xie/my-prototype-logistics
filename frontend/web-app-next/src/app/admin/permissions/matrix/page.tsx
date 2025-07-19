'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminLayoutWrapper } from '@/components/admin';

interface Role {
  id: string;
  name: string;
  level: string;
  status: 'active' | 'inactive';
}

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
}

interface RolePermissionMatrix {
  [roleId: string]: {
    [permissionId: string]: boolean;
  };
}

export default function PermissionMatrixPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<RolePermissionMatrix>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockRoles: Role[] = [
        { id: 'R001', name: '超级管理员', level: 'admin', status: 'active' },
        { id: 'R002', name: '权限管理员', level: 'manager', status: 'active' },
        { id: 'R003', name: '业务经理', level: 'manager', status: 'active' },
        { id: 'R004', name: '操作员', level: 'operator', status: 'active' },
        { id: 'R005', name: '访客', level: 'viewer', status: 'inactive' }
      ];

      const mockPermissions: Permission[] = [
        { id: 'P001', name: '用户管理', code: 'user_manage', module: '系统管理' },
        { id: 'P002', name: '角色管理', code: 'role_manage', module: '系统管理' },
        { id: 'P003', name: '系统配置', code: 'system_config', module: '系统管理' },
        { id: 'P004', name: '数据导出', code: 'data_export', module: '系统管理' },
        { id: 'P005', name: '产品管理', code: 'product_manage', module: '业务模块' },
        { id: 'P006', name: '订单管理', code: 'order_manage', module: '业务模块' },
        { id: 'P007', name: '客户管理', code: 'customer_manage', module: '业务模块' },
        { id: 'P008', name: '报表查看', code: 'report_view', module: '数据分析' },
        { id: 'P009', name: '数据分析', code: 'data_analysis', module: '数据分析' },
        { id: 'P010', name: '基础查看', code: 'basic_view', module: '基础权限' }
      ];

      const mockMatrix: RolePermissionMatrix = {
        'R001': { // 超级管理员
          'P001': true, 'P002': true, 'P003': true, 'P004': true, 'P005': true,
          'P006': true, 'P007': true, 'P008': true, 'P009': true, 'P010': true
        },
        'R002': { // 权限管理员
          'P001': true, 'P002': true, 'P003': false, 'P004': true, 'P005': false,
          'P006': false, 'P007': false, 'P008': true, 'P009': false, 'P010': true
        },
        'R003': { // 业务经理
          'P001': false, 'P002': false, 'P003': false, 'P004': false, 'P005': true,
          'P006': true, 'P007': true, 'P008': true, 'P009': true, 'P010': true
        },
        'R004': { // 操作员
          'P001': false, 'P002': false, 'P003': false, 'P004': false, 'P005': true,
          'P006': true, 'P007': false, 'P008': false, 'P009': false, 'P010': true
        },
        'R005': { // 访客
          'P001': false, 'P002': false, 'P003': false, 'P004': false, 'P005': false,
          'P006': false, 'P007': false, 'P008': false, 'P009': false, 'P010': true
        }
      };

      setRoles(mockRoles);
      setPermissions(mockPermissions);
      setMatrix(mockMatrix);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'operator':
        return 'bg-green-100 text-green-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case '系统管理':
        return 'bg-red-50 text-red-700';
      case '业务模块':
        return 'bg-blue-50 text-blue-700';
      case '数据分析':
        return 'bg-green-50 text-green-700';
      case '基础权限':
        return 'bg-gray-50 text-gray-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const togglePermission = (roleId: string, permissionId: string) => {
    if (!editMode) return;
    
    setMatrix(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionId]: !prev[roleId]?.[permissionId]
      }
    }));
  };

  const saveChanges = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('权限矩阵保存成功！');
      setEditMode(false);
    } catch (error) {
      alert('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayoutWrapper requireDesktop={true} requiredLevel={5}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-table fa-spin text-purple-600 text-3xl mb-4"></i>
            <p className="text-gray-600">
              {authLoading ? '验证用户身份...' : '加载权限矩阵...'}
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
                <h1 className="text-2xl font-semibold text-gray-900">权限矩阵</h1>
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
                        <button onClick={() => router.push('/admin/permissions')} className="text-sm text-gray-500 hover:text-gray-700">
                          权限管理
                        </button>
                      </div>
                    </li>
                    <li>
                      <div className="flex items-center">
                        <i className="fas fa-chevron-right text-gray-400 text-xs mx-2"></i>
                        <span className="text-sm font-medium text-gray-700">权限矩阵</span>
                      </div>
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {!editMode ? (
                <Button
                  onClick={() => setEditMode(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                >
                  <i className="fas fa-edit mr-2"></i>
                  编辑权限
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setEditMode(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={saveChanges}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                    disabled={isLoading}
                  >
                    <i className="fas fa-save mr-2"></i>
                    {isLoading ? '保存中...' : '保存更改'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {editMode && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle text-amber-600 mr-3"></i>
                <div>
                  <h3 className="font-medium text-amber-800">编辑模式</h3>
                  <p className="text-sm text-amber-700">您正在编辑权限矩阵。点击表格中的权限项可以开启/关闭权限。</p>
                </div>
              </div>
            </div>
          )}

          {/* 权限矩阵表格 */}
          <Card className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <i className="fas fa-table text-purple-600 mr-3"></i>
                角色权限矩阵
              </h3>
              <p className="text-sm text-gray-600 mt-1">查看和管理各角色的权限分配情况</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="sticky left-0 bg-gray-50 px-6 py-4 text-left text-sm font-medium text-gray-900 min-w-[200px]">
                      权限 / 角色
                    </th>
                    {roles.map((role) => (
                      <th key={role.id} className="px-4 py-4 text-center text-sm font-medium text-gray-900 min-w-[120px]">
                        <div className="space-y-2">
                          <div className="font-medium">{role.name}</div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelColor(role.level)}`}>
                            {role.level === 'admin' ? '管理员' : 
                             role.level === 'manager' ? '经理' :
                             role.level === 'operator' ? '操作员' : '查看员'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {permissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 bg-white px-6 py-4 border-r border-gray-200">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{permission.name}</div>
                          <div className="text-sm text-gray-500">{permission.code}</div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getModuleColor(permission.module)}`}>
                            {permission.module}
                          </span>
                        </div>
                      </td>
                      {roles.map((role) => (
                        <td key={`${role.id}-${permission.id}`} className="px-4 py-4 text-center">
                          <button
                            onClick={() => togglePermission(role.id, permission.id)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              matrix[role.id]?.[permission.id]
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            } ${editMode ? 'cursor-pointer' : 'cursor-default'}`}
                            disabled={!editMode}
                          >
                            <i className={`fas ${
                              matrix[role.id]?.[permission.id] ? 'fa-check' : 'fa-times'
                            } text-sm`}></i>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 图例 */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-3">图例说明</h4>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-2">
                    <i className="fas fa-check text-xs"></i>
                  </div>
                  <span className="text-gray-700">拥有权限</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mr-2">
                    <i className="fas fa-times text-xs"></i>
                  </div>
                  <span className="text-gray-700">无权限</span>
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </AdminLayoutWrapper>
  );
} 