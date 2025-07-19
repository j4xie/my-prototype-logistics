'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableColumn } from '@/components/ui/table';
import { RefreshCw, Eye } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { OperationLog } from '@/mocks/data/platform-data';

/**
 * 操作日志组件
 * 显示平台管理操作记录，支持分页和刷新
 */
export default function OperationLogTable() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 20;

  // 获取操作日志
  const fetchLogs = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await platformApi.logs.getLogs({
        page,
        size: pageSize
      });

      setLogs(response.data.logs || []);
      setTotal(response.data.pagination.total);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
    } catch (err) {
      console.error('获取操作日志失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage]);

  // 格式化时间
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 获取操作类型显示
  const getActionDisplay = (action: string) => {
    const actionMap: Record<string, { text: string; color: string }> = {
      'CREATE_FACTORY': { text: '创建工厂', color: 'text-green-600' },
      'UPDATE_FACTORY': { text: '更新工厂', color: 'text-blue-600' },
      'SUSPEND_FACTORY': { text: '暂停工厂', color: 'text-red-600' },
      'ACTIVATE_FACTORY': { text: '激活工厂', color: 'text-green-600' },
      'DELETE_FACTORY': { text: '删除工厂', color: 'text-red-600' },
      'CREATE_USER': { text: '创建用户', color: 'text-green-600' },
      'UPDATE_USER': { text: '更新用户', color: 'text-blue-600' },
      'DELETE_USER': { text: '删除用户', color: 'text-red-600' },
      'LOGIN': { text: '登录', color: 'text-gray-600' },
      'LOGOUT': { text: '登出', color: 'text-gray-600' },
      'SIMULATE_LOGIN': { text: '模拟登录', color: 'text-purple-600' },
      'UPDATE_PLAN': { text: '更新套餐', color: 'text-blue-600' },
      'CREATE_PLAN': { text: '创建套餐', color: 'text-green-600' }
    };

    const config = actionMap[action] || { text: action, color: 'text-gray-600' };

    return (
      <span className={`font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // 获取目标类型显示
  const getTargetTypeDisplay = (targetType: string) => {
    const typeMap: Record<string, string> = {
      'factory': '工厂',
      'user': '用户',
      'plan': '套餐',
      'system': '系统'
    };

    return typeMap[targetType] || targetType;
  };

  // 表格列定义
  const columns: TableColumn<OperationLog>[] = [
    {
      key: 'created_at',
      title: '操作时间',
      width: '160px',
      sortable: true,
      render: (value) => formatDateTime(value)
    },
    {
      key: 'operator_name',
      title: '操作人',
      width: '120px',
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'action',
      title: '操作类型',
      width: '120px',
      render: (value) => getActionDisplay(value)
    },
    {
      key: 'target_type',
      title: '目标类型',
      width: '100px',
      align: 'center',
      render: (value) => getTargetTypeDisplay(value)
    },
    {
      key: 'target_name',
      title: '目标对象',
      width: '150px',
      render: (value) => <span className="text-gray-700">{value}</span>
    },
    {
      key: 'description',
      title: '操作描述',
      width: '300px',
      render: (value) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'ip_address',
      title: 'IP地址',
      width: '120px',
      align: 'center',
      render: (value) => (
        <span className="text-xs text-gray-500 font-mono">{value}</span>
      )
    },
    {
      key: 'actions',
      title: '操作',
      width: '80px',
      align: 'center',
      render: (_, record) => (
        <Button
          variant="ghost"
          size="small"
          className="h-8 w-8 p-0"
          title="查看详情"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">操作日志</CardTitle>

          <Button
            variant="secondary"
            onClick={() => fetchLogs(currentPage)}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          共 {total} 条日志记录
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          // 错误状态
          <div className="text-center py-8">
            <p className="text-red-600">⚠️ {error}</p>
            <Button
              variant="secondary"
              onClick={() => fetchLogs(currentPage)}
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
              data={logs}
              loading={isLoading}
              emptyText="暂无操作日志"
              hoverable={true}
              striped={true}
              responsive={true}
              size="sm"
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
