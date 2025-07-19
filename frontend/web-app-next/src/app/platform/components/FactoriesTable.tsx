'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import { Search, Eye, Power, PowerOff, LogIn } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { Factory, FactoryStatus } from '@/mocks/data/platform-data';

/**
 * 工厂列表表格组件
 * 支持搜索、分页、状态切换和模拟登录等操作
 */
export default function FactoriesTable() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 10;

  // 获取工厂列表
  const fetchFactories = async (keyword = '', page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await platformApi.factory.getFactories({
        keyword,
        page,
        size: pageSize
      });

      setFactories(response.data.factories || []);
      setTotal(response.data.pagination.total);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
    } catch (err) {
      console.error('获取工厂列表失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFactories(searchKeyword, currentPage);
  }, [searchKeyword, currentPage]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理状态切换
  const handleStatusToggle = async (factoryId: string, currentStatus: FactoryStatus) => {
    try {
      const newStatus: FactoryStatus = currentStatus === 'active' ? 'suspended' : 'active';

      await platformApi.factory.updateFactoryStatus(factoryId, {
        status: newStatus,
        reason: newStatus === 'suspended' ? '管理员手动暂停' : '管理员手动激活'
      });

      // 刷新列表
      await fetchFactories(searchKeyword, currentPage);
    } catch (err) {
      console.error('更新工厂状态失败:', err);
      alert('操作失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 处理模拟登录
  const handleSimulateLogin = async (factoryId: string, factoryName: string) => {
    if (!confirm(`确定要模拟登录到工厂 "${factoryName}" 吗？`)) {
      return;
    }

    try {
      const response = await platformApi.factory.simulateLogin(factoryId);
      alert(`模拟登录成功！令牌: ${response.data.token.substring(0, 20)}...`);
      // 这里可以实际跳转到工厂管理界面
      // window.location.href = response.data.redirect_url;
    } catch (err) {
      console.error('模拟登录失败:', err);
      alert('模拟登录失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 获取状态显示
  const getStatusBadge = (status: FactoryStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">运行中</Badge>;
      case 'suspended':
        return <Badge variant="error">已暂停</Badge>;
      case 'pending':
        return <Badge variant="warning">待审核</Badge>;
      case 'deleted':
        return <Badge variant="default">已删除</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 表格列定义
  const columns: TableColumn<Factory>[] = [
    {
      key: 'name',
      title: '工厂名称',
      width: '200px',
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'industry',
      title: '行业',
      width: '120px',
      sortable: true
    },
    {
      key: 'employee_count',
      title: '员工数',
      width: '100px',
      sortable: true,
      align: 'center'
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      align: 'center',
      render: (value) => getStatusBadge(value as FactoryStatus)
    },
    {
      key: 'owner_name',
      title: '负责人',
      width: '150px',
      render: (value, record) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">{record.owner_email}</div>
        </div>
      )
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: '120px',
      sortable: true,
      render: (value) => formatDate(value)
    },
    {
      key: 'actions',
      title: '操作',
      width: '120px',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center items-center gap-1">
          {/* 查看详情 */}
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            title="查看详情"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* 状态切换 */}
          {(record.status === 'active' || record.status === 'suspended') && (
            <Button
              variant="ghost"
              size="small"
              className="h-8 w-8 p-0"
              onClick={() => handleStatusToggle(record.id, record.status)}
              title={record.status === 'active' ? '暂停工厂' : '激活工厂'}
            >
              {record.status === 'active' ? (
                <PowerOff className="h-4 w-4 text-red-600" />
              ) : (
                <Power className="h-4 w-4 text-green-600" />
              )}
            </Button>
          )}

          {/* 模拟登录 */}
          {record.status === 'active' && (
            <Button
              variant="ghost"
              size="small"
              className="h-8 w-8 p-0"
              onClick={() => handleSimulateLogin(record.id, record.name)}
              title="模拟登录"
            >
              <LogIn className="h-4 w-4 text-blue-600" />
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-xl font-semibold">工厂管理</CardTitle>

          {/* 搜索框 */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索工厂名称、行业或负责人..."
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 统计信息 */}
        <div className="text-sm text-gray-600">
          共找到 {total} 个工厂
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          // 错误状态
          <div className="text-center py-8">
            <p className="text-red-600">⚠️ {error}</p>
            <Button
              variant="secondary"
              onClick={() => fetchFactories(searchKeyword, currentPage)}
              className="mt-4"
            >
              重试
            </Button>
          </div>
        ) : (
          // 表格内容
          <div className="space-y-4">
            {/* 使用现有的Table组件 */}
            <Table
              columns={columns}
              data={factories}
              loading={isLoading}
              emptyText="暂无工厂数据"
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
  );
}
