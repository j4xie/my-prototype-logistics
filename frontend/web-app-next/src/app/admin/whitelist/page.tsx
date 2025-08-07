'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Users,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  XCircle,
  Trash2,
  Phone,
  RefreshCw
} from 'lucide-react';

// 导入白名单服务
import { 
  whitelistService, 
  WhitelistRecord, 
  WhitelistStats, 
  WhitelistStatus,
  WhitelistApiError 
} from '@/services/whitelist.service';
import { useStatusActions, useErrorHandler } from '@/hooks';

// 批量上传结果接口
interface BulkUploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function WhitelistManagementPage() {
  // 状态管理
  const [whitelist, setWhitelist] = useState<WhitelistRecord[]>([]);
  const [stats, setStats] = useState<WhitelistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // 使用新的通用Hooks
  const { handleDelete, isLoading: statusLoading } = useStatusActions();
  const { handleAsyncError } = useErrorHandler();

  const [newEntry, setNewEntry] = useState({
    phones: [] as string[],
    singlePhone: '',
    validDays: 30
  });

  // 加载白名单数据
  const loadWhitelistData = async () => {
    try {
      setLoading(true);
      
      // 并行请求列表和统计数据
      const [listResponse, statsResponse] = await Promise.all([
        whitelistService.getWhitelistList({
          page: currentPage,
          pageSize,
          status: statusFilter === 'all' ? undefined : statusFilter as WhitelistStatus,
          search: searchQuery || undefined
        }),
        whitelistService.getWhitelistStats()
      ]);

      setWhitelist(listResponse.items);
      setTotalPages(listResponse.pagination.totalPages);
      setTotalRecords(listResponse.pagination.total);
      setStats(statsResponse);

    } catch (error) {
      console.error('加载白名单数据失败:', error);
      if (error instanceof WhitelistApiError) {
        alert(`加载失败: ${error.message}`);
      } else {
        alert('加载白名单数据失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelistData();
  }, [currentPage, statusFilter, searchQuery]);

  // 搜索处理（防抖）
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  // 状态过滤处理
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1); // 过滤时重置到第一页
  };

  // 获取状态显示信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: '待注册', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle };
      case 'REGISTERED':
        return { label: '已注册', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'EXPIRED':
        return { label: '已过期', color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
    }
  };

