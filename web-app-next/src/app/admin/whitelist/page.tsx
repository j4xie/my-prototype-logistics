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
  Phone
} from 'lucide-react';

// 白名单条目接口
interface WhitelistEntry {
  id: string;
  phone: string;
  status: 'pending' | 'registered' | 'expired';
  addedBy: string;
  addedAt: string;
  registeredAt?: string;
  expiresAt: string;
}

// 批量上传结果接口
interface BulkUploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function WhitelistManagementPage() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [newEntry, setNewEntry] = useState({
    phone: '',
    validDays: 30
  });

  // Mock数据
  const mockWhitelist: WhitelistEntry[] = [
    {
      id: '1',
      phone: '13800138001',
      status: 'registered',
      addedBy: '管理员',
      addedAt: '2025-01-15 10:00:00',
      registeredAt: '2025-01-16 14:30:00',
      expiresAt: '2025-02-15 10:00:00'
    },
    {
      id: '2',
      phone: '13800138002',
      status: 'pending',
      addedBy: '管理员',
      addedAt: '2025-01-20 15:30:00',
      expiresAt: '2025-02-20 15:30:00'
    },
    {
      id: '3',
      phone: '13800138003',
      status: 'expired',
      addedBy: '部门经理',
      addedAt: '2024-12-01 09:00:00',
      expiresAt: '2025-01-01 09:00:00'
    }
  ];

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setWhitelist(mockWhitelist);
      setLoading(false);
    }, 1000);
  }, []);

  // 过滤白名单
  const filteredWhitelist = whitelist.filter(entry => {
    const matchesSearch = entry.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 获取状态显示信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待注册', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle };
      case 'registered':
        return { label: '已注册', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'expired':
        return { label: '已过期', color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
    }
  };

  // 添加单个手机号
  const handleAddEntry = async () => {
    if (!newEntry.phone) {
      alert('请输入手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(newEntry.phone)) {
      alert('请输入有效的手机号');
      return;
    }

    // 检查重复
    if (whitelist.some(entry => entry.phone === newEntry.phone)) {
      alert('该手机号已存在于白名单中');
      return;
    }

    setLoading(true);
    try {
      // 模拟API调用
      const newWhitelistEntry: WhitelistEntry = {
        id: Date.now().toString(),
        phone: newEntry.phone,
        status: 'pending',
        addedBy: '当前管理员',
        addedAt: new Date().toLocaleString('zh-CN'),
        expiresAt: new Date(Date.now() + newEntry.validDays * 24 * 60 * 60 * 1000).toLocaleString('zh-CN')
      };

      setWhitelist(prev => [newWhitelistEntry, ...prev]);
      setShowAddModal(false);
      setNewEntry({
        phone: '',
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
      // 模拟文件解析
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟批量上传结果
      const result: BulkUploadResult = {
        success: 8,
        failed: 2,
        errors: ['第3行手机号格式错误', '第7行手机号为空']
      };

      alert(`批量上传完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.errors.length > 0) {
        console.log('错误详情:', result.errors);
      }

      setShowBulkUpload(false);
      setUploadFile(null);
      // 刷新列表
      window.location.reload();
    } catch (error) {
      console.error('批量上传失败:', error);
      alert('批量上传失败，请重试');
    } finally {
      setUploadLoading(false);
    }
  };

  // 删除条目
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个白名单条目吗？')) return;

    setLoading(true);
    try {
      setWhitelist(prev => prev.filter(entry => entry.id !== id));
      alert('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 导出白名单
  const handleExport = () => {
    // 模拟导出
    const csvContent = [
      ['手机号', '状态', '添加时间', '过期时间'],
      ...filteredWhitelist.map(entry => [
        entry.phone,
        getStatusInfo(entry.status).label,
        entry.addedAt,
        entry.expiresAt
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `员工白名单_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
                {whitelist.filter(e => e.status === 'registered').length}
              </div>
              <div className="text-xs text-gray-600">已注册</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-yellow-600">
                {whitelist.filter(e => e.status === 'pending').length}
              </div>
              <div className="text-xs text-gray-600">待注册</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-red-600">
                {whitelist.filter(e => e.status === 'expired').length}
              </div>
              <div className="text-xs text-gray-600">已过期</div>
            </CardContent>
          </Card>
        </div>

        {/* 操作按钮区 */}
        <div className="grid grid-cols-3 gap-2">
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 p-2 border rounded-md text-sm"
              >
                <option value="all">全部状态</option>
                <option value="pending">待注册</option>
                <option value="registered">已注册</option>
                <option value="expired">已过期</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* 白名单列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              白名单列表 ({filteredWhitelist.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredWhitelist.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>暂无白名单记录</p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredWhitelist.map((entry, index) => {
                  const statusInfo = getStatusInfo(entry.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 flex items-center justify-between ${
                        index !== filteredWhitelist.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{entry.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          添加时间：{entry.addedAt}
                        </div>
                        <div className="text-xs text-gray-500">
                          过期时间：{entry.expiresAt}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => handleDelete(entry.id)}
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
                    value={newEntry.phone}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, phone: e.target.value }))}
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
                  <p className="text-xs text-gray-500 mt-1">
                    文件格式：每行一个手机号，支持Excel和CSV格式
                  </p>
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
