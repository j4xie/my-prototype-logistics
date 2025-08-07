'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import { Search, UserX, Power, PowerOff, X, Shield, Users, UserPlus } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { Factory, Employee, EmployeeStatus, Whitelist, WhitelistStatus } from '@/mocks/data/platform-data';
import { useStatusActions, useErrorHandler } from '@/hooks';
import AddEmployeeModal from './AddEmployeeModal';

interface EmployeeManagementModalProps {
  factory: Factory;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmployeeManagementModal({ factory, isOpen, onClose }: EmployeeManagementModalProps) {
  const [activeTab, setActiveTab] = useState('employees');

  // Employee states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Whitelist states
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  const [whitelistSearch, setWhitelistSearch] = useState('');
  const [whitelistPage, setWhitelistPage] = useState(1);
  const [whitelistTotal, setWhitelistTotal] = useState(0);
  const [whitelistTotalPages, setWhitelistTotalPages] = useState(1);

  // 添加员工/白名单相关状态
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);

  const pageSize = 10;

  // 获取员工列表
  const fetchEmployees = async (keyword = '', page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await platformApi.employee.getEmployees(factory.id, {
        keyword,
        page,
        size: pageSize
      });

      setEmployees(response.data.employees || []);
      setTotal(response.data.pagination.total);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
    } catch (err) {
      console.error('获取员工列表失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取白名单列表
  const fetchWhitelists = async (keyword = '', page = 1) => {
    try {
      setWhitelistLoading(true);
      setWhitelistError(null);

      const response = await platformApi.whitelist.getWhitelists({
        factoryId: factory.id,
        keyword,
        page,
        size: pageSize
      });

      setWhitelists(response.data.whitelists || []);
      setWhitelistTotal(response.data.pagination.total);
      setWhitelistTotalPages(response.data.pagination.pages);
      setWhitelistPage(response.data.pagination.page);
    } catch (err) {
      console.error('获取白名单列表失败:', err);
      setWhitelistError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setWhitelistLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'employees') {
        fetchEmployees(searchKeyword, currentPage);
      } else if (activeTab === 'whitelist') {
        fetchWhitelists(whitelistSearch, whitelistPage);
      }
    }
  }, [isOpen, activeTab, searchKeyword, currentPage, whitelistSearch, whitelistPage, factory.id]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  // 使用新的通用Hooks
  const { handleStatusToggle, handleDelete, isLoading: statusLoading } = useStatusActions();
  const { handleAsyncError } = useErrorHandler();

  // 处理员工状态切换 - 使用新的通用Hook
  const onEmployeeStatusToggle = (employeeId: string, currentStatus: EmployeeStatus) => {
    const apiCall = currentStatus === 'active'
      ? platformApi.employee.suspendEmployee
      : platformApi.employee.activateEmployee;

    handleStatusToggle(
      employeeId,
      currentStatus,
      {
        itemType: '员工',
        confirmMessages: {
          suspend: '确定要暂停该员工吗？暂停后该员工将无法登录。',
          activate: '确定要激活该员工吗？激活后该员工将恢复登录权限。'
        }
      },
      apiCall,
      () => fetchEmployees(searchKeyword, currentPage),
      factory.id
    );
  };

  // 处理删除员工 - 使用新的通用Hook
  const onEmployeeDelete = (employeeId: string, employeeName: string) => {
    handleDelete(
      employeeId,
      employeeName,
      {
        itemType: '员工',
        confirmMessages: {
          delete: `确定要删除员工"${employeeName}"吗？此操作不可恢复！`
        }
      },
      (id: string) => platformApi.employee.deleteEmployee(factory.id, id),
      () => fetchEmployees(searchKeyword, currentPage)
    );
  };

  // 获取状态显示
  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">正常</Badge>;
      case 'suspended':
        return <Badge variant="error">暂停</Badge>;
      case 'inactive':
        return <Badge variant="warning">未激活</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // 格式化日期
  const formatDate = (dateString?: string) => {
    if (!dateString) return '从未登录';
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 表格列定义
  const columns: TableColumn<Employee>[] = [
    {
      key: 'username',
      title: '用户名',
      width: '150px',
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'email',
      title: '邮箱',
      width: '200px',
      sortable: true
    },
    {
      key: 'department',
      title: '部门',
      width: '120px',
      render: (value) => value || '未设置'
    },
    {
      key: 'position',
      title: '职位',
      width: '120px',
      render: (value) => value || '未设置'
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      align: 'center',
      render: (value) => getStatusBadge(value as EmployeeStatus)
    },
    {
      key: 'last_login',
      title: '最后登录',
      width: '150px',
      render: (value) => formatDate(value)
    },
    {
      key: 'actions',
      title: '操作',
      width: '120px',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center items-center gap-1">
          {/* 状态切换 */}
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            onClick={() => onEmployeeStatusToggle(record.id, record.status)}
            title={record.status === 'active' ? '暂停员工' : '激活员工'}
          >
            {record.status === 'active' ? (
              <PowerOff className="h-4 w-4 text-red-600" />
            ) : (
              <Power className="h-4 w-4 text-green-600" />
            )}
          </Button>

          {/* 删除员工 */}
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            onClick={() => onEmployeeDelete(record.id, record.username)}
            title="删除员工"
          >
            <UserX className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">员工管理 & 白名单</h2>
            <p className="text-sm text-gray-600 mt-1">{factory.name}</p>
            <p className="text-xs text-blue-600 mt-1">💡 白名单管理功能已集成到员工管理中</p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-lg font-semibold">员工列表</CardTitle>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* 添加员工按钮 */}
                  <Button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4" />
                    添加员工
                  </Button>

                  {/* 搜索框 */}
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="搜索员工姓名、邮箱或部门..."
                      value={searchKeyword}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="text-sm text-gray-600">
                共找到 {total} 名员工
              </div>
            </CardHeader>

            <CardContent>
              {error ? (
                // 错误状态
                <div className="text-center py-8">
                  <p className="text-red-600">⚠️ {error}</p>
                  <Button
                    variant="secondary"
                    onClick={() => fetchEmployees(searchKeyword, currentPage)}
                    className="mt-4"
                  >
                    重试
                  </Button>
                </div>
              ) : (
                // 表格内容
                <div className="space-y-4">
                  <Table
                    columns={columns}
                    data={employees}
                    loading={isLoading}
                    emptyText="暂无员工数据"
                    hoverable={true}
                    striped={true}
                    responsive={true}
                    size="md"
                  />

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        第 {currentPage} 页，共 {totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 p-6 border-t bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>

      {/* 添加员工模态框 */}
      <AddEmployeeModal
        factory={factory}
        isOpen={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        onSuccess={() => {
          fetchEmployees(searchKeyword, currentPage);
          setShowAddEmployeeModal(false);
        }}
      />
    </div>
  );
}
