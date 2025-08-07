'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import {
  X,
  Upload,
  Download,
  UserPlus,
  Phone,
  AlertCircle,
  CheckCircle,
  Trash2,
  Users,
  FileText
} from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { Factory, Whitelist, WhitelistStatus } from '@/mocks/data/platform-data';
import {
  downloadWhitelistTemplate,
  parseWhitelistFile,
  validatePhoneNumbers,
  isValidPhoneNumber
} from '@/utils/excel-template';

interface AddEmployeeModalProps {
  factory: Factory;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // 成功回调，用于刷新员工列表
}

export default function AddEmployeeModal({ factory, isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [activeTab, setActiveTab] = useState('single');

  // 单个添加状态
  const [singlePhoneNumber, setSinglePhoneNumber] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);

  // 批量上传状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedPhones, setParsedPhones] = useState<string[]>([]);
  const [validPhones, setValidPhones] = useState<string[]>([]);
  const [invalidPhones, setInvalidPhones] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 白名单管理状态
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistPage, setWhitelistPage] = useState(1);
  const [whitelistTotal, setWhitelistTotal] = useState(0);

  // 下载模板
  const handleDownloadTemplate = () => {
    downloadWhitelistTemplate(factory.name);
  };

  // 选择文件
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      const phoneNumbers = await parseWhitelistFile(file);
      setParsedPhones(phoneNumbers);

      const { valid, invalid } = validatePhoneNumbers(phoneNumbers);
      setValidPhones(valid);
      setInvalidPhones(invalid);
    } catch (error) {
      alert('文件解析失败: ' + (error instanceof Error ? error.message : '未知错误'));
      setSelectedFile(null);
      setParsedPhones([]);
      setValidPhones([]);
      setInvalidPhones([]);
    }
  };

  // 提交单个电话号码
  const handleSubmitSingle = async () => {
    if (!singlePhoneNumber.trim()) {
      alert('请输入电话号码');
      return;
    }

    if (!isValidPhoneNumber(singlePhoneNumber)) {
      alert('请输入有效的手机号码');
      return;
    }

    try {
      setSingleLoading(true);

      await platformApi.whitelist.addToWhitelist({
        factoryId: factory.id,
        phoneNumbers: [singlePhoneNumber],
        addedBy: 'platform_admin' // 这里应该从用户上下文获取
      });

      alert('白名单添加成功！');
      setSinglePhoneNumber('');
      onSuccess?.();
    } catch (error) {
      alert('添加失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setSingleLoading(false);
    }
  };

  // 提交批量电话号码
  const handleSubmitBatch = async () => {
    if (validPhones.length === 0) {
      alert('没有有效的电话号码可以添加');
      return;
    }

    try {
      setBatchLoading(true);

      await platformApi.whitelist.addToWhitelist({
        factoryId: factory.id,
        phoneNumbers: validPhones,
        addedBy: 'platform_admin' // 这里应该从用户上下文获取
      });

      alert(`成功添加 ${validPhones.length} 个电话号码到白名单！`);

      // 重置状态
      setSelectedFile(null);
      setParsedPhones([]);
      setValidPhones([]);
      setInvalidPhones([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onSuccess?.();
    } catch (error) {
      alert('批量添加失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setBatchLoading(false);
    }
  };

  // 获取白名单列表
  const fetchWhitelists = async (page = 1) => {
    try {
      setWhitelistLoading(true);

      const response = await platformApi.whitelist.getWhitelists({
        factoryId: factory.id,
        page,
        size: 10
      });

      setWhitelists(response.data.whitelists || []);
      setWhitelistTotal(response.data.pagination.total);
    } catch (error) {
      console.error('获取白名单失败:', error);
    } finally {
      setWhitelistLoading(false);
    }
  };

  // 删除白名单
  const handleDeleteWhitelist = async (whitelistId: string, phoneNumber: string) => {
    if (!confirm(`确定要删除电话号码 ${phoneNumber} 的白名单吗？`)) {
      return;
    }

    try {
      await platformApi.whitelist.removeFromWhitelist(whitelistId);
      alert('白名单删除成功！');
      fetchWhitelists(whitelistPage);
    } catch (error) {
      alert('删除失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 获取状态显示
  const getStatusBadge = (status: WhitelistStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">未注册</Badge>;
      case 'registered':
        return <Badge variant="success">已注册</Badge>;
      case 'expired':
        return <Badge variant="error">已过期</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 白名单表格列定义
  const whitelistColumns: TableColumn<Whitelist>[] = [
    {
      key: 'identifier',
      title: '电话号码',
      width: '150px',
      render: (value) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      align: 'center',
      render: (value) => getStatusBadge(value as WhitelistStatus)
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: '140px',
      render: (value) => formatDate(value)
    },
    {
      key: 'added_by_name',
      title: '添加人',
      width: '120px',
      render: (value) => value || '未知'
    },
    {
      key: 'actions',
      title: '操作',
      width: '80px',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          {record.status === 'pending' && (
            <Button
              variant="ghost"
              size="small"
              className="h-8 w-8 p-0"
              onClick={() => handleDeleteWhitelist(record.id, record.identifier)}
              title="删除白名单"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      )
    }
  ];

  // 加载白名单数据（当切换到白名单管理标签时）
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'management') {
      fetchWhitelists(1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">添加员工 - 白名单管理</h2>
            <p className="text-sm text-gray-600 mt-1">{factory.name}</p>
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
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                单个输入
              </TabsTrigger>
              <TabsTrigger value="batch" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                批量上传
              </TabsTrigger>
              <TabsTrigger value="management" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                白名单管理
              </TabsTrigger>
            </TabsList>

            {/* 单个输入 */}
            <TabsContent value="single" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">添加单个员工到白名单</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      员工手机号码 *
                    </label>
                    <Input
                      type="tel"
                      value={singlePhoneNumber}
                      onChange={(e) => setSinglePhoneNumber(e.target.value)}
                      placeholder="请输入11位手机号码，如：13800138000"
                      className="font-mono"
                    />
                    {singlePhoneNumber && !isValidPhoneNumber(singlePhoneNumber) && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        请输入有效的11位手机号码
                      </div>
                    )}
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={handleSubmitSingle}
                      disabled={singleLoading || !singlePhoneNumber || !isValidPhoneNumber(singlePhoneNumber)}
                      className="w-full sm:w-auto"
                    >
                      {singleLoading ? '添加中...' : '添加到白名单'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 批量上传 */}
            <TabsContent value="batch" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">批量上传员工白名单</CardTitle>
                    <Button
                      variant="outline"
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      下载模板
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 文件上传 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      选择Excel/CSV文件 *
                    </label>
                    <Input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      支持 .csv、.xlsx、.xls 格式。请使用下载的模板格式。
                    </p>
                  </div>

                  {/* 文件解析结果 */}
                  {selectedFile && (
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="font-medium">文件解析结果</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>有效号码: {validPhones.length} 个</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span>无效号码: {invalidPhones.length} 个</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-600" />
                          <span>总计: {parsedPhones.length} 个</span>
                        </div>
                      </div>

                      {invalidPhones.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-600">无效号码列表：</p>
                          <div className="bg-red-50 p-2 rounded text-sm text-red-800 max-h-20 overflow-y-auto">
                            {invalidPhones.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      onClick={handleSubmitBatch}
                      disabled={batchLoading || validPhones.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {batchLoading ? '上传中...' : `批量添加 (${validPhones.length}个)`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 白名单管理 */}
            <TabsContent value="management" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">白名单管理</CardTitle>
                  <p className="text-sm text-gray-600">
                    管理已发送的白名单，未注册的可以删除，已注册的无法删除
                  </p>
                </CardHeader>
                <CardContent>
                  {whitelistLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">加载中...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600">
                        共 {whitelistTotal} 条白名单记录
                      </div>

                      <Table
                        columns={whitelistColumns}
                        data={whitelists}
                        loading={whitelistLoading}
                        emptyText="暂无白名单记录"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