  // 添加单个手机号
  const handleAddEntry = async () => {
    if (!newEntry.singlePhone) {
      alert('请输入手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(newEntry.singlePhone)) {
      alert('请输入有效的手机号');
      return;
    }

    setLoading(true);
    try {
      // 计算过期时间
      const expiresAt = new Date(Date.now() + newEntry.validDays * 24 * 60 * 60 * 1000).toISOString();
      
      await whitelistService.addWhitelist({
        phoneNumbers: [newEntry.singlePhone],
        expiresAt
      });

      // 重新加载数据
      await loadWhitelistData();
      
      setShowAddModal(false);
      setNewEntry({
        phones: [],
        singlePhone: '',
        validDays: 30
      });
      alert('添加成功');
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 批量上传处理
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      alert('请选择文件');
      return;
    }

    setUploadLoading(true);
    try {
      // 计算过期时间
      const expiresAt = new Date(Date.now() + newEntry.validDays * 24 * 60 * 60 * 1000).toISOString();
      
      const result = await whitelistService.uploadWhitelistFile(uploadFile, expiresAt);
      
      // 构建详细的结果信息
      let message = `批量上传完成!\n`;
      message += `• 处理文件行数: ${result.parseResult?.totalRows || 0}\n`;
      message += `• 有效手机号: ${result.totalPhones}\n`;
      message += `• 成功批次: ${result.successBatches}/${result.totalBatches}\n`;
      
      if (result.errors && result.errors.length > 0) {
        message += `\n错误信息:\n${result.errors.slice(0, 5).join('\n')}`;
        if (result.errors.length > 5) {
          message += `\n... 还有 ${result.errors.length - 5} 个错误`;
        }
      }
      
      alert(message);
      
      // 重新加载数据
      await loadWhitelistData();
      
      setShowBulkUpload(false);
      setUploadFile(null);
    } catch (error) {
      console.error('批量上传失败:', error);
      if (error instanceof WhitelistApiError) {
        alert(`批量上传失败: ${error.message}`);
      } else {
        alert('批量上传失败，请重试');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  // 删除条目 - 使用新的通用Hook
  const onDeleteWhitelist = (id: number, phoneNumber: string) => {
    handleDelete(
      id.toString(),
      phoneNumber,
      {
        itemType: '白名单条目',
        confirmMessages: {
          delete: `确定要删除白名单条目"${phoneNumber}"吗？此操作不可恢复！`
        }
      },
      (idStr: string) => whitelistService.deleteWhitelist(parseInt(idStr)),
      () => loadWhitelistData()
    );
  };

  // 导出白名单
  const handleExport = () => {
    const csvContent = [
      ['手机号', '状态', '添加时间', '过期时间', '添加人'],
      ...whitelist.map(entry => [
        entry.phoneNumber,
        getStatusInfo(entry.status).label,
        entry.createdAt,
        entry.expiresAt || '',
        entry.addedByUser?.fullName || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `员工白名单_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 下载导入模板
  const handleDownloadTemplate = async () => {
    try {
      const { excelParser } = await import('@/utils/excel-parser');
      excelParser.downloadSampleCSV();
    } catch (error) {
      console.error('下载模板失败:', error);
      alert('下载模板失败，请重试');
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">员工白名单管理</h1>
          <p className="text-sm text-gray-600">管理可注册的员工手机号</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-green-600">
                {stats?.statusStats.REGISTERED || 0}
              </div>
              <div className="text-xs text-gray-600">已注册</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-yellow-600">
                {stats?.statusStats.PENDING || 0}
              </div>
              <div className="text-xs text-gray-600">待注册</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-red-600">
                {stats?.statusStats.EXPIRED || 0}
              </div>
              <div className="text-xs text-gray-600">已过期</div>
            </CardContent>
          </Card>
        </div>

        {/* 操作按钮区 */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1 text-xs"
          >
            <Plus className="w-3 h-3" />
            添加手机号
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center justify-center gap-1 text-xs"
          >
            <Upload className="w-3 h-3" />
            批量上传
          </Button>
          <Button
            variant="secondary"
            onClick={loadWhitelistData}
            className="flex items-center justify-center gap-1 text-xs"
            title="刷新白名单数据"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            className="flex items-center justify-center gap-1 text-xs"
          >
            <Download className="w-3 h-3" />
            导出
          </Button>
        </div>

        {/* 搜索和过滤 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索手机号..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="flex-1 p-2 border rounded-md text-sm"
              >
                <option value="all">全部状态</option>
                <option value="PENDING">待注册</option>
                <option value="REGISTERED">已注册</option>
                <option value="EXPIRED">已过期</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* 白名单列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              白名单列表 ({totalRecords})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {whitelist.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>暂无白名单记录</p>
              </div>
            ) : (
              <div className="space-y-0">
                {whitelist.map((entry, index) => {
                  const statusInfo = getStatusInfo(entry.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 flex items-center justify-between ${
                        index !== whitelist.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{entry.phoneNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          添加时间：{new Date(entry.createdAt).toLocaleString('zh-CN')}
                        </div>
                        <div className="text-xs text-gray-500">
                          过期时间：{entry.expiresAt ? new Date(entry.expiresAt).toLocaleString('zh-CN') : '无限期'}
                        </div>
                        {entry.addedByUser && (
                          <div className="text-xs text-gray-500">
                            添加人：{entry.addedByUser.fullName}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => onDeleteWhitelist(entry.id, entry.phoneNumber)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  第 {currentPage} 页，共 {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs"
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 添加手机号模态框 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-center">添加手机号到白名单</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    手机号 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="请输入11位手机号"
                    value={newEntry.singlePhone}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, singlePhone: e.target.value }))}
                    maxLength={11}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">有效期 (天)</label>
                  <Input
                    type="number"
                    value={newEntry.validDays}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, validDays: parseInt(e.target.value) || 30 }))}
                    min={1}
                    max={365}
                  />
                </div>
                                <div className="flex gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleAddEntry}
                    className="flex-1"
                  >
                    确认添加
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 批量上传模态框 */}
        {showBulkUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-center">批量上传手机号</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">选择Excel/CSV文件</label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      文件格式：每行一个手机号，支持Excel和CSV格式
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadTemplate}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      下载模板
                    </Button>
                  </div>
                </div>
                                <div className="flex gap-2 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowBulkUpload(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || uploadLoading}
                    className="flex-1"
                  >
                    {uploadLoading ? '上传中...' : '开始上传'}
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
