'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import { Search, Eye, Power, PowerOff, Users, Plus, Trash2 } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { Factory, FactoryStatus } from '@/mocks/data/platform-data';
import EmployeeManagementModal from './EmployeeManagementModal';
import { useStatusActions, useErrorHandler } from '@/hooks';
import RegionSelector from '@/components/ui/region-selector-v2';
import IndustrySelector from '@/components/ui/industry-selector-v2';

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

  // 使用新的通用Hooks
  const { handleStatusToggle, isLoading: statusLoading } = useStatusActions();
  const { handleAsyncError } = useErrorHandler();

  // 新增状态管理
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Factory>>({});
  const [createFormData, setCreateFormData] = useState({
    name: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    province: '',
    city: '',
    district: '',
    detailAddress: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

  // 处理状态切换 - 使用新的通用Hook
  const onFactoryStatusToggle = (factoryId: string, currentStatus: FactoryStatus) => {
    const apiCall = currentStatus === 'active'
      ? platformApi.factory.suspendFactory
      : platformApi.factory.activateFactory;

    const args = currentStatus === 'active' ? ['管理员手动暂停'] : [];

    handleStatusToggle(
      factoryId,
      currentStatus,
      {
        itemType: '工厂',
        confirmMessages: {
          suspend: '确定要暂停该工厂吗？暂停后该工厂所有员工将无法登录。',
          activate: '确定要激活该工厂吗？激活后该工厂员工将恢复登录权限。'
        }
      },
      apiCall,
      () => fetchFactories(searchKeyword, currentPage),
      ...args
    );
  };

  // 处理查看详情
  const handleViewDetails = async (factory: Factory) => {
    setSelectedFactory(factory);
    setShowDetailsModal(true);
  };

  // 处理员工管理
  const handleEmployeeManagement = (factory: Factory) => {
    setSelectedFactory(factory);
    setShowEmployeeModal(true);
  };

  // 处理编辑工厂
  const handleEditFactory = (factory: Factory) => {
    setSelectedFactory(factory);
    setEditFormData({
      name: factory.name,
      industry: factory.industry,
      owner_name: factory.owner_name,
      owner_email: factory.owner_email,
      owner_phone: factory.owner_phone || '',
      contact_address: factory.contact_address || '',
      subscription_plan: factory.subscription_plan || 'basic'
    });
    setShowEditModal(true);
  };

  // 提交编辑表单
  const handleSubmitEdit = async () => {
    if (!selectedFactory) return;

    try {
      setIsSubmitting(true);

      // 调用更新工厂API - 修正参数映射
      await platformApi.factory.updateFactory(selectedFactory.id, {
        name: editFormData.name,
        industry: editFormData.industry,
        contactName: editFormData.owner_name,
        contactEmail: editFormData.owner_email,
        contactPhone: editFormData.owner_phone,
        address: editFormData.contact_address,
        subscriptionPlan: editFormData.subscription_plan
      });

      // 关闭弹窗
      setShowEditModal(false);
      setSelectedFactory(null);
      setEditFormData({});

      // 刷新工厂列表
      await fetchFactories(searchKeyword, currentPage);

      alert('工厂信息更新成功！');
    } catch (err) {
      console.error('更新工厂信息失败:', err);
      alert('更新失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除工厂
  const handleDeleteFactory = () => {
    if (!selectedFactory) return;
    setShowDeleteConfirm(true);
  };

  // 确认删除工厂
  const handleConfirmDelete = async () => {
    if (!selectedFactory) return;

    // 验证密码
    if (deletePassword !== '123456') {
      alert('操作密码错误，请重新输入');
      return;
    }

    // 验证确认文字
    if (deleteConfirmText !== '确定删除') {
      alert('请正确输入"确定删除"四个字以确认操作');
      return;
    }

    try {
      setIsSubmitting(true);

      // 调用删除工厂API
      await platformApi.factory.deleteFactory(selectedFactory.id, deletePassword, deleteConfirmText);

      // 关闭所有弹窗
      setShowDeleteConfirm(false);
      setShowEditModal(false);

      // 重置删除表单
      setDeletePassword('');
      setDeleteConfirmText('');

      // 刷新工厂列表
      await fetchFactories(searchKeyword, currentPage);

      alert('工厂删除成功！');
    } catch (err) {
      console.error('删除工厂失败:', err);
      alert('删除失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletePassword('');
    setDeleteConfirmText('');
  };

  // 提交创建工厂表单
  const handleSubmitCreate = async () => {
    try {
      setIsSubmitting(true);

      // 调用创建工厂API
      const fullAddress = createFormData.province && createFormData.city && createFormData.district
        ? `${createFormData.province} ${createFormData.city} ${createFormData.district} ${createFormData.detailAddress}`.trim()
        : createFormData.detailAddress;

      await platformApi.factory.createFactory({
        name: createFormData.name,
        industry: createFormData.industry,
        contactName: createFormData.contactName,
        contactEmail: createFormData.contactEmail,
        contactPhone: createFormData.contactPhone,
        address: fullAddress,
        description: createFormData.description
      });

      // 关闭弹窗并重置表单
      setShowCreateModal(false);
      setCreateFormData({
        name: '',
        industry: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        province: '',
        city: '',
        district: '',
        detailAddress: '',
        description: ''
      });

      // 刷新工厂列表
      await fetchFactories(searchKeyword, currentPage);

      alert('工厂创建成功！');
    } catch (err) {
      console.error('创建工厂失败:', err);
      alert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsSubmitting(false);
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
            onClick={() => handleViewDetails(record)}
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
              onClick={() => onFactoryStatusToggle(record.id, record.status)}
              title={record.status === 'active' ? '暂停工厂' : '激活工厂'}
            >
              {record.status === 'active' ? (
                <PowerOff className="h-4 w-4 text-red-600" />
              ) : (
                <Power className="h-4 w-4 text-green-600" />
              )}
            </Button>
          )}

          {/* 员工管理 */}
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            onClick={() => handleEmployeeManagement(record)}
            title="员工管理"
          >
            <Users className="h-4 w-4 text-blue-600" />
          </Button>
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

            {/* 新建工厂按钮 */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新建工厂
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* 工厂详情弹窗 */}
      {showDetailsModal && selectedFactory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">工厂详情</h2>
              <Button
                variant="ghost"
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">工厂名称</label>
                  <p className="text-gray-900 font-medium">{selectedFactory.name}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">工厂ID</label>
                  <p className="text-gray-900 font-mono text-sm">{selectedFactory.id}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">所属行业</label>
                  <p className="text-gray-900">{selectedFactory.industry}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">工厂状态</label>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedFactory.status)}
                    <span className="text-gray-600 text-sm">
                      {selectedFactory.status === 'active' ? '所有员工可正常登录' : '所有员工已禁止登录'}
                    </span>
                  </div>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">负责人</label>
                  <p className="text-gray-900">{selectedFactory.owner_name}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">联系邮箱</label>
                  <p className="text-gray-900">{selectedFactory.owner_email}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">联系电话</label>
                  <p className="text-gray-900">{selectedFactory.owner_phone || '未设置'}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">员工数量</label>
                  <p className="text-gray-900">{selectedFactory.employee_count || '未统计'}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">工厂地址</label>
                  <p className="text-gray-900">{selectedFactory.contact_address || '未设置'}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">订阅套餐</label>
                  <p className="text-gray-900">{selectedFactory.subscription_plan || '标准版'}</p>
                </div>

                <div className="py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700 block mb-1">创建时间</label>
                  <p className="text-gray-900">{new Date(selectedFactory.created_at).toLocaleString('zh-CN')}</p>
                </div>

                <div className="py-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">最后更新</label>
                  <p className="text-gray-900">{new Date(selectedFactory.updated_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
                关闭
              </Button>
              <Button onClick={() => handleEditFactory(selectedFactory)}>
                编辑信息
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 工厂编辑弹窗 */}
      {showEditModal && selectedFactory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">编辑工厂信息</h2>
              <Button
                variant="ghost"
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">工厂名称 *</label>
                  <Input
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入工厂名称"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">所属行业</label>
                  <select
                    value={editFormData.industry || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">请选择行业</option>
                    <option value="食品加工">食品加工</option>
                    <option value="畜牧养殖">畜牧养殖</option>
                    <option value="水产养殖">水产养殖</option>
                    <option value="农产品加工">农产品加工</option>
                    <option value="制造业">制造业</option>
                    <option value="其他">其他</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">负责人姓名 *</label>
                  <Input
                    value={editFormData.owner_name || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="请输入负责人姓名"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">联系邮箱 *</label>
                  <Input
                    type="email"
                    value={editFormData.owner_email || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, owner_email: e.target.value }))}
                    placeholder="请输入联系邮箱"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">联系电话</label>
                  <Input
                    value={editFormData.owner_phone || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, owner_phone: e.target.value }))}
                    placeholder="请输入联系电话"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">工厂地址</label>
                  <Input
                    value={editFormData.contact_address || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, contact_address: e.target.value }))}
                    placeholder="请输入工厂地址"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">订阅套餐</label>
                  <select
                    value={editFormData.subscription_plan || 'basic'}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, subscription_plan: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="basic">基础版</option>
                    <option value="standard">标准版</option>
                    <option value="premium">专业版</option>
                    <option value="enterprise">企业版</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              {/* 左侧删除按钮 */}
              <Button
                onClick={handleDeleteFactory}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white transition-all duration-200 hover:shadow-lg"
              >
                <Trash2 className="h-4 w-4 text-white" />
                删除工厂
              </Button>

              {/* 右侧操作按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmitEdit}
                  disabled={isSubmitting || !editFormData.name || !editFormData.owner_name || !editFormData.owner_email}
                  className="min-w-[80px]"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建工厂弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">新建工厂</h2>
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">工厂名称 *</label>
                  <Input
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入工厂名称"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block mb-3">所属行业 *</label>
                  <IndustrySelector
                    value={createFormData.industry}
                    onChange={(code, industry) => setCreateFormData(prev => ({ ...prev, industry: code }))}
                    placeholder="请选择工厂所属行业"
                    required
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-gray-700 block">负责人姓名 *</label>
                  <Input
                    value={createFormData.contactName}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="请输入负责人姓名"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">联系邮箱 *</label>
                  <Input
                    type="email"
                    value={createFormData.contactEmail}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="请输入联系邮箱"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">联系电话</label>
                  <Input
                    value={createFormData.contactPhone}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="请输入联系电话"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-gray-700 block mb-3">工厂地址 *</label>
                  <RegionSelector
                    value={{
                      province: createFormData.province,
                      city: createFormData.city,
                      district: createFormData.district
                    }}
                    onChange={(regionData) => setCreateFormData(prev => ({
                      ...prev,
                      province: regionData.provinceName,
                      city: regionData.cityName,
                      district: regionData.districtName
                    }))}
                    required
                  />
                  <Input
                    value={createFormData.detailAddress}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, detailAddress: e.target.value }))}
                    placeholder="请输入详细地址（街道、门牌号等）"
                    className="w-full mt-3"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-gray-700 block">工厂描述</label>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="请输入工厂描述（可选）"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmitCreate}
                disabled={isSubmitting || !createFormData.name || !createFormData.contactName || !createFormData.contactEmail}
                className="min-w-[80px]"
              >
                {isSubmitting ? '创建中...' : '创建工厂'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && selectedFactory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                删除工厂 "{selectedFactory.name}"
              </h3>
              <p className="text-sm text-gray-500">
                此操作不可逆转，请谨慎操作。删除后所有相关数据将无法恢复。
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  请输入平台管理员操作密码
                </label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="请输入操作密码"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  请输入"确定删除"以确认操作
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="请输入：确定删除"
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={handleCancelDelete}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isSubmitting || !deletePassword || deleteConfirmText !== '确定删除'}
                className="min-w-[80px]"
              >
                {isSubmitting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 员工管理弹窗 */}
      {showEmployeeModal && selectedFactory && (
        <EmployeeManagementModal
          factory={selectedFactory}
          isOpen={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
        />
      )}
    </Card>
  );
}
