'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableColumn } from '@/components/ui/table';
import { RefreshCw, Eye, Search, Filter, Download, Calendar } from 'lucide-react';
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
  
  // 筛选和搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    actorType: '',
    factoryId: '',
    result: ''
  });

  const pageSize = 20;

  // 获取操作日志
  const fetchLogs = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      // 构建查询参数
      const params: any = {
        page,
        size: pageSize
      };

      // 添加搜索关键词
      if (searchKeyword.trim()) {
        params.search = searchKeyword.trim();
      }

      // 添加筛选条件
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.action) params.action = filters.action;
      if (filters.actorType) params.actorType = filters.actorType;
      if (filters.factoryId) params.factoryId = filters.factoryId;
      if (filters.result) params.result = filters.result;

      const response = await platformApi.logs.getLogs(params);

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
  }, [currentPage, searchKeyword, filters]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理筛选条件变更
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // 重置到第一页
  };

  // 清除筛选条件
  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      action: '',
      actorType: '',
      factoryId: '',
      result: ''
    });
    setSearchKeyword('');
    setCurrentPage(1);
  };

  // 导出日志
  const handleExportLogs = async () => {
    try {
      const params: any = {};
      
      // 添加当前的筛选条件
      if (searchKeyword.trim()) params.search = searchKeyword.trim();
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.action) params.action = filters.action;
      if (filters.actorType) params.actorType = filters.actorType;
      if (filters.factoryId) params.factoryId = filters.factoryId;
      if (filters.result) params.result = filters.result;

      // 构建导出URL
      const queryString = new URLSearchParams(params).toString();
      const exportUrl = `/api/platform/export/logs${queryString ? `?${queryString}` : ''}`;
      
      window.open(exportUrl, '_blank');
    } catch (err) {
      console.error('导出日志失败:', err);
      alert('导出失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-xl font-semibold">操作日志</CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              筛选
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleExportLogs}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </Button>

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
        </div>

        {/* 搜索框 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="搜索操作人、操作类型、目标对象..."
            value={searchKeyword}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 高级筛选器 */}
        {showFilters && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">开始时间</label>
                <Input
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">结束时间</label>
                <Input
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">操作类型</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全部</option>
                  <option value="CREATE_FACTORY">创建工厂</option>
                  <option value="UPDATE_FACTORY">更新工厂</option>
                  <option value="SUSPEND_FACTORY">暂停工厂</option>
                  <option value="ACTIVATE_FACTORY">激活工厂</option>
                  <option value="DELETE_FACTORY">删除工厂</option>
                  <option value="LOGIN">登录</option>
                  <option value="LOGOUT">登出</option>
                  <option value="SIMULATE_LOGIN">模拟登录</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">操作者类型</label>
                <select
                  value={filters.actorType}
                  onChange={(e) => handleFilterChange('actorType', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全部</option>
                  <option value="platform_admin">平台管理员</option>
                  <option value="factory_admin">工厂管理员</option>
                  <option value="factory_user">工厂用户</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">操作结果</label>
                <select
                  value={filters.result}
                  onChange={(e) => handleFilterChange('result', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全部</option>
                  <option value="success">成功</option>
                  <option value="failed">失败</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={clearFilters}
                  className="w-full"
                >
                  清除筛选
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          共 {total} 条日志记录
          {(searchKeyword || Object.values(filters).some(v => v)) && (
            <span className="ml-2 text-blue-600">（已筛选）</span>
          )}
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
