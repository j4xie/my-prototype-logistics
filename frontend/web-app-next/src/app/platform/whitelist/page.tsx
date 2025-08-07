'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import { 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Power, 
  PowerOff, 
  Clock,
  Building2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { Whitelist, WhitelistStatus, Factory } from '@/mocks/data/platform-data';
import { useStatusActions, useErrorHandler } from '@/hooks';

export default function WhitelistPage() {
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<WhitelistStatus | 'all'>('all');
  const [factoryFilter, setFactoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // 使用新的通用Hooks
  const { handleStatusToggle, handleDelete, handleBatchDelete, isLoading: statusLoading } = useStatusActions();
  const { handleAsyncError } = useErrorHandler();
  
  // 弹窗状态
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEntry, setNewEntry] = useState({
    factoryId: '',
    identifier: '',
    identifierType: 'phone' as 'phone' | 'email' | 'id_card',
    name: '',
    department: '',
    position: '',
    validDays: 30
  });

  const pageSize = 20;

  // 获取工厂列表
  const fetchFactories = async () => {
    try {
      const response = await platformApi.factory.getFactories({ size: 100 });
      setFactories(response.data.factories || []);
    } catch (err) {
      console.error('获取工厂列表失败:', err);
    }
  };

  // 获取白名单列表
  const fetchWhitelists = async (keyword = '', status: WhitelistStatus | 'all' = 'all', factoryId = 'all', page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const params: any = {
        keyword,
        page,
        size: pageSize
      };

      if (status !== 'all') params.status = status;
      if (factoryId !== 'all') params.factoryId = factoryId;

      const response = await platformApi.whitelist.getWhitelists(params);

      setWhitelists(response.data.whitelists || []);
      setTotal(response.data.pagination.total);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
    } catch (err) {
      console.error('获取白名单列表失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFactories();
  }, []);

  useEffect(() => {
    fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage);
  }, [searchKeyword, statusFilter, factoryFilter, currentPage]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  // 处理状态筛选
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value as WhitelistStatus | 'all');
    setCurrentPage(1);
  };

  // 处理工厂筛选
  const handleFactoryFilter = (value: string) => {
    setFactoryFilter(value);
    setCurrentPage(1);
  };

  // 处理状态切换 - 使用新的通用Hook
  const onWhitelistStatusToggle = (whitelistId: string, currentStatus: WhitelistStatus) => {
    const apiCall = currentStatus === 'active' 
      ? platformApi.whitelist.suspendWhitelist 
      : platformApi.whitelist.activateWhitelist;
    
    handleStatusToggle(
      whitelistId,
      currentStatus,
      {
        itemType: '白名单记录',
        confirmMessages: {
          suspend: '确定要暂停该白名单记录吗？暂停后该记录将无法用于访问。',
          activate: '确定要激活该白名单记录吗？激活后该记录将恢复访问权限。'
        }
      },
      apiCall,
      () => fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage)
    );
  };

  // 处理删除单个记录 - 使用新的通用Hook
  const onWhitelistDelete = (whitelistId: string, identifier: string) => {
    handleDelete(
      whitelistId,
      identifier,
      {
        itemType: '白名单记录',
        confirmMessages: {
          delete: `确定要删除白名单记录"${identifier}"吗？此操作不可恢复！`
        }
      },
      platformApi.whitelist.deleteWhitelist,
      () => fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage)
    );
  };

  // 处理批量删除 - 使用新的通用Hook
  const onBatchDelete = () => {
    handleBatchDelete(
      selectedItems,
      {
        itemType: '白名单记录'
      },
      platformApi.whitelist.batchDelete,
      () => {
        setSelectedItems([]);
        fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage);
      }
    );
  };

  // 处理清理过期记录
  const handleCleanupExpired = async () => {
    try {
      const response = await platformApi.whitelist.cleanupExpired();
      alert(`成功清理了${response.data.deleted_count}条过期记录`);
      setShowCleanupModal(false);
      await fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage);
    } catch (err) {
      console.error('清理过期记录失败:', err);
      alert('清理失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 处理单个添加
  const handleAddSingle = async () => {
    if (!newEntry.factoryId || !newEntry.identifier) {
      alert('请选择工厂并输入标识符');
      return;
    }

    // 验证标识符格式
    if (newEntry.identifierType === 'phone' && !/^1[3-9]\d{9}$/.test(newEntry.identifier)) {
      alert('请输入有效的手机号');
      return;
    }
    if (newEntry.identifierType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEntry.identifier)) {
      alert('请输入有效的邮箱地址');
      return;
    }

    setIsSubmitting(true);
    try {
      // 使用批量导入接口添加单个记录
      const response = await platformApi.whitelist.batchImport({
        factory_id: newEntry.factoryId,
        whitelists: [{
          identifier: newEntry.identifier,
          identifier_type: newEntry.identifierType,
          name: newEntry.name,
          department: newEntry.department,
          position: newEntry.position
        }]
      });

      alert(`添加成功！\n成功: ${response.data.success_count}条\n失败: ${response.data.failed_count}条`);
      
      // 关闭弹窗并重置表单
      setShowAddModal(false);
      setNewEntry({
        factoryId: '',
        identifier: '',
        identifierType: 'phone',
        name: '',
        department: '',
        position: '',
        validDays: 30
      });
      
      // 刷新列表
      await fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage);
    } catch (err) {
      console.error('添加白名单失败:', err);
      alert('添加失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理批量导入
  const handleBatchImport = async () => {
    if (!selectedFactoryId || !uploadFile) {
      alert('请选择工厂并上传文件');
      return;
    }

    setIsSubmitting(true);
    try {
      // 读取文件内容
      const text = await uploadFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const whitelists = [];

      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          whitelists.push({
            identifier: parts[0],
            identifier_type: parts[1] as 'phone' | 'email' | 'id_card',
            name: parts[2] || '',
            department: parts[3] || '',
            position: parts[4] || ''
          });
        }
      }

      if (whitelists.length === 0) {
        alert('文件中没有有效的数据');
        return;
      }

      const response = await platformApi.whitelist.batchImport({
        factory_id: selectedFactoryId,
        whitelists
      });

      alert(`批量导入完成！\n成功: ${response.data.success_count}条\n失败: ${response.data.failed_count}条`);
      
      // 刷新列表
      await fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage);
      
      // 关闭弹窗
      setShowBatchImportModal(false);
      setSelectedFactoryId('');
      setUploadFile(null);
    } catch (err) {
      console.error('批量导入失败:', err);
      alert('批量导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 获取状态显示
  const getStatusBadge = (status: WhitelistStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">有效</Badge>;
      case 'expired':
        return <Badge variant="error">已过期</Badge>;
      case 'suspended':
        return <Badge variant="warning">已暂停</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // 格式化日期
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 表格列定义
  const columns: TableColumn<Whitelist>[] = [
    {
      key: 'select',
      title: '选择',
      width: '50px',
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedItems.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedItems([...selectedItems, record.id]);
            } else {
              setSelectedItems(selectedItems.filter(id => id !== record.id));
            }
          }}
        />
      )
    },
    {
      key: 'identifier',
      title: '标识符',
      width: '150px',
      sortable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">
            {record.identifier_type === 'phone' ? '手机号' : 
             record.identifier_type === 'email' ? '邮箱' : '身份证'}
          </div>
        </div>
      )
    },
    {
      key: 'name',
      title: '姓名',
      width: '100px',
      render: (value) => value || '-'
    },
    {
      key: 'factory_name',
      title: '所属工厂',
      width: '150px',
      sortable: true
    },
    {
      key: 'department',
      title: '部门',
      width: '100px',
      render: (value) => value || '-'
    },
    {
      key: 'position',
      title: '职位',
      width: '100px',
      render: (value) => value || '-'
    },
    {
      key: 'status',
      title: '状态',
      width: '80px',
      align: 'center',
      render: (value) => getStatusBadge(value as WhitelistStatus)
    },
    {
      key: 'expires_at',
      title: '过期时间',
      width: '130px',
      render: (value) => formatDate(value)
    },
    {
      key: 'created_by_name',
      title: '创建者',
      width: '100px'
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: '130px',
      render: (value) => formatDate(value)
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center items-center gap-1">
          {/* 状态切换 */}
          {(record.status === 'active' || record.status === 'suspended') && (
            <Button
              variant="ghost"
              size="small"
              className="h-8 w-8 p-0"
              onClick={() => onWhitelistStatusToggle(record.id, record.status)}
              title={record.status === 'active' ? '暂停' : '激活'}
            >
              {record.status === 'active' ? (
                <PowerOff className="h-4 w-4 text-red-600" />
              ) : (
                <Power className="h-4 w-4 text-green-600" />
              )}
            </Button>
          )}

          {/* 删除 */}
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            onClick={() => onWhitelistDelete(record.id, record.identifier)}
            title="删除"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">白名单管理</h1>
          <p className="text-gray-600 mt-1">管理平台所有工厂的访问白名单</p>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加白名单
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage)}
            className="flex items-center gap-2"
            title="刷新白名单数据"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setShowCleanupModal(true)}
            className="flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            清理过期
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => setShowBatchImportModal(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </Button>
        </div>
      </div>

      {/* 白名单列表 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <CardTitle className="text-xl font-semibold">白名单列表</CardTitle>

            {/* 筛选和搜索 */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              {/* 工厂筛选 */}
              <Select 
                value={factoryFilter} 
                onChange={handleFactoryFilter}
                placeholder="选择工厂"
                className="w-full sm:w-48"
                options={[
                  { value: 'all', label: '全部工厂' },
                  ...factories.map(factory => ({
                    value: factory.id,
                    label: factory.name
                  }))
                ]}
              />

              {/* 状态筛选 */}
              <Select 
                value={statusFilter as string} 
                onChange={handleStatusFilter}
                placeholder="状态"
                className="w-full sm:w-32"
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'active', label: '有效' },
                  { value: 'expired', label: '已过期' },
                  { value: 'suspended', label: '已暂停' }
                ]}
              />

              {/* 搜索框 */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索标识符、姓名或部门..."
                  value={searchKeyword}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* 统计信息和批量操作 */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              共找到 {total} 条记录
              {selectedItems.length > 0 && (
                <span className="ml-4 text-blue-600">
                  已选择 {selectedItems.length} 条
                </span>
              )}
            </div>
            
            {selectedItems.length > 0 && (
              <Button
                variant="secondary"
                size="small"
                onClick={onBatchDelete}
                className="flex items-center gap-2 text-red-600"
              >
                <Trash2 className="w-4 h-4" />
                批量删除
              </Button>
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
                onClick={() => fetchWhitelists(searchKeyword, statusFilter, factoryFilter, currentPage)}
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
                data={whitelists}
                loading={isLoading}
                emptyText="暂无白名单数据"
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

      {/* 批量导入弹窗 */}
      {showBatchImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">批量导入白名单</h2>
              <Button
                variant="ghost"
                onClick={() => setShowBatchImportModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择工厂</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                >
                  <option value="">请选择工厂</option>
                  {factories.map(factory => (
                    <option key={factory.id} value={factory.id}>{factory.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择文件</label>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持Excel(.xlsx, .xls)和CSV文件，格式：标识符,类型(phone/email/id_card),姓名,部门,职位
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">文件格式示例：</h4>
                <div className="text-xs text-gray-600 font-mono">
                  <p>13812345678,phone,张三,技术部,工程师</p>
                  <p>user@example.com,email,李四,销售部,经理</p>
                  <p>110101199001011234,id_card,王五,行政部,助理</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => {
                setShowBatchImportModal(false);
                setSelectedFactoryId('');
                setUploadFile(null);
              }}>
                取消
              </Button>
              <Button 
                onClick={handleBatchImport}
                disabled={!selectedFactoryId || !uploadFile || isSubmitting}
              >
                {isSubmitting ? '导入中...' : '开始导入'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 单个添加弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">添加白名单记录</h2>
              <Button
                variant="ghost"
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择工厂 *</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newEntry.factoryId}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, factoryId: e.target.value }))}
                >
                  <option value="">请选择工厂</option>
                  {factories.map(factory => (
                    <option key={factory.id} value={factory.id}>{factory.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">标识符类型 *</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newEntry.identifierType}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, identifierType: e.target.value as 'phone' | 'email' | 'id_card' }))}
                >
                  <option value="phone">手机号</option>
                  <option value="email">邮箱</option>
                  <option value="id_card">身份证</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {newEntry.identifierType === 'phone' ? '手机号' : 
                   newEntry.identifierType === 'email' ? '邮箱地址' : '身份证号'} *
                </label>
                <Input
                  value={newEntry.identifier}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, identifier: e.target.value }))}
                  placeholder={
                    newEntry.identifierType === 'phone' ? '请输入11位手机号' : 
                    newEntry.identifierType === 'email' ? '请输入邮箱地址' : '请输入身份证号'
                  }
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                <Input
                  value={newEntry.name}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入姓名（可选）"
                  className="w-full"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
                  <Input
                    value={newEntry.department}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="请输入部门（可选）"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">职位</label>
                  <Input
                    value={newEntry.position}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="请输入职位（可选）"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                取消
              </Button>
              <Button 
                onClick={handleAddSingle}
                disabled={!newEntry.factoryId || !newEntry.identifier || isSubmitting}
              >
                {isSubmitting ? '添加中...' : '确认添加'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 清理过期记录弹窗 */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">清理过期记录</h2>
              <Button
                variant="ghost"
                onClick={() => setShowCleanupModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            
            <div className="text-center py-4">
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-800 mb-2">确定要清理所有过期的白名单记录吗？</p>
              <p className="text-sm text-gray-500">此操作将永久删除过期记录，无法恢复</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCleanupModal(false)}>
                取消
              </Button>
              <Button onClick={handleCleanupExpired} className="bg-red-600 hover:bg-red-700">
                确认清理
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}